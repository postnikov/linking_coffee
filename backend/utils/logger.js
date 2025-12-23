const Airtable = require('airtable');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const LOGS_TABLE_ID = 'tbln4rLHEgXUkL9Jh'; // From SCHEMA

/**
 * Logs a message event to the database and console.
 * 
 * @param {Object} params
 * @param {string} params.scriptName - Name of the calling script (e.g. 'midweek-checkin')
 * @param {string} params.memberId - Airtable Record ID of the Member
 * @param {string} params.status - 'Sent', 'Failed', or 'Dry Run'
 * @param {string} params.content - The message content (truncated if necessary)
 * @param {string} [params.matchId] - (Optional) Airtable Record ID of the Match
 * @param {string} [params.error] - (Optional) Error message if failed
 */
async function logMessage({ scriptName, memberId, status, content, matchId = null, error = null }) {

    // 1. Console Output
    const icon = status === 'Sent' ? '✅' : status === 'Dry Run' ? '📝' : '❌';
    let logText = `${icon} [${scriptName}] ${status}: Member ${memberId}`;
    if (matchId) logText += ` | Match ${matchId}`;
    if (error) logText += ` | Error: ${error}`;

    console.log(logText);

    // 2. Airtable Record
    const fields = {
        'Category': 'Message',
        'Source_Script': scriptName,
        'Sent_Status': status,
        'Message_Content': content,
        'Member': memberId ? [memberId] : [], // Link field expects an array
    };

    if (matchId) {
        fields['Related_Match'] = [matchId]; // Link field expects an array
    }

    try {
        await base(LOGS_TABLE_ID).create([{ fields }], { typecast: true });
        // console.log(`   (Log saved to DB)`);
    } catch (err) {
        console.error(`   ⚠️ Failed to save log to Airtable: ${err.message}`);
    }
}

module.exports = { logMessage };
