const path = require('path');
// Try loading .env from project root (two levels up from backend/scripts)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
// If not found or variables missing, try backend/.env
if (!process.env.AIRTABLE_API_KEY) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
const Airtable = require('airtable');
const { Telegram } = require('telegraf');

// Configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_MEMBERS_TABLE;
const BOT_TOKEN = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : process.env.ADMIN_BOT_TOKEN;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !BOT_TOKEN) {
    console.error('❌ Missing environment variables. Check .env file.');
    process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const telegram = new Telegram(BOT_TOKEN);

// CLI Arguments
const isDryRun = process.argv.includes('--dry-run');
const isTest = process.argv.includes('--test');
const TEST_ID = '379053';

async function run() {
    console.log(`🚀 Starting Weekly Check-in Script`);
    console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${isTest ? `ON (Target: ${TEST_ID})` : 'OFF'}`);

    try {
        console.log('📡 Fetching passive users from Airtable...');
        // Filter: Has Tg_ID, Passive Status, AND No_Spam is NOT checked
        const records = await base(TABLE_NAME).select({
            filterByFormula: "AND({Tg_ID} != '', {Next_Week_Status} = 'Passive', NOT({No_Spam}))",
            view: "Grid view"
        }).all();

        console.log(`👥 Found ${records.length} passive users with Telegram IDs.`);

        let sentCount = 0;
        let skippedCount = 0;

        for (const record of records) {
            const name = record.get('Name');
            const userTgId = record.get('Tg_ID');

            // Test Mode Filter
            if (isTest && userTgId !== TEST_ID) {
                // Skip non-test users in test mode
                continue;
            }

            console.log(`👉 Processing: ${name} (${userTgId})`);

            if (isDryRun) {
                console.log(`   [DRY RUN] Would send message to ${userTgId}`);
                sentCount++;
                continue;
            }

            try {
                // Send Message
                await telegram.sendMessage(userTgId, "👋 Hey! Do you want to participate in Linked.Coffee next week?", {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Yes! I’m in! ☕️", callback_data: "participate_yes" },
                            ],
                            [
                                { text: "No, I’ll skip this week.", callback_data: "participate_no" }
                            ]
                        ]
                    }
                });
                console.log(`   ✅ Message sent to ${userTgId}`);
                sentCount++;
            } catch (err) {
                console.error(`   ❌ Failed to send to ${userTgId}:`, err.message);
                skippedCount++;
            }

            // Small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n🎉 Finished!`);
        console.log(`   Sent: ${sentCount}`);
        console.log(`   Failed/Skipped: ${skippedCount}`);

    } catch (error) {
        console.error('❌ Script Error:', error);
    }
}

run();
