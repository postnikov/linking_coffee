require('dotenv').config({path: '../.env'});
const Airtable = require('airtable');
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

(async () => {
  try {
    console.log('Fetching all communities...');
    const records = await base('tblSMXQlCTpl7BZED').select({
      maxRecords: 20
    }).firstPage();
    
    console.log(`Found ${records.length} communities:`);
    records.forEach(comm => {
      console.log(`- Code: "${comm.fields.Invite_Code || '(empty)'}", Name: "${comm.fields.Name || '(unnamed)'}", Status: "${comm.fields.Status || '(no status)'}"`);
    });
    
    // Also search specifically for PRO2025
    console.log('\nSearching specifically for PRO2025...');
    const pro2025 = await base('tblSMXQlCTpl7BZED').select({
      filterByFormula: "{Invite_Code} = 'PRO2025'",
      maxRecords: 1
    }).firstPage();
    console.log('PRO2025 found:', pro2025.length > 0 ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
