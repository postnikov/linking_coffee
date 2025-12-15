# Linked.Coffee — Weekly Engagement Cycle

> **Purpose:** This document explains the complete weekly user engagement loop so Claude can understand the product mechanics and suggest improvements.

---

## Weekly Calendar

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SATURDAY                                                                  │
│ 📩 Weekend Invitation: "Are you in for next week?"                       │
│    → Button: "Yes, I'm in ✅"                                            │
│    → Button: "No, I'll skip 🪫"                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ SUNDAY                                                                    │
│ ⏳ Deadline for opt-in. System locks participation status.               │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ MONDAY (early morning)                                                   │
│ 🎲 Matching Algorithm runs:                                              │
│    1. Fetches all users with Next_Week_Status = "Active"                │
│    2. Randomly shuffles and pairs them                                   │
│    3. Creates Match records in Airtable                                  │
│    4. Updates Current_Week_Status to "Matched"                          │
│                                                                          │
│ 📩 Match Notification sent to both users:                               │
│    "Your Linked.Coffee match this week is: [Name]"                      │
│    + Link to partner's profile                                          │
│    + (TODO: Conversation starters based on shared interests)            │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ DURING THE WEEK                                                          │
│ 👥 Users exchange contacts and schedule their 30-50 min call            │
│    (via Zoom, Google Meet, or in-person if in the same city)            │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ WEDNESDAY/THURSDAY                                                       │
│ 📩 Midweek Check-in: "Have you met yet?"                                │
│    → Button: "We met ✅"                                                 │
│    → Button: "We scheduled 📆"                                           │
│    → Button: "Something went wrong 😔"                                   │
│                                                                          │
│ If "We met" → Follow-up: "How was it? Rate 1-5"                         │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ FRIDAY/SATURDAY                                                          │
│ 📩 Weekend Feedback (if not already collected):                         │
│    "How was your coffee with [Name]? Rate 1-5"                          │
│                                                                          │
│ AND the cycle repeats with the next Weekend Invitation                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Message Templates

### Weekend Invitation (Saturday)

**For Active Users:**

> Hey [Name]! 👋
> Ready for another great conversation next week?
>
> [Yes, I'm in ✅] [No, I'll skip 🪫]

**For Passive Users:**

> Hey [Name]! 👋
> We miss you at Linked.Coffee! Want to join a random coffee chat next week?
>
> [Yes, I'm in ✅] [No, I'll skip 🪫]

### Match Notification (Monday)

> ☕ Your Linked.Coffee match this week:
>
> **[Name Family]** > [Profession] | [City, Country]
>
> 📎 View their profile: [link]
>
> Reach out and schedule your 30-50 min chat!

### Midweek Check-in (Wednesday)

> 👋 Hey [Name]!
>
> Have you had your Linked.Coffee chat with [MatchName] yet?
>
> [We met ✅] [We scheduled 📆] [Something went wrong 😔]

### Feedback Collection

> How was your coffee with [MatchName]?
>
> [⭐️] [⭐️⭐️] [⭐️⭐️⭐️] [⭐️⭐️⭐️⭐️] [⭐️⭐️⭐️⭐️⭐️]

---

## Backend Scripts

| Script                      | Trigger                    | Action                                       |
| --------------------------- | -------------------------- | -------------------------------------------- |
| `weekend-invitation-all.js` | Saturday (cron or manual)  | Sends opt-in messages to all eligible users  |
| `match-users.js`            | Monday morning (manual)    | Pairs active users and creates Match records |
| `notify-matches.js`         | After matching             | Sends match notifications via Telegram       |
| `midweek-checkin.js`        | Wednesday (cron or manual) | Sends "Have you met?" messages               |
| `weekend-feedback.js`       | Friday/Saturday            | Collects satisfaction ratings                |

---

## State Machine: User Status

```
                    ┌─────────────┐
                    │   Passive   │ ← Default state / Skipped week
                    └──────┬──────┘
                           │ "Yes, I'm in ✅"
                           ↓
                    ┌─────────────┐
                    │   Active    │ ← Opted in for next week
                    └──────┬──────┘
                           │ Monday matching
                           ↓
                    ┌─────────────┐
                    │   Matched   │ ← Has a partner this week
                    └──────┬──────┘
                           │ Week ends / New cycle
                           ↓
                    ┌─────────────┐
                    │   Passive   │ ← Reset for next cycle
                    └─────────────┘
```

---

## Improvement Opportunities

1. **Smart Matching:** Use interests/preferences instead of random
2. **Timezone-aware messaging:** Send invitations at appropriate local times
3. **Conversation Starters:** Generate AI-based icebreakers
4. **No-show prevention:** Reminder messages before scheduled calls
5. **Streak rewards:** Gamify consecutive week participation
6. **Re-engagement campaigns:** Special messages for churned users
