/**
 * Broadcast Message Script
 * 
 * Sends a custom message to a specific group of users.
 * 
 * Usage:
 *   node backend/scripts/broadcast-message.js --target=[all|admins|unmatched|matched] [--dry-run]
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

Слушай, тут такое дело.
В сообщениях о партнерах была ошибка. 
Я уже ее исправил. И даже старые сообщения теперь работают. 
Прости, что не заметил этот баг раньше.

Хорошего тебе кофе!
Обнимаю! 🤗
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
const targetArg = args.find(a => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : null;

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
    console.log(`   Message Length: ${MESSAGE_TEXT.length} chars`);

    try {
        const recipients = await getRecipients();
        console.log(`✅ Found ${recipients.length} recipients.`);

        let success = 0;
        let fail = 0;

        for (const recipient of recipients) {
            const name = recipient.fields.Name;
            const tgId = recipient.fields.Tg_ID;

            if (!tgId) continue;

            if (isDryRun) {
                console.log(`   [DRY RUN] Would send to ${name} (${tgId})`);
                success++; // Count as success for dry run stats
                continue;
            }

            try {
                await bot.telegram.sendMessage(tgId, MESSAGE_TEXT);
                console.log(`   ✅ Sent to ${name} (${tgId})`);
                success++;
                // Small pause to be nice to API
                await new Promise(r => setTimeout(r, 50));
            } catch (e) {
                console.error(`   ❌ Failed to send to ${name} (${tgId}): ${e.message}`);
                fail++;
            }
        }

        console.log('\n🏁 Done!');
        console.log(`   Success: ${success}`);
        console.log(`   Failed: ${fail}`);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
