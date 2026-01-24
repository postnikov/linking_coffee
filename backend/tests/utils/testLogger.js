const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/deployment-tests.log');

// Ensure logs directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function logTestStart(testSuite) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ========== TEST RUN START: ${testSuite} ==========\n`;
  fs.appendFileSync(LOG_FILE, message);
}

function logTestResult(testName, status, duration, error = null) {
  const timestamp = new Date().toISOString();
  let message = `[${timestamp}] ${status} ${testName} (${duration}ms)\n`;
  if (error) {
    message += `   Error: ${error.message}\n`;
  }
  fs.appendFileSync(LOG_FILE, message);
}

function logTestEnd(totalTests, passed, failed, duration) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ========== TEST RUN END ==========\n` +
    `   Total: ${totalTests}, Passed: ${passed}, Failed: ${failed}, Duration: ${duration}ms\n\n`;
  fs.appendFileSync(LOG_FILE, message);
}

module.exports = {
  logTestStart,
  logTestResult,
  logTestEnd
};
