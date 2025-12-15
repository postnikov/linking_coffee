# Linked.Coffee — Product Context for Claude

> **Purpose of this document:** This is the master context file for Claude to understand Linked.Coffee as a product partner. It contains everything Claude needs to brainstorm product development, growth strategies, marketing ideas, and feature prioritization.

---

## 1. What is Linked.Coffee?

Linked.Coffee is a **"Random Coffee" service for tech professionals** — developers, product managers, founders, executives, and analysts. It breaks people out of their professional bubbles by connecting them for 30-50 minute online coffee chats with strangers outside their usual circles.

### The Problem We Solve

- Professionals get trapped in echo chambers (same colleagues, same meetups, same Telegram channels)
- Social media algorithms reinforce homogeneity
- Fresh ideas, unexpected opportunities, and cross-industry insights pass people by
- Traditional networking is transactional ("collecting business cards")

### Our Unique Value Proposition

- **Not networking** — genuine conversations with no preset agenda
- **Smart matching** — considering experience, interests, and goals
- **Low commitment** — one conversation per week, completely optional
- **Serendipity by design** — meeting people you would never meet on your own

### Core Promise

> "The best career opportunities come from people you don't know yet. Linked.Coffee helps you meet them."

---

## 2. How It Works (Weekly Cycle)

```
Saturday  → Bot asks: "Are you in for next week?" via Telegram
Sunday    → Users confirm or skip
Monday    → Matched users receive their partner's profile + conversation starters
During Week → Users schedule and have their 30-50 min coffee chat
Midweek   → Bot checks in: "Have you met yet?"
Weekend   → Bot collects feedback: "How was it?"
```

### Key Mechanics

1. **Opt-in Weekly:** Users can skip any week by pressing a button
2. **Telegram-First:** All communication happens via Telegram bot
3. **Profile-Rich Matching:** Interests, profession, goals, languages, timezone
4. **Conversation Starters:** System generates ice-breakers based on shared interests

---

## 3. Target Audience

### Primary Persona: "The Tech Professional"

- **Role:** Developer, PM, Engineering Manager, Founder, Analyst
- **Seniority:** Junior to C-Level (but mostly Mid-Senior)
- **Geography:** Global (focus on English and Russian speakers)
- **Motivation:** Professional growth, fresh perspectives, escaping the bubble
- **Behavior:** Active on Telegram, values time, skeptical of traditional networking

### Secondary Personas

- **The Startup Person:** Looking for co-founders, advisors, early employees
- **The Career Changer:** Wants to explore new industries/roles
- **The Remote Worker:** Craves human connection and diverse perspectives
- **The Knowledge Seeker:** Curious generalist, loves learning from experts

---

## 4. Current Feature Set

### User-Facing Features

| Feature            | Description                                       | Status  |
| ------------------ | ------------------------------------------------- | ------- |
| Landing Page       | Modern, elegant landing with glassmorphism design | ✅ Live |
| Registration       | Telegram-based OTP verification                   | ✅ Live |
| Profile Builder    | Rich profile with profession, interests, goals    | ✅ Live |
| Dashboard          | View/edit profile, see current match              | ✅ Live |
| Public Profiles    | View your match's profile                         | ✅ Live |
| Weekly Opt-in      | Saturday invitation via Telegram                  | ✅ Live |
| Match Notification | Monday match delivery with conversation starters  | ✅ Live |
| Midweek Check-in   | "Have you met?" feedback collection               | ✅ Live |
| Weekend Feedback   | Post-match satisfaction rating                    | ✅ Live |
| Bilingual Support  | English and Russian                               | ✅ Live |

### Admin Features

| Feature            | Description                     | Status  |
| ------------------ | ------------------------------- | ------- |
| Admin Dashboard    | View all users, matches, logs   | ✅ Live |
| System Health      | View logs, scheduler, backups   | ✅ Live |
| Broadcast Messages | Send announcements to all users | ✅ Live |
| Bot Health Check   | Test Telegram bot connectivity  | ✅ Live |

### Profile Fields

Users can specify:

- **Basic:** Name, photo, country, city, timezone, LinkedIn
- **Professional:** Profession, grade (Junior → C-Level), professional description
- **Interests:** 50+ professional interests, 50+ personal interests
- **Preferences:** Serendipity slider (0-10), Proximity slider (0-10)
- **Availability:** Best meeting days, languages spoken
- **Goals:** "Casual Chat" or "Professional Chat"

---

## 5. Key Metrics to Track

### Engagement Metrics

