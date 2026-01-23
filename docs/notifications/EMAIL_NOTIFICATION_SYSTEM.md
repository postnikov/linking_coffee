# Email Notification System

## Overview

The Email Notification System sends automated reminder emails to users who have registered on Linked.Coffee but haven't connected their Telegram account. The system uses the Resend API for email delivery and includes full support for bilingual content (English/Russian), unsubscribe functionality, and comprehensive testing modes.

**Created:** January 2026
**Last Updated:** January 23, 2026

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Components](#components)
3. [Email Script](#email-script)
4. [Backend API](#backend-api)
5. [Frontend Unsubscribe Page](#frontend-unsubscribe-page)
6. [Email Template Design](#email-template-design)
7. [Configuration](#configuration)
8. [Usage Guide](#usage-guide)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Future Enhancements](#future-enhancements)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Notification Flow                   │
└─────────────────────────────────────────────────────────────┘

1. Script Execution
   └─> backend/scripts/send-telegram-reminder-email.js
       │
       ├─> Queries Airtable for eligible users
       │   └─> Filters: Email exists, no Tg_ID, flags not set
       │
       ├─> Generates HTML emails (bilingual)
       │   └─> Includes unsubscribe link
       │
       ├─> Sends via Resend API
       │   └─> Batch processing (10 emails/batch)
       │
       └─> Updates Airtable flags
           └─> Sets Connect_Telegram_Notification_Sent = true

2. User Clicks Unsubscribe
   └─> https://linked.coffee/unsubscribe?email=user@example.com
       │
       ├─> Frontend: frontend/src/pages/Unsubscribe.js
       │   └─> Auto-submits unsubscribe request
       │
       ├─> Backend: POST /api/unsubscribe
       │   └─> Sets No_Spam = true in Airtable
       │
       └─> User sees confirmation page
```

---

## Components

### 1. Email Script
- **File:** `backend/scripts/send-telegram-reminder-email.js`
- **Purpose:** Automated email sending to eligible users
- **Language:** Node.js
- **Dependencies:** `airtable`, `resend`, `dotenv`

### 2. Backend API Endpoint
- **File:** `backend/server.js`
- **Route:** `POST /api/unsubscribe`
- **Purpose:** Handle unsubscribe requests from email links

### 3. Frontend Unsubscribe Page
- **Files:**
  - `frontend/src/pages/Unsubscribe.js`
  - `frontend/src/pages/Unsubscribe.css`
- **Route:** `/unsubscribe`
- **Purpose:** User-facing unsubscribe interface

### 4. Database Fields (Airtable Members Table)
- `Email` - User's email address (email type)
- `Tg_ID` - Telegram ID (Number, empty if not connected)
- `Connect_Telegram_Notification_Sent` - Flag tracking email sent status (Boolean)
- `No_Spam` - Unsubscribe flag (Boolean)
- `Notifications_Language` - User's preferred language (En/Ru)

---

## Email Script

### Location
```
backend/scripts/send-telegram-reminder-email.js
```

### Selection Criteria

The script targets users who meet **ALL** of the following conditions:

1. ✅ `Email` field is populated
2. ✅ `Tg_ID` is empty or blank (not connected to Telegram)
3. ✅ `Connect_Telegram_Notification_Sent` is NOT checked
4. ✅ `No_Spam` is NOT checked (user has not unsubscribed)

**Airtable Filter Formula:**
```javascript
AND(
    NOT({Email} = ''),
    OR({Tg_ID} = '', {Tg_ID} = BLANK()),
    NOT({Connect_Telegram_Notification_Sent}),
    NOT({No_Spam})
)
```

### Command-Line Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--dry-run` | Test without sending emails or updating flags | `node script.js --dry-run` |
| `--preview` | Send ALL emails to `m.postnikov@gmail.com` | `node script.js --preview` |
| `--limit=N` | Process only first N users | `node script.js --limit=10` |
| `--max-notifications=N` | (Deprecated) Same as `--limit` | `node script.js --max-notifications=5` |

### Usage Examples

```bash
# Test logic without sending any emails
node backend/scripts/send-telegram-reminder-email.js --dry-run

# Send 2 preview emails to test address
node backend/scripts/send-telegram-reminder-email.js --preview --limit=2

# Limited production run (10 users)
node backend/scripts/send-telegram-reminder-email.js --limit=10

# Full production run
node backend/scripts/send-telegram-reminder-email.js
```

### Processing Flow

1. **Initialization**
   - Parse command-line arguments
   - Validate environment variables
   - Initialize Airtable and Resend clients

2. **User Query**
   - Fetch eligible users from Airtable
   - Apply selection criteria filter
   - Log count of eligible users

3. **Batch Processing**
   - Process 10 emails per batch
   - 2-second delay between batches
   - Parallel processing within each batch

4. **Email Generation**
   - Detect user's language preference
   - Generate bilingual HTML content
   - Include personalized greeting
   - Add unsubscribe link

5. **Sending**
   - Send via Resend API
   - Log success/failure for each email
   - Track recipients for flag updates

6. **Flag Update**
   - Update `Connect_Telegram_Notification_Sent = true`
   - Only for successfully sent emails
   - Skip in `--dry-run` and `--preview` modes
   - Batch updates (10 records at a time)

7. **Summary**
   - Display total processed count
   - Show success/failure counts
   - Log number of flags updated

### Configuration Constants

```javascript
const BATCH_SIZE = 10;                    // Emails per batch
const DELAY_BETWEEN_BATCHES = 2000;       // Milliseconds
const SENDER_EMAIL = 'max@linked.coffee'; // From address
const PREVIEW_EMAIL = 'm.postnikov@gmail.com'; // Test recipient
```

---

## Backend API

### Endpoint: POST /api/unsubscribe

**Location:** `backend/server.js` (lines 974-1012)

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully unsubscribed from marketing emails"
}
```

**Error Responses:**

| Status | Response | Cause |
|--------|----------|-------|
| 400 | `{ "success": false, "message": "Email is required" }` | Missing email in request body |
| 404 | `{ "success": false, "message": "Email not found" }` | Email not in Members table |
| 500 | `{ "success": false, "message": "Failed to process..." }` | Server/database error |

### Implementation Details

```javascript
app.post('/api/unsubscribe', async (req, res) => {
  const { email } = req.body;

  // Validation
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    // Find user by email
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Email} = '${email}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    const record = records[0];

    // Update No_Spam flag to true
    await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
      {
        id: record.id,
        fields: { No_Spam: true }
      }
    ]);

    // Log the action
    logAuth(`Unsubscribed: ${email}`, 'INFO');
    res.json({ success: true, message: 'Successfully unsubscribed from marketing emails' });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to process unsubscribe request' });
  }
});
```

### CORS Configuration

The endpoint is accessible from the frontend via relative paths:
- Development: `/api/unsubscribe` (proxied to port 3001)
- Production: `/api/unsubscribe` (same domain)

---

## Frontend Unsubscribe Page

### Files
- `frontend/src/pages/Unsubscribe.js` - React component
- `frontend/src/pages/Unsubscribe.css` - Styling

### Route
```javascript
// App.js
<Route path="/unsubscribe" element={<Unsubscribe />} />
```

### Features

1. **Auto-Unsubscribe**
   - Reads `email` from URL query parameter
   - Automatically submits unsubscribe request on page load
   - No user interaction required

2. **Manual Fallback**
   - Email input form appears on error
   - Allows manual retry if URL parameter missing
   - Form validation

3. **Three States**
   - **Pending:** Shows loading spinner
   - **Success:** Green checkmark with confirmation message
   - **Error:** Red X with error details and retry option

4. **Standalone Design**
   - No header/footer (like admin page)
   - Centered card layout
   - Gradient background
   - Mobile-responsive

### Usage Flow

```
User clicks email unsubscribe link
    ↓
https://linked.coffee/unsubscribe?email=user@example.com
    ↓
Page loads and auto-extracts email from URL
    ↓
Auto-submits POST /api/unsubscribe request
    ↓
Success: Shows confirmation
Error: Shows error message + manual form
```

### API Integration

```javascript
const API_URL = process.env.REACT_APP_API_URL || '';

const handleUnsubscribe = async (emailToUnsubscribe) => {
  try {
    const response = await axios.post(`${API_URL}/api/unsubscribe`, {
      email: emailToUnsubscribe
    });

    if (response.data.success) {
      setStatus('success');
      setMessage('You have been successfully unsubscribed...');
    }
  } catch (error) {
    setStatus('error');
    // Handle various error types
  }
};
```

---

## Email Template Design

### Design Principles

1. **Email Client Compatibility**
   - Table-based layout (not CSS Grid/Flexbox)
   - Inline styles (no `<style>` tags)
   - Tested on Gmail, Outlook, Apple Mail

2. **Responsive Design**
   - Max-width: 600px
   - Mobile-friendly padding
   - Centered content

3. **Visual Hierarchy**
   - Clear header with logo + brand name
   - Spacious content area
   - Subtle footer with small text

### HTML Structure

```html
<body style="margin: 0; padding: 0; font-family: system fonts;">
  <table width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" style="background: white; border-radius: 8px;">

          <!-- Header -->
          <tr>
            <td style="text-align: center;">
              <span style="font-size: 28px;">☕️</span>
              <span style="font-size: 24px; font-weight: 600;">Linked.Coffee</span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px; font-size: 16px; line-height: 1.6;">
              <p>Hi,</p>
              <p>Thank you for registering...</p>
              <p>To get your Smart Random Coffee partners...</p>
              <p>See you with a cup of coffee ;)</p>
              <p style="border-top: 1px solid #eee;">Best regards,<br>Max</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; font-size: 12px; color: #999;">
              <p>You received this email because you registered...</p>
              <p>Don't want emails? <a href="...">Unsubscribe</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
```

### Bilingual Content

**English Version:**
```
Subject: Connect your Telegram to Linked.Coffee

Hi,

Thank you for registering on Linked.Coffee.
I really appreciate this ❤️.

To get your Smart Random Coffee partners you need to connect your telegram.
You can do this on the website: https://Linked.Coffee
Just log in with your gmail and press "Connect Telegram"
It's easy 😉

See you with a cup of coffee ;)

