const axios = require('axios');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const base = require('../shared/base');
const { pollLimiter } = require('../shared/limiters');
const { linkingTokenStore } = require('../shared/stores');
const { logAuth, logConnection, logDuplicate } = require('../shared/logging');
const { sanitizeForAirtable, sanitizeUsername, sanitizeEmail } = require('../utils/airtable-sanitizer');
const { findPotentialDuplicates } = require('../utils/name-matcher');
const { sendWarningAlert } = require('../utils/alerting');
const { Markup } = require('telegraf');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = function createOAuthRouter(bot) {
  const router = require('express').Router();

  // Google OAuth
  router.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'No token provided' });
    }

    try {
      // 1. Verify Token
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      const { email, name, picture, family_name, given_name } = payload;

      logConnection(`Google login attempt for ${email}`, 'ATTEMPT');

      // 2. Check/Update Airtable
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 1
        })
        .firstPage();

      let record;
      let isNew = false;
      let telegramConnected = false;

      if (records.length > 0) {
        record = records[0];
        telegramConnected = !!record.fields.Tg_ID;
        logConnection(`Google login success: Existing user ${email} (ID: ${record.id})`, 'SUCCESS');

        // Update Avatar if missing
        if (!record.fields.Avatar && picture) {
          await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
            id: record.id,
            fields: { Avatar: [{ url: picture }] }
          }]);
        }
      } else {
        // Create New Use (Gmail Only)
        isNew = true;
        const newFields = {
          Email: email,
          Name: given_name || name,
          Family: family_name || '',
          Status: 'EarlyBird',
          Created_At: new Date().toISOString().split('T')[0],
        };

        const createRes = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([{
          fields: newFields
        }]);
        record = createRes[0];
        logConnection(`Google login success: New user created for ${email} (ID: ${record.id})`, 'SUCCESS');
      }

      // 3. Return Session Data
      res.json({
        success: true,
        user: {
          id: record.id, // Return Airtable ID for reference
          username: record.fields.Tg_Username || null,
          Tg_Username: record.fields.Tg_Username || null,
          Tg_ID: record.fields.Tg_ID || null,
          email: email,
          status: record.fields.Status,
          consentGdpr: record.fields.Consent_GDPR,
          firstName: record.fields.Name || given_name,
          lastName: record.fields.Family || family_name,
          telegramConnected: telegramConnected,
          tgId: record.fields.Tg_ID,
          linkedAccounts: ['google']
            .concat(telegramConnected ? ['telegram'] : [])
            .concat(record.fields.Linkedin_ID ? ['linkedin'] : [])
            .filter((v, i, a) => a.indexOf(v) === i)
        },
        isNew,
        message: telegramConnected ? 'Login successful' : 'Please connect your Telegram account'
      });

    } catch (error) {
      logConnection(`Google Auth Error for token: ${error.message}`, 'ERROR');
      console.error('Google Auth Error:', error);
      res.status(401).json({ success: false, message: 'Invalid Token' });
    }
  });

  // LinkedIn Auth URL Generation
  router.get('/api/auth/linkedin/url', (req, res) => {
    const scope = 'openid profile email';
    const state = Math.random().toString(36).substring(7);
    // Default to env or prod, but allow override from query for localhost dev
    const redirectUri = req.query.redirectUri || process.env.LINKEDIN_REDIRECT_URI || 'https://linked.coffee/auth/linkedin/callback';

    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    res.json({ url });
  });

  // LinkedIn Auth Callback
  router.post('/api/auth/linkedin', async (req, res) => {
    const { code, redirectUri: clientRedirectUri, currentUserId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'No code provided' });

    try {
      // Must match the one used in the URL generation exactly
      const redirectUri = clientRedirectUri || process.env.LINKEDIN_REDIRECT_URI || 'https://linked.coffee/auth/linkedin/callback';

      // 1. Exchange Code for Token
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = tokenResponse.data;

      // 2. Get User Info
      const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const { sub, email, name, given_name, family_name, picture } = userInfoResponse.data;

      logConnection(`LinkedIn login attempt for ${email} (sub: ${sub})`, 'ATTEMPT');

      // 3. Check/Update Airtable
      // Priority 1: Match by Linkedin_ID
      let records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Linkedin_ID} = '${sub}'`,
        maxRecords: 1
      }).firstPage();

      let record;
      let isNew = false;
      let telegramConnected = false;

      if (records.length > 0) {
        record = records[0];
        telegramConnected = !!record.fields.Tg_ID;
        logConnection(`LinkedIn login success: Found via Linkedin_ID ${email}`, 'SUCCESS');

        // Update Avatar if missing and provided
        if (!record.fields.Avatar && picture) {
          await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
            id: record.id,
            fields: { Avatar: [{ url: picture }] }
          }]);
        }
      } else {
        // Priority 2: Match by Email
        const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 1
        }).firstPage();

        if (currentUserId) {
          // EXPLICIT LINKING (User is already logged in)
          // If currentUserId is provided, we prefer linking to THAT user,
          // unless the LinkedIn account is already claimed by someone else (handled by Priority 1).

          // Safety: If emailRecords found someone ELSE, we should warn or merge.
          // But for "Connect LinkedIn", we usually just want to attach it to the current user
          // validating that the current user exists.
          try {
            record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(currentUserId);
            if (record) {
              telegramConnected = !!record.fields.Tg_ID;

              // If the user has a DIFFERENT email than LinkedIn, that's fine for linking ID,
              // but we might want to store the LinkedIn email somewhere?
              // For now, just Linking the ID is sufficient for Auth.
              // We update the Linkedin_ID field.
              await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
                id: record.id,
                fields: { Linkedin_ID: sub }
              }]);
              logConnection(`LinkedIn login: Explicitly linked to user ${currentUserId} (${email})`, 'SUCCESS');
            }
          } catch (e) {
            console.error('Explicit Link Error', e);
          }
        }

        if (!record && emailRecords.length > 0) {
          // Link Account by Email (Implicit)
          record = emailRecords[0];
          telegramConnected = !!record.fields.Tg_ID;
          await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
            id: record.id,
            fields: { Linkedin_ID: sub }
          }]);
          logConnection(`LinkedIn login: Linked to existing email ${email}`, 'SUCCESS');
        }

        if (!record) {
          // DUPLICATE DETECTION: Check for potential duplicates by name before creating new user
          const potentialDuplicates = await findPotentialDuplicates(
            given_name || name,
            family_name || '',
            base,
            process.env.AIRTABLE_MEMBERS_TABLE
          );

          if (potentialDuplicates.length > 0) {
            const topMatch = potentialDuplicates[0];
            const { record: duplicateRecord, confidence, matchReason } = topMatch;

            const duplicateInfo = {
              id: duplicateRecord.id,
              name: `${duplicateRecord.fields.Name || ''} ${duplicateRecord.fields.Family || ''}`.trim(),
              email: duplicateRecord.fields.Email || 'N/A',
              telegram: duplicateRecord.fields.Tg_Username ? `@${duplicateRecord.fields.Tg_Username}` : 'Not linked',
              tgId: duplicateRecord.fields.Tg_ID || 'N/A'
            };

            // Log duplicate detection
            logDuplicate(
              `Potential duplicate detected for LinkedIn login ${email}:\n` +
              `  Input: ${given_name || name} ${family_name || ''}\n` +
              `  Match: ${duplicateInfo.name} (${duplicateInfo.id})\n` +
              `  Confidence: ${confidence}%\n` +
              `  Reason: ${matchReason}\n` +
              `  Existing Email: ${duplicateInfo.email}\n` +
              `  Existing Telegram: ${duplicateInfo.telegram}`,
              'WARN'
            );

            // Handle based on confidence level
            if (confidence >= 90) {
              // HIGH CONFIDENCE: Very likely the same person
              const existingTgId = duplicateRecord.fields.Tg_ID;

              // If existing account has Telegram, send magic link for self-service linking
              if (existingTgId) {
                // Two-token system: pollingToken (exposed to browser), linkingToken (secret, Telegram only)
                const pollingToken = crypto.randomBytes(16).toString('hex');
                const linkingToken = crypto.randomBytes(16).toString('hex');

                const tokenEntry = {
                  pollingToken,
                  linkingToken,
                  linkedinSub: sub,
                  linkedinEmail: email,
                  linkedinName: `${given_name || name} ${family_name || ''}`.trim(),
                  linkedinPicture: picture || null,
                  existingRecordId: duplicateRecord.id,
                  existingTgId,
                  expiresAt: Date.now() + 10 * 60 * 1000,
                  status: 'pending',
                  session: null
                };

                // Store by both keys for O(1) lookup from either direction
                linkingTokenStore.set(pollingToken, tokenEntry);
                linkingTokenStore.set(linkingToken, tokenEntry);

                // Send Telegram message with confirm/reject buttons (uses secret linkingToken)
                // Using HTML parse mode to avoid Markdown injection from user-controlled name/email
                try {
                  const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  const linkedinDisplayName = escapeHtml(`${given_name || name} ${family_name || ''}`.trim());
                  const safeEmail = escapeHtml(email);
                  await bot.telegram.sendMessage(
                    existingTgId,
                    `\u{1F517} <b>Account Linking Request</b>\n\n` +
                    `Someone is trying to connect a LinkedIn account to your Linked.Coffee profile.\n\n` +
                    `<b>LinkedIn Account:</b>\n` +
                    `\u2022 Name: ${linkedinDisplayName}\n` +
                    `\u2022 Email: ${safeEmail}\n\n` +
                    `Is this you?`,
                    {
                      parse_mode: 'HTML',
                      ...Markup.inlineKeyboard([
                        [Markup.button.callback('Yes, link my accounts', `link_confirm:${linkingToken}`)],
                        [Markup.button.callback('No, this is not me', `link_reject:${linkingToken}`)]
                      ])
                    }
                  );
                } catch (tgError) {
                  console.error('Failed to send linking message via Telegram:', tgError);
                  linkingTokenStore.delete(pollingToken);
                  linkingTokenStore.delete(linkingToken);

                  // Fall back to "contact support" if Telegram send fails
                  return res.status(409).json({
                    success: false,
                    duplicateDetected: true,
                    message: `We found an existing account for ${duplicateInfo.name}. Please contact support to link your accounts.`,
                    potentialMatch: {
                      name: duplicateInfo.name,
                      hasTelegram: true,
                      telegram: duplicateInfo.telegram
                    }
                  });
                }

                // Notify admin about the linking attempt
                try {
                  await sendWarningAlert(
                    '\u{1F517} Account Linking Initiated',
                    `**LinkedIn \u2192 Telegram Linking**\n\n` +
                    `**LinkedIn Account:**\n` +
                    `\u2022 Email: ${email}\n` +
                    `\u2022 Name: ${given_name || name} ${family_name || ''}\n` +
                    `\u2022 LinkedIn Sub: ${sub}\n\n` +
                    `**Existing Telegram Account:**\n` +
                    `\u2022 Record ID: ${duplicateInfo.id}\n` +
                    `\u2022 Name: ${duplicateInfo.name}\n` +
                    `\u2022 Telegram: ${duplicateInfo.telegram}\n\n` +
                    `**Match:** ${confidence}% \u2014 ${matchReason}\n\n` +
                    `\u2139\uFE0F Magic link sent to Telegram. Awaiting user confirmation.`
                  );
                } catch (alertError) {
                  console.error('Failed to send linking alert:', alertError);
                }

                // Return only pollingToken to browser (linkingToken stays secret in Telegram)
                return res.status(409).json({
                  success: false,
                  duplicateDetected: true,
                  linkingInitiated: true,
                  linkingToken: pollingToken,
                  message: `We found your existing account. Check your Telegram to confirm linking.`,
                  potentialMatch: {
                    name: duplicateInfo.name,
                    hasTelegram: true,
                    telegram: duplicateInfo.telegram
                  }
                });
              }

              // No Tg_ID on existing record — fall back to admin notification + "contact support"
              try {
                await sendWarningAlert(
                  '\u{1F6A8} High-Confidence Duplicate Detected',
                  `**LinkedIn Login Duplicate Alert**\n\n` +
                  `**New Login Attempt:**\n` +
                  `\u2022 Email: ${email}\n` +
                  `\u2022 Name: ${given_name || name} ${family_name || ''}\n` +
                  `\u2022 LinkedIn Sub: ${sub}\n\n` +
                  `**Potential Existing Account:**\n` +
                  `\u2022 Record ID: ${duplicateInfo.id}\n` +
                  `\u2022 Name: ${duplicateInfo.name}\n` +
                  `\u2022 Email: ${duplicateInfo.email}\n` +
                  `\u2022 Telegram: ${duplicateInfo.telegram}\n\n` +
                  `**Match Details:**\n` +
                  `\u2022 Confidence: ${confidence}%\n` +
                  `\u2022 Reason: ${matchReason}\n\n` +
                  `\u26A0\uFE0F **Action:** New account was NOT created. No Tg_ID on existing record \u2014 manual linking required.`
                );
              } catch (alertError) {
                console.error('Failed to send duplicate alert:', alertError);
              }

              return res.status(409).json({
                success: false,
                duplicateDetected: true,
                message: `We found an existing account for ${duplicateInfo.name}. Please contact support to link your accounts.`,
                potentialMatch: {
                  name: duplicateInfo.name,
                  hasTelegram: false,
                  telegram: duplicateInfo.telegram
                }
              });

            } else if (confidence >= 70) {
              // MEDIUM CONFIDENCE: Likely duplicate but create account + notify admin
              logDuplicate(
                `Medium-confidence duplicate - creating account but flagging for review: ${email}`,
                'WARN'
              );

              try {
                await sendWarningAlert(
                  '\u26A0\uFE0F Medium-Confidence Duplicate Created',
                  `**LinkedIn Login Duplicate Alert**\n\n` +
                  `**New Account Created:**\n` +
                  `\u2022 Email: ${email}\n` +
                  `\u2022 Name: ${given_name || name} ${family_name || ''}\n` +
                  `\u2022 LinkedIn Sub: ${sub}\n\n` +
                  `**Potential Existing Account:**\n` +
                  `\u2022 Record ID: ${duplicateInfo.id}\n` +
                  `\u2022 Name: ${duplicateInfo.name}\n` +
                  `\u2022 Email: ${duplicateInfo.email}\n` +
                  `\u2022 Telegram: ${duplicateInfo.telegram}\n\n` +
                  `**Match Details:**\n` +
                  `\u2022 Confidence: ${confidence}%\n` +
                  `\u2022 Reason: ${matchReason}\n\n` +
                  `\u2139\uFE0F **Action:** New account was created but may be duplicate. Please review and merge if needed.`
                );
              } catch (alertError) {
                console.error('Failed to send duplicate alert:', alertError);
              }

              // Continue with account creation (fall through to creation logic below)
            } else {
              // LOW CONFIDENCE (60-69): Log only, create account
              logDuplicate(
                `Low-confidence potential duplicate - creating account: ${email} (confidence: ${confidence}%)`,
                'INFO'
              );
            }
          }

          // Create New User
          isNew = true;
          const newFields = {
            Email: email,
            Name: given_name || name,
            Family: family_name || '',
            Status: 'EarlyBird',
            Created_At: new Date().toISOString().split('T')[0],
            Linkedin_ID: sub
          };
          // Add avatar if available
          if (picture) {
            newFields.Avatar = [{ url: picture }];
          }

          const createRes = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([{ fields: newFields }]);
          record = createRes[0];
          logConnection(`LinkedIn login: New user created ${email}`, 'SUCCESS');
        }
      }

      // 4. Return Session
      res.json({
        success: true,
        user: {
          id: record.id,
          username: record.fields.Tg_Username || null,
          Tg_Username: record.fields.Tg_Username || null,
          Tg_ID: record.fields.Tg_ID || null,
          email: email,
          status: record.fields.Status,
          consentGdpr: record.fields.Consent_GDPR,
          firstName: record.fields.Name || given_name,
          lastName: record.fields.Family || family_name,
          telegramConnected: telegramConnected,
          tgId: record.fields.Tg_ID,
          linkedAccounts: ['linkedin'].concat(telegramConnected ? ['telegram'] : [])
            .concat(record.fields.Linkedin_ID ? ['linkedin'] : [])
            .filter((v, i, a) => a.indexOf(v) === i) // unique
        },
        isNew,
        message: telegramConnected ? 'Login successful' : 'Please connect your Telegram account'
      });

    } catch (error) {
      if (error.response) {
        console.error('LinkedIn Auth Error Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('LinkedIn Auth Error Message:', error.message);
      }
      logConnection(`LinkedIn Auth Error: ${error.message}`, 'ERROR');
      res.status(401).json({ success: false, message: 'LinkedIn Authentication Failed' });
    }
  });

  // Poll account linking status (used by frontend during LinkedIn <-> Telegram linking)
  // Browser polls with pollingToken only -- linkingToken is never exposed to browser
  router.get('/api/auth/link-status/:token', pollLimiter, (req, res) => {
    const { token } = req.params;

    if (!token || typeof token !== 'string' || !/^[a-f0-9]{32}$/i.test(token)) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const tokenData = linkingTokenStore.get(token);

    if (!tokenData) {
      return res.status(404).json({ status: 'not_found' });
    }

    // Only allow polling via pollingToken, not linkingToken
    if (tokenData.pollingToken !== token) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (Date.now() > tokenData.expiresAt) {
      linkingTokenStore.delete(tokenData.pollingToken);
      linkingTokenStore.delete(tokenData.linkingToken);
      return res.json({ status: 'expired' });
    }

    if (tokenData.status === 'completed' && tokenData.session) {
      // Return session data and clean up both token entries
      const session = { ...tokenData.session };
      linkingTokenStore.delete(tokenData.pollingToken);
      linkingTokenStore.delete(tokenData.linkingToken);
      return res.json({ status: 'completed', user: session });
    }

    return res.json({ status: 'pending' });
  });

  // Unlink LinkedIn Account
  router.post('/api/unlink-linkedin-account', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'User ID required' });

    try {
      const record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(id);
      if (!record) return res.status(404).json({ success: false, message: 'User not found' });

      // Safety Check: Must have email or telegram
      if (!record.fields.Email && !record.fields.Tg_ID) {
        return res.status(400).json({ success: false, message: 'Cannot unlink your only login method' });
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
        id: record.id,
        fields: { Linkedin_ID: null }
      }]);

      logConnection(`Unlinked LinkedIn for user ${id}`, 'SUCCESS');
      res.json({ success: true, message: 'LinkedIn account unlinked' });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Failed to unlink' });
    }
  });

  // Link Google Account to Existing Telegram Account
  router.post('/api/link-google-account', async (req, res) => {
    const { token, username } = req.body;

    if (!token || !username) {
      return res.status(400).json({ success: false, message: 'Token and username are required' });
    }

    try {
      // 1. Verify Google Token
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { email } = payload;

      logConnection(`Attempt to link Google account ${email} to Telegram @${username}`, 'ATTEMPT');

      // 2. Find the current user by Telegram username
      const currentUserRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${username}'`,
          maxRecords: 1
        })
        .firstPage();

      if (currentUserRecords.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const currentUser = currentUserRecords[0];

      // 3. Check if this user already has a different email linked
      if (currentUser.fields.Email && currentUser.fields.Email !== email) {
        return res.status(400).json({
          success: false,
          message: 'You already have a different Google account linked. Please unlink it first.'
        });
      }

      // 4. Check if this email is already used by another account
      const emailCheckRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 2
        })
        .firstPage();

      const otherUserWithEmail = emailCheckRecords.find(record => record.id !== currentUser.id);

      if (otherUserWithEmail) {
        return res.status(400).json({
          success: false,
          message: 'This email is already linked to another account'
        });
      }

      // 5. Update the user's Email field
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
        id: currentUser.id,
        fields: { Email: email }
      }]);

      logConnection(`Successfully linked ${email} to Telegram @${username} (ID: ${currentUser.id})`, 'SUCCESS');

      // 6. Return success with updated user data
      res.json({
        success: true,
        message: 'Google account linked successfully',
        user: {
          username: currentUser.fields.Tg_Username,
          email: email,
          linkedAccounts: ['telegram', 'google'],
          telegramConnected: true,
          tgId: currentUser.fields.Tg_ID
        }
      });

    } catch (error) {
      logConnection(`Failed to link Google account ${email || ''} to @${username}: ${error.message}`, 'ERROR');
      console.error('Link Google Account Error:', error);
      res.status(500).json({ success: false, message: 'Failed to link Google account' });
    }
  });

  // Unlink Google Account from Telegram Account
  router.post('/api/unlink-google-account', async (req, res) => {
    const { username } = req.body;

    logConnection(`Attempt to unlink Google account from Telegram @${username || 'UNKNOWN'}`, 'ATTEMPT');

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    try {
      // 1. Find the user by Telegram username
      const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${username}'`,
          maxRecords: 1
        })
        .firstPage();

      if (userRecords.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const user = userRecords[0];

      // 2. Verify user has Telegram auth (don't allow unlinking if it's their only method)
      if (!user.fields.Tg_ID) {
        logConnection(`Failed to unlink Google for @${username}: Only available auth method`, 'WARN');
        return res.status(400).json({
          success: false,
          message: 'Cannot unlink your only authentication method'
        });
      }

      // 3. Check if user even has an email linked
      if (!user.fields.Email) {
        return res.status(400).json({
          success: false,
          message: 'No Google account is linked to this profile'
        });
      }

      // 4. Clear the Email field
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
        id: user.id,
        fields: { Email: '' }
      }]);

      logConnection(`Successfully unlinked Google account from Telegram @${username} (ID: ${user.id})`, 'SUCCESS');

      // 5. Return success
      res.json({
        success: true,
        message: 'Google account unlinked successfully'
      });

    } catch (error) {
      logConnection(`Error unlinking Google for @${username}: ${error.message}`, 'ERROR');
      console.error('Unlink Google Account Error:', error);
      res.status(500).json({ success: false, message: 'Failed to unlink Google account' });
    }
  });

  return router;
};
