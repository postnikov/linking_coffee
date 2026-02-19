const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const Scheduler = require('./scheduler');
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const { spawn } = require('child_process');
const statisticsUtils = require('./utils/statistics');
const { sanitizeForAirtable, sanitizeUsername, sanitizeEmail, sanitizeTelegramId } = require('./utils/airtable-sanitizer');
const { findPotentialDuplicates } = require('./utils/name-matcher');
const { sendWarningAlert } = require('./utils/alerting');
const { checkCommunityMember, checkCommunityAdmin } = require('./utils/community-middleware');

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
const duplicatesLogFile = path.join(logDir, 'duplicates.log');

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

function logDuplicate(msg, type = 'INFO') {
  const time = new Date().toISOString();
  // Standard format: [DUP] TYPE: Message
  const formattedMsg = `[DUP] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(duplicatesLogFile, `[${time}] ${formattedMsg}\n`);
    console.log(`${formattedMsg}`);
  } catch (e) {
    console.error('Duplicate Logging error:', e);
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

// Rate Limiting Configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per windowMs
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: { success: false, error: 'Too many admin requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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
// IMPORTANT: This bot instance is exported for use by scripts (via alerting.js)
// but bot.launch() is only called when this file is the main module (see bottom of file)
// to prevent multiple polling sessions which cause 409 Conflict errors.
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

  // Provide both login link (for new users) and dashboard link (for Gmail users connecting Telegram)
  const loginUrl = `https://linked.coffee/login?code=${otp}&user=${encodeURIComponent(cleanUsername)}`;
  const dashboardUrl = `https://linked.coffee/dashboard?connectCode=${otp}&connectUser=${encodeURIComponent(cleanUsername)}`;

  ctx.reply(
    `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nClick below to verify:\n` +
    `[New user? Click here](${loginUrl})\n` +
    `[Already logged in? Click here](${dashboardUrl})`,
    { parse_mode: 'Markdown' }
  );
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
    const safeTelegramId = sanitizeTelegramId(telegramId);
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_ID} = '${safeTelegramId}'`,
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
    const safeTelegramId = sanitizeTelegramId(telegramId);
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_ID} = '${safeTelegramId}'`,
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

// Community: Approve Membership
bot.action(/^community_approve:(.+)$/, async (ctx) => {
  const membershipId = ctx.match[1];

  try {
    // Update membership status to Active
    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: membershipId,
        fields: {
          Status: 'Active'
        }
      }
    ]);

    // Get membership details to notify user
    const membership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).find(membershipId);
    const memberIds = membership.fields.Member;
    const communityIds = membership.fields.Community;

    if (memberIds && memberIds.length > 0 && communityIds && communityIds.length > 0) {
      const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
      const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityIds[0]);

      const userTgId = member.fields.Tg_ID;
      const communityName = community.fields.Name;

      // Notify user of approval
      if (userTgId) {
        await bot.telegram.sendMessage(
          userTgId,
          `🎉 Your membership to *${communityName}* has been approved!\n\n` +
          `You can now participate in weekly coffee matches within this community.`,
          { parse_mode: 'Markdown' }
        );
      }
    }

    await ctx.answerCbQuery('✅ Membership approved');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n✅ Approved'
    );
  } catch (error) {
    console.error('Error approving membership:', error);
    await ctx.answerCbQuery('❌ Error approving membership');
  }
});

// Community: Ignore Membership Request
bot.action(/^community_ignore:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('Request ignored. User can re-apply if needed.');
  await ctx.editMessageText(
    ctx.callbackQuery.message.text + '\n\n🚫 Ignored'
  );
});

// Community: Participate Yes
bot.action(/^community_participate_yes:(.+):(.+)$/, async (ctx) => {
  const memberId = ctx.match[1];
  const slug = ctx.match[2];

  try {
    // Set Matching_Context and Next_Week_Status
    await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
      {
        id: memberId,
        fields: {
          Matching_Context: `community:${slug}`,
          Next_Week_Status: 'Active'
        }
      }
    ]);

    await ctx.answerCbQuery('✅ You\'re in for next week\'s community match!');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n✅ Confirmed for community matching'
    );
  } catch (error) {
    console.error('Error setting community participation:', error);
    await ctx.answerCbQuery('❌ Error confirming participation');
  }
});

