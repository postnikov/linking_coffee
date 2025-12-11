/**
 * Debug Profile (Duplicate Check) Script
 * 
 * This script scans the first 100 members in the Airtable Members table to identify 
 * duplicate users based on their Telegram Username (Tg_Username).
 * 
 * Usage:
 *   node backend/scripts/debug-profile.js
 * 
 * Details:
 *   - Normalizes usernames (lowercase, no '@') to find duplicates.
 *   - Outputs warnings if duplicates are found.
 * 
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 */

require('dotenv').config();
const Airtable = require('airtable');

async function debugProfile() {
    console.log('--- DUPLICATE CHECK START ---');
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    try {
        console.log('Fetching all records (limit 100)...');
        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
            maxRecords: 100,
            fields: ['Tg_Username', 'Name']
        }).firstPage();

        console.log(`Found ${records.length} records.`);

        const usernameMap = {};

        records.forEach(r => {
            const raw = r.fields.Tg_Username;
            const name = r.fields.Name || '(empty)';
            if (!raw) {
                console.log(`Record ${r.id} has NO Username. Name: ${name}`);
                return;
            }

            const normalized = raw.trim().toLowerCase().replace('@', '');

            if (usernameMap[normalized]) {
                console.warn(`!!! DUPLICATE FOUND !!!`);
                console.warn(`User: ${normalized}`);
                console.warn(`Record A: ${usernameMap[normalized].id} (Raw: ${usernameMap[normalized].raw})`);
                console.warn(`Record B: ${r.id} (Raw: ${raw})`);
            } else {
                usernameMap[normalized] = { id: r.id, raw: raw };
            }
        });

        console.log('Duplicate check complete.');

    } catch (err) {
        console.error('Error:', err);
    }
}

debugProfile();
