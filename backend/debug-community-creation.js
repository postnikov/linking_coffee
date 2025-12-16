const path = require('path');
const dotenv = require('dotenv');
// Try loading assuming running from root
const result = dotenv.config({ path: '.env' });

if (result.error) {
    // Fallback to relative path if running from backend dir
    dotenv.config({ path: path.join(__dirname, '../../.env') });
}
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const COMMUNITIES_TABLE = 'tblSMXQlCTpl7BZED';
const COMMUNITY_MEMBERS_TABLE = 'tblPN0ni3zaaTCPcF';

async function debugCreation() {
    console.log('🔍 Starting Debug Script...');
    console.log(`Base ID: ${process.env.AIRTABLE_BASE_ID}`);
    console.log(`Community Members Table ID: ${COMMUNITY_MEMBERS_TABLE}`);

    try {
        // 1. Find User 'kisodrakon'
        console.log('\n1️⃣ Finding User "kisodrakon"...');
        const memberRecords = await base(MEMBERS_TABLE).select({
            filterByFormula: "{Tg_Username} = 'kisodrakon'",
            maxRecords: 1
        }).firstPage();

        if (memberRecords.length === 0) {
            console.error('❌ User not found!');
            return;
        }
        const member = memberRecords[0];
        console.log(`✅ Found Member: ${member.id} (${member.fields.Name || 'No Name'})`);

        // 2. Find Community 'NEWHRPRO2026'
        console.log('\n2️⃣ Finding Community "NEWHRPRO2026"...');
        const commRecords = await base(COMMUNITIES_TABLE).select({
            filterByFormula: "{Invite_Code} = 'NEWHRPRO2026'",
            maxRecords: 1
        }).firstPage();

        if (commRecords.length === 0) {
            console.error('❌ Community not found!');
            return;
        }
        const community = commRecords[0];
        console.log(`✅ Found Community: ${community.id} (${community.fields.Name})`);

        // 3. Inspect Table Schema (if possible) or try to read a record
        console.log('\n3️⃣  (Skipped Schema Check) - Proceeding to Create...');

        // 4. Attempt to Create Link
        console.log('\n4️⃣ Attempting to create Community_Member record...');
        const payload = {
            'Member': [member.id],
            'Community': [community.id],
            'Role': 'Member',
            'Status': 'Active',
            'Joined_At': new Date().toISOString().split('T')[0]
        };
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const createdRecords = await base(COMMUNITY_MEMBERS_TABLE).create([{
            fields: payload
        }]);
        
        const newRecordId = createdRecords[0].id;
        console.log('✅ SUCCESS! Record created:', newRecordId);

        // 5. Verify Data Persistence
        console.log('\n5️⃣ Verifying created record...');
        const fetchedRecord = await base(COMMUNITY_MEMBERS_TABLE).find(newRecordId);
        console.log('Fetched Fields:', JSON.stringify(fetchedRecord.fields, null, 2));
        
        if (!fetchedRecord.fields.Member || fetchedRecord.fields.Member.length === 0) {
            console.error('❌ PROBLEM: "Member" field is empty!');
        } else {
            console.log('✅ "Member" field is populated:', fetchedRecord.fields.Member);
        }
        console.log('Created Record:', created[0].id);

    } catch (error) {
        console.error('\n❌ FAILURE!');
        console.error('Error Type:', error.error);
        console.error('Error Message:', error.message);
        console.error('Full Error:', JSON.stringify(error, null, 2));
    }
}

debugCreation();
