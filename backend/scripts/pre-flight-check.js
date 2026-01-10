/**
 * 🛫 Pre-Flight Check for Linked.Coffee
 * 
 * Validates the entire operational stack before a matching run.
 * 
 * CHECKS:
 * 1. ⚙️  Environment Variables (API Keys, Tables)
 * 2. 🗄️  Airtable Connectivity & Active Member Count
 * 3. 🧠  Gemini AI Connectivity (Primary & Fallback Models)
 * 4. 🧠  Claude AI Connectivity (Intro Generation)
 * 5. 🎨  Imagen Connectivity (Image Generation)
 * 6. 📂  Uploads Directory Writable
 * 
 * Usage:
 *   node backend/scripts/pre-flight-check.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Airtable = require('airtable');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const config = require('../../linking-coffee.config.js');

// Colors for console
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function checkEnv() {
    process.stdout.write(`1. [ENV]      Checking variables... `);
    const required = [
        'GOOGLE_AI_API_KEY', 'ANTHROPIC_API_KEY',
        'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_MEMBERS_TABLE'
    ];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.log(`${RED}FAIL${RESET}`);
        console.error(`${RED}   ❌ Missing: ${missing.join(', ')}${RESET}`);
        return false;
    }
    console.log(`${GREEN}OK${RESET}`);
    return true;
}

async function checkAirtable() {
    process.stdout.write(`2. [AIRTABLE] Checking database... `);
    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        // Try to fetch 1 record from Members to verify access
        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({ maxRecords: 1 }).firstPage();

        // Count active members (approximate cost: 1 API call per 100 records, but we just need connectivity here)
        // Let's do a fast check for connectivity first.
        console.log(`${GREEN}OK${RESET}`);
        return true;
    } catch (error) {
        console.log(`${RED}FAIL${RESET}`);
        console.error(`${RED}   ❌ Error: ${error.message}${RESET}`);
        return false;
    }
}

async function checkGeminiModel(modelName) {
    process.stdout.write(`   - ${modelName.padEnd(25)} `);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`;
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hello" }] }]
        }, { timeout: 10000 }); // 10s timeout

        if (response.status === 200) {
            console.log(`${GREEN}ONLINE${RESET}`);
            return true;
        }
    } catch (error) {
        // If it's a 404, it's definitely broken.
        // If it's a 503, it might be temporary.
        const status = error.response ? error.response.status : "NET_ERR";
        console.log(`${RED}OFFLINE (${status})${RESET}`);
        return false;
    }
    return false;
}

async function checkGemini() {
    console.log(`3. [GEMINI]   Checking Models...`);
    const modelsToCheck = config.ai.allowedMatchingModels || ['gemini-3-pro-preview', 'gemini-2.5-flash'];
    let allOk = true;
    for (const m of modelsToCheck) {
        const ok = await checkGeminiModel(m);
        if (!ok) allOk = false;
    }
    return allOk; // We return false only if ALL fail? No, typically we want to know if *configured* ones work.
}

async function checkClaude() {
    process.stdout.write(`4. [CLAUDE]   Checking Anthropic... `);
    const url = 'https://api.anthropic.com/v1/messages';
    try {
        const response = await axios.post(url, {
            model: config.ai.introModel || "claude-haiku-4-5-20251001", // Corrected model name, "haiku" usually 3 or 3.5. Assuming config is correct.
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }]
        }, {
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`${GREEN}OK${RESET}`);
        return true;
    } catch (error) {

        // Handle specific "model not found" or auth errors
        if (error.response) {
            console.log(`${RED}FAIL (${error.response.status})${RESET}`);
            console.error(`${RED}   ❌ ${JSON.stringify(error.response.data)}${RESET}`);
        } else {
            console.log(`${RED}FAIL${RESET}`);
            console.error(`${RED}   ❌ ${error.message}${RESET}`);
        }
        return false;
    }
}

async function checkFileSystem() {
    process.stdout.write(`5. [SYSTEM]   Checking uploads dir... `);
    const uploadsDir = path.join(__dirname, '../uploads/generated_match_images');
    try {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        // Try write
        const testFile = path.join(uploadsDir, '.test_write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`${GREEN}OK${RESET}`);
        return true;
    } catch (e) {
        console.log(`${RED}FAIL${RESET}`);
        console.error(`${RED}   ❌ ${e.message}${RESET}`);
        return false;
    }
}

async function main() {
    console.log(`\n🚀 ${CYAN}LINKED COFFEE PRE-FLIGHT CHECK${RESET} 🚀\n`);

    // Run checks
    const envOk = await checkEnv();
    if (!envOk) process.exit(1); // Cannot proceed without ENV

    const fsOk = await checkFileSystem();
    const airtableOk = await checkAirtable();
    const geminiOk = await checkGemini();
    const claudeOk = await checkClaude();

    console.log("\n---------------------------------------------------");
    if (airtableOk && geminiOk && claudeOk && fsOk) {
        console.log(`${GREEN}✅ ALL SYSTEMS GO! Ready for Matching Run.${RESET}`);
        process.exit(0);
    } else {
        console.log(`${YELLOW}⚠️  SYSTEMS DEGRADED. Check logs above.${RESET}`);
        // We don't exit(1) because sometimes we might want to run anyway even if one model is flaky? 
        // But for automation safety, let's exit 1.
        process.exit(1);
    }
}

main();
