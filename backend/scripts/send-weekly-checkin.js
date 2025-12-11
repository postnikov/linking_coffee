/**
 * Send Weekly Check-in Script
 * 
 * This script sends a "coffee chat" invitation to all eligible members (Consent_GDPR=true + Tg_ID exists).
 * 
 * Usage:
 *   node backend/scripts/send-weekly-checkin.js [flags]
 * 
 * Flags:
 *   --dry-run   : Run the script without sending real messages. Logs actions to console.
 *   --test      : Run in test mode (only sends to users with Status='Admin').
 * 
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 *   - BOT_TOKEN (or ADMIN_BOT_TOKEN in dev)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');

// Configuration
const BATCH_SIZE = 20; // Telegram has limits, good to batch
const DELAY_BETWEEN_BATCHES = 1000; // ms

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTestMode = args.includes('--test');

console.log('--- Weekly Check-in Script ---');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Target: ${isTestMode ? 'TEST (Admins only)' : 'ALL USERS'}`);

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !process.env.BOT_TOKEN) {
    console.error('❌ Missing environment variables. Please check .env file.');
    process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Initialize Bot
const botToken = process.env.NODE_ENV === 'production' ? process.env.BOT_TOKEN : (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN);
console.log(`🤖 Using Bot Token: ${botToken ? '...' + botToken.slice(-4) : 'UNDEFINED'}`);
const bot = new Telegraf(botToken);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    try {
        console.log('Fetching members...');

        let allMembers = [];

        // Fetch all members with a Tg_ID AND Consent_GDPR
        await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
            filterByFormula: "AND(NOT({Tg_ID} = ''), {Consent_GDPR})",
            view: "Grid view" // Optional, but good practice
        }).eachPage((records, fetchNextPage) => {
            allMembers = allMembers.concat(records);
            fetchNextPage();
        });

        console.log(`Found ${allMembers.length} members with Telegram IDs.`);

        // Filter for test mode if needed
        let targets = allMembers;
        if (isTestMode) {
            targets = allMembers.filter(r => r.fields.Status === 'Admin');
            console.log(`Filtered down to ${targets.length} test user(s) (Admins).`);
        }

        let successCount = 0;
        let failCount = 0;

        // Process in batches
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const batch = targets.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

            const promises = batch.map(async (record) => {
                const tgId = record.fields.Tg_ID;
                const name = record.fields.Name || 'there';

                if (isDryRun) {
                    console.log(`[DRY RUN] Would send to ${name} (${tgId})`);
                    return true;
                }

                try {
                    await bot.telegram.sendMessage(
                        tgId,
                        `👋 Hey ${name}!\n\nAre you up for a coffee chat next week? ☕️\n\nClick the button below to confirm your participation.`,
                        Markup.inlineKeyboard([
                            Markup.button.callback("I'm in! 🙋‍♂️", 'participate_next_week')
                        ])
                    );
                    console.log(`✅ Sent to ${name} (${tgId})`);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to send to ${name} (${tgId}):`, error.message);
                    failCount++;
                }
            });

            await Promise.all(promises);

            if (i + BATCH_SIZE < targets.length) {
                await sleep(DELAY_BETWEEN_BATCHES);
            }
        }

        console.log('--- Summary ---');
        console.log(`Total processed: ${targets.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

run();
