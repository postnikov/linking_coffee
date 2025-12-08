require('dotenv').config({ path: '../.env' });
const Airtable = require('airtable');

// Configuration
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('❌ Missing Airtable configuration in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

/**
 * Get Monday of the current week
 */
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

/**
 * Format date as YYYY-MM-DD for Airtable
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function main() {
    console.log(`🚀 Starting Match Script (Dry Run: ${DRY_RUN})`);

    // 1. Calculate Week Start (Monday)
    const today = new Date();
    // If today is Sunday, do we mean tomorrow (next week) or this past week?
    // User said "this week" in the context of the message. 
    // Usually matching happens for the current week.
    // Let's assume we want the Monday of the week we are currently in.
    const mondayDate = getMonday(today);
    const weekStartStr = formatDate(mondayDate);

    console.log(`📅 Matching for Week Starting: ${weekStartStr}`);

    try {
        // 2. Fetch Existing Matches for this week
        console.log(`🔍 Checking existing matches for ${weekStartStr}...`);
        const existingMatches = await base(MATCHES_TABLE).select({
            filterByFormula: `IS_SAME({Week_Start}, "${weekStartStr}", 'day')`
        }).all();

        const matchedMemberIds = new Set();
        existingMatches.forEach(match => {
            const m1 = match.fields.Member1 ? match.fields.Member1[0] : null;
            const m2 = match.fields.Member2 ? match.fields.Member2[0] : null;
            if (m1) matchedMemberIds.add(m1);
            if (m2) matchedMemberIds.add(m2);
        });

        console.log(`✅ Found ${existingMatches.length} existing matches involving ${matchedMemberIds.size} members.`);

        // 3. Fetch Active Members
        console.log(`🔍 Fetching members with Next_Week_Status = 'Active'...`);
        const activeMembers = await base(MEMBERS_TABLE).select({
            filterByFormula: `{Next_Week_Status} = 'Active'`
        }).all();

        console.log(`✅ Found ${activeMembers.length} active members.`);

        // 4. Filter Unmatched Members
        const eligibleMembers = activeMembers.filter(m => !matchedMemberIds.has(m.id));
        console.log(`ℹ️  Eligible candidates (unmatched): ${eligibleMembers.length}`);

        if (eligibleMembers.length < 2) {
            console.log('⚠️  Not enough members to match.');
            return;
        }

        // 5. Random Shuffle
        const shuffled = eligibleMembers.sort(() => 0.5 - Math.random());

        // 6. Create Pairs
        const pairs = [];
        const leftOver = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                pairs.push([shuffled[i], shuffled[i + 1]]);
            } else {
                leftOver.push(shuffled[i]);
            }
        }

        console.log(`🎲 Generated ${pairs.length} pairs.`);
        if (leftOver.length > 0) {
            console.log(`⚠️  ${leftOver.length} user(s) left without a match: ${leftOver.map(m => m.fields.Name).join(', ')}`);
        }

        // 7. Process Matches (Create Records + Update Status)
        if (DRY_RUN) {
            console.log('\n👀 DRY RUN - No changes will be made.');
            console.log('Proposed Matches:');
            pairs.forEach((pair, idx) => {
                const m1 = pair[0].fields;
                const m2 = pair[1].fields;
                console.log(`  Match #${idx + 1}: ${m1.Name} (${m1.Tg_Username}) <—> ${m2.Name} (${m2.Tg_Username})`);
            });
        } else {
            console.log('\n💾 Saving matches to Airtable...');

            // Create Matches
            const matchRecordsToCreate = pairs.map(pair => ({
                fields: {
                    'Week_Start': weekStartStr,
                    'Member1': [pair[0].id],
                    'Member2': [pair[1].id],
                    'Status': 'Matched'
                }
            }));

            // Search for "Matches" table name or ID. We used ID const.
            // Batch create (max 10 per request usually, but library handles it? No, library handles pagination for fetch, but create needs usually 10)
            // airtable.js create accepts array of up to 10 objects.

            for (let i = 0; i < matchRecordsToCreate.length; i += 10) {
                const batch = matchRecordsToCreate.slice(i, i + 10);
                await base(MATCHES_TABLE).create(batch);
                console.log(`   - Created ${batch.length} match records...`);
            }

            // Update Members Status
            console.log('💾 Updating members status to "Matched"...');
            const membersToUpdate = [];
            pairs.forEach(pair => {
                membersToUpdate.push({ id: pair[0].id, fields: { 'Current_Week_Status': 'Matched' } });
                membersToUpdate.push({ id: pair[1].id, fields: { 'Current_Week_Status': 'Matched' } });
            });

            for (let i = 0; i < membersToUpdate.length; i += 10) {
                const batch = membersToUpdate.slice(i, i + 10);
                await base(MEMBERS_TABLE).update(batch);
                console.log(`   - Updated ${batch.length} member statuses...`);
            }

            console.log('✅ All changes saved successfully!');
        }

    } catch (error) {
        console.error('❌ Error executing script:', error);
    }
}

main();
