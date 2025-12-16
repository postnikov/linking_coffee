const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Scheduler = require('./scheduler');
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
console.log('📂 Log Directory:', logDir);

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    console.log('✅ Created logs directory');
  } catch (e) {
    console.error('❌ Failed to create logs directory:', e);
  }
}
const debugLogFile = path.join(logDir, 'debug.log');
const authLogFile = path.join(logDir, 'auth.log');

// Ensure backups directory exists
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✅ Created backups directory: ${backupDir}`);
  } catch (e) {
    console.error('❌ Failed to create backups directory:', e);
  }
}

// Test write access on startup
try {
  fs.appendFileSync(authLogFile, `[${new Date().toISOString()}] Server Initialized\n`);
  console.log('✅ Auth log file writable');
} catch (e) {
  console.error('❌ Failed to write to auth log:', e);
}

function logDebug(msg) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(debugLogFile, `[${time}] ${msg}\n`);
  } catch (e) {
    console.error('Logging error:', e);
  }
}

function logAuth(msg) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(authLogFile, `[${time}] ${msg}\n`);
    console.log(`[AUTH] ${msg}`);
  } catch (e) {
    console.error('Auth Logging error:', e);
  }
}

const app = express();

// Redirect old domain to new domain
app.use((req, res, next) => {
  const host = req.get('host');
  if (host && host.includes('linking.coffee')) {
    const newUrl = `https://linked.coffee${req.originalUrl}`;
    return res.redirect(301, newUrl);
  }
  next();
});
const PORT = process.env.PORT || 3001;





// Middleware
app.use(cors());
app.use(express.json());

// Configure Airtable
console.log('🔹 Airtable Configuration:');
console.log('   Base ID:', process.env.AIRTABLE_BASE_ID);
console.log('   Members Table:', process.env.AIRTABLE_MEMBERS_TABLE);
console.log('   Cities Table:', process.env.AIRTABLE_CITIES_TABLE);

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Configure Multer for file uploads
const multer = require('multer');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory OTP store: Map<username_lowercase, { code, expiresAt }>
const otpStore = new Map();

// Initialize Scheduler
const scheduler = new Scheduler(path.join(__dirname, 'scheduler.json'));
scheduler.init();


// Initialize Telegram Bot
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : process.env.ADMIN_BOT_TOKEN;
console.log(`🤖 Initializing Bot in ${process.env.NODE_ENV} mode`);
console.log(`🔑 Using Bot Token starting with: ${botToken ? botToken.substring(0, 5) + '...' : 'UNDEFINED'}`);
const bot = new Telegraf(botToken);

bot.start((ctx) => {
  const username = ctx.from.username;
  logAuth(`Bot /start received from: ${username} (ID: ${ctx.from.id})`);

  if (!username) {
    return ctx.reply('Please set a username in your Telegram settings to use this bot.');
  }

  const cleanUsername = username.toLowerCase();
  console.log(`🤖 Bot received /start from: ${username} (clean: ${cleanUsername})`);

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP (valid for 10 minutes)
  otpStore.set(cleanUsername, {
    code: otp,
    telegramId: ctx.from.id, // Store ID to update later
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  console.log(`✅ Generated OTP for ${cleanUsername}: ${otp}`);
  logAuth(`Generated OTP for ${cleanUsername}: ${otp}`);
  ctx.reply(`☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nPlease enter this code on the website.`, { parse_mode: 'Markdown' });
});

// Handle "I'm in" callback from weekly check-in
// Handle "Yes! I'm in!"
bot.action('participate_yes', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  console.log(`🤖 Received participate_yes from Tg_ID: ${telegramId}`);
  logAuth(`User ${telegramId} clicked YES for next week`);

  try {
    // Find user by Tg_ID
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_ID} = '${telegramId}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];

      // Conditional Logging: If previously Passive -> Activated
      if (record.fields.Next_Week_Status === 'Passive') {
          try {
              await base(process.env.AIRTABLE_LOGS_TABLE || 'tbln4rLHEgXUkL9Jh').create([{
                  fields: {
                      'Event': 'Activated',
                      'Member': [record.id]
                  }
              }]);
              console.log(`📝 Logged Activated event for ${record.id}`);
          } catch (logErr) {
              console.error('❌ Failed to log activation:', logErr);
          }
      }

      // Update Next_Week_Status to 'Active'
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            'Next_Week_Status': 'Active'
          }
        }
      ]);

      await ctx.answerCbQuery('You are in!');
      await ctx.editMessageText(
        "Awesome 🎉\n" +
        "On Monday you'll get your new match!\n" +
        "💜"
      );
    } else {
      await ctx.answerCbQuery('User not found.');
    }
  } catch (error) {
    console.error('Error handling participate_yes:', error);
    await ctx.answerCbQuery('Error updating status.');
  }
});

