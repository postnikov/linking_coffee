# Week Events Flow

Date: 2026-01-10
Version: 1.0

## Saturday

### Goal: Feedback
- Send "Have you met yet?" feedback notifications to all matched users for the current week.
- Get the information from the feedback and update the matched record.

### Script: weekend-feedback.js
Path: backend/scripts/weekend-feedback.js

### Status
- Automatically runs on cron on the server

### Time: 13:00 UTC on Saturday

### Logic:
- Targets: Users where `Next_Week_Status` = 'Active' AND `Consent_GDPR` = true.
- Matches them using AI or Algorithm.
- Sends 4 options: 'We met ✅', 'We scheduled 📆', 'We have not met ⭕️', 'Something went wrong 😔'.
- 'We have not met ⭕️' -> 'No'
- 'Something went wrong 😔' -> 'Fail'
- Marks Weekend_Checkin = Checked.

### Result
- Feedback1 and Feedback2 are updated with the user's response.

## Sunday

### Goal: Invitation
- Send "Invitation to the next week" notifications to ALL users (Active and Passive) who have consented to GDPR and have not opted out of spam.

### Script: weekend-invitation-all.js
Path: backend/scripts/weekend-invitation-all.js

### Status
- Automatically runs on cron on the server

### Time: 14:00 UTC on Sunday

### Logic:
- **Internal Cleanup**: Script automatically resets `Weekend_Notification_Sent` flags at start (unless `--resume` is used).
- Targets: All users with Consent_GDPR=true AND No_Spam=unchecked AND Tg_ID exists.
- Message Content varies by current status (Active vs Passive).
- Buttons are the same for everyone: "Yes, I'm in" and "No, I'll skip".

### Result
- We know who will be active and passive for the next week
- That's what we need for matching algorithm

## Monday

### Goal: Matching
- Create new matches for the week

### Script: match-users-ai.js
Path: backend/scripts/match-users-ai.js

### Status
- Manually run by admin locally

### Logic:
- **Internal Cleanup**: Automatically resets `Current_Week_Status` to empty for ALL users before matching (unless `--resume`).
- Uses Google Gemini (gemini-3-flash-preview) to intelligently match users based on profiles, interests, and history.

### Result
- New matches are created for the week
