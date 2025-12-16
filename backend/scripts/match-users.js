/**
 * Match Users Script
 * 
 * This script identifies active members, pairs them up randomly for the current week,
 * creates 'Matches' records in Airtable, and updates member statuses to 'Matched'.
 * 
 * Usage:
 *   node backend/scripts/match-users.js [flags]
 *   node backend/scripts/match-users.js --dry-run
 * 
 * Flags:
 *   --dry-run   : Run the script without creating matches or updating Airtable. Logs proposed pairings.
 * 
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');

// Generate a URL-safe token for profile viewing
function generateViewToken() {
    return crypto.randomBytes(16).toString('hex'); // 32 chars
}

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
 * Format date as YYYY-MM-DD using Local Time
 * Prevents timezone shifts (e.g. Monday 00:00 -> Sunday 23:00 UTC)
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
            filterByFormula: "AND({Next_Week_Status} = 'Active', {Consent_GDPR})"
        }).all();

        console.log(`✅ Found ${activeMembers.length} active members.`);

        // 4. Filter Unmatched Members
        const eligibleMembers = activeMembers.filter(m => !matchedMemberIds.has(m.id));
        console.log(`ℹ️  Eligible candidates (unmatched): ${eligibleMembers.length}`);

        if (eligibleMembers.length < 2) {
            console.log('⚠️  Not enough members to match.');
            return;
        }

        // 3.5 Fetch Match History
        console.log(`🔍 Fetching ALL match history to optimize pairing...`);
        const allMatches = await base(MATCHES_TABLE).select({
            fields: ['Member1', 'Member2', 'Week_Start']
        }).all();

        // Build history map: memberId -> { partnerId: lastMetDateString }
        // We only care about the MOST RECENT meeting if they met multiple times
        const history = new Map();

        allMatches.forEach(record => {
            const m1 = record.fields.Member1 ? record.fields.Member1[0] : null;
            const m2 = record.fields.Member2 ? record.fields.Member2[0] : null;
            const week = record.fields.Week_Start;

            if (m1 && m2 && week) {
                if (!history.has(m1)) history.set(m1, new Map());
                if (!history.has(m2)) history.set(m2, new Map());

                const m1Map = history.get(m1);
                const m2Map = history.get(m2);

                // Update if this meeting is more recent than what we have, or if we don't have one
                if (!m1Map.has(m2) || week > m1Map.get(m2)) {
                    m1Map.set(m2, week);
                }
                if (!m2Map.has(m1) || week > m2Map.get(m1)) {
                    m2Map.set(m1, week);
                }
            }
        });

        console.log(`✅ Loaded history for ${history.size} members.`);

        // 5. Smart Matching Logic
        // Shuffle pool first to ensure randomness among equal candidates
        let pool = eligibleMembers.sort(() => 0.5 - Math.random());
        const pairs = [];
        const leftOver = [];

        // Helper to get weeks difference
        const getWeeksSince = (dateStr) => {
            const msDiff = new Date(weekStartStr) - new Date(dateStr);
            return Math.floor(msDiff / (1000 * 60 * 60 * 24 * 7));
        };

        // Helper to get Timezone offset (e.g. "Europe/Moscow (UTC+3)" -> 3)
        const getTzOffset = (tzStr) => {
            if (!tzStr) return null;
            const match = tzStr.match(/\(UTC([+-]?\d+(?:\.\d+)?)\)/);
            return match ? parseFloat(match[1]) : null;
        };

        // Parse Max Matches Flag
        const maxMatchesArg = process.argv.find(arg => arg.startsWith('--max-matches='));
        const MAX_MATCHES = maxMatchesArg ? parseInt(maxMatchesArg.split('=')[1]) : Infinity;

        if (MAX_MATCHES !== Infinity) {
             console.log(`⚠️  Matches Limited to: ${MAX_MATCHES}`);
        }

        while (pool.length > 1 && pairs.length < MAX_MATCHES) {
            const candidate = pool.pop();
            const caTz = getTzOffset(candidate.fields.Time_Zone) || 0;
            const caLangs = candidate.fields.Languages || [];
            const caDays = candidate.fields.Best_Meetings_Days || [];
            const caProfInt = [
                ...(candidate.fields.Professional_Interests || []),
                candidate.fields.Other_Professional_Interests
            ].filter(Boolean);
            const caPersInt = [
                ...(candidate.fields.Personal_Interests || []),
                candidate.fields.Other_Personal_Interests
            ].filter(Boolean);
            const caGoals = candidate.fields.Coffee_Goals || [];

            let bestPartnerIdx = -1;
            let maxScore = -Infinity;
            let candidates = []; // For handling ties

            // Find best partner in the remaining pool
            for (let i = 0; i < pool.length; i++) {
                const potential = pool[i];
                let score = 0;
                
                // --- HARD FILTERS (Penalty Based) ---
                
                // 1. Language Check (-10000)
                const poLangs = potential.fields.Languages || [];
                const commonLangs = caLangs.filter(l => poLangs.includes(l));
                if (commonLangs.length === 0) score -= 10000;

                // 2. Timezone Check (-5000)
                const poTz = getTzOffset(potential.fields.Time_Zone) || 0;
                const tzDiff = Math.abs(caTz - poTz);
                if (tzDiff > 6) score -= 5000;

                // --- SOFT MATCHING FACTORS (Bonus Based) ---

                // 3. Meeting Days Overlap (+200 per day) - High Value
                const poDays = potential.fields.Best_Meetings_Days || [];
                const commonDays = caDays.filter(d => poDays.includes(d));
                score += (commonDays.length * 200);

                // 4. Professional Interest Overlap (+50 per interest)
                const poProfInt = [
                    ...(potential.fields.Professional_Interests || []),
                    potential.fields.Other_Professional_Interests
                ].filter(Boolean);
                const commonProf = caProfInt.filter(x => poProfInt.includes(x));
                score += (commonProf.length * 50);

                // 5. Personal Interest Overlap (+30 per interest)
                const poPersInt = [
                    ...(potential.fields.Personal_Interests || []),
                    potential.fields.Other_Personal_Interests
                ].filter(Boolean);
                const commonPers = caPersInt.filter(x => poPersInt.includes(x));
                score += (commonPers.length * 30);

                // 6. Goals Alignment (+100 if share at least one goal)
                const poGoals = potential.fields.Coffee_Goals || [];
                const commonGoals = caGoals.filter(g => poGoals.includes(g));
                if (commonGoals.length > 0) score += 100;

                // --- HISTORY SCORE ---
                
                // Check history
                if (history.has(candidate.id) && history.get(candidate.id).has(potential.id)) {
                    const lastMet = history.get(candidate.id).get(potential.id);
                    const weeksAgo = getWeeksSince(lastMet);
                    score += weeksAgo; // Small positive to differentiate history
                } else {
                    score += 1000; // Base score for never met
                }

                if (score > maxScore) {
                    maxScore = score;
                    candidates = [i];
                } else if (score === maxScore) {
                    candidates.push(i);
                }
            }

            // Pick a random winner from ties to maintain serendipity
            const winnerIdx = candidates[Math.floor(Math.random() * candidates.length)];
            const partner = pool.splice(winnerIdx, 1)[0];
            
            // Metadata for logging
            const lastMetDate = (history.has(candidate.id) && history.get(candidate.id).has(partner.id)) 
                ? history.get(candidate.id).get(partner.id) 
                : null;
            
            // Recalculate properties for logging final match details
            const poTz = getTzOffset(partner.fields.Time_Zone) || 0;
            const tzDiff = Math.abs(caTz - poTz);
            const commonLangs = (candidate.fields.Languages || []).filter(l => (partner.fields.Languages || []).includes(l));
            
            const poDays = partner.fields.Best_Meetings_Days || [];
            const commonDays = caDays.filter(d => poDays.includes(d));
            
            const poProfInt = [...(partner.fields.Professional_Interests || []), partner.fields.Other_Professional_Interests].filter(Boolean);
            const commonProf = caProfInt.filter(x => poProfInt.includes(x));

            const poPersInt = [...(partner.fields.Personal_Interests || []), partner.fields.Other_Personal_Interests].filter(Boolean);
            const commonPers = caPersInt.filter(x => poPersInt.includes(x));

            const poGoals = partner.fields.Coffee_Goals || [];
            const commonGoals = caGoals.filter(g => poGoals.includes(g));

            pairs.push({
                u1: candidate,
                u2: partner,
                metBefore: !!lastMetDate,
                weeksAgo: lastMetDate ? getWeeksSince(lastMetDate) : null,
                tzDiff: tzDiff,
                commonLangs: commonLangs,
                stats: {
                    days: commonDays.length,
                    prof: commonProf.length,
                    pers: commonPers.length,
                    goals: commonGoals.length > 0
                }
            });
        }

        if (pool.length > 0) {
            // If we stopped early due to limit, or just odd number, add ALL remaining to leftovers
            leftOver.push(...pool);
        }

        console.log(`🎲 Generated ${pairs.length} pairs using smart history matching.`);
        if (leftOver.length > 0) {
            const names = leftOver.map(m => m.fields.Name).slice(0, 5); // Show first 5
            const count = leftOver.length;
            const suffix = count > 5 ? `... and ${count - 5} others` : '';
            console.log(`⚠️  ${count} user(s) left without a match: ${names.join(', ')}${suffix}`);
        }

// 7. Process Matches (Create Records + Update Status)
        const GENERATE_DESCRIPTIONS = process.argv.includes('--get_descriptions');
        const { generateMatchIntros } = require('../prompts/get_match_description');

        if (DRY_RUN) {
            console.log('\n👀 DRY RUN - No changes will be made.');
            console.log('Proposed Matches:');
            
            for (let idx = 0; idx < pairs.length; idx++) {
                const p = pairs[idx];
                const m1 = p.u1.fields;
                const m2 = p.u2.fields;
                const historyStr = p.metBefore 
                    ? `(⚠️ Met ${p.weeksAgo} wks ago)` 
                    : `(✨ New)`;
                
                const langStr = p.commonLangs.length > 0 ? '' : '🔴 LANG';
                const tzStr = p.tzDiff > 6 ? `🔴 TZ(${p.tzDiff}h)` : '';
                
                // Show match quality stats
                const stats = [];
                if (p.stats.days > 0) stats.push(`📅 ${p.stats.days}d`);
                if (p.stats.prof > 0) stats.push(`💼 ${p.stats.prof}`);
                if (p.stats.pers > 0) stats.push(`🎨 ${p.stats.pers}`);
                if (p.stats.goals) stats.push(`🚀 Goal`);

                console.log(`  #${idx + 1}: ${m1.Name} (${m1.Tg_Username}) <-> ${m2.Name} (${m2.Tg_Username}) | ${historyStr} ${langStr} ${tzStr} | ${stats.join(' ') || 'Roll the dice 🎲'}`);

                // Generate Description for first 5 matches if flag is on
                if (GENERATE_DESCRIPTIONS && idx < 5) {
                    console.log(`    🤖 Generating intro for Match #${idx + 1}...`);
                    try {
                        const intro = await generateMatchIntros(m1, m2);
                        if (intro.success) {
                            console.log(`    ✅ Personal Intros (${intro.language}):`);
                            console.log(`       🤝 Shared: "${intro.sharedCombined}"`);
                            
                            const i1 = intro.introFor[m1.Tg_ID];
                            console.log(`       👋 For ${m1.Name}: "${i1.greeting}"`);
                            console.log(`          Why: ${i1.why_interesting}`);
                            console.log(`          Ask: ${i1.conversation_starters.join(' | ')}`);
                            
                            const i2 = intro.introFor[m2.Tg_ID];
                            console.log(`       👋 For ${m2.Name}: "${i2.greeting}"`);
                            console.log(`          Why: ${i2.why_interesting}`);
                            console.log(`          Ask: ${i2.conversation_starters.join(' | ')}`);

                        } else {
                            console.log(`    ❌ Failed to generate intro: ${intro.error}`);
                        }
                    } catch (e) {
                         console.log(`    ❌ Error calling API: ${e.message}`);
                    }
                    console.log(''); // spacer
                }
            }
        } else {
            console.log('\n💾 Saving matches to Airtable...');

            // Create Matches with Descriptions
            const matchRecordsToCreate = [];
            
            // Process sequentially to respect rate limits if needed, or parallel?
            // Anthropic rate limits might apply. Let's do batches corresponding to Airtable batches (10).
            // Or just iterate all since pairs count is likely < 100 for now.
            
            // We need to fetch descriptions for ALL pairs in production if we want them.
            // Assuming we ALWAYS want them in production?
            // "After we've created a match We want to generate a text... store... in Matches table"
            // The request says "New mechanic... We want to generate... We need another flag for dry-run".
            // Implication: In live run, we ALWAYS generate? Or only if flag is on?
            // Usually such expensive features are conditional or default. 
            // Given "We want to generate a text on what the partners have in common", I assume it's a core feature now.
            // But let's be safe: Should I require the flag for live run too?
            // "If that flag is on — we generate descriptions for the first 5 matches and log them...".
            // It doesn't explicitly say "In live run only generate if flag is on".
            // But usually safer to assume we want it in live.
            // I'll assume we run it for all in live mode.

            console.log(`🤖 Generatings AI intros for ${pairs.length} pairs...`);
            
            const processedPairs = [];
             // Process in chunks of 5 to avoid rate limits?
            const chunkSize = 5;
            for (let i = 0; i < pairs.length; i += chunkSize) {
                const chunk = pairs.slice(i, i + chunkSize);
                const results = await Promise.all(chunk.map(async (p) => {
                    const m1 = p.u1.fields;
                    const m2 = p.u2.fields;
                    let intro1 = null;
                    let intro2 = null;
                    
                    try {
                        const intro = await generateMatchIntros(m1, m2);
                        if (intro.success) {
                            // intro.introFor is keyed by Tg_ID. We need to map it to Member1/Member2 correctly.
                            // m1 is Member1 fields. m2 is Member2 fields.
                            // introFor[m1.Tg_ID] holds intro FOR Member 1.
                            
                            intro1 = JSON.stringify(intro.introFor[m1.Tg_ID]);
                            intro2 = JSON.stringify(intro.introFor[m2.Tg_ID]);
                        }
                    } catch (e) {
                        console.error(`Failed intro for ${m1.Name}-${m2.Name}:`, e.message);
                    }
                    
                    return {
                        fields: {
                            'Week_Start': weekStartStr,
                            'Member1': [p.u1.id],
                            'Member2': [p.u2.id],
                            'Status': 'Matched',
                            'Notifications': 'Pending',
                            'Intro_1': intro1,
                            'Intro_2': intro2,
                            'View_Token_1': generateViewToken(),
                            'View_Token_2': generateViewToken()
                        }
                    };
                }));
                processedPairs.push(...results);
                console.log(`   - Generated ${Math.min(processedPairs.length, pairs.length)}/${pairs.length}...`);
            }
            
            // Batch create in Airtable
            for (let i = 0; i < processedPairs.length; i += 10) {
                const batch = processedPairs.slice(i, i + 10);
                await base(MATCHES_TABLE).create(batch);
                console.log(`   - Created ${batch.length} match records...`);
            }

            // Update Members Status
            console.log('💾 Updating members status to "Matched"...');
            const membersToUpdate = [];
            pairs.forEach(p => {
                membersToUpdate.push({ id: p.u1.id, fields: { 'Current_Week_Status': 'Matched' } });
                membersToUpdate.push({ id: p.u2.id, fields: { 'Current_Week_Status': 'Matched' } });
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
