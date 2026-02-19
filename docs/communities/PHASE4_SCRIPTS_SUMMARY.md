# Phase 4: Script Refactoring - Summary

**Status**: ✅ Core Complete
**Completion Date**: 2026-02-10

---

## ✅ Completed Changes

### 1. Parameterized match-users-ai.js
**File**: [backend/scripts/match-users-ai.js](../../backend/scripts/match-users-ai.js)

**New Flag**: `--community=slug`

**Changes Made**:
- Added `COMMUNITY_SLUG` and `IS_COMMUNITY_MATCH` flags
- Modified member fetching logic to support two modes:
  - **Global Mode** (default): Matches users with `Matching_Context = 'global'` or empty, excluding `No_Global_Notifications = true`
  - **Community Mode**: Matches users with `Matching_Context = 'community:{slug}'`
- Fetches community record and enforces `Min_Active_For_Matching` threshold
- Filters match history by community context (via `Community` field)
- Sets `Community` field when creating matches in community mode

**Usage Examples**:
```bash
# Global matching (default)
node scripts/match-users-ai.js

# Community matching
node scripts/match-users-ai.js --community=tech-founders

# Dry run for testing
node scripts/match-users-ai.js --community=tech-founders --dry-run
```

**Key Logic Changes**:

#### Member Fetching (Lines 305-359):
```javascript
if (IS_COMMUNITY_MATCH) {
    // Fetch community record and min threshold
    activeMembers = await base(MEMBERS_TABLE).select({
        filterByFormula: `AND(
            {Next_Week_Status} = 'Active',
            {Consent_GDPR},
            {Matching_Context} = 'community:${COMMUNITY_SLUG}'
        )`
    }).all();
} else {
    // Global pool with exclusions
    activeMembers = await base(MEMBERS_TABLE).select({
        filterByFormula: `AND(
            {Next_Week_Status} = 'Active',
            {Consent_GDPR},
            OR({Matching_Context} = 'global', {Matching_Context} = ''),
            NOT({No_Global_Notifications} = TRUE())
        )`
    }).all();
}
```

#### Match History Filtering (Lines 368-386):
```javascript
if (IS_COMMUNITY_MATCH) {
    matchHistoryFilter = {
        filterByFormula: `{Community} = '${communityRecord.id}'`,
        fields: ['Member1', 'Member2', 'Week_Start', 'Community']
    };
} else {
    matchHistoryFilter = {
        filterByFormula: `{Community} = ''`,
        fields: ['Member1', 'Member2', 'Week_Start']
    };
}
```

#### Match Creation (Lines 645-668):
```javascript
const fields = {
    'Week_Start': weekStartStr,
    'Member1': [p.u1.id],
    'Member2': [p.u2.id],
    'Status': 'Matched',
    'Notifications': 'Pending',
    'Intro_1': p.intro1,
    'Intro_2': p.intro2,
    'Shared_Intro': p.sharedIntro,
    'View_Token_1': generateViewToken(),
    'View_Token_2': generateViewToken()
};

// Add community field if matching within a community
if (IS_COMMUNITY_MATCH && communityRecord) {
    fields['Community'] = [communityRecord.id];
}
```

---

### 2. Created match-all.js Orchestrator
**File**: [backend/scripts/match-all.js](../../backend/scripts/match-all.js) (NEW)

**Purpose**: Runs matching for all active communities first, then global pool

**Workflow**:
1. Fetches all active communities (Status = 'Active', Deleted_At = empty)
2. For each community:
   - Counts opt-ins where `Matching_Context = 'community:{slug}'`
   - If `opt-ins >= Min_Active_For_Matching` → runs `match-users-ai.js --community={slug}`
   - If insufficient opt-ins → logs warning and notifies admin
3. Runs `match-users-ai.js` (no flag) for global pool
4. Sends summary notification to admin via Telegram