// Handle "No, I'll skip this week"
bot.action('participate_no', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  console.log(`🤖 Received participate_no from Tg_ID: ${telegramId}`);
  logAuth(`User ${telegramId} clicked NO for next week`);

  try {
      // Find user by Tg_ID to check status first
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_ID} = '${telegramId}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length > 0) {
          const record = records[0];

          // Conditional Logging: If previously Active -> Deactivated
          if (record.fields.Next_Week_Status === 'Active') {
              try {
                  await base(process.env.AIRTABLE_LOGS_TABLE || 'tbln4rLHEgXUkL9Jh').create([{
                      fields: {
                          'Event': 'Deactivated',
                          'Member': [record.id]
                      }
                  }]);
                  console.log(`📝 Logged Deactivated event for ${record.id}`);
              } catch (logErr) {
                  console.error('❌ Failed to log deactivation:', logErr);
              }
          }

          // Update Next_Week_Status to 'Passive'
          await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
            {
              id: record.id,
              fields: {
                'Next_Week_Status': 'Passive'
              }
            }
          ]);
      }

    await ctx.answerCbQuery('Skipped.');
    await ctx.editMessageText(
      "Got it 👍\n" +
      "No matches this week.\n" +
      "Recharge your social battery 🪫↗️🔋\n\n" +
      "I'll come back to you next weekend\n" +
      "😉"
    );
  } catch (error) {
    console.error('Error handling participate_no:', error);
  }
});

// Handle Midweek Feedback Status
bot.action(/^fb_stat:(.+):(\d+):(.+)$/, async (ctx) => {
  const matchId = ctx.match[1];
  const role = parseInt(ctx.match[2]);
  const status = ctx.match[3];

  console.log(`🤖 Received fb_stat: Match=${matchId}, Role=${role}, Status=${status}`);
  const fieldName = role === 1 ? 'We_Met_1' : 'We_Met_2';

  try {
    await base('tblx2OEN5sSR1xFI2').update([{
      id: matchId,
      fields: {
        [fieldName]: status
      }
    }], { typecast: true });

    await ctx.answerCbQuery('Status updated!');

    // Append "Thank you!" to the original message
    const originalText = ctx.callbackQuery.message.text;
    await ctx.editMessageText(originalText + "\n\nThank you! 🙏");

    // If 'Met', send follow-up rating message
    if (status === 'Met') {
      const ratingMessage = "❤️ Wow! Awesome! ❤️\nSo how was your Linked Coffee experience?\nDid it go well?";
      const ratingKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('😡 awful', `fb_rate:${matchId}:${role}:1`),
          Markup.button.callback('😐 boring', `fb_rate:${matchId}:${role}:2`)
        ],
        [
          Markup.button.callback('🙂 ok', `fb_rate:${matchId}:${role}:3`),
          Markup.button.callback('😃 wonderful', `fb_rate:${matchId}:${role}:4`)
        ]
      ]);
      await ctx.reply(ratingMessage, ratingKeyboard);
    }

  } catch (error) {
    console.error('Error handling fb_stat:', error);
    await ctx.answerCbQuery('Error updating status.');
  }
});

// Handle Midweek Feedback Rating
bot.action(/^fb_rate:(.+):(\d+):(\d+)$/, async (ctx) => {
  const matchId = ctx.match[1];
  const role = parseInt(ctx.match[2]);
  const rating = parseInt(ctx.match[3]);

  console.log(`🤖 Received fb_rate: Match=${matchId}, Role=${role}, Rating=${rating}`);
  const fieldName = role === 1 ? 'Feedback1' : 'Feedback2';

  try {
    await base('tblx2OEN5sSR1xFI2').update([{
      id: matchId,
      fields: {
        [fieldName]: rating
      }
    }]);

    await ctx.answerCbQuery('Feedback received!');

    const originalText = ctx.callbackQuery.message.text;
    await ctx.editMessageText(originalText + "\n\nThank you! 🙏");

  } catch (error) {
    console.error('Error handling fb_rate:', error);
    await ctx.answerCbQuery('Error saving feedback.');
  }
});

bot.launch().then(() => {
  console.log('🤖 Telegram bot started');
}).catch(err => {
  console.error('❌ Telegram bot failed to start:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linked.Coffee API is running' });
});

