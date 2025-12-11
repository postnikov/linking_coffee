const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
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
        "🎉 Yes, you’re in! ❤️\n" +
        "On Monday you’ll get your Linked Coffee match.\n\n" +
        "You can always change matching settings on the dashboard\n" +
        "at https://linked.coffee"
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
    await ctx.answerCbQuery('Skipped.');
    await ctx.editMessageText(
      "Alright. Got it.\n" +
      "I'll come back next weekend to ask you again ;)"
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
    }]);

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

    // 3. Fetch Matches for Current Week
    const getMonday = (d) => {
      d = new Date(d);
      var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
    const mondayDate = getMonday(new Date());
    const weekStartStr = mondayDate.toISOString().split('T')[0];

    // Note: Airtable dates are string YYYY-MM-DD
    const matchesRecords = await base('tblx2OEN5sSR1xFI2')
      .select({
        filterByFormula: `IS_SAME({Week_Start}, "${weekStartStr}", 'day')`
      })
      .all();

    const matches = await Promise.all(matchesRecords.map(async (m) => {
      // Resolve member names if possible, but keep it light for now
      // Actually frontend might need names. 
      // Airtable lookups might already provide arrays of names/usernames if configured.
      // Checking Schema... Step 121: 
      // Matches table has Member1 and Member2 as Linked Records.
      // Usually linked records come with just IDs unless lookup fields exist.
      // Let's rely on frontend to display IDs or simpler: fetches.
      // BUT for performance, let's just return what we have. 
      // Or better: map using the 'users' list we just fetched!

      const m1Id = m.fields.Member1 ? m.fields.Member1[0] : null;
      const m2Id = m.fields.Member2 ? m.fields.Member2[0] : null;

      // Helper to find user in our fetched list
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

// Step 4: Get User Profile
app.get('/api/profile', async (req, res) => {
  const { username, requester } = req.query;
  logDebug(`GET /api/profile request for username: ${username}`);

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  if (!requester) {
    return res.status(400).json({ success: false, message: 'Requester is required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();
  const cleanRequester = requester.replace('@', '').trim().toLowerCase();

  // Access Control Logic
  if (cleanUsername !== cleanRequester) {
    try {
      // Check if requester is Admin
      const requesterRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${cleanRequester}'`,
          maxRecords: 1
        })
        .firstPage();

      const isRequesterAdmin = requesterRecord.length > 0 && requesterRecord[0].fields.Status === 'Admin';

      if (!isRequesterAdmin) {
        // If not Admin, check if they are matched
        const matchesTableId = 'tblx2OEN5sSR1xFI2';
        const matchRecords = await base(matchesTableId)
          .select({
            filterByFormula: `OR(
                        AND(FIND('${cleanRequester}', ARRAYJOIN({Tg_Username (from Member1)})), FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member2)}))),
                        AND(FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member1)})), FIND('${cleanRequester}', ARRAYJOIN({Tg_Username (from Member2)})))
                    )`,
            maxRecords: 1
          })
          .firstPage();

        if (matchRecords.length === 0) {
          return res.status(403).json({ success: false, message: 'Access denied. You can only view profiles of your matches.' });
        }
      }
      // If Admin, bypass match check
    } catch (error) {
      console.error('Error checking permissions:', error);
      return res.status(500).json({ success: false, message: 'Error verifying permissions' });
    }
  }


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
            flag: flag,
            iso: isoCode
          };
        } catch (err) {
          console.error('Error fetching linked country:', err);
        }
      }

      // Fetch linked city details if exists
      let city = null;
      if (fields.City_Link && fields.City_Link.length > 0) {
        try {
          const cityRecord = await base(process.env.AIRTABLE_CITIES_TABLE || 'Cities').find(fields.City_Link[0]);
          city = {
            id: cityRecord.id,
            name: cityRecord.fields.name_en
          };
        } catch (err) {
          console.error('Error fetching linked city:', err);
        }
      }

      // Map Airtable fields to frontend format
      const profile = {
        name: fields.Name || '',
        family: fields.Family || '',
        // Country is now an object { id, name, flag }
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

      // Fetch current match if exists
      let currentMatch = null;
      try {
        const matchesTableId = 'tblx2OEN5sSR1xFI2';
        // Find matches where Member1 OR Member2 is the current user
        const matchRecords = await base(matchesTableId)
          .select({
            filterByFormula: `OR({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanUsername}')`,
            sort: [{ field: 'Week_Start', direction: 'desc' }],
            maxRecords: 1
          })
          .firstPage();

        if (matchRecords.length > 0) {
          const match = matchRecords[0];
          // Check if user is Member1. Note: Lookup values are arrays.
          const member1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : '';
          const isMember1 = member1Username === cleanUsername;

          // Get the OTHER member's details
          const otherMemberPrefix = isMember1 ? 'Member2' : 'Member1';
          const otherMemberLink = match.fields[otherMemberPrefix];

          if (otherMemberLink && otherMemberLink.length > 0) {
            const otherMemberId = otherMemberLink[0];
            const otherMemberRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(otherMemberId);

            if (otherMemberRecord) {
              currentMatch = {
                name: otherMemberRecord.fields.Name,
                family: otherMemberRecord.fields.Family,
                username: otherMemberRecord.fields.Tg_Username,
                avatar: otherMemberRecord.fields.Avatar && otherMemberRecord.fields.Avatar.length > 0 ? otherMemberRecord.fields.Avatar[0].url : ''
              };
            }
          }
        }
      } catch (err) {
        console.error('Error fetching current match:', err);
      }

      res.json({ success: true, profile, currentMatch });
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

