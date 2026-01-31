/**
 * Test LinkedIn duplicate detection flow (simulation)
 *
 * This simulates what happens when a user with an existing Telegram account
 * tries to login via LinkedIn with the same name.
 *
 * Run with: node backend/scripts/test-linkedin-duplicate-flow.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { findPotentialDuplicates } = require('../utils/name-matcher');
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function simulateLinkedInAuth() {
  console.log('\n🧪 Simulating LinkedIn Authentication Flow\n');
  console.log('='.repeat(60));

  // Simulate LinkedIn OAuth response
  // Using a different LinkedIn sub to test duplicate NAME detection
  const linkedInProfile = {
    sub: 'TEST_LINKEDIN_SUB_123456', // Different LinkedIn ID (not in DB)
    email: 'maksim.dubinin.test@example.com', // Different email (not in DB)
    name: 'Maksim',
    given_name: 'Maksim',
    family_name: 'Dubinin',
    picture: 'https://example.com/avatar.jpg'
  };

  console.log('\n📨 LinkedIn OAuth Response:');
  console.log(`   Email: ${linkedInProfile.email}`);
  console.log(`   Name: ${linkedInProfile.given_name} ${linkedInProfile.family_name}`);
  console.log(`   LinkedIn Sub: ${linkedInProfile.sub}`);

  console.log('\n🔍 Step 1: Check for existing LinkedIn_ID match...');
  const linkedIdRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
    .select({
      filterByFormula: `{Linkedin_ID} = '${linkedInProfile.sub}'`,
      maxRecords: 1
    })
    .firstPage();

  if (linkedIdRecords.length > 0) {
    console.log('   ✅ Found existing account by LinkedIn_ID');
    return;
  }
  console.log('   ℹ️  No existing LinkedIn_ID match');

  console.log('\n🔍 Step 2: Check for existing Email match...');
  const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
    .select({
      filterByFormula: `{Email} = '${linkedInProfile.email}'`,
      maxRecords: 1
    })
    .firstPage();

  if (emailRecords.length > 0) {
    console.log('   ✅ Found existing account by Email');
    return;
  }
  console.log('   ℹ️  No existing Email match');

  console.log('\n🔍 Step 3: DUPLICATE DETECTION - Check for name matches...');
  const potentialDuplicates = await findPotentialDuplicates(
    linkedInProfile.given_name,
    linkedInProfile.family_name,
    base,
    process.env.AIRTABLE_MEMBERS_TABLE
  );

  if (potentialDuplicates.length === 0) {
    console.log('   ✅ No duplicates detected - would create new account');
    console.log('\n📝 Result: CREATE NEW ACCOUNT');
    return;
  }

  console.log(`   ⚠️  Found ${potentialDuplicates.length} potential duplicate(s)!\n`);

  const topMatch = potentialDuplicates[0];
  const { record, confidence, matchReason } = topMatch;

  console.log('   Top Match Details:');
  console.log(`   - Record ID: ${record.id}`);
  console.log(`   - Name: ${record.fields.Name} ${record.fields.Family || ''}`);
  console.log(`   - Email: ${record.fields.Email || 'N/A'}`);
  console.log(`   - Telegram: ${record.fields.Tg_Username ? '@' + record.fields.Tg_Username : 'N/A'}`);
  console.log(`   - Tg_ID: ${record.fields.Tg_ID || 'N/A'}`);
  console.log(`   - Confidence: ${confidence}%`);
  console.log(`   - Reason: ${matchReason}`);

  console.log('\n🎯 Step 4: Determine action based on confidence...\n');

  if (confidence >= 90) {
    console.log('   🚨 HIGH CONFIDENCE (≥90%)');
    console.log('   Action: BLOCK account creation');
    console.log('   - Send admin notification via Telegram');
    console.log('   - Return 409 error to user');
    console.log('   - Log to duplicates.log');
    console.log('\n📝 Result: ACCOUNT CREATION BLOCKED ❌');
    console.log('   User message: "We found an existing account for ' +
                `${record.fields.Name} ${record.fields.Family || ''}. ` +
                'Please contact support to link your accounts."');

  } else if (confidence >= 70) {
    console.log('   ⚠️  MEDIUM CONFIDENCE (70-89%)');
    console.log('   Action: CREATE account but flag for review');
    console.log('   - Send admin notification for review');
    console.log('   - Create new account');
    console.log('   - Log to duplicates.log');
    console.log('\n📝 Result: ACCOUNT CREATED ✅ (but flagged for admin review)');

  } else {
    console.log('   ℹ️  LOW CONFIDENCE (60-69%)');
    console.log('   Action: CREATE account normally');
    console.log('   - Log to duplicates.log for audit trail only');
    console.log('   - No admin notification');
    console.log('\n📝 Result: ACCOUNT CREATED ✅');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Simulation complete!\n');
}

simulateLinkedInAuth().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