// Step 1: Register (Create Record) or Request OTP
app.post('/api/register', async (req, res) => {
  const { telegramUsername } = req.body;
  console.log(`📥 /api/register called with: ${telegramUsername}`);
  logAuth(`API Register request for: ${telegramUsername}`);

  if (!telegramUsername) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();

  try {
    // Check if user already registered
    const existingRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
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
          await bot.telegram.sendMessage(tgId, `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nPlease enter this code on the website.`, { parse_mode: 'Markdown' });
          console.log(`📤 Proactive OTP sent to ${cleanUsername} (${tgId})`);
          logAuth(`Proactive OTP successfully sent to ${cleanUsername} (${tgId})`);
        } catch (botError) {
          console.error('❌ Failed to send proactive OTP:', botError);
          logAuth(`Failed to send proactive OTP to ${cleanUsername}: ${botError.message}`);
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
          Created_At: new Date().toISOString()
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
    console.error('Airtable error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again later.'
    });
  }
});

// Step 2: Verify OTP and Update Tg_ID
app.post('/api/verify', async (req, res) => {
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
    // Find record to update
    console.log(`🔍 Searching Airtable for username: ${cleanUsername}`);
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
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
          username: cleanUsername,
          status: record.fields.Status,
          consentGdpr: record.fields.Consent_GDPR,
          firstName: firstName || record.fields.Name,
          lastName: lastName || record.fields.Family
        }
      });
    } else {
      // Should not happen if Step 1 worked, but handle it
      console.log(`❌ No record found for username: ${cleanUsername}`);
      res.status(404).json({ success: false, message: 'User record not found.' });
    }
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// Step 3: Update GDPR Consent
app.post('/api/consent', async (req, res) => {
  const { username, linkedin, name, family } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();

  try {
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      const fieldsToUpdate = {
        Consent_GDPR: true
      };
      if (linkedin) {
        fieldsToUpdate.Linkedin = linkedin;
      }
      if (name) {
        fieldsToUpdate.Name = name;
      }
      if (family) {
        fieldsToUpdate.Family = family;
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: fieldsToUpdate
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

// Step 3.5: Get Countries
app.get('/api/countries', async (req, res) => {
  try {
    const records = await base(process.env.AIRTABLE_COUNTRIES_TABLE || 'Countries')
      .select({
        view: 'Grid view' // Optional: specify view if needed
      })
      .all();

    const countries = records.map(record => {
      const isoCode = record.fields.ISO_Code;
      // Generate flag emoji from ISO code
      const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';

      return {
        id: record.id,
        name: record.fields.Name_en,
        flag: flag,
        iso: isoCode
      };
    });

    res.json({ success: true, countries });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch countries' });
  }
});

// Step 3.6: Get Cities
app.get('/api/cities', async (req, res) => {
  const { countryIso } = req.query;
  try {
    const filterFormula = countryIso
      ? `AND({Approved} = 1, {country_iso} = '${countryIso}')`
      : `{Approved} = 1`;

    const records = await base(process.env.AIRTABLE_CITIES_TABLE || 'Cities')
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: "name_en", direction: "asc" }]
      })
      .all();

    const cities = records.map(record => ({
      id: record.id,
      name: record.fields.name_en,
      slug: record.fields.Slug
    }));

    res.json({ success: true, cities });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
});

// Add a new city
app.post('/api/cities', async (req, res) => {
  const { name, countryIso } = req.body;
  console.log('Adding city:', { name, countryIso });

  if (!name || !countryIso) {
    return res.status(400).json({ success: false, message: 'Name and Country ISO are required' });
  }

  try {
    const slug = name.toLowerCase().trim().replace(/[\s\W-]+/g, '-');

    const createdRecord = await base(process.env.AIRTABLE_CITIES_TABLE).create([
      {
        "fields": {
          "name_en": name,
          "country_iso": countryIso,
          "Slug": slug,
          "Approved": false
        }
      }
    ], { typecast: true });

    const newCity = {
      id: createdRecord[0].id,
      name: createdRecord[0].fields.name_en,
      slug: createdRecord[0].fields.Slug
    };

    res.json({ success: true, city: newCity });
  } catch (error) {
    console.error('Error adding city:', error);
    res.status(500).json({ success: false, message: 'Failed to add city: ' + error.message });
  }
});
// NEW: Admin Dashboard Data Endpoint
app.get('/api/admin/data', async (req, res) => {
  const { requester } = req.query;

  if (!requester) {
    return res.status(400).json({ success: false, message: 'Requester is required' });
  }

  const cleanRequester = requester.replace('@', '').trim().toLowerCase();

  try {
    // 1. Verify Admin Status
    const requesterRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanRequester}'`,
        maxRecords: 1
      })
      .firstPage();

    const isRequesterAdmin = requesterRecord.length > 0 && requesterRecord[0].fields.Status === 'Admin';

    if (!isRequesterAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    // 2. Fetch Users with Consent_GDPR
    const usersRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: '{Consent_GDPR}',
        sort: [{ field: 'Created_At', direction: 'desc' }]
      })
      .all();

    const users = usersRecords.map(r => ({
      id: r.id,
      name: r.fields.Name,
      family: r.fields.Family,
      username: r.fields.Tg_Username
    }));

    // 3. Fetch Recent Matches (Last 50)
    // Instead of strict "current week" filtering which is timezone-fragile, we fetch the latest matches.
    // The frontend can display the 'Week_Start' to clarify which week it is.
    const matchesRecords = await base('tblx2OEN5sSR1xFI2')
      .select({
        sort: [{ field: 'Week_Start', direction: 'desc' }],
        maxRecords: 50
      })
      .all();

    const matches = await Promise.all(matchesRecords.map(async (m) => {
      const m1Id = m.fields.Member1 ? m.fields.Member1[0] : null;
      const m2Id = m.fields.Member2 ? m.fields.Member2[0] : null;

      const findUser = (id) => usersRecords.find(u => u.id === id);
      const u1 = findUser(m1Id);
      const u2 = findUser(m2Id);

      return {
        id: m.id,
        member1: {
          name: u1 ? u1.fields.Name : 'Unknown',
          username: u1 ? u1.fields.Tg_Username : ''
        },
        member2: {
          name: u2 ? u2.fields.Name : 'Unknown',
          username: u2 ? u2.fields.Tg_Username : ''
        },
        status: m.fields.Status
      };
    }));

    res.json({ success: true, users, matches });

  } catch (error) {
    console.error('Admin data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin data' });
  }
});

