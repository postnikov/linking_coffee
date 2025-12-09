const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Telegraf } = require('telegraf');

// Configuration
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const BOT_TOKEN = process.env.BOT_TOKEN; // Always use production bot
const TEST_TG_ID = 379053; // Test ID
const DRY_RUN = process.argv.includes('--dry-run');
const IS_TEST_MODE = process.argv.includes('--test');

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !BOT_TOKEN) {
    console.error('❌ Missing configuration in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const bot = new Telegraf(BOT_TOKEN);

async function notifyMember(member, partner) {
    const memberName = member.fields.Name || 'Friend';
    const partnerName = partner.fields.Name || 'a partner';
    const partnerUsername = partner.fields.Tg_Username ? `@${partner.fields.Tg_Username}` : '(no username)';

    const recipientId = member.fields.Tg_ID;

    // In test mode, we strictly ONLY send to the test user.
    // We do NOT redirect other people's messages to the test user anymore.
    if (IS_TEST_MODE && recipientId != TEST_TG_ID) {
        return;
    }

    if (!recipientId) {
        console.log(`⚠️  Skipping ${memberName} (no Telegram ID)`);
        return;
    }

    const message = `
Hey, ${memberName}!

🎉 You've got a Linked Coffee partner for this week!

Your partner: ${partnerName} ${partnerUsername}

Set up a meeting and drink some Zoom or Google-Meet coffee together.
On the dashboard (https://linked.coffee) you can find some details about your partner.

Good Luck!
❤️
`;

    if (DRY_RUN) {
        console.log(`\n[DRY RUN] Would send to ${memberName} (TgID: ${recipientId}):\n${message}`);
    } else {
        try {
            await bot.telegram.sendMessage(recipientId, message);
            console.log(`✅ Sent notification to ${memberName} (Actual recipient ID: ${recipientId})`);
        } catch (error) {
            console.error(`❌ Failed to send to ${memberName}:`, error.message);
        }
    }
}

async function main() {
    console.log(`🚀 Starting Notification Script`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Target: ${IS_TEST_MODE ? 'TEST (Only to ' + TEST_TG_ID + ')' : 'PRODUCTION'}`);

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

        for (const match of matches) {
            // Get Member Details
            if (!match.fields.Member1 || !match.fields.Member2) continue;

            try {
                const member1 = await base(MEMBERS_TABLE).find(match.fields.Member1[0]);
                const member2 = await base(MEMBERS_TABLE).find(match.fields.Member2[0]);

                let sent1 = false;
                let sent2 = false;

                // Notify Member 1
                try {
                    await notifyMember(member1, member2);
                    sent1 = true;
                } catch (e) {
                    console.error(`Failed to notify member 1: ${e.message}`);
                }

                // Notify Member 2
                try {
                    await notifyMember(member2, member1);
                    sent2 = true;
                } catch (e) {
                    console.error(`Failed to notify member 2: ${e.message}`);
                }

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
                } else if (!DRY_RUN && IS_TEST_MODE) {
                    // In test mode, we might want to update ONLY if we really targeted that user?
                    // Or just log that we WOULD update. 
                    // Let's protect the data in test mode and NOT update status unless explicitly asked.
                    // The user asked "After successful sending... change to Sent". 
                    // If I send to myself in test mode, I shouldn't mark the REAL match as sent to the REAL user.
                    console.log(`[TEST] Would update match ${match.id} status to 'Sent' (Skipped in test mode)`);
                } else {
                    console.log(`[DRY RUN] Would update match ${match.id} status to 'Sent'`);
                }

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
