/**
 * Send Telegram Connection Reminder Emails
 *
 * This script sends reminder emails to registered users who have not connected their Telegram account.
 *
 * Selection Criteria:
 *   - Has Email field populated
 *   - Tg_ID is empty/blank (not connected to Telegram)
 *   - Connect_Telegram_Notification_Sent flag is NOT checked
 *   - No_Spam flag is NOT checked (user has not unsubscribed)
 *
 * Usage:
 *   node backend/scripts/send-telegram-reminder-email.js [flags]
 *
 * Flags:
 *   --dry-run               : Run without sending emails or updating flags. Logs to console only.
 *   --preview               : Send ALL emails to m.postnikov@gmail.com for appearance testing.
 *   --limit=N               : Limit processing to the first N users.
 *   --max-notifications=N   : (Deprecated) Same as --limit=N.
 *
 * Environment Variables (.env):
 *   - AIRTABLE_API_KEY
 *   - AIRTABLE_BASE_ID
 *   - AIRTABLE_MEMBERS_TABLE
 *   - RESEND_API_KEY
 *
 * Examples:
 *   node backend/scripts/send-telegram-reminder-email.js --dry-run
 *   node backend/scripts/send-telegram-reminder-email.js --preview --limit=2
 *   node backend/scripts/send-telegram-reminder-email.js --limit=10
 *   node backend/scripts/send-telegram-reminder-email.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');
const { Resend } = require('resend');

// Configuration
const BATCH_SIZE = 10; // Resend handles ~100/second, batch conservatively
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
const SENDER_EMAIL = 'max@linked.coffee';
const PREVIEW_EMAIL = 'm.postnikov@gmail.com';

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isPreviewMode = args.includes('--preview');

// Parse Limit Flag (supports both --limit and --max-notifications for backwards compatibility)
const limitArg = args.find(arg => arg.startsWith('--limit='));
const maxArg = args.find(arg => arg.startsWith('--max-notifications='));
const MAX_EMAILS_TO_PROCESS = limitArg ? parseInt(limitArg.split('=')[1]) : (maxArg ? parseInt(maxArg.split('=')[1]) : Infinity);

console.log('--- Telegram Connection Reminder Email Script ---');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Target: ${isPreviewMode ? `PREVIEW (All to ${PREVIEW_EMAIL})` : 'PRODUCTION'}`);
if (MAX_EMAILS_TO_PROCESS !== Infinity) console.log(`Limit: ${MAX_EMAILS_TO_PROCESS} emails`);

// Validate environment variables
if (!process.env.AIRTABLE_API_KEY ||
    !process.env.AIRTABLE_BASE_ID ||
    !process.env.AIRTABLE_MEMBERS_TABLE ||
    !process.env.RESEND_API_KEY) {
    console.error('❌ Missing environment variables (check .env)');
    console.error('   Required: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_MEMBERS_TABLE, RESEND_API_KEY');
    process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const MEMBERS_TABLE = process.env.AIRTABLE_MEMBERS_TABLE;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate HTML email content based on user's language preference
 * @param {string} name - User's name
 * @param {string} language - User's notification language ('En' or 'Ru')
 * @param {string} email - User's email address (for unsubscribe link)
 * @returns {Object} Object with subject and html properties
 */