// Admin Health Endpoints

// Helper to check Admin
const checkAdmin = async (req, res, next) => {
  const requester = req.headers['x-admin-user'] || req.query.requester;
  if (!requester) return res.status(403).json({ success: false, message: 'No admin user specified' });
  
  const cleanRequester = requester.replace('@', '').trim().toLowerCase();
  
  try {
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${cleanRequester}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length > 0 && records[0].fields.Status === 'Admin') {
      req.adminUser = cleanRequester;
      next();
    } else {
      res.status(403).json({ success: false, message: 'Not an admin' });
    }
  } catch (e) {
    console.error('Admin check error:', e);
    res.status(500).json({ success: false, message: 'Auth error' });
  }
};

// Bot Health Check
app.post('/api/admin/bot/test', checkAdmin, async (req, res) => {
  try {
    const me = await bot.telegram.getMe();
    
    // Optional: Send a test message to the admin if chat ID is available
    if (process.env.ADMIN_CHAT_ID) {
      await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, `🤖 Bot Health Check: Online as @${me.username}`);
    }

    res.json({ 
      success: true, 
      bot: {
        id: me.id,
        username: me.username,
        firstName: me.first_name
      },
      message: 'Bot is online and responding.' 
    });
  } catch (error) {
    console.error('Bot Health Check Failed:', error);
    res.status(500).json({ success: false, message: `Bot check failed: ${error.message}` });
  }
});

// Logs
app.get('/api/admin/logs', checkAdmin, (req, res) => {
  const logsDir = path.join(__dirname, 'logs');
  const files = [];

  // Root logs
  if (fs.existsSync(debugLogFile)) files.push({ name: 'debug.log', path: 'logs/debug.log', size: fs.statSync(debugLogFile).size });
  if (fs.existsSync(authLogFile)) files.push({ name: 'auth.log', path: 'logs/auth.log', size: fs.statSync(authLogFile).size });

  // Recursive or just simplified logs dir? The structure is backend/logs/auth.log and backend/debug.log.
  // Actually authLogFile is defined as path.join(__dirname, 'logs/auth.log').
  
  res.json({ success: true, files });
});