- **Weekly Active Rate:** % of users who opt-in each week
- **Match Completion Rate:** % of matches that actually meet
- **Activation Rate:** % of new signups who complete first coffee chat
- **Retention (W4/W8/W12):** % of users still participating after 4/8/12 weeks

### Quality Metrics

- **Match Satisfaction Score:** Average rating (1-5) from feedback
- **No-Show Rate:** % of matches where one party ghosts
- **Repeat Opt-in Rate:** How many weeks in a row users participate

### Growth Metrics

- **Signups/week**
- **Referral rate** (if implemented)
- **Viral coefficient** (if implemented)

---

## 6. Technical Architecture

### Stack

- **Frontend:** React (hosted on Nginx)
- **Backend:** Node.js + Express
- **Database:** Airtable (5 tables: Members, Countries, Cities, Matches, Logs)
- **Bot:** Telegram Bot API
- **Hosting:** Docker on VPS (Hetzner)
- **Domain:** linked.coffee

### Automation Scripts

The system runs 14 automation scripts including:

- `match-users.js` — Weekly random pairing algorithm
- `notify-matches.js` — Send match notifications
- `weekly-checkin.js` — Weekend opt-in messages
- `midweek-checkin.js` — "Have you met?" check
- `weekend-feedback.js` — Satisfaction collection
- `broadcast-message.js` — Admin announcements
- `backup-airtable.js` — Daily database backups

---

## 7. Current Limitations / Known Issues

1. **Matching is random** — No smart matching algorithm yet (interests not used)
2. **No referral system** — Users can't invite friends
3. **No premium tier** — Everyone is "Free" (monetization not implemented)
4. **No conversation starters** — Promised but not built yet
5. **No in-app chat** — Users have to exchange contacts externally
6. **Single language matching** — Users can speak multiple languages but matching doesn't consider this
7. **No timezone-aware scheduling** — Bot messages go out at fixed times
8. **No mobile app** — Web-only (Telegram is mobile interface)

---

## 8. Competitive Landscape

### Direct Competitors (Random Coffee Services)

| Product                 | Focus                   | Differentiator                        |
| ----------------------- | ----------------------- | ------------------------------------- |
| Random Coffee (various) | Corporate/internal      | Enterprise-focused, Slack integration |
| Lunchclub               | Professional networking | AI-matching, US-focused, very formal  |
| Donut (Slack)           | Team bonding            | Internal teams only                   |

### Indirect Competitors

- **LinkedIn** — Professional networking (but transactional)
- **Twitter/X** — Public conversations (but performative)
- **Clubhouse/Discord** — Audio communities (but ephemeral)
- **Masterminds/Cohorts** — Structured groups (but expensive)

### Our Positioning

- **More personal** than LinkedIn
- **More global** than corporate Random Coffee
- **More casual** than Lunchclub
- **Tech-native** — built for developers/PMs who live on Telegram

---

## 9. Growth Opportunities (Brainstorm Areas)

### Product Ideas

- Smart matching using professional/personal interests
- AI-generated conversation starters based on profiles
- "Icebreaker games" for the first 5 minutes
- Post-call "connection cards" summarizing the conversation
- Opt-in "meet again" feature for great matches
- Community Slack/Discord for members
- Achievement badges / gamification

### Monetization Ideas

- Premium tier with preference controls
- Priority matching for premium users
- Company accounts for team random coffees
- Sponsored matches (e.g., "Meet a Stripe engineer")
- Conference partnerships

### Growth/Virality Ideas

- Referral program ("Invite a friend, get priority matching")
- Public leaderboard of "most coffees had"
- Shareable match stories ("I met X and we ended up...")
- Integration with tech communities (dev.to, Hacker News, etc.)
- Ambassador program at tech conferences

### Engagement Ideas

- Streak rewards for consecutive weeks
- "Coffee themes" (this week: career transitions)
- Group coffees (3-4 people)
- Monthly "best match" community votingT

---

## 10. Open Questions for Brainstorming

1. **How do we prevent no-shows?** (Currently ~20% estimated)
2. **What makes a "great" match?** (Should we optimize for similarity or diversity?)
3. **How do we re-engage churned users?**
4. **Should we expand beyond tech professionals?**
5. **What's the right pricing for premium?**
6. **How do we build community beyond 1:1 matches?**
7. **What would make users refer their friends?**
8. **How do we measure "quality of conversation"?**

---

## Summary

Linked.Coffee is a working Random Coffee product for tech professionals with a complete weekly engagement loop, rich profiles, and bilingual support. The core infrastructure is solid (Telegram bot, Airtable database, Docker deployment). The main opportunities are in smart matching, monetization, virality, and community building.
