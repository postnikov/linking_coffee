# PRD: Closed Communities for Linked.Coffee

> **Version:** 1.0  
> **Date:** February 10, 2026  
> **Author:** Max Postnikov + Claude (brainstorm session)  
> **Status:** Draft — ready for development planning

---

## 1. Overview

### Problem
Linked.Coffee currently operates as a single global pool. Tech communities, companies, and organizers want to run Random Coffee **within their own group** — with their own members, their own matching, and their own admin controls — without building anything from scratch.

### Solution
A **Closed Communities** module that allows community admins to create isolated matching pools on top of existing Linked.Coffee infrastructure. Users join via invite links, get matched within their community, and optionally participate in the global pool.

### Strategic Context
- **B2B revenue track:** Communities at €50/month are the primary monetization path
- **Trojan horse:** Each community funnels users into the global B2C base
- **Modular architecture:** Must not break existing global matching flow

---

## 2. Key Decisions (from brainstorm)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where user chooses matching pool | Weekly at opt-in time | Maximum flexibility, no lock-in |
| Community notification cycle | Separate from global, same timing | Isolates community users from global spam |
| Odd user handling | Admin setting: skip or match with global pool | Different communities have different needs |
| Minimum community size | 6 active users for matching | Prevents repetitive pairings |
| Admin roles | Single admin (Owner) per community | Simplicity first; multi-admin later |
| Admin panel | Separate web page per community | Community admin ≠ system admin |
| Approval flow | Configurable: manual approval OR auto-join | Corporate communities need less friction |
| Invite links | Multiple per community with labels | Track different distribution channels |
| Expired link UX | "Link invalid — request new from admin" | Clear, actionable |
| Community UI location | Sidebar below current match | Non-intrusive for non-community users |
| Matching pool selector | "My Communities" page with radio button | Simple, no complex switcher |
| Profile visibility in community | Same as global | No additional complexity |
| Script architecture | One script with `--community` param + orchestrator | DRY principle, single maintenance point |
| Community deletion | Soft delete (Archived) with member notifications | Preserves history for potential restoration |
| "Don't participate" after deletion | Opt-out flag, user can self-reactivate via site | Respects user preference without permanent lock |
| Primary_Community field | Legacy — ignore | Replaced by weekly choice mechanism |
| Is_Global_Pool field | Legacy — ignore | Replaced by weekly choice mechanism |

---

## 3. User Stories

### 3.1 Community Admin

| ID | Story | Priority |
|----|-------|----------|
| CA-1 | As a community admin, I can view and edit my community's name, description, and logo | P0 |
| CA-2 | As a community admin, I can configure community settings (approval mode, member list visibility, invite link visibility, odd-user handling) | P0 |
| CA-3 | As a community admin, I can generate invite links with optional label, expiry date, and usage limit | P0 |
| CA-4 | As a community admin, I can deactivate existing invite links | P0 |
| CA-5 | As a community admin, I can see the list of all members with their status (Active, Pending, Paused, Removed) | P0 |
| CA-6 | As a community admin, I can approve or ignore pending membership requests (via Telegram bot and web) | P0 |
| CA-7 | As a community admin, I can remove a member from the community | P1 |
| CA-8 | As a community admin, I can see the list of matches for each week | P0 |
| CA-9 | As a community admin, I can delete the community (with serious confirmation) | P1 |
| CA-10 | As a community admin, I receive Telegram notifications when someone requests to join | P0 |

### 3.2 Community Member

| ID | Story | Priority |
|----|-------|----------|
| CM-1 | As a user, I can join a community via an invite link | P0 |
| CM-2 | As a community member, I can see my community info (name, description, member count) | P0 |
| CM-3 | As a community member, I can see the list of active members (if setting allows) | P1 |
| CM-4 | As a community member, I can see invite links (if setting allows) to share with others | P1 |
| CM-5 | As a community member, I choose weekly where to be matched: specific community OR global pool | P0 |
| CM-6 | As a community member, I receive community-specific weekly invitations via Telegram | P0 |
| CM-7 | As a community member, I can leave a community voluntarily | P0 |
| CM-8 | As a member of multiple communities, I see all my communities in one place | P0 |
| CM-9 | As a user not in any community, I see no community UI elements | P0 |

### 3.3 Joining Flow