app.get('/api/admin/logs/view', checkAdmin, (req, res) => {
  const { file } = req.query; // 'debug.log' or 'logs/auth.log'

  if (!file) return res.status(400).json({ message: 'File required' });

  // Basic security: prevent directory traversal
  if (file.includes('..')) return res.status(400).json({ message: 'Invalid file path' });

  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    // Read last 1000 lines? Or just read file (careful with size)
    // Let's us 'tail' via child_process for efficiency on large files or just read last N bytes.
    // For simplicity, read whole file but limit size? Or use stream?
    // User asked "see logs", typically tail.
    
    // Simple implementation: read file, take last 2000 lines.
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ message: 'Read error' });
      const lines = data.split('\n');
      const tail = lines.slice(-2000).join('\n');
      res.json({ success: true, content: tail });
    });
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Backups
app.get('/api/admin/backups', checkAdmin, (req, res) => {
  // Use the same logic as initialization
  const dir = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
  console.log(`📂 Listing backups from: ${dir}`);
  
  if (fs.existsSync(dir)) {
    try {
      let fileList = [];
      console.log('✅ Directory exists.');

      // Helper to process a directory
      const processDir = (baseDir, relativePath = '') => {
        const fullPath = path.join(baseDir, relativePath);
        console.log(`🔎 Scanning: ${fullPath}`);

        if (fs.existsSync(fullPath)) {
          const items = fs.readdirSync(fullPath);
          console.log(`📄 Found ${items.length} items in ${relativePath || 'root'}:`, items);

          items.forEach(f => {
            const itemPath = path.join(fullPath, f);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              // Only recurse into 'daily' for now to match script logic
              if (f === 'daily') {
                processDir(baseDir, path.join(relativePath, f));
              }
            } else {
              fileList.push({
                name: path.join(relativePath, f), // e.g. "daily/backup.json.gz"
                size: stats.size,
                created: stats.birthtime,
                mtime: stats.mtime
              });
            }
          });
        } else {
            console.log(`❌ Path does not exist: ${fullPath}`);
        }
      };

      processDir(dir);

      console.log(`🏁 Total files found: ${fileList.length}`);
      const files = fileList.sort((a,b) => b.mtime - a.mtime); // Newest first
      res.json({ success: true, files });
    } catch (e) {
      console.error('Backup listing error:', e);
      res.status(500).json({ success: false, message: 'Failed to list backups' });
    }
  } else {
    console.log(`❌ Backup directory not found: ${dir}`);
    res.json({ success: true, files: [], message: 'Backup directory not found' });
  }
});


// Scheduler
app.get('/api/admin/scheduler', checkAdmin, (req, res) => {
  res.json({ success: true, jobs: scheduler.getJobs() });
});

