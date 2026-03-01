/**
 * Weekend Feedback Script
 * -------------------
 * This script sends "Have you met yet?" feedback notifications to all matched users for the current week.
 *
 * Logic:
 * - Target matches where Weekend_Checkin != Checked AND (Feedback1 is empty OR Feedback2 is empty).
 * - Sends 4 options: 'We met ✅', 'We scheduled 📆', 'We have not met ⭕️', 'Something went wrong 😔'.
 * - 'We have not met ⭕️' -> 'No'
 * - 'Something went wrong 😔' -> 'Fail'
 * - Marks Weekend_Checkin = Checked.
 *
 * Usage:
 *   node backend/scripts/weekend-feedback.js [options]
 *
 * Options:
 *   --dry-run               : Log actions without sending messages
 *   --test                  : Send ALL messages to ADMIN_CHAT_ID (no DB status update)
 *   --max-notifications=N   : Limit processing to N matches
 *   --week-start=YYYY-MM-DD : Target specific week start date (default: current week's Monday)
 *
 * Examples:
 *   node backend/scripts/weekend-feedback.js --dry-run
 *   node backend/scripts/weekend-feedback.js --week-start=2023-10-23
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');
const { logMessage } = require('../utils/logger');
const { sendCriticalAlert, sendWarningAlert } = require('../utils/alerting');

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

const weekStartArg = args.find(arg => arg.startsWith('--week-start='));
const TARGET_WEEK_START = weekStartArg ? weekStartArg.split('=')[1] : null;

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
        question: (partnerName, partnerHandle, partnerLink) => `How was your Linked Coffee this week? \n\nHave you met with your partner ${partnerName} ${partnerHandle}? \nPartner: ${partnerLink}\n\nJust press the button below to answer:`,
        btn_met: 'We met ✅',
        btn_scheduled: 'We scheduled 📆',
        btn_not_met: 'We have not met ⭕️',
        btn_fail: 'Something went wrong 😔',
        partner_default: 'your partner'
    },
    Ru: {
        greeting: "Привет 👋",
        question: (partnerName, partnerHandle, partnerLink) => `Как прошел твой Linked Coffee на этой неделе? \n\nУдалось встретиться с партнером ${partnerName} ${partnerHandle}? \nПартнер: ${partnerLink}\n\nНажми кнопку ниже, чтобы ответить:`,
        btn_met: 'Мы встретились ✅',
        btn_scheduled: 'Договорились 📆',
        btn_not_met: 'Мы не встретились ⭕️',
        btn_fail: 'Что-то пошло не так 😔',
        partner_default: 'твоим партнером'
    }
};

async function getMemberLanguage(memberId) {
    if (!memberId) return 'En';
    try {
        const record = await base(MEMBERS_TABLE_ID).find(memberId);
        const lang = record.fields['Notifications_Language'];
        return (lang === 'Ru') ? 'Ru' : 'En';
    } catch (error) {
        console.error(`Error fetching language for member ${memberId}:`, error.message);
        return 'En';
    }
}

async function sendFeedbackRequests() {
    console.log(`Starting Weekend Feedback script...`);
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Test Mode: ${IS_TEST_MODE ? `ON (All to Admin ${ADMIN_CHAT_ID})` : 'OFF'}`);
    if (MAX_MATCHES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MATCHES_TO_PROCESS} matches`);

    let weekStartStr;
    if (TARGET_WEEK_START) {
        weekStartStr = TARGET_WEEK_START;
        // Validate date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartStr)) {
            console.error('❌ Invalid date format for --week-start. Use YYYY-MM-DD');
            process.exit(1);
        }
    } else {
        const mondayDate = getMonday(new Date());
        const year = mondayDate.getFullYear();
        const month = String(mondayDate.getMonth() + 1).padStart(2, '0');
        const day = String(mondayDate.getDate()).padStart(2, '0');
        weekStartStr = `${year}-${month}-${day}`;
    }
    console.log(`Targeting matches for week starting: ${weekStartStr}`);

    try {
        const matches = await base('tblx2OEN5sSR1xFI2').select({
            filterByFormula: `AND(IS_SAME({Week_Start}, "${weekStartStr}", 'day'), NOT({Weekend_Checkin}))`
        }).all();

        console.log(`Found ${matches.length} potential matches.`);

        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;

        for (const match of matches) {
            if (processedCount >= MAX_MATCHES_TO_PROCESS) {
                console.log(`🛑 Limit of ${MAX_MATCHES_TO_PROCESS} reached.`);
                break;
            }

            const matchId = match.id;
            const f1 = match.fields.Feedback1;
            const f2 = match.fields.Feedback2;
            const isF1Empty = f1 == null;
            const isF2Empty = f2 == null;

            if (!isF1Empty && !isF2Empty) {
                console.log(`Match ${matchId} has both feedbacks. Skipping.`);
                if (!IS_DRY_RUN && !IS_TEST_MODE) await markWeekendChecked(matchId);
                continue;
            }

            const m1TgId = match.fields['Tg_ID (from Member1)'] ? match.fields['Tg_ID (from Member1)'][0] : null;
            const m1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : null;
            const m1Name = match.fields['Name (from Member1)'] ? match.fields['Name (from Member1)'][0] : 'Partner';

            const m2TgId = match.fields['Tg_ID (from Member2)'] ? match.fields['Tg_ID (from Member2)'][0] : null;
            const m2Username = match.fields['Tg_Username (from Member2)'] ? match.fields['Tg_Username (from Member2)'][0] : null;
            const m2Name = match.fields['Name (from Member2)'] ? match.fields['Name (from Member2)'][0] : 'Partner';

            // Fetch languages
            const m1Id = match.fields['Member1'] ? match.fields['Member1'][0] : null;
            const m1Lang = await getMemberLanguage(m1Id);

            const m2Id = match.fields['Member2'] ? match.fields['Member2'][0] : null;
            const m2Lang = await getMemberLanguage(m2Id);

            // Send to Member 1 if Feedback1 is empty
            let sent1 = true;
            if (isF1Empty) {
                sent1 = await sendToMember(matchId, 1, m1TgId, m1Id, m1Username, m2Username, m2Name, m1Lang);
                if (sent1 === true) successCount++; else if (sent1 === false) failCount++;
            }

            // Send to Member 2 if Feedback2 is empty
            let sent2 = true;
            if (isF2Empty) {
                sent2 = await sendToMember(matchId, 2, m2TgId, m2Id, m2Username, m1Username, m1Name, m2Lang);
                if (sent2 === true) successCount++; else if (sent2 === false) failCount++;
            }

            // Mark checked — only if all required sends succeeded
            if (!IS_DRY_RUN && !IS_TEST_MODE) {
                if (sent1 !== false && sent2 !== false) {
                    await markWeekendChecked(matchId);
                } else {
                    console.log(`Skipping weekend mark for ${matchId}: sent1=${sent1}, sent2=${sent2}`);
                }
            } else if (IS_TEST_MODE) {
                console.log(`[TEST] Would mark match ${matchId} as Weekend_Checkin = true (Skipped)`);
            }

            processedCount++;
        }

        console.log(`Finished processing. Sent requests for ${processedCount} matches.`);
        console.log(`📊 Summary: ${successCount} sent, ${failCount} failed`);

        // Alert admin if there were notable failures
        const totalAttempts = successCount + failCount;
        const failRate = totalAttempts > 0 ? (failCount / totalAttempts * 100) : 0;

        if (failCount > 0 && !IS_DRY_RUN && !IS_TEST_MODE) {
            const summary =
                `Script: weekend-feedback\n` +
                `Matches processed: ${processedCount}\n` +
                `Messages failed: ${failCount}/${totalAttempts} (${failRate.toFixed(1)}%)\n` +
                `Messages sent: ${successCount}`;

            if (failCount >= 5 && failRate >= 30) {
                await sendCriticalAlert('Weekend Feedback — Delivery Failures', summary);
                process.exit(1);
            } else if (failCount >= 3 || failRate >= 20) {
                await sendWarningAlert('Weekend Feedback — Partial Failures', summary);
            }
        }

    } catch (error) {
        console.error('Error in sendFeedbackRequests:', error);
    }
}

async function markWeekendChecked(matchId) {
    try {
        await base('tblx2OEN5sSR1xFI2').update([{
            id: matchId,
            fields: {
                'Weekend_Checkin': true
            }
        }]);
        console.log(`Marked match ${matchId} as Weekend_Checkin = true.`);
    } catch (err) {
        console.error(`Failed to mark match ${matchId} as checked in:`, err);
    }
}

async function sendToMember(matchId, role, memberTgId, memberId, memberUsername, partnerUsername, partnerName, language = 'En') {
    if (!memberTgId) {
        console.log(`No Telegram ID for Member ${role} in match ${matchId}. Skipping.`);
        return true; // Skip is not a failure
    }

    const t = MESSAGES[language] || MESSAGES.En;

    const partnerLink = partnerUsername
        ? `https://linked.coffee/profile/${cleanUsername(partnerUsername)}`
        : t.partner_default;

    const cleanPartnerHandle = partnerUsername ? `@${cleanUsername(partnerUsername)}` : '';

    let messagePrefix = '';
    let targetId = memberTgId;

    if (IS_TEST_MODE) {
        targetId = ADMIN_CHAT_ID;
        messagePrefix = `[TEST MODE - Original Reicipient: ${memberTgId} (${language})]\n\n`;
    }

    const message = `${messagePrefix}${t.greeting}
${t.question(partnerName, cleanPartnerHandle, partnerLink)}`;

    // 4 Options - include language in callback data for localized follow-up
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(t.btn_met, `fb_stat:${matchId}:${role}:Met:${language}`),
            Markup.button.callback(t.btn_scheduled, `fb_stat:${matchId}:${role}:Scheduled:${language}`)
        ],
        [
            Markup.button.callback(t.btn_not_met, `fb_stat:${matchId}:${role}:No:${language}`),
            Markup.button.callback(t.btn_fail, `fb_stat:${matchId}:${role}:Fail:${language}`)
        ]
    ]);

    if (IS_DRY_RUN) {
        await logMessage({
            scriptName: 'weekend-feedback',
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
            scriptName: 'weekend-feedback',
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
            scriptName: 'weekend-feedback',
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
