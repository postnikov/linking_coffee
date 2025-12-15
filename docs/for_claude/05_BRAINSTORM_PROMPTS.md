# Linked.Coffee — Brainstorm Prompts for Claude

> **Purpose:** Ready-to-use prompts for brainstorming sessions with Claude on product development, growth, and marketing.

---

## How to Use This Document

1. Open a new Claude conversation
2. Upload the other documents in this folder as context
3. Use one of these prompts to start a focused brainstorm
4. Iterate: ask follow-up questions, request specifics, challenge ideas

---

## Product Development Prompts

### Smart Matching Algorithm

```
Based on the user profile schema, design a matching algorithm that considers:
- Professional and personal interest overlap
- Serendipity and proximity preferences
- Timezone compatibility
- Language matching
- Previous match history (don't repeat pairs)

Propose a scoring function and explain the tradeoffs.
```

### Conversation Starters Feature

```
Users get matched but don't know what to talk about. Design a system that generates 3-5 conversation starters based on:
- Shared professional interests
- Shared personal interests
- Complementary experiences (e.g., one is senior, one is junior)
- Geographic proximity or contrast

Give me 10 example starters for different scenarios.
```

### Reduce No-Shows

```
~20% of matches result in no-shows. Propose 5 interventions to reduce this, considering:
- Reminder timing and frequency
- Social proof / accountability mechanisms
- Gamification (streaks, badges)
- Consequences (soft vs hard)
- User psychology

For each, estimate effort to implement and expected impact.
```

### Premium Tier Design

```
We want to monetize with a premium tier. Propose features for:
- Free tier (current)
- Pro tier ($X/month)
- Premium tier ($Y/month)

Features should be valuable but not break the experience for free users.
Include pricing suggestions with reasoning.
```

---

## Growth & Virality Prompts

### Referral Program Design

```
Design a referral program that encourages users to invite friends.
Consider:
- What reward works for both referrer and referee?
- How do we prevent gaming?
- What's the viral loop?
- How do we measure success?

Propose 3 different approaches with pros/cons.
```

### Community Building

```
Beyond 1:1 matches, how can we build a community around Linked.Coffee?
Ideas to explore:
- Slack/Discord community
- Public events (virtual/IRL)
- Content (newsletter, podcast)
- User-generated content
- Ambassadors program

Propose a phased roadmap.
```

### Acquisition Channels

```
Where can we find tech professionals who would love Linked.Coffee?
For each channel, estimate:
- Reach potential
- CAC (cost to acquire)
- Quality of users
- Effort to execute

Channels to consider: ProductHunt, Twitter/X, LinkedIn, dev.to, Hacker News, podcasts, conferences, communities.
```

---

## Marketing & Positioning Prompts

### Positioning Statement

```
Help me refine our positioning:

Current: "Random Coffee for tech professionals"

Constraints:
- Must differentiate from LinkedIn, Lunchclub, corporate Random Coffee
- Must appeal to developers, PMs, founders
- Must convey: genuine, global, serendipitous

Propose 5 alternative positioning statements with taglines.
```

### Landing Page Copy

```
Rewrite our landing page (linked.coffee) to:
- Hook visitors in 5 seconds
- Explain value prop in 30 seconds
- Convert to signup

Structure:
- Hero headline + subheadline
- 3 key benefits
- How it works (3 steps)
- Social proof section
- FAQ
- CTA
```

### Content Strategy

```
Propose a content strategy to attract and engage our target audience.
Consider:
- Blog posts (topics, frequency)
- Social media (platforms, tone)
- Email newsletter (content, cadence)
- User stories / case studies

Goal: Build authority as the go-to platform for meaningful professional connections.
```

---

## Analytics & Metrics Prompts

### North Star Metric

```
What should be our North Star metric for Linked.Coffee?
Candidates:
- Weekly Active Users (opted-in)
- Matches Completed (meetings happened)
- Average Satisfaction Score
- 4-Week Retention

Recommend one with reasoning. How does it ladder up to business value?
```

### Cohort Analysis Design

```
Design a cohort analysis framework to understand:
- User activation (what % complete first coffee?)
- Retention (what % return week after week?)
- Churn predictors (what signals someone will drop?)
- Power users (what differentiates heavy users?)

What data do we need? What visualizations?
```

---

## Feature Prioritization Prompts

### Roadmap Prioritization

```
Given these potential features:
1. Smart matching algorithm
2. Conversation starters
3. Referral program
4. Premium tier
5. Mobile app
6. In-app messaging
7. Group coffees (3-4 people)
8. Streak rewards / gamification
9. Community Discord
10. Corporate accounts

Prioritize using RICE framework (Reach, Impact, Confidence, Effort).
What should we build in the next 3 months?
```

### Build vs Buy vs Skip

```
For each feature, recommend: Build, Buy/Integrate, or Skip

- Smart matching → ?
- In-app video calls → ?
- Payment processing → ?
- Email marketing automation → ?
- Analytics dashboard → ?
- Chatbot for FAQ → ?
- A/B testing framework → ?
```

---

## Technical Prompts

### Scaling Considerations

```
The current stack (Airtable + Node.js + Telegram) works for hundreds of users.
What happens at 10K users? 100K users?

Identify:
- Bottlenecks
- Migration paths
- When to migrate (trigger points)
```

### Airtable to Postgres Migration

```
We might need to migrate from Airtable to Postgres.
Create a migration plan:
- Schema design
- Data migration strategy
- Code changes required
- Rollback plan
- Timeline estimate
```

---

## User Research Prompts

### Interview Script

```
Design a 30-minute user interview script to understand:
- Why users signed up
- What they get from the coffees
- What frustrates them
- What would make them recommend to friends
- What would make them pay

Include screener questions to select interviewees.
```

### Survey Design

```
Design a post-match survey (max 3 questions, <1 min to complete) that captures:
- Match quality
- Conversation quality
- Likelihood to continue participating

Make it lightweight but insightful.
```

---

## Use These Prompts When...

| Situation             | Start With                               |
| --------------------- | ---------------------------------------- |
| Planning next quarter | Roadmap Prioritization                   |
| User churn is high    | Reduce No-Shows, Cohort Analysis         |
| Need more users       | Acquisition Channels, Referral Program   |
| Monetization pressure | Premium Tier Design                      |
| Brand feels unclear   | Positioning Statement, Landing Page Copy |
| Too many ideas        | Build vs Buy vs Skip                     |
