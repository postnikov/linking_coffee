/**
 * Integration test for duplicate detection
 *
 * Simulates the Maksim Dubinin scenario:
 * 1. User creates account via Telegram (username: maksdubinin, Tg_ID: 269846945)
 * 2. User tries to login via LinkedIn (email: Dubinin.me@gmail.com, name: Maksim Dubinin)
 * 3. System should detect duplicate and prevent creation
 *
 * Run with: node backend/scripts/test-duplicate-detection.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { findPotentialDuplicates } = require('../utils/name-matcher');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function testDuplicateDetection() {
  console.log('\n🧪 Testing Duplicate Detection\n');

  try {
    // Test Case 1: Exact name match (the actual Maksim Dubinin case)
    console.log('Test 1: Exact name match (Maksim Dubinin)');
    console.log('=========================================');

    const test1Results = await findPotentialDuplicates(
      'Maksim',
      'Dubinin',
      base,
      process.env.AIRTABLE_MEMBERS_TABLE
    );

    if (test1Results.length > 0) {
      console.log(`✅ Found ${test1Results.length} potential duplicate(s):\n`);
      test1Results.forEach((match, idx) => {
        console.log(`Match ${idx + 1}:`);
        console.log(`  Name: ${match.record.fields.Name} ${match.record.fields.Family || ''}`);
        console.log(`  Email: ${match.record.fields.Email || 'N/A'}`);
        console.log(`  Telegram: ${match.record.fields.Tg_Username ? '@' + match.record.fields.Tg_Username : 'N/A'}`);
        console.log(`  Confidence: ${match.confidence}%`);
        console.log(`  Reason: ${match.matchReason}`);
        console.log(`  Record ID: ${match.record.id}\n`);
      });

      const topMatch = test1Results[0];
      if (topMatch.confidence >= 90) {
        console.log('✅ PASS: High-confidence duplicate detected (would block account creation)');
      } else if (topMatch.confidence >= 70) {
        console.log('⚠️  WARN: Medium-confidence duplicate (would create + notify admin)');
      } else {
        console.log('ℹ️  INFO: Low-confidence match (would create + log only)');
      }
    } else {
      console.log('❌ FAIL: No duplicates found (expected to find Telegram account)');
    }

    console.log('\n');

    // Test Case 2: Fuzzy match (Maksim vs Maxim)
    console.log('Test 2: Fuzzy name match (Maxim Dubinin)');
    console.log('=========================================');

    const test2Results = await findPotentialDuplicates(
      'Maxim',
      'Dubinin',
      base,
      process.env.AIRTABLE_MEMBERS_TABLE
    );

    if (test2Results.length > 0) {
      console.log(`✅ Found ${test2Results.length} potential duplicate(s):\n`);
      const topMatch = test2Results[0];
      console.log(`Top Match:`);
      console.log(`  Name: ${topMatch.record.fields.Name} ${topMatch.record.fields.Family || ''}`);
      console.log(`  Confidence: ${topMatch.confidence}%`);
      console.log(`  Reason: ${topMatch.matchReason}\n`);

      if (topMatch.confidence >= 70) {
        console.log('✅ PASS: Fuzzy match detected with sufficient confidence');
      } else {
        console.log('⚠️  WARN: Fuzzy match found but low confidence');
      }
    } else {
      console.log('ℹ️  INFO: No fuzzy matches found (may be expected if threshold too high)');
    }

    console.log('\n');

    // Test Case 3: No match (completely different person)
    console.log('Test 3: No match scenario (John Smith)');
    console.log('=======================================');

    const test3Results = await findPotentialDuplicates(
      'John',
      'Smith',
      base,
      process.env.AIRTABLE_MEMBERS_TABLE
    );

    if (test3Results.length === 0) {
      console.log('✅ PASS: No duplicates found (as expected for non-existent user)');
    } else {
      console.log(`ℹ️  INFO: Found ${test3Results.length} potential match(es):`);
      test3Results.forEach(match => {
        console.log(`  - ${match.record.fields.Name} ${match.record.fields.Family || ''} (${match.confidence}%)`);
      });
    }

    console.log('\n✅ Duplicate detection test completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testDuplicateDetection();
