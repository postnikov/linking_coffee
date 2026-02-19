# Closed Communities - Testing Guide

**Purpose**: Validate end-to-end workflow for Closed Communities feature
**Status**: Ready for Testing
**Date**: 2026-02-10

---

## 🎯 Testing Strategy

### Test Levels
1. **Unit Tests**: Individual script functionality
2. **Integration Tests**: Full workflow from invite to match
3. **Regression Tests**: Verify existing global matching still works
4. **UI Tests**: Frontend pages and user flows

---

## ✅ Pre-Test Setup

### 1. Environment Variables
Verify all required env vars are set in `.env`:

```bash
# Core
AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
AIRTABLE_MEMBERS_TABLE=...
AIRTABLE_MATCHES_TABLE=...
AIRTABLE_COMMUNITIES_TABLE=...
AIRTABLE_COMMUNITY_MEMBERS_TABLE=...
AIRTABLE_INVITE_LINKS_TABLE=...

# AI & Bot
GOOGLE_AI_API_KEY=...
BOT_TOKEN=...
ADMIN_CHAT_ID=...
```

### 2. Test Data Setup (Airtable)

#### Create Test Community
1. Navigate to Communities table in Airtable
2. Add record:
   - `Name`: "Test Community"
   - `Slug`: "test-community"
   - `Status`: "Active"
   - `Min_Active_For_Matching`: 2 (low threshold for testing)
   - `Settings`: `{"approval_mode": "auto", "member_list_visible_to": "all_members", "invite_links_visible_to": "all_members", "odd_user_handling": "skip"}`

#### Create Test Users
1. Navigate to Members table
2. Ensure you have at least 3 test users with:
   - `Consent_GDPR`: ✓
   - `Tg_ID`: Valid Telegram ID
   - `Tg_Username`: Valid username
   - All required profile fields filled

---

## 🧪 Unit Tests

### Test 1: Global Matching (Regression Test)

**Purpose**: Verify global matching still works as before

**Steps**:
1. Ensure test users have `Matching_Context = 'global'` or empty
2. Set `Next_Week_Status = 'Active'` for 2+ test users

```bash
cd backend
node scripts/match-users-ai.js --dry-run
```

**Expected Output**:
```
🌍 Global Mode: Fetching members with Next_Week_Status = 'Active'...
✅ Found X active members in global pool.
[Matching process continues...]
```

**Verify**:
- ✅ Script completes without errors
- ✅ Users fetched correctly
- ✅ Match history filtered (Community = empty)
- ✅ Pairs proposed

**Pass Criteria**: Script runs successfully, no errors

---

### Test 2: Community Matching

**Purpose**: Verify community-specific matching works

**Setup**:
1. Set 2-3 test users:
   - `Matching_Context = 'community:test-community'`
   - `Next_Week_Status = 'Active'`

```bash
cd backend
node scripts/match-users-ai.js --community=test-community --dry-run
```

**Expected Output**:
```
🏘️  Community Mode: Fetching members for community 'test-community'...
   Community: Test Community
   Min Active for Matching: 2
✅ Found 3 active members in community.
[Matching process continues...]
```

**Verify**:
- ✅ Community record fetched
- ✅ Only community members fetched
- ✅ Min threshold respected
- ✅ Match history filtered by Community field
- ✅ Pairs proposed

**Pass Criteria**: Script runs successfully, correct users fetched

---

### Test 3: Insufficient Community Opt-Ins

**Purpose**: Verify minimum threshold enforcement

**Setup**:
1. Set only 1 test user:
   - `Matching_Context = 'community:test-community'`
   - `Next_Week_Status = 'Active'`

```bash
cd backend
node scripts/match-users-ai.js --community=test-community --dry-run
```

**Expected Output**:
```
🏘️  Community Mode: Fetching members for community 'test-community'...
   Community: Test Community
   Min Active for Matching: 2
✅ Found 1 active members in community.
⚠️  Not enough members to match (1 < 2).
💡 Community needs at least 2 opt-ins for matching.
```

**Verify**:
- ✅ Script exits gracefully
- ✅ Warning message displayed
- ✅ No matches created

**Pass Criteria**: Script exits with warning, no crashes

---

### Test 4: Match-All Orchestrator

**Purpose**: Verify orchestrator runs all pools correctly

**Setup**:
1. Ensure Test Community has 2+ opt-ins
2. Ensure global pool has 2+ opt-ins

```bash
cd backend
node scripts/match-all.js --dry-run
```

**Expected Output**:
```
🚀 Match-All Orchestrator Starting...
   Mode: DRY RUN

📋 Step 1: Fetching active communities...
   Found 1 active communities.

🏘️  Step 2: Processing community matching...
   Community: Test Community (test-community)
   Min Active for Matching: 2
   Opt-ins: 3
   ✅ Community matching completed.

🌍 Step 3: Processing global matching...
   ✅ Global matching completed.

═══════════════════════════════════════
✅ Match-All Orchestrator Complete
═══════════════════════════════════════
   Communities Processed: 1
   Communities Matched: 1
   Communities Skipped: 0
   Global Matched: Yes
   Errors: 0
   Duration: Xs
═══════════════════════════════════════
```

