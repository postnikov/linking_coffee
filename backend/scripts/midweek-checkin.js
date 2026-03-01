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
const { logMessage } = require('../utils/logger');
const { sendCriticalAlert, sendWarningAlert } = require('../utils/alerting');

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

const MEMBERS_TABLE_ID = 'tblCrnbDupkzWUx9P';

const MESSAGES = {
    En: {
        greeting: "Hey there 👋",
        body: (partnerLink) => `How is your Coffee going? \nHave you met with your partner already? \nPartner: ${partnerLink}\n\nOr maybe you've scheduled the meeting? \nJust press the button below to answer:`,
        btn_met: 'We met ✅',
        btn_scheduled: 'We scheduled 📆',
        btn_fail: 'Something went wrong 😔',
        partner_default: 'your partner'
    },
    Ru: {
        greeting: "Привет 👋",
        body: (partnerLink) => `Как успехи с Linked.Coffee? \nУже удалось встретиться с партнером? \nПартнер: ${partnerLink}\n\nИли вы пока только договорились о встрече? \nНажми кнопку ниже, чтобы ответить:`,
        btn_met: 'Мы встретились ✅',
        btn_scheduled: 'Договорились 📆',
        btn_fail: 'Не получилось 😔',
        partner_default: 'твоим партнером'
    }
};

async function getMemberLanguage(memberId) {
    if (!memberId) return 'En';
    try {
        const record = await base(MEMBERS_TABLE_ID).find(memberId);
        const lang = record.fields['Notifications_Language'];
        // Default to English if not 'Ru' (safe fallback)
        return (lang === 'Ru') ? 'Ru' : 'En';
    } catch (error) {
        console.error(`Error fetching language for member ${memberId}:`, error.message);
        return 'En';
    }
}

async function sendFeedbackRequests() {
    console.log(`Starting feedback request script...`);
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${IS_TEST_MODE ? `ON (All to Admin ${ADMIN_CHAT_ID})` : 'OFF'}`);
    if (MAX_MATCHES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MATCHES_TO_PROCESS} matches`);

    const mondayDate = getMonday(new Date());
    // Format date in local time to avoid UTC shift issues (e.g. midnight becoming previous day)
    const year = mondayDate.getFullYear();
    const month = String(mondayDate.getMonth() + 1).padStart(2, '0');
    const day = String(mondayDate.getDate()).padStart(2, '0');
    const weekStartStr = `${year}-${month}-${day}`;
    console.log(`Targeting matches for week starting: ${weekStartStr}`);

    try {
        // Fetch matches for the current week that haven't been checked in yet
        const matches = await base('tblx2OEN5sSR1xFI2').select({
            filterByFormula: `AND(IS_SAME({Week_Start}, "${weekStartStr}", 'day'), NOT({Midweek_Checkin}))`
        }).all();

        console.log(`Found ${matches.length} matches to process.`);

        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;

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

            // Fetch languages (Member1 and Member2 are arrays of IDs)
            const m1Id = match.fields['Member1'] ? match.fields['Member1'][0] : null;
            const m1Lang = await getMemberLanguage(m1Id);

            const m2Id = match.fields['Member2'] ? match.fields['Member2'][0] : null;
            const m2Lang = await getMemberLanguage(m2Id);

            // Send to Member 1
            const sent1 = await sendToMember(matchId, 1, m1TgId, m1Id, m1Username, m2Username, m1Lang);
            if (sent1 === true) successCount++; else if (sent1 === false) failCount++;

            // Send to Member 2
            const sent2 = await sendToMember(matchId, 2, m2TgId, m2Id, m2Username, m1Username, m2Lang);
            if (sent2 === true) successCount++; else if (sent2 === false) failCount++;

            // Update match record to mark as checked in — only if both sends succeeded
            // Logic: Not Dry Run AND Not Test Mode (to preserve real state)
            if (!IS_DRY_RUN && !IS_TEST_MODE) {
                if (sent1 !== false && sent2 !== false) {
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
                } else {
                    console.log(`Skipping mark for ${matchId}: send results m1=${sent1}, m2=${sent2}`);
                }
            } else if (IS_TEST_MODE) {
                console.log(`[TEST] Would mark match ${matchId} as checked in (Skipped)`);
            }

            processedCount++;
        }

        console.log('Finished processing all matches.');
        console.log(`📊 Summary: ${successCount} sent, ${failCount} failed`);

        // Alert admin if there were notable failures
        const totalAttempts = successCount + failCount;
        const failRate = totalAttempts > 0 ? (failCount / totalAttempts * 100) : 0;

        if (failCount > 0 && !IS_DRY_RUN && !IS_TEST_MODE) {
            const summary =
                `Script: midweek-checkin\n` +
                `Matches processed: ${processedCount}\n` +
                `Messages failed: ${failCount}/${totalAttempts} (${failRate.toFixed(1)}%)\n` +
                `Messages sent: ${successCount}`;

            if (failCount >= 5 && failRate >= 30) {
                await sendCriticalAlert('Midweek Check-in — Delivery Failures', summary);
                process.exit(1);
            } else if (failCount >= 3 || failRate >= 20) {
                await sendWarningAlert('Midweek Check-in — Partial Failures', summary);
            }
        }

    } catch (error) {
        console.error('Error in sendFeedbackRequests:', error);
    }
}

async function sendToMember(matchId, role, memberTgId, memberId, memberUsername, partnerUsername, language = 'En') {
    if (!memberTgId) {
        console.log(`No Telegram ID for Member ${role} in match ${matchId}. Skipping.`);
        return true; // Skip is not a failure
    }

    const t = MESSAGES[language] || MESSAGES.En;

    const partnerLink = partnerUsername
        ? `https://linked.coffee/profile/${cleanUsername(partnerUsername)}`
        : t.partner_default;

    let messagePrefix = '';
    let targetId = memberTgId;

    if (IS_TEST_MODE) {
        targetId = ADMIN_CHAT_ID;
        messagePrefix = `[TEST MODE - Original Reicipient: ${memberTgId} (${language})]\n\n`;
    }

    const message = `${messagePrefix}${t.greeting}

${t.body(partnerLink)}`;

    // Include language in callback data for localized follow-up messages
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(t.btn_met, `fb_stat:${matchId}:${role}:Met:${language}`),
            Markup.button.callback(t.btn_scheduled, `fb_stat:${matchId}:${role}:Scheduled:${language}`)
        ],
        [
            Markup.button.callback(t.btn_fail, `fb_stat:${matchId}:${role}:Fail:${language}`)
        ]
    ]);

    if (IS_DRY_RUN) {
        await logMessage({
            scriptName: 'midweek-checkin',
            memberId: memberId,
            status: 'Dry Run',
            content: message,
            matchId: matchId,
            tgUsername: memberUsername,
            tgId: memberTgId
        });
        return true;
    }

    try {
        await bot.telegram.sendMessage(targetId, message, keyboard);
        await logMessage({
            scriptName: 'midweek-checkin',
            memberId: memberId,
            status: 'Sent',
            content: message,
            matchId: matchId,
            tgUsername: memberUsername,
            tgId: memberTgId
        });
        // Delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
    } catch (error) {
        await logMessage({
            scriptName: 'midweek-checkin',
            memberId: memberId,
            status: 'Failed',
            content: message,
            matchId: matchId,
            error: error.message,
            tgUsername: memberUsername,
            tgId: memberTgId
        });
        return false;
    }
}

sendFeedbackRequests();
