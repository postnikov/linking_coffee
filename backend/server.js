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

bot.start(async (ctx) => {
  const username = ctx.from.username;
  const telegramId = ctx.from.id;

  if (!username) {
    return ctx.reply('Please set a username in your Telegram settings to use this bot.');
  }

  const cleanUsername = username.toLowerCase();

  try {
    // Check if user exists in Airtable
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      // Update the record with Tg_ID
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            Tg_ID: telegramId.toString()
          }
        }
      ]);
      ctx.reply(`Welcome ${username}! Your account has been successfully linked. ☕️`);
    } else {
      ctx.reply('Welcome! Please register on our website https://linked.coffee first.');
    }
  } catch (error) {
    console.error('Bot error:', error);
    ctx.reply('Something went wrong. Please try again later.');
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

// Pre-registration endpoint
app.post('/api/register', async (req, res) => {
  const { telegramUsername } = req.body;

  // Validate inputs
  if (!telegramUsername) {
    return res.status(400).json({
      success: false,
      message: 'Username is required'
    });
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
      return res.status(409).json({
        success: false,
        message: 'This Telegram username is already registered'
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
      message: 'Successfully registered! Please launch the bot to complete setup.',
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
