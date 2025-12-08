require('dotenv').config({ path: '../.env' });
const Airtable = require('airtable');
const { Telegraf } = require('telegraf');

// Configuration
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const BOT_TOKEN = process.env.BOT_TOKEN; // Always use production bot
const TEST_TG_ID = 379053; // Test ID
const DRY_RUN = process.argv.includes('--dry-run');
const IS_TEST_MODE = true; // Hardcoded test mode instruction "only to Tg_ID 379053"

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

    // For test mode, we always send to the TEST_TG_ID but address the real user in text to verify content
    const recipientId = IS_TEST_MODE ? TEST_TG_ID : member.fields.Tg_ID;

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

        console.log(`🔍 Fetching matches with Status = 'Matched'...`);
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `{Status} = 'Matched'`
        }).all();

        console.log(`✅ Found ${matches.length} matches.`);

        for (const match of matches) {
            // Get Member Details
            // Member1 and Member2 are arrays of IDs
            if (!match.fields.Member1 || !match.fields.Member2) continue;

            try {
                const member1 = await base(MEMBERS_TABLE).find(match.fields.Member1[0]);
                const member2 = await base(MEMBERS_TABLE).find(match.fields.Member2[0]);

                // Notify Member 1 about Member 2
                await notifyMember(member1, member2);

                // Notify Member 2 about Member 1
                await notifyMember(member2, member1);

                // Update Match record? 
                // The prompt didn't ask to update a "Notification Sent" status, so I won't.
                // But in a real scenario, we'd want to avoid spamming.

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
