const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const Scheduler = require('./scheduler');
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const { spawn } = require('child_process');

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

// Load Project Config (Robust Path Handing)
let projectConfig = {};
try {
  projectConfig = require('../linking-coffee.config.js'); // Local dev path
} catch (e) {
  try {
    projectConfig = require('./linking-coffee.config.js'); // Docker path
  } catch (e2) {
    console.warn("⚠️ Could not load linking-coffee.config.js in server.js");
  }
}
const debugLogFile = path.join(logDir, 'debug.log');
const authLogFile = path.join(logDir, 'auth.log');
const connectionsLogFile = path.join(logDir, 'connections.log');

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
  const now = new Date().toISOString();
  fs.appendFileSync(authLogFile, `[${now}] Server Initialized\n`);
  fs.appendFileSync(connectionsLogFile, `[${now}] Log Initialized\n`);
  console.log('✅ Log files writable');
} catch (e) {
  console.error('❌ Failed to write to log files:', e);
}

function logDebug(msg) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(debugLogFile, `[${time}] ${msg}\n`);
  } catch (e) {
    console.error('Logging error:', e);
  }
}

function logAuth(msg, type = 'INFO') {
  const time = new Date().toISOString();
  // Standard format: [AUTH] TYPE: Message
  const formattedMsg = `[AUTH] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(authLogFile, `[${time}] ${formattedMsg}\n`);
    console.log(`${formattedMsg}`);
  } catch (e) {
    console.error('Auth Logging error:', e);
  }
}

function logConnection(msg, type = 'INFO') {
  const time = new Date().toISOString();
  // Standard format: [CONN] TYPE: Message
  const formattedMsg = `[CONN] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(connectionsLogFile, `[${time}] ${formattedMsg}\n`);
    // Also mirror to auth log for historical completeness
    logAuth(msg, type);
  } catch (e) {
    console.error('Connection Logging error:', e);
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

// Security Headers for Google OAuth
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Configure Airtable
console.log('🔹 Airtable Configuration:');
console.log('   Base ID:', process.env.AIRTABLE_BASE_ID);
console.log('   Members Table:', process.env.AIRTABLE_MEMBERS_TABLE);
console.log('   Cities Table:', process.env.AIRTABLE_CITIES_TABLE);

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Configure Google OAuth
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
const scheduler = new Scheduler(
  path.join(__dirname, 'scheduler.json'),        // default (from Git)
  path.join(__dirname, 'config/scheduler.json')  // runtime (persistent)
);
scheduler.init();


// Initialize Telegram Bot
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : process.env.ADMIN_BOT_TOKEN;
console.log(`🤖 Initializing Bot in ${process.env.NODE_ENV} mode`);
console.log(`🔑 Using Bot Token starting with: ${botToken ? botToken.substring(0, 5) + '...' : 'UNDEFINED'}`);
const bot = new Telegraf(botToken);

// Shared handler for /start and /connect commands
const handleConnect = (ctx) => {
  const username = ctx.from.username;
  logAuth(`Bot connect received from: ${username} (ID: ${ctx.from.id})`);

  if (!username) {
    return ctx.reply('Please set a username in your Telegram settings to use this bot.');
  }

  const cleanUsername = username.toLowerCase();
  console.log(`🤖 Bot received connect from: ${username} (clean: ${cleanUsername})`);

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
};

// Register both /start and /connect commands
bot.start(handleConnect);
bot.command('connect', handleConnect);

// Localized participation messages
const PARTICIPATION_MESSAGES = {
  En: {
    yes_response: "Awesome 🎉\nOn Monday you'll get your new match!\n💜",
    no_response: "Got it 👍\nNo matches this week.\nRecharge your social battery 🪫↗️🔋\n\nI'll come back to you next weekend\n😉"
  },
  Ru: {
    yes_response: "Отлично 🎉\nВ понедельник ты получишь нового собеседника!\n💜",
    no_response: "Принято 👍\nНа этой неделе без встреч.\nЗаряжай социальную батарейку 🪫↗️🔋\n\nВернусь к тебе в следующие выходные\n😉"
  }
};

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
      const lang = (record.fields.Notifications_Language === 'Ru') ? 'Ru' : 'En';
      const t = PARTICIPATION_MESSAGES[lang];

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

      await ctx.answerCbQuery(lang === 'Ru' ? 'Вы участвуете!' : 'You are in!');
      await ctx.editMessageText(t.yes_response);
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
      const lang = (record.fields.Notifications_Language === 'Ru') ? 'Ru' : 'En';
      const t = PARTICIPATION_MESSAGES[lang];

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

      await ctx.answerCbQuery(lang === 'Ru' ? 'Пропущено.' : 'Skipped.');
      await ctx.editMessageText(t.no_response);

    } else {
      await ctx.answerCbQuery('User not found.');
      // Should we remove the message or something if user not found? 
      // Current logic just doesn't reply. 
    }

  } catch (error) {
    console.error('Error handling participate_no:', error);
  }
});

