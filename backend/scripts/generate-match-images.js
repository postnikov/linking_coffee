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
    IMPORANT: The center of the image should be relatively empty or clean, as we will overlay characters there.
    Keep it under 40 words. 
    Examples:
    - "A cozy futuristic UI interface floating in clouds with code holograms and coffee icons, open center"
    - "Abstract digital portal merging a forest and a server room, soft neon lighting, clean middle ground"
    
    Output just the prompt text.
    `;

    const result = await textModel.generateContent(prompt);
    return result.response.text().trim();
}

// Generate Image using Gemini (Background Only)
async function generateBackgroundImage(prompt) {
    console.log(`   🎨 Generative Prompt: "${prompt}"`);

    // Initialize the specific image generation model
    const imageModel = genAI.getGenerativeModel({ model: IMAGE_MODEL_NAME });

    try {
        // We do NOT pass avatars to the model anymore. We want a clean background.
        const parts = [
            { text: `${prompt}\n\nIMPORTANT: Create a single high-quality BACKGROUND IMAGE. Style: Digital Art, 3D Render, Abstract, No Text. Leave center empty.` }
        ];

        // Request image generation
        const result = await imageModel.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });
        const response = await result.response;

        // --- Cost Calculation ---
        if (response.usageMetadata) {
            const usage = response.usageMetadata;
            const inputTokens = usage.promptTokenCount || 0;
            const outputTokens = usage.candidatesTokenCount || 0;

            // Pricing (Estimated for Flash Tier - adjust as needed)
            // Input: $0.075 per 1M tokens
            // Output: $0.30 per 1M tokens
            // Note: Images in prompt contribute to input tokens significantly (~258 tokens per image typically)
            const inputCost = (inputTokens / 1000000) * 0.075;
            const outputCost = (outputTokens / 1000000) * 0.30;
            const totalCost = inputCost + outputCost;

            console.log(`   💰 Usage: ${inputTokens} in / ${outputTokens} out | Est. Cost: $${totalCost.toFixed(6)}`);
        }

        // Check content
        const candidates = response.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    console.log(`   ✅ Received background image (Mime: ${part.inlineData.mimeType})`);
                    return Buffer.from(part.inlineData.data, 'base64');
                }
            }
        }

        const text = response.text();
        console.warn(`   ⚠️  Model returned text instead of image: "${text.substring(0, 50)}..."`);

        // Retry with safe prompt
        if (!prompt.includes("SAFE_FALLBACK")) {
            console.log("   🔄 Retrying with SAFE Abstract Fallback prompt...");
            const SAFE_PROMPT = "SAFE_FALLBACK: A beautiful abstract digital art composition representing connection and synergy, geometric shapes, warm lighting, 3D render, minimalist, high resolution, empty center.";
            return await generateBackgroundImage(SAFE_PROMPT);
        }

        return null;

    } catch (error) {
        console.error('   ⚠️  Image Generation failed:', error.message);
        return null;
    }
}

// Generate Initials SVG Buffer
function getInitialsSVG(name, size) {
    const initials = name
        ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : '??';
    const color = '#6366f1'; // Indigo-500

    return Buffer.from(`
        <svg width="${size}" height="${size}">
            <rect x="0" y="0" width="${size}" height="${size}" fill="${color}"/>
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
                  fill="white" text-anchor="middle" dy=".3em" font-weight="bold">${initials}</text>
        </svg>
    `);
}

// Helper: Create Circular Avatar with Border
async function prepareAvatar(buffer, size, borderColor = 'white', borderWidth = 8, nameForFallback = 'User') {
    let inputBuffer = buffer;

    // Fallback if no buffer
    if (!inputBuffer) {
        inputBuffer = getInitialsSVG(nameForFallback, size);
    }

    // Resize and Crop to Circle
    const circleShape = Buffer.from(`<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`);

    // Create the image clipped to circle
    const avatar = await sharp(inputBuffer)
        .resize(size, size, { fit: 'cover' })
        .composite([{ input: circleShape, blend: 'dest-in' }])
        .png() // Ensure alpha channel
        .toBuffer();

    // Create a larger circle for the border
    const totalSize = size + (borderWidth * 2);
    const borderSvg = Buffer.from(`
        <svg width="${totalSize}" height="${totalSize}">
            <circle cx="${totalSize / 2}" cy="${totalSize / 2}" r="${size / 2 + borderWidth / 2}" 
                    fill="none" stroke="${borderColor}" stroke-width="${borderWidth}"/>
        </svg>
    `);

    // Composite avatar onto centered transparent canvas then add border? 
    // Easier: Composite avatar onto a solid color circle (border) 
    // OR just overlay border ring on top.

    return sharp({
        create: {
            width: totalSize,
            height: totalSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .composite([
            { input: avatar, top: borderWidth, left: borderWidth }, // Center the avatar
            { input: borderSvg, top: 0, left: 0 } // Overlay border
        ])
        .png()
        .toBuffer();
}

// Composite Images
async function compositeSocialCard(bgBuffer, avatar1Buffer, avatar2Buffer, name1, name2) {
    const WIDTH = 1200;
    const HEIGHT = 630;
    const AVATAR_SIZE = 240; // Size of the photo itself
    const BORDER = 8;

    // 1. Prepare Background
    const background = await sharp(bgBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .blur(8) // Blur background to make avatars pop
        .modulate({ brightness: 0.8 }) // Darken slightly
        .toBuffer();

    // 2. Prepare Avatars
    const av1 = await prepareAvatar(avatar1Buffer, AVATAR_SIZE, '#ffffff', BORDER, name1);
    const av2 = await prepareAvatar(avatar2Buffer, AVATAR_SIZE, '#ffffff', BORDER, name2);

    // 3. Composite
    // Positions: Centered vertically. 
    // Spacing: 
    const centerY = (HEIGHT - (AVATAR_SIZE + BORDER * 2)) / 2;
    const centerX = WIDTH / 2;
    const offset = 180; // Distance from center

    const card = await sharp(background)
        .composite([
            { input: av1, top: Math.floor(centerY), left: Math.floor(centerX - offset - (AVATAR_SIZE + BORDER * 2)) },
            { input: av2, top: Math.floor(centerY), left: Math.floor(centerX + offset) },
            // Add a "Link" icon or "+" in the middle
            {
                input: Buffer.from(`<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="white" opacity="0.2"/><text x="50" y="50" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dy=".35em" font-weight="bold">&amp;</text></svg>`),
                top: Math.floor(HEIGHT / 2 - 50),
                left: Math.floor(WIDTH / 2 - 50)
            }
        ])
        .png()
        .toBuffer();

    return card;
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
            const name1 = m1.fields.Name || 'Member 1';
            const name2 = m2.fields.Name || 'Member 2';

            // 1. Download Avatars (Robust)
            console.log('   ⬇️  Downloading avatars...');
            const av1Buffer = await downloadImage(av1Url);
            const av2Buffer = await downloadImage(av2Url);

            // 2. Generate Scene Prompt
            console.log('   🤖 Generatings scene prompt...');
            const scenePrompt = await generateScenePrompt(m1, m2, sharedIntro);

            // 3. Generate Background Only
            const bgBuffer = await generateBackgroundImage(scenePrompt);

            if (!bgBuffer) {
                console.log('   ❌ Failed to generate background. Skipping.');
                continue;
            }

            // 4. Composite
            console.log('   🔨 Compositing social card...');
            const finalImageBuffer = await compositeSocialCard(bgBuffer, av1Buffer, av2Buffer, name1, name2);

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
        const name1 = member1.fields.Name || 'Member 1';
        const name2 = member2.fields.Name || 'Member 2';

        // Check Avatars
        const av1Url = member1.fields.Avatar && member1.fields.Avatar[0] ? member1.fields.Avatar[0].url : null;
        const av2Url = member2.fields.Avatar && member2.fields.Avatar[0] ? member2.fields.Avatar[0].url : null;

        // 1. Download
        const av1Buffer = await downloadImage(av1Url);
        const av2Buffer = await downloadImage(av2Url);

        // 2. Prompt
        const scenePrompt = await generateScenePrompt(member1, member2, sharedIntro);

        // 3. Generate Background
        const bgBuffer = await generateBackgroundImage(scenePrompt);

        if (!bgBuffer) {
            return { success: false, reason: 'background_generation_failed' };
        }

        // 4. Composite
        const finalImageBuffer = await compositeSocialCard(bgBuffer, av1Buffer, av2Buffer, name1, name2);

        // 5. Save
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
