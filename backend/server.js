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

  const cleanUsername = username.toLowerCase();
  console.log(`🤖 Bot received /start from: ${username} (clean: ${cleanUsername})`);

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP (valid for 10 minutes)
  otpStore.set(cleanUsername, {
    code: otp,
    telegramId: ctx.from.id, // Store ID to update later
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  console.log(`✅ Generated OTP for ${cleanUsername}: ${otp}`);
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

// Step 1: Register (Create Record)
app.post('/api/register', async (req, res) => {
  const { telegramUsername } = req.body;

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
      // User exists, proceed to verification step
      return res.json({
        success: true,
        message: 'User exists, please verify.',
        isNew: false
      });
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
      isNew: true
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

  if (!telegramUsername || !otp) {
    return res.status(400).json({ success: false, message: 'Username and OTP are required' });
  }

  const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();
  const cleanOtp = otp.replace(/\s+/g, '');

  // Magic OTP for testing
  if (cleanOtp === '000000') {
    // Allow pass - skip store check
    console.log('✨ Magic OTP used. Bypassing verification.');
  } else {
    const storedData = otpStore.get(cleanUsername);

    if (!storedData) {
      return res.status(400).json({ success: false, message: 'No verification code found. Please start the bot again.' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(cleanUsername);
      return res.status(400).json({ success: false, message: 'Verification code expired.' });
    }

    if (storedData.code !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }
  }

  try {
    // Find record to update
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];

      // If magic OTP, we won't have storedData, so default to dummy ID
      let telegramId = '000000000';

      if (cleanOtp !== '000000') {
        const storedData = otpStore.get(cleanUsername);
        telegramId = storedData?.telegramId || '000000000';
        otpStore.delete(cleanUsername);
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            Tg_ID: telegramId.toString()
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Verification successful! Account linked.'
      });
    } else {
      // Should not happen if Step 1 worked, but handle it
      res.status(404).json({ success: false, message: 'User record not found.' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
