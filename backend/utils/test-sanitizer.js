/**
 * Test Suite for Airtable Sanitizer
 *
 * Run with: node backend/utils/test-sanitizer.js
 */

const {
  sanitizeForAirtable,
  isValidUsername,
  isValidEmail,
  isValidTelegramId,
  sanitizeUsername,
  sanitizeEmail,
  sanitizeTelegramId,
  buildSafeFilter,
  buildSafeOrFilter,
  buildSafeAndFilter
} = require('./airtable-sanitizer');

console.log('🧪 Testing Airtable Sanitizer\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${expected}\n   Got: ${actual}`);
  }
}

// ===== Basic Sanitization Tests =====
console.log('📋 Basic Sanitization Tests\n');

test('Should escape single quotes', () => {
  const input = "admin' OR 1=1 OR '";
  const result = sanitizeForAirtable(input);
  assert(result.includes("\\'"), 'Should contain escaped quotes');
  // The key check: all internal quotes should be escaped
  // Original has 2 quotes, result should have them both escaped with backslash
  const quoteCount = (result.match(/\\'/g) || []).length;
  assertEqual(quoteCount, 2, 'Should have 2 escaped quotes');
});

test('Should handle normal usernames', () => {
  const input = 'john_doe';
  const result = sanitizeForAirtable(input);
  assertEqual(result, 'john_doe', 'Normal username should pass through');
});

test('Should handle null/undefined', () => {
  assertEqual(sanitizeForAirtable(null), '', 'Null should return empty string');
  assertEqual(sanitizeForAirtable(undefined), '', 'Undefined should return empty string');
});

test('Should escape backslashes', () => {
  const input = "test\\escape";
  const result = sanitizeForAirtable(input);
  assert(result.includes('\\\\'), 'Should escape backslashes');
});

test('Should escape newlines', () => {
  const input = "test\nline";
  const result = sanitizeForAirtable(input);
  assert(result.includes('\\n'), 'Should escape newlines');
});

// ===== Attack Vector Tests =====
console.log('\n🔒 Attack Vector Tests\n');

test('Should prevent basic OR injection', () => {
  const malicious = "' OR 1=1 OR '";
  const result = sanitizeForAirtable(malicious);
  const formula = `{Tg_Username} = '${result}'`;
  // The OR is still in the string, but it's escaped so it's treated as literal text
  assert(result.includes("\\'"), 'Should escape the quotes that would break out of string context');
  // The key is that the formula doesn't have unescaped quotes that break the string
  const unescapedQuotePattern = /(?<!\\)'/;
  assert(!unescapedQuotePattern.test(result), 'Should not have unescaped quotes');
});

test('Should prevent field access injection', () => {
  const malicious = "' OR {Status}='Admin' OR '";
  const result = sanitizeForAirtable(malicious);
  assert(result.includes("\\'"), 'Should escape quotes');
});

test('Should prevent comment injection', () => {
  const malicious = "admin'--";
  const result = sanitizeForAirtable(malicious);
  assert(result.includes("\\'"), 'Should escape quotes in comment attempts');
});

test('Should prevent nested quote injection', () => {
  const malicious = "admin\\'OR\\'1\\'=\\'1";
  const result = sanitizeForAirtable(malicious);
  // The backslashes should be escaped, preventing any escape sequence manipulation
  assert(result.includes("\\\\"), 'Should escape backslashes');
  assert(result.includes("\\'"), 'Should escape quotes');
});

// ===== Validation Tests =====
console.log('\n✅ Validation Tests\n');

test('Should validate correct username', () => {
  assert(isValidUsername('john_doe'), 'Valid username should pass');
  assert(isValidUsername('user123'), 'Valid username with numbers should pass');
  assert(isValidUsername('test-user'), 'Valid username with hyphen should pass');
});

test('Should reject invalid usernames', () => {
  assert(!isValidUsername('ab'), 'Too short username should fail');
  assert(!isValidUsername('a'.repeat(51)), 'Too long username should fail');
  assert(!isValidUsername("john'doe"), 'Username with quote should fail');
  assert(!isValidUsername('john doe'), 'Username with space should fail');
  assert(!isValidUsername('john@doe'), 'Username with @ should fail');
});

test('Should validate correct email', () => {
  assert(isValidEmail('test@example.com'), 'Valid email should pass');
  assert(isValidEmail('user+tag@domain.co.uk'), 'Email with + should pass');
});

test('Should reject invalid emails', () => {
  assert(!isValidEmail('notanemail'), 'String without @ should fail');
  assert(!isValidEmail('@example.com'), 'Email without local part should fail');
  assert(!isValidEmail('test@'), 'Email without domain should fail');
});

test('Should validate correct Telegram ID', () => {
  assert(isValidTelegramId('123456789'), 'Valid Telegram ID should pass');
  assert(isValidTelegramId(123456789), 'Numeric Telegram ID should pass');
});

test('Should reject invalid Telegram IDs', () => {
  assert(!isValidTelegramId('0'), 'Zero should fail');
  assert(!isValidTelegramId('-123'), 'Negative should fail');
  assert(!isValidTelegramId('abc'), 'Non-numeric should fail');
  assert(!isValidTelegramId(''), 'Empty should fail');
});

// ===== Combined Sanitize + Validate Tests =====
console.log('\n🔐 Combined Sanitize + Validate Tests\n');

test('Should sanitize valid username', () => {
  const result = sanitizeUsername('john_doe');
  assertEqual(result, 'john_doe', 'Valid username should be sanitized');
});

test('Should throw on invalid username', () => {
  let threw = false;
  try {
    sanitizeUsername("admin' OR 1=1");
  } catch (error) {
    threw = true;
    assert(error.message.includes('Invalid username'), 'Should throw with proper message');
  }
  assert(threw, 'Should throw error for invalid username');
});

test('Should sanitize valid email', () => {
  const result = sanitizeEmail('test@example.com');
  assertEqual(result, 'test@example.com', 'Valid email should be sanitized');
});

test('Should throw on invalid email', () => {
  let threw = false;
  try {
    sanitizeEmail('not-an-email');
  } catch (error) {
    threw = true;
  }
  assert(threw, 'Should throw error for invalid email');
});

test('Should sanitize valid Telegram ID', () => {
  const result = sanitizeTelegramId('123456789');
  assertEqual(result, '123456789', 'Valid Telegram ID should be sanitized');
});

// ===== Filter Builder Tests =====
console.log('\n🏗️  Filter Builder Tests\n');

test('Should build safe simple filter', () => {
  const result = buildSafeFilter('Tg_Username', 'john_doe');
  assertEqual(result, "{Tg_Username} = 'john_doe'", 'Should build correct filter');
});

test('Should build safe filter with malicious input', () => {
  const result = buildSafeFilter('Tg_Username', "admin' OR 1=1 OR '");
  assert(result.includes("\\'"), 'Should escape quotes in filter');
  // The injection is neutralized by escaping, not by removing the OR
  // The key is all quotes are escaped
  const unescapedQuotePattern = /(?<!\\)'/g;
  const matches = result.match(unescapedQuotePattern);
  // Should have exactly 2 unescaped quotes: the ones wrapping the value in the filter
  assertEqual(matches.length, 2, 'Should only have wrapper quotes unescaped');
});

test('Should build safe OR filter', () => {
  const result = buildSafeOrFilter([
    {field: 'Tg_Username', value: 'john'},
    {field: 'Email', value: 'john@example.com'}
  ]);
  assert(result.startsWith('OR('), 'Should start with OR(');
  assert(result.includes('Tg_Username'), 'Should include first field');
  assert(result.includes('Email'), 'Should include second field');
});

test('Should build safe AND filter', () => {
  const result = buildSafeAndFilter([
    {field: 'Status', value: 'Active'},
    {field: 'Consent_GDPR', value: true}
  ]);
  assert(result.startsWith('AND('), 'Should start with AND(');
  assert(result.includes('TRUE()'), 'Should handle boolean true');
});

test('Should handle boolean false in filter', () => {
  const result = buildSafeAndFilter([
    {field: 'Deleted', value: false}
  ]);
  assert(result.includes('FALSE()'), 'Should handle boolean false');
});

// ===== Real-World Scenario Tests =====
console.log('\n🌍 Real-World Scenario Tests\n');

test('Should handle real username from Telegram', () => {
  const telegramUsername = 'real_user_123';
  const safe = sanitizeUsername(telegramUsername);
  const formula = `{Tg_Username} = '${safe}'`;
  assert(formula === "{Tg_Username} = 'real_user_123'", 'Should handle real username');
});

test('Should safely handle email login', () => {
  const email = 'user+tag@example.com';
  const safe = sanitizeEmail(email);
  const formula = buildSafeFilter('Email', email);
  assert(formula.includes('user+tag@example.com'), 'Should preserve valid email');
});

test('Should prevent privilege escalation attempt', () => {
  const maliciousInput = "normaluser' OR {Status}='Admin' OR '";
  let threw = false;
  try {
    sanitizeUsername(maliciousInput);
  } catch (error) {
    threw = true;
  }
  assert(threw, 'Should reject malicious username format');
});

test('Should handle unicode characters safely', () => {
  const unicode = 'user_日本語';
  const result = sanitizeForAirtable(unicode);
  assert(result.includes('日本語'), 'Should preserve unicode');
});

// ===== Summary =====
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ All tests passed! Sanitizer is ready for deployment.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review and fix.\n');
  process.exit(1);
}