**Verify**:
- ✅ All active communities processed
- ✅ Community matching runs first
- ✅ Global matching runs last
- ✅ Summary report accurate

**Pass Criteria**: Orchestrator completes both pools, no errors

---

### Test 5: Notification with Community Context

**Purpose**: Verify notifications include community name

**Setup**:
1. Manually create a test match in Matches table:
   - `Member1`: Test user 1
   - `Member2`: Test user 2
   - `Community`: [Link to Test Community]
   - `Notifications`: "Pending"
   - `Intro_1`, `Intro_2`: Any text
   - `View_Token_1`, `View_Token_2`: Generate tokens

```bash
cd backend
node scripts/notify-matches.js --dry-run --max-notifications=1
```

**Expected Output**:
```
📬 Notification Script Starting...
🔍 Fetching matches with Notifications = 'Pending'...
✅ Found 1 pending matches.

📧 Notifying @user1...
   Community: Test Community
[DRY RUN] Would send message:
☕ Community: *Test Community*

🎉 You've got a Linked Coffee partner for this week!
...
```

**Verify**:
- ✅ Community name fetched
- ✅ Message includes "☕ Community: *Test Community*"
- ✅ Notification would be sent (dry run)

**Pass Criteria**: Message contains community prefix

---

## 🔗 Integration Tests

### Test 6: End-to-End Community Flow

**Purpose**: Complete workflow from invite to match notification

**Steps**:

#### 6.1 Generate Invite Link (API)
```bash
curl -X POST http://localhost:3001/api/community/test-community/invite-links \
  -H "Content-Type: application/json" \
  -H "x-user: your_admin_username" \
  -d '{
    "label": "Test Invite",
    "maxUses": 10,
    "expiresAt": null
  }'
```

**Expected**: Returns invite code (e.g., "A1B2C3D4")

---

#### 6.2 Join Community (Frontend)
1. Start local server: `./start_local.sh`
2. Navigate to: `http://localhost:3000/join/A1B2C3D4`
3. Verify invite info displays correctly
4. Click "Join Community" (login if needed)

**Expected**:
- ✅ Invite page loads
- ✅ Community name and description shown
- ✅ Join succeeds (success modal)
- ✅ Community_Members record created in Airtable

---

#### 6.3 Set Matching Context (Frontend)
1. Navigate to: `http://localhost:3000/my/communities`
2. Verify community appears in list
3. Select community radio button
4. Verify "ACTIVE" badge appears

**Expected**:
- ✅ Community listed
- ✅ Context switches to "community:test-community"
- ✅ Members table updated in Airtable (`Matching_Context` field)

---

#### 6.4 Run Weekly Matching (Backend)
```bash
# Set Next_Week_Status = 'Active' for test users in Airtable

# Run matching (production mode, creates real matches)
cd backend
node scripts/match-all.js

# Verify matches created
# Check Airtable Matches table for new records
```

**Expected**:
- ✅ Community matches created
- ✅ `Community` field populated with community ID
- ✅ `Notifications = 'Pending'`
- ✅ Global matches also created (if applicable)

---

#### 6.5 Send Notifications (Backend)
```bash
cd backend
node scripts/notify-matches.js
```

**Expected**:
- ✅ Telegram messages sent
- ✅ Messages include community name prefix
- ✅ `Notifications = 'Sent'` in Airtable

---

#### 6.6 View Community Info (Frontend)
1. Navigate to: `http://localhost:3000/community/test-community`
2. Verify community details display
3. Verify member list shows (if allowed)

**Expected**:
- ✅ Community info loads
- ✅ Members displayed
- ✅ Settings shown
- ✅ Leave button works (if non-owner)

---

**Overall Integration Test Pass Criteria**:
- ✅ All steps complete without errors
- ✅ Data flows correctly through all systems
- ✅ Notifications received via Telegram
- ✅ UI displays correct information

---

## 🎨 UI/UX Tests

### Test 7: JoinCommunityPage
- [ ] Public invite link loads without auth
- [ ] Invalid code shows error
- [ ] Expired invite shows error
- [ ] Login redirect works for unauthenticated users
- [ ] Join succeeds with auto-approval
- [ ] Join shows pending status with manual approval
- [ ] Success modal displays correctly

### Test 8: MyCommunitiesPage
- [ ] Page requires authentication
- [ ] Empty state shows when no communities
- [ ] Communities list displays correctly
- [ ] Radio button selection works
- [ ] Active indicator appears on selected context
- [ ] Pending communities are disabled
- [ ] "Manage Communities" link works