// Community: Participate No
bot.action(/^community_participate_no:(.+):(.+)$/, async (ctx) => {
  const memberId = ctx.match[1];

  try {
    // Clear participation
    await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
      {
        id: memberId,
        fields: {
          Next_Week_Status: 'Passive'
        }
      }
    ]);

    await ctx.answerCbQuery('👍 Skipping this week');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n🪫 Skipping this week'
    );
  } catch (error) {
    console.error('Error clearing participation:', error);
    await ctx.answerCbQuery('❌ Error updating status');
  }
});

// Community Deleted: Join Global
bot.action(/^community_deleted_join_global:(.+)$/, async (ctx) => {
  const memberId = ctx.match[1];

  try {
    // Clear No_Global_Notifications flag
    await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
      {
        id: memberId,
        fields: {
          No_Global_Notifications: false,
          Matching_Context: 'global'
        }
      }
    ]);

    await ctx.answerCbQuery('✅ Welcome to the global pool!');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n✅ Joined global matching pool'
    );
  } catch (error) {
    console.error('Error joining global pool:', error);
    await ctx.answerCbQuery('❌ Error updating preferences');
  }
});

// Community Deleted: Skip
bot.action(/^community_deleted_skip:(.+)$/, async (ctx) => {
  const memberId = ctx.match[1];

  try {
    // Set No_Global_Notifications flag
    await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
      {
        id: memberId,
        fields: {
          No_Global_Notifications: true
        }
      }
    ]);

    await ctx.answerCbQuery('👍 You won\'t receive global invitations');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n🪫 Opted out of global matching'
    );
  } catch (error) {
    console.error('Error opting out:', error);
    await ctx.answerCbQuery('❌ Error updating preferences');
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

// Only launch bot if running as main process (not when imported as module)
if (require.main === module) {
  bot.launch().then(() => {
    console.log('🤖 Telegram bot started');
  }).catch(err => {
    console.error('❌ Telegram bot failed to start:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('📦 Bot instance created (not launching - imported as module)');
}


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linked.Coffee API is running' });
});

// Step 1: Register (Create Record) or Request OTP
app.post('/api/register', authLimiter, async (req, res) => {
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
          const loginUrl = `https://linked.coffee/login?code=${otp}&user=${encodeURIComponent(cleanUsername)}`;
          const dashboardUrl = `https://linked.coffee/dashboard?connectCode=${otp}&connectUser=${encodeURIComponent(cleanUsername)}`;

          await bot.telegram.sendMessage(
            tgId,
            `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nClick below to verify:\n` +
            `[New user? Click here](${loginUrl})\n` +
            `[Already logged in? Click here](${dashboardUrl})`,
            { parse_mode: 'Markdown' }
          );
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

// Dev Login - Only for local development testing
app.post('/api/dev-login', async (req, res) => {
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

// Step 2: Verify OTP and Update Tg_ID
app.post('/api/verify', authLimiter, async (req, res) => {
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

// Unsubscribe from marketing emails
app.post('/api/unsubscribe', async (req, res) => {
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
            // Send admin notification for review
            try {
              await sendWarningAlert(
                '🚨 High-Confidence Duplicate Detected',
                `**LinkedIn Login Duplicate Alert**\n\n` +
                `**New Login Attempt:**\n` +
                `• Email: ${email}\n` +
                `• Name: ${given_name || name} ${family_name || ''}\n` +
                `• LinkedIn Sub: ${sub}\n\n` +
                `**Potential Existing Account:**\n` +
                `• Record ID: ${duplicateInfo.id}\n` +
                `• Name: ${duplicateInfo.name}\n` +
                `• Email: ${duplicateInfo.email}\n` +
                `• Telegram: ${duplicateInfo.telegram}\n\n` +
                `**Match Details:**\n` +
                `• Confidence: ${confidence}%\n` +
                `• Reason: ${matchReason}\n\n` +
                `⚠️ **Action:** New account was NOT created. User should be directed to link accounts.`
              );
            } catch (alertError) {
              console.error('Failed to send duplicate alert:', alertError);
            }

            // Return error response asking user to link accounts
            return res.status(409).json({
              success: false,
              duplicateDetected: true,
              message: `We found an existing account for ${duplicateInfo.name}. Please contact support to link your accounts.`,
              potentialMatch: {
                name: duplicateInfo.name,
                hasTelegram: !!duplicateRecord.fields.Tg_ID,
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
                '⚠️ Medium-Confidence Duplicate Created',
                `**LinkedIn Login Duplicate Alert**\n\n` +
                `**New Account Created:**\n` +
                `• Email: ${email}\n` +
                `• Name: ${given_name || name} ${family_name || ''}\n` +
                `• LinkedIn Sub: ${sub}\n\n` +
                `**Potential Existing Account:**\n` +
                `• Record ID: ${duplicateInfo.id}\n` +
                `• Name: ${duplicateInfo.name}\n` +
                `• Email: ${duplicateInfo.email}\n` +
                `• Telegram: ${duplicateInfo.telegram}\n\n` +
                `**Match Details:**\n` +
                `• Confidence: ${confidence}%\n` +
                `• Reason: ${matchReason}\n\n` +
                `ℹ️ **Action:** New account was created but may be duplicate. Please review and merge if needed.`
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
    // Use sanitizeUsername to prevent SQL injection
    const { sanitizeUsername } = require('./utils/airtable-sanitizer');
    const safeUsername = sanitizeUsername(cleanRequester);

    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
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
app.post('/api/admin/bot/test', adminLimiter, checkAdmin, async (req, res) => {
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
app.get('/api/admin/logs', adminLimiter, checkAdmin, (req, res) => {
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

app.get('/api/admin/logs/view', adminLimiter, checkAdmin, (req, res) => {
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
app.get('/api/admin/logs/scripts', adminLimiter, checkAdmin, async (req, res) => {
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

app.get('/api/admin/logs/scripts/:scriptName', adminLimiter, checkAdmin, async (req, res) => {
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

app.get('/api/admin/logs/scripts/:scriptName/tail', adminLimiter, checkAdmin, async (req, res) => {
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

app.get('/api/admin/logs/scripts/:scriptName/download', adminLimiter, checkAdmin, async (req, res) => {
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

// Statistics
app.get('/api/admin/statistics', adminLimiter, checkAdmin, async (req, res) => {
  try {
    const period = parseInt(req.query.period) || 30;

    // Validate period
    if (period < 1 || period > 365) {
      return res.status(400).json({
        success: false,
        message: 'Period must be between 1 and 365 days'
      });
    }

    console.log(`📊 Fetching statistics for ${period} days...`);

    // Fetch data from Airtable in parallel
    const [membersRecords, matchesRecords, countriesRecords, citiesRecords] = await Promise.all([
      // Members with Consent_GDPR
      base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: '{Consent_GDPR}',
        fields: [
          'Created_At', 'Tg_ID', 'Linkedin_ID', 'Status',
          'Name', 'Family', 'Avatar', 'Profession', 'Grade',
          'Professional_Description', 'Personal_Description',
          'Languages', 'Professional_Interests', 'Personal_Interests',
          'Coffee_Goals', 'Countries', 'City_Link', 'Time_Zone',
          'Best_Meetings_Days', 'Next_Week_Status', 'Current_Week_Status'
        ]
      }).all(),

      // Matches within period (fetch all to get historical data)
      base(process.env.AIRTABLE_MATCHES_TABLE).select({
        fields: [
          'Week_Start', 'Member1', 'Member2', 'Status',
          'We_Met_1', 'We_Met_2', 'Feedback1', 'Feedback2',
          'Notifications', 'Midweek_Checkin', 'Weekend_Checkin'
        ]
      }).all(),

      // Countries for geographic analysis
      base(process.env.AIRTABLE_COUNTRIES_TABLE).select({
        fields: ['ISO_Code', 'Name_en']
      }).all(),

      // Cities for geographic analysis
      base(process.env.AIRTABLE_CITIES_TABLE).select({
        fields: ['Slug', 'name_en', 'country_iso']
      }).all()
    ]);

    console.log(`✅ Fetched ${membersRecords.length} members, ${matchesRecords.length} matches`);

    // Create lookup maps for countries and cities
    const countriesMap = new Map(countriesRecords.map(r => [r.id, r]));
    const citiesMap = new Map(citiesRecords.map(r => [r.id, r]));

    // Calculate all statistics in parallel
    const [
      dailyMetrics,
      weeklyMetrics,
      profileCompletion,
      matchPerformance,
      userStatus,
      geography,
      languages
    ] = await Promise.all([
      Promise.resolve(statisticsUtils.calculateDailyMetrics(membersRecords, period)),
      Promise.resolve(statisticsUtils.calculateWeeklyMetrics(membersRecords, matchesRecords, period)),
      Promise.resolve(statisticsUtils.analyzeProfileCompletion(membersRecords)),
      Promise.resolve(statisticsUtils.analyzeMatchPerformance(matchesRecords)),
      Promise.resolve(statisticsUtils.analyzeUserStatus(membersRecords)),
      Promise.resolve(statisticsUtils.analyzeGeography(membersRecords, countriesMap, citiesMap)),
      Promise.resolve(statisticsUtils.analyzeLanguages(membersRecords))
    ]);

    // Calculate overview
    const overview = statisticsUtils.calculateOverview(
      membersRecords,
      matchesRecords,
      matchPerformance
    );

    console.log('✅ Statistics calculated successfully');

    res.json({
      success: true,
      data: {
        overview,
        daily: dailyMetrics,
        weekly: weeklyMetrics,
        userStatus,
        profileCompletion,
        geography,
        languages,
        matchPerformance
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// Backups
app.get('/api/admin/backups', adminLimiter, checkAdmin, (req, res) => {
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
app.get('/api/admin/scheduler', adminLimiter, checkAdmin, (req, res) => {
  res.json({ success: true, jobs: scheduler.getJobs() });
});

app.post('/api/admin/scheduler', adminLimiter, checkAdmin, (req, res) => {
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

app.post('/api/admin/scheduler/run', adminLimiter, checkAdmin, (req, res) => {
  const { name } = req.body;
  if (scheduler.runJobNow(name)) {
    res.json({ success: true, message: 'Job started' });
  } else {
    res.status(404).json({ success: false, message: 'Job not found' });
  }
});

// Available scripts
app.get('/api/admin/scripts', adminLimiter, checkAdmin, (req, res) => {
  const scriptsDir = path.join(__dirname, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    res.json({ success: true, scripts: files });
  } else {
    res.json({ success: true, scripts: [] });
  }
});

// Deployment Tests - View test results
app.get('/api/admin/tests', adminLimiter, checkAdmin, (req, res) => {
  const testLogFile = path.join(logDir, 'deployment-tests.log');

  if (!fs.existsSync(testLogFile)) {
    return res.json({ logs: '', lastRun: null, fileSize: 0 });
  }

  try {
    const logs = fs.readFileSync(testLogFile, 'utf8');
    const stats = fs.statSync(testLogFile);

    // Parse last test run
    const lines = logs.split('\n').filter(line => line.includes('TEST RUN START'));
    const lastRun = lines.length > 0 ? lines[lines.length - 1].match(/\[(.*?)\]/)?.[1] : null;

    // Return last 100 lines
    const logLines = logs.split('\n');
    const last100 = logLines.slice(-100).join('\n');

    res.json({
      success: true,
      logs: last100,
      lastRun,
      fileSize: stats.size
    });
  } catch (error) {
    console.error('Error reading deployment test logs:', error);
    res.status(500).json({ success: false, message: 'Failed to read test logs' });
  }
});

// Deployment Tests - Trigger tests manually
app.post('/api/admin/tests/run', adminLimiter, checkAdmin, async (req, res) => {
  const { spawn } = require('child_process');

  res.json({ success: true, status: 'started', message: 'Smoke tests initiated' });

  // Run tests in background
  const testProcess = spawn('npm', ['test', '--', '--testPathPattern=smoke'], {
    cwd: __dirname,
    env: {
      ...process.env,
      API_URL: 'http://localhost:3001/api',
      FRONTEND_URL: 'http://localhost:8181'
    }
  });

  testProcess.on('exit', (code) => {
    const status = code === 0 ? 'passed' : 'failed';
    console.log(`Smoke tests ${status} (exit code: ${code})`);
  });
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
      const safeEmail = sanitizeEmail(email);
      const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Email} = '${safeEmail}'`,
        maxRecords: 1
      }).firstPage();
      if (emailRecords.length > 0) record = emailRecords[0];
    }

    // 3. Try finding by Username
    if (!record && cleanUsername) {
      const safeUsername = sanitizeUsername(cleanUsername);
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
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
    // Validate and sanitize username
    const safeUsername = sanitizeUsername(cleanUsername);

    // Verify user exists
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
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

// ==========================================
// CLOSED COMMUNITIES - API ENDPOINTS
// ==========================================

// Generate Invite Link (Admin Only)
app.post('/api/community/:slug/invite-links', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { label, maxUses = -1, expiresAt = null } = req.body;

    // Validate inputs
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Label is required'
      });
    }

    if (typeof maxUses !== 'number' || (maxUses < -1 || maxUses === 0)) {
      return res.status(400).json({
        success: false,
        error: 'maxUses must be -1 (unlimited) or a positive integer'
      });
    }

    // Validate expiry date if provided
    if (expiresAt !== null) {
      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiresAt date format'
        });
      }
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'expiresAt must be in the future'
        });
      }
    }

    // Generate unique 8-char hex code
    const crypto = require('crypto');
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Create invite link record
    const inviteLinkRecord = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).create([
      {
        fields: {
          Community: [req.community.id],
          Code: code,
          Label: sanitizeForAirtable(label.trim()),
          Status: 'Active',
          Max_Uses: maxUses,
          Used_Count: 0,
          Expires_At: expiresAt,
          Created_By: [req.userId]
        }
      }
    ]);

    res.json({
      success: true,
      inviteLink: {
        id: inviteLinkRecord[0].id,
        code: code,
        label: label.trim(),
        status: 'Active',
        maxUses: maxUses,
        usedCount: 0,
        expiresAt: expiresAt,
        url: `https://linked.coffee/join/${code}`
      }
    });

    logDebug(`Invite link created for community ${req.params.slug} by ${req.membership.fields.Member}: ${code}`);
  } catch (error) {
    console.error('Error creating invite link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create invite link'
    });
  }
});

// Get Invite Link Info (Public - for join page)
app.get('/api/invite/:code/info', apiLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    // Validate code format
    if (!/^[A-F0-9]{8}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code format'
      });
    }

    const safeCode = sanitizeForAirtable(code.toUpperCase());

    // Find invite link
    const inviteLinkRecords = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `{Code} = '${safeCode}'`,
      maxRecords: 1
    }).firstPage();

    if (inviteLinkRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite link not found'
      });
    }

    const inviteLink = inviteLinkRecords[0].fields;

    // Check if invite is valid
    if (inviteLink.Status !== 'Active') {
      return res.status(400).json({
        success: false,
        error: 'This invite link has been disabled'
      });
    }

    // Check expiry
    if (inviteLink.Expires_At) {
      const expiryDate = new Date(inviteLink.Expires_At);
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This invite link has expired'
        });
      }
    }

    // Check usage limit
    if (inviteLink.Max_Uses !== -1 && inviteLink.Used_Count >= inviteLink.Max_Uses) {
      return res.status(400).json({
        success: false,
        error: 'This invite link has reached its usage limit'
      });
    }

    // Get community info
    const communityId = inviteLink.Community[0];
    const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityId);

    res.json({
      success: true,
      invite: {
        code: code.toUpperCase(),
        label: inviteLink.Label,
        community: {
          name: community.fields.Name,
          slug: community.fields.Slug,
          description: community.fields.Description || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching invite info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invite information'
    });
  }
});

// List Invite Links (Visibility-Controlled)
app.get('/api/community/:slug/invite-links', apiLimiter, checkCommunityMember, async (req, res) => {
  try {
    const settings = req.community.fields.Settings ? JSON.parse(req.community.fields.Settings) : {};
    const visibleTo = settings.invite_links_visible_to || 'all_members';

    // Check visibility permissions
    const memberRole = req.membership.fields.Role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';

    if (visibleTo === 'admins_only' && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view invite links'
      });
    }

    // Fetch invite links for this community
    const inviteLinks = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `{Community} = '${req.community.id}'`,
      sort: [{ field: 'Created_At', direction: 'desc' }]
    }).all();

    const links = inviteLinks.map(link => ({
      id: link.id,
      code: link.fields.Code,
      label: link.fields.Label,
      status: link.fields.Status,
      maxUses: link.fields.Max_Uses,
      usedCount: link.fields.Used_Count || 0,
      expiresAt: link.fields.Expires_At || null,
      createdAt: link.fields.Created_At,
      url: `https://linked.coffee/join/${link.fields.Code}`
    }));

    res.json({
      success: true,
      inviteLinks: links
    });
  } catch (error) {
    console.error('Error listing invite links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invite links'
    });
  }
});

// Disable Invite Link (Admin Only)
app.patch('/api/community/:slug/invite-links/:linkId', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { linkId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['Active', 'Disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be Active or Disabled'
      });
    }

    // Verify link belongs to this community
    const link = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).find(linkId);
    if (link.fields.Community[0] !== req.community.id) {
      return res.status(403).json({
        success: false,
        error: 'This invite link does not belong to this community'
      });
    }

    // Update status
    await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).update([
      {
        id: linkId,
        fields: {
          Status: status
        }
      }
    ]);

    res.json({
      success: true,
      message: `Invite link ${status === 'Disabled' ? 'disabled' : 'enabled'} successfully`
    });

    logDebug(`Invite link ${linkId} ${status} by ${req.membership.fields.Member} in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error updating invite link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invite link'
    });
  }
});

// Community Join Flow
app.post('/api/community/join/:code', apiLimiter, async (req, res) => {
  try {
    // Check authentication
    const username = req.body.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { code } = req.params;

    // Validate code format
    if (!/^[A-F0-9]{8}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code format'
      });
    }

    const safeCode = sanitizeForAirtable(code.toUpperCase());
    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // Find invite link
    const inviteLinkRecords = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `{Code} = '${safeCode}'`,
      maxRecords: 1
    }).firstPage();

    if (inviteLinkRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite link not found'
      });
    }

    const inviteLink = inviteLinkRecords[0];
    const inviteFields = inviteLink.fields;

    // Validate invite status
    if (inviteFields.Status !== 'Active') {
      return res.status(400).json({
        success: false,
        error: 'This invite link has been disabled'
      });
    }

    // Check expiry
    if (inviteFields.Expires_At) {
      const expiryDate = new Date(inviteFields.Expires_At);
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This invite link has expired'
        });
      }
    }

    // Check usage limit
    if (inviteFields.Max_Uses !== -1 && inviteFields.Used_Count >= inviteFields.Max_Uses) {
      return res.status(400).json({
        success: false,
        error: 'This invite link has reached its usage limit'
      });
    }

    // Get community
    const communityId = inviteFields.Community[0];
    const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityId);
    const communityFields = community.fields;

    // Get user
    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please complete registration first.'
      });
    }

    const user = userRecords[0];
    const userId = user.id;
    const userTgId = user.fields.Tg_ID;

    // Check if user is already a member
    const existingMembership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Member} = '${userId}', {Community} = '${communityId}')`,
      maxRecords: 1
    }).firstPage();

    if (existingMembership.length > 0) {
      const status = existingMembership[0].fields.Status;
      if (status === 'Active') {
        return res.status(400).json({
          success: false,
          error: 'You are already a member of this community'
        });
      } else if (status === 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Your membership is pending approval'
        });
      }
    }

    // Determine initial status based on approval mode
    const settings = communityFields.Settings ? JSON.parse(communityFields.Settings) : {};
    const approvalMode = settings.approval_mode || 'auto';
    const initialStatus = approvalMode === 'manual' ? 'Pending' : 'Active';

    // Create Community_Members record
    const membershipRecord = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).create([
      {
        fields: {
          Member: [userId],
          Community: [communityId],
          Status: initialStatus,
          Role: 'Member',
          Invited_Via: [inviteLink.id]
        }
      }
    ]);

    // Increment invite usage counter
    await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).update([
      {
        id: inviteLink.id,
        fields: {
          Used_Count: (inviteFields.Used_Count || 0) + 1
        }
      }
    ]);

    // Send Telegram notification to user
    if (userTgId) {
      if (initialStatus === 'Pending') {
        await bot.telegram.sendMessage(
          userTgId,
          `✅ You've requested to join *${communityFields.Name}*\n\n` +
          `Your request is pending approval from a community admin. You'll be notified once approved.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.telegram.sendMessage(
          userTgId,
          `🎉 Welcome to *${communityFields.Name}*!\n\n` +
          `You're now a member. You can start participating in weekly coffee matches.`,
          { parse_mode: 'Markdown' }
        );
      }
    }

    // If manual approval, notify community admins
    if (initialStatus === 'Pending') {
      // Find community admins
      const adminMemberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
        filterByFormula: `AND(
          {Community} = '${communityId}',
          {Status} = 'Active',
          OR({Role} = 'Owner', {Role} = 'Admin')
        )`
      }).all();

      for (const adminMembership of adminMemberships) {
        const adminMemberIds = adminMembership.fields.Member;
        if (adminMemberIds && adminMemberIds.length > 0) {
          const adminMember = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(adminMemberIds[0]);
          const adminTgId = adminMember.fields.Tg_ID;

          if (adminTgId) {
            await bot.telegram.sendMessage(
              adminTgId,
              `👤 New membership request for *${communityFields.Name}*\n\n` +
              `User: @${safeUsername}\n` +
              `Name: ${user.fields.Name || 'Not set'}\n\n` +
              `Please approve or ignore this request.`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ Approve', callback_data: `community_approve:${membershipRecord[0].id}` },
                      { text: '🚫 Ignore', callback_data: `community_ignore:${membershipRecord[0].id}` }
                    ]
                  ]
                }
              }
            );
          }
        }
      }
    }

    res.json({
      success: true,
      membership: {
        id: membershipRecord[0].id,
        status: initialStatus,
        community: {
          name: communityFields.Name,
          slug: communityFields.Slug
        }
      },
      message: initialStatus === 'Pending'
        ? 'Your membership request has been submitted and is pending approval'
        : 'You have successfully joined the community'
    });

    logDebug(`User ${safeUsername} joined community ${communityFields.Slug} with status ${initialStatus} via invite ${code}`);
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join community'
    });
  }
});