app.post('/api/admin/scheduler', checkAdmin, (req, res) => {
  const { action, job } = req.body; // action: add, update, delete, start-now
  
  try {
    if (action === 'add') {
      scheduler.addJob(job);
    } else if (action === 'update') {
      scheduler.updateJob(job.name, job); // Assuming name is key
    } else if (action === 'delete') {
      scheduler.deleteJob(job.name);
    }
    res.json({ success: true, jobs: scheduler.getJobs() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/admin/scheduler/run', checkAdmin, (req, res) => {
  const { name } = req.body;
  if (scheduler.runJobNow(name)) {
    res.json({ success: true, message: 'Job started' });
  } else {
    res.status(404).json({ success: false, message: 'Job not found' });
  }
});

// Available scripts
app.get('/api/admin/scripts', checkAdmin, (req, res) => {
  const scriptsDir = path.join(__dirname, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    res.json({ success: true, scripts: files });
  } else {
    res.json({ success: true, scripts: [] });
  }
});


// Step 3.5: Get Interests
app.get('/api/interests', (req, res) => {
  try {
    const interestsPath = path.join(__dirname, 'interests.json');
    if (fs.existsSync(interestsPath)) {
      const interests = JSON.parse(fs.readFileSync(interestsPath, 'utf8'));
      res.json({ success: true, interests });
    } else {
      res.status(404).json({ success: false, message: 'Interests file not found' });
    }
  } catch (error) {
    console.error('Error reading interests:', error);
    res.status(500).json({ success: false, message: 'Failed to read interests' });
  }
});

// Tokenized Profile View - No Auth Required
app.get('/api/view/:token', async (req, res) => {
  const { token } = req.params;
  
  if (!token || token.length !== 32) {
    return res.status(404).json({ success: false, message: 'Invalid token' });
  }

  try {
    // Find match by View_Token_1 or View_Token_2
    const matchRecords = await base('tblx2OEN5sSR1xFI2').select({
      filterByFormula: `OR({View_Token_1} = '${token}', {View_Token_2} = '${token}')`,
      maxRecords: 1
    }).firstPage();

    if (matchRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    const match = matchRecords[0];
    const weekStart = new Date(match.fields.Week_Start);
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Check if match is older than 2 weeks
    if (weekStart < twoWeeksAgo) {
      return res.status(404).json({ success: false, message: 'Token expired' });
    }

    // Determine which profile to show based on which token was used
    const isToken1 = match.fields.View_Token_1 === token;
    // Token1 is for Member1 to view Member2, Token2 is for Member2 to view Member1
    const partnerField = isToken1 ? 'Member2' : 'Member1';
    const partnerLink = match.fields[partnerField];

    if (!partnerLink || partnerLink.length === 0) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // Fetch partner profile
    const partnerRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(partnerLink[0]);
    const p = partnerRecord.fields;

    // Fetch country/city if linked
    let country = null;
    let city = null;

    if (p.Country && p.Country.length > 0) {
      try {
        const countryRecord = await base('tblcBPZqf3wFEXGwq').find(p.Country[0]);
        const isoCode = countryRecord.fields.ISO_Code;
        const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';
        country = { name: countryRecord.fields.Name_en, flag, iso: isoCode };
      } catch (e) { /* ignore */ }
    }

    if (p.City && p.City.length > 0) {
      try {
        const cityRecord = await base('tblHpJu6sDjk99Wpt').find(p.City[0]);
        city = { name: cityRecord.fields.name_en };
      } catch (e) { /* ignore */ }
    }

    // Get intro for the viewer
    const introField = isToken1 ? 'Intro_1' : 'Intro_2';
    let intro = null;
    if (match.fields[introField]) {
      try {
        intro = JSON.parse(match.fields[introField]);
      } catch (e) { /* ignore */ }
    }

    const profile = {
      name: p.Name,
      family: p.Family,
      avatar: p.Avatar && p.Avatar.length > 0 ? p.Avatar[0].url : null,
      profession: p.Profession,
      grade: p.Grade,
      country,
      city,
      timezone: p.Timezone,
      professionalDesc: p.Professional_Description,
      personalDesc: p.Personal_Description,
      professionalInterests: p.Professional_Interests,
      personalInterests: p.Personal_Interests,
      coffeeGoals: p.Coffee_Goals,
      languages: p.Languages,
      bestMeetingDays: p.Best_Meeting_Days,
      linkedin: p.LinkedIn,
      tg_username: p.Tg_Username
    };

    res.json({ success: true, profile, intro });

  } catch (error) {
    console.error('View Token API Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Step 4: Get User Profile
// Step 4: Get User Profile
app.get('/api/profile', async (req, res) => {
  const { username, requester } = req.query;
  const requestId = Date.now();
  console.time(`Profile_Req_${requestId}`);
  
  if (!username || !requester) {
    return res.status(400).json({ success: false, message: 'Username and requester are required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();
  const cleanRequester = requester.replace('@', '').trim().toLowerCase();

  logDebug(`GET /api/profile request for ${cleanUsername} by ${cleanRequester}`);

  try {
    // --- PHASE 1: Fetch Core Data in Parallel ---
    console.time(`Phase1_Core_${requestId}`);
    
    // 1. Fetch Target User
    const pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({ filterByFormula: `{Tg_Username} = '${cleanUsername}'`, maxRecords: 1 })
      .firstPage();

    // 2. Fetch Requester (if different, for Admin check)
    let pRequesterUser = Promise.resolve([]);
    if (cleanUsername !== cleanRequester) {
      pRequesterUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Tg_Username} = '${cleanRequester}'`, maxRecords: 1 })
        .firstPage();
    }

    // 3. Fetch Access Validation Match (if not self view)
    // to check if requester and target are matched
    let pAccessMatch = Promise.resolve([]);
    if (cleanUsername !== cleanRequester) {
       pAccessMatch = base('tblx2OEN5sSR1xFI2').select({
          filterByFormula: `OR(
              AND(FIND('${cleanRequester}', ARRAYJOIN({Tg_Username (from Member1)})), FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member2)}))),
              AND(FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member1)})), FIND('${cleanRequester}', ARRAYJOIN({Tg_Username (from Member2)})))
          )`,
          maxRecords: 1
       }).firstPage();
    }

    // 4. Fetch Latest Match for Target User (to display "Current Match")
    // Note: We need this to get the partner's details later
    const pLatestMatch = base('tblx2OEN5sSR1xFI2').select({
        filterByFormula: `OR({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanUsername}')`,
        sort: [{ field: 'Week_Start', direction: 'desc' }],
        maxRecords: 1
    }).firstPage();

    const [targetUserRecords, requesterRecords, accessMatchRecords, latestMatchRecords] = 
      await Promise.all([pTargetUser, pRequesterUser, pAccessMatch, pLatestMatch]);
    
    console.timeEnd(`Phase1_Core_${requestId}`);

    // --- PHASE 2: Validation & Core Data Extraction ---
    
    // User Existence Check
    if (targetUserRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const targetRecord = targetUserRecords[0];
    const fields = targetRecord.fields;

    // Access Control Validation
    if (cleanUsername !== cleanRequester) {
      const isRequesterAdmin = requesterRecords.length > 0 && requesterRecords[0].fields.Status === 'Admin';
      const isMatched = accessMatchRecords.length > 0;

      if (!isRequesterAdmin && !isMatched) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. You can only view profiles of your matches.', 
          error_code: 'access_denied_match_only' 
        });
      }
    }

    // --- PHASE 3: Fetch Enrichment Data in Parallel ---
    console.time(`Phase3_Enrich_${requestId}`);
    
    const enrichmentPromises = [];
    
    // 1. Country
    if (fields.Countries && fields.Countries.length > 0) {
      enrichmentPromises.push(
        base(process.env.AIRTABLE_COUNTRIES_TABLE || 'Countries').find(fields.Countries[0])
          .then(r => ({ type: 'country', data: r }))
          .catch(e => ({ type: 'country', error: e }))
      );
    }

    // 2. City
    if (fields.City_Link && fields.City_Link.length > 0) {
      enrichmentPromises.push(
        base(process.env.AIRTABLE_CITIES_TABLE || 'Cities').find(fields.City_Link[0])
          .then(r => ({ type: 'city', data: r }))
          .catch(e => ({ type: 'city', error: e }))
      );
    }

    // 3. Current Match Partner
    let matchDataRaw = null;
    if (latestMatchRecords.length > 0) {
      const match = latestMatchRecords[0];
      
      // Calculate start of current week (Monday)
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day == 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const currentWeekStart = monday.toISOString().split('T')[0];

      // Only show if the match is for the current week
      if (match.fields.Week_Start === currentWeekStart) {
        matchDataRaw = match;

        // Identify partner ID to fetch
        const member1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : '';
        const isMember1 = member1Username === cleanUsername;
        const otherMemberPrefix = isMember1 ? 'Member2' : 'Member1';
        const otherMemberLink = match.fields[otherMemberPrefix];
        
        // Extract Intro for the current user
        let introRaw = isMember1 ? match.fields.Intro_1 : match.fields.Intro_2;
        let intro = null;
        if (introRaw) {
            try {
                intro = JSON.parse(introRaw);
            } catch (e) {
                console.error('Failed to parse current match intro:', e);
            }
        }

        if (otherMemberLink && otherMemberLink.length > 0) {
          enrichmentPromises.push(
            base(process.env.AIRTABLE_MEMBERS_TABLE).find(otherMemberLink[0])
              .then(r => ({ type: 'partner', data: r, intro: intro }))
              .catch(e => ({ type: 'partner', error: e }))
          );
        }
      }
    }

    const enrichmentResults = await Promise.all(enrichmentPromises);
    console.timeEnd(`Phase3_Enrich_${requestId}`);

    // Process Enrichment Results
    let country = null;
    let city = null;
    let currentMatch = null;
    
    // Prepare Match Intro for the Public Profile View (Requester viewing User)
    let publicMatchIntro = null;
    if (cleanUsername !== cleanRequester && accessMatchRecords.length > 0) {
        const accessMatch = accessMatchRecords[0];
        // Who is the requester in this match?
        const m1Username = accessMatch.fields['Tg_Username (from Member1)'] ? accessMatch.fields['Tg_Username (from Member1)'][0] : '';
        // Note: accessMatch filter ensures one of them is requester and the other is target.
        const requesterIsMember1 = m1Username === cleanRequester;
        const introString = requesterIsMember1 ? accessMatch.fields.Intro_1 : accessMatch.fields.Intro_2;
        
        if (introString) {
            try {
                publicMatchIntro = JSON.parse(introString);
            } catch (e) {
                console.error('Failed to parse public match intro:', e);
            }
        }
    }

    enrichmentResults.forEach(res => {
      if (res.error) {
        console.error(`Error fetching ${res.type}:`, res.error);
        return;
      }
      if (res.type === 'country') {
        const r = res.data;
        const isoCode = r.fields.ISO_Code;
        const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';
        country = { id: r.id, name: r.fields.Name_en, flag, iso: isoCode };
      }
      if (res.type === 'city') {
        const r = res.data;
        city = { id: r.id, name: r.fields.name_en };
      }
      if (res.type === 'partner') {
        const r = res.data;
        currentMatch = {
          name: r.fields.Name,
          family: r.fields.Family,
          username: r.fields.Tg_Username,
          avatar: r.fields.Avatar && r.fields.Avatar.length > 0 ? r.fields.Avatar[0].url : '',
          intro: res.intro // Attach the intro we parsed earlier
        };
      }
    });

    // Construct Response
    const profile = {
        name: fields.Name || '',
        family: fields.Family || '',
        country: country,
        city: city,
        timezone: fields.Time_Zone || 'UTC (UTC+0)',
        profession: fields.Profession || '',
        grade: fields.Grade || 'Prefer not to say',
        professionalDesc: fields.Professional_Description || '',
        personalDesc: fields.Personal_Description || '',
        professionalInterests: fields.Professional_Interests || [],
        otherProfessionalInterests: fields.Other_Professional_Interests || '',
        personalInterests: fields.Personal_Interests || [],
        otherPersonalInterests: fields.Other_Personal_Interests || '',
        coffeeGoals: fields.Coffee_Goals || [],
        linkedin: fields.Linkedin || '',
        languages: fields.Languages || [],
        bestMeetingDays: fields.Best_Meetings_Days || [],
        serendipity: fields.Serendipity || 5,
        proximity: fields.Proximity || 5,
        nextWeekStatus: fields.Next_Week_Status || 'Active',
        avatar: fields.Avatar && fields.Avatar.length > 0 ? fields.Avatar[0].url : '',
        tg_username: fields.Tg_Username || ''
    };
    
    console.timeEnd(`Profile_Req_${requestId}`);
    res.json({ success: true, profile, currentMatch, matchIntro: publicMatchIntro });

  } catch (error) {
    console.error('Profile API Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Step 5: Update User Profile
app.put('/api/profile', async (req, res) => {
  const { username, profile } = req.body;
  logDebug(`PUT /api/profile request for ${username}. Data: Name=${profile?.name}, Family=${profile?.family}`);

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();

  try {
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];

      // Prepare fields for Airtable
      const updateFields = {
        Name: profile.name,
        Family: profile.family,
        Time_Zone: profile.timezone,
        Profession: profile.profession,
        Grade: profile.grade,
        Professional_Description: profile.professionalDesc,
        Personal_Description: profile.personalDesc,
        Coffee_Goals: profile.coffeeGoals,
        Linkedin: profile.linkedin,
        Languages: profile.languages,
        Best_Meetings_Days: profile.bestMeetingDays,
        Serendipity: profile.serendipity,
        Proximity: profile.proximity,
        Next_Week_Status: profile.nextWeekStatus,
        Professional_Interests: profile.professionalInterests,
        Other_Professional_Interests: profile.otherProfessionalInterests,
        Personal_Interests: profile.personalInterests,
        Other_Personal_Interests: profile.otherPersonalInterests
      };

      // Handle Country Linking
      if (profile.country && profile.country.id) {
        updateFields.Countries = [profile.country.id];
      }

      // Handle City Linking
      if (profile.city && profile.city.id) {
        updateFields.City_Link = [profile.city.id];
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: updateFields
        }
      ], { typecast: true }); // Enable typecast to allow creating new options for selects

      res.json({ success: true, message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.error && error.error === 'INVALID_VALUE_FOR_COLUMN') {
      console.error('Invalid value details:', error.message);
    }
    res.status(500).json({ success: false, message: 'Failed to update profile: ' + error.message });
  }
});

// Step 6: Upload Avatar
app.post('/api/upload-avatar', upload.single('avatar'), async (req, res) => {
  const { username } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();

  // Construct the public URL
  // Force HTTPS in production to ensure Airtable can fetch it without redirects
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.headers['x-forwarded-proto'] || req.protocol);
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  console.log(`📤 Avatar uploaded for ${cleanUsername}: ${fileUrl}`);

  try {
    // Verify user exists
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      // Update Airtable with the new avatar URL
      // This works now because the server is deployed and the URL is public!
      try {
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: records[0].id,
            fields: {
              Avatar: [
                { url: fileUrl }
              ]
            }
          }
        ]);
        console.log('✅ Airtable updated with new avatar URL');
      } catch (airtableError) {
        console.error('Failed to update Airtable (non-fatal):', airtableError);
        // We continue even if Airtable update fails, so the user sees their upload
      }

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: fileUrl
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload avatar' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Handle Multer Errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File is too large. Max size is 5MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  // Handle other errors
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
});

