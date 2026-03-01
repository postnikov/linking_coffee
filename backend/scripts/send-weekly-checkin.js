/**
 * Send Weekly Check-in Script
 * 
 * This script sends a "coffee chat" invitation to all eligible members (Consent_GDPR=true + Tg_ID exists).
 * 
 * Usage:
 *   node backend/scripts/send-weekly-checkin.js [flags]
 * 
 * Flags:
 *   --dry-run               : Run the script without sending real messages. Logs actions to console.
 *   --test                  : Run in test mode. Sends ALL messages to ADMIN_CHAT_ID with prefix.
 *   --max-notifications=N   : Limit processing to the first N users.
 * 
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 *   - BOT_TOKEN
 *   - ADMIN_CHAT_ID (Required for --test)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');
const { sendCriticalAlert, sendWarningAlert } = require('../utils/alerting');

// Configuration
const BATCH_SIZE = 20; // Telegram has limits, good to batch
const DELAY_BETWEEN_BATCHES = 1000; // ms

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTestMode = args.includes('--test');

// Parse Max Notifications Flag
const maxArg = args.find(arg => arg.startsWith('--max-notifications='));
const MAX_MESSAGES_TO_PROCESS = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

console.log('--- Weekly Check-in Script ---');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Target: ${isTestMode ? `TEST (All to Admin ${ADMIN_CHAT_ID})` : 'ALL USERS'}`);
if (MAX_MESSAGES_TO_PROCESS !== Infinity) console.log(`Limit: ${MAX_MESSAGES_TO_PROCESS} messages`);

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !process.env.BOT_TOKEN || (isTestMode && !ADMIN_CHAT_ID)) {
    console.error('❌ Missing environment variables (check .env). ADMIN_CHAT_ID required for test mode.');
    process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Initialize Bot
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN);
const bot = new Telegraf(botToken);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    try {
        console.log('Fetching members...');

        let allMembers = [];

        // Fetch all members with a Tg_ID AND Consent_GDPR
        await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
            filterByFormula: "AND(NOT({Tg_ID} = ''), {Consent_GDPR})",
            view: "Grid view"
        }).eachPage((records, fetchNextPage) => {
            allMembers = allMembers.concat(records);
            fetchNextPage();
        });

        console.log(`Found ${allMembers.length} members with Telegram IDs.`);

        // In new test mode logic, we DO NOT filter down to admins. We take everyone (or up to limit), but redirect messages.
        let targets = allMembers;

        let successCount = 0;
        let failCount = 0;
        let processedCount = 0;

        // Process in batches
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            // Check global limit before starting batch (optimization)
            if (processedCount >= MAX_MESSAGES_TO_PROCESS) break;

            const batch = targets.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

            const promises = batch.map(async (record) => {
                if (processedCount >= MAX_MESSAGES_TO_PROCESS) return; // Skip if limit hit inside batch run (race condition possible but mostly fine for script)

                const tgId = record.fields.Tg_ID;
                const name = record.fields.Name || 'there';

                // Determine recipient and text based on mode
                let targetId = tgId;
                let messagePrefix = '';

                if (isTestMode) {
                    targetId = ADMIN_CHAT_ID;
                    messagePrefix = `[TEST MODE - Original Recipient: ${name}]\n\n`;
                }

                const messageText = `${messagePrefix}👋 Hey ${name}!\n\nAre you up for a coffee chat next week? ☕️\n\nClick the button below to confirm your participation.`;

                if (isDryRun) {
                    console.log(`[DRY RUN] Would send to ${isTestMode ? 'ADMIN' : name} (${targetId}):\n${messageText}`);
                    processedCount++;
                    return true;
                }

                // Double check processed count atomicity if needed, but for simple script map is fine.
                // We increment processedCount at start or end? 
                // Let's increment after send attempt.
                
                try {
                    await bot.telegram.sendMessage(
                        targetId,
                        messageText,
                        Markup.inlineKeyboard([
                            Markup.button.callback("I'm in! 🙋‍♂️", 'participate_next_week')
                        ])
                    );
                    console.log(`✅ Sent to ${isTestMode ? `ADMIN (for ${name})` : name} (${targetId})`);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to send to ${name} (${targetId}):`, error.message);
                    failCount++;
                }
                processedCount++;
            });

            await Promise.all(promises);
            
            if (processedCount >= MAX_MESSAGES_TO_PROCESS) {
                 console.log(`🛑 Limit of ${MAX_MESSAGES_TO_PROCESS} reached.`);
                 break;
            }

            if (i + BATCH_SIZE < targets.length) {
                await sleep(DELAY_BETWEEN_BATCHES);
            }
        }

        console.log('--- Summary ---');
        console.log(`Total processed: ${processedCount}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);

        // Alert admin if there were notable failures
        const totalAttempts = successCount + failCount;
        const failRate = totalAttempts > 0 ? (failCount / totalAttempts * 100) : 0;

        if (failCount > 0 && !isDryRun && !isTestMode) {
            const summary =
                `Script: send-weekly-checkin\n` +
                `Messages failed: ${failCount}/${totalAttempts} (${failRate.toFixed(1)}%)\n` +
                `Messages sent: ${successCount}`;

            if (failCount >= 5 && failRate >= 30) {
                await sendCriticalAlert('Weekly Check-in — Delivery Failures', summary);
                process.exit(1);
            } else if (failCount >= 3 || failRate >= 20) {
                await sendWarningAlert('Weekly Check-in — Partial Failures', summary);
            }
        }

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

run();
