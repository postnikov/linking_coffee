# Linked.Coffee — Closed Communities MVP

**Purpose:** Architecture and implementation plan for closed communities feature. MVP scope with future scalability in mind.

---

## 1. Core Concept

**Closed Communities** allow groups of people to have their own isolated Random Coffee pool. Members of a community only get matched with other members of the same community — they don't participate in the global Linked.Coffee pool.

### Use Cases

- **PRO Community** — Russian-speaking tech professionals learning together
- **Company teams** — Internal networking within organizations
- **Conference attendees** — Temporary community for event participants
- **Alumni networks** — University or bootcamp graduates

---

## 2. Key Design Decisions

| Decision         | Choice                  | Rationale                                      |
| ---------------- | ----------------------- | ---------------------------------------------- |
| User ↔ Community | Many-to-many            | User can be in PRO Community AND their company |
| Matching scope   | Per community, isolated | No cross-community matching                    |
| Admin model      | Any user can be admin   | Scalable, self-service                         |
| Join mechanism   | Invite code             | Simple, controllable                           |
| MVP admin        | Max (hardcoded)         | Simplify initial implementation                |

---

## 3. Database Architecture

### New Table: Communities - done

| Field          | Type          | Example                    | Description                 |
| -------------- | ------------- | -------------------------- | --------------------------- |
| `Community_ID` | Autonumber    | 1                          | Primary key                 |
| `Name`         | Text          | "PRO Community"            | Display name                |
| `Slug`         | Text          | "pro"                      | URL-friendly identifier     |
| `Invite_Code`  | Text          | "PRO2025"                  | Code for joining            |
| `Description`  | Long Text     | "Community for..."         | Shown on join page          |
| `Status`       | Single Select | Active / Paused / Archived | Controls visibility         |
| `Logo`         | Attachment    | —                          | Community branding (future) |
| `Created_At`   | Date          | 2025-01-15                 | Creation timestamp          |
| `Settings`     | Long Text     | `{"lang": "ru"}`           | JSON for future flexibility |

---

### New Table: Community_Members (Junction Table) - done

This enables many-to-many relationship between Members and Communities.

| Field        | Type                | Example                   | Description                |
| ------------ | ------------------- | ------------------------- | -------------------------- |
| `ID`         | Autonumber          | 1                         | Primary key                |
| `Member`     | Link to Members     | rec123                    | User reference             |
| `Community`  | Link to Communities | rec456                    | Community reference        |
| `Role`       | Single Select       | Member / Admin / Owner    | Permission level           |
| `Status`     | Single Select       | Active / Paused / Removed | Membership status          |
| `Joined_At`  | Date                | 2025-01-15                | When user joined           |
| `Invited_By` | Link to Members     | rec789                    | Referral tracking (future) |


---

### Changes to Existing Tables - done

#### Members Table

| Field               | Type                | Description                                                |
| ------------------- | ------------------- | ---------------------------------------------------------- |
| `Primary_Community` | Link to Communities | **NEW:** Default community for weekly opt-in               |
| `Is_Global_Pool`    | Checkbox            | **NEW:** TRUE = participates in global pool (default TRUE) |

> **Note:** `Primary_Community` determines which community the user opts into by default. If they're in multiple communities, they can switch (future feature).

#### Matches Table

| Field       | Type                | Description                                                    |
| ----------- | ------------------- | -------------------------------------------------------------- |
| `Community` | Link to Communities | **NEW:** Which community this match belongs to (NULL = global) |

---

## 4. User Flows

### Flow 1: Registration with Community Code

```
┌─────────────────────────────────────────────────────────────┐
│ REGISTRATION PAGE                                           │
│                                                             │
│ [Standard profile fields...]                                │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎫 Do you have a community invite code?                 │ │
│ │                                                         │ │
│ │ [____________] [Verify]                                 │ │
│ │                                                         │ │
│ │ ✅ "PRO Community" — Welcome!                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Complete Registration]                                     │
└─────────────────────────────────────────────────────────────┘
```

**Backend logic:**
1. User enters code (e.g., "PRO2025")
2. API checks `Communities` table for matching `Invite_Code`
3. If found and `Status = Active`:
   - Create `Community_Members` record (Role: Member, Status: Active)
   - Set `Members.Primary_Community` to this community
   - Set `Members.Is_Global_Pool` to FALSE
4. If not found: show error, allow retry or skip

---

### Flow 2: Weekly Matching (Modified)

