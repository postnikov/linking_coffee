/**
 * Midweek Feedback Script
 * -------------------
 * This script sends "Have you met yet?" feedback notifications to all matched users for the current week.
 *
 * Usage:
 *   node backend/scripts/midweek-checkin.js [options]
 *
 * Options:
 *   --dry-run   : Log actions without sending messages
 *   --test      : Send all messages to the test Admin ID (defined in constant)
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
    console.log(`Starting feedback request script...`);
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
        // Fetch matches for the current week that haven't been checked in yet
        const matches = await base('tblx2OEN5sSR1xFI2').select({
            filterByFormula: `AND(IS_SAME({Week_Start}, "${weekStartStr}", 'day'), NOT({Midweek_Checkin}))`
        }).all();

        console.log(`Found ${matches.length} matches to process.`);

        for (const match of matches) {
            const matchId = match.id;
            const member1Id = match.fields.Member1 ? match.fields.Member1[0] : null;
            const member2Id = match.fields.Member2 ? match.fields.Member2[0] : null;

            // Fetch member details including Tg_ID and Username
            // Note: We used lookups in schema, so we might have arrays of values directly in match record
            // Schema says: Tg_ID (from Member1) is multipleLookupValues

            const m1TgId = match.fields['Tg_ID (from Member1)'] ? match.fields['Tg_ID (from Member1)'][0] : null;
            const m1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : null;

            const m2TgId = match.fields['Tg_ID (from Member2)'] ? match.fields['Tg_ID (from Member2)'][0] : null;
            const m2Username = match.fields['Tg_Username (from Member2)'] ? match.fields['Tg_Username (from Member2)'][0] : null;

            // Send to Member 1
            await sendToMember(matchId, 1, m1TgId, m2Username);

            // Send to Member 2
            await sendToMember(matchId, 2, m2TgId, m1Username);

            // Update match record to mark as checked in
            if (!IS_DRY_RUN) {
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
            }
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

    const message = `Hey there 👋

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
            Markup.button.callback('Something went wrong 😔', `fb_stat:${matchId}:${role}:No`)
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
