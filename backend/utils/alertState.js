/**
 * Alert State Manager
 *
 * Manages persistent alert state across server restarts for:
 * - Consecutive failure tracking
 * - Last daily summary timestamp
 * - Health check failure counters
 *
 * State is stored in /backend/config/alert-state.json
 *
 * Usage:
 *   const { recordScriptFailure, getConsecutiveHealthFailures } = require('./utils/alertState');
 *   recordScriptFailure('match-users.js');
 *   const failures = getConsecutiveHealthFailures();
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../config/alert-state.json');

// In-memory cache to avoid repeated file reads
let stateCache = null;

/**
 * Initialize default state structure
 */
function initializeState() {
  return {
    lastDailySummary: null,
    consecutiveHealthFailures: 0,
    scriptFailures: {},
    healthChecks: {
      lastSuccess: null,
      lastFailure: null
    }
  };
}

/**
 * Load state from disk
 * Creates file with default state if it doesn't exist
 * @returns {object} State object
 */
function loadState() {
  if (stateCache) return stateCache;

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      stateCache = JSON.parse(data);
      console.log('📊 Loaded alert state from disk');
    } else {
      stateCache = initializeState();
      saveState(stateCache);
      console.log('📊 Initialized new alert state');
    }
  } catch (error) {
    console.error('❌ Error loading alert state:', error.message);
    stateCache = initializeState();
  }

  return stateCache;
}

/**
 * Save state to disk
 * @param {object} state - State object to save
 */
function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    stateCache = state;
  } catch (error) {
    console.error('❌ Error saving alert state:', error.message);
  }
}

/**
 * Record a script failure
 * Increments consecutive failure counter for the script
 * @param {string} scriptName - Name of the script (e.g., 'match-users.js')
 */
function recordScriptFailure(scriptName) {
  const state = loadState();

  if (!state.scriptFailures[scriptName]) {
    state.scriptFailures[scriptName] = {
      consecutiveFailures: 0,
      lastFailure: null,
      lastAlertSent: null,
      totalFailures: 0
    };
  }

  state.scriptFailures[scriptName].consecutiveFailures++;
  state.scriptFailures[scriptName].totalFailures++;
  state.scriptFailures[scriptName].lastFailure = new Date().toISOString();

  saveState(state);
  console.log(`📉 Script failure recorded: ${scriptName} (consecutive: ${state.scriptFailures[scriptName].consecutiveFailures})`);
}

/**
 * Record a script success
 * Resets consecutive failure counter for the script
 * @param {string} scriptName - Name of the script
 */
function recordScriptSuccess(scriptName) {
  const state = loadState();

  if (!state.scriptFailures[scriptName]) {
    state.scriptFailures[scriptName] = {
      consecutiveFailures: 0,
      lastFailure: null,
      lastAlertSent: null,
      totalFailures: 0
    };
  }

  // Reset consecutive failures on success
  const wasFailingBefore = state.scriptFailures[scriptName].consecutiveFailures > 0;
  state.scriptFailures[scriptName].consecutiveFailures = 0;

  saveState(state);

  if (wasFailingBefore) {
    console.log(`✅ Script recovered: ${scriptName}`);
  }
}

/**
 * Get consecutive failure count for a script
 * @param {string} scriptName - Name of the script
 * @returns {number} Number of consecutive failures
 */
function getConsecutiveFailures(scriptName) {
  const state = loadState();
  return state.scriptFailures[scriptName]?.consecutiveFailures || 0;
}

/**
 * Record a health check failure
 * Increments consecutive health failure counter
 */
function recordHealthFailure() {
  const state = loadState();
  state.consecutiveHealthFailures++;
  state.healthChecks.lastFailure = new Date().toISOString();

  saveState(state);
  console.log(`💔 Health check failure recorded (consecutive: ${state.consecutiveHealthFailures})`);
}

/**
 * Reset health check failures
 * Called when health check succeeds
 */
function resetHealthFailures() {
  const state = loadState();
  const wasFailingBefore = state.consecutiveHealthFailures > 0;

  state.consecutiveHealthFailures = 0;
  state.healthChecks.lastSuccess = new Date().toISOString();

  saveState(state);

  if (wasFailingBefore) {
    console.log('💚 Health check recovered');
  }
}

/**
 * Get consecutive health failure count
 * @returns {number} Number of consecutive health failures
 */
function getConsecutiveHealthFailures() {
  const state = loadState();
  return state.consecutiveHealthFailures || 0;
}

/**
 * Record that daily summary was sent
 * Updates lastDailySummary timestamp
 */
function recordDailySummary() {
  const state = loadState();
  state.lastDailySummary = new Date().toISOString();
  saveState(state);
  console.log('📧 Daily summary timestamp recorded');
}

/**
 * Check if daily summary is due
 * @returns {boolean} True if 24h+ has elapsed since last summary
 */
function isDailySummaryDue() {
  const state = loadState();

  if (!state.lastDailySummary) {
    return true; // Never sent before
  }

  const lastSummary = new Date(state.lastDailySummary);
  const now = new Date();
  const hoursSince = (now - lastSummary) / (1000 * 60 * 60);

  return hoursSince >= 24;
}

/**
 * Get full state object (for debugging/admin UI)
 * @returns {object} Complete state object
 */
function getFullState() {
  return loadState();
}

/**
 * Reset all state (for testing/maintenance)
 */
function resetState() {
  const state = initializeState();
  saveState(state);
  console.log('🔄 Alert state reset to defaults');
}

/**
 * Update when alert was sent for a script
 * Prevents spam by tracking last alert time
 * @param {string} scriptName - Name of the script
 */
function recordAlertSent(scriptName) {
  const state = loadState();

  if (!state.scriptFailures[scriptName]) {
    state.scriptFailures[scriptName] = {
      consecutiveFailures: 0,
      lastFailure: null,
      lastAlertSent: null,
      totalFailures: 0
    };
  }

  state.scriptFailures[scriptName].lastAlertSent = new Date().toISOString();
  saveState(state);
}

/**
 * Check if alert should be sent (rate limiting)
 * Prevents sending duplicate alerts within 5 minutes
 * @param {string} scriptName - Name of the script
 * @returns {boolean} True if alert should be sent
 */
function shouldSendAlert(scriptName) {
  const state = loadState();

  if (!state.scriptFailures[scriptName]?.lastAlertSent) {
    return true; // Never sent before
  }

  const lastAlert = new Date(state.scriptFailures[scriptName].lastAlertSent);
  const now = new Date();
  const minutesSince = (now - lastAlert) / (1000 * 60);

  return minutesSince >= 5; // Rate limit: 1 alert per 5 minutes
}

module.exports = {
  loadState,
  saveState,
  recordScriptFailure,
  recordScriptSuccess,
  getConsecutiveFailures,
  recordHealthFailure,
  resetHealthFailures,
  getConsecutiveHealthFailures,
  recordDailySummary,
  isDailySummaryDue,
  getFullState,
  resetState,
  recordAlertSent,
  shouldSendAlert
};