function generateEmailHTML(name, language, email) {
    const isRu = language === 'Ru';

    // Determine content based on language
    const subject = isRu
        ? 'Подключите свой Telegram к Linked.Coffee'
        : 'Connect your Telegram to Linked.Coffee';

    const greeting = isRu ? 'Привет' : 'Hi';
    const thankYou = isRu
        ? 'Спасибо за регистрацию на Linked.Coffee.<br>Я очень ценю это ❤️.'
        : 'Thank you for registering on Linked.Coffee.<br>I really appreciate this ❤️.';

    const mainMessage = isRu
        ? 'Чтобы получить своих партнёров для Smart Random Coffee, вам нужно подключить Telegram.<br>Вы можете сделать это на сайте: <a href="https://Linked.Coffee" style="color: #0066cc; text-decoration: none;">https://Linked.Coffee</a><br>Просто войдите через Gmail и нажмите «Connect Telegram»<br>Это просто 😉'
        : 'To get your Smart Random Coffee partners you need to connect your telegram.<br>You can do this on the website: <a href="https://Linked.Coffee" style="color: #0066cc; text-decoration: none;">https://Linked.Coffee</a><br>Just log in with your gmail and press "Connect Telegram"<br>It\'s easy 😉';

    const closing = isRu
        ? 'До встречи за чашкой кофе ;)'
        : 'See you with a cup of coffee ;)';

    const signature = isRu
        ? 'С наилучшими пожеланиями,<br>Макс — основатель Linked Coffee<br>❤️'
        : 'Best regards,<br>Max — Linked Coffee founder<br>❤️';

    const footerText = isRu
        ? 'Вы получили это письмо, потому что зарегистрировались на Linked.Coffee'
        : 'You received this email because you registered on Linked.Coffee';

    const unsubscribeText = isRu
        ? 'Не хотите больше получать такие письма?'
        : 'Don\'t want to receive emails like this?';

    const unsubscribeLink = isRu
        ? 'Отписаться'
        : 'Unsubscribe';

    // Email parameter for unsubscribe URL
    const unsubscribeUrl = `https://linked.coffee/unsubscribe?email=${encodeURIComponent(email)}`;

    // HTML template with table-based layout for email client compatibility
    const html = `
<!DOCTYPE html>
<html lang="${isRu ? 'ru' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; font-size: 0; line-height: 0;">
                            <span style="display: inline-block; font-size: 28px; line-height: 28px; vertical-align: middle; margin-right: 8px; margin-top: -2px;">☕️</span>
                            <span style="display: inline-block; color: #333333; font-size: 24px; font-weight: 600; line-height: 28px; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Linked.Coffee</span>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 20px 40px; color: #333333; font-size: 16px; line-height: 1.6;">
                            <p style="margin: 0 0 20px 0;">${greeting},</p>

                            <p style="margin: 0 0 20px 0;">${thankYou}</p>

                            <p style="margin: 0 0 20px 0;">${mainMessage}</p>

                            <p style="margin: 0 0 20px 0;">${closing}</p>

                            <p style="margin: 20px 0 0 0; border-top: 1px solid #eeeeee; padding-top: 20px; color: #666666;">
                                ${signature}
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; text-align: center; color: #999999; font-size: 12px; line-height: 1.5;">
                            <p style="margin: 0 0 10px 0;">${footerText}</p>
                            <p style="margin: 0;">
                                ${unsubscribeText}
                                <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">${unsubscribeLink}</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    return { subject, html };
}

/**
 * Send email to a user
 * @param {Object} user - Airtable user record
 * @param {boolean} isDryRun - Whether to actually send the email
 * @param {boolean} isPreviewMode - Whether to send to preview email instead
 * @returns {Object} Result object with success status
 */
async function sendEmail(user, isDryRun, isPreviewMode) {
    const email = user.fields.Email;
    const name = user.fields.Name || 'there';
    const language = user.fields.Notifications_Language || 'En';

    // Generate email content (pass email for unsubscribe link)
    const { subject, html } = generateEmailHTML(name, language, email);

    // Determine recipient
    const recipientEmail = isPreviewMode ? PREVIEW_EMAIL : email;
    const displayName = isPreviewMode ? `${name} (PREVIEW)` : name;

    if (isDryRun) {
        console.log(`📝 [DRY RUN] Would send to: ${displayName} <${recipientEmail}>`);
        console.log(`          Subject: ${subject}`);
        console.log(`          Language: ${language}`);
        return { success: true, isDryRun: true };
    }

    try {
        const result = await resend.emails.send({
            from: `Max from Linked.Coffee <${SENDER_EMAIL}>`,
            to: [recipientEmail],
            subject: subject,
            html: html
        });

        console.log(`✅ Sent to ${displayName} <${recipientEmail}> | ID: ${result.id}`);
        return { success: true, result };

    } catch (error) {
        console.error(`❌ Failed to send to ${displayName} <${recipientEmail}>: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Update Connect_Telegram_Notification_Sent flag for successfully sent emails
 * @param {Array} users - Array of Airtable user records
 */
async function updateFlags(users) {
    // Airtable limits: 10 records per update call
    const AIRTABLE_BATCH_SIZE = 10;

    for (let i = 0; i < users.length; i += AIRTABLE_BATCH_SIZE) {
        const batch = users.slice(i, i + AIRTABLE_BATCH_SIZE);

        const updates = batch.map(user => ({
            id: user.id,
            fields: {
                'Connect_Telegram_Notification_Sent': true
            }
        }));

        try {
            await base(MEMBERS_TABLE).update(updates);
            console.log(`✅ Updated flags for batch ${Math.floor(i / AIRTABLE_BATCH_SIZE) + 1}`);
        } catch (error) {
            console.error(`❌ Failed to update flags for batch: ${error.message}`);
            // Continue to next batch even if one fails
        }
    }
}

/**
 * Main execution function
 */
async function run() {
    try {
        console.log('Fetching eligible users...');

        let eligibleUsers = [];
        await base(MEMBERS_TABLE).select({
            filterByFormula: `
                AND(
                    NOT({Email} = ''),
                    OR({Tg_ID} = '', {Tg_ID} = BLANK()),
                    NOT({Connect_Telegram_Notification_Sent}),
                    NOT({No_Spam})
                )
            `,
            view: "Grid view"
        }).eachPage((records, fetchNextPage) => {
            eligibleUsers = eligibleUsers.concat(records);
            fetchNextPage();
        });

        console.log(`Found ${eligibleUsers.length} eligible users.`);

        if (eligibleUsers.length === 0) {
            console.log('No users to process. Exiting.');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        let processedCount = 0;
        let updatedRecords = []; // Track successful sends for batch flag update

        // Process in batches
        for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
            // Check global limit
            if (processedCount >= MAX_EMAILS_TO_PROCESS) break;

            const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
            console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(eligibleUsers.length / BATCH_SIZE)}...`);

            // Process batch in parallel
            const results = await Promise.all(
                batch.map(async (user) => {
                    if (processedCount >= MAX_EMAILS_TO_PROCESS) return null;

                    const result = await sendEmail(user, isDryRun, isPreviewMode);
                    processedCount++;

                    if (result.success && !result.isDryRun) {
                        successCount++;
                        return user; // Return user for flag update
                    } else if (result.isDryRun) {
                        successCount++; // Count dry runs as "success" for summary
                        return null; // Don't update flags in dry run
                    } else {
                        failCount++;
                        return null; // Don't update flags on failure
                    }
                })
            );

            // Collect successful sends (excluding nulls)
            updatedRecords.push(...results.filter(Boolean));

            // Delay between batches
            if (i + BATCH_SIZE < eligibleUsers.length && processedCount < MAX_EMAILS_TO_PROCESS) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await sleep(DELAY_BETWEEN_BATCHES);
            }
        }

        // Update flags in Airtable (only in normal mode)
        if (updatedRecords.length > 0 && !isDryRun && !isPreviewMode) {
            console.log(`\nUpdating flags for ${updatedRecords.length} users...`);
            await updateFlags(updatedRecords);
        }

        console.log('\n--- Summary ---');
        console.log(`Total processed: ${processedCount}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        if (!isDryRun && !isPreviewMode && updatedRecords.length > 0) {
            console.log(`Flags updated: ${updatedRecords.length}`);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

run();
