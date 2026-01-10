# Linked.Coffee — Go-to-Market & Monetization Strategy

> **Purpose:** This document defines the growth and monetization strategy for Linked.Coffee. It serves as shared context for all team members and AI assistants working on the project.
> 
> **Last updated:** January 2025

---

## 1. Current State

| Metric | Value |
|--------|-------|
| Active users (opt-in at least 1x/month) | ~20 |
| Weekly retention | ~50% |
| Acquisition source | Founder's personal posts (LinkedIn, Telegram) |
| Revenue | €0 |

### Existing Assets
- Working Telegram bot with full weekly cycle
- AI-generated match cards (descriptions + images)
- Rich user profiles with interests matching
- Bilingual support (EN/RU)
- Closed communities feature (90% ready)

---

## 2. Strategic Goals

### 6-Month Targets (July 2025)

| Goal | Target |
|------|--------|
| Active B2C users | 1,000+ |
| Paying B2B communities | 20+ |
| Monthly revenue | €1,000+ |

### Constraints
- Founder time: 5-6 hours/week on marketing
- Budget: €200-300/month
- Preference: Technical solutions over manual sales

---

## 3. Two-Track Strategy

### Core Thesis
**B2B finances B2C.** Closed communities generate revenue and validation. Each community becomes a funnel into the open user base.

