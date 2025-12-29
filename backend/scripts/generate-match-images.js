/**
 * Generate Match Images Script
 * 
 * This script generates a personalized "Social Card" for matched users.
 * It uses Google Gemini to create a scene prompt based on shared interests,
 * generates a background image using Google Imagen (via REST API),
 * and overlays the users' avatars using Sharp (Premium Composition).
 * 
 * Usage:
 *   node backend/scripts/generate-match-images.js [flags]
 * in VPS
 *   docker exec -it linking-coffee-backend node scripts/generate-match-images.js --match-num=37
 * 
 * Flags:
 *   --max-matches=N   : Limit processing to N matches
 *   --match-id=ID     : Process only a specific match (Airtable Record ID)
 *   --dry-run         : Generate images locally but don't upload to Airtable
 *   --force           : Regenerate images even if they already exist
 *   --match-num=N     : Process only a specific match number (Airtable Record ID)
 * 
 * Dependencies:
 *   npm install sharp axios @google/generative-ai form-data
 */ // turbo

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const MATCHES_TABLE = process.env.AIRTABLE_MATCHES_TABLE || 'tblx2OEN5sSR1xFI2';
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE || 'tblCrnbDupkzWUx9P';
const API_KEY = process.env.GOOGLE_AI_API_KEY; // Google AI Studio Key

// Load Project Config
let config = {};
try {
    config = require('../../linking-coffee.config.js');
} catch (e) {
    try {
        config = require('../linking-coffee.config.js'); // Docker path usually
    } catch (e2) {
        config = { ai: { promptModel: "gemini-3-flash-preview", imageModel: "imagen-3.0-generate-001" } };
    }
}
const PROMPT_MODEL_NAME = (config.ai && config.ai.promptModel) || "gemini-3-flash-preview";
const IMAGE_MODEL_NAME = (config.ai && config.ai.imageModel) || "imagen-3.0-generate-001";


// --- Arguments ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const maxMatchesArg = args.find(a => a.startsWith('--max-matches='));
const MAX_MATCHES = maxMatchesArg ? parseInt(maxMatchesArg.split('=')[1]) : Infinity;
const matchIdArg = args.find(a => a.startsWith('--match-id='));
const TARGET_MATCH_ID = matchIdArg ? matchIdArg.split('=')[1] : null;
const matchNumArg = args.find(a => a.startsWith('--match-num='));
const TARGET_MATCH_NUM = matchNumArg ? matchNumArg.split('=')[1] : null;

