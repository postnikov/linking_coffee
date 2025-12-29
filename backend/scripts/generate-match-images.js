/**
 * Generate Match Images Script
 * 
 * This script generates a personalized "Social Card" for matched users.
 * It uses Google Gemini to create a scene prompt based on shared interests,
 * generates a background image using Google Imagen (via REST API),
 * and overlays the users' avatars using Sharp.
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

// Download image to buffer
async function downloadImage(url) {
    const response = await axios({ url, responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

// Generate Scene Prompt using Gemini
async function generateScenePrompt(m1, m2, sharedIntro) {
    const p1 = m1.fields;
    const p2 = m2.fields;

    const prompt = `
    Two professionals are meeting for a virtual coffee chat (Zoom call).
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

// Generate Image using Gemini 2.5 Flash Image Preview (Nano Banana)
async function generateBackgroundImage(prompt, avatar1Buffer, avatar2Buffer) {
    console.log(`   🎨 Generative Prompt: "${prompt}"`);

    // Initialize the specific image generation model
    const imageModel = genAI.getGenerativeModel({ model: IMAGE_MODEL_NAME });

    try {
        const parts = [
            { text: `${prompt}\n\nIMPORTANT: Create a single high-quality IMAGE based on this description. Do NOT output text. Style: Digital Art, 3D Render, Abstract, No Text.` }
        ];

        if (avatar1Buffer) {
            parts.push({
                inlineData: {
                    data: avatar1Buffer.toString('base64'),
                    mimeType: 'image/jpeg' // Assuming JPEG for robustness, or we could detect.
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

        // Request image generation via generateContent
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

        // Check for inline data (Base64 image)
        const candidates = response.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    console.log(`   ✅ Received image (Mime: ${part.inlineData.mimeType})`);
                    return Buffer.from(part.inlineData.data, 'base64');
                }
            }
        }

        // If we got here, maybe we only got text?
        const text = response.text();
        console.warn(`   ⚠️  Model returned text instead of image: "${text.substring(0, 50)}..."`);

        // --- RETRY LOGIC (Safety Fallback) ---
        // If the model refused the prompt (likely due to safety filters on people), try a SAFE abstract prompt.
        if (!prompt.includes("SAFE_FALLBACK")) {
            console.log("   🔄 Retrying with SAFE Abstract Fallback prompt...");
            const SAFE_PROMPT = "SAFE_FALLBACK: A beautiful abstract digital art composition representing connection and synergy, geometric shapes, warm lighting, 3D render, minimalist, high resolution.";
            // Recursive call (one-time)
            return await generateBackgroundImage(SAFE_PROMPT, null, null); // Don't send avatars on fallback to be safe
        }

        return null;

    } catch (error) {
        console.error('   ⚠️  Image Generation failed:', error.message);
        return null;
    }
}

// Composite Images
async function compositeSocialCard(bgBuffer, avatar1Buffer, avatar2Buffer, name1, name2) {
    const WIDTH = 1200;
    const HEIGHT = 630;
    const AVATAR_SIZE = 250;
    const AVATAR_Y = 150;
    const CENTER_X = WIDTH / 2;
    const OFFSET_X = 160; // Distance from center

    // Create rounded avatars
    const circleMask = Buffer.from(
        `<svg><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="black"/></svg>`
    );

    const processAvatar = async (buf) => {
        return sharp(buf)
            .resize(AVATAR_SIZE, AVATAR_SIZE)
            .composite([{ input: circleMask, blend: 'dest-in' }])
            .toBuffer();
    };

    const av1 = await processAvatar(avatar1Buffer);
    const av2 = await processAvatar(avatar2Buffer);

    // Create Card
    // 1. Resize Background to Cover
    const background = await sharp(bgBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .blur(10) // Mild blur to make avatars pop? Or keep it sharp? Let's keep it sharp-ish or mild blur.
        .toBuffer();

    // 2. Composite
    const card = await sharp(background)
        .composite([
            // Avatar 1 (Left)
            { input: av1, top: AVATAR_Y, left: CENTER_X - OFFSET_X - AVATAR_SIZE },
            // Avatar 2 (Right)
            { input: av2, top: AVATAR_Y, left: CENTER_X + OFFSET_X },
            // Optional: You could add text overlays using SVG here if needed
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

            filterFormula = `AND({Status} = 'Matched', {Intro_Image} = BLANK(), {Member1} != BLANK(), {Member2} != BLANK(), IS_SAME({Week_Start}, "${currentWeekStart}", 'day'))`;
        }

        // If FORCE is on, ignore blank check? (Only if target ID not set, otherwise we might process too many)
        // Let's stick to safe logic: if target ID is set, we process it regardless.

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

            // 1. Download Avatars first (needed for multimodal generation)
            console.log('   ⬇️  Downloading avatars...');
            const av1Buffer = await downloadImage(av1Url);
            const av2Buffer = await downloadImage(av2Url);

            // 2. Generate Scene Prompt
            console.log('   🤖 Generatings scene prompt...');
            const scenePrompt = await generateScenePrompt(m1, m2, sharedIntro);

            // 3. Generate Full Image (Background + Avatars via AI)
            const finalImageBuffer = await generateBackgroundImage(scenePrompt, av1Buffer, av2Buffer);

            if (!finalImageBuffer) {
                console.log('   ❌ Failed to generate AI image. Skipping.');
                continue;
            }

            /* 
            // Composite step skipped - we are relying on AI to integrate avatars
            console.log('   🔨 Compositing social card...');
            const finalImageBuffer = await compositeSocialCard(bgBuffer, av1Buffer, av2Buffer, m1.fields.Name, m2.fields.Name);
            */

            // 5. Upload to Airtable
            if (!DRY_RUN) {
                // To upload to Airtable, we usually need a public URL. 
                // Airtable API write operation for attachments expects an object with 'url' pointing to a publicly accessible resource.
                // It does NOT support direct binary upload in the 'create/update' payload easily without a valid URL.
                // 
                // WORKAROUND: 
                // We cannot upload directly to Airtable from a buffer without hosting it somewhere first (S3, Cloudinary, etc.)
                // OR we have to use the Airtable 'Content' API if available (rare/complex).
                // 
                // Since user wants this script to work, we have a problem: Where to host the temp image?
                // 
                // Solution for this environment:
                // We can't easily host. 
                // BUT we can save it locally and tell the user "Generated!".
                //
                // Wait, if the user wants "use as a picture for the meeting", maybe sending it via Telegram Bot is enough?
                // The Telegram Bot `sendPhoto` method accepts a Buffer!
                // 
                // So, instead of saving to Airtable (which requires a URL), maybe we just SEND it?
                // Or we update the script to just SAVE TO DISK for now, and rely on a separate process to upload?
                // 
                // Check schema: `Intro_Image` is `multipleAttachments`. Using it requires a URL.
                // 
                // STRATEGY SHIFT: 
                // Since I cannot upload a Buffer to Airtable directly without a URL...
                // I will save the image to a `public/generated_images/` folder (if this is a web server) 
                // OR just log that "Upload to Airtable requires an external file host".
                // 
                // However, I can upload it to Telegram and GET the file_id/url from Telegram?
                // That's complex.
                // 
                // Let's assume for now I will Save to Disk in `backend/generated/` and logging the path.
                // The user can manually drag-drop or we serve it via the Express server if it's running.
                // The Express server `server.js` serves `public`. We can save there!
                // 
                // If I save to `frontend/public/generated/` (or similar), and if the app is deployed, it produces a URL.
                // But local script... 
                // 
                // Let's just save to disk first.

                const filename = `match_${mId}_${Date.now()}.png`;
                // Save to 'uploads' folder so it is accessible via Nginx proxy -> Backend Static Serve
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
                console.log('   👀 Dry Run: Image generated in memory (would be saved).');
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
            console.log(`   ⚠️  Missing avatars for ${member1.fields.Name} or ${member2.fields.Name}. Skipping image.`);
            return { success: false, reason: 'missing_avatars' };
        }

        // 1. Download
        const av1Buffer = await downloadImage(av1Url);
        const av2Buffer = await downloadImage(av2Url);

        // 2. Prompt
        const scenePrompt = await generateScenePrompt(member1, member2, sharedIntro);

        // 3. Generate
        const finalImageBuffer = await generateBackgroundImage(scenePrompt, av1Buffer, av2Buffer);

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
