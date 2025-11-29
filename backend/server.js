require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const Airtable = require('airtable');
const { Telegraf } = require('telegraf');

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
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// In-memory OTP store: Map<username_lowercase, { code, expiresAt }>
const otpStore = new Map();

// Initialize Telegram Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  const username = ctx.from.username;
  if (!username) {
    return ctx.reply('Please set a username in your Telegram settings to use this bot.');
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP (valid for 10 minutes)
  const cleanUsername = username.toLowerCase();
  otpStore.set(cleanUsername, {
    code: otp,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  ctx.reply(`Your verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nPlease enter this code on the website.`, { parse_mode: 'Markdown' });
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

// Pre-registration endpoint
app.post('/api/register', async (req, res) => {
  const { telegramUsername, otp } = req.body;

  // Validate inputs
  if (!telegramUsername || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Username and verification code are required'
    });
  }

  const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();

  // Verify OTP
  const storedData = otpStore.get(cleanUsername);

  if (!storedData) {
    return res.status(400).json({
      success: false,
      message: 'No verification code found. Please start the bot again.'
    });
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(cleanUsername);
    return res.status(400).json({
      success: false,
      message: 'Verification code expired. Please get a new one.'
    });
  }

  if (storedData.code !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code.'
    });
  }

  // OTP is valid, proceed with registration
  try {
    // Check if user already registered
    const existingRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (existingRecords.length > 0) {
      // Even if registered, we clear the OTP
      otpStore.delete(cleanUsername);
      return res.status(409).json({
        success: false,
        message: 'This Telegram username is already registered'
      });
    }

    // Create new record with EarlyBird status
    const record = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([
      {
        fields: {
          Tg_Username: cleanUsername, // Store as provided (or lowercase? keeping consistent with input)
          Status: 'EarlyBird',
          Created_At: new Date().toISOString()
        }
      }
    ]);

    // Clear OTP after successful registration
    otpStore.delete(cleanUsername);

    res.json({
      success: true,
      message: 'Successfully registered! Welcome to Linked.Coffee 🎉',
      data: {
        username: cleanUsername,
        status: 'EarlyBird'
      }
    });
  } catch (error) {
    console.error('Airtable error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again later.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
