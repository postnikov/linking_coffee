# Phase 2: Community API Endpoints

**Status**: ✅ Implemented
**Server File**: [backend/server.js](../../backend/server.js)
**Middleware**: [backend/utils/community-middleware.js](../../backend/utils/community-middleware.js)

---

## Authentication

All endpoints (except public invite info) require authentication via:
- **Header**: `x-user: <username>` OR
- **Body**: `username: <username>` OR
- **req.user.Tg_Username** (if using session middleware)

---

## Invite Link Management

### 1. Generate Invite Link (Admin Only)

```http
POST /api/community/:slug/invite-links
```

**Auth**: Admin only (checkCommunityAdmin middleware)
**Rate Limit**: apiLimiter + adminLimiter

**Request Body**:
```json
{
  "label": "Newsletter Campaign",
  "maxUses": -1,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "success": true,
  "inviteLink": {
    "id": "recXXXXXXXXXXXXXX",
    "code": "A1B2C3D4",
    "label": "Newsletter Campaign",
    "status": "Active",
    "maxUses": -1,
    "usedCount": 0,
    "expiresAt": "2026-12-31T23:59:59Z",
    "url": "https://linked.coffee/join/A1B2C3D4"
  }
}
```

**Errors**:
- `400`: Invalid label, maxUses, or expiresAt
- `403`: Not an admin
- `404`: Community not found

---

### 2. Get Invite Link Info (Public)

```http
GET /api/invite/:code/info
```

**Auth**: None (public endpoint for join page)
**Rate Limit**: apiLimiter

**Response**:
```json
{
  "success": true,
  "invite": {
    "code": "A1B2C3D4",
    "label": "Newsletter Campaign",
    "community": {
      "name": "Tech Founders Berlin",
      "slug": "tech-founders-berlin",
      "description": "A community for tech entrepreneurs"
    }
  }
}
```

**Errors**:
- `400`: Invalid code format, disabled link, expired, or usage limit reached
- `404`: Invite not found

---

### 3. List Invite Links (Visibility-Controlled)

```http
GET /api/community/:slug/invite-links
```

**Auth**: Member (checkCommunityMember middleware)
**Rate Limit**: apiLimiter
**Visibility**: Controlled by `settings.invite_links_visible_to` (all_members | admins_only)

**Response**:
```json
{
  "success": true,
  "inviteLinks": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "code": "A1B2C3D4",
      "label": "Newsletter Campaign",
      "status": "Active",
      "maxUses": -1,
      "usedCount": 3,
      "expiresAt": "2026-12-31T23:59:59Z",
      "createdAt": "2026-02-10T10:30:00.000Z",
      "url": "https://linked.coffee/join/A1B2C3D4"
    }
  ]
}
```

**Errors**:
- `403`: Not a member or insufficient permissions
- `404`: Community not found

---

### 4. Disable/Enable Invite Link (Admin Only)

```http
PATCH /api/community/:slug/invite-links/:linkId
```

**Auth**: Admin only (checkCommunityAdmin middleware)
**Rate Limit**: apiLimiter + adminLimiter

**Request Body**:
```json
{
  "status": "Disabled"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invite link disabled successfully"
}
```

**Errors**:
- `400`: Invalid status
- `403`: Not an admin or link doesn't belong to community
- `404`: Link not found

---

## Community Join Flow

### 5. Join Community via Invite Code

```http
POST /api/community/join/:code
```

**Auth**: Required (username in body or header)
**Rate Limit**: apiLimiter

**Request Body**:
```json
{
  "username": "max_postnikov"
}
```

**Response (Auto-Approved)**:
```json
{
  "success": true,
  "membership": {
    "id": "recXXXXXXXXXXXXXX",
    "status": "Active",
    "community": {
      "name": "Tech Founders Berlin",
      "slug": "tech-founders-berlin"
    }
  },
  "message": "You have successfully joined the community"
}
```