### Test 9: Dashboard Community Card
- [ ] Card hidden when no communities
- [ ] Card shows when communities exist
- [ ] Up to 3 communities displayed
- [ ] Active context highlighted
- [ ] "+X more" counter accurate
- [ ] "Manage Communities" button works

### Test 10: CommunityInfoPage
- [ ] Page requires authentication and membership
- [ ] Community details load correctly
- [ ] Members list visible (if allowed)
- [ ] Invite links visible (if allowed)
- [ ] Admin button shows for admins
- [ ] Leave community works (non-owners)
- [ ] Owner cannot leave (error shown)

---

## 🔄 Regression Tests

### Test 11: Existing Global Matching Unaffected

**Purpose**: Ensure no breaking changes to existing users

**Setup**:
1. Create users WITHOUT communities
2. Set `Matching_Context = 'global'` or leave empty
3. Leave `No_Global_Notifications` unchecked

```bash
cd backend
node scripts/match-users-ai.js --dry-run
```

**Verify**:
- ✅ Global matching runs as before
- ✅ No community-related errors
- ✅ Match history filtered correctly
- ✅ No Community field set in matches

**Pass Criteria**: Global matching works identically to before

---

### Test 12: Excluded Users Not Matched

**Purpose**: Verify exclusion logic works

**Setup**:
1. Set user A: `No_Global_Notifications = true`
2. Set user B: `Matching_Context = 'community:test'`

```bash
cd backend
node scripts/match-users-ai.js --dry-run
```

**Verify**:
- ✅ User A excluded from global pool
- ✅ User B excluded from global pool
- ✅ Only eligible users considered

**Pass Criteria**: Exclusion filters work correctly

---

## 📝 Test Results Template

```markdown
## Test Execution Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: [Local/Staging/Production]

### Unit Tests
- [ ] Test 1: Global Matching - PASS/FAIL
- [ ] Test 2: Community Matching - PASS/FAIL
- [ ] Test 3: Insufficient Opt-Ins - PASS/FAIL
- [ ] Test 4: Match-All Orchestrator - PASS/FAIL
- [ ] Test 5: Notifications - PASS/FAIL

### Integration Tests
- [ ] Test 6: End-to-End Flow - PASS/FAIL

### UI/UX Tests
- [ ] Test 7: JoinCommunityPage - PASS/FAIL
- [ ] Test 8: MyCommunitiesPage - PASS/FAIL
- [ ] Test 9: Dashboard Card - PASS/FAIL
- [ ] Test 10: CommunityInfoPage - PASS/FAIL

### Regression Tests
- [ ] Test 11: Global Matching - PASS/FAIL
- [ ] Test 12: Exclusions - PASS/FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Sign-Off
- [ ] All critical tests pass
- [ ] Known issues documented
- [ ] Ready for deployment: YES/NO
```

---

## 🚨 Troubleshooting

### Issue: "Community not found" error
**Solution**: Verify community slug matches exactly (case-sensitive)

### Issue: "Not enough members to match"
**Solution**: Lower `Min_Active_For_Matching` in test community or add more opt-ins

### Issue: No users fetched in community mode
**Solution**: Verify users have `Matching_Context = 'community:{slug}'` exactly

### Issue: Global users appearing in community matches
**Solution**: Check match history filtering logic, verify Community field filter

### Issue: Notifications missing community name
**Solution**: Verify Community field populated in Matches table, check AIRTABLE_COMMUNITIES_TABLE env var

### Issue: Frontend pages don't load
**Solution**: Verify routes added to App.js, check browser console for errors

---

## ✅ Test Sign-Off Criteria

**Before marking Phase 6 complete, verify**:
- [ ] All unit tests pass (Tests 1-5)
- [ ] End-to-end integration test passes (Test 6)
- [ ] All UI tests pass (Tests 7-10)
- [ ] Regression tests pass (Tests 11-12)
- [ ] No critical bugs found
- [ ] Known issues documented
- [ ] Test results report created
- [ ] Ready for deployment to staging

---

## 📊 Testing Metrics

Track these metrics during testing:

| Metric | Target | Actual |
|--------|--------|--------|
| Unit tests passed | 5/5 | ___ |
| Integration tests passed | 1/1 | ___ |
| UI tests passed | 4/4 | ___ |
| Regression tests passed | 2/2 | ___ |
| Critical bugs found | 0 | ___ |
| Test coverage | 100% | ___ |

---

## 🎯 Next Steps After Testing

1. **Document issues** in GitHub/Linear/etc.
2. **Fix critical bugs** before deployment
3. **Update CLAUDE.md** with final workflow
4. **Create deployment checklist**
5. **Deploy to staging** for user acceptance testing
6. **Deploy to production** after sign-off

---

**Testing Checklist Created**: Use this guide to systematically validate the Closed Communities feature before deployment.
