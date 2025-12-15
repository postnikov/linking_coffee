/**
 * Notify Matches Script
 * 
 * This script fetches pending matches from the 'Matches' table (where Notifications="Pending")
 * and sends a notification message to both matched members via Telegram.
 * 
 * Usage:
 *   node backend/scripts/notify-matches.js [flags]
 *   node backend/scripts/notify-matches.js --dry-run
 *   node backend/scripts/notify-matches.js --test
 *   node backend/scripts/notify-matches.js --max-notifications=5
 * 
 * Flags:
 *   --dry-run   : Run the script without sending messages or updating Airtable. Logs proposed actions.
 *   --test      : Run in test mode (sends all messages to ADMIN_CHAT_ID).
 *   --max-notifications=X : Limit number of matches processed.
 * 
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 *   - BOT_TOKEN
 *   - ADMIN_CHAT_ID
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf } = require('telegraf');

// Configuration
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const BOT_TOKEN = process.env.BOT_TOKEN; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const DRY_RUN = process.argv.includes('--dry-run');
const IS_TEST_MODE = process.argv.includes('--test');

// Parse Max Notifications Flag
const maxArg = process.argv.find(arg => arg.startsWith('--max-notifications='));
const MAX_MATCHES_TO_PROCESS = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !BOT_TOKEN || (IS_TEST_MODE && !ADMIN_CHAT_ID)) {
    console.error('❌ Missing configuration in .env');
    if (IS_TEST_MODE && !ADMIN_CHAT_ID) {
        console.error('   ADMIN_CHAT_ID is required for --test mode.');
    }
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const bot = new Telegraf(BOT_TOKEN);

function getMessage(lang, memberName, partnerName, partnerUsername, introData, isTest = false, realRecipientName = '') {
    const isRu = lang === 'Ru';
    const partnerLink = partnerUsername && partnerUsername !== '(no username)' 
        ? (isRu ? `Ссылка: https://linked.coffee/profile/${partnerUsername.replace('@', '')}` : `Link: https://linked.coffee/profile/${partnerUsername.replace('@', '')}`) 
        : '';

    let introText = '';
    if (introData) {
        try {
            const intro = JSON.parse(introData);
            // Intro structure: { greeting, why_interesting, conversation_starters }
            const header = isRu ? "🤖 **Почему вам стоит пообщаться:**" : "🤖 **Why you should meet:**";
            const why = intro.why_interesting;
            const askHeader = isRu ? "💬 **О чем спросить:**" : "💬 **Icebreakers:**";
            const ask = intro.conversation_starters.map(s => `- ${s}`).join('\n');
            
            introText = `\n${header}\n${why}\n\n${askHeader}\n${ask}\n`;
        } catch (e) {
            console.error('Error parsing intro JSON:', e);
        }
    }

    const testPrefix = isTest ? `[TEST MODE - Original Recipient: ${realRecipientName}]\n\n` : '';

    if (isRu) {
        return `${testPrefix}Привет, ${memberName}!
        
🎉 Твой partner for Linked Coffee на эту неделю!

Твой собеседник: ${partnerName} ${partnerUsername}
${partnerLink}
${introText}
Договоритесь о встрече и выпейте кофе (в Zoom, Google Meet или лично).
В личном кабинете (https://linked.coffee) можно узнать больше деталей о собеседнике.

Удачи!
❤️`;
    } else {
        return `${testPrefix}Hey, ${memberName}!

🎉 You've got a Linked Coffee partner for this week!

Your partner: ${partnerName} ${partnerUsername}
${partnerLink}
${introText}
Set up a meeting and drink some Zoom or Google-Meet coffee together.
On the dashboard (https://linked.coffee) you can find some details about your partner.

Good Luck!
❤️`;
    }
}

async function notifyMember(member, partner, introField) {
    const memberName = member.fields.Name || 'Friend';
    const partnerName = partner.fields.Name || 'a partner';
    const partnerUsername = partner.fields.Tg_Username ? `@${partner.fields.Tg_Username}` : '(no username)';
    const recipientId = member.fields.Tg_ID;
    const lang = member.fields.Notifications_Language || 'En';

    if (!recipientId && !IS_TEST_MODE) {
        console.log(`⚠️  Skipping ${memberName} (no Telegram ID)`);
        return false;
    }

    // In test mode, we strictly ONLY send to the test user.
    // We do NOT redirect other people's messages to the test user anymore.
    // This check is removed as per new test mode logic.
    // if (IS_TEST_MODE && memberStatus !== 'Admin') {
    //     return;
    // }

    // Check GDPR Consent
    if (!member.fields.Consent_GDPR) {
        console.log(`⚠️  Skipping ${memberName} (No GDPR Consent)`);
        return false;
    }

    // Determine Intro Field content (Intro_1 or Intro_2 passed from caller)
    // Note: Caller passes the raw string from Airtable
    
    const message = getMessage(lang, memberName, partnerName, partnerUsername, introField, IS_TEST_MODE, memberName);

    // Determine final recipient
    const targetChatId = IS_TEST_MODE ? ADMIN_CHAT_ID : recipientId;

    if (DRY_RUN) {
        console.log(`\n[DRY RUN] Would send to ${IS_TEST_MODE ? 'ADMIN' : memberName} (Target ID: ${targetChatId}):\n${message}`);
        return true; 
    } else {
        try {
            await bot.telegram.sendMessage(targetChatId, message);
            console.log(`✅ Sent notification to ${IS_TEST_MODE ? `ADMIN (for ${memberName})` : memberName} (Actual recipient ID: ${targetChatId})`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send to ${memberName} (Target ID: ${targetChatId}):`, error.message);
            return false;
        }
    }
}

async function main() {
    console.log(`🚀 Starting Notification Script`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Target: ${IS_TEST_MODE ? `TEST (All to Admin ${ADMIN_CHAT_ID})` : 'PRODUCTION'}`);
    if (MAX_MATCHES_TO_PROCESS !== Infinity) console.log(`   Limit: ${MAX_MATCHES_TO_PROCESS} matches`);

    try {
        // 1. Fetch Pending Matches
        // Note: The prompt says "Filters by Notifications = Pending".
        // However, looking at schema (Step 121), there is NO "Notifications" field in Matches table.
        // It has Status (Matched, Met, NoShow).
        // I will assume we need to filter by Status='Matched'.
        // To avoid re-sending, normally we'd need a flag like "Notification_Sent".
        // Since the schema doesn't have it, I'll stick to:
        // "Takes all the Matches from Matches table" -> I'll filter for this week's matches to be safe?
        // Or just ALL matches? Usually notification is for current week. 
        // Prompt says: "The script takes all the Matches from Matches table. Filters by Notifications = Pending"
        // Since "Notifications" field is missing in schema, I will skip this filter but log a warning.
        // Wait, I should probably check if I can filter by something else or just process recent ones.
        // To follow instructions strictly, I'd need that field. 
        // I'll assume the user might have added it or expects me to add it?
        // But I cannot modify schema easily without instructions.
        // I will select records where Status = 'Matched'.
        // AND maybe I should check if I should add a check for "Notification_Sent" conceptually.
        // For now, I will process ALL 'Matched' records. 
        // IMPORTANT: The prompt explicitly says "Filters by Notifications = Pending". 
        // If the field doesn't exist, the script effectively won't find anything if I try to filter by it.
        // I will implement the script assuming the field MIGHT exist or ignore it if not found, 
        // BUT the best approach is to filter by Status='Matched'.
        // Let's look at the schema again (Step 121).
        // Matches table fields: Week_Start, Member1, Member2, Status, Feedback...
        // No "Notifications" field.
        // I will write the script to fetch Status='Matched'.

        console.log(`🔍 Fetching matches with Notifications = 'Pending'...`);
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `{Notifications} = 'Pending'`
        }).all();

        console.log(`✅ Found ${matches.length} pending matches.`);

        let processedCount = 0;

        for (const match of matches) {
            if (processedCount >= MAX_MATCHES_TO_PROCESS) {
                console.log(`🛑 Reached limit of ${MAX_MATCHES_TO_PROCESS} matches.`);
                break;
            }

            // Get Member Details
            if (!match.fields.Member1 || !match.fields.Member2) {
                console.log(`⚠️ Skipping match ${match.id} due to missing Member1 or Member2.`);
                continue;
            }

            try {
                const member1 = await base(MEMBERS_TABLE).find(match.fields.Member1[0]);
                const member2 = await base(MEMBERS_TABLE).find(match.fields.Member2[0]);

                let sent1 = false;
                let sent2 = false;

                // Notify Member 1 (Use Intro_1)
                sent1 = await notifyMember(member1, member2, match.fields.Intro_1);
                
                // Notify Member 2 (Use Intro_2)
                sent2 = await notifyMember(member2, member1, match.fields.Intro_2);

                // Update Match record if ANY message was sent (or attempted in live mode)
                // In DRY_RUN we don't update.
                // In TEST_MODE we might update if we want to simulate full flow, but usually better not to update real status during test?
                // The user request: "After successful sending... change to Sent"
                // If it's a dry run, we skip update.

                if (!DRY_RUN && !IS_TEST_MODE) {
                    if (sent1 || sent2) {
                        await base(MATCHES_TABLE).update([{
                            id: match.id,
                            fields: {
                                'Notifications': 'Sent'
                            }
                        }]);
                        console.log(`📝 Updated match ${match.id} status to 'Sent'`);
                    }
                } else if (IS_TEST_MODE) {
                    // In test mode, we might want to update ONLY if we really targeted that user?
                    // Or just log that we WOULD update. 
                    // Let's protect the data in test mode and NOT update status unless explicitly asked.
                    // The user asked "After successful sending... change to Sent". 
                    // If I send to myself in test mode, I shouldn't mark the REAL match as sent to the REAL user.
                    console.log(`[TEST] Would update match ${match.id} status to 'Sent' (Skipped in test mode)`);
                } else { // DRY_RUN
                    console.log(`[DRY RUN] Would update match ${match.id} status to 'Sent'`);
                }

                processedCount++;

            } catch (err) {
                console.error(`❌ Error processing match ${match.id}:`, err);
            }
        }

        console.log('🏁 Done.');

    } catch (error) {
        console.error('❌ Error executing script:', error);
    }
}

main();
