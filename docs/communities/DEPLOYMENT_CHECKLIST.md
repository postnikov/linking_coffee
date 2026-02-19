# Closed Communities - Deployment Checklist

**Feature**: Closed Communities (B2B Matching Pools)
**Status**: Ready for Deployment
**Target**: Production (https://linked.coffee)

---

## ✅ Pre-Deployment Checklist

### 1. Database Schema (Airtable)
- [ ] Invite_Links table created with all fields
- [ ] Communities table updated (Settings, Min_Active_For_Matching, Deleted_At)
- [ ] Community_Members table updated (Pending status, Invited_Via, Left_At)
- [ ] Members table updated (Matching_Context, No_Global_Notifications)
- [ ] Matches table Community field verified
- [ ] AIRTABLE_INVITE_LINKS_TABLE added to `.env`
- [ ] AIRTABLE_COMMUNITIES_TABLE added to `.env`
- [ ] AIRTABLE_COMMUNITY_MEMBERS_TABLE added to `.env`

### 2. Backend Code
- [ ] All Phase 0-4 files committed to main branch
- [ ] `express-rate-limit` added to package.json dependencies
- [ ] Syntax check passed: `node -c backend/server.js`
- [ ] Syntax check passed: `node -c backend/scripts/match-users-ai.js`
- [ ] Syntax check passed: `node -c backend/scripts/match-all.js`
- [ ] Syntax check passed: `node -c backend/scripts/notify-matches.js`
- [ ] Syntax check passed: `node -c backend/utils/community-middleware.js`

### 3. Frontend Code
- [ ] All Phase 3 files committed to main branch
- [ ] New routes added to App.js
- [ ] New pages created (JoinCommunityPage, MyCommunitiesPage, CommunityInfoPage)
- [ ] Dashboard community card added
- [ ] Syntax check passed (ESLint clean)

### 4. Environment Variables
- [ ] Production `.env` updated with new table IDs
- [ ] All required env vars present:
  - `AIRTABLE_API_KEY`
  - `AIRTABLE_BASE_ID`
  - `AIRTABLE_MEMBERS_TABLE`
  - `AIRTABLE_MATCHES_TABLE`
  - `AIRTABLE_COMMUNITIES_TABLE`
  - `AIRTABLE_COMMUNITY_MEMBERS_TABLE`
  - `AIRTABLE_INVITE_LINKS_TABLE`
  - `BOT_TOKEN`
  - `ADMIN_CHAT_ID`
  - `GOOGLE_AI_API_KEY`

### 5. Testing Completed
- [ ] Unit tests passed (5/5)
- [ ] Integration test passed (end-to-end flow)
- [ ] UI tests passed (4/4 pages)
- [ ] Regression tests passed (global matching unaffected)
- [ ] Test results documented

### 6. Documentation Updated
- [ ] CLAUDE.md updated with Communities section
- [ ] API_ENDPOINTS_PHASE2.md created
- [ ] TESTING_GUIDE.md created
- [ ] DEPLOYMENT_CHECKLIST.md created (this file)
- [ ] Phase summary docs created (Phases 0-4)

---

## 🚀 Deployment Steps

### Step 1: Backup Production Data
```bash
# SSH to production server
ssh linked.coffee

# Backup Airtable data
docker exec -it linking-coffee-backend node scripts/backup-airtable.js

# Verify backup created
ls -lh backend/backups/daily/
```

**Verify**: Backup file created with current timestamp

---

### Step 2: Deploy Backend Code

```bash
# On local machine - ensure latest code committed
git status
git add .
git commit -m "feat: closed communities feature (phases 0-4)

- Phase 0: Security foundation (SQL injection fix, rate limiting)
- Phase 1: Database schema updates
- Phase 2: Backend APIs (11 endpoints, 6 bot callbacks)
- Phase 3: Frontend pages (JoinCommunityPage, MyCommunitiesPage, CommunityInfoPage)
- Phase 4: Script refactoring (match-all.js orchestrator)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main

# Deploy to production using enhanced deployment script
./deploy-prod-enhanced.sh
```

**Verify**:
- ✅ Deployment succeeds
- ✅ Smoke tests pass
- ✅ Site remains accessible at https://linked.coffee
- ✅ No rollback triggered

---

### Step 3: Verify Backend Deployment

```bash
# SSH to server
ssh linked.coffee

# Check logs for errors
docker logs linking-coffee-backend --tail 100

# Verify new files present
docker exec -it linking-coffee-backend ls -l scripts/match-all.js
docker exec -it linking-coffee-backend ls -l utils/community-middleware.js

# Test health endpoint
curl https://linked.coffee/api/health
```

**Expected**: No errors in logs, files present, health check passes

---

### Step 4: Verify Frontend Deployment

```bash
# Check frontend is accessible
curl -I https://linked.coffee/

# Test new routes (should return 200, not 404)
curl -I https://linked.coffee/my/communities
curl -I https://linked.coffee/join/test123
```

**Expected**: All routes accessible (200 status)

---

### Step 5: Create Test Community

**Via Airtable Web UI**:
1. Navigate to Communities table
2. Add record:
   - Name: "Internal Test Community"
   - Slug: "internal-test"
   - Status: "Active"
   - Min_Active_For_Matching: 2
   - Settings: `{"approval_mode": "auto", "member_list_visible_to": "all_members", "invite_links_visible_to": "all_members", "odd_user_handling": "skip"}`

---

### Step 6: Test Invite Generation (API)

```bash
# Generate test invite link (requires admin auth)
curl -X POST https://linked.coffee/api/community/internal-test/invite-links \
  -H "Content-Type: application/json" \
  -H "x-user: YOUR_ADMIN_USERNAME" \
  -d '{
    "label": "Production Test",
    "maxUses": 5,
    "expiresAt": null
  }'
```

**Expected**: Returns JSON with invite code

**Verify in Airtable**:
- ✅ Invite_Links record created
- ✅ Code is 8-char hex
- ✅ Status = Active

---

### Step 7: Test Join Flow (Frontend)

1. Navigate to: `https://linked.coffee/join/{CODE_FROM_STEP6}`
2. Verify invite page loads correctly
3. Join community (login if needed)
4. Verify success modal appears

**Verify in Airtable**:
- ✅ Community_Members record created
- ✅ Status = Active (auto-approval)
- ✅ Invited_Via linked to invite

---

### Step 8: Test Matching Context (Frontend)

1. Navigate to: `https://linked.coffee/my/communities`
2. Verify test community appears
3. Select community radio button
4. Verify "ACTIVE" badge appears

**Verify in Airtable**:
- ✅ Members.Matching_Context = "community:internal-test"

---

### Step 9: Test Matching Scripts (Dry Run)

```bash
# SSH to server
ssh linked.coffee

# Test match-all orchestrator (dry run - no actual matches)
docker exec -it linking-coffee-backend node scripts/match-all.js --dry-run

# Review output
# Verify no errors
# Verify community detected
# Verify global pool detected
```

**Expected**:
- ✅ Script completes successfully
- ✅ Community processed
- ✅ Global pool processed
- ✅ Summary report displayed

---

### Step 10: Enable Scheduler Jobs

**Via Admin Dashboard** (https://linked.coffee/admin):
1. Navigate to Scheduler section
2. Find "Weekly Matching (All Pools)"
3. Click Enable
4. Find "Notify Matches"
5. Click Enable

**Verify**:
- ✅ Jobs enabled in scheduler.json
- ✅ Cron schedules correct (Monday 8am, 9am)

---

### Step 11: Monitor First Production Run

**Before first Monday**:
- [ ] Verify at least 2 users in test community have Next_Week_Status = Active
- [ ] Verify Matching_Context set correctly
- [ ] Set up monitoring for Monday morning

**Monday 8:00 AM** (Matching):
```bash
# Watch logs in real-time
ssh linked.coffee
docker logs linking-coffee-backend -f | grep -i "match"
```

**Verify**:
- ✅ match-all.js starts
- ✅ Community matching runs
- ✅ Global matching runs
- ✅ No errors

**Monday 9:00 AM** (Notifications):
```bash
# Watch notification logs
docker logs linking-coffee-backend -f | grep -i "notify"
```

**Verify**:
- ✅ notify-matches.js starts
- ✅ Notifications sent
- ✅ Community name included in messages
- ✅ No errors

---

### Step 12: Verify End-to-End Flow

**Check Airtable**:
- [ ] Matches table has new records
- [ ] Community field populated for community matches
- [ ] Notifications = 'Sent'
- [ ] Members.Current_Week_Status = 'Matched'

**Check Telegram**:
- [ ] Community members received notifications
- [ ] Message includes "☕ Community: {Name}"
- [ ] Profile links work
- [ ] No errors reported

---

## 🔄 Rollback Plan

### If Critical Issues Found

**Immediate Rollback**:
```bash
# SSH to server
ssh linked.coffee

# Check for :previous image tag
docker images | grep linking-coffee

# Rollback to previous version
docker compose -f docker-compose.prod.yml down
docker tag linking-coffee-backend:previous linking-coffee-backend:latest
docker tag linking-coffee-frontend:previous linking-coffee-frontend:latest
docker compose -f docker-compose.prod.yml up -d

# Verify rollback
curl https://linked.coffee/api/health
```

**Disable Scheduler Jobs**:
```bash
# Via Admin Dashboard
# Disable "Weekly Matching (All Pools)"
# Disable "Notify Matches"
```

**Revert Database Changes** (if needed):
- Communities features won't affect existing global users
- Disable new API endpoints via nginx if needed
- No data loss risk (all additive changes)

---

## 🐛 Troubleshooting

### Issue: Invite link generation fails
**Check**:
- Admin middleware working: `checkCommunityAdmin` loaded?
- Rate limiting configured: `adminLimiter` defined?
- Table ID correct: `AIRTABLE_INVITE_LINKS_TABLE` in .env?

**Solution**: Check logs, verify middleware, restart backend

---

### Issue: Join flow fails with 403
**Check**:
- User authenticated?
- Invite link valid (not expired/disabled)?
- Community exists?

**Solution**: Check Airtable data, verify API payload

---

### Issue: Matching script fails
**Check**:
- Community table IDs correct in .env?
- Google AI API key valid?
- Bot token valid?

**Solution**: Check env vars, test with --dry-run first, check logs

---

### Issue: Notifications missing community name
**Check**:
- Matches.Community field populated?
- AIRTABLE_COMMUNITIES_TABLE in .env?
- Bot has permission to send messages?

**Solution**: Verify match records, check env vars, test bot

---

### Issue: Frontend pages don't load
**Check**:
- Routes added to App.js?
- Components imported correctly?
- Build succeeded without errors?

**Solution**: Check browser console, rebuild frontend, verify routes

---

## 📊 Post-Deployment Monitoring

### Week 1 Monitoring Checklist
- [ ] Monitor error logs daily
- [ ] Check scheduler job success rates
- [ ] Verify match notifications sent successfully
- [ ] Track community join rates
- [ ] Monitor API endpoint response times
- [ ] Check for any security issues

### Metrics to Track
| Metric | Target | Actual |
|--------|--------|--------|
| API uptime | >99% | ___ |
| Match success rate | >95% | ___ |
| Notification delivery | >98% | ___ |
| Community joins | N/A | ___ |
| Errors per day | <5 | ___ |

### Admin Notifications
Ensure you receive Telegram alerts for:
- ✅ Weekly matching summary (Monday 8am)
- ✅ Notification delivery status (Monday 9am)
- ✅ Communities with insufficient opt-ins
- ✅ Any script failures

---

## ✅ Deployment Sign-Off

**Pre-Deployment** (Complete before proceeding):
- [ ] All checklist items above completed
- [ ] Testing passed (all tests green)
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Backup taken
- [ ] Rollback plan understood

**Post-Deployment** (Complete within 24 hours):
- [ ] Test community created
- [ ] Invite generation tested
- [ ] Join flow tested
- [ ] Matching scripts tested (dry-run)
- [ ] Scheduler jobs enabled
- [ ] Monitoring set up

**First Week** (Complete within 7 days):
- [ ] First matching cycle successful
- [ ] Notifications delivered correctly
- [ ] No critical bugs reported
- [ ] User feedback collected
- [ ] Metrics tracked
- [ ] Ready for production use

---

## 📝 Deployment Log Template

```markdown
## Deployment: Closed Communities Feature

**Date**: YYYY-MM-DD
**Time**: HH:MM UTC
**Deployed By**: [Name]
**Version**: [Git commit hash]

### Pre-Deployment
- [ ] Backup taken: [timestamp]
- [ ] Tests passed: YES/NO
- [ ] Code review: APPROVED

### Deployment
- [ ] Backend deployed: [timestamp]
- [ ] Frontend deployed: [timestamp]
- [ ] Smoke tests: PASS/FAIL
- [ ] Rollback needed: YES/NO

### Post-Deployment Verification
- [ ] Test community created: YES
- [ ] Invite generation: WORKING
- [ ] Join flow: WORKING
- [ ] Matching scripts: WORKING
- [ ] Scheduler jobs: ENABLED

### Issues Encountered
1. [Issue description and resolution]
2. [Issue description and resolution]

### Sign-Off
- [ ] Deployment successful
- [ ] Monitoring active
- [ ] Team notified

**Deployed By**: [Name]
**Date**: [Date]
```

---

## 🎯 Success Criteria

Deployment is considered successful when:
- ✅ All deployment steps completed without errors
- ✅ Test community joins work end-to-end
- ✅ First matching cycle runs successfully (after first Monday)
- ✅ Notifications delivered with community context
- ✅ No critical bugs reported in first week
- ✅ Global matching continues to work (no regression)
- ✅ Admin can monitor system health via dashboard

---

**Deployment Checklist Version**: 1.0
**Last Updated**: 2026-02-10
**Next Review**: After first production cycle
