/**
 * Match All Script - Orchestrator for Multi-Pool Matching
 *
 * Runs matching for all active communities first, then global pool.
 * This ensures community members get matched within their communities
 * before global matching runs (if they set matching context to global).
 *
 * Usage:
 *   node backend/scripts/match-all.js [flags]
 *   node backend/scripts/match-all.js --dry-run
 *
 * Flags:
 *   --dry-run : Run without creating matches (passes to child scripts)
 *
 * Example:
 * docker exec -it linking-coffee-backend node scripts/match-all.js
 * docker exec -it linking-coffee-backend node scripts/match-all.js --dry-run
 *
 * Environment Variables:
 *   - All variables required by match-users-ai.js
 *   - AIRTABLE_COMMUNITIES_TABLE
 *   - BOT_TOKEN (for admin notifications)
 *   - ADMIN_CHAT_ID (for notifications)
 */

const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');

// Configuration
const COMMUNITIES_TABLE = process.env.AIRTABLE_COMMUNITIES_TABLE;
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('❌ Missing Airtable configuration in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

/**
 * Run matching script as child process
 */
function runMatchingScript(args) {
    return new Promise((resolve, reject) => {
        console.log(`\n▶️  Running: node scripts/match-users-ai.js ${args.join(' ')}`);

        const child = spawn('node', ['scripts/match-users-ai.js', ...args], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit', // Pass through stdout/stderr
            env: process.env
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Script exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Send notification to admin via Telegram (optional)
 */
async function notifyAdmin(message) {
    if (!process.env.BOT_TOKEN || !process.env.ADMIN_CHAT_ID) {
        return; // Skip if not configured
    }

    try {
        const { Telegraf } = require('telegraf');
        const bot = new Telegraf(process.env.BOT_TOKEN);
        await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('⚠️  Failed to send admin notification:', err.message);
    }
}

/**
 * Main orchestration logic
 */
async function main() {
    const startTime = Date.now();

    console.log('🚀 Match-All Orchestrator Starting...');
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

    const results = {
        communitiesProcessed: 0,
        communitiesMatched: 0,
        communitiesSkipped: 0,
        globalMatched: false,
        errors: []
    };

    try {
        // Step 1: Fetch all active communities
        console.log('\n📋 Step 1: Fetching active communities...');
        const communities = await base(COMMUNITIES_TABLE).select({
            filterByFormula: `AND(
                {Status} = 'Active',
                {Deleted_At} = BLANK()
            )`
        }).all();

        console.log(`   Found ${communities.length} active communities.`);

        // Step 2: Match each community
        console.log('\n🏘️  Step 2: Processing community matching...');

        for (const community of communities) {
            const slug = community.fields.Slug;
            const name = community.fields.Name;
            const minActive = community.fields.Min_Active_For_Matching || 6;

            console.log(`\n   Community: ${name} (${slug})`);
            console.log(`   Min Active for Matching: ${minActive}`);

            results.communitiesProcessed++;

            // Count opt-ins for this community
            const optIns = await base(MEMBERS_TABLE).select({
                filterByFormula: `AND(
                    {Next_Week_Status} = 'Active',
                    {Consent_GDPR},
                    {Matching_Context} = 'community:${slug}'
                )`
            }).all();

            console.log(`   Opt-ins: ${optIns.length}`);

            if (optIns.length < minActive) {
                console.log(`   ⏭️  Skipping: Not enough opt-ins (${optIns.length} < ${minActive})`);
                results.communitiesSkipped++;

                // Notify admin if configured
                await notifyAdmin(
                    `⏭️  *${name}*\n` +
                    `Not enough opt-ins for matching this week.\n` +
                    `Opt-ins: ${optIns.length} / ${minActive} required`
                );

                continue;
            }

            // Run matching for this community
            try {
                const args = [`--community=${slug}`];
                if (DRY_RUN) args.push('--dry-run');

                await runMatchingScript(args);
                results.communitiesMatched++;
                console.log(`   ✅ Community matching completed.`);
            } catch (err) {
                console.error(`   ❌ Community matching failed:`, err.message);
                results.errors.push(`Community ${slug}: ${err.message}`);

                // Notify admin of failure
                await notifyAdmin(
                    `❌ *${name}*\n` +
                    `Matching failed: ${err.message}`
                );
            }
        }

        // Step 3: Run global matching
        console.log('\n🌍 Step 3: Processing global matching...');

        try {
            const args = [];
            if (DRY_RUN) args.push('--dry-run');

            await runMatchingScript(args);
            results.globalMatched = true;
            console.log('   ✅ Global matching completed.');
        } catch (err) {
            console.error('   ❌ Global matching failed:', err.message);
            results.errors.push(`Global: ${err.message}`);

            // Notify admin of failure
            await notifyAdmin(
                `❌ *Global Matching*\n` +
                `Failed: ${err.message}`
            );
        }

        // Summary
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log('\n═══════════════════════════════════════');
        console.log('✅ Match-All Orchestrator Complete');
        console.log('═══════════════════════════════════════');
        console.log(`   Communities Processed: ${results.communitiesProcessed}`);
        console.log(`   Communities Matched: ${results.communitiesMatched}`);
        console.log(`   Communities Skipped: ${results.communitiesSkipped}`);
        console.log(`   Global Matched: ${results.globalMatched ? 'Yes' : 'No'}`);
        console.log(`   Errors: ${results.errors.length}`);
        console.log(`   Duration: ${duration}s`);
        console.log('═══════════════════════════════════════\n');

        if (results.errors.length > 0) {
            console.log('❌ Errors encountered:');
            results.errors.forEach(err => console.log(`   - ${err}`));

            // Send summary notification
            await notifyAdmin(
                `⚠️  *Weekly Matching Summary*\n\n` +
                `Communities Matched: ${results.communitiesMatched}\n` +
                `Communities Skipped: ${results.communitiesSkipped}\n` +
                `Global: ${results.globalMatched ? '✅' : '❌'}\n` +
                `Errors: ${results.errors.length}\n` +
                `Duration: ${duration}s`
            );

            process.exit(1);
        } else {
            // Send success notification
            await notifyAdmin(
                `✅ *Weekly Matching Complete*\n\n` +
                `Communities Matched: ${results.communitiesMatched}\n` +
                `Communities Skipped: ${results.communitiesSkipped}\n` +
                `Global: ✅\n` +
                `Duration: ${duration}s`
            );
        }

    } catch (err) {
        console.error('\n❌ Fatal Error:', err);
        await notifyAdmin(`🚨 *Match-All Fatal Error*\n\n${err.message}`);
        process.exit(1);
    }
}

// Run
main().catch(err => {
    console.error('❌ Unhandled Error:', err);
    process.exit(1);
});