// Localized feedback messages
const FEEDBACK_MESSAGES = {
  En: {
    thankYou: "Thank you! 🙏",
    ratingPrompt: "❤️ Wow! Awesome! ❤️\nSo how was your Linked Coffee experience?\nDid it go well?",
    btn_awful: '😡 awful',
    btn_boring: '😐 boring',
    btn_ok: '🙂 ok',
    btn_wonderful: '😃 wonderful'
  },
  Ru: {
    thankYou: "Спасибо! 🙏",
    ratingPrompt: "❤️ Вау! Потрясающе! ❤️\nНу как прошла твоя встреча Linked Coffee?\nВсё хорошо?",
    btn_awful: '😡 ужасно',
    btn_boring: '😐 скучно',
    btn_ok: '🙂 норм',
    btn_wonderful: '😃 чудесно'
  }
};

// Handle Midweek Feedback Status
// Callback format: fb_stat:matchId:role:status or fb_stat:matchId:role:status:lang
bot.action(/^fb_stat:(.+):(\d+):([^:]+)(?::([A-Za-z]{2}))?$/, async (ctx) => {
  const matchId = ctx.match[1];
  const role = parseInt(ctx.match[2]);
  const status = ctx.match[3];
  const language = ctx.match[4] || 'En'; // Default to English if no language specified

  console.log(`🤖 Received fb_stat: Match=${matchId}, Role=${role}, Status=${status}, Lang=${language}`);
  const fieldName = role === 1 ? 'We_Met_1' : 'We_Met_2';
  const t = FEEDBACK_MESSAGES[language] || FEEDBACK_MESSAGES.En;

  try {
    await base('tblx2OEN5sSR1xFI2').update([{
      id: matchId,
      fields: {
        [fieldName]: status
      }
    }], { typecast: true });

    await ctx.answerCbQuery('Status updated!');

    // Append localized "Thank you!" to the original message
    const originalText = ctx.callbackQuery.message.text;
    await ctx.editMessageText(originalText + "\n\n" + t.thankYou);

    // If 'Met', send follow-up rating message in the same language
    if (status === 'Met') {
      const ratingKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(t.btn_awful, `fb_rate:${matchId}:${role}:1:${language}`),
          Markup.button.callback(t.btn_boring, `fb_rate:${matchId}:${role}:2:${language}`)
        ],
        [
          Markup.button.callback(t.btn_ok, `fb_rate:${matchId}:${role}:3:${language}`),
          Markup.button.callback(t.btn_wonderful, `fb_rate:${matchId}:${role}:4:${language}`)
        ]
      ]);
      await ctx.reply(t.ratingPrompt, ratingKeyboard);
    }

  } catch (error) {
    console.error('Error handling fb_stat:', error);
    await ctx.answerCbQuery('Error updating status.');
  }
});

