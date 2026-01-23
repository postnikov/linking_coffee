/**
 * Test Alerting Script
 *
 * Simple script to test the alerting system:
 * - Sends a test critical alert
 * - Queues a test warning
 * - Verifies Telegram delivery
 *
 * Usage:
 *   node backend/scripts/test-alerting.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { sendCriticalAlert, queueWarning, sendInfoAlert } = require('../utils/alerting');

async function testAlerting() {
  console.log('🧪 Testing alerting system...\n');

  // Test 1: Critical Alert
  console.log('1️⃣  Sending test critical alert...');
  try {
    await sendCriticalAlert(
      'Test Alert',
      `This is a test critical alert from the alerting system.\n\n` +
      `**Purpose:** Verify Telegram integration\n` +
      `**Time:** ${new Date().toISOString()}\n` +
      `**Status:** ✅ If you see this, alerting is working!\n\n` +
      `_You can safely ignore this message - it's just a test._`
    );
    console.log('   ✅ Critical alert sent\n');
  } catch (error) {
    console.error('   ❌ Failed to send critical alert:', error.message, '\n');
  }

  // Test 2: Queue Warning
  console.log('2️⃣  Queueing test warning...');
  queueWarning('Test', 'This is a test warning for the daily summary', {
    test: true,
    timestamp: new Date().toISOString()
  });
  console.log('   ✅ Warning queued (will appear in next daily summary)\n');

  // Test 3: Info Alert
  console.log('3️⃣  Sending test info alert...');
  try {
    await sendInfoAlert(
      'Test Info',
      `This is a test informational message.\n\n` +
      `**Type:** Non-urgent info\n` +
      `**Purpose:** Verify different alert levels work\n\n` +
      `_This is also a test message._`
    );
    console.log('   ✅ Info alert sent\n');
  } catch (error) {
    console.error('   ❌ Failed to send info alert:', error.message, '\n');
  }

  console.log('✅ Test complete!');
  console.log('\nCheck your Telegram (ADMIN_CHAT_ID) for:');
  console.log('  - Critical alert (immediate)');
  console.log('  - Info alert (immediate)');
  console.log('  - Warning will appear in next daily summary');
}

testAlerting()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
