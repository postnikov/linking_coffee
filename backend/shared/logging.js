const fs = require('fs');
const path = require('path');
const { LOG_DIR } = require('./config');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create logs directory:', e);
  }
}

const debugLogFile = path.join(LOG_DIR, 'debug.log');
const authLogFile = path.join(LOG_DIR, 'auth.log');
const connectionsLogFile = path.join(LOG_DIR, 'connections.log');
const duplicatesLogFile = path.join(LOG_DIR, 'duplicates.log');

// Test write access on startup
try {
  const now = new Date().toISOString();
  fs.appendFileSync(authLogFile, `[${now}] Server Initialized\n`);
  fs.appendFileSync(connectionsLogFile, `[${now}] Log Initialized\n`);
} catch (e) {
  console.error('Failed to write to log files:', e);
}

function logDebug(msg) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(debugLogFile, `[${time}] ${msg}\n`);
  } catch (e) {
    console.error('Logging error:', e);
  }
}

function logAuth(msg, type = 'INFO') {
  const time = new Date().toISOString();
  const formattedMsg = `[AUTH] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(authLogFile, `[${time}] ${formattedMsg}\n`);
    console.log(`${formattedMsg}`);
  } catch (e) {
    console.error('Auth Logging error:', e);
  }
}

function logConnection(msg, type = 'INFO') {
  const time = new Date().toISOString();
  const formattedMsg = `[CONN] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(connectionsLogFile, `[${time}] ${formattedMsg}\n`);
    logAuth(msg, type);
  } catch (e) {
    console.error('Connection Logging error:', e);
  }
}

function logDuplicate(msg, type = 'INFO') {
  const time = new Date().toISOString();
  const formattedMsg = `[DUP] ${type.toUpperCase()}: ${msg}`;
  try {
    fs.appendFileSync(duplicatesLogFile, `[${time}] ${formattedMsg}\n`);
    console.log(`${formattedMsg}`);
  } catch (e) {
    console.error('Duplicate Logging error:', e);
  }
}

module.exports = { logDebug, logAuth, logConnection, logDuplicate };
