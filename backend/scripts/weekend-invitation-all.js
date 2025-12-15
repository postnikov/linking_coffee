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
 *   --dry-run               : Log actions without sending messages
 *   --test                  : Send ALL messages to ADMIN_CHAT_ID (no DB status update)
 *   --max-notifications=N   : Limit processing to N users
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

// Parse Max Notifications Flag
const args = process.argv.slice(2);
const maxArg = args.find(arg => arg.startsWith('--max-notifications='));
const MAX_MESSAGES_TO_PROCESS = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (IS_TEST_MODE && !ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID required for test mode (check .env).');
    process.exit(1);
}

async function run() {
    console.log(`🚀 Starting Weekend Invitation (All) Script`);
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${IS_TEST_MODE ? `ON (All to Admin ${ADMIN_CHAT_ID})` : 'OFF'}`);
    if (MAX_MESSAGES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MESSAGES_TO_PROCESS} messages`);

    try {
        console.log('📡 Fetching users from Airtable...');
        // Filter: Has Tg_ID, NOT({No_Spam}), {Consent_GDPR}, NOT({Weekend_Notification_Sent})
        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
            filterByFormula: "AND({Tg_ID} != '', NOT({No_Spam}), {Consent_GDPR}, NOT({Weekend_Notification_Sent}))",
            view: "Grid view"
        }).all();

        console.log(`👥 Found ${records.length} eligible users.`);

        let sentCount = 0;
        let skippedCount = 0;
        let processedCount = 0;

        for (const record of records) {
            if (processedCount >= MAX_MESSAGES_TO_PROCESS) {
                 console.log(`🛑 Limit of ${MAX_MESSAGES_TO_PROCESS} reached.`);
                 break;
            }

            const name = record.fields.Name || 'Member';
            const userTgId = record.fields.Tg_ID;
            const nextWeekStatus = record.fields.Next_Week_Status; // Active or Passive

            // In new test mode logic, we DO NOT filter by status. We process everyone but redirect.
            // if (IS_TEST_MODE && status !== 'Admin') continue; // REMOVED

            // Determine Recipient
            let targetId = userTgId;
            let messagePrefix = '';
            
            if (IS_TEST_MODE) {
                targetId = ADMIN_CHAT_ID;
                messagePrefix = `[TEST MODE - Original Reicipient: ${name}]\n\n`;
            }

            // Determine Message Based on Status
            let message = "";
            if (nextWeekStatus === 'Active') {
                message = `${messagePrefix}☕️↔☕️
Hello, ${name} 
New week is starting!

🟢 Tomorrow you will get your new match from Linked Coffee.
If you want to skip the week — just press the button below.

See you 💜`;
            } else {
                // Passive (or undefined/other)
                message = `${messagePrefix}☕️↔☕️
Hello, ${name} 
New week is starting!

Do you want to participate in the Linked Coffee this week?
Your current status: ❌ I'll skip the week.

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
                console.log(`   [DRY RUN] Would send to ${name} (Target: ${targetId}) [Status: ${nextWeekStatus || 'None'}]`);
                // console.log(message); 
                processedCount++;
                sentCount++;
                continue;
            }

            try {
                await bot.telegram.sendMessage(targetId, message, keyboard);
                console.log(`   ✅ Sent to ${IS_TEST_MODE ? `ADMIN for ${name}` : name} (${targetId})`);
                
                // Mark as sent - ONLY if NOT IN TEST MODE (or maybe we want to test status update too? User said "Rebuild --test... sends to Admin". Usually updating status invalidates real user data).
                // I will skip status update in test mode logic to be safe.
                if (!IS_TEST_MODE) {
                    try {
                        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
                            id: record.id,
                            fields: {
                                'Weekend_Notification_Sent': true
                            }
                        }]);
                        console.log(`      marked as sent`);
                    } catch (updateErr) {
                        console.error(`      ❌ Failed to mark as sent:`, updateErr.message);
                    }
                } else {
                     console.log(`      [TEST] Would mark as sent (skipped)`);
                }
                
                sentCount++;
            } catch (err) {
                console.error(`   ❌ Failed to send to ${name} (${targetId}):`, err.message);
                skippedCount++;
            }
            
            processedCount++;

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