**Response (Manual Approval)**:
```json
{
  "success": true,
  "membership": {
    "id": "recXXXXXXXXXXXXXX",
    "status": "Pending",
    "community": {
      "name": "Tech Founders Berlin",
      "slug": "tech-founders-berlin"
    }
  },
  "message": "Your membership request has been submitted and is pending approval"
}
```

**Side Effects**:
- Increments invite link usage counter
- Sends Telegram notification to user
- If manual approval: sends notification to community admins with approve/ignore buttons

**Errors**:
- `400`: Invalid code, disabled link, expired, usage limit reached, or already a member
- `401`: Authentication required
- `404`: Invite or user not found

---

## Community Info & Management

### 6. Get Community Info (Member-Only)

```http
GET /api/community/:slug
```

**Auth**: Member (checkCommunityMember middleware)
**Rate Limit**: apiLimiter

**Response**:
```json
{
  "success": true,
  "community": {
    "name": "Tech Founders Berlin",
    "slug": "tech-founders-berlin",
    "description": "A community for tech entrepreneurs",
    "memberCount": 42,
    "minActiveForMatching": 6,
    "settings": {
      "approval_mode": "manual",
      "member_list_visible_to": "all_members",
      "invite_links_visible_to": "all_members",
      "odd_user_handling": "skip"
    },
    "myRole": "Member"
  }
}
```

---

### 7. Get Community Members List (Visibility-Controlled)

```http
GET /api/community/:slug/members
```

**Auth**: Member (checkCommunityMember middleware)
**Rate Limit**: apiLimiter
**Visibility**: Controlled by `settings.member_list_visible_to` (all_members | admins_only)

**Response**:
```json
{
  "success": true,
  "members": [
    {
      "username": "max_postnikov",
      "name": "Max Postnikov",
      "role": "Owner",
      "joinedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "username": "anna_smith",
      "name": "Anna Smith",
      "role": "Member",
      "joinedAt": "2026-02-01T14:30:00.000Z"
    }
  ]
}
```

**Errors**:
- `403`: Not a member or insufficient permissions

---

### 8. Update Community Settings (Admin-Only)

```http
PUT /api/community/:slug
```

**Auth**: Admin only (checkCommunityAdmin middleware)
**Rate Limit**: apiLimiter + adminLimiter

**Request Body**:
```json
{
  "name": "Tech Founders Berlin 2.0",
  "description": "Updated description",
  "minActiveForMatching": 8,
  "settings": {
    "approval_mode": "auto",
    "member_list_visible_to": "admins_only",
    "invite_links_visible_to": "admins_only",
    "odd_user_handling": "notify_admin"
  }
}
```

**Valid Settings Values**:
- `approval_mode`: `"auto"` | `"manual"`
- `member_list_visible_to`: `"all_members"` | `"admins_only"`
- `invite_links_visible_to`: `"all_members"` | `"admins_only"`
- `odd_user_handling`: `"skip"` | `"notify_admin"`

**Response**:
```json
{
  "success": true,
  "message": "Community updated successfully"
}
```

**Errors**:
- `400`: Invalid field values or no fields to update
- `403`: Not an admin

---

### 9. Get User's Communities

```http
GET /api/my/communities?username=max_postnikov
```

**Auth**: Required (username in query or header)
**Rate Limit**: apiLimiter

**Response**:
```json
{
  "success": true,
  "matchingContext": "community:tech-founders-berlin",
  "communities": [
    {
      "slug": "tech-founders-berlin",
      "name": "Tech Founders Berlin",
      "role": "Owner",
      "status": "Active",
      "isCurrentMatchingContext": true
    },
    {
      "slug": "product-managers-club",
      "name": "Product Managers Club",
      "role": "Member",
      "status": "Active",
      "isCurrentMatchingContext": false
    }
  ]
}
```

---

### 10. Update User's Matching Context

```http
PUT /api/my/matching-context
```

**Auth**: Required (username in body or header)
**Rate Limit**: apiLimiter

**Request Body**:
```json
{
  "username": "max_postnikov",
  "matchingContext": "community:tech-founders-berlin"
}
```

