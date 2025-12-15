/**
 * Midweek Feedback Script
 * -------------------
 * This script sends "Have you met yet?" feedback notifications to all matched users for the current week.
 *
 * Usage:
 *   node backend/scripts/midweek-checkin.js [options]
 *
 * Options:
 *   --dry-run               : Log actions without sending messages
 *   --test                  : Send ALL messages to ADMIN_CHAT_ID (no DB update)
 *   --max-notifications=N   : Limit processing to N matches
 *
 * Examples:
 *   node backend/scripts/midweek-checkin.js --dry-run
 *   node backend/scripts/midweek-checkin.js --test
 *   node backend/scripts/midweek-checkin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');

// Initialize Airtable
// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Initialize Telegram Bot
// ALWAYS using Production Bot as per user request
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    console.error('Error: BOT_TOKEN is missing in .env');
    process.exit(1);
}
const bot = new Telegraf(botToken);

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Parse Max Notifications Flag
const args = process.argv.slice(2);
const maxArg = args.find(arg => arg.startsWith('--max-notifications='));
const MAX_MATCHES_TO_PROCESS = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

const IS_DRY_RUN = args.includes('--dry-run');
const IS_TEST_MODE = args.includes('--test');

if (IS_TEST_MODE && !ADMIN_CHAT_ID) {
    console.error('❌ ADMIN_CHAT_ID required for test mode (check .env).');
    process.exit(1);
}

// Helper to get Monday of the current week
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Helper to clean username
const cleanUsername = (username) => {
    if (!username) return 'unknown';
    return username.replace('@', '').trim();
};

async function sendFeedbackRequests() {
    console.log(`Starting feedback request script...`);
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${IS_TEST_MODE ? `ON (All to Admin ${ADMIN_CHAT_ID})` : 'OFF'}`);
    if (MAX_MATCHES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MATCHES_TO_PROCESS} matches`);

    const mondayDate = getMonday(new Date());
    const weekStartStr = mondayDate.toISOString().split('T')[0];
    console.log(`Targeting matches for week starting: ${weekStartStr}`);

    try {
        // Fetch matches for the current week that haven't been checked in yet
        const matches = await base('tblx2OEN5sSR1xFI2').select({
            filterByFormula: `AND(IS_SAME({Week_Start}, "${weekStartStr}", 'day'), NOT({Midweek_Checkin}))`
        }).all();

        console.log(`Found ${matches.length} matches to process.`);

        let processedCount = 0;

        for (const match of matches) {
            if (processedCount >= MAX_MATCHES_TO_PROCESS) {
                 console.log(`🛑 Limit of ${MAX_MATCHES_TO_PROCESS} reached.`);
                 break;
            }

            const matchId = match.id;
            
            // Fetch member details
            const m1TgId = match.fields['Tg_ID (from Member1)'] ? match.fields['Tg_ID (from Member1)'][0] : null;
            const m1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : null;

            const m2TgId = match.fields['Tg_ID (from Member2)'] ? match.fields['Tg_ID (from Member2)'][0] : null;
            const m2Username = match.fields['Tg_Username (from Member2)'] ? match.fields['Tg_Username (from Member2)'][0] : null;

            // Send to Member 1
            await sendToMember(matchId, 1, m1TgId, m2Username);

            // Send to Member 2
            await sendToMember(matchId, 2, m2TgId, m1Username);

            // Update match record to mark as checked in
            // Logic: Not Dry Run AND Not Test Mode (to preserve real state)
            if (!IS_DRY_RUN && !IS_TEST_MODE) {
                try {
                    await base('tblx2OEN5sSR1xFI2').update([{
                        id: matchId,
                        fields: {
                            'Midweek_Checkin': true
                        }
                    }]);
                    console.log(`Marked match ${matchId} as checked in.`);
                } catch (err) {
                    console.error(`Failed to mark match ${matchId} as checked in:`, err);
                }
            } else if (IS_TEST_MODE) {
                 console.log(`[TEST] Would mark match ${matchId} as checked in (Skipped)`);
            }
            
            processedCount++;
        }

        console.log('Finished processing all matches.');

    } catch (error) {
        console.error('Error in sendFeedbackRequests:', error);
    }
}

async function sendToMember(matchId, role, memberTgId, partnerUsername) {
    if (!memberTgId) {
        console.log(`No Telegram ID for Member ${role} in match ${matchId}. Skipping.`);
        return;
    }

    const partnerLink = partnerUsername
        ? `https://linked.coffee/profile/${cleanUsername(partnerUsername)}`
        : 'your partner';

    let messagePrefix = '';
    let targetId = memberTgId;
    
    if (IS_TEST_MODE) {
        targetId = ADMIN_CHAT_ID;
        messagePrefix = `[TEST MODE - Original Reicipient: ${memberTgId}]\n\n`;
    }

    const message = `${messagePrefix}Hey there 👋

How is your Coffee going? 
Have you met with your partner already? 
Partner: ${partnerLink}

Or maybe you've scheduled the meeting? 
Just press the button below to answer:`;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('We met ✅', `fb_stat:${matchId}:${role}:Met`),
            Markup.button.callback('We scheduled 📆', `fb_stat:${matchId}:${role}:Scheduled`)
        ],
        [
            Markup.button.callback('Something went wrong 😔', `fb_stat:${matchId}:${role}:Fail`)
        ]
    ]);

    if (IS_DRY_RUN) {
        console.log(`[DRY RUN] Would send to ${IS_TEST_MODE ? `ADMIN for ${memberTgId}` : memberTgId} (Role ${role}):`);
        console.log(message);
        return;
    }

    try {
        await bot.telegram.sendMessage(targetId, message, keyboard);
        console.log(`Sent feedback request to Member ${role} (Target: ${targetId}) for match ${matchId}`);
        // Delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
        console.error(`Failed to send to Member ${role} (Target: ${targetId}):`, error.message);
    }
}

sendFeedbackRequests();