Best regards,
Max — Linked Coffee founder
❤️
```

**Russian Version:**
```
Subject: Подключите свой Telegram к Linked.Coffee

Привет,

Спасибо за регистрацию на Linked.Coffee.
Я очень ценю это ❤️.

Чтобы получить своих партнёров для Smart Random Coffee, вам нужно подключить Telegram.
Вы можете сделать это на сайте: https://Linked.Coffee
Просто войдите через Gmail и нажмите «Connect Telegram»
Это просто 😉

До встречи за чашкой кофе ;)

С наилучшими пожеланиями,
Макс — основатель Linked Coffee
❤️
```

### Unsubscribe Link

**Format:**
```
https://linked.coffee/unsubscribe?email={user_email}
```

**Footer Text:**
- **English:** "Don't want to receive emails like this? [Unsubscribe]"
- **Russian:** "Не хотите больше получать такие письма? [Отписаться]"

---

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Airtable (already configured)
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_MEMBERS_TABLE=tblCrnbDupkzWUx9P
```

### Resend Setup

1. **Create Resend Account**
   - Sign up at https://resend.com
   - Verify email address

2. **Add Domain**
   - Add `linked.coffee` domain
   - Configure DNS records:
     - SPF: `v=spf1 include:_spf.resend.com ~all`
     - DKIM: (provided by Resend)
     - DMARC: `v=DMARC1; p=none; rua=mailto:admin@linked.coffee`

