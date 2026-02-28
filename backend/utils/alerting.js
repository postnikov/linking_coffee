/**
 * Alerting Module
 *
 * Core module for formatting and sending Telegram alerts with rate limiting.
 * Provides immediate critical alerts and warning queue for daily summaries.
 *
 * Usage:
 *   const { sendCriticalAlert, queueWarning } = require('./utils/alerting');
 *   await sendCriticalAlert('Script Failure', 'Details here');
 *   queueWarning('Performance', 'Slow response time detected');
 */

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Test user recipient map (dev-only): Tg_ID -> username
const TEST_USER_IDS = new Map();
if (process.env.NODE_ENV !== 'production') {
  try {
    const testUsers = require('../tests/fixtures/test-users.json');
    for (const user of testUsers.users) {
      if (user.fields.Tg_ID) {
        TEST_USER_IDS.set(String(user.fields.Tg_ID), user.fields.Tg_Username || user.key);
      }
    }
  } catch (e) {
    // Fixture file not available — fine
  }
}

/**
 * Check if a chat ID belongs to a test user
 * @param {string|number} chatId - Telegram chat ID
 * @returns {boolean}
 */
function isTestRecipient(chatId) {
  return TEST_USER_IDS.has(String(chatId));
}

/**
 * Resolve recipient for test users: redirect to ADMIN_CHAT_ID with prefix
 * Real users pass through unchanged.
 * @param {string|number} chatId - Original Telegram chat ID
 * @returns {{ chatId: string, prefix: string, isTestUser: boolean }}
 */
function resolveRecipient(chatId) {
  const testUsername = TEST_USER_IDS.get(String(chatId));
  if (testUsername && ADMIN_CHAT_ID) {
    return {
      chatId: ADMIN_CHAT_ID,
      prefix: `[E2E → @${testUsername}]\n\n`,
      isTestUser: true
    };
  }
  return { chatId, prefix: '', isTestUser: false };
}

// Bot instance management
let botInstance = null;

/**
 * Get or create Telegram bot instance
 *
 * IMPORTANT: This function reuses the bot instance from server.js to avoid
 * creating multiple polling sessions which would cause 409 Conflict errors.
 *
 * How it works:
 * 1. When server.js is running, require('../server') imports the module and
 *    reuses the existing bot instance (server.js has require.main check to
 *    prevent bot.launch() when imported as module)
 * 2. For standalone scripts, creates a new bot instance but NEVER calls
 *    bot.launch() - only uses bot.telegram.sendMessage() for sending
 *
 * WARNING: NEVER call bot.launch() on the returned instance! This would
 * create a second polling session and cause 409 Conflict errors.
 *
 * @returns {Telegraf|null} Bot instance (for sending messages only)
 */
function getBotInstance() {
  if (!botInstance) {
    // Try to import from server.js (if running in same process)
    try {
      const server = require('../server');
      if (server && server.bot) {
        botInstance = server.bot;
        console.log('📱 Using bot instance from server.js');
        return botInstance;
      }
    } catch (e) {
      // Server not loaded or no export - create fallback
    }

    // Fallback: Create new instance for standalone scripts
    // NOTE: This instance is for sending messages only, NOT for polling!
    const { Telegraf } = require('telegraf');
    const botToken = process.env.NODE_ENV === 'production'
      ? process.env.BOT_TOKEN
      : (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN);

    if (!botToken) {
      console.error('❌ No bot token available (BOT_TOKEN or ADMIN_BOT_TOKEN)');
      return null;
    }

    botInstance = new Telegraf(botToken);
    console.log('📱 Created new bot instance for alerting (send-only, no polling)');
  }
  return botInstance;
}

// Rate limiting queue
const messageQueue = [];
let isProcessingQueue = false;

/**
 * Send message with rate limiting to avoid Telegram API limits
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text
 * @param {object} options - Additional options (parse_mode, etc.)
 * @returns {Promise}
 */
async function sendWithRateLimit(chatId, message, options = {}) {
  const resolved = resolveRecipient(chatId);
  const finalMessage = resolved.prefix + message;
  return new Promise((resolve, reject) => {
    messageQueue.push({ chatId: resolved.chatId, message: finalMessage, options, resolve, reject });
    processQueue();
  });
}

/**
 * Process message queue with rate limiting
 * 100ms delay between messages = max 10 msgs/sec (Telegram limit: 30/sec)
 */
async function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;

  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    const { chatId, message, options, resolve, reject } = messageQueue.shift();

    try {
      const bot = getBotInstance();
      if (!bot) {
        reject(new Error('Bot instance not available'));
        continue;
      }

      const result = await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...options
      });
      resolve(result);
    } catch (error) {
      console.error('❌ Failed to send alert:', error.message);
      reject(error);
    }

    // Rate limiting delay (100ms = max 10 msgs/sec)
    if (messageQueue.length > 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  isProcessingQueue = false;
}

