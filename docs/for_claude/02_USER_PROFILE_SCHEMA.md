# Linked.Coffee — User Profile Schema

> **Purpose:** This document describes the complete user profile structure so Claude can understand what data we collect and how it could be used for matching, personalization, and product features.

---

## Member Record Structure

Each user in Linked.Coffee has the following profile fields stored in Airtable:

### Identity & Contact

| Field         | Type       | Description                            |
| ------------- | ---------- | -------------------------------------- |
| `Tg_Username` | Text       | Telegram username (primary identifier) |
| `Tg_ID`       | Number     | Telegram user ID (for bot messaging)   |
| `Name`        | Text       | First name                             |
| `Family`      | Text       | Last name                              |
| `Avatar`      | Attachment | Profile photo                          |
| `Linkedin`    | URL        | LinkedIn profile link                  |

### Status & Participation

| Field                       | Type          | Options                              | Description                            |
| --------------------------- | ------------- | ------------------------------------ | -------------------------------------- |
| `Status`                    | Single Select | Free, PRO, Premium, Admin, EarlyBird | Account tier                           |
| `Next_Week_Status`          | Single Select | Active, Passive                      | Opted-in for next week?                |
| `Current_Week_Status`       | Single Select | Matched, Unmatched, Passive          | This week's state                      |
| `Consent_GDPR`              | Checkbox      | —                                    | GDPR consent given                     |
| `No_Spam`                   | Checkbox      | —                                    | User requested no messages             |
| `Weekend_Notification_Sent` | Checkbox      | —                                    | Already received this weekend's invite |

### Location & Timezone

| Field       | Type              | Description                                          |
| ----------- | ----------------- | ---------------------------------------------------- |
| `Countries` | Link to Countries | User's country                                       |
| `City_Link` | Link to Cities    | User's city                                          |
| `Time_Zone` | Single Select     | 35+ timezone options (e.g., "Europe/Moscow (UTC+3)") |

### Professional Profile

| Field                          | Type          | Description                                                          |
| ------------------------------ | ------------- | -------------------------------------------------------------------- |
| `Profession`                   | Text          | Job title / role description                                         |
| `Grade`                        | Single Select | Junior, Middle, Senior, Lead/Head of, C-Level, Founder, Entrepreneur |
| `Professional_Description`     | Long Text     | Free-form professional bio                                           |
| `Professional_Interests`       | Multi-Select  | 50+ options (see list below)                                         |
| `Other_Professional_Interests` | Text          | Custom interests not in the list                                     |

### Personal Profile

| Field                      | Type          | Description                                   |
| -------------------------- | ------------- | --------------------------------------------- |
| `Personal_Description`     | Long Text     | Free-form personal bio (hobbies, personality) |
| `Personal_Interests`       | Multi-Select  | 50+ options (see list below)                  |
| `Other_Personal_Interests` | Text          | Custom interests not in the list              |
| `Age`                      | Single Select | 18–24, 25–32, 32–38, 39–49, 50–65, 66+        |

### Matching Preferences

| Field                | Type         | Range                                           | Description                                                      |
| -------------------- | ------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `Serendipity`        | Number       | 0-10                                            | How much randomness? (0 = similar people, 10 = wildly different) |
| `Proximity`          | Number       | 0-10                                            | Prefer nearby? (0 = global, 10 = same city only)                 |
| `Best_Meetings_Days` | Multi-Select | Mon, Tue, Wed, Thu, Fri, Sat, Sun               | When user prefers to meet                                        |
| `Languages`          | Multi-Select | English, Russian, Spanish, French, German, etc. | Languages spoken                                                 |
| `Coffee_Goals`       | Multi-Select | Casual Chat, Professional Chat                  | What user wants from coffees                                     |

### Timestamps

| Field        | Type | Description             |
| ------------ | ---- | ----------------------- |
| `Created_At` | Date | When user registered    |
| `Last_Seen`  | Date | Last activity timestamp |