// Get Community Info (Member-Only)
app.get('/api/community/:slug', apiLimiter, checkCommunityMember, async (req, res) => {
  try {
    const community = req.community;
    const settings = community.fields.Settings ? JSON.parse(community.fields.Settings) : {};

    // Get member count
    const memberCount = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Community} = '${community.id}', {Status} = 'Active')`
    }).all();

    res.json({
      success: true,
      community: {
        name: community.fields.Name,
        slug: community.fields.Slug,
        description: community.fields.Description || '',
        memberCount: memberCount.length,
        minActiveForMatching: community.fields.Min_Active_For_Matching || 6,
        settings: settings,
        myRole: req.membership.fields.Role
      }
    });
  } catch (error) {
    console.error('Error fetching community info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community information'
    });
  }
});

// Get Community Members List (Visibility-Controlled)
app.get('/api/community/:slug/members', apiLimiter, checkCommunityMember, async (req, res) => {
  try {
    const settings = req.community.fields.Settings ? JSON.parse(req.community.fields.Settings) : {};
    const visibleTo = settings.member_list_visible_to || 'all_members';

    // Check visibility permissions
    const memberRole = req.membership.fields.Role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';

    if (visibleTo === 'admins_only' && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view member list'
      });
    }

    // Fetch community members
    const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Community} = '${req.community.id}', {Status} = 'Active')`,
      sort: [{ field: 'Joined_At', direction: 'asc' }]
    }).all();

    const members = [];
    for (const membership of memberships) {
      const memberIds = membership.fields.Member;
      if (memberIds && memberIds.length > 0) {
        const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
        members.push({
          username: member.fields.Tg_Username,
          name: member.fields.Name || '',
          role: membership.fields.Role,
          joinedAt: membership.fields.Joined_At
        });
      }
    }

    res.json({
      success: true,
      members: members
    });
  } catch (error) {
    console.error('Error fetching community members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community members'
    });
  }
});