// Warning queue (in-memory, cleared after daily summary)
const warningQueue = [];

/**
 * Queue a warning for inclusion in daily summary
 * @param {string} category - Warning category (e.g., 'Health', 'Performance', 'Error')
 * @param {string} message - Warning message
 * @param {object} metadata - Additional metadata
 */
function queueWarning(category, message, metadata = {}) {
  warningQueue.push({
    category,
    message,
    metadata,
    timestamp: new Date().toISOString()
  });
  console.log(`⚠️  Queued warning [${category}]: ${message}`);
}

/**
 * Get all queued warnings
 * @returns {Array} Copy of warning queue
 */
function getQueuedWarnings() {
  return [...warningQueue];
}

/**
 * Clear all queued warnings (called after daily summary sent)
 */
function clearWarnings() {
  const count = warningQueue.length;
  warningQueue.length = 0;
  console.log(`🧹 Cleared ${count} warnings from queue`);
}

/**
 * Format alert message with proper structure
 * @param {string} level - Alert level (CRITICAL, WARNING, INFO)
 * @param {string} title - Alert title
 * @param {string} details - Detailed information
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted markdown message
 */
function formatAlert(level, title, details, timestamp) {
  const emoji = level === 'CRITICAL' ? '🚨' : level === 'WARNING' ? '⚠️' : 'ℹ️';
  const separator = '━'.repeat(25);

  return `${emoji} **${level}: ${title}**\n${separator}\n${details}\n${separator}`;
}

/**
 * Send critical alert immediately to admin
 * @param {string} title - Alert title
 * @param {string} details - Detailed information (markdown supported)
 * @param {object} options - Additional options
 * @returns {Promise}
 */
async function sendCriticalAlert(title, details, options = {}) {
  if (!ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID not configured, cannot send critical alert');
    return;
  }

  if (process.env.ENABLE_MONITORING === 'false') {
    console.log('⏸️  Monitoring disabled, skipping alert');
    return;
  }

  const timestamp = new Date().toISOString();
  const message = formatAlert('CRITICAL', title, details, timestamp);

  try {
    await sendWithRateLimit(ADMIN_CHAT_ID, message);
    console.log(`🚨 Critical alert sent: ${title}`);
  } catch (error) {
    console.error(`❌ Failed to send critical alert: ${error.message}`);
    throw error;
  }
}

/**
 * Send warning alert (less urgent than critical)
 * @param {string} title - Alert title
 * @param {string} details - Detailed information
 * @param {object} options - Additional options
 * @returns {Promise}
 */
async function sendWarningAlert(title, details, options = {}) {
  if (!ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID not configured, cannot send warning');
    return;
  }

  if (process.env.ENABLE_MONITORING === 'false') {
    console.log('⏸️  Monitoring disabled, skipping warning');
    return;
  }

  const timestamp = new Date().toISOString();
  const message = formatAlert('WARNING', title, details, timestamp);

  try {
    await sendWithRateLimit(ADMIN_CHAT_ID, message);
    console.log(`⚠️  Warning alert sent: ${title}`);
  } catch (error) {
    console.error(`❌ Failed to send warning: ${error.message}`);
    throw error;
  }
}

/**
 * Send info message (informational, non-urgent)
 * @param {string} title - Message title
 * @param {string} details - Detailed information
 * @param {object} options - Additional options
 * @returns {Promise}
 */
async function sendInfoAlert(title, details, options = {}) {
  if (!ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID not configured, cannot send info');
    return;
  }

  if (process.env.ENABLE_MONITORING === 'false') {
    console.log('⏸️  Monitoring disabled, skipping info');
    return;
  }

  const timestamp = new Date().toISOString();
  const message = formatAlert('INFO', title, details, timestamp);

  try {
    await sendWithRateLimit(ADMIN_CHAT_ID, message);
    console.log(`ℹ️  Info alert sent: ${title}`);
  } catch (error) {
    console.error(`❌ Failed to send info: ${error.message}`);
    throw error;
  }
}

/**
 * Send a message to a user, automatically redirecting test users to admin.
 * Use this instead of bot.telegram.sendMessage() for user-facing messages.
 * @param {Telegraf} bot - Bot instance
 * @param {string|number} chatId - Recipient Telegram chat ID
 * @param {string} message - Message text
 * @param {object} options - Telegraf sendMessage options (parse_mode, reply_markup, etc.)
 * @returns {Promise}
 */
async function sendToUser(bot, chatId, message, options = {}) {
  const resolved = resolveRecipient(chatId);
  return bot.telegram.sendMessage(resolved.chatId, resolved.prefix + message, options);
}

module.exports = {
  sendCriticalAlert,
  sendWarningAlert,
  sendInfoAlert,
  queueWarning,
  getQueuedWarnings,
  clearWarnings,
  sendWithRateLimit,
  formatAlert,
  getBotInstance,
  isTestRecipient,
  resolveRecipient,
  sendToUser
};
