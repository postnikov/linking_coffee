const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function checkAndCreateCommunity() {
    console.log('🔍 Checking for test community "PRO2025"...');

    try {
        const records = await base('tblSMXQlCTpl7BZED').select({
            filterByFormula: `{Invite_Code} = 'PRO2025'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            console.log('✅ Community "PRO2025" already exists.');
            console.log('   ID:', records[0].id);
            console.log('   Status:', records[0].fields.Status);
        } else {
            console.log('⚠️ Community "PRO2025" not found. Creating it...');
            const created = await base('tblSMXQlCTpl7BZED').create([{
                fields: {
                    Name: 'PRO Community',
                    Slug: 'pro',
                    Invite_Code: 'PRO2025',
                    Description: 'Test community for developers',
                    Status: 'Active',
                    Created_At: new Date().toISOString().split('T')[0]
                }
            }]);
            console.log('✅ Created Community "PRO2025"');
            console.log('   ID:', created[0].id);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkAndCreateCommunity();