**Valid Values**:
- `"global"` - Match in global pool
- `"community:{slug}"` - Match in specific community (must be active member)

**Response**:
```json
{
  "success": true,
  "matchingContext": "community:tech-founders-berlin",
  "message": "Matching context updated successfully"
}
```

**Errors**:
- `400`: Invalid format
- `403`: Not an active member of the community
- `404`: Community or user not found

---

### 11. Leave Community

```http
POST /api/community/:slug/leave
```

**Auth**: Member (checkCommunityMember middleware)
**Rate Limit**: apiLimiter

**Response**:
```json
{
  "success": true,
  "message": "You have successfully left the community"
}
```

**Side Effects**:
- Sets membership status to "Removed"
- Sets `Left_At` timestamp
- If user's matching context is this community, resets to "global"

**Errors**:
- `403`: Owner cannot leave (must transfer ownership or delete community)

---

## Bot Callback Handlers

These are triggered by inline button clicks in Telegram messages:

### 1. Approve Membership
**Callback Data**: `community_approve:{membershipId}`

**Action**:
- Sets Community_Members status to "Active"
- Sends approval notification to user via Telegram

---

### 2. Ignore Membership Request
**Callback Data**: `community_ignore:{membershipId}`

**Action**:
- No database changes (admin can manually handle later)
- Updates message to show "Ignored"

---

### 3. Participate in Community (Yes)
**Callback Data**: `community_participate_yes:{memberId}:{slug}`

**Action**:
- Sets `Matching_Context = "community:{slug}"`
- Sets `Next_Week_Status = "Active"`

---

### 4. Participate in Community (No)
**Callback Data**: `community_participate_no:{memberId}:{slug}`

**Action**:
- Sets `Next_Week_Status = "Passive"`

---

### 5. Join Global Pool (After Community Deletion)
**Callback Data**: `community_deleted_join_global:{memberId}`

**Action**:
- Sets `No_Global_Notifications = false`
- Sets `Matching_Context = "global"`

---

### 6. Opt Out of Global (After Community Deletion)
**Callback Data**: `community_deleted_skip:{memberId}`

**Action**:
- Sets `No_Global_Notifications = true`

---

## Security Features

All endpoints implement:
- ✅ **Input Sanitization** via `sanitizeForAirtable()`, `sanitizeUsername()`
- ✅ **Rate Limiting** (apiLimiter: 100/15min, adminLimiter: 50/5min, authLimiter: 10/15min)
- ✅ **Access Control** via `checkCommunityMember` and `checkCommunityAdmin` middleware
- ✅ **Enum Validation** for settings values
- ✅ **Date Validation** for expiry dates
- ✅ **Invite Code Format Validation** (8-char hex)

---

## Testing Endpoints

### With curl:

```bash
# Generate invite link (requires admin auth)
curl -X POST http://localhost:3001/api/community/tech-founders/invite-links \
  -H "Content-Type: application/json" \
  -H "x-user: max_postnikov" \
  -d '{"label": "Test Invite", "maxUses": 10}'

# Get invite info (public)
curl http://localhost:3001/api/invite/A1B2C3D4/info

# Join community
curl -X POST http://localhost:3001/api/community/join/A1B2C3D4 \
  -H "Content-Type: application/json" \
  -d '{"username": "anna_smith"}'

# Get my communities
curl http://localhost:3001/api/my/communities?username=max_postnikov

# Update matching context
curl -X PUT http://localhost:3001/api/my/matching-context \
  -H "Content-Type: application/json" \
  -d '{"username": "max_postnikov", "matchingContext": "global"}'
```

---

## Next Steps

**Phase 3**: Frontend implementation
- JoinCommunityPage (/join/:code)
- MyCommunitiesPage (/my/communities)
- CommunityInfoPage (/community/:slug)
- CommunityAdminPage (/community/:slug/admin)
- Dashboard sidebar community card

**Phase 4**: Script refactoring
- Parameterize match-users-ai.js with --community flag
- Create match-all.js orchestrator
- Update notification scripts
