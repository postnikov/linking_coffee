const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Telegraf } = require('telegraf');
const Scheduler = require('./scheduler');

// Shared modules
const { PORT, BACKUP_DIR } = require('./shared/config');
const { UPLOADS_DIR } = require('./shared/config');
require('./shared/logging'); // Initialize log directory and files
require('./shared/stores');  // Initialize stores (including cleanup interval)

// Ensure backups directory exists
const fs = require('fs');
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backups directory: ${BACKUP_DIR}`);
  } catch (e) {
    console.error('Failed to create backups directory:', e);
  }
}

// Initialize Express
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

// Middleware
app.use(cors());
app.use(express.json());

// Security Headers for Google OAuth
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize Scheduler
const scheduler = new Scheduler(
  path.join(__dirname, 'scheduler.json'),
  path.join(__dirname, 'config/scheduler.json')
);
scheduler.init();

// Initialize Telegram Bot
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : process.env.ADMIN_BOT_TOKEN;
console.log(`Initializing Bot in ${process.env.NODE_ENV} mode`);
console.log(`Using Bot Token starting with: ${botToken ? botToken.substring(0, 5) + '...' : 'UNDEFINED'}`);
const bot = new Telegraf(botToken);

// Register bot callbacks (commands, inline buttons, etc.)
const registerBotCallbacks = require('./bot/callbacks');
registerBotCallbacks(bot);

// Only launch bot if running as main process (not when imported as module)
if (require.main === module) {
  bot.launch().then(() => {
    console.log('Telegram bot started');
  }).catch(err => {
    console.error('Telegram bot failed to start:', err);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('Bot instance created (not launching - imported as module)');
}

// Load project config
let projectConfig = {};
try {
  projectConfig = require('../linking-coffee.config.js');
} catch (e) {
  try {
    projectConfig = require('./linking-coffee.config.js');
  } catch (e2) {
    console.warn("Could not load linking-coffee.config.js");
  }
}

// Mount route modules
app.use(require('./routes/reference'));
app.use(require('./routes/profile'));
app.use(require('./routes/community'));
app.use(require('./routes/admin')(scheduler, projectConfig));
app.use(require('./routes/auth')(bot));
app.use(require('./routes/oauth')(bot));

// Mount dev routes only in non-production
if (process.env.NODE_ENV !== 'production') {
  app.use(require('./routes/dev'));
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File is too large. Max size is 5MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start server only if this file is run directly (not required as module)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Linked.Coffee API server running on port ${PORT}`);
  });
}

// Export bot instance for alerting module
module.exports = { bot };
