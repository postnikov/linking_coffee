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
 *   --dry-run   : Log actions without sending messages
 *   --test      : Send all messages to the test Admin ID (defined in constant)
 *
 * Examples:
 *   node backend/scripts/weekend-feedback.js --dry-run
 *   node backend/scripts/weekend-feedback.js --test
 *   node backend/scripts/weekend-feedback.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf, Markup } = require('telegraf');

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

const IS_DRY_RUN = process.argv.includes('--dry-run');
const IS_TEST_MODE = process.argv.includes('--test');

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
    console.log(`Starting Weekend Feedback script...`);
    if (IS_DRY_RUN) console.log('DRY RUN MODE: No messages will be sent.');
    if (IS_TEST_MODE) {
        if (!process.env.ADMIN_CHAT_ID) {
            console.error('Error: ADMIN_CHAT_ID not found in .env. Cannot run in test mode.');
            process.exit(1);
        }
        console.log(`TEST MODE: Sending all messages to ADMIN_CHAT_ID (${process.env.ADMIN_CHAT_ID})`);
    }

    const mondayDate = getMonday(new Date());
    const weekStartStr = mondayDate.toISOString().split('T')[0];
    console.log(`Targeting matches for week starting: ${weekStartStr}`);

    try {
        // Fetch matches for the current week that haven't been Weekend-checked yet
        // AND have empty feedback.
        // Airtable formula: AND(IS_SAME({Week_Start}, "date", 'day'), NOT({Weekend_Checkin}))
        // We will filter for empty feedback in code to be safer/simpler or add to formula.
        // Let's filter in code to handle "Feedback1 OR Feedback2" logic per user role more precisely if needed,
        // BUT the requirement says: "their matches have empty Feedback1 or Feedback2" -> maybe implies ANY feedback missing?
        // Let's stick to the requirement: "their matches have empty Feedback1 or Feedback2" logic is applied generally to the MATCH record.
        // But we need to check if the specific USER has given feedback? 
        // Actually, usually feedback is stored per match per user if we have Feedback1 and Feedback2 fields.
        // If Member 1 has given feedback (Feedback1 not empty), maybe we shouldn't bug them?
        // The requirement says: "sends ... to all matched users ... if ... their matches have empty Feedback1 or Feedback2"
        // This usually implies we check if *that specific user* needs to provide feedback.
        // BUT the requirement says "Weekend_Checkin = Checked" is a global flag for the MATCH? Use caution.
        // "Mark Weekend_Checkin = Checked" implies we do it once per match? Or per user?
        // If it's a checkbox on the Match record, it's once per match.
        // Result: logic likely sends to BOTH if the flag is false, then sets flag to true.
        // Re-reading: "sends ... to all matched users ... if their matches don't have Weekend_Checkin = Checked"
        // This implies if we run it, we send to everyone in that match, then mark it checked.
        
        const matches = await base('tblx2OEN5sSR1xFI2').select({
            filterByFormula: `AND(IS_SAME({Week_Start}, "${weekStartStr}", 'day'), NOT({Weekend_Checkin}))`
        }).all();

        console.log(`Found ${matches.length} potential matches.`);

        let processedCount = 0;

        for (const match of matches) {
            const matchId = match.id;
            
            // detailed check for empty feedback (optional based on "and their matches have empty Feedback1 or Feedback2")
            // If the user meant "Send to users who haven't given feedback", logic should be per user.
            // But "Mark Weekend_Checkin = Checked" suggests a batch operation.
            // However, if one user gave feedback but the other didn't, do we spam both?
            // "if ... their matches have empty Feedback1 or Feedback2" -> If EITHER is empty, we process the match?
            // Let's assume we process the match if the flag is unchecked, and within the match, we send to users.
            
            const f1 = match.fields.Feedback1;
            const f2 = match.fields.Feedback2;
            
            // Using loose check for empty/undefined/null
            const isF1Empty = f1 == null; 
            const isF2Empty = f2 == null;

            if (!isF1Empty && !isF2Empty) {
                console.log(`Match ${matchId} has both feedbacks. Skipping (though Weekend_Checkin was false).`);
                // Should we mark it checked? Probably yes to avoid re-checking.
                 if (!IS_DRY_RUN) await markWeekendChecked(matchId);
                continue;
            }

            const member1Id = match.fields.Member1 ? match.fields.Member1[0] : null;
            const member2Id = match.fields.Member2 ? match.fields.Member2[0] : null;

            const m1TgId = match.fields['Tg_ID (from Member1)'] ? match.fields['Tg_ID (from Member1)'][0] : null;
            const m1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : null;
            const m1Name = match.fields['Name (from Member1)'] ? match.fields['Name (from Member1)'][0] : 'Partner';

            const m2TgId = match.fields['Tg_ID (from Member2)'] ? match.fields['Tg_ID (from Member2)'][0] : null;
            const m2Username = match.fields['Tg_Username (from Member2)'] ? match.fields['Tg_Username (from Member2)'][0] : null;
            const m2Name = match.fields['Name (from Member2)'] ? match.fields['Name (from Member2)'][0] : 'Partner';

            // Send to Member 1 if Feedback1 is empty
            if (isF1Empty) {
                await sendToMember(matchId, 1, m1TgId, m2Username, m2Name);
            }

            // Send to Member 2 if Feedback2 is empty
            if (isF2Empty) {
                await sendToMember(matchId, 2, m2TgId, m1Username, m1Name);
            }

            // Mark checked
             if (!IS_DRY_RUN) await markWeekendChecked(matchId);
             processedCount++;
        }

        console.log(`Finished processing. Sent requests for ${processedCount} matches.`);

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

async function sendToMember(matchId, role, memberTgId, partnerUsername, partnerName) {
    if (!memberTgId) {
        console.log(`No Telegram ID for Member ${role} in match ${matchId}. Skipping.`);
        return;
    }

    const partnerLink = partnerUsername
        ? `https://linked.coffee/profile/${cleanUsername(partnerUsername)}`
        : 'your partner';

    const cleanPartnerHandle = partnerUsername ? `@${cleanUsername(partnerUsername)}` : '';

    const message = `Hey there 👋
How was your Coffee this week? 

Have you met with your partner ${partnerName} ${cleanPartnerHandle}? 
Partner: ${partnerLink}

Just press the button below to answer:`;

    // 4 Options
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('We met ✅', `fb_stat:${matchId}:${role}:Met`),
            Markup.button.callback('We scheduled 📆', `fb_stat:${matchId}:${role}:Scheduled`)
        ],
        [
            Markup.button.callback('We have not met ⭕️', `fb_stat:${matchId}:${role}:No`),
            Markup.button.callback('Something went wrong 😔', `fb_stat:${matchId}:${role}:Fail`)
        ]
    ]);

    const targetId = IS_TEST_MODE ? process.env.ADMIN_CHAT_ID : memberTgId;

    if (IS_DRY_RUN) {
        console.log(`[DRY RUN] Would send to ${targetId} (Role ${role}):`);
        console.log(message);
        return;
    }

    try {
        await bot.telegram.sendMessage(targetId, message, keyboard);
        console.log(`Sent feedback request to Member ${role} (TgID: ${targetId}) for match ${matchId}`);
        // Delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
        console.error(`Failed to send to Member ${role} (TgID: ${targetId}):`, error.message);
    }
}

sendFeedbackRequests();