**Features**:
- ✅ Parallel child process execution
- ✅ Error handling per community (failures don't block other communities)
- ✅ Admin notifications via Telegram (optional)
- ✅ Dry-run support (passes `--dry-run` to child scripts)
- ✅ Summary report with counts and duration

**Usage**:
```bash
# Production run
node scripts/match-all.js

# Dry run (no actual matches created)
node scripts/match-all.js --dry-run

# Docker
docker exec -it linking-coffee-backend node scripts/match-all.js
```

**Output Example**:
```
🚀 Match-All Orchestrator Starting...
   Mode: PRODUCTION
   Timestamp: 2026-02-10T08:00:00.000Z

📋 Step 1: Fetching active communities...
   Found 3 active communities.

🏘️  Step 2: Processing community matching...

   Community: Tech Founders Berlin (tech-founders)
   Min Active for Matching: 6
   Opt-ins: 8
   ✅ Community matching completed.

   Community: Product Managers Club (pm-club)
   Min Active for Matching: 6
   Opt-ins: 4
   ⏭️  Skipping: Not enough opt-ins (4 < 6)

🌍 Step 3: Processing global matching...
   ✅ Global matching completed.

═══════════════════════════════════════
✅ Match-All Orchestrator Complete
═══════════════════════════════════════
   Communities Processed: 2
   Communities Matched: 1
   Communities Skipped: 1
   Global Matched: Yes
   Errors: 0
   Duration: 45s
═══════════════════════════════════════
```

---

### 3. Updated notify-matches.js
**File**: [backend/scripts/notify-matches.js](../../backend/scripts/notify-matches.js)

**Changes Made**:
- Fetches community name when `match.fields.Community` is populated
- Passes `communityName` to `notifyMember()` function
- Adds community prefix to notification messages

**Message Enhancement**:
- **Global match**: Standard message (no prefix)
- **Community match**: Adds community name prefix

**Example Notification**:
```
☕ Community: Tech Founders Berlin

🎉 You've got a Linked Coffee partner for this week!

Your partner: Anna Smith @anna_smith
Profile: https://linked.coffee/view/abc123...

[AI-generated intro text]
```

**Key Changes (Lines 246-268)**:
```javascript
// Check if this is a community match
let communityName = null;
if (match.fields.Community && match.fields.Community.length > 0) {
    try {
        const COMMUNITIES_TABLE = process.env.AIRTABLE_COMMUNITIES_TABLE;
        const community = await base(COMMUNITIES_TABLE).find(match.fields.Community[0]);
        communityName = community.fields.Name;
    } catch (err) {
        console.log(`⚠️ Could not fetch community name: ${err.message}`);
    }
}

// Notify with community context
sent1 = await notifyMember(member1, member2, match.fields.Intro_1, match.fields.View_Token_1, match.id, match.fields.Intro_Image, communityName);
sent2 = await notifyMember(member2, member1, match.fields.Intro_2, match.fields.View_Token_2, match.id, match.fields.Intro_Image, communityName);
```

**Message Prefix Logic (Lines 156-164)**:
```javascript
let message = getMessage(lang, memberName, partnerName, partnerUsername, introField, IS_TEST_MODE, memberName, viewToken, partnerLinkedin);

// Add community context if this is a community match
if (communityName) {
    const communityPrefix = lang === 'Ru'
        ? `☕ Сообщество: *${communityName}*\n\n`
        : `☕ Community: *${communityName}*\n\n`;
    message = communityPrefix + message;
}
```

---

### 4. Updated scheduler.json
**File**: [backend/scheduler.json](../../backend/scheduler.json)

**Added Jobs**:
1. **Weekly Matching (All Pools)**
   - Script: `match-all.js`
   - Schedule: `0 8 * * 1` (Monday 8am)
   - Status: Disabled by default (enable after testing)

2. **Notify Matches**
   - Script: `notify-matches.js`
   - Schedule: `0 9 * * 1` (Monday 9am)
   - Status: Disabled by default (enable after testing)

**Note**: Jobs are disabled by default. Enable via Admin Dashboard after Phase 6 testing.

---

## ⏸️ Deferred Features (Phase 4.5)

### 1. Weekend Invitation Script Updates
**File**: `backend/scripts/weekend-invitation-all.js`

**Planned Changes**:
- Add community-specific invitations (separate from global)
- Send to Active community members
- Use callback pattern: `community_participate_yes:{memberId}:{slug}`
- Include community name in invitation message

**Current State**:
- Existing script sends global invitations only
- Community members can still respond to global invitations
- Just needs enhancement to support community-specific invitations

**Workaround**:
- Community members manually set `Matching_Context` via `/my/communities` page
- Weekly invitation sets `Next_Week_Status` but doesn't set community context

---

## 📊 Implementation Statistics

**Files Modified**: 3
- match-users-ai.js (~100 lines changed)
- notify-matches.js (~30 lines changed)
- scheduler.json (2 jobs added)

**Files Created**: 1
- match-all.js (270 lines)

**Total Script Code**: ~400 lines

---

## 🧪 Testing Plan

### Unit Testing (Manual)

#### Test 1: Global Matching (Regression Test)
```bash
# Should work exactly as before
node scripts/match-users-ai.js --dry-run
```
**Expected**: Matches users with `Matching_Context = 'global'` or empty

---

#### Test 2: Community Matching
```bash
# Create test community in Airtable first
# Set 2-3 test users' Matching_Context = 'community:test-community'
# Set Next_Week_Status = 'Active' for those users

node scripts/match-users-ai.js --community=test-community --dry-run
```
**Expected**: Matches only users in that community

---

#### Test 3: Match-All Orchestrator
```bash
node scripts/match-all.js --dry-run
```
**Expected**:
- Processes all communities
- Skips communities with insufficient opt-ins
- Runs global matching
- Prints summary report

---

#### Test 4: Notification with Community Context
```bash
# Create a test match with Community field populated
# Run notification script
node scripts/notify-matches.js --dry-run --max-notifications=1
```
**Expected**: Message includes "☕ Community: [Name]" prefix

---

### Integration Testing (Phase 6)

1. **End-to-End Community Matching**:
   - Create test community
   - Generate invite link
   - Join community as test users
   - Set matching context to community
   - Run match-all.js
   - Verify matches created with Community field
   - Verify notifications include community name

2. **Global Pool Isolation**:
   - Verify users with `No_Global_Notifications = true` are excluded
   - Verify community members with `Matching_Context = community:X` are excluded from global

3. **Minimum Threshold Enforcement**:
   - Test community with < Min_Active_For_Matching opt-ins
   - Verify no matches created
   - Verify admin notification sent

---

## 🔒 Security & Data Integrity

### Database Field Updates
- ✅ `Matching_Context` field correctly set by frontend
- ✅ `Community` field populated in Matches table
- ✅ Match history filtered by community context
- ✅ No cross-pool contamination (community matches don't appear in global history)

### Error Handling
- ✅ Invalid community slug → script exits with error
- ✅ Missing Community field → defaults to global matching
- ✅ Failed community match → continues with other communities
- ✅ Failed notification → logs error, continues with remaining

---

## 📝 Weekly Matching Workflow

### Monday 8:00 AM - Matching Runs
```
match-all.js orchestrates:
  1. For each active community:
     - Check opt-ins >= Min_Active_For_Matching
     - Run match-users-ai.js --community={slug}
     - Create matches with Community field
  2. Run match-users-ai.js (global pool)
     - Exclude No_Global_Notifications = true
     - Exclude community context users
  3. Send admin summary
```

### Monday 9:00 AM - Notifications Sent
```
notify-matches.js:
  1. Fetch matches with Notifications = 'Pending'
  2. For each match:
     - Check if Community field populated
     - Fetch community name if present
     - Add community prefix to message
     - Send via Telegram bot
  3. Update Notifications = 'Sent'
```

---

## 🚀 Deployment Steps

### 1. Deploy Scripts
```bash
# Copy updated scripts to server
scp backend/scripts/match-users-ai.js server:/app/backend/scripts/
scp backend/scripts/match-all.js server:/app/backend/scripts/
scp backend/scripts/notify-matches.js server:/app/backend/scripts/
scp backend/scheduler.json server:/app/backend/
```

### 2. Test in Dry-Run Mode
```bash
# SSH to server
ssh server

# Test match-all orchestrator
docker exec -it linking-coffee-backend node scripts/match-all.js --dry-run

# Verify output looks correct
# Check for errors or warnings
```

### 3. Enable Scheduler Jobs
```bash
# Via Admin Dashboard UI
# Navigate to /admin → Scheduler
# Enable "Weekly Matching (All Pools)"
# Enable "Notify Matches"
```

### 4. Monitor First Run
```bash
# Check logs on Monday morning
docker logs linking-coffee-backend -f | grep -i "match"

# Verify community matches created
# Verify global matches created
# Verify notifications sent
```

---

## 🐛 Known Limitations

1. **Weekend Invitation Script**: Not yet updated for community-specific invitations
   - **Impact**: Community members must manually set matching context each week
   - **Workaround**: Use `/my/communities` page to set context

2. **Scheduler UI**: Jobs added but disabled by default
   - **Impact**: Manual enabling required
   - **Workaround**: Enable via Admin Dashboard after testing

3. **No Rollback Support**: If match-all.js fails mid-run
   - **Impact**: Some communities may be matched, others not
   - **Mitigation**: Each community is independent; failures don't cascade

---

## ✅ Phase 4 Complete: 4 of 5 Features Shipped (80%)

**Completed**:
- ✅ Parameterized match-users-ai.js
- ✅ Created match-all.js orchestrator
- ✅ Updated notify-matches.js
- ✅ Updated scheduler.json

**Deferred to Phase 4.5**:
- ⏸️ Weekend invitation script (non-blocking)

**Ready for**: Phase 6 (Testing & Documentation)

---

## 📖 Next Steps

**Recommended**: Skip Phase 5 (Community Deletion) and proceed to **Phase 6 (Testing & Documentation)** to validate the end-to-end workflow.

**Why**: Community deletion is a less critical feature that can be implemented after core matching is verified working.

**Phase 6 Tasks**:
1. Create test community and test users
2. Test full matching workflow (community + global)
3. Verify notifications work correctly
4. Update CLAUDE.md with workflow documentation
5. Create deployment checklist

---

**Phase 4 Status**: 🎯 80% Complete (Core features ready, weekend invitations deferred)