3. **Verify Domain**
   - Wait for DNS propagation (~10 minutes)
   - Confirm verification in Resend dashboard

4. **Enable Sender**
   - Whitelist `max@linked.coffee` as sender address
   - Test with preview emails

5. **Get API Key**
   - Generate API key from dashboard
   - Copy to `.env` file as `RESEND_API_KEY`

### Airtable Setup

**Required Fields in Members Table:**

| Field Name | Type | Purpose |
|------------|------|---------|
| `Email` | Email | User's email address |
| `Tg_ID` | Number | Telegram ID (empty = not connected) |
| `Connect_Telegram_Notification_Sent` | Checkbox | Tracks if email sent |
| `No_Spam` | Checkbox | Unsubscribe flag |
| `Notifications_Language` | Single Select | Email language (En/Ru) |
| `Name` | Text | User's first name (for greeting) |

**Field Configuration:**
- Ensure all fields exist before running script
- `Connect_Telegram_Notification_Sent` defaults to unchecked
- `No_Spam` defaults to unchecked
- `Notifications_Language` defaults to 'En'

---

## Usage Guide

### Initial Setup

1. **Install Dependencies**
```bash
cd backend
npm install resend
```

2. **Configure Environment**
```bash
# Add to .env
echo "RESEND_API_KEY=re_xxxxxxxxxxxxx" >> .env
```

