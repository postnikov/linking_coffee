# Communities — Agent Quick Reference

> Load this before working on anything community-related.

## How It Works (30 seconds)

Companies get **private matching pools**. Admin creates community → generates invite link → members join → choose "match me in this community" → Monday script matches them separately from the global pool.

```
Admin creates invite  →  User joins via /join/:code  →  User picks matching pool
     ↓                         ↓                              ↓
Invite_Links table      Community_Members table      Members.Matching_Context
                                                     "global" | "community:{slug}"
```

Matching runs Monday via `match-all.js`: loops communities first, then global pool.

## Database (4 tables)

| Table | ID | Key Fields |
|-------|----|------------|
| Communities | `tblSMXQlCTpl7BZED` | Name, Slug, Settings (JSON), Status, Min_Active_For_Matching, Deleted_At |
| Community_Members | `tblPN0ni3zaaTCPcF` | Member (link), Community (link), Status (Active/Pending/Removed), Role (Owner/Admin/Member) |
| Invite_Links | `tblcTt0qyNr8HfzKS` | Code (8-char hex), Community (link), Status, Max_Uses, Used_Count, Expires_At |
| Members (existing) | `tblCrnbDupkzWUx9P` | +Matching_Context, +No_Global_Notifications |

Matches table gets a `Community` link field for community-specific matches.

## Code Map

### Backend

| File | Lines | What it does |
|------|-------|--------------|
| `routes/community.js` | ~1170 | All `/api/community/*`, `/api/invite/*`, `/api/my/*` endpoints |
| `utils/community-middleware.js` | ~250 | `checkCommunityMember`, `checkCommunityAdmin` — attaches `req.community`, `req.membership` |
| `bot/callbacks.js` (lines 289-450) | ~160 | `community_approve`, `community_ignore`, `community_participate_yes/no`, `community_deleted_*` |
| `scripts/match-all.js` | ~250 | Orchestrator: loops communities, spawns `match-users-ai.js --community={slug}` |
| `scripts/match-users-ai.js` | ~730 | Accepts `--community={slug}` flag; filters members by `Matching_Context` |

### Frontend

| File | Route | Purpose |
|------|-------|---------|
| `pages/JoinCommunityPage.js` | `/join/:code` | Invite landing, join flow |
| `pages/MyCommunitiesPage.js` | `/my/communities` | Matching context switcher |
| `pages/CommunityInfoPage.js` | `/community/:slug` | Community hub: members, invites, settings |

## API Endpoints (Cheat Sheet)

```
# Public
GET  /api/invite/:code/info          — Validate invite

# Authenticated
POST /api/community/join/:code       — Join via invite
GET  /api/my/communities             — User's communities
PUT  /api/my/matching-context        — Switch matching pool

# Member-only (checkCommunityMember)
GET  /api/community/:slug            — Community info
GET  /api/community/:slug/members    — Member list
POST /api/community/:slug/leave      — Leave

# Admin-only (checkCommunityAdmin)
POST   /api/community/:slug/invite-links              — Create invite
GET    /api/community/:slug/invite-links               — List invites
PATCH  /api/community/:slug/invite-links/:linkId       — Toggle status
DELETE /api/community/:slug/invite-links/:linkId       — Delete
GET    /api/community/:slug/pending-members            — Pending list
POST   /api/community/:slug/members/:id/approve        — Approve
POST   /api/community/:slug/members/:id/reject         — Reject
POST   /api/community/:slug/members/:id/remove         — Remove member
PUT    /api/community/:slug                            — Update settings
```

## Gotchas

1. **Lookup fields return arrays** — `{Name (from Community)}` is `["Foo"]`, not `"Foo"`. Use `FIND('x', ARRAYJOIN({field}, '||'))` instead of `{field} = 'x'`
2. **Bot notifications** — routes use `getBotInstance()` from `alerting.js`, never `bot.launch()`
3. **Invite codes** — 8-char hex uppercase, validated with `/^[A-F0-9]{8}$/i`
4. **Matching context format** — exactly `"global"` or `"community:{slug}"` (no spaces)
5. **Settings field** — JSON string in Airtable: `{ approval_mode, member_visibility, invite_link_visibility }`
6. **Sanitization** — always `sanitizeForAirtable()` and `sanitizeUsername()` before any query
