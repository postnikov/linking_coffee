/**
 * Activate Feedback Users Script
 * ------------------------------
 * Analyzes matches from the previous week.
 * Identifies users who provided feedback (Feedback1 or Feedback2).
 * Sets their status to 'Active' for the upcoming cycle.
 *
 * Logic:
 * 1. Calculate Previous Week Start (Current Week Start - 7 days).
 * 2. Fetch matches for that week.
 * 3. Filter matches where feedback was provided.
 * 4. Update identified members' Next_Week_Status to 'Active'.
 *    (Note: User request mentioned 'Current_Week_Status', but strict schema aligns 'Active' with 'Next_Week_Status'.
 *     We are updating 'Next_Week_Status' to ensure they are picked up by match-users.js).
 *
 * Usage:
 *   node backend/scripts/activate-feedback-users.js [options]
 *
 * Options:
 *   --dry-run               : Log actions without updating DB
 *   --week-start=YYYY-MM-DD : Force a specific week start date (for the "previous" week)
 *   --deactivate-others     : If passed, users who did NOT provide feedback will be set to 'Passive'.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { logMessage } = require('../utils/logger'); // Assuming this exists, if not we'll skip or use console

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2';
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE || 'tblCrnbDupkzWUx9P';

// Arguments
const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes('--dry-run');
const DEACTIVATE_OTHERS = args.includes('--deactivate-others');
const weekStartArg = args.find(arg => arg.startsWith('--week-start='));
const FORCED_WEEK_START = weekStartArg ? weekStartArg.split('=')[1] : null;

// Helper: Get Monday
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Helper: Format Date
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function run() {
    console.log('🚀 Starting Activate Feedback Users Script');
    console.log(`   Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Deactivate Others: ${DEACTIVATE_OTHERS ? 'YES' : 'NO'}`);

    // 1. Determine "Previous Week" Start
    let targetDateStr;
    if (FORCED_WEEK_START) {
        targetDateStr = FORCED_WEEK_START;
    } else {
        const today = new Date();
        const currentWeekMonday = getMonday(today);
        // Previous week is 7 days before current week Monday
        const previousWeekMonday = new Date(currentWeekMonday);
        previousWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        targetDateStr = formatDate(previousWeekMonday);
    }

    console.log(`📅 Analyzing matches for week starting: ${targetDateStr}`);

    try {
        // 2. Fetch Matches
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `IS_SAME({Week_Start}, "${targetDateStr}", 'day')`
        }).all();

        console.log(`🔍 Found ${matches.length} matches for that week.`);

        // 3. Identify Engaged Users AND All Matched Users
        const engagedMemberIds = new Set();
        const allMatchedMemberIds = new Set();

        matches.forEach(match => {
            const f1 = match.fields.Feedback1; // Number or filled
            const f2 = match.fields.Feedback2;
            const m1 = match.fields.Member1 ? match.fields.Member1[0] : null;
            const m2 = match.fields.Member2 ? match.fields.Member2[0] : null;

            if (m1) allMatchedMemberIds.add(m1);
            if (m2) allMatchedMemberIds.add(m2);

            // Check if Member 1 gave feedback
            if (f1 != null && m1) {
                engagedMemberIds.add(m1);
            }

            // Check if Member 2 gave feedback
            if (f2 != null && m2) {
                engagedMemberIds.add(m2);
            }
        });

        console.log(`✅ Found ${engagedMemberIds.size} unique members who provided feedback.`);

        // Identify inactive users (Failed to provide feedback)
        const inactiveMemberIds = new Set();
        if (DEACTIVATE_OTHERS) {
            allMatchedMemberIds.forEach(id => {
                if (!engagedMemberIds.has(id)) {
                    inactiveMemberIds.add(id);
                }
            });
            console.log(`⚠️  Found ${inactiveMemberIds.size} unique members who DID NOT provide feedback.`);
        }

        if (engagedMemberIds.size === 0 && inactiveMemberIds.size === 0) {
            console.log('No members to update.');
            return;
        }

        // 4. Fetch Details for Logging (Num, Tg_Username)
        // We fetch for ALL involved users to handle logging for both groups
        const allIdsToFetch = new Set([...engagedMemberIds, ...inactiveMemberIds]);
        const idsArray = Array.from(allIdsToFetch);

        // Batched Fetching Logic for Member Details
        let memberMap = {};
        const fetchBatchSize = 50; // URL limit safety

        // Split idsArray into chunks
        for (let i = 0; i < idsArray.length; i += fetchBatchSize) {
            const chunk = idsArray.slice(i, i + fetchBatchSize);
            const formulaParts = chunk.map(id => `RECORD_ID()='${id}'`);
            const formula = `OR(${formulaParts.join(',')})`;

            try {
                const memberRecords = await base(MEMBERS_TABLE).select({
                    filterByFormula: formula,
                    fields: ['Num', 'Tg_Username', 'Name']
                }).all();

                memberRecords.forEach(r => {
                    memberMap[r.id] = {
                        num: r.fields.Num,
                        username: r.fields.Tg_Username,
                        name: r.fields.Name
                    };
                });
            } catch (err) {
                console.warn(`⚠️ Could not fetch member details for batch ${i} (possibly URL too long).`);
            }
        }

        // Helper to format member string
        const formatMember = (id) => {
            const data = memberMap[id];
            if (!data) return `${id} (Details missing)`;
            // Format: #123 Name (@Username) [ID]
            const nameStr = data.name ? data.name : 'Unknown';
            const handleStr = data.username ? `(@${data.username.replace('@', '')})` : '';
            return `#${data.num || '?'} ${nameStr} ${handleStr} [${id}]`;
        };

        // --- PREPARE UPDATES ---

        // Group 1: Activations
        const activationUpdates = Array.from(engagedMemberIds).map(id => ({
            id,
            fields: { 'Next_Week_Status': 'Active' }
        }));

        // Group 2: Deactivations
        const deactivationUpdates = Array.from(inactiveMemberIds).map(id => ({
            id,
            fields: { 'Next_Week_Status': 'Passive' }
        }));

        // --- DRY RUN LOGGING ---
        if (IS_DRY_RUN) {
            if (activationUpdates.length > 0) {
                console.log(`\n[DRY RUN] Would update ${activationUpdates.length} members to 'Active':`);
                activationUpdates.forEach(u => console.log(`   - ${formatMember(u.id)}`));
            }

            if (DEACTIVATE_OTHERS && deactivationUpdates.length > 0) {
                console.log(`\n[DRY RUN] Would update ${deactivationUpdates.length} members to 'Passive' (--deactivate-others):`);
                deactivationUpdates.forEach(u => console.log(`   - ${formatMember(u.id)}`));
            }
        }

        // --- REAL EXECUTION ---
        else {
            // Execute Activations
            if (activationUpdates.length > 0) {
                console.log(`\n💾 Activating ${activationUpdates.length} members...`);
                // Log detailed list
                activationUpdates.forEach(u => console.log(`   - Activating ${formatMember(u.id)}`));

                await batchUpdate(activationUpdates);
            }

            // Execute Deactivations
            if (DEACTIVATE_OTHERS && deactivationUpdates.length > 0) {
                console.log(`\n💾 Deactivating ${deactivationUpdates.length} members...`);
                // Log detailed list
                deactivationUpdates.forEach(u => console.log(`   - Deactivating ${formatMember(u.id)}`));

                await batchUpdate(deactivationUpdates);
            }

            console.log('\n🎉 Done.');
        }

    } catch (error) {
        console.error('❌ Script Error:', error);
        process.exit(1);
    }
}

// Helper for batch updating
async function batchUpdate(updates) {
    for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        try {
            await base(MEMBERS_TABLE).update(batch);
            console.log(`     -> Batch ${Math.floor(i / 10) + 1}/${Math.ceil(updates.length / 10)} success`);
        } catch (err) {
            console.error(`     ❌ Error updating batch starting at index ${i}:`, err.message);
        }
    }
}

run();