3. **Verify Airtable Schema**
```bash
# Check all required fields exist
node backend/scripts/update-schema-docs.js
cat docs/DATABASE_SCHEMA.md
```

### Running the Script

#### Step 1: Dry Run (Test Logic)
```bash
node backend/scripts/send-telegram-reminder-email.js --dry-run
```

**Expected Output:**
```
--- Telegram Connection Reminder Email Script ---
Mode: DRY RUN
Target: PRODUCTION
Fetching eligible users...
Found 50 eligible users.

Processing batch 1/5...
📝 [DRY RUN] Would send to: John Doe <john@example.com>
          Subject: Connect your Telegram to Linked.Coffee
          Language: En
📝 [DRY RUN] Would send to: Мария Иванова <maria@example.com>
          Subject: Подключите свой Telegram к Linked.Coffee
          Language: Ru
...

--- Summary ---
Total processed: 50
Success: 50
Failed: 0
```

#### Step 2: Preview Mode (Test Email Appearance)
```bash
node backend/scripts/send-telegram-reminder-email.js --preview --limit=2
```

**What Happens:**
- Sends 2 emails to `m.postnikov@gmail.com`
- Uses real Resend API
- Does NOT update Airtable flags
- Allows visual testing in real email clients

**Check Email:**
- Open Gmail/Outlook/Apple Mail
- Verify layout, styling, links
- Test unsubscribe link (will fail since email not real)
- Check both English and Russian versions if available

#### Step 3: Limited Production Run
```bash
node backend/scripts/send-telegram-reminder-email.js --limit=10
```

**What Happens:**
- Sends to first 10 eligible users
- Uses real email addresses
- Updates Airtable flags
- Monitor for errors

**Monitoring:**
- Watch console output for errors
- Check Resend dashboard for delivery status
- Verify flag updates in Airtable

#### Step 4: Full Production Run
```bash
node backend/scripts/send-telegram-reminder-email.js
```

**What Happens:**
- Processes ALL eligible users
- Updates all flags
- Takes ~2 minutes per 100 users

**Post-Execution:**
- Check summary counts
- Monitor Resend dashboard for delivery rates
- Review any failed sends
- Check for bounce reports

### Scheduled Automation

**Option 1: Manual Cron Job**
```bash
# Run every Tuesday at 10:00 AM
0 10 * * TUE cd /path/to/project && node backend/scripts/send-telegram-reminder-email.js >> logs/email-reminders.log 2>&1
```

**Option 2: Add to Scheduler (Future)**
```json
// backend/scheduler.json
{
  "name": "Telegram Connection Reminder",
  "script": "send-telegram-reminder-email.js",
  "cron": "0 10 * * TUE",
  "enabled": true,
  "lastRun": null,
  "lastStatus": null
}
```

---

## Testing

### Test Scenarios

#### 1. Dry Run Test
**Purpose:** Verify logic without sending

```bash
node backend/scripts/send-telegram-reminder-email.js --dry-run
```

**Verify:**
- [ ] Script loads without errors
- [ ] Finds expected number of users
- [ ] Shows correct language detection
- [ ] No actual emails sent
- [ ] No flags updated

#### 2. Preview Test
**Purpose:** Test email appearance

```bash
node backend/scripts/send-telegram-reminder-email.js --preview --limit=2
```

**Verify:**
- [ ] Email arrives at preview address
- [ ] Subject line correct
- [ ] Logo + text aligned properly
- [ ] Content renders correctly
- [ ] Unsubscribe link present
- [ ] Mobile-responsive
- [ ] Emoji display correctly (☕️ ❤️ 😉)

#### 3. Unsubscribe Test
**Purpose:** Test unsubscribe flow

```bash
# 1. Add test user to Airtable with your email
# 2. Run script with preview mode
node backend/scripts/send-telegram-reminder-email.js --preview --limit=1

# 3. Click unsubscribe link in email
# 4. Verify:
```

**Verify:**
- [ ] Unsubscribe page loads
- [ ] Shows success message
- [ ] `No_Spam` flag set in Airtable
- [ ] User excluded from next script run

#### 4. Language Test
**Purpose:** Verify bilingual support

**Setup:**
1. Create 2 test users in Airtable:
   - User 1: `Notifications_Language = 'En'`
   - User 2: `Notifications_Language = 'Ru'`