// Handle Midweek Feedback Rating
// Callback format: fb_rate:matchId:role:rating or fb_rate:matchId:role:rating:lang
bot.action(/^fb_rate:(.+):(\d+):(\d+)(?::([A-Za-z]{2}))?$/, async (ctx) => {
  const matchId = ctx.match[1];
  const role = parseInt(ctx.match[2]);
  const rating = parseInt(ctx.match[3]);
  const language = ctx.match[4] || 'En';

  console.log(`🤖 Received fb_rate: Match=${matchId}, Role=${role}, Rating=${rating}, Lang=${language}`);
  const fieldName = role === 1 ? 'Feedback1' : 'Feedback2';
  const t = FEEDBACK_MESSAGES[language] || FEEDBACK_MESSAGES.En;

  try {
    await base('tblx2OEN5sSR1xFI2').update([{
      id: matchId,
      fields: {
        [fieldName]: rating
      }
    }]);

    await ctx.answerCbQuery('Feedback received!');

    const originalText = ctx.callbackQuery.message.text;
    await ctx.editMessageText(originalText + "\n\n" + t.thankYou);

  } catch (error) {
    console.error('Error handling fb_rate:', error);
    await ctx.answerCbQuery('Error saving feedback.');
  }
});

// Register bot menu commands
bot.telegram.setMyCommands([
  { command: 'start', description: '🚀 Start the bot' },
  { command: 'connect', description: '☕ Connect to Linked.Coffee' }
]).then(() => {
  console.log('📋 Bot menu commands registered');
}).catch(err => {
  console.error('Failed to set bot commands:', err);
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
  logConnection(`Telegram OTP request for @${telegramUsername || 'UNKNOWN'}`, 'ATTEMPT');

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
      const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1
      }).firstPage();
      if (emailRecords.length > 0) record = emailRecords[0];
    }

    // 3. Try finding by Username
    if (!record && username) {
      const cleanUsername = username.replace('@', '').trim().toLowerCase();
      const usernameRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
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

      let communityId = null;
      let communityName = null;

      console.log('--- START CONSENT UPDATE ---');
      const identifier = username ? username : (email ? email : id);
      console.log(`User Identifier: ${identifier}, CommunityCode: ${req.body.communityCode}`);
      console.log(`Base ID: ${process.env.AIRTABLE_BASE_ID}`);

      // Validate Community Code first
      if (req.body.communityCode) {
        const code = req.body.communityCode.trim();
        console.log(`Checking community code: ${code}`);

        const commRecords = await base('tblSMXQlCTpl7BZED').select({
          filterByFormula: `{Invite_Code} = '${code}'`,
          maxRecords: 1
        }).firstPage();

        if (commRecords.length === 0) {
          return res.status(400).json({ success: false, message: 'Invalid community code' });
        }

        const comm = commRecords[0];
        if (comm.fields.Status !== 'Active') {
          return res.status(400).json({ success: false, message: 'Community is not active' });
        }

        // Valid community
        communityId = comm.id;
        communityName = comm.fields.Name;
        updates.Primary_Community = [communityId];
        updates.Is_Global_Pool = false;
      }

      // Update Member Record
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: updates
        }
      ]);

      // Create Community Membership if needed
      console.log(`Checking communityId for creation: ${communityId}`);
      if (communityId) {
        try {
          console.log('Attempting to create Community_Members record...');
          console.log('Target Table:', 'tblPN0ni3zaaTCPcF');

          const payload = {
            'Member': [record.id],
            'Community': [communityId],
            'Role': 'Member',
            'Status': 'Active',
            'Joined_At': new Date().toISOString().split('T')[0]
          };
          console.log('Payload being sent:', JSON.stringify(payload, null, 2));

          const createdRecords = await base('tblPN0ni3zaaTCPcF').create([{
            fields: payload
          }]);

          if (createdRecords && createdRecords.length > 0) {
            console.log(`✅ SUCCESS! Created record ID: ${createdRecords[0].id}`);
          } else {
            console.error('⚠️ WARNING: Create call returned no records but no error throw?');
          }

          console.log(`✅ Added user to community: ${communityName}`);
        } catch (linkError) {
          console.error('❌ Failed to create community link:', linkError);
          console.error('   Error Details:', JSON.stringify(linkError, null, 2));
          return res.status(500).json({
            success: false,
            message: 'Failed to create community link: ' + linkError.message,
            details: linkError
          });
        }
      }

      res.json({ success: true, message: 'Consent updated' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Consent update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update consent' });
  }
});

