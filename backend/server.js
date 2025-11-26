require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const Airtable = require('airtable');

const app = express();
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
  res.json({ status: 'ok', message: 'Linking Coffee API is running' });
});

// Pre-registration endpoint
app.post('/api/register', async (req, res) => {
  const { telegramUsername } = req.body;

  // Validate telegram username
  if (!telegramUsername) {
    return res.status(400).json({
      success: false,
      message: 'Telegram username is required'
    });
  }

  // Clean the username (remove @ if present)
  const cleanUsername = telegramUsername.replace('@', '').trim();

  if (!cleanUsername) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Telegram username'
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
    const record = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([
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
      message: 'Successfully registered! Welcome to Linking Coffee 🎉',
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
  console.log(`🚀 Linking Coffee API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
