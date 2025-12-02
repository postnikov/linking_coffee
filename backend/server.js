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

// Configure Multer for file uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

      const updateFields = {
        Tg_ID: telegramId
      };

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
        flag: flag
      };
    });

    res.json({ success: true, countries });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch countries' });
  }
});

// Step 4: Get User Profile
app.get('/api/profile', async (req, res) => {
  const { username } = req.query;

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
      const fields = record.fields;

      // Fetch linked country details if exists
      let country = null;
      if (fields.Countries && fields.Countries.length > 0) {
        try {
          const countryRecord = await base(process.env.AIRTABLE_COUNTRIES_TABLE || 'Countries').find(fields.Countries[0]);
          const isoCode = countryRecord.fields.ISO_Code;
          const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';

          country = {
            id: countryRecord.id,
            name: countryRecord.fields.Name_en,
            flag: flag
          };
        } catch (err) {
          console.error('Error fetching linked country:', err);
        }
      }

      // Map Airtable fields to frontend format
      const profile = {
        name: fields.Name || '',
        family: fields.Family || '',
        // Country is now an object { id, name, flag }
        country: country,
        city: fields.City_String || '', // Use City_String for now as Cities table linking is complex
        timezone: fields.Time_Zone || 'UTC (UTC+0)',
        profession: fields.Profession || '',
        grade: fields.Grade || 'Prefer not to say',
        professionalDesc: fields.Professional_Description || '',
        personalDesc: fields.Personal_Description || '',
        professionalInterests: fields.Professional_Interests ? fields.Professional_Interests.join(', ') : '',
        personalInterests: fields.Personal_Interests ? fields.Personal_Interests.join(', ') : '',
        coffeeGoals: fields.Coffee_Goals || [],
        languages: fields.Languages || [],
        bestMeetingDays: fields.Best_Meetings_Days || [],
        avatar: fields.Avatar && fields.Avatar.length > 0 ? fields.Avatar[0].url : ''
      };

      res.json({ success: true, profile });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Step 5: Update User Profile
app.put('/api/profile', async (req, res) => {
  const { username, profile } = req.body;

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
        Languages: profile.languages,
        Best_Meetings_Days: profile.bestMeetingDays,
        City_String: profile.city
      };

      // Handle Country Linking
      if (profile.country && profile.country.id) {
        updateFields.Countries = [profile.country.id];
      }

      // Handle Interests - split string into array
      if (profile.professionalInterests) {
        updateFields.Professional_Interests = profile.professionalInterests.split(',').map(s => s.trim()).filter(s => s);
      }
      if (profile.personalInterests) {
        updateFields.Personal_Interests = profile.personalInterests.split(',').map(s => s.trim()).filter(s => s);
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Linked.Coffee API server running on port ${PORT}`);
});