```
┌─────────────────────────────────────────────────────────────┐
│                      B2B TRACK                               │
│  Closed communities for companies & existing communities     │
│  → Revenue now                                               │
│  → Each community = potential users for B2C                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    "Trojan Horse"
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      B2C TRACK                               │
│  Open global base of tech professionals                      │
│  → Scale through virality                                    │
│  → Network effects                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. B2B: Closed Communities

### Value Proposition
Tech communities and companies can run their own Random Coffee on Linked.Coffee platform — zero setup, automated weekly cycle, rich profiles.

### Pricing
- Launch price: €50/month per community
- Free trial: 2 months for early adopters

### Target Customers
1. Telegram communities for developers/PMs
2. Company internal teams (engineering, product)
3. Conference organizers (networking for attendees)
4. DevRel teams (community engagement)

### Sales Approach
Warm outreach only. No cold sales. Message template:

> "Привет! Делаю Linked.Coffee — random coffee для tech-людей. 
> Сейчас добавляю возможность запускать закрытые random coffee внутри сообществ.
> 
> Подумал, что для [название сообщества] это может быть полезно — участники смогут знакомиться друг с другом без усилий с твоей стороны.
> 
> Хочу протестировать с 2-3 сообществами. Первые 2 месяца бесплатно, потом €50/мес если зайдёт.
> 
> Интересно глянуть?"

### Trojan Horse Mechanic
Users in closed communities see option:
> "Want to meet people beyond your community? Join the global base →"

Each 50-person community → 10-20 new B2C users.

---

## 5. B2C: Viral Growth Mechanics

### Priority 1: Shareable Match Cards ⭐
**Status:** 80% ready (AI generation exists)
**Effort:** 0.5 day

**What to add:**
After feedback collection, show button in Telegram bot:
```
[📤 Share on LinkedIn]
```

Generates pre-filled post:
- AI-generated match image
- Template text (editable):

> "Сегодня у меня Linked.Coffee с [Name] — [role]. 
> AI подсказал, что нам стоит поговорить о [topic].
> 
> Кто ещё хочет случайных кофе с интересными людьми из tech?
> → linked.coffee"

**Key:** Button appears AFTER the meeting (during feedback), not before. People share what already happened.

### Priority 2: Referral Program
**Effort:** 2-3 days

Mechanic:
- Personal referral link in profile
- Reward: Both referrer and referee get "priority matching" for 1 week
- Track referrals in Airtable

### Priority 3: Streak Badges
**Effort:** 1-2 days

Profile badges:
- "5 coffees in a row"
- "10 meetings total"
- "International" (met people from 5+ countries)
- "Connector" (referred 3+ people)

Badges are shareable → additional viral loop.

---

## 6. Partnership Strategy

### Target Partners

| Partner Type | Value for Them | Value for Us |
|--------------|----------------|--------------|
| Tech Telegram channels | Content (match stories) | Exposure to audience |
| DevRel teams | Community engagement tool | Access to their community |
| Online conferences | Networking feature for attendees | Batch user acquisition |
| Tech podcasts | Interesting topic for episode | Credibility + reach |

### Partnership Pitch Angle
"Random Coffee stories" — share anonymized interesting matches:
> "PM from fintech met CTO of edtech startup. They discovered they're solving the same problem from different angles. Now exploring partnership."

---

## 7. Growth Model

### Projected Trajectory (Optimistic but Realistic)

| Month | B2B Communities | B2C Users | MRR |
|-------|-----------------|-----------|-----|
| 1 | 3 | 30 | €150 |
| 2 | 5 | 80 | €250 |
| 3 | 8 | 200 | €400 |
| 4 | 12 | 400 | €600 |
| 5 | 15 | 700 | €750 |
| 6 | 20 | 1,000+ | €1,000 |

### Key Assumptions
- Each B2B community averages 30-50 members
- 20-30% of closed community users convert to open base
- Shareable cards generate 2-3 signups per share
- Referral program achieves 0.3 viral coefficient

---

## 8. Weekly Time Allocation

Total: 5-6 hours/week

| Activity | Hours | Notes |
|----------|-------|-------|
| Code (viral features, improvements) | 3 | Founder's strength |
| Outreach (5-10 messages to partners/communities) | 1 | Warm contacts only |
| Content (1 LinkedIn post about Linked.Coffee) | 1 | Leverage existing audience |
| Operations (matching, support) | 0.5 | Mostly automated |

---

## 9. Immediate Priorities

### This Week
- [ ] Finish closed communities feature (2-3 days)
- [ ] Add "Share on LinkedIn" button to match cards (0.5 day)
- [ ] Send outreach to 3 community leaders (1 hour)

### This Month
- [ ] Onboard 3 paying communities
- [ ] Implement referral links
- [ ] Create "Linked.Coffee for Communities" landing page

### This Quarter
- [ ] Reach 200 active B2C users
- [ ] 8+ paying communities
- [ ] Implement streak badges
- [ ] First partnership with tech media/podcast

---

## 10. Success Metrics

### North Star Metric
**Matches Completed per Week** — number of coffee meetings that actually happened.

This metric captures:
- User activation (they opt-in)
- Match quality (they show up)
- Product value (they keep coming back)

### Supporting Metrics

| Metric | Current | Target (6mo) |
|--------|---------|--------------|
| Weekly opt-in rate | ~50% | 70% |
| Match completion rate | Unknown | 80% |
| Referral rate | 0% | 10% |
| Share rate (cards) | 0% | 15% |
| B2B churn | N/A | <10%/month |

---

## 11. What We're NOT Doing (Yet)

To maintain focus, these are explicitly deprioritized:

- ❌ Mobile app
- ❌ Paid advertising
- ❌ Cold outreach / sales team
- ❌ Premium individual tier (focus on B2B first)
- ❌ In-app video calls
- ❌ Expansion beyond tech professionals

Revisit after reaching 1,000 users.

---

## 12. Open Questions

1. **Optimal B2B pricing** — €50/month is starting point. Test €100 for larger communities?
2. **Language matching** — Should closed communities be single-language by default?
3. **Cross-pollination** — How much should closed community users see the global base?
4. **No-show penalty** — Implement soft consequences for repeated no-shows?

---

## Summary

Linked.Coffee grows through two synergistic tracks:
1. **B2B (closed communities)** → Revenue + user acquisition funnel
2. **B2C (viral mechanics)** → Scale through shareable cards + referrals

Founder focuses on technical solutions (viral features, automation) rather than manual sales. Warm outreach only. Content leverages existing audience.

**Next action:** Finish closed communities feature, add share button, send 3 outreach messages.