// Update Community Settings (Admin-Only)
app.put('/api/community/:slug', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { name, description, minActiveForMatching, settings } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Name must be a non-empty string'
        });
      }
      updates.Name = sanitizeForAirtable(name.trim());
    }

    if (description !== undefined) {
      updates.Description = sanitizeForAirtable(description);
    }

    if (minActiveForMatching !== undefined) {
      if (typeof minActiveForMatching !== 'number' || minActiveForMatching < 2) {
        return res.status(400).json({
          success: false,
          error: 'minActiveForMatching must be a number >= 2'
        });
      }
      updates.Min_Active_For_Matching = minActiveForMatching;
    }

    if (settings !== undefined) {
      // Validate settings structure
      const validApprovalModes = ['auto', 'manual'];
      const validVisibility = ['all_members', 'admins_only'];
      const validOddHandling = ['skip', 'notify_admin'];

      if (settings.approval_mode && !validApprovalModes.includes(settings.approval_mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid approval_mode'
        });
      }

      if (settings.member_list_visible_to && !validVisibility.includes(settings.member_list_visible_to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid member_list_visible_to'
        });
      }

      if (settings.invite_links_visible_to && !validVisibility.includes(settings.invite_links_visible_to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid invite_links_visible_to'
        });
      }

      if (settings.odd_user_handling && !validOddHandling.includes(settings.odd_user_handling)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid odd_user_handling'
        });
      }

      updates.Settings = JSON.stringify(settings);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Update community
    await base(process.env.AIRTABLE_COMMUNITIES_TABLE).update([
      {
        id: req.community.id,
        fields: updates
      }
    ]);

    res.json({
      success: true,
      message: 'Community updated successfully'
    });

    logDebug(`Community ${req.params.slug} updated by ${req.membership.fields.Member}`);
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update community'
    });
  }
});

