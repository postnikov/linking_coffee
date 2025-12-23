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
const { logMessage } = require('../utils/logger');

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

function getMessage(lang, memberName, partnerName, partnerUsername, introData, isTest = false, realRecipientName = '', viewToken = null) {
    const isRu = lang === 'Ru';
    
    // Use tokenized link if available, otherwise fall back to profile link
    let partnerLink = '';
    if (viewToken) {
        partnerLink = isRu 
            ? `Профиль: https://linked.coffee/view/${viewToken}` 
            : `Profile: https://linked.coffee/view/${viewToken}`;
    } else if (partnerUsername && partnerUsername !== '(no username)') {
        partnerLink = isRu 
            ? `Ссылка: https://linked.coffee/profile/${partnerUsername.replace('@', '')}` 
            : `Link: https://linked.coffee/profile/${partnerUsername.replace('@', '')}`;
    }

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

async function notifyMember(member, partner, introField, viewToken = null, matchId = null) {
    const memberName = member.fields.Name || 'Friend';
    const partnerName = partner.fields.Name || 'a partner';
    const partnerUsername = partner.fields.Tg_Username ? `@${partner.fields.Tg_Username}` : '(no username)';
    const recipientId = member.fields.Tg_ID;
    const lang = member.fields.Notifications_Language || 'En';

    if (!recipientId && !IS_TEST_MODE) {
        console.log(`⚠️  Skipping ${memberName} (no Telegram ID)`);
        await logMessage({
            scriptName: 'notify-matches',
            memberId: member.id,
            status: 'Failed',
            content: 'No Telegram ID',
            matchId: matchId,
            error: 'Missing Tg_ID'
        });
        return false;
    }

    // Check GDPR Consent
    if (!member.fields.Consent_GDPR) {
        console.log(`⚠️  Skipping ${memberName} (No GDPR Consent)`);
        return false;
    }
    
    const message = getMessage(lang, memberName, partnerName, partnerUsername, introField, IS_TEST_MODE, memberName, viewToken);

    // Determine final recipient
    const targetChatId = IS_TEST_MODE ? ADMIN_CHAT_ID : recipientId;

    if (DRY_RUN) {
        await logMessage({
            scriptName: 'notify-matches',
            memberId: member.id,
            status: 'Dry Run',
            content: message,
            matchId: matchId
        });
        return true; 
    } else {
        try {
            await bot.telegram.sendMessage(targetChatId, message);
            await logMessage({
                scriptName: 'notify-matches',
                memberId: member.id,
                status: 'Sent',
                content: message,
                matchId: matchId
            });
            return true;
        } catch (error) {
            await logMessage({
                scriptName: 'notify-matches',
                memberId: member.id,
                status: 'Failed',
                content: message,
                matchId: matchId,
                error: error.message
            });
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
        // 1. Fetch Pending Matches from Airtable

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

                // Notify Member 1 (Use Intro_1, View_Token_1)
                sent1 = await notifyMember(member1, member2, match.fields.Intro_1, match.fields.View_Token_1, match.id);
                
                // Notify Member 2 (Use Intro_2, View_Token_2)
                sent2 = await notifyMember(member2, member1, match.fields.Intro_2, match.fields.View_Token_2, match.id);

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