if (!API_KEY) {
    console.error('❌ Missing GOOGLE_AI_API_KEY in .env');
    process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Initialize Gemini (Text)
const genAI = new GoogleGenerativeAI(API_KEY);
const textModel = genAI.getGenerativeModel({ model: PROMPT_MODEL_NAME }); // Use configurable model

// --- Utils ---

// Download image to buffer with timeout and retry
async function downloadImage(url) {
    if (!url) return null;
    try {
        const response = await axios({
            url,
            responseType: 'arraybuffer',
            timeout: 10000
        });
        return Buffer.from(response.data);
    } catch (e) {
        console.warn(`   ⚠️  Failed to download image: ${e.message}`);
        return null;
    }
}

// Generate Scene Prompt using Gemini
async function generateScenePrompt(m1, m2, sharedIntro) {
    const p1 = m1.fields;
    const p2 = m2.fields;

    const prompt = `
    Two professionals are meeting for a virtual coffee chat.
    Person 1: ${p1.Name}, Interests: ${(p1.Personal_Interests || []).join(', ')}, Profession: ${p1.Profession}
    Person 2: ${p2.Name}, Interests: ${(p2.Personal_Interests || []).join(', ')}, Profession: ${p2.Profession}
    Shared Context: ${sharedIntro || 'They are both interesting tech professionals.'}

    Create a visual description for a creative digital space or virtual background that represents the intersection of their worlds.
    The goal is to create a cool, personalized "shared virtual room".
    The style should be "Digital Art, vibrant, warm, minimal, high quality, 4k".
    Keep it under 40 words. 
    Examples:
    - "A cozy futuristic UI interface floating in clouds with code holograms and coffee icons"
    - "Abstract digital portal merging a forest and a server room, soft neon lighting"
    
    Output just the prompt text.
    `;

    const result = await textModel.generateContent(prompt);
    return result.response.text().trim();
}

// Generate Full Image using Gemini (Background + Avatars)
async function generateFullImage(prompt, avatar1Buffer, avatar2Buffer) {
    console.log(`   🎨 Generative Prompt: "${prompt}"`);

    // Initialize the specific image generation model
    const imageModel = genAI.getGenerativeModel({ model: IMAGE_MODEL_NAME });

    try {
        const parts = [
            {
                text: `Create a high-quality 3D digital art poster featuring TWO characters based on the provided input images.

THE SCENE:
${prompt}

INSTRUCTIONS:
1. CAST: You MUST include the two people from the input images as the main subjects.
2. COMPOSITION: Place them side-by-side in the center, waist-up, facing the viewer.
3. STYLE: Premium Concept Art, Unreal Engine 5, Volumetric Lighting, Cinematic.
4. TRANSFORMATION: Stylize the characters to match the scene's aesthetic (e.g., matching lighting and texture) while preserving their key facial features and identity.
5. FOCUS: The characters are the heroes of this image. Do not generate an empty room.
6. FORMAT: Square (1:1 aspect ratio).

Output a single square image.` }
        ];

        // Add avatars
        if (avatar1Buffer) {
            parts.push({
                inlineData: {
                    data: avatar1Buffer.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            });
        }
        if (avatar2Buffer) {
            parts.push({
                inlineData: {
                    data: avatar2Buffer.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            });
        }

        // Request image generation
        const result = await imageModel.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });
        const response = await result.response;

        // Cost logging
        if (response.usageMetadata) {
            const usage = response.usageMetadata;
            const inputTokens = usage.promptTokenCount || 0;
            const outputTokens = usage.candidatesTokenCount || 0;
            const inputCost = (inputTokens / 1000000) * 0.075;
            const outputCost = (outputTokens / 1000000) * 0.30;
            console.log(`   💰 Usage: ${inputTokens} in / ${outputTokens} out | Est. Cost: $${(inputCost + outputCost).toFixed(6)}`);
        }

        // Check content
        const candidates = response.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    console.log(`   ✅ Received full image (Mime: ${part.inlineData.mimeType})`);
                    return Buffer.from(part.inlineData.data, 'base64');
                }
            }
        }

        const text = response.text();
        console.warn(`   ⚠️  Model returned text instead of image: "${text.substring(0, 50)}..."`);

        // Retry with safe prompt if failed, but without avatars to be safe if identity was the blocker
        if (!prompt.includes("SAFE_FALLBACK")) {
            console.log("   🔄 Retrying with SAFE Abstract Fallback prompt (No Avatars)...");
            const SAFE_PROMPT = "SAFE_FALLBACK: A beautiful abstract digital art composition representing connection and synergy, geometric shapes, warm lighting, 3D render, minimalist, high resolution square image.";
            return await generateFullImage(SAFE_PROMPT, null, null);
        }

        return null;

    } catch (error) {
        console.error('   ⚠️  Image Generation failed:', error.message);
        return null;
    }
}

// --- Main ---