// Get User's Communities
app.get('/api/my/communities', apiLimiter, async (req, res) => {
  try {
    const username = req.query.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // Find user
    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userRecords[0];
    const userId = user.id;
    const matchingContext = user.fields.Matching_Context || 'global';

    // Find user's community memberships
    const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Member} = '${userId}', OR({Status} = 'Active', {Status} = 'Pending'))`
    }).all();

    const communities = [];
    for (const membership of memberships) {
      const communityIds = membership.fields.Community;
      if (communityIds && communityIds.length > 0) {
        const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityIds[0]);
        communities.push({
          slug: community.fields.Slug,
          name: community.fields.Name,
          role: membership.fields.Role,
          status: membership.fields.Status,
          isCurrentMatchingContext: matchingContext === `community:${community.fields.Slug}`
        });
      }
    }

    res.json({
      success: true,
      matchingContext: matchingContext,
      communities: communities
    });
  } catch (error) {
    console.error('Error fetching user communities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch communities'
    });
  }
});

// Update User's Matching Context
app.put('/api/my/matching-context', apiLimiter, async (req, res) => {
  try {
    const username = req.body.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { matchingContext } = req.body;

    // Validate matching context format
    if (!matchingContext || typeof matchingContext !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'matchingContext is required'
      });
    }

    if (matchingContext !== 'global' && !matchingContext.startsWith('community:')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid matchingContext format. Must be "global" or "community:{slug}"'
      });
    }

    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // If community context, verify user is active member
    if (matchingContext.startsWith('community:')) {
      const slug = matchingContext.replace('community:', '');

      // Find community
      const communityRecords = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({
        filterByFormula: `{Slug} = '${sanitizeForAirtable(slug)}'`,
        maxRecords: 1
      }).firstPage();

      if (communityRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Community not found'
        });
      }

      const communityId = communityRecords[0].id;

      // Find user
      const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      }).firstPage();

      if (userRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const userId = userRecords[0].id;

      // Verify active membership
      const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
        filterByFormula: `AND({Member} = '${userId}', {Community} = '${communityId}', {Status} = 'Active')`,
        maxRecords: 1
      }).firstPage();

      if (memberships.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You are not an active member of this community'
        });
      }

      // Update matching context
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: userId,
          fields: {
            Matching_Context: matchingContext
          }
        }
      ]);
    } else {
      // Global context
      const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      }).firstPage();

      if (userRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: userRecords[0].id,
          fields: {
            Matching_Context: 'global'
          }
        }
      ]);
    }

    res.json({
      success: true,
      matchingContext: matchingContext,
      message: 'Matching context updated successfully'
    });

    logDebug(`User ${safeUsername} set matching context to ${matchingContext}`);
  } catch (error) {
    console.error('Error updating matching context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update matching context'
    });
  }
});

// Leave Community
app.post('/api/community/:slug/leave', apiLimiter, checkCommunityMember, async (req, res) => {
  try {
    // Prevent owner from leaving
    if (req.membership.fields.Role === 'Owner') {
      return res.status(403).json({
        success: false,
        error: 'Community owner cannot leave. Transfer ownership first or delete the community.'
      });
    }

    // Update membership status
    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: req.membership.id,
        fields: {
          Status: 'Removed',
          Left_At: new Date().toISOString()
        }
      }
    ]);

    // If user's matching context is this community, reset to global
    const username = req.user?.Tg_Username || req.headers['x-user'];
    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length > 0) {
      const user = userRecords[0];
      const matchingContext = user.fields.Matching_Context || 'global';

      if (matchingContext === `community:${req.params.slug}`) {
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: user.id,
            fields: {
              Matching_Context: 'global'
            }
          }
        ]);
      }
    }

    res.json({
      success: true,
      message: 'You have successfully left the community'
    });

    logDebug(`User ${safeUsername} left community ${req.params.slug}`);
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave community'
    });
  }
});

// Start server only if this file is run directly (not required as module)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
  });
}

// Export bot instance for alerting module
module.exports = { bot };