```
┌─────────────────────────────────────────────────────────────┐
│ MONDAY MATCHING SCRIPT                                      │
│                                                             │
│ 1. Get all active Communities                               │
│    SELECT * FROM Communities WHERE Status = 'Active'        │
│                                                             │
│ 2. For each Community:                                      │
│    a. Get active members:                                   │
│       SELECT Members WHERE                                  │
│         Primary_Community = {community}                     │
│         AND Next_Week_Status = 'Active'                    │
│                                                             │
│    b. Shuffle and pair                                      │
│                                                             │
│    c. Create Match records with Community = {community}     │
│                                                             │
│ 3. Global pool (Members where Is_Global_Pool = TRUE):       │
│    a. Get active members with no Primary_Community          │
│    b. Shuffle and pair                                      │
│    c. Create Match records with Community = NULL            │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Match Notification (Modified)

Current message:
> ☕ Your Linked.Coffee match this week: **Name**

Community message:
> ☕ Your **PRO Community** coffee this week: **Name**

**Logic:** If `Match.Community` exists, include community name in notification.

---

## 5. MVP Scope

### In Scope (MVP)

| Feature | Description | Effort |
|---------|-------------|--------|
| Communities table | Create in Airtable | 15 min |
| Community_Members table | Create junction table | 15 min |
| Modify Members table | Add `Primary_Community`, `Is_Global_Pool` | 10 min |
| Modify Matches table | Add `Community` field | 10 min |
| Registration flow | Add invite code field | 2-3 hrs |
| Matching script | Group by community | 2-3 hrs |
| Match notification | Include community name | 30 min |
| Manual admin | Max manages via Airtable | 0 (manual) |

**Total MVP effort:** ~6-8 hours

### Out of Scope (Future)

- [ ] Admin UI for community owners
- [ ] Self-service community creation
- [ ] Multiple community participation per week
- [ ] Community-specific settings (matching frequency, etc.)
- [ ] Community analytics dashboard
- [ ] Billing and plans
- [ ] White-label branding
- [ ] API for enterprise integrations

---

## 6. Edge Cases

### Odd Number of Active Members

**Problem:** Community has 7 active members — one person has no match.

**MVP Solution:** 
- Leave one person unmatched
- Send message: "Not enough participants this week. You'll be first in line next time!"

**Future:** Option to match with global pool as fallback (opt-in per community setting).

---

### User Leaves Community

**Problem:** User wants to exit community and join global pool.

**MVP Solution:** 
- Manual: Max updates Airtable
- Set `Community_Members.Status = Removed`
- Set `Members.Primary_Community = NULL`
- Set `Members.Is_Global_Pool = TRUE`

**Future:** Self-service in profile settings.

---

### User Joins Second Community

**Problem:** User is in PRO Community, now joins Company XYZ community too.

**MVP Solution:**
- Create second `Community_Members` record
- Keep `Primary_Community` unchanged (first community)
- User only gets matched in Primary_Community

**Future:** Weekly choice of which community to participate in.

---

## 7. Data Model Diagram

```
┌─────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│   Communities   │       │  Community_Members  │       │     Members     │
├─────────────────┤       ├─────────────────────┤       ├─────────────────┤
│ Community_ID    │◄──────│ Community           │       │ Member_ID       │
│ Name            │       │ Member              │──────►│ Name            │
│ Slug            │       │ Role                │       │ Primary_Community│──┐
│ Invite_Code     │       │ Status              │       │ Is_Global_Pool  │  │
│ Status          │       │ Joined_At           │       │ ...             │  │
│ ...             │       └─────────────────────┘       └─────────────────┘  │
└─────────────────┘                                              │            │
        ▲                                                        │            │
        │                                                        │            │
        └────────────────────────────────────────────────────────┘            │
        │                                                                     │
        └─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│     Matches     │
├─────────────────┤
│ Match_ID        │
│ Member1         │───────► Members
│ Member2         │───────► Members
│ Community       │───────► Communities (NULL = global)
│ Week_Start      │
│ ...             │
└─────────────────┘
```

---

## 8. Implementation Checklist

### Phase 1: Database Setup (Day 1)

- [ ] Create `Communities` table in Airtable
- [ ] Create `Community_Members` table in Airtable
- [ ] Add `Primary_Community` field to Members
- [ ] Add `Is_Global_Pool` field to Members (default: TRUE)
- [ ] Add `Community` field to Matches
- [ ] Create first community record: "PRO Community"

### Phase 2: Registration Flow (Day 2)

- [ ] Add invite code input to registration page
- [ ] Create API endpoint to validate invite code
- [ ] On valid code: create Community_Members record
- [ ] On valid code: set Primary_Community
- [ ] On valid code: set Is_Global_Pool = FALSE
- [ ] Show community name confirmation to user

### Phase 3: Matching Script (Day 3)

- [ ] Modify `match-users.js` to group by Primary_Community
- [ ] First: match all communities
- [ ] Then: match global pool (Is_Global_Pool = TRUE)
- [ ] Set Community field on Match records
- [ ] Handle odd numbers (skip one member)

### Phase 4: Notifications (Day 3)

- [ ] Modify match notification to include community name
- [ ] Test with PRO Community members

### Phase 5: Testing (Day 4)

- [ ] Test registration with valid code
- [ ] Test registration with invalid code
- [ ] Test registration without code (global pool)
- [ ] Test matching within community
- [ ] Test matching in global pool
- [ ] Test odd number handling

---

## 9. First Community: PRO Community

| Field | Value |
|-------|-------|
| Name | PRO Community |
| Slug | pro |
| Invite_Code | `PRO2025` (или другой) |
| Description | Random Coffee для участников PRO Community — закрытое сообщество русскоязычных технарей |
| Status | Active |
| Settings | `{"lang": "ru", "notify_lang": "ru"}` |

**Initial members:** Import from existing PRO Community list (manual or script).

---

## 10. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Community activation | 50%+ of PRO members join | Community_Members count vs invited |
| Match completion rate | Same as global (~80%) | Matches.Status = Met / Total |
| Satisfaction score | ≥4.0 average | Matches.Feedback1 + Feedback2 |
| Retention W4 | 60%+ still active | Members still opting in after 4 weeks |

---

## 11. Future Roadmap

### v1.1 — Self-Service Admin
- Admin dashboard for community owners
- Add/remove members
- View community stats

### v1.2 — Multiple Communities
- User can choose which community to participate in each week
- Profile shows all community memberships

### v1.3 — Monetization
- Plans: Free (20 members), Starter (100), Pro (500), Enterprise (unlimited)
- Stripe integration for billing

### v1.4 — White-Label
- Custom branding per community
- Custom domain support
- Embeddable widget

---

## 12. Open Questions

1. **Invite code format:** Random string? Readable words? Expiring codes?
   
2. **Can users see community members list?** Or just get matched blindly?

3. **Community-specific profile fields?** (e.g., company role for corporate communities)

4. **Matching frequency per community?** (weekly default, but some might want bi-weekly)

---

*Document version: 1.0*
*Last updated: 2025-01-15*
*Author: Max + Claude*