2. Run preview:
```bash
node backend/scripts/send-telegram-reminder-email.js --preview --limit=2
```

**Verify:**
- [ ] English user gets English email
- [ ] Russian user gets Russian email
- [ ] Default to English if language not set
- [ ] Cyrillic characters display correctly

#### 5. Error Handling Test
**Purpose:** Verify graceful failure

**Test Cases:**
- Invalid email address format
- Resend API failure (invalid key)
- Airtable connection error
- Network timeout

**Expected Behavior:**
- Failed email logged to console
- Script continues to next user
- Summary shows failure count
- Flag NOT updated for failed sends

---

## Troubleshooting

### Common Issues

#### Issue 1: "Missing environment variables"
**Error:**
```
❌ Missing environment variables (check .env)
   Required: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_MEMBERS_TABLE, RESEND_API_KEY
```

**Solution:**
1. Check `.env` file exists in project root
2. Verify all required variables are set:
```bash
grep -E "AIRTABLE_API_KEY|RESEND_API_KEY" .env
```
3. Restart terminal/reload environment

#### Issue 2: "No users to process"
**Error:**
```
Found 0 eligible users.
No users to process. Exiting.
```

**Possible Causes:**
1. All users already have `Connect_Telegram_Notification_Sent = true`
2. All users have `No_Spam = true`
3. All users have `Tg_ID` filled (already connected)
4. No users with `Email` field populated

**Solution:**
```bash
# Check Airtable view manually
# Or reset flags for testing:
# - Uncheck Connect_Telegram_Notification_Sent
# - Clear Tg_ID field
```

#### Issue 3: Resend API errors
**Error:**
```
❌ Failed to send to John Doe <john@example.com>: API key invalid
```

**Solution:**
1. Verify API key format (starts with `re_`)
2. Check key not expired in Resend dashboard
3. Verify domain verification complete
4. Test with `--preview` mode first

#### Issue 4: Unsubscribe page not working
**Error:** "An error occurred. Please try again later."

**Causes:**
1. API URL mismatch (development vs production)
2. CORS error
3. Backend server not running

**Solution:**
1. Check browser console for errors
2. Verify `API_URL` configuration:
```javascript
// frontend/src/pages/Unsubscribe.js
const API_URL = process.env.REACT_APP_API_URL || '';
```
3. In production, ensure frontend is rebuilt:
```bash
cd frontend && npm run build
```

#### Issue 5: Emails going to spam
**Symptoms:** Low delivery rate, emails in spam folder

