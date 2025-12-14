/**
 * Weekend Invitation Script (All Users)
 *
 * This script sends weekly check-in messages to ALL users (Active and Passive)
 * who have consented to GDPR and have not opted out of spam.
 *
 * Logic:
 * - Targets: All users with Consent_GDPR=true AND No_Spam=unchecked AND Tg_ID exists.
 * - Message Content varies by current status (Active vs Passive).
 * - Buttons are the same for everyone: "Yes, I'm in" and "No, I'll skip".
 *
 * Usage:
 *   node backend/scripts/weekend-invitation-all.js [options]
 *
 * Options:
 *   --dry-run   : Log actions without sending messages
 *   --test      : Send only to Admins
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Initialize Telegram Bot
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    console.error('Error: BOT_TOKEN is missing in .env');
    process.exit(1);
}
const bot = new Telegraf(botToken);

const IS_DRY_RUN = process.argv.includes('--dry-run');
const IS_TEST_MODE = process.argv.includes('--test');

async function run() {
    console.log(`🚀 Starting Weekend Invitation (All) Script`);
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${IS_TEST_MODE ? 'ON (Target: Admins only)' : 'OFF'}`);

    try {
        console.log('📡 Fetching users from Airtable...');
        // Filter: Has Tg_ID, NOT({No_Spam}), {Consent_GDPR}
        // Note: We do NOT filter by status here, as we target ALL.
        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
            filterByFormula: "AND({Tg_ID} != '', NOT({No_Spam}), {Consent_GDPR})",
            view: "Grid view"
        }).all();

        console.log(`👥 Found ${records.length} eligible users.`);

        let sentCount = 0;
        let skippedCount = 0;

        for (const record of records) {
            const name = record.fields.Name || 'Member';
            const userTgId = record.fields.Tg_ID;
            const status = record.fields.Status;
            const nextWeekStatus = record.fields.Next_Week_Status; // Active or Passive

            // Test Mode Filter
            if (IS_TEST_MODE && status !== 'Admin') {
                continue;
            }

            // Determine Message Based on Status
            let message = "";
            if (nextWeekStatus === 'Active') {
                message = `☕️↔☕️
Hello, ${name} 
New week is starting!

Tomorrow you will get your new match from Linked Coffee.
If you want to skip the week — just press the button below.

See you 💜`;
            } else {
                // Passive (or undefined/other)
                message = `☕️↔☕️
Hello, ${name} 
New week is starting!

Do you want to participate in the Linked Coffee this week?
Just press the button below.

See you 💜`;
            }

            // Buttons (Same for both)
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback("Yes, I'm in ✅", "participate_yes")
                ],
                [
                    Markup.button.callback("No, I'll skip the week 🪫", "participate_no")
                ]
            ]);

            if (IS_DRY_RUN) {
                console.log(`   [DRY RUN] Would send to ${name} (${userTgId}) [Status: ${nextWeekStatus || 'None'}]`);
                // console.log(message); // Uncomment to debug message content
                sentCount++;
                continue;
            }

            try {
                await bot.telegram.sendMessage(userTgId, message, keyboard);
                console.log(`   ✅ Sent to ${name} (${userTgId})`);
                sentCount++;
            } catch (err) {
                console.error(`   ❌ Failed to send to ${name} (${userTgId}):`, err.message);
                skippedCount++;
            }

            // Rate limit delay
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
