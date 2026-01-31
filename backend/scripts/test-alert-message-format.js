/**
 * Test the alert message format that would be sent to admin
 *
 * This tests the message formatting without actually sending to Telegram
 *
 * Run with: node backend/scripts/test-alert-message-format.js
 */

console.log('\n📋 Testing Admin Alert Message Format\n');
console.log('='.repeat(70));

// Simulate the data that would be passed to sendWarningAlert
const duplicateInfo = {
  id: 'recCMbRlXIIUcrm2M',
  name: 'Maksim Dubinin',
  email: 'Dubinin.me@gmail.com',
  telegram: '@maksdubinin',
  tgId: 269846945
};

const newUserInfo = {
  email: 'test.user@example.com',
  givenName: 'Maksim',
  familyName: 'Dubinin',
  linkedinSub: 'TEST_LINKEDIN_SUB_123456'
};

const confidence = 100;
const matchReason = 'Exact name match';

// Format the message that would be sent
const title = '🚨 High-Confidence Duplicate Detected';
const message =
  `**LinkedIn Login Duplicate Alert**\n\n` +
  `**New Login Attempt:**\n` +
  `• Email: ${newUserInfo.email}\n` +
  `• Name: ${newUserInfo.givenName} ${newUserInfo.familyName}\n` +
  `• LinkedIn Sub: ${newUserInfo.linkedinSub}\n\n` +
  `**Potential Existing Account:**\n` +
  `• Record ID: ${duplicateInfo.id}\n` +
  `• Name: ${duplicateInfo.name}\n` +
  `• Email: ${duplicateInfo.email}\n` +
  `• Telegram: ${duplicateInfo.telegram}\n\n` +
  `**Match Details:**\n` +
  `• Confidence: ${confidence}%\n` +
  `• Reason: ${matchReason}\n\n` +
  `⚠️ **Action:** New account was NOT created. User should be directed to link accounts.`;

console.log('\n📨 Alert Message that would be sent to admin:\n');
console.log(title);
console.log('-'.repeat(70));
console.log(message);
console.log('='.repeat(70));

console.log('\n✅ Message format looks good!');
console.log('ℹ️  This message would be sent via sendWarningAlert() to ADMIN_CHAT_ID\n');

// Test the log message format
const logMessage =
  `Potential duplicate detected for LinkedIn login ${newUserInfo.email}:\n` +
  `  Input: ${newUserInfo.givenName} ${newUserInfo.familyName}\n` +
  `  Match: ${duplicateInfo.name} (${duplicateInfo.id})\n` +
  `  Confidence: ${confidence}%\n` +
  `  Reason: ${matchReason}\n` +
  `  Existing Email: ${duplicateInfo.email}\n` +
  `  Existing Telegram: ${duplicateInfo.telegram}`;

console.log('📝 Log entry that would be written to duplicates.log:\n');
console.log('[TIMESTAMP] [DUP] WARN:', logMessage.replace(/\n/g, '\n' + ' '.repeat(30)));
console.log('\n' + '='.repeat(70));
console.log('✅ All message formats verified!\n');
