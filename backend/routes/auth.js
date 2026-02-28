module.exports = function createAuthRouter(bot) {
  const router = require('express').Router();
  const base = require('../shared/base');
  const { authLimiter } = require('../shared/limiters');
  const { otpStore } = require('../shared/stores');
  const { logAuth, logConnection, logDebug } = require('../shared/logging');
  const { sanitizeForAirtable, sanitizeUsername, sanitizeEmail, sanitizeTelegramId } = require('../utils/airtable-sanitizer');
  const { FRONTEND_URL } = require('../shared/config');
  const { Markup } = require('telegraf');

  // POST /api/register
  router.post('/api/register', authLimiter, async (req, res) => {
    const { telegramUsername } = req.body;
    logConnection(`Telegram OTP request for @${telegramUsername || 'UNKNOWN'}`, 'ATTEMPT');

    if (!telegramUsername) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();

    try {
      // Validate and sanitize username
      const safeUsername = sanitizeUsername(cleanUsername);

      // Check if user already registered
      const existingRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
          maxRecords: 1
        })
        .firstPage();

      if (existingRecords.length > 0) {
        const record = existingRecords[0];
        const tgId = record.fields.Tg_ID;

        console.log(`✅ User exists. Tg_ID: ${tgId}`);

        if (tgId) {
          // Case B: User has Tg_ID - Send OTP proactively
          const otp = Math.floor(100000 + Math.random() * 900000).toString();

          // Store OTP
          otpStore.set(cleanUsername, {
            code: otp,
            telegramId: tgId,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
          });

          try {
            // Provide both login link (for new users) and dashboard link (for Gmail users connecting Telegram)
            const loginUrl = `${FRONTEND_URL}/login?code=${otp}&user=${encodeURIComponent(cleanUsername)}`;
            const dashboardUrl = `${FRONTEND_URL}/dashboard?connectCode=${otp}&connectUser=${encodeURIComponent(cleanUsername)}`;

            const useButtons = FRONTEND_URL.startsWith('https');

            if (useButtons) {
              await bot.telegram.sendMessage(
                tgId,
                `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nClick a button below to verify:`,
                {
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [Markup.button.url('New user? Click here', loginUrl)],
                    [Markup.button.url('Already logged in? Click here', dashboardUrl)]
                  ])
                }
              );
            } else {
              await bot.telegram.sendMessage(
                tgId,
                `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\n` +
                `Click to verify:\n${loginUrl}`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
              );
            }
            logConnection(`Proactive OTP successfully sent to @${cleanUsername} (${tgId})`, 'SUCCESS');
          } catch (botError) {
            console.error('❌ Failed to send proactive OTP:', botError);
            logConnection(`Failed to send proactive OTP to @${cleanUsername}: ${botError.message}`, 'ERROR');
            // Fallback: If bot blocked or failed, treat as if no ID (ask to start bot)
            return res.json({
              success: true,
              message: 'Please start the bot to get your code.',
              isNew: false,
              hasTelegramId: false
            });
          }

          return res.json({
            success: true,
            message: 'OTP sent to your Telegram!',
            isNew: false,
            hasTelegramId: true
          });
        } else {
          // Case A: User exists but no Tg_ID
          return res.json({
            success: true,
            message: 'User exists, please verify via bot.',
            isNew: false,
            hasTelegramId: false
          });
        }
      }

      // Create new record with EarlyBird status
      await base(process.env.AIRTABLE_MEMBERS_TABLE).create([
        {
          fields: {
            Tg_Username: cleanUsername,
            Status: 'EarlyBird',
            Created_At: new Date().toISOString().split('T')[0]
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Registration started. Please verify.',
        isNew: true,
        hasTelegramId: false
      });
    } catch (error) {
      logConnection(`Telegram registration error for @${cleanUsername}: ${error.message}`, 'ERROR');
      console.error('Airtable Register Error:', JSON.stringify(error, null, 2));
      if (error.message) console.error('Error Message:', error.message);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again later.',
        details: error.message
      });
    }
  });

  // POST /api/dev-login
  router.post('/api/dev-login', async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Dev login disabled in production' });
    }

    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    console.log(`🔧 Dev login attempt for: ${cleanUsername}`);

    try {
      // Validate and sanitize username
      const safeUsername = sanitizeUsername(cleanUsername);

      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        console.log(`❌ Dev login: User not found: ${cleanUsername}`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const record = records[0];
      console.log(`✅ Dev login success for: ${cleanUsername}`);
      res.json({
        success: true,
        user: {
          username: cleanUsername,
          Tg_Username: cleanUsername,
          Tg_ID: record.fields.Tg_ID,
          status: record.fields.Status,
          consentGdpr: record.fields.Consent_GDPR,
          firstName: record.fields.Name,
          lastName: record.fields.Family
        }
      });
    } catch (error) {
      console.error('Dev login error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // POST /api/verify
  router.post('/api/verify', authLimiter, async (req, res) => {
    const { telegramUsername, otp } = req.body;
    console.log(`📥 /api/verify called with username: ${telegramUsername}, otp: ${otp}`);
    logAuth(`API Verify attempt: User=${telegramUsername}, OTP=${otp}`);

    if (!telegramUsername || !otp) {
      console.log('❌ Missing username or OTP');
      return res.status(400).json({ success: false, message: 'Username and OTP are required' });
    }

    const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();
    const cleanOtp = otp.replace(/\s+/g, '');
    console.log(`🧹 Cleaned: username="${cleanUsername}", otp="${cleanOtp}"`);

    // Verify OTP
    let telegramId = 0; // Default for magic OTP (number, not string)
    let firstName = '';
    let lastName = '';

    if (cleanOtp === '000000' && process.env.ENABLE_MAGIC_OTP === 'true') {
      // Magic OTP for testing - bypass verification
      console.log('✨ Magic OTP used. Bypassing verification.');
    } else {
      // Real OTP - verify against store
      console.log(`🔍 Looking up OTP in store for: ${cleanUsername}`);
      const storedData = otpStore.get(cleanUsername);

      if (!storedData) {
        console.log(`❌ No OTP found in store for: ${cleanUsername}`);
        return res.status(400).json({ success: false, message: 'No verification code found. Please start the bot again.' });
      }

      console.log(`✅ Found stored OTP. Checking expiry...`);
      if (Date.now() > storedData.expiresAt) {
        console.log(`⏰ OTP expired for: ${cleanUsername}`);
        logAuth(`OTP Expired for ${cleanUsername}`);
        otpStore.delete(cleanUsername);
        return res.status(400).json({ success: false, message: 'Verification code expired.' });
      }

      console.log(`🔐 Verifying OTP code...`);
      if (storedData.code !== cleanOtp) {
        console.log(`❌ OTP mismatch. Expected: ${storedData.code}, Got: ${cleanOtp}`);
        logAuth(`OTP Mismatch for ${cleanUsername}. Got: ${cleanOtp}`);
        return res.status(400).json({ success: false, message: 'Invalid verification code.' });
      }

      // OTP is valid - get the telegram ID and clean up
      telegramId = parseInt(storedData.telegramId, 10); // Convert to number
      firstName = storedData.firstName;
      lastName = storedData.lastName;
      console.log(`✅ OTP valid! Telegram ID: ${telegramId}, Name: ${firstName} ${lastName}`);
      logAuth(`Verify Success for ${cleanUsername}. OTP matches.`);
      otpStore.delete(cleanUsername);
    }

    try {
      // Validate and sanitize username
      const safeUsername = sanitizeUsername(cleanUsername);

      // Find record to update
      console.log(`🔍 Searching Airtable for username: ${cleanUsername}`);
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
          maxRecords: 1
        })
        .firstPage();

      console.log(`📄 Found ${records.length} records`);

      if (records.length > 0) {
        const record = records[0];
        console.log(`📝 Updating record ${record.id} with Tg_ID: ${telegramId} (type: ${typeof telegramId})`);

        const updateFields = {
          Tg_ID: telegramId
        };

        if (firstName) updateFields.Name = firstName;
        if (lastName) updateFields.Family = lastName;

        // Try to fetch Telegram Avatar if user has none
        if (telegramId > 0 && (!record.fields.Avatar || record.fields.Avatar.length === 0)) {
          try {
            console.log(`📸 Fetching Telegram profile photos for ${telegramId}...`);
            const userProfilePhotos = await bot.telegram.getUserProfilePhotos(telegramId, 0, 1);

            if (userProfilePhotos.total_count > 0) {
              const photos = userProfilePhotos.photos[0];
              // Get the largest size (last in array)
              const largestPhoto = photos[photos.length - 1];
              const fileLink = await bot.telegram.getFileLink(largestPhoto.file_id);

              // Telegraf getFileLink returns a URL object or string depending on version
              // We'll handle both
              const avatarUrl = typeof fileLink === 'string' ? fileLink : fileLink.href;

              console.log(`📸 Found Telegram avatar: ${avatarUrl}`);
              updateFields.Avatar = [{ url: avatarUrl }];
            } else {
              console.log('📸 No profile photos found for user.');
            }
          } catch (avatarError) {
            console.error('⚠️ Failed to fetch Telegram avatar:', avatarError);
            // Non-fatal, continue with verification
          }
        }

        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: record.id,
            fields: updateFields
          }
        ], { typecast: true });

        console.log(`✅ Successfully updated record!`);
        res.json({
          success: true,
          message: 'Verification successful! Account linked.',
          user: {
            id: record.id,
            username: cleanUsername,
            Tg_Username: cleanUsername,
            Tg_ID: telegramId || record.fields.Tg_ID,
            status: record.fields.Status,
            consentGdpr: record.fields.Consent_GDPR,
            firstName: firstName || record.fields.Name,
            lastName: lastName || record.fields.Family
          }
        });
      } else {
        // Bot-first user: No record exists yet, create one automatically
        console.log(`🆕 No record found for ${cleanUsername}. Creating new user (bot-first flow)...`);
        logAuth(`Bot-first registration: Creating new record for ${cleanUsername}`);

        // We need a valid Telegram ID to create a bot-first user
        if (!telegramId || telegramId === 0) {
          console.log(`❌ Cannot create bot-first user without valid Telegram ID`);
          return res.status(400).json({
            success: false,
            message: 'Please start the bot first to get your verification code.'
          });
        }

        // Create new record with data from bot interaction
        const newRecordFields = {
          Tg_Username: cleanUsername,
          Tg_ID: telegramId,
          Status: 'EarlyBird',
          Created_At: new Date().toISOString().split('T')[0]
        };

        if (firstName) newRecordFields.Name = firstName;
        if (lastName) newRecordFields.Family = lastName;

        // Try to fetch Telegram Avatar for new user
        try {
          console.log(`📸 Fetching Telegram profile photos for new user ${telegramId}...`);
          const userProfilePhotos = await bot.telegram.getUserProfilePhotos(telegramId, 0, 1);

          if (userProfilePhotos.total_count > 0) {
            const photos = userProfilePhotos.photos[0];
            const largestPhoto = photos[photos.length - 1];
            const fileLink = await bot.telegram.getFileLink(largestPhoto.file_id);
            const avatarUrl = typeof fileLink === 'string' ? fileLink : fileLink.href;

            console.log(`📸 Found Telegram avatar: ${avatarUrl}`);
            newRecordFields.Avatar = [{ url: avatarUrl }];
          }
        } catch (avatarError) {
          console.error('⚠️ Failed to fetch Telegram avatar for new user:', avatarError);
          // Non-fatal, continue with creation
        }

        const createdRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([
          { fields: newRecordFields }
        ], { typecast: true });

        const newRecord = createdRecords[0];
        console.log(`✅ Created new record ${newRecord.id} for bot-first user ${cleanUsername}`);
        logAuth(`Bot-first registration complete: ${cleanUsername} (Record: ${newRecord.id})`);

        res.json({
          success: true,
          message: 'Account created and linked! Please complete your profile.',
          user: {
            id: newRecord.id,
            username: cleanUsername,
            Tg_Username: cleanUsername,
            Tg_ID: telegramId,
            status: 'EarlyBird',
            consentGdpr: false, // New users need GDPR consent
            firstName: firstName || '',
            lastName: lastName || ''
          }
        });
      }
    } catch (error) {
      console.error('❌ Verify error:', error);
      res.status(500).json({ success: false, message: 'Verification failed.' });
    }
  });

  // POST /api/consent
  router.post('/api/consent', async (req, res) => {
    const { username, id, email, linkedin, name, family } = req.body;

    // We need at least ONE identifier
    if (!username && !id && !email) {
      return res.status(400).json({ success: false, message: 'User identifier (username, id, or email) is required' });
    }

    try {
      let record;

      // 1. Try finding by ID (most reliable)
      if (id) {
        try {
          record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(id);
        } catch (err) {
          console.log(`Could not find record by ID: ${id}`);
        }
      }

      // 2. Try finding by Email
      if (!record && email) {
        const safeEmail = sanitizeEmail(email);
        const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
          filterByFormula: `{Email} = '${safeEmail}'`,
          maxRecords: 1
        }).firstPage();
        if (emailRecords.length > 0) record = emailRecords[0];
      }

      // 3. Try finding by Username
      if (!record && username) {
        const cleanUsername = username.replace('@', '').trim().toLowerCase();
        const safeUsername = sanitizeUsername(cleanUsername);
        const usernameRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
          maxRecords: 1
        }).firstPage();
        if (usernameRecords.length > 0) record = usernameRecords[0];
      }

      if (record) {
        const updates = {
          Consent_GDPR: true
        };

        if (linkedin) updates.Linkedin = linkedin;
        if (name) updates.Name = name;
        if (family) updates.Family = family;

        // Update Member Record
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: record.id,
            fields: updates
          }
        ]);

        res.json({ success: true, message: 'Consent updated' });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    } catch (error) {
      console.error('Consent update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update consent' });
    }
  });

  // POST /api/unsubscribe
  router.post('/api/unsubscribe', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
      // Find user by email
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1
      }).firstPage();

      if (records.length === 0) {
        return res.status(404).json({ success: false, message: 'Email not found' });
      }

      const record = records[0];

      // Update No_Spam flag to true
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            No_Spam: true
          }
        }
      ]);

      logAuth(`Unsubscribed: ${email}`, 'INFO');
      res.json({ success: true, message: 'Successfully unsubscribed from marketing emails' });

    } catch (error) {
      console.error('Unsubscribe error:', error);
      res.status(500).json({ success: false, message: 'Failed to process unsubscribe request' });
    }
  });

  // POST /api/connect-telegram
  router.post('/api/connect-telegram', async (req, res) => {
    const { telegramUsername, otp, currentEmail, confirmMerge } = req.body;
    logConnection(`Attempt to connect @${telegramUsername} to Google account ${currentEmail}${confirmMerge ? ' (MERGE CONFIRMATION)' : ''}`, 'ATTEMPT');

    if (!telegramUsername || !currentEmail) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();
    const cleanOtp = otp ? otp.replace(/\s+/g, '') : '';

    // 1. Verify OTP (skip if this is a merge confirmation - OTP was already verified)
    let telegramId = 0;
    let firstName = '';
    let lastName = '';

    if (confirmMerge) {
      // Skip OTP verification for merge confirmation - already verified in initial request
      console.log('🔀 Merge confirmation - skipping OTP verification');
    } else if (cleanOtp === '000000' && process.env.ENABLE_MAGIC_OTP === 'true') {
      console.log('✨ Magic OTP used.');
      // If magic OTP, we can't get ID from valid store...
      // We'll trust the user provided username exists?
      // Actually, this is risky for magic OTP in this flow because we rely on ID.
      // For now, let's assume we skip ID check or fetch it differently for test.
    } else {
      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }
      const storedData = otpStore.get(cleanUsername);
      if (!storedData) {
        return res.status(400).json({ success: false, message: 'Invalid or expired code' });
      }
      if (storedData.code !== cleanOtp) {
        return res.status(400).json({ success: false, message: 'Incorrect code' });
      }
      telegramId = parseInt(storedData.telegramId, 10);
      firstName = storedData.firstName;
      lastName = storedData.lastName;
      otpStore.delete(cleanUsername); // Burn OTP
      logConnection(`OTP verified successfully for @${cleanUsername}`, 'SUCCESS');
    }

    try {
      // 2. Find "Target" (Existing Telegram User)
      // If the user already used the bot, they might have a record.
      const targetRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
          maxRecords: 1
        })
        .firstPage();

      // 3. Find "Source" (Current Gmail User)
      const sourceRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Email} = '${currentEmail}'`,
          maxRecords: 1
        })
        .firstPage();

      if (sourceRecords.length === 0) {
        return res.status(404).json({ success: false, message: 'Current session invalid' });
      }
      const sourceRecord = sourceRecords[0];

      // SCENARIO A: Telegram Profile Exists -> MERGE (with confirmation)
      if (targetRecords.length > 0) {
        const targetRecord = targetRecords[0];

        // Safety: Are they the same record?
        if (targetRecord.id === sourceRecord.id) {
          return res.json({
            success: true,
            message: 'Already connected!',
            user: {
              username: cleanUsername,
              email: currentEmail,
              telegramConnected: true,
              tgId: telegramId
            }
          });
        }

        // Check if this is a confirmation request
        const { confirmMerge } = req.body;

        if (!confirmMerge) {
          // Return merge required response - ask frontend to confirm
          logConnection(`Telegram @${cleanUsername} already exists. Merge confirmation requested for ${currentEmail}`, 'WARN');
          return res.json({
            success: false,
            requiresMerge: true,
            message: 'User with this Telegram already exists',
            existingProfile: {
              id: targetRecord.id,
              name: targetRecord.fields.Name || '',
              family: targetRecord.fields.Family || '',
              username: targetRecord.fields.Tg_Username
            }
          });
        }

        // User confirmed merge - proceed
        console.log(`🔀 MERGE CONFIRMED: Keep ${targetRecord.id}, Delete ${sourceRecord.id}`);

        // Update Target with Source's Email
        const updates = {
          Email: currentEmail
        };
        // Preserve Name/Family if Target missing them
        if (!targetRecord.fields.Name && sourceRecord.fields.Name) updates.Name = sourceRecord.fields.Name;
        if (!targetRecord.fields.Family && sourceRecord.fields.Family) updates.Family = sourceRecord.fields.Family;
        // Preserve Avatar if Target missing (extract URL only - Airtable requires { url } format for updates)
        if ((!targetRecord.fields.Avatar || targetRecord.fields.Avatar.length === 0) && sourceRecord.fields.Avatar && sourceRecord.fields.Avatar[0]?.url) {
          updates.Avatar = [{ url: sourceRecord.fields.Avatar[0].url }];
        }
        // Ensure ID is set
        if (!targetRecord.fields.Tg_ID && telegramId) updates.Tg_ID = telegramId;

        // Execute Update
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
          id: targetRecord.id,
          fields: updates
        }]);

        // Execute Delete (Source)
        await base(process.env.AIRTABLE_MEMBERS_TABLE).destroy([sourceRecord.id]);

        logConnection(`Accounts MERGED: Record ${sourceRecord.id} (${currentEmail}) deleted. Profile moved to existing Telegram @${cleanUsername} (Record ${targetRecord.id})`, 'SUCCESS');

        // Return the "Survivor" (Target) as the new user session
        return res.json({
          success: true,
          message: 'Accounts merged successfully',
          merged: true,
          user: {
            id: targetRecord.id,
            username: targetRecord.fields.Tg_Username,
            email: currentEmail,
            status: targetRecord.fields.Status,
            consentGdpr: targetRecord.fields.Consent_GDPR,
            firstName: updates.Name || targetRecord.fields.Name,
            lastName: updates.Family || targetRecord.fields.Family,
            telegramConnected: true,
            tgId: updates.Tg_ID || targetRecord.fields.Tg_ID
          }
        });

      } else {
        // SCENARIO B: Telegram Profile Does Not Exist -> LINK
        // Just update the current record (Source)
        console.log(`🔗 LINKING: Adding Telegram info to ${sourceRecord.id}`);

        const updates = {
          Tg_Username: cleanUsername,
          Tg_ID: telegramId
        };

        // If we have first/last name from Telegram and none in record, update
        if (firstName && !sourceRecord.fields.Name) updates.Name = firstName;
        if (lastName && !sourceRecord.fields.Family) updates.Family = lastName;

        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
          id: sourceRecord.id,
          fields: updates
        }]);

        logConnection(`Successfully linked Telegram @${cleanUsername} to Google account ${currentEmail} (ID: ${sourceRecord.id})`, 'SUCCESS');

        return res.json({
          success: true,
          message: 'Telegram connected successfully',
          user: {
            username: cleanUsername,
            email: currentEmail,
            status: sourceRecord.fields.Status,
            firstName: updates.Name || sourceRecord.fields.Name,
            lastName: updates.Family || sourceRecord.fields.Family,
            telegramConnected: true,
            tgId: telegramId
          }
        });
      }

    } catch (error) {
      logConnection(`Connect Telegram Error for @${telegramUsername}: ${error.message}`, 'ERROR');
      console.error('Connect Telegram Error:', error);
      res.status(500).json({ success: false, message: 'Failed to connect account: ' + error.message });
    }
  });

  // POST /api/disconnect-telegram
  router.post('/api/disconnect-telegram', async (req, res) => {
    const { id, email } = req.body;

    logConnection(`Attempt to disconnect Telegram for user ${email || id}`, 'ATTEMPT');

    // Need at least one identifier
    if (!id && !email) {
      return res.status(400).json({ success: false, message: 'User identifier required' });
    }

    try {
      let record;

      // Find user by ID first
      if (id) {
        try {
          record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(id);
        } catch (err) {
          console.log(`Could not find record by ID: ${id}`);
        }
      }

      // Try finding by email
      if (!record && email) {
        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 1
        }).firstPage();
        if (records.length > 0) record = records[0];
      }

      if (!record) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Verify user has email (required to disconnect Telegram)
      if (!record.fields.Email) {
        logConnection(`Failed to disconnect Telegram for ${email || id}: No email on file`, 'WARN');
        return res.status(400).json({
          success: false,
          message: 'Cannot disconnect Telegram: No email on file. Please connect Google first.'
        });
      }

      // Clear Telegram fields
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
        id: record.id,
        fields: {
          Tg_Username: null,
          Tg_ID: null
        }
      }]);

      logConnection(`Successfully disconnected Telegram @${record.fields.Tg_Username} from ${email || record.fields.Email}`, 'SUCCESS');

      res.json({
        success: true,
        message: 'Telegram disconnected successfully'
      });

    } catch (error) {
      logConnection(`Error disconnecting Telegram for ${email || id}: ${error.message}`, 'ERROR');
      console.error('Disconnect Telegram Error:', error);
      res.status(500).json({ success: false, message: 'Failed to disconnect Telegram' });
    }
  });

  return router;
};
