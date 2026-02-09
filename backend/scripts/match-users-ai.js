/**
 * Match Users AI Script
 * 
 * Uses Google Gemini (gemini-3-flash-preview) to intelligently match users based on profiles,
 * interests, and history.
 * 
 * Usage:
 *   node backend/scripts/match-users-ai.js [flags]
 *   node backend/scripts/match-users-ai.js
 * 
 * Flags:
 *   --dry-run   : Run without creating matches in Airtable.
 *   --model=X   : Override model name (default: gemini-3-flash-preview)
 * 
 * Example:
 * docker exec -it linking-coffee-backend node scripts/match-users-ai.js --dry-run
 * docker exec -it linking-coffee-backend node scripts/match-users-ai.js --resume
 * docker exec -it linking-coffee-backend node scripts/match-users-ai.js --model=gemini-3-pro-preview
 * 
 * Environment Variables:
 *   - GOOGLE_API_KEY
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
// Load Config
let config = {};
try {
    config = require('../../linking-coffee.config.js'); // Local dev path
} catch (e) {
    try {
        config = require('../linking-coffee.config.js'); // Docker path
    } catch (e2) {
        console.warn("⚠️ Could not load linking-coffee.config.js, using defaults.");
        config = { ai: { matchingModel: 'gemini-3-pro-preview' } };
    }
}
// Validate Env
if (config.checkRequiredEnv) config.checkRequiredEnv();

// Configuration
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;
const MATCHES_TABLE = 'tblx2OEN5sSR1xFI2'; // From SCHEMA
const LOGS_TABLE = 'tbln4rLHEgXUkL9Jh'; // From SCHEMA
const DRY_RUN = process.argv.includes('--dry-run');
const MODEL_OPT = process.argv.find(arg => arg.startsWith('--model='));

// Use CLI flag if present, otherwise fall back to config file
const MODEL_NAME = MODEL_OPT ? MODEL_OPT.split('=')[1] : config.ai.matchingModel;

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('❌ Missing Airtable configuration in .env');
    process.exit(1);
}

if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('❌ Missing GOOGLE_AI_API_KEY in .env');
    console.error('👉 Please add GOOGLE_AI_API_KEY=your_key_here to your .env file');
    process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

function generateViewToken() {
    return crypto.randomBytes(16).toString('hex');
}

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTzOffset(tzStr) {
    if (!tzStr) return 0;
    const match = tzStr.match(/\(UTC([+-]?\d+(?:\.\d+)?)\)/);
    return match ? parseFloat(match[1]) : 0;
}

// ---------------------------------------------------------
// Gemini API Client (Direct Axios Implementation)
// ---------------------------------------------------------
const https = require('https');

const agent = new https.Agent({
    keepAlive: true,
    timeout: 300000
});

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(systemPrompt, userPrompt) {
    return await callGeminiWithModel(MODEL_NAME, systemPrompt, userPrompt);
}

async function callGeminiWithModel(targetModel, systemPrompt, userPrompt) {
    console.log(`📡 Preparing Gemini API call (via Axios)...`);
    console.log(`   - Model: ${targetModel}`);

    // Combined Prompt
    const combinedPrompt = systemPrompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown formatting. No code blocks. \n\n" + userPrompt;
    console.log(`   - Payload Length: ${combinedPrompt.length} chars`);

    // Use direct REST API
    // Note: Model name in URL
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`;
            console.log(`🚀 Sending request to ${targetModel} (Attempt ${attempt}/${MAX_RETRIES})...`);

            const startTime = Date.now();
            const response = await axios.post(url, {
                contents: [{
                    role: "user",
                    parts: [{ text: combinedPrompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2
                }
            }, {
                timeout: 300000, // 5 minutes
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: agent
            });

            const duration = Date.now() - startTime;
            console.log(`⏱️  Gemini payload received in ${duration}ms`);

            if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
                throw new Error(`Invalid API Response Structure: ${JSON.stringify(response.data)}`);
            }

            const candidate = response.data.candidates[0];
            let text = candidate.content.parts[0].text;
            console.log(`📥 Raw AI Response (${text.length} chars):`);
            console.log(text.substring(0, 500) + (text.length > 500 ? "..." : ""));

            // Cleanup Markdown
            if (text.includes('```json')) {
                text = text.replace(/```json\n?/g, '').replace(/```/g, '');
            } else if (text.includes('```')) {
                text = text.replace(/```\n?/g, '').replace(/```/g, '');
            }

            return JSON.parse(text);

        } catch (error) {
            console.error(`❌ Attempt ${attempt} Failed!`);

            if (error.response) {
                console.error(`   - Status: ${error.response.status}`);
                // console.error(`   - Data: ${JSON.stringify(error.response.data, null, 2)}`);
            } else {
                console.error(`   - Error: ${error.message}`);
            }

            if (attempt < MAX_RETRIES) {
                const waitTime = 2000 * attempt;
                console.log(`   ⏳ Waiting ${waitTime}ms before retry...`);
                await delay(waitTime);
            }
        }
    }

    // Fallback Logic
    let nextFallback = null;

    if (targetModel === 'gemini-3-pro-preview') {
        nextFallback = 'gemini-2.5-flash';
    } else if (targetModel === 'gemini-2.5-flash') {
        nextFallback = 'gemini-3-flash-preview';
    }
    // If 3-flash fails, we stop (avoid infinite loops or using dead 1.5 models)

    if (nextFallback) {
        console.warn(`⚠️  Model ${targetModel} failed after ${MAX_RETRIES} attempts.`);
        console.warn(`🔄  Switching to FALLBACK model: ${nextFallback}...`);
        return await callGeminiWithModel(nextFallback, systemPrompt, userPrompt);
    }

    return null;
}

// ---------------------------------------------------------
// Main Logic
// ---------------------------------------------------------

async function main() {
    // ---------------------------------------------------------
    // Logging Setup
    // ---------------------------------------------------------
    const logDir = path.join(__dirname, '../../logs/ai-matching');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `match-run-${timestamp}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Patch console to write to both stdout and file
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    function formatMessage(...args) {
        return args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ');
    }

    console.log = (...args) => {
        const msg = formatMessage(...args);
        originalLog(msg); // Print to terminal
        logStream.write(`[INFO] ${msg}\n`); // Write to file
    };

    console.error = (...args) => {
        const msg = formatMessage(...args);
        originalError(msg);
        logStream.write(`[ERROR] ${msg}\n`);
    };

    console.warn = (...args) => {
        const msg = formatMessage(...args);
        originalWarn(msg);
        logStream.write(`[WARN] ${msg}\n`);
    };

    console.log(`📝 Logging to file: ${logFile}`);
    console.log(`🚀 Starting AI Matching Script with ${MODEL_NAME} (Dry Run: ${DRY_RUN})`);

    const mondayDate = getMonday(new Date());
    const weekStartStr = formatDate(mondayDate);
    console.log(`📅 Matching for Week Starting: ${weekStartStr}`);

    const IS_RESUME = process.argv.includes('--resume');

    try {
        // 0. Reset Current Week Status (Clean Slate)
        // -----------------------------------------------------
        if (!IS_RESUME && !DRY_RUN) {
            console.log('🔄 resetting Current_Week_Status for all users...');
            // Fetch everyone who has a status
            const usersWithStatus = await base(MEMBERS_TABLE).select({
                filterByFormula: "NOT({Current_Week_Status} = '')",
                fields: []
            }).all();

            if (usersWithStatus.length > 0) {
                console.log(`   🧹 Clearing status for ${usersWithStatus.length} users...`);
                const updates = usersWithStatus.map(r => ({ id: r.id, fields: { 'Current_Week_Status': null } }));

                for (let i = 0; i < updates.length; i += 10) {
                    await base(MEMBERS_TABLE).update(updates.slice(i, i + 10));
                }
                console.log('   ✅ Statuses cleared.');
            } else {
                console.log('   ✨ No statuses to clear.');
            }
        } else if (IS_RESUME) {
            console.log('⏩ [RESUME MODE] Skipping status reset.');
        }

        // 1. Fetch Active Members
        // -----------------------------------------------------
        console.log(`🔍 Fetching members with Next_Week_Status = 'Active'...`);
        const activeMembers = await base(MEMBERS_TABLE).select({
            filterByFormula: "AND({Next_Week_Status} = 'Active', {Consent_GDPR})"
        }).all();
        console.log(`✅ Found ${activeMembers.length} active members.`);

        if (activeMembers.length < 2) {
            console.log("⚠️ Not enough members to match.");
            return;
        }

        // 2. Fetch Match History (Crucial for AI Context)
        // -----------------------------------------------------
        console.log(`🔍 Fetching match history...`);
        const allMatches = await base(MATCHES_TABLE).select({
            fields: ['Member1', 'Member2', 'Week_Start']
        }).all();

        const previousMatches = []; // List of "ID1:ID2" strings
        const matchedThisWeek = new Set();

        allMatches.forEach(record => {
            const m1 = record.fields.Member1 ? record.fields.Member1[0] : null;
            const m2 = record.fields.Member2 ? record.fields.Member2[0] : null;
            const week = record.fields.Week_Start;

            if (m1 && m2) {
                // Normalize pair string directly (Alphabetical order)
                const pairKey = [m1, m2].sort().join(':');
                previousMatches.push(pairKey);

                if (week === weekStartStr) {
                    matchedThisWeek.add(m1);
                    matchedThisWeek.add(m2);
                }
            }
        });

        console.log(`✅ Loaded ${previousMatches.length} historical match records.`);

        // 3. Filter Candidates
        // -----------------------------------------------------
        // Remove those already matched *this week* (e.g. if script re-runs)
        const candidates = activeMembers.filter(m => !matchedThisWeek.has(m.id));
        console.log(`ℹ️  Eligible candidates for AI: ${candidates.length}`);

        if (candidates.length < 2) {
            console.log("⚠️ Not enough unmatched candidates.");
            return;
        }

        // 4. Prepare Data for AI
        // -----------------------------------------------------
        const candidatesData = candidates.map(m => ({
            id: m.id,
            name: m.fields.Name,
            username: m.fields.Tg_Username,
            languages: m.fields.Languages || [],
            timezone_offset: getTzOffset(m.fields.Time_Zone),
            profession: m.fields.Profession,
            professional_interests: [
                ...(m.fields.Professional_Interests || []),
                m.fields.Other_Professional_Interests
            ].filter(Boolean),
            personal_interests: [
                ...(m.fields.Personal_Interests || []),
                m.fields.Other_Personal_Interests
            ].filter(Boolean),
            goals: m.fields.Coffee_Goals || [],
            bio: (m.fields.Professional_Description || "") + " " + (m.fields.Personal_Description || "")
        }));

        // Limit history? If history is huge, we might hit context limits (though Gemini is 1M+).
        // 1000 users = 500 matches/week. 1 year = 26k matches. 
        // 26k * 40 chars = 1MB text. Easy for Gemini Pro.
        // We pass the list of Forbidden Pairs.

        // 5. Construct Prompt
        // -----------------------------------------------------
        const systemPrompt = `You are an expert matchmaker for Linked Coffee.
Your goal is to pair these users to maximize meaningful connections.

**HARD RULES (Violation = INVALID Match):**
1. **Language**: Partners MUST share at least one language.
2. **Timezone**: Absolute difference in 'timezone_offset' MUST be <= 6.
3. **History**: Do NOT pair users if their IDs appear in the 'previous_matches' list.
4. **Uniqueness**: Each user can strictly be in only ONE pair.

**Optimization Strategy:**
- Maximize overlap in Professional and Personal Interests.
- Align specific 'Goals' (e.g. Professional Chat vs Casual).
- Explain your REASONING for each pair.
- If some users cannot be matched validly, list them in 'leftovers'.

**Output Format (STRICT JSON):**
{
  "matches": [
    {
      "user1_id": "recXXXXXXXX",
      "user2_id": "recYYYYYYYY",
      "reasoning": "Explanation..."
    }
  ],
  "leftovers": ["recZZZZZZZZ"]
}`;

        const userPrompt = JSON.stringify({
            candidates: candidatesData,
            previous_matches: previousMatches
        }, null, 2);

        // 6. Call AI (with Retry Logic)
        // -----------------------------------------------------
        const MAX_LOGIC_RETRIES = 3;
        let attempt = 0;
        let success = false;
        let pairsToCreate = []; // Will hold the final validated list
        let retryFeedback = "";

        while (attempt < MAX_LOGIC_RETRIES && !success) {
            attempt++;
            console.log(`🤖 Requesting matches from ${MODEL_NAME} (Attempt ${attempt}/${MAX_LOGIC_RETRIES})...`);

            // Append explicit feedback if this is a retry
            let currentSystemPrompt = systemPrompt;
            if (retryFeedback) {
                console.log(`   🔄 Including feedback: "${retryFeedback.substring(0, 100)}..."`);
                currentSystemPrompt += `\n\n🚨 CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT: ${retryFeedback}\n\nYour previous response was REJECTED. Start completely over.`;
            }

            const aiResult = await callGemini(currentSystemPrompt, userPrompt);

            if (!aiResult) {
                console.error("❌ AI returned null response. Retrying...");
                continue;
            }

            let proposedMatches = [];
            // Handle various JSON shapes
            if (Array.isArray(aiResult)) {
                proposedMatches = aiResult;
            } else if (aiResult.matches) {
                proposedMatches = aiResult.matches;
                leftovers = aiResult.leftovers || [];
            } else {
                console.error(`❌ AI returned invalid structure: ${JSON.stringify(aiResult).substring(0, 100)}`);
                // If structure is bad, we retry
                retryFeedback = "Invalid JSON structure. Ensure you return an object with a 'matches' array.";
                continue;
            }

            console.log(`✅ AI proposed ${proposedMatches.length} matches. Validating against history...`);

            // 7. Validate (Fail-Fast Strategy)
            // -----------------------------------------------------
            let currentBatchValid = true;
            let currentBatchPairs = [];
            let duplicatesFound = [];

            for (const match of proposedMatches) {
                // Normalize keys
                const id1 = match.user_id_1 || match.user1_id || match.User1_ID;
                const id2 = match.user_id_2 || match.user2_id || match.User2_ID;
                const reason = match.reason || match.reasoning || match.Reason || "";

                const u1 = candidates.find(c => c.id === id1);
                const u2 = candidates.find(c => c.id === id2);

                if (!u1 || !u2) {
                    // Unknown ID is a soft error, but if we strictly want to be safe, warn and skip
                    console.warn(`   ⚠️ Unknown ID returned: ${id1} or ${id2}`);
                    continue;
                }

                // 🔍 HISTORY CHECK
                const pairKey = [u1.id, u2.id].sort().join(':');
                if (previousMatches.includes(pairKey)) {
                    duplicatesFound.push(`${u1.fields.Name} & ${u2.fields.Name}`);
                    currentBatchValid = false; // Mark batch as failed
                }

                if (currentBatchValid) {
                    currentBatchPairs.push({ u1, u2, reason });
                }
            }

            if (!currentBatchValid) {
                console.warn(`🛑 Batch rejected! Found ${duplicatesFound.length} repeat matches: ${duplicatesFound.join(', ')}`);
                retryFeedback = `Constraint Violation: You matched users who have ALREADY matched in the past. \nForbidden Pairs found in your last attempt: ${duplicatesFound.join(', ')}. \nPLEASE CHECK THE 'previous_matches' LIST CAREFULLY.`;
                // Correctly loop back to retry
            } else {
                if (proposedMatches.length > 0 && currentBatchPairs.length === 0) {
                    console.warn("⚠️ All proposed matches were invalid (unknown IDs). Retrying...");
                    retryFeedback = "All returned IDs were invalid/unknown. Use ONLY the IDs provided in the candidates list.";
                    continue;
                }

                console.log("✨ Validation passed. Proceeding with execution.");
                pairsToCreate = currentBatchPairs;
                success = true;
            }
        }

        if (!success) {
            console.error("❌ Aborting: Could not generate a valid match list after " + MAX_LOGIC_RETRIES + " attempts.");
            return;
        }

        // 8. Execute Changes
        // -----------------------------------------------------
        const { generateMatchIntros } = require('../prompts/get_match_description');
        const { generateMatchImage } = require('./generate-match-images'); // Import from sibling file

        // 7.5 Generate Intros & Images for Matches
        // -----------------------------------------------------
        if (DRY_RUN) {
            console.log("\n👀 DRY RUN REPORT:");
            // (Simple log without generating intros to save tokens/time during quick tests, 
            //  unless we really want to test intros? Let's skip expensive intro generation for dry run)
            pairsToCreate.forEach((p, i) => {
                console.log(`\nMatch #${i + 1}: ${p.u1.fields.Name} <-> ${p.u2.fields.Name}`);
                console.log(`   Logic: ${p.reason}`);
            });
            console.log(`\nLeftovers: ${leftovers.join(', ')}`);

        } else {
            console.log(`\n🤖 Generating detailed introductions & images for ${pairsToCreate.length} pairs...`);

            // Process sequentially or in batches to respect rate limits if needed
            // (Standard Anthropic limits are usually generous enough for small batches, but let's be safe)
            const enrichedPairs = [];

            for (const p of pairsToCreate) {
                let intro1 = null;
                let intro2 = null;
                let sharedIntro = p.reason ? `🤖 AI Logic: ${p.reason}` : "";
                let introImageUrl = null;

                // 1. Generate Text Intros
                console.log(`   📝 Generating intro for ${p.u1.fields.Name} & ${p.u2.fields.Name}...`);
                try {
                    // Call the generator with the Gemini Reason AND configured model/tokens
                    const introModelName = (config.ai && config.ai.introModel) || "claude-haiku-4-5-20251001";
                    const maxTokens = (config.ai && config.ai.maxTokens) || 2000;

                    const introResult = await generateMatchIntros(p.u1.fields, p.u2.fields, p.reason, introModelName, maxTokens);

                    if (introResult.success) {
                        // Map internal intro objects to strings if needed, or store JSON?
                        // Schema says "Text". Usually we store the JSON string to be parsed by bot/frontend.
                        intro1 = JSON.stringify(introResult.introFor[p.u1.fields.Tg_ID]);
                        intro2 = JSON.stringify(introResult.introFor[p.u2.fields.Tg_ID]);

                        // Combine logic with the nice human-readable shared ground
                        // e.g. "🤖 AI Match Logic: ... \n\n🤝 Shared Context: ..."
                        sharedIntro = introResult.sharedCombined + (p.reason ? `\n\n(AI Logic: ${p.reason})` : "");
                    } else {
                        console.warn(`      ⚠️ Text Intro failed: ${introResult.error}`);
                    }
                } catch (err) {
                    console.error(`      ❌ Text Intro Error:`, err.message);
                }

                // 2. Generate Image
                console.log(`   🎨 Generating image...`);
                try {
                    // Pass the nice human shared intro (or the reason if intro failed) to the image generator
                    const contextForImage = sharedIntro || p.reason;
                    const imgResult = await generateMatchImage(p.u1, p.u2, contextForImage);

                    if (imgResult.success) {
                        introImageUrl = imgResult.publicUrl;
                        console.log(`      ✅ Image created: ${introImageUrl}`);
                    } else {
                        console.warn(`      ⚠️ Image generation skipped: ${imgResult.reason || imgResult.error}`);
                    }
                } catch (imgErr) {
                    console.error(`      ❌ Image Generation Error:`, imgErr.message);
                }

                enrichedPairs.push({
                    ...p,
                    intro1,
                    intro2,
                    sharedIntro,
                    introImageUrl
                });
            }

            console.log(`\n💾 Saving ${enrichedPairs.length} matches to Airtable...`);

            // Prepare records
            const records = enrichedPairs.map(p => {
                const fields = {
                    'Week_Start': weekStartStr,
                    'Member1': [p.u1.id],
                    'Member2': [p.u2.id],
                    'Status': 'Matched',
                    'Notifications': 'Pending',
                    'Intro_1': p.intro1,
                    'Intro_2': p.intro2,
                    'Shared_Intro': p.sharedIntro,
                    'View_Token_1': generateViewToken(),
                    'View_Token_2': generateViewToken()
                };

                // Add image if exists (Airtable expects array of objects with url)
                if (p.introImageUrl) {
                    fields['Intro_Image'] = [{ url: p.introImageUrl }];
                }

                return { fields };
            });

            // Batch Create
            for (let i = 0; i < records.length; i += 10) {
                const batch = records.slice(i, i + 10);
                await base(MATCHES_TABLE).create(batch);
                console.log(`   - Created ${batch.length} matches...`);
            }

            // Update Member Status
            console.log('💾 Updating members status...');
            const updates = [];
            pairsToCreate.forEach(p => {
                updates.push({ id: p.u1.id, fields: { 'Current_Week_Status': 'Matched' } });
                updates.push({ id: p.u2.id, fields: { 'Current_Week_Status': 'Matched' } });
            });


            for (let i = 0; i < updates.length; i += 10) {
                const batch = updates.slice(i, i + 10);
                await base(MEMBERS_TABLE).update(batch);
            }
            console.log('✅ Done.');

            // Log to Airtable System Logs
            try {
                await base(LOGS_TABLE).create([{
                    fields: {
                        'Event': 'Activated', // System event
                        'Category': 'System',
                        'Source_Script': 'match-users-ai', // Custom tag for this script
                        'Sent_Status': 'Sent',
                        'Message_Content': `🤖 AI Matching Run Completed.\nModel: ${MODEL_NAME}\nMatches Created: ${records.length}\nNote: Intros generated successfully.`
                    }
                }], { typecast: true });
                console.log('📝 System log created in Airtable.');
            } catch (logErr) {
                console.error('⚠️ Failed to create system log:', logErr);
            }
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

main();
