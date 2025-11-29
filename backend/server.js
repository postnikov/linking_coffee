require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const Airtable = require('airtable');



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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linked.Coffee API is running' });
});

const crypto = require('crypto');

// Helper to verify Telegram Login Widget data
function verifyTelegramAuth(data) {
  const { hash, ...userData } = data;
  if (!hash) return false;

  const secretKey = crypto.createHash('sha256').update(process.env.BOT_TOKEN).digest();
  const checkString = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === hash;
}

// Pre-registration endpoint
app.post('/api/register', async (req, res) => {
  const { telegramUser, telegramUsername } = req.body;

  let cleanUsername;

  // Handle Telegram Login Widget data
  if (telegramUser) {
    // 1. Verify authenticity
    const isValid = verifyTelegramAuth(telegramUser);
    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid Telegram authentication data'
      });
    }

    // 2. Check for expiration (optional but recommended, e.g. 24h)
    const authDate = telegramUser.auth_date;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return res.status(403).json({
        success: false,
        message: 'Authentication data expired'
      });
    }

    cleanUsername = telegramUser.username;
  } else if (telegramUsername) {
    // Fallback for manual entry (if we keep it or for testing)
    cleanUsername = telegramUsername.replace('@', '').trim();
  } else {
    return res.status(400).json({
      success: false,
      message: 'Telegram user data is required'
    });
  }

  if (!cleanUsername) {
    return res.status(400).json({
      success: false,
      message: 'Telegram username is missing from profile'
    });
  }

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
    // We can add more fields (ID, Name) if Airtable supports them later
    const record = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([
      {
        fields: {
          Tg_Username: cleanUsername,
          Status: 'EarlyBird',
          Created_At: new Date().toISOString(),
          // Store Telegram ID if possible, or just username for now
          // Tg_ID: telegramUser?.id 
        }
      }
    ]);

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
