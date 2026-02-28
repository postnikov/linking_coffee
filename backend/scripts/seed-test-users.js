#!/usr/bin/env node
/**
 * Seed / Cleanup E2E Test Users in Airtable
 *
 * Usage:
 *   node scripts/seed-test-users.js seed          # Create all test users
 *   node scripts/seed-test-users.js seed alice bob # Create specific users
 *   node scripts/seed-test-users.js cleanup        # Delete all test users
 *   node scripts/seed-test-users.js status         # Check which exist
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { sanitizeUsername, sanitizeForAirtable } = require('../utils/airtable-sanitizer');
const testUsers = require('../tests/fixtures/test-users.json');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const command = process.argv[2] || 'status';
const requestedKeys = process.argv.slice(3);

function localDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function findUser(username) {
  const safe = sanitizeForAirtable(username);
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Tg_Username} = '${safe}'`,
      maxRecords: 1
    })
    .firstPage();
  return records.length > 0 ? records[0] : null;
}

function resolveUsers(keys) {
  if (keys.length > 0) {
    return testUsers.users.filter(u => keys.includes(u.key));
  }
  return testUsers.users;
}

async function seed(keys) {
  const users = resolveUsers(keys);
  console.log(`Seeding ${users.length} test user(s)...\n`);

  for (const userDef of users) {
    const existing = await findUser(userDef.fields.Tg_Username);

    if (existing) {
      console.log(`  SKIP  ${userDef.key} (already exists: ${existing.id})`);
      continue;
    }

    const fields = {
      ...userDef.fields,
      Created_At: localDateString()
    };

    const records = await base(TABLE)
      .create([{ fields }], { typecast: true });
    console.log(`  CREATED  ${userDef.key} -> ${records[0].id}`);
  }

  console.log('\nDone.');
}

async function cleanup(keys) {
  const users = resolveUsers(keys);
  console.log(`Cleaning up ${users.length} test user(s)...\n`);

  for (const userDef of users) {
    const existing = await findUser(userDef.fields.Tg_Username);

    if (!existing) {
      console.log(`  NOT FOUND  ${userDef.key}`);
      continue;
    }

    await base(TABLE).destroy([existing.id]);
    console.log(`  DELETED  ${userDef.key} (${existing.id})`);
  }

  console.log('\nDone.');
}

async function status() {
  console.log('Test user status:\n');

  for (const userDef of testUsers.users) {
    const existing = await findUser(userDef.fields.Tg_Username);
    const icon = existing ? 'EXISTS' : 'MISSING';
    const suffix = existing ? ` -> ${existing.id}` : '';
    console.log(`  ${icon}  ${userDef.key} (@${userDef.fields.Tg_Username})${suffix}`);
  }

  console.log('');
}

async function main() {
  switch (command) {
    case 'seed':
      return seed(requestedKeys);
    case 'cleanup':
      return cleanup(requestedKeys);
    case 'status':
      return status();
    default:
      console.log('Usage: node scripts/seed-test-users.js <seed|cleanup|status> [user1 user2 ...]');
      console.log('\nAvailable users:', testUsers.users.map(u => u.key).join(', '));
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
