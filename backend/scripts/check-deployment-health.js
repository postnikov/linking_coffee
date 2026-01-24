const fs = require('fs');
const path = require('path');
const { sendCriticalAlert } = require('../utils/alerting');

const LOG_FILE = path.join(__dirname, '../logs/deployment-tests.log');

if (!fs.existsSync(LOG_FILE)) {
  console.log('No deployment test log found.');
  process.exit(0);
}

const logs = fs.readFileSync(LOG_FILE, 'utf8');
const lines = logs.split('\n');

// Check for recent failures (last 24h)
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const recentFailures = lines.filter(line => {
  const match = line.match(/\[(.*?)\].*FAILED/);
  if (match) {
    const timestamp = new Date(match[1]).getTime();
    return timestamp > oneDayAgo;
  }
  return false;
});

if (recentFailures.length > 0) {
  sendCriticalAlert(
    'Recent Deployment Test Failures',
    `${recentFailures.length} failed tests in the last 24 hours.\n\n` +
    recentFailures.slice(-5).join('\n')
  );
}

process.exit(0);