---

## Professional Interests (50 options)

Organized into 5 categories:

### Engineering & Tech

- AI Automation, AI Coding Tools, AI/ML Engineering, AR/VR Development
- Backend Development, Cloud Architecture, Cybersecurity
- Data Science & Analytics, Databases & Data Engineering, DevOps & SRE
- Embedded & IoT, Frontend Development, Game Development
- Mobile Development, No-code/Low-code Products, Open Source
- Prompt Engineering, QA & Test Automation, System Design, Web3 & Blockchain

### Product & Startup

- Dev to Product Transition, Indie Hacking & Micro-SaaS
- Monetizing Side Projects, Starting a Startup, Startup Career

### Career & Growth

- AI Career Impact, BigTech Career, Burnout Prevention, Freelance & Consulting
- Path to Management, Path to Tech Lead/Architect, Relocation & Visas
- Remote-first Career, Salary Negotiation, Team Building & Hiring
- Technical Interviews, Technical Mentoring, Work-life Balance

### Content & DevRel

- Developer Relations, Public Speaking, Technical Writing
- Tech Blogging, Tech YouTube/Podcast

### Industries

- E-commerce, Edtech, Fintech, Gaming Industry
- Greentech & Climate, Healthtech, Media & Entertainment

---

## Personal Interests (50 options)

Organized into 6 categories:

### Sports & Activity

- CrossFit, Cycling, Dancing, Hiking & Trekking, Martial Arts
- Padel/Tennis, Rock Climbing, Running, Skiing/Snowboarding
- Swimming, Yoga

### Culture & Arts

- 3D/Generative Art, Drawing/Illustration, History, Languages
- Music (listening), Non-fiction & Business Books, Philosophy
- Photography, Playing Music, Theater & Stand-up, Writing & Storytelling

### Lifestyle & Wellness

- Biohacking, Cooking, DIY & Making, Gardening
- Meditation & Mindfulness, Minimalism, Parenting, Pets
- Psychology & Self-improvement, Specialty Coffee, Travel, Wine/Craft Beer

### Tech & Science

- Astronomy, Crypto, Popular Science, Smart Home

### Entertainment & Games

- Anime & Manga, Board Games, Chess, Esports
- Movies & TV Shows, Podcasts, Poker, Sci-fi & Fantasy, Video Games

### Finance & Investment

- Investing, Personal Finance, Real Estate

---

## Match Record Structure

When two users are matched:

| Field           | Type            | Description                                   |
| --------------- | --------------- | --------------------------------------------- |
| `Week_Start`    | Date            | The Monday of the matching week               |
| `Member1`       | Link to Members | First user in the pair                        |
| `Member2`       | Link to Members | Second user in the pair                       |
| `Status`        | Single Select   | Matched, Met, NoShow                          |
| `Notifications` | Single Select   | Sent, Failed, Pending                         |
| `We_Met_1`      | Single Select   | Met, Scheduled, No, Fail (Member1's feedback) |
| `We_Met_2`      | Single Select   | Met, Scheduled, No, Fail (Member2's feedback) |
| `Feedback1`     | Number          | Member1's satisfaction rating (1-5)           |
| `Feedback2`     | Number          | Member2's satisfaction rating (1-5)           |

---

## How This Data Could Be Used

### For Smart Matching

- Match users with overlapping `Professional_Interests` or `Personal_Interests`
- Respect `Serendipity` preference (low = similar interests, high = diverse)
- Respect `Proximity` preference (only match same city/country if high)
- Match users with compatible `Languages` and `Time_Zone`
- Match users with overlapping `Best_Meetings_Days`

### For Personalization

- Generate conversation starters based on shared interests
- Customize weekly messages based on `Coffee_Goals`
- Send reminders at appropriate times based on `Time_Zone`

### For Analytics

- Track which interest combinations lead to highest satisfaction
- Identify power users (most coffees, highest ratings)
- Detect churn patterns (users who go Passive)