| ID | Story | Priority |
|----|-------|----------|
| JF-1 | As a new user clicking an invite link, I go through normal registration and then get associated with the community | P0 |
| JF-2 | As an existing user clicking an invite link, I get associated with the community after login | P0 |
| JF-3 | As a user pending approval, I see a modal explaining my request is being reviewed | P0 |
| JF-4 | As a user pending approval, I receive a Telegram message confirming my request is pending | P0 |
| JF-5 | As a user who gets approved, I receive a Telegram notification that I'm in | P0 |
| JF-6 | As a user clicking an expired/exhausted invite link, I see a clear error message | P0 |

### 3.4 Community Deletion

| ID | Story | Priority |
|----|-------|----------|
| CD-1 | When a community is deleted, all members receive a Telegram notification with two buttons: "Join global Linked.Coffee" / "Don't participate for now" | P1 |
| CD-2 | "Don't participate" sets a no-notifications flag; user can self-reactivate via website | P1 |
| CD-3 | Community data is soft-deleted (Status → Archived), preserving history | P1 |

---

## 4. Database Schema Changes

### 4.1 New Table: `Invite_Links`

| Field | Type | Description |
|-------|------|-------------|
| `Link_ID` | autoNumber | Primary key |
| `Community` | Link to Communities | Parent community |
| `Code` | Text | Unique URL-safe code (e.g., `a7f3x9k2`) |
| `Label` | Text | Admin's label (e.g., "Telegram channel", "Email campaign Q1") |
| `Status` | Single Select | `Active`, `Disabled` |
| `Max_Uses` | Number | Max joins allowed (null = unlimited) |
| `Used_Count` | Number | Current usage count |
| `Expires_At` | Date/Time | Expiration date (null = never) |
| `Created_At` | Date/Time | Creation timestamp |
| `Created_By` | Link to Members | Admin who created it |

### 4.2 Communities Table — New Fields

| Field | Type | Description |
|-------|------|-------------|
| `Settings` | Long Text (JSON) | Community settings object (see below) |
| `Min_Active_For_Matching` | Number | Minimum active opt-ins needed (default: 6) |
| `Deleted_At` | Date/Time | Soft deletion timestamp |

**Settings JSON structure:**
```json
{
  "approval_mode": "manual" | "auto",
  "member_list_visible_to": "all_members" | "admin_only",
  "invite_links_visible_to": "all_members" | "admin_only",
  "odd_user_handling": "skip" | "global_pool"
}
```

### 4.3 Community_Members Table — Changes

Current schema is mostly sufficient. Clarifications:

| Field | Current | Change |
|-------|---------|--------|
| `Status` | `Active, Paused, Removed` | **Add:** `Pending` |
| `Invited_Via` | (doesn't exist) | **Add:** Link to Invite_Links — tracks which link they joined through |
| `Left_At` | (doesn't exist) | **Add:** Date/Time — when member voluntarily left |

### 4.4 Members Table — Changes

| Field | Current | Change |
|-------|---------|--------|
| `Matching_Context` | (doesn't exist) | **Add:** Single Select: `Global`, `Community:{ID}` — where user chose to match this week |
| `No_Global_Notifications` | (doesn't exist) | **Add:** Boolean — opt-out from global bot messages (set when community deleted + user chose "don't participate") |

### 4.5 Matches Table — Changes

| Field | Current | Change |
|-------|---------|--------|
| `Community` | Already exists (Link to Communities) | **Use as-is** — null for global matches, populated for community matches |

### 4.6 Fields to Deprecate (not delete yet)

- `Members.Primary_Community` — replaced by weekly `Matching_Context`
- `Members.Is_Global_Pool` — replaced by `Matching_Context`
- `Communities.Invite_Code` — replaced by `Invite_Links` table

---

## 5. API Endpoints

### 5.1 Community Info (Public for members)

```
GET /api/community/:slug
→ Returns: name, description, logo, member_count, settings (filtered by role)
→ Auth: Must be a member of this community

GET /api/community/:slug/members
→ Returns: List of active members (name, avatar, profession)
→ Auth: Member + settings.member_list_visible_to check

GET /api/community/:slug/matches?week=YYYY-MM-DD
→ Returns: This week's match list
→ Auth: Admin of this community only

GET /api/community/:slug/invite-links
→ Returns: Active invite links
→ Auth: Based on settings.invite_links_visible_to
```

### 5.2 Community Admin

```
PUT /api/community/:slug
→ Body: { name, description, logo, settings }
→ Auth: Community admin only

POST /api/community/:slug/invite-links
→ Body: { label, max_uses, expires_at }
→ Returns: { code, full_url }
→ Auth: Community admin only

PATCH /api/community/:slug/invite-links/:id
→ Body: { status: "Disabled" }
→ Auth: Community admin only

PATCH /api/community/:slug/members/:member_id
→ Body: { status: "Active" | "Removed" }
→ Auth: Community admin only

DELETE /api/community/:slug
→ Requires: confirmation token (double-confirm pattern)
→ Auth: Community admin only
→ Side effects: Soft delete, notify all members via Telegram
```

### 5.3 Member Actions

```
GET /api/my/communities
→ Returns: List of user's communities with role and status
→ Auth: Logged-in user

POST /api/community/join/:code
→ Joins community via invite code
→ Returns: { status: "active" | "pending", community info }
→ Auth: Logged-in user

POST /api/community/:slug/leave
→ Leaves community voluntarily
→ Auth: Must be a member

PUT /api/my/matching-context
→ Body: { context: "global" | "community:SLUG" }
→ Sets where user matches this week
→ Auth: Logged-in user
```

### 5.4 Invite Link Landing

```
GET /api/invite/:code/info
→ Returns: { valid: bool, community_name, community_description }
→ Public endpoint (no auth) — used by the join page to show info before login
```

---

## 6. Frontend Pages & Components

### 6.1 New Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/join/:code` | `JoinCommunityPage` | Landing for invite links. Shows community info, prompts login/register. After auth → triggers join flow |
| `/my/communities` | `MyCommunitiesPage` | List of user's communities + matching context radio selector |
| `/community/:slug` | `CommunityInfoPage` | Community details, member list (if allowed), invite links (if allowed) |
| `/community/:slug/admin` | `CommunityAdminPage` | Admin panel: settings, members management, invite links, weekly matches |

### 6.2 Modified Components

| Component | Change |
|-----------|--------|
| `Dashboard.js` | Add "My Communities" card in sidebar (below current match). Hidden if user has no communities |
| `GdprModal.js` | After consent, check if `pendingCommunityJoin` exists in session → show pending/approved modal |
| Registration flow | Persist `invite_code` in localStorage/session during registration, apply after completion |

### 6.3 New UI Elements

**Community Card (Sidebar)**
```
┌─────────────────────────────┐
│ ☕ My Communities             │
│                               │
│ 🟢 DevOps Pros (matching)    │
│ ⚪ Startup Founders           │
│                               │
│ [Manage →]                    │
└─────────────────────────────┘
```

**Matching Context Selector (MyCommunitiesPage)**
```
Where do you want to match this week?

○ Global Linked.Coffee pool
● DevOps Pros community
○ Startup Founders community

[Save choice]
```

**Pending Approval Modal**
```
┌─────────────────────────────────────┐
│  ⏳ Request Pending                  │
│                                       │
│  Your request to join "DevOps Pros"  │
│  is being reviewed by the admin.     │
│                                       │
│  You'll get a Telegram notification  │
│  once approved.                      │
│                                       │
│              [Got it]                 │
└─────────────────────────────────────┘
```

---

## 7. Telegram Bot Flows

### 7.1 New Callback Handlers (in server.js)

| Callback Pattern | Action |
|-----------------|--------|
| `community_approve:{communityMemberId}` | Set Community_Members.Status → Active, notify user |
| `community_ignore:{communityMemberId}` | Do nothing to status, inform admin of next steps |
| `community_deleted_join_global:{memberId}` | Remove No_Global_Notifications flag |
| `community_deleted_skip:{memberId}` | Set No_Global_Notifications = true |
| `community_participate_yes:{memberId}:{communitySlug}` | Set Matching_Context to community, Next_Week_Status to Active |
| `community_participate_no:{memberId}:{communitySlug}` | Set Matching_Context to null for this community week |

### 7.2 Community-Specific Bot Messages

**Weekly Invitation (community version):**
```
☕↔☕
Hey, {Name}!
New week at {Community Name}!

🟢 You'll get your match from the community tonight.
Want to skip this week? Press the button below.

[Yes, I'm in ✅] [Skip this week 🪫]
```

**Join Request → Admin Notification:**
```
👤 New join request for {Community Name}!

Name: {Name} {Family}
Telegram: @{username}
LinkedIn: {url or "not provided"}

[Approve ✅] [Ignore ⏸]
```

**Approval → User Notification:**
```
🎉 You're in!
Your request to join "{Community Name}" has been approved.
You'll receive your first match on Monday!
```

**Ignore → Admin Confirmation:**
```
⏸ Request not approved.
{Name} was not added to {Community Name}.
You can approve or remove them later from the admin panel:
→ linked.coffee/community/{slug}/admin
```

**Member Left → Admin Notification:**
```
👋 {Name} has left {Community Name}.
```

**Community Deleted → Members:**
```
ℹ️ The community "{Community Name}" has been closed by the admin.

Would you like to continue meeting people through the global Linked.Coffee pool?

[Yes, join global pool ✅] [Not now 🪫]
```

---

## 8. Script Refactoring

### 8.1 Architecture Principle

**One script, parameterized.** Community-specific logic is a filter on top of the same core logic.

### 8.2 Orchestrator: `match-all.js`

```
Purpose: Runs matching for all active communities, then for global pool
Flow:
  1. Fetch all communities with Status = "Active"
  2. For each community:
     - Count opt-ins for this community this week
     - If >= Min_Active_For_Matching → run match-users-ai.js --community={slug}
     - If < minimum → send "not enough participants" notice to admin
  3. Run match-users-ai.js (no flag) for global pool

Usage:
  node scripts/match-all.js
  node scripts/match-all.js --dry-run
```

### 8.3 Changes to `match-users-ai.js`

| Area | Current | New |
|------|---------|-----|
| Candidate fetch | `Next_Week_Status = Active` | + filter by `Matching_Context` (global or specific community) |
| Match record creation | No community field | Set `Community` field if community match |
| History | All matches | Filter history by community context |
| Status updates | `Current_Week_Status = Matched` | Same, but scoped |

**New flag:** `--community=SLUG`
- When present: fetch only members whose `Matching_Context = "community:{slug}"` and who are Active members of that community
- When absent: fetch only members whose `Matching_Context = "global"` (or null/empty)

### 8.4 Changes to Notification Scripts

All notification scripts need the same pattern:

**`weekend-invitation-all.js`** → Split into:
- Global invitations: users without active community membership OR with `Matching_Context = global`
- Community invitations: per community, only its Active members
- **Critical filter:** Skip users with `No_Global_Notifications = true` for global invitations
- **New:** `notify-community-invitations.js` (or parameterize existing)

**`notify-matches.js`** → Already has `Community` field on matches. Add community name to notification messages when applicable.

**`midweek-checkin.js`** / **`weekend-feedback.js`** → These work on Matches, which already carry Community context. Minimal changes needed — mainly ensure messages reference the community name.

### 8.5 Notification Orchestrator: `notify-all.js`

```
Purpose: Sends weekly invitations for all communities + global
Flow:
  1. For each active community → send community-specific invitations
  2. Send global invitations (excluding community-only users and No_Global_Notifications)
```

---

## 9. Join Flow — Detailed Sequence

```
User clicks: linked.coffee/join/a7f3x9k2
          │
          ▼
    ┌─────────────┐
    │ Validate     │ → Invalid/expired? → Show error page
    │ invite code  │
    └──────┬──────┘
           │ Valid
           ▼
    ┌─────────────┐
    │ Show community│ → Community name, description, "Join" CTA
    │ info page    │
    └──────┬──────┘
           │ User clicks "Join"
           ▼
    ┌─────────────┐
    │ Logged in?   │ → No → Redirect to /login?invite=a7f3x9k2
    │              │        (store invite code in localStorage)
    └──────┬──────┘
           │ Yes (or after login/register)
           ▼
    ┌─────────────┐
    │ Already a    │ → Yes → Show "You're already a member" message
    │ member?      │
    └──────┬──────┘
           │ No
           ▼
    ┌─────────────────────┐
    │ Community setting:   │
    │ approval_mode?       │
    └──────┬──────┬───────┘
           │      │
      "manual"  "auto"
           │      │
           ▼      ▼
    ┌──────────┐  ┌──────────┐
    │ Status:  │  │ Status:  │
    │ Pending  │  │ Active   │
    │          │  │          │
    │ Show     │  │ Show     │
    │ "pending"│  │ "welcome"│
    │ modal    │  │ modal    │
    │          │  │          │
    │ Notify   │  │ Notify   │
    │ admin    │  │ user     │
    │ via TG   │  │ via TG   │
    └──────────┘  └──────────┘
           │
           ▼
    Admin clicks "Approve" in TG
           │
           ▼
    Status → Active
    Notify user via TG: "You're in! 🎉"
```

---

## 10. Phased Delivery Plan

### Phase 1: Core Infrastructure (1-2 weeks)
- [ ] Create `Invite_Links` table in Airtable
- [ ] Add new fields to `Communities`, `Community_Members`, `Members` tables
- [ ] Implement community CRUD API endpoints
- [ ] Implement invite link generation/validation API
- [ ] Implement join flow API (with approval mode support)
- [ ] Add Telegram bot callback handlers for approve/ignore
- [ ] `/join/:code` landing page

### Phase 2: Member Experience (1 week)
- [ ] "My Communities" page with matching context selector
- [ ] Community info page for members
- [ ] Community sidebar card on Dashboard
- [ ] Invite code persistence through registration flow
- [ ] Pending/approved modals
- [ ] Leave community flow + admin notification

### Phase 3: Admin Panel (1 week)
- [ ] `/community/:slug/admin` page
- [ ] Settings management UI
- [ ] Member list with status management (approve/remove)
- [ ] Invite link management (create/disable/view usage)
- [ ] Weekly match list view

### Phase 4: Script Refactoring (1 week)
- [ ] Refactor `match-users-ai.js` with `--community` parameter
- [ ] Create `match-all.js` orchestrator
- [ ] Refactor `weekend-invitation-all.js` to exclude community-only users
- [ ] Create community invitation flow (or parameterize existing)
- [ ] Update `notify-matches.js` to include community context in messages
- [ ] Verify `midweek-checkin.js` and `weekend-feedback.js` work with community matches
- [ ] Add `No_Global_Notifications` filter to all global notification scripts

### Phase 5: Deletion & Edge Cases (3-5 days)
- [ ] Community deletion flow with double confirmation
- [ ] Member notification on deletion with global pool opt-in/out
- [ ] Self-reactivation UI for "don't participate" users
- [ ] Handle minimum community size (< 6 active) gracefully
- [ ] Handle invite link edge cases (expired, exhausted, already member)

---

## 11. Security & Access Control

| Action | Who Can Do It |
|--------|--------------|
| View community info | Community members only |
| View member list | Members (if setting allows) OR admin |
| View invite links | Members (if setting allows) OR admin |
| Edit community settings | Community admin only |
| Manage invite links | Community admin only |
| Approve/remove members | Community admin only |
| Delete community | Community admin (with confirmation) |
| View weekly matches | Community admin only |
| System-level community management | System admin (Max) only |

**API middleware pattern:**
```
checkCommunityMember(slug)  → verifies user is Active member
checkCommunityAdmin(slug)   → verifies user has Admin/Owner role
```

---

## 12. What This PRD Does NOT Cover (Explicit Scope Exclusions)

- ❌ Multi-admin roles (Owner vs Admin distinction) — future iteration
- ❌ Group matches (3-4 people) — future feature for all pools
- ❌ Custom notification timing per community — same cycle for all
- ❌ Community-level analytics beyond match list — future iteration
- ❌ B2B billing/payments — manual for now (€50/month)
- ❌ Community discovery/marketplace — communities are invite-only
- ❌ Migration of legacy `Primary_Community` / `Is_Global_Pool` data — deprecate in place

---

## 13. Open Items for Development

1. **Matching_Context weekly reset** — when does `Matching_Context` reset? At start of new week (alongside `Current_Week_Status` reset in `match-users-ai.js`)? Or persist until user changes it?
2. **Default Matching_Context** — when a new user joins only a community, default to that community? Or force explicit choice?
3. **Scheduler config** — community matching jobs: auto-register in scheduler.json when community is created? Or manual?
4. **Rate limiting** — invite link abuse protection (how many joins per minute?)
5. **Invite code format** — length, charset, collision avoidance strategy

---

*This PRD is a living document. Update as implementation decisions are made.*
