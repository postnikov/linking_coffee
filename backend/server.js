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
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : process.env.ADMIN_BOT_TOKEN;
console.log(`🤖 Initializing Bot in ${process.env.NODE_ENV} mode`);
console.log(`🔑 Using Bot Token starting with: ${botToken ? botToken.substring(0, 5) + '...' : 'UNDEFINED'}`);
const bot = new Telegraf(botToken);

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
  ctx.reply(`☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nPlease enter this code on the website.`, { parse_mode: 'Markdown' });
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
        } catch (botError) {
          console.error('❌ Failed to send proactive OTP:', botError);
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

  if (!telegramUsername || !otp) {
    console.log('❌ Missing username or OTP');
    return res.status(400).json({ success: false, message: 'Username and OTP are required' });
  }

  const cleanUsername = telegramUsername.replace('@', '').trim().toLowerCase();
  const cleanOtp = otp.replace(/\s+/g, '');
  console.log(`🧹 Cleaned: username="${cleanUsername}", otp="${cleanOtp}"`);

  // Verify OTP
  let telegramId = 0; // Default for magic OTP (number, not string)

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
      otpStore.delete(cleanUsername);
      return res.status(400).json({ success: false, message: 'Verification code expired.' });
    }

    console.log(`🔐 Verifying OTP code...`);
    if (storedData.code !== cleanOtp) {
      console.log(`❌ OTP mismatch. Expected: ${storedData.code}, Got: ${cleanOtp}`);
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    // OTP is valid - get the telegram ID and clean up
    telegramId = parseInt(storedData.telegramId, 10); // Convert to number
    console.log(`✅ OTP valid! Telegram ID: ${telegramId}`);
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

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            Tg_ID: telegramId // Now a number
          }
        }
      ]);

      console.log(`✅ Successfully updated record!`);
      res.json({
        success: true,
        message: 'Verification successful! Account linked.',
        user: {
          username: cleanUsername,
          status: record.fields.Status,
          consentGdpr: record.fields.Consent_GDPR
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
  const { username } = req.body;

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
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: {
            Consent_GDPR: true
          }
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