async function main() {
    console.log(`🚀 Starting Match Image Generator`);
    console.log(`   Max Matches: ${MAX_MATCHES === Infinity ? 'Unlimited' : MAX_MATCHES}`);
    console.log(`   Target Match ID: ${TARGET_MATCH_ID || 'None'}`);
    console.log(`   Target Match Num: ${TARGET_MATCH_NUM || 'None'}`);

    try {
        // 1. Fetch Matches
        let filterFormula = '';
        if (TARGET_MATCH_ID) {
            filterFormula = `RECORD_ID() = '${TARGET_MATCH_ID}'`;
        } else if (TARGET_MATCH_NUM) {
            filterFormula = `{Num} = ${TARGET_MATCH_NUM}`;
        } else {
            // Default: Filter by Current Week Start AND Status=Matched AND No Image
            const today = new Date();
            const getMonday = (d) => {
                d = new Date(d);
                const day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
                const mon = new Date(d.setDate(diff));
                mon.setHours(0, 0, 0, 0);
                return mon;
            };
            const formatDate = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const currentWeekStart = formatDate(getMonday(today));
            console.log(`   Targeting Week: ${currentWeekStart}`);

            // If FORCE is used, we ignore {Intro_Image} = BLANK() check?
            // Usually we only run force with a specific ID.
            // If running batch with force, be careful.

            if (FORCE) {
                filterFormula = `AND({Status} = 'Matched', {Member1} != BLANK(), {Member2} != BLANK(), IS_SAME({Week_Start}, "${currentWeekStart}", 'day'))`;
            } else {
                filterFormula = `AND({Status} = 'Matched', {Intro_Image} = BLANK(), {Member1} != BLANK(), {Member2} != BLANK(), IS_SAME({Week_Start}, "${currentWeekStart}", 'day'))`;
            }
        }

        const matches = await base(MATCHES_TABLE).select({
            filterByFormula: filterFormula,
            maxRecords: (TARGET_MATCH_ID || TARGET_MATCH_NUM) ? 1 : MAX_MATCHES
        }).all();

        console.log(`🔍 Found ${matches.length} match(es) to process.`);

        // Process
        for (const match of matches) {
            const mId = match.id;
            const m1Ids = match.fields.Member1;
            const m2Ids = match.fields.Member2;
            const sharedIntro = match.fields.Shared_Intro;

            if (!m1Ids || !m2Ids) continue;

            console.log(`\n🖼️  Processing Match ${mId}...`);

            // Fetch Member Details
            const m1 = await base(MEMBERS_TABLE).find(m1Ids[0]);
            const m2 = await base(MEMBERS_TABLE).find(m2Ids[0]);

            // Check Avatars
            const av1Url = m1.fields.Avatar && m1.fields.Avatar[0] ? m1.fields.Avatar[0].url : null;
            const av2Url = m2.fields.Avatar && m2.fields.Avatar[0] ? m2.fields.Avatar[0].url : null;

            if (!av1Url || !av2Url) {
                console.log(`   ⚠️  Missing avatars for ${m1.fields.Name} or ${m2.fields.Name}. Skipping.`);
                continue;
            }

            // 1. Download Avatars (Robust)
            console.log('   ⬇️  Downloading avatars...');
            const av1Buffer = await downloadImage(av1Url);
            const av2Buffer = await downloadImage(av2Url);

            // 2. Generate Scene Prompt
            console.log('   🤖 Generatings scene prompt...');
            const scenePrompt = await generateScenePrompt(m1, m2, sharedIntro);

            // 3. Generate Full Image (AI does compositing)
            const finalImageBuffer = await generateFullImage(scenePrompt, av1Buffer, av2Buffer);

            if (!finalImageBuffer) {
                console.log('   ❌ Failed to generate AI image. Skipping.');
                continue;
            }

            // 5. Upload/Save
            if (!DRY_RUN) {
                const filename = `match_${mId}_${Date.now()}.png`;
                const relativeUploadPath = '../uploads/generated_match_images';
                const outPath = path.join(__dirname, relativeUploadPath, filename);
                const publicUrl = `https://linked.coffee/uploads/generated_match_images/${filename}`;

                // Ensure dir exists
                fs.mkdirSync(path.dirname(outPath), { recursive: true });
                fs.writeFileSync(outPath, finalImageBuffer);

                console.log(`   💾 Saved locally to: ${outPath}`);
                console.log(`   🔗 Public URL: ${publicUrl}`);

                try {
                    console.log('   ☁️  Uploading to Airtable...');
                    await base(MATCHES_TABLE).update([{
                        id: mId,
                        fields: {
                            'Intro_Image': [
                                { url: publicUrl }
                            ]
                        }
                    }]);
                    console.log('   ✅ Airtable updated successfully!');
                } catch (uploadErr) {
                    console.error('   ❌ Failed to update Airtable:', uploadErr.message);
                }

            } else {
                console.log('   👀 Dry Run: Image generated in memory (would be saved). Size:', finalImageBuffer.length);
                const outPath = path.join(__dirname, `dry_run_${mId}.png`);
                fs.writeFileSync(outPath, finalImageBuffer);
                console.log(`   💾 Saved dry run to: ${outPath}`);
            }
        }

    } catch (e) {
        console.error('❌ Error in generate-match-images:', e);
    }
}

// --- Exported Logic ---

async function generateMatchImage(member1, member2, sharedIntro) {
    try {
        // Check Avatars
        const av1Url = member1.fields.Avatar && member1.fields.Avatar[0] ? member1.fields.Avatar[0].url : null;
        const av2Url = member2.fields.Avatar && member2.fields.Avatar[0] ? member2.fields.Avatar[0].url : null;

        if (!av1Url || !av2Url) {
            return { success: false, reason: 'missing_avatars' };
        }

        // 1. Download
        const av1Buffer = await downloadImage(av1Url);
        const av2Buffer = await downloadImage(av2Url);

        // 2. Prompt
        const scenePrompt = await generateScenePrompt(member1, member2, sharedIntro);

        // 3. Generate
        const finalImageBuffer = await generateFullImage(scenePrompt, av1Buffer, av2Buffer);

        if (!finalImageBuffer) {
            return { success: false, reason: 'generation_failed' };
        }

        // 4. Save
        const filename = `match_${member1.id}_${member2.id}_${Date.now()}.png`;
        const relativeUploadPath = '../uploads/generated_match_images';
        const outPath = path.join(__dirname, relativeUploadPath, filename);
        // Ensure dir exists
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, finalImageBuffer);

        const publicUrl = `https://linked.coffee/uploads/generated_match_images/${filename}`;

        return {
            success: true,
            publicUrl: publicUrl,
            localPath: outPath
        };

    } catch (error) {
        console.error('   ❌ Error generating match image:', error);
        return { success: false, error: error.message };
    }
}



if (require.main === module) {
    main();
}

module.exports = { generateMatchImage };
