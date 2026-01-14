/**
 * Broadcast Message Script
 * 
 * Sends a custom message to a specific group of users.
 * 
 * Usage:
 *   node backend/scripts/broadcast-message.js --target=[all|admins|unmatched|matched] [--dry-run] [--test] [--max-notifications=N]
 * 
 * Targets:
 *   - all       : All users with Consent_GDPR checked and a Telegram ID.
 *   - admins    : Users with Status='Admin'.
 *   - unmatched : Active users who do NOT have a match for the current week.
 *   - matched   : Users who HAVE a match for the current week.
 * 
 * Configuration:
 *   - Message content is defined in the MESSAGE_TEXT constant below.
 *   - .env params: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, BOT_TOKEN
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf } = require('telegraf');

// --- CONFIGURATION ---
const MESSAGE_TEXT = `
Привет! 👋
Это Linked.Coffee 🤖 робот.

Целую неделю мы были на каникулах. 
Не пили кофе. Перезаряжали социальные батарейки. 
Но теперь мы вернулись!

Спасибо тебе что, ты с нами и веришь в проект. 
В этом году все новые фичи для тебя будут всегда бесплатными.
ИИ мэтчинг, умные алгоритмы, и всё такое.
С новым годом кстати 🎄

Скоро ты получишь сообщение про следующую неделю.
Надеюсь, ты решишь участвовать 😉.

И главное - по любым вопросам с проетом сразу смело пиши Максу @max_postnikov.

Обнимаю! 🤗
Твой Linked Coffee Робот.
`;

// --- SETUP ---
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !process.env.BOT_TOKEN) {
    console.error('❌ Missing environment variables. Check .env file.');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const bot = new Telegraf(process.env.BOT_TOKEN);
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From schema

// --- ARGS ---
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTestMode = args.includes('--test');
const targetArg = args.find(a => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : null;

// Parse Max Notifications Flag
const maxArg = args.find(arg => arg.startsWith('--max-notifications='));
const MAX_MESSAGES_TO_PROCESS = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
if (isTestMode && !ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID required for test mode (check .env).');
    process.exit(1);
}

// --- HELPERS ---
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// --- LOGIC ---
async function getRecipients() {
    console.log(`🔍 Fetching recipients for target: ${target}`);

    if (target === 'admins') {
        const records = await base(MEMBERS_TABLE).select({
            filterByFormula: "AND({Status} = 'Admin', {Tg_ID} != '')"
        }).all();
        return records;
    }

    if (target === 'all') {
        const records = await base(MEMBERS_TABLE).select({
            filterByFormula: "AND({Consent_GDPR}, {Tg_ID} != '')"
        }).all();
        return records;
    }

    if (target === 'matched') {
        // 1. Get current week Monday
        const monday = getMonday(new Date());
        const weekStartStr = formatDate(monday);
        console.log(`   Checking matches for week: ${weekStartStr}`);

        // 2. Get matches for this week
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `IS_SAME({Week_Start}, "${weekStartStr}", 'day')`
        }).all();
        console.log(`   Found ${matches.length} matches records.`);

        // 3. Extract IDs of matched people
        const matchedIds = new Set();
        matches.forEach(m => {
            if (m.fields.Member1) matchedIds.add(m.fields.Member1[0]);
            if (m.fields.Member2) matchedIds.add(m.fields.Member2[0]);
        });
        console.log(`   Found ${matchedIds.size} unique matched users.`);

        // 4. Get all members relevant for messaging
        const allMembers = await base(MEMBERS_TABLE).select({
            filterByFormula: "AND({Consent_GDPR}, {Tg_ID} != '')"
        }).all();

        // 5. Filter for only matched members
        const matchedMembers = allMembers.filter(m => matchedIds.has(m.id));
        return matchedMembers;
    }

    if (target === 'unmatched') {
        // 1. Get current week Monday
        const monday = getMonday(new Date());
        const weekStartStr = formatDate(monday);
        console.log(`   Checking matches for week: ${weekStartStr}`);

        // 2. Get active members (those who WANTED a match)
        const activeMembers = await base(MEMBERS_TABLE).select({
            filterByFormula: "AND({Next_Week_Status} = 'Active', {Consent_GDPR}, {Tg_ID} != '')"
        }).all();
        console.log(`   Found ${activeMembers.length} active members.`);

        // 3. Get matches for this week
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `IS_SAME({Week_Start}, "${weekStartStr}", 'day')`
        }).all();
        console.log(`   Found ${matches.length} matches records.`);

        // 4. Extract IDs of matched people
        const matchedIds = new Set();
        matches.forEach(m => {
            if (m.fields.Member1) matchedIds.add(m.fields.Member1[0]);
            if (m.fields.Member2) matchedIds.add(m.fields.Member2[0]);
        });

        // 5. Filter active members who are NOT in matchedIds
        const unmatched = activeMembers.filter(m => !matchedIds.has(m.id));
        return unmatched;
    }

    throw new Error(`Unknown target '${target}'. Please use --target=all|admins|unmatched|matched`);
}

async function run() {
    if (!target) {
        console.error('❌ Please specify a target using --target=all|admins|unmatched');
        process.exit(1);
    }

    console.log(`🚀 Starting Broadcast Script`);
    console.log(`   Target: ${target}`);
    console.log(`   Dry Run: ${isDryRun}`);
    console.log(`   Test Mode: ${isTestMode ? `ON (All to Admin ${ADMIN_CHAT_ID})` : 'OFF'}`);
    if (MAX_MESSAGES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MESSAGES_TO_PROCESS} messages`);
    console.log(`   Message Length: ${MESSAGE_TEXT.length} chars`);

    try {
        const recipients = await getRecipients();
        console.log(`✅ Found ${recipients.length} recipients.`);

        let success = 0;
        let fail = 0;
        let processedCount = 0;

        for (const recipient of recipients) {
            if (processedCount >= MAX_MESSAGES_TO_PROCESS) {
                console.log(`🛑 Limit of ${MAX_MESSAGES_TO_PROCESS} reached.`);
                break;
            }

            const name = recipient.fields.Name || 'User';
            const tgId = recipient.fields.Tg_ID;

            if (!tgId) continue;

            let targetId = tgId;
            let message = MESSAGE_TEXT;

            if (isTestMode) {
                targetId = ADMIN_CHAT_ID;
                message = `[TEST MODE - Original Reicipient: ${name}]\n\n${MESSAGE_TEXT}`;
            }

            if (isDryRun) {
                console.log(`   [DRY RUN] Would send to ${isTestMode ? `ADMIN for ${name}` : name} (${targetId})`);
                success++;
                processedCount++;
                continue;
            }

            try {
                await bot.telegram.sendMessage(targetId, message);
                console.log(`   ✅ Sent to ${isTestMode ? `ADMIN for ${name}` : name} (${targetId})`);
                success++;
                // Small pause to be nice to API
                await new Promise(r => setTimeout(r, 50));
            } catch (e) {
                console.error(`   ❌ Failed to send to ${name} (${targetId}): ${e.message}`);
                fail++;
            }

            processedCount++;
        }

        console.log('\n🏁 Done!');
        console.log(`   Success: ${success}`);
        console.log(`   Failed: ${fail}`);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
