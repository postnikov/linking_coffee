#!/usr/bin/env node
/**
 * One-time merge script: Ilya Kossolapov duplicate records
 *
 * Keeps:   recbnThO2goB103sU (Telegram record — has Tg_ID, Tg_Username, Next_Week_Status=Active)
 * Deletes: recIiAXNHluPtxyMO (LinkedIn-only record — has Email, Linkedin_ID)
 *
 * Action: copies Email + Linkedin_ID onto the Telegram record, then deletes the LinkedIn record.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const TABLE = process.env.AIRTABLE_MEMBERS_TABLE;

const KEEP_ID   = 'recbnThO2goB103sU'; // Telegram record (canonical)
const DELETE_ID = 'recIiAXNHluPtxyMO'; // LinkedIn-only record

async function merge() {
  // 1. Fetch both records
  const [keepRecord, deleteRecord] = await Promise.all([
    base(TABLE).find(KEEP_ID),
    base(TABLE).find(DELETE_ID)
  ]);

  console.log('=== KEEP (Telegram record) ===');
  console.log({ id: keepRecord.id, Tg_Username: keepRecord.fields.Tg_Username, Tg_ID: keepRecord.fields.Tg_ID, Email: keepRecord.fields.Email, Linkedin_ID: keepRecord.fields.Linkedin_ID });

  console.log('\n=== DELETE (LinkedIn record) ===');
  console.log({ id: deleteRecord.id, Email: deleteRecord.fields.Email, Linkedin_ID: deleteRecord.fields.Linkedin_ID });

  // 2. Safety checks
  if (!deleteRecord.fields.Email || !deleteRecord.fields.Linkedin_ID) {
    throw new Error('DELETE record is missing Email or Linkedin_ID — aborting');
  }
  if (keepRecord.fields.Linkedin_ID) {
    throw new Error(`KEEP record already has Linkedin_ID=${keepRecord.fields.Linkedin_ID} — aborting to avoid overwrite`);
  }

  // 3. Copy Email + Linkedin_ID onto the keeper
  console.log('\nMerging Email + Linkedin_ID onto Telegram record...');
  await base(TABLE).update([{
    id: KEEP_ID,
    fields: {
      Email:       deleteRecord.fields.Email,
      Linkedin_ID: deleteRecord.fields.Linkedin_ID
    }
  }]);
  console.log('✅ Merge complete');

  // 4. Delete the duplicate
  console.log(`Deleting duplicate record ${DELETE_ID}...`);
  await base(TABLE).destroy([DELETE_ID]);
  console.log('✅ Duplicate deleted');

  console.log('\nDone. Ilya now has a single record with Telegram + LinkedIn linked.');
}

merge().catch(err => {
  console.error('❌ Merge failed:', err.message);
  process.exit(1);
});