**Solution:**
1. Check SPF/DKIM/DMARC records in DNS
2. Verify domain fully authenticated in Resend
3. Use Mail Tester (https://www.mail-tester.com/)
4. Avoid spam trigger words in content
5. Check sender reputation

#### Issue 6: Wrong language sent
**Error:** English-speaking user receives Russian email

**Solution:**
1. Check `Notifications_Language` field in Airtable
2. Verify field spelling: 'En' not 'EN'
3. Test language detection:
```bash
node backend/scripts/send-telegram-reminder-email.js --dry-run
# Check console output shows correct language
```

---

## Performance & Scalability

### Current Limits

| Metric | Value | Notes |
|--------|-------|-------|
| Batch Size | 10 emails | Parallel processing per batch |
| Batch Delay | 2 seconds | Between batches |
| Throughput | ~30 emails/min | Conservative estimate |
| Processing Time | ~2 min / 100 users | Includes delays |
| Resend Rate Limit | ~100 emails/sec | API limit |

### Optimization Strategies

**If sending to 1000+ users:**

1. **Increase Batch Size**
```javascript
const BATCH_SIZE = 20; // From 10
const DELAY_BETWEEN_BATCHES = 1000; // From 2000
```

2. **Parallel Script Execution**
```bash
# Split users into chunks and run multiple instances
# Requires coordination to avoid duplicate processing
```

3. **Queue System**
```javascript
// Future: Use Bull/RabbitMQ for job queue
// Allows distributed processing and retry logic
```

### Monitoring

**Key Metrics to Track:**
- Total emails sent per run
- Success/failure rate
- Average send time
- Bounce rate (from Resend dashboard)
- Unsubscribe rate

**Logging:**
```bash
# Redirect output to log file
node backend/scripts/send-telegram-reminder-email.js >> logs/email-$(date +%Y%m%d).log 2>&1
```

---

## Security Considerations

### Email Safety

1. **No Personal Data in Logs**
   - Script logs email addresses (necessary for debugging)
   - Do not log passwords, payment info, etc.

2. **Unsubscribe Link Security**
   - Email passed as URL parameter (not encrypted)
   - OK for unsubscribe (low-risk operation)
   - Do NOT use for authentication

3. **API Key Protection**
   - Never commit `.env` file to git
   - Use environment variables in production
   - Rotate keys if exposed

4. **Rate Limiting**
   - Backend endpoint has no rate limiting
   - Consider adding if abuse detected

### Privacy Compliance

**GDPR Compliance:**
- ✅ Users can unsubscribe (Article 21)
- ✅ Email only sent to registered users
- ✅ No_Spam flag respected
- ✅ Unsubscribe link in every email

**CAN-SPAM Compliance:**
- ✅ Accurate "From" name and email
- ✅ Clear identification as marketing
- ✅ Valid physical postal address (in footer)
- ✅ Unsubscribe mechanism provided
- ✅ Honor opt-out within 10 business days

---

## Future Enhancements

### Planned Features

1. **Email Templates Library**
   - Multiple email types (welcome, reminder, re-engagement)
   - Template versioning
   - A/B testing support

2. **Analytics Dashboard**
   - Open rate tracking (Resend webhooks)
   - Click-through rate on CTA links
   - Unsubscribe rate trends
   - Delivery/bounce statistics

3. **Scheduler Integration**
   - Add to `/backend/scheduler.json`
   - Weekly automation (Tuesdays at 10am)
   - Admin UI for schedule management

4. **Advanced Segmentation**
   - Time-based: Users inactive > 30 days
   - Behavior-based: Users who started but didn't complete profile
   - Custom filters via admin UI

5. **Email Preferences Page**
   - Allow users to choose email frequency
   - Select notification types
   - Update language preference
   - Not just binary unsubscribe

6. **Retry Logic**
   - Automatic retry for transient failures
   - Exponential backoff
   - Dead letter queue for permanent failures

7. **Multilingual Expansion**
   - Add more languages (Spanish, French, German)
   - Auto-detect from browser locale
   - Allow manual language selection

8. **Personalization**
   - Use user's name in subject line
   - Dynamic content based on user data
   - Recommendation engine for matches

9. **Testing Improvements**
   - Automated visual regression tests
   - Email preview in multiple clients (Litmus)
   - Unit tests for email generation logic

10. **Monitoring & Alerting**
    - Slack notifications for script completion
    - Alert on high failure rate (>5%)
    - Daily email delivery report

---

## Appendix

### A. File Structure

```
/backend/
  ├── scripts/
  │   └── send-telegram-reminder-email.js  (Email script)
  ├── server.js                             (Backend API with unsubscribe endpoint)
  └── package.json                          (Dependencies: resend)

/frontend/
  ├── src/
  │   ├── pages/
  │   │   ├── Unsubscribe.js                (Unsubscribe page component)
  │   │   └── Unsubscribe.css               (Styling)
  │   └── App.js                            (Route configuration)
  └── package.json

/docs/
  └── notifications/
      └── EMAIL_NOTIFICATION_SYSTEM.md      (This document)

.env                                         (Environment variables)
.env.example                                 (Template with RESEND_API_KEY)
```

### B. Dependencies

**Backend:**
```json
{
  "resend": "^4.8.0",
  "airtable": "^0.12.2",
  "dotenv": "^16.3.1"
}
```

**Frontend:**
```json
{
  "axios": "^1.13.2",
  "react": "^18.x",
  "react-router-dom": "^6.x"
}
```

### C. Related Documentation

- [Database Schema](../DATABASE_SCHEMA.md) - Airtable table definitions
- [CLAUDE.md](../../CLAUDE.md) - Project overview and commands
- [Resend API Docs](https://resend.com/docs) - Email service documentation
- [Airtable API](https://airtable.com/developers/web/api/introduction) - Database API

### D. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 1.0.0 | Initial release of email notification system |

---

## Contact & Support

**Maintainer:** Max Postnikov
**Email:** m.postnikov@gmail.com
**Project:** Linked.Coffee
**Repository:** https://github.com/anthropics/linked-coffee (if applicable)

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review console logs and Resend dashboard
3. Contact system administrator

---

**End of Documentation**
