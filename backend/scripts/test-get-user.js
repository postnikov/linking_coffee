#!/usr/bin/env node
/**
 * Test Script: Get User Data for Dev Login
 * Usage: node scripts/test-get-user.js [username]
 * Example: node scripts/test-get-user.js max_postnikov
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { sanitizeUsername } = require('../utils/airtable-sanitizer');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function getUserData(username) {
  try {
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    const safeUsername = sanitizeUsername(cleanUsername);

    console.log(`Fetching user: ${cleanUsername}`);

    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`User not found: ${cleanUsername}`);
      return;
    }

    const record = records[0];
    const userData = {
      username: cleanUsername,
      status: record.fields.Status,
      consentGdpr: record.fields.Consent_GDPR,
      firstName: record.fields.Name,
      lastName: record.fields.Family,
      id: record.fields.Tg_ID,
      email: record.fields.Email
    };

    console.log('\nUser Data:');
    console.log(JSON.stringify(userData, null, 2));

    console.log('\n--- Copy-Paste for Browser Console ---');
    console.log(`localStorage.setItem('user', '${JSON.stringify(userData)}');`);
    console.log('window.location.reload();');
    console.log('--- End ---\n');

  } catch (error) {
    console.error('Error fetching user:', error);
  }
}

const username = process.argv[2] || 'max_postnikov';
getUserData(username);
