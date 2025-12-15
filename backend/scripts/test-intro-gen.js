/**
 * Test Intro Generation Script
 * 
 * Usage:
 *   node backend/scripts/test-intro-gen.js --match-num=123
 * 
 * Description:
 *   Fetches a specific match by "Num" field (Auto Number).
 *   Fetches the two members.
 *   Generates the AI intro using 'get_match_description.js'.
 *   Logs the result to console.
 *   Does NOT save to Airtable.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { generateMatchIntros } = require('../prompts/get_match_description');

// Configuration
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('❌ Missing configuration in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function main() {
    // Parse Match Num
    const matchNumArg = process.argv.find(arg => arg.startsWith('--match-num='));
    if (!matchNumArg) {
        console.error('❌ Please provide --match-num=NUMBER');
        process.exit(1);
    }
    
    const matchNum = parseInt(matchNumArg.split('=')[1]);
    console.log(`🔍 Searching for Match #${matchNum}...`);

    try {
        // 1. Find Match Record
        // "Num" is typically an Auto Number field. Using filterByFormula.
        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: `{Num} = ${matchNum}`,
            maxRecords: 1
        }).firstPage();

        if (matches.length === 0) {
            console.error('❌ Match not found.');
            return;
        }

        const match = matches[0];
        console.log(`✅ Found Match ID: ${match.id} (Week: ${match.fields.Week_Start})`);

        // 2. Fetch Members
        if (!match.fields.Member1 || !match.fields.Member2) {
            console.error('❌ Match is missing Member(s).');
            return;
        }

        console.log('🔍 Fetching members...');
        const [member1, member2] = await Promise.all([
            base(MEMBERS_TABLE).find(match.fields.Member1[0]),
            base(MEMBERS_TABLE).find(match.fields.Member2[0])
        ]);

        const m1 = member1.fields;
        const m2 = member2.fields;

        console.log(`   👤 Member 1: ${m1.Name} (${m1.Tg_Username}, Lang: ${m1.Notifications_Language || 'En'})`);
        console.log(`   👤 Member 2: ${m2.Name} (${m2.Tg_Username}, Lang: ${m2.Notifications_Language || 'En'})`);

        // 3. Generate Intro
        console.log('\n🤖 Generating AI Intros...');
        const start = Date.now();
        const intro = await generateMatchIntros(m1, m2);
        const duration = (Date.now() - start) / 1000;

        if (intro.success) {
            console.log(`\n✅ Success! (took ${duration}s)`);
            console.log(`   Language: ${intro.language}`);
            console.log(`   Shared Ground: "${intro.sharedCombined}"\n`);
            
            // Intro 1
            const i1 = intro.introFor[m1.Tg_ID];
            if (i1) {
                console.log('--- FOR MEMBER 1 -------------------');
                console.log(`👋 Greeting: "${i1.greeting}"`);
                console.log(`💡 Why:      "${i1.why_interesting}"`);
                console.log(`💬 Starters: \n   - ${i1.conversation_starters.join('\n   - ')}`);
            } else {
                console.error('❌ Missing intro for Member 1 Tg_ID');
            }

            // Intro 2
            const i2 = intro.introFor[m2.Tg_ID];
            if (i2) {
                console.log('\n--- FOR MEMBER 2 -------------------');
                console.log(`👋 Greeting: "${i2.greeting}"`);
                console.log(`💡 Why:      "${i2.why_interesting}"`);
                console.log(`💬 Starters: \n   - ${i2.conversation_starters.join('\n   - ')}`);
            } else {
                console.error('❌ Missing intro for Member 2 Tg_ID');
            }

            // Check for --write flag
            if (process.argv.includes('--write')) {
                console.log('\n💾 Writing intros to Airtable...');
                try {
                    await base(MATCHES_TABLE).update([{
                        id: match.id,
                        fields: {
                            'Intro_1': i1 ? JSON.stringify(i1) : null,
                            'Intro_2': i2 ? JSON.stringify(i2) : null
                        }
                    }]);
                    console.log(`✅ updated Match #${matchNum} (Record ID: ${match.id})`);
                } catch (err) {
                    console.error('❌ Failed to save to Airtable:', err.message);
                }
            } else {
                console.log('\n(Use --write to save these intros to the database)');
            }

        } else {
            console.error(`\n❌ Failed: ${intro.error}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

main();