// Google OAuth Authentication
app.post('/api/auth/google', async (req, res) => {
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

// LinkedIn Auth URL
app.get('/api/auth/linkedin/url', (req, res) => {
  const scope = 'openid profile email';
  const state = Math.random().toString(36).substring(7);
  // Default to env or prod, but allow override from query for localhost dev
  const redirectUri = req.query.redirectUri || process.env.LINKEDIN_REDIRECT_URI || 'https://linked.coffee/auth/linkedin/callback';

  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

  res.json({ url });
});

// LinkedIn Auth Callback
app.post('/api/auth/linkedin', async (req, res) => {
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
        // Create New
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
        email: email,
        status: record.fields.Status,
        consentGdpr: record.fields.Consent_GDPR,
        firstName: record.fields.Name || given_name,
        lastName: record.fields.Family || family_name,
        telegramConnected: telegramConnected,
        tgId: record.fields.Tg_ID,
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

// Unlink LinkedIn Account
app.post('/api/unlink-linkedin-account', async (req, res) => {
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
app.post('/api/link-google-account', async (req, res) => {
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
app.post('/api/unlink-google-account', async (req, res) => {
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

// Connect Telegram to (Gmail) Account
// Handles Linking AND Merging
app.post('/api/connect-telegram', async (req, res) => {
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
      // Preserve Avatar if Target missing
      if ((!targetRecord.fields.Avatar || targetRecord.fields.Avatar.length === 0) && sourceRecord.fields.Avatar) {
        updates.Avatar = sourceRecord.fields.Avatar;
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

// Disconnect Telegram from account
app.post('/api/disconnect-telegram', async (req, res) => {
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

    // 3. Fetch Recent Matches (Last 500)
    // Instead of strict "current week" filtering which is timezone-fragile, we fetch the latest matches.
    // The frontend can display the 'Week_Start' to clarify which week it is.
    const matchesRecords = await base('tblx2OEN5sSR1xFI2')
      .select({
        sort: [{ field: 'Week_Start', direction: 'desc' }],
        maxRecords: 500
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
        weekStart: m.fields.Week_Start,
        introImage: m.fields.Intro_Image && m.fields.Intro_Image.length > 0 ? m.fields.Intro_Image[0].url : null,
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
  const logDir = path.join(__dirname, 'logs');
  const files = [];

  if (fs.existsSync(logDir)) {
    try {
      const items = fs.readdirSync(logDir);
      items.forEach(f => {
        const filePath = path.join(logDir, f);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          files.push({
            name: f,
            path: `logs/${f}`,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      });

      // Sort by modified time, newest first
      files.sort((a, b) => b.mtime - a.mtime);

    } catch (e) {
      console.error('Error listing log files:', e);
    }
  }

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

// Script Logs Endpoints
app.get('/api/admin/logs/scripts', checkAdmin, async (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'logs', 'scripts');

    if (!fs.existsSync(logsDir)) {
      return res.json({ success: true, logs: [] });
    }

    const files = fs.readdirSync(logsDir);
    const logs = files.map(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      // Count lines efficiently
      let lines = 0;
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        lines = content.split('\n').length;
      } catch (e) {
        lines = 0;
      }

      return {
        script: file,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        lines: lines
      };
    });

    // Sort by last modified, newest first
    logs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error listing script logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/logs/scripts/:scriptName', checkAdmin, async (req, res) => {
  try {
    const { scriptName } = req.params;
    const { offset = 0, limit = 100, search = '' } = req.query;

    // Security: prevent directory traversal
    if (scriptName.includes('..') || scriptName.includes('/')) {
      return res.status(400).json({ success: false, message: 'Invalid script name' });
    }

    const logPath = path.join(__dirname, 'logs', 'scripts', scriptName);

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const content = fs.readFileSync(logPath, 'utf8');
    let lines = content.split('\n').filter(line => line.trim());

    // Apply search filter
    if (search) {
      lines = lines.filter(line => line.includes(search));
    }

    const totalLines = lines.length;
    const maxLimit = Math.min(parseInt(limit), 1000);
    const pageLines = lines.slice(parseInt(offset), parseInt(offset) + maxLimit);

    res.json({
      success: true,
      script: scriptName,
      totalLines,
      offset: parseInt(offset),
      limit: maxLimit,
      lines: pageLines,
      hasMore: parseInt(offset) + pageLines.length < totalLines
    });
  } catch (error) {
    console.error('Error reading script log:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/logs/scripts/:scriptName/tail', checkAdmin, async (req, res) => {
  try {
    const { scriptName } = req.params;
    const { lines = 100 } = req.query;

    // Security: prevent directory traversal
    if (scriptName.includes('..') || scriptName.includes('/')) {
      return res.status(400).json({ success: false, message: 'Invalid script name' });
    }

    const logPath = path.join(__dirname, 'logs', 'scripts', scriptName);

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    const maxLines = Math.min(parseInt(lines), 1000);
    const tailLines = allLines.slice(-maxLines);

    res.json({
      success: true,
      script: scriptName,
      lines: tailLines
    });
  } catch (error) {
    console.error('Error tailing script log:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/logs/scripts/:scriptName/download', checkAdmin, async (req, res) => {
  try {
    const { scriptName } = req.params;

    // Security: prevent directory traversal
    if (scriptName.includes('..') || scriptName.includes('/')) {
      return res.status(400).json({ success: false, message: 'Invalid script name' });
    }

    const logPath = path.join(__dirname, 'logs', 'scripts', scriptName);

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    res.download(logPath, scriptName);
  } catch (error) {
    console.error('Error downloading script log:', error);
    res.status(500).json({ success: false, message: error.message });
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
      const files = fileList.sort((a, b) => b.mtime - a.mtime); // Newest first
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
    // Move date calculation before query to use in filter
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dateFilter = twoWeeksAgo.toISOString().split('T')[0];

    // Find match by View_Token_1 or View_Token_2 AND ensure it's recent
    const matchRecords = await base('tblx2OEN5sSR1xFI2').select({
      filterByFormula: `AND(IS_AFTER({Week_Start}, '${dateFilter}'), OR({View_Token_1} = '${token}', {View_Token_2} = '${token}'))`,
      maxRecords: 1
    }).firstPage();

    if (matchRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found or expired' });
    }

    const match = matchRecords[0];
    const weekStart = new Date(match.fields.Week_Start);

    // Double check if match is older than 2 weeks (redundant but safe)
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
        const countryRecord = await base('tblTDQuqGDEDTPMLO').find(p.Country[0]);
        const isoCode = countryRecord.fields.ISO_Code;
        const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';
        country = { name: countryRecord.fields.Name_en, flag, iso: isoCode };
      } catch (e) { /* ignore */ }
    }

    if (p.City_Link && p.City_Link.length > 0) {
      try {
        const cityRecord = await base('tbllGzaGTz3PsxxWT').find(p.City_Link[0]);
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
      timezone: p.Time_Zone,
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
  const { username, requester, id, email } = req.query;
  const requestId = Date.now();
  console.time(`Profile_Req_${requestId}`);

  // We need at least one identifier
  if (!username && !id && !email) {
    return res.status(400).json({ success: false, message: 'Username, ID, or Email is required' });
  }

  const cleanUsername = username ? username.replace('@', '').trim().toLowerCase() : null;
  const cleanRequester = requester ? requester.replace('@', '').trim().toLowerCase() : null;

  logDebug(`GET /api/profile request for ${cleanUsername || id || email} by ${cleanRequester || 'SELF'}`);

  try {
    // --- PHASE 1: Fetch Core Data in Parallel ---
    console.time(`Phase1_Core_${requestId}`);

    // 1. Fetch Target User
    let pTargetUser;
    if (id) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE).find(id)
        .then(record => [record]) // Wrap in array to match .select() output
        .catch(err => []);
    } else if (cleanUsername) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Tg_Username} = '${cleanUsername}'`, maxRecords: 1 })
        .firstPage();
    } else if (email) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Email} = '${email}'`, maxRecords: 1 })
        .firstPage();
    } else {
      // Should not happen
      pTargetUser = Promise.resolve([]);
    }

    // 2. Fetch Requester (if different and present, for Admin check)
    let pRequesterUser = Promise.resolve([]);
    if (cleanRequester && cleanUsername && cleanUsername !== cleanRequester) {
      pRequesterUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Tg_Username} = '${cleanRequester}'`, maxRecords: 1 })
        .firstPage();
    }

    // 3. Fetch Access Validation Match (if not self view)
    let pAccessMatch = Promise.resolve([]);
    if (cleanRequester && cleanUsername && cleanUsername !== cleanRequester) {
      pAccessMatch = base('tblx2OEN5sSR1xFI2').select({
        filterByFormula: `OR(
              AND({Tg_Username (from Member1)} = '${cleanRequester}', {Tg_Username (from Member2)} = '${cleanUsername}'),
              AND({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanRequester}')
          )`,
        maxRecords: 1
      }).firstPage();
    }

    // 4. Fetch Latest Match (Deferred if no username yet)
    // We only care about matches from current week or older? 
    // Actually we just want the *latest* match.
    const recentDate = '2024-01-01';
    let pLatestMatch = Promise.resolve([]);

    if (cleanUsername) {
      pLatestMatch = base('tblx2OEN5sSR1xFI2').select({
        filterByFormula: `AND(IS_AFTER({Week_Start}, '${recentDate}'), OR({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanUsername}'))`,
        sort: [{ field: 'Week_Start', direction: 'desc' }],
        maxRecords: 1
      }).firstPage();
    }

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
        base('tblTDQuqGDEDTPMLO').find(fields.Countries[0])
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

      // Use local date components to avoid UTC shifts
      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, '0');
      const dd = String(monday.getDate()).padStart(2, '0');
      const currentWeekStart = `${yyyy}-${mm}-${dd}`;

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

    // 4. Active Community
    // Fetch active community membership for this user by Tg_Username
    enrichmentPromises.push(
      base('tblPN0ni3zaaTCPcF').select({
        filterByFormula: `AND(FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member)})), {Status} = 'Active')`,
        maxRecords: 1
      }).firstPage()
        .then(records => {
          if (records.length > 0) {
            const comm = records[0];
            const commName = comm.fields['Name (from Community)'] ? comm.fields['Name (from Community)'][0] : null;
            return { type: 'community', name: commName };
          }
          return { type: 'community', name: null };
        })
        .catch(e => {
          console.error(`❌ Community query error:`, e);
          return { type: 'community', error: e };
        })
    );

    const enrichmentResults = await Promise.all(enrichmentPromises);
    console.timeEnd(`Phase3_Enrich_${requestId}`);

    // Process Enrichment Results
    let country = null;
    let city = null;
    let currentMatch = null;
    let activeCommunity = null;

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
      if (res.type === 'community') {
        if (res.name) {
          activeCommunity = { name: res.name };
        }
      }
    });

    // Construct Response
    const profile = {
      name: fields.Name || '',
      family: fields.Family || '',
      email: fields.Email || null,
      country: country,
      city: city,
      timezone: fields.Time_Zone || 'UTC (UTC+0)',
      profession: fields.Profession || '',
      grade: fields.Grade || 'Prefer not to say',
      community: activeCommunity,
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
  const { username, id, email, profile } = req.body;

  // We need at least one identifier
  if (!username && !id && !email) {
    return res.status(400).json({ success: false, message: 'User identifier (username, id, or email) is required' });
  }

  const cleanUsername = username ? username.replace('@', '').trim().toLowerCase() : null;
  logDebug(`PUT /api/profile request for ${cleanUsername || id || email}. Data: Name=${profile?.name}`);

  try {
    let record;

    // 1. Try finding by ID
    if (id) {
      try {
        record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(id);
      } catch (err) {
        console.log(`Could not find record by ID: ${id} for update`);
      }
    }

    // 2. Try finding by Email
    if (!record && email) {
      const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1
      }).firstPage();
      if (emailRecords.length > 0) record = emailRecords[0];
    }

    // 3. Try finding by Username
    if (!record && cleanUsername) {
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
          maxRecords: 1
        })
        .firstPage();
      if (records.length > 0) record = records[0];
    }

    if (record) {
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


// --- Admin: Get Config ---
app.get('/api/admin/config', (req, res) => {
  // Basic security check (same as run-matching)
  res.json({ success: true, config: projectConfig });
});


// --- Admin: Run AI Matching Script ---
app.get('/api/admin/run-matching', async (req, res) => {
  const { dryRun, model } = req.query; // e.g. ?dryRun=true&model=gemini-1.5-pro

  // Basic security: Check if admin (this logic should be more robust in prod, 
  // but matches existing admin endpoint pattern of loose username check or similar)
  // For now, assume protected by frontend navigation/hidden route. 
  // Ideally, check for a secret header or authenticated session.

  console.log(`🚀 API Request: Run Matching (DryRun: ${dryRun}, Model: ${model})`);

  // Set headers for SSE (Server-Sent Events)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const scriptArgs = ['scripts/match-users-ai.js'];
  if (dryRun === 'true') scriptArgs.push('--dry-run');
  if (model) scriptArgs.push(`--model=${model}`);

  const child = spawn('node', scriptArgs, {
    cwd: path.join(__dirname), // Run from backend dir
    env: { ...process.env, FORCE_COLOR: '1' } // Force color output if we want to parse it later, or keep it simple
  });

  // Heartbeat to keep connection alive during long AI waits
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000); // Ping every 15s

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
      }
    });
  });

  child.on('close', (code) => {
    clearInterval(heartbeat);
    res.write(`data: ${JSON.stringify({ type: 'done', code: code })}\n\n`);
    res.end();
  });
});

// --- Admin: Regenerate Match Image ---
app.post('/api/admin/regenerate-image', async (req, res) => {
  const { matchId } = req.body;
  if (!matchId) {
    return res.status(400).json({ success: false, message: 'Missing matchId' });
  }

  console.log(`♻️  Regenerating image for match ${matchId}...`);

  // Set headers for streaming text
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const scriptPath = path.join(__dirname, 'scripts', 'generate-match-images.js');

  // Spawn the generation script
  const child = spawn('node', [scriptPath, '--match-id=' + matchId, '--force']);

  // Pipe outputs to response
  child.stdout.on('data', (data) => {
    res.write(data);
  });

  child.stderr.on('data', (data) => {
    res.write(data);
  });

  child.on('close', (code) => {
    res.write(`\n--- Process exited with code ${code} ---`);
    res.end();
  });

  child.on('error', (err) => {
    res.write(`\n❌ Error spawning process: ${err.message}`);
    res.end();
  });
});

// Start server (existing)
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
});


