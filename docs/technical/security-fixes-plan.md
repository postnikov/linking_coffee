# Security Fixes Implementation Plan

**Created:** 2026-01-24
**Status:** Planning
**Priority:** CRITICAL

## Overview

This document outlines the implementation plan for fixing critical security vulnerabilities identified in the code review. These issues pose immediate security risks and must be addressed before any new feature development.

---

## Critical Issues to Fix

### Issue #1: Airtable Formula Injection Vulnerability
**Severity:** CRITICAL
**Risk:** Data breach, unauthorized access to user data
**Affected Files:**
- `backend/server.js` (lines 257, 313, 501, 612, and many more)
- `backend/scripts/match-users.js`
- `backend/scripts/notify-matches.js`
- All other scripts using Airtable queries

**Current Vulnerable Pattern:**
```javascript
filterByFormula: `{Tg_Username} = '${cleanUsername}'`
filterByFormula: `{Tg_ID} = '${telegramId}'`
filterByFormula: `{Email} = '${email}'`
```

**Implementation Plan:**

**Step 1:** Create sanitization utility
- File: `backend/utils/airtable-sanitizer.js`
- Function: `sanitizeForAirtable(value)`
- Escapes single quotes and other special characters
- Returns sanitized string safe for formula interpolation

**Step 2:** Update all Airtable queries
- Search codebase for all `filterByFormula` usages
- Wrap ALL user-supplied variables with sanitization
- Focus on these endpoints first:
  - `/api/register` (username)
  - `/api/verify` (username, Telegram ID)
  - `/api/profile` (username, email, ID)
  - `/api/login` (username, email)

**Step 3:** Add input validation layer
- Validate format before sanitization
- Reject obviously malicious input
- Add regex validation for usernames, emails, IDs

**Testing:**
- Test with malicious inputs: `' OR 1=1 OR '`, `'; DROP TABLE--`, etc.
- Verify queries return expected results
- Ensure no data leakage

**Estimated Effort:** 4-6 hours
**Files to Modify:** ~15 files

---

### Issue #2: Missing Authentication on Admin Endpoints
**Severity:** CRITICAL
**Risk:** Unauthorized admin actions, DoS, data manipulation
**Affected Files:**
- `backend/server.js` (lines 2943-2996, 2999-3019)

**Vulnerable Endpoints:**
- `GET /api/admin/run-matching` - No authentication
- `POST /api/admin/regenerate-image` - No authentication

**Implementation Plan:**

**Step 1:** Audit all admin endpoints
- List all `/api/admin/*` endpoints
- Identify which ones have `checkAdmin` middleware
- Document those missing authentication

**Step 2:** Apply `checkAdmin` middleware
- Add to vulnerable endpoints:
  ```javascript
  app.get('/api/admin/run-matching', checkAdmin, async (req, res) => {
  app.post('/api/admin/regenerate-image', checkAdmin, async (req, res) => {
  ```

**Step 3:** Strengthen `checkAdmin` logic
- Current implementation (lines 1890-1915) is weak
- Consider requiring both username AND Telegram ID verification
- Add admin role verification from Airtable Members table
- Optional: Add admin session tokens

**Step 4:** Add audit logging
- Log all admin actions to separate audit log
- Include: timestamp, admin user, action, IP address, result

**Testing:**
- Test unauthorized access returns 401/403
- Test valid admin can still access
- Verify audit logs are created

**Estimated Effort:** 2-3 hours
**Files to Modify:** `backend/server.js`

---

### Issue #3: OTP Replay Attack Vulnerability
**Severity:** HIGH
**Risk:** Account takeover, authentication bypass
**Affected Files:**
- `backend/server.js` (lines 640-750)

**Current Issue:**
- OTP stored in `otpStore` Map
- Valid for 10 minutes
- NOT deleted after successful verification
- Can be reused multiple times

**Implementation Plan:**

**Step 1:** Delete OTP immediately after use
```javascript
// In /api/verify endpoint (around line 642)
if (storedOtp && storedOtp.code === otp && storedOtp.expiresAt > Date.now()) {
  // Delete FIRST to prevent race conditions
  otpStore.delete(cleanUsername);

  // Then proceed with verification
  // ... existing verification logic
}
```

**Step 2:** Add "used" flag as alternative
- If deletion causes issues, add `used: true` flag
- Check for flag before accepting OTP
- Cleanup expired OTPs with scheduled task

**Step 3:** Add failed attempt tracking
- Track failed OTP attempts per username
- Lock account after 5 failed attempts
- Reset counter on successful verification

**Testing:**
- Verify OTP works once
- Verify same OTP fails on second attempt
- Test expired OTP rejection
- Test account lockout after 5 failures

**Estimated Effort:** 1-2 hours
**Files to Modify:** `backend/server.js`

---

### Issue #4: Insecure Direct Object Reference (IDOR)
**Severity:** HIGH
**Risk:** Unauthorized profile modification, data tampering
**Affected Files:**
- `backend/server.js` (lines 2755-2849)

**Current Issue:**
```javascript
app.put('/api/profile', async (req, res) => {
  const { username, id, email, profile } = req.body;
  // No verification that requester owns this profile!
```

**Implementation Plan:**

**Step 1:** Implement session-based authentication
- Add proper session management (express-session or JWT)
- Store authenticated user ID in session
- Require session for all authenticated endpoints

**Step 2:** Add ownership verification
```javascript
app.put('/api/profile', requireAuth, async (req, res) => {
  const { username, id, email, profile } = req.body;
  const authenticatedUser = req.session.user; // or req.user from JWT

  // Verify ownership
  if (authenticatedUser.username !== username &&
      authenticatedUser.id !== id &&
      authenticatedUser.email !== email) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized: Cannot modify another user\'s profile'
    });
  }

  // ... proceed with update
});
```

**Step 3:** Refactor authentication flow
- Create `requireAuth` middleware
- Extract user from session/JWT token
- Attach to `req.user`
- Remove username/id/email from request body (get from session instead)

**Step 4:** Update all protected endpoints
- `/api/profile` (GET and PUT)
- `/api/upload-avatar`
- Any other user-specific endpoints

**Testing:**
- Test user can update own profile
- Test user CANNOT update other user's profile
- Test unauthenticated access is rejected
- Test session expiration handling

**Estimated Effort:** 6-8 hours (requires auth refactor)
**Files to Modify:** `backend/server.js`, potentially frontend auth flow

---

### Issue #5: Missing Rate Limiting on Authentication Endpoints
**Severity:** HIGH
**Risk:** Brute-force attacks, OTP guessing, DoS
**Affected Files:**
- `backend/server.js`

**Vulnerable Endpoints:**
- `POST /api/register` - OTP flood
- `POST /api/verify` - Brute-force 6-digit OTP
- `POST /api/login` - Credential stuffing

**Implementation Plan:**

**Step 1:** Install rate limiting package
```bash
cd backend
npm install express-rate-limit
```

**Step 2:** Create rate limiters
```javascript
const rateLimit = require('express-rate-limit');

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate limiter for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 OTP requests per hour
  message: 'Too many registration attempts, please try again later'
});
```

**Step 3:** Apply to endpoints
```javascript
app.post('/api/register', registerLimiter, async (req, res) => {
app.post('/api/verify', authLimiter, async (req, res) => {
app.post('/api/login', authLimiter, async (req, res) => {
```

**Step 4:** Add IP-based tracking
- Consider using `express-slow-down` for progressive delays
- Track by IP + username for more granular control
- Store in Redis for distributed rate limiting (future)

**Step 5:** Add CAPTCHA for repeated failures (optional)
- After 3 failed attempts, require CAPTCHA
- Use Google reCAPTCHA or hCaptcha
- Implement on frontend and verify on backend

**Testing:**
- Test rate limit triggers after N attempts
- Test limit resets after time window
- Test error messages are user-friendly
- Test legitimate users aren't blocked unnecessarily

**Estimated Effort:** 2-3 hours
**Files to Modify:** `backend/server.js`, `package.json`

---

## Implementation Timeline

### Week 1: Critical Fixes
**Days 1-2:**
- ✅ Issue #3: OTP Replay Fix (1-2 hours)
- ✅ Issue #5: Rate Limiting (2-3 hours)
- ✅ Issue #2: Admin Auth (2-3 hours)

**Days 3-5:**
- ✅ Issue #1: Airtable Injection (4-6 hours)
  - Day 3: Create sanitizer utility, test thoroughly
  - Day 4: Update server.js queries
  - Day 5: Update all scripts, comprehensive testing

### Week 2: Complex Refactor
**Days 1-5:**
- ✅ Issue #4: IDOR Fix (6-8 hours)
  - Requires authentication system refactor
  - More complex, affects multiple components
  - Needs careful testing

### Testing & Validation
**End of Week 2:**
- Comprehensive security testing
- Penetration testing with common attack vectors
- Code review of all changes
- Deploy to staging environment first

---

## Testing Checklist

### Pre-Deployment Tests
- [ ] Airtable injection tests with malicious inputs
- [ ] Admin endpoint access without authentication
- [ ] OTP reuse attempts
- [ ] Profile update with different user credentials
- [ ] Rate limit trigger and reset
- [ ] Normal user flows still work
- [ ] Frontend authentication still works
- [ ] All API endpoints respond correctly

### Attack Simulation Tests
- [ ] SQL injection attempt: `' OR 1=1--`
- [ ] Airtable injection: `' OR {Status}='Admin' OR '`
- [ ] Brute-force OTP (should be rate-limited)
- [ ] Access admin endpoints without auth
- [ ] Modify another user's profile
- [ ] Replay captured OTP code

### Regression Tests
- [ ] User registration flow
- [ ] OTP verification
- [ ] Profile updates
- [ ] Avatar uploads
- [ ] Match generation
- [ ] Telegram notifications
- [ ] Admin dashboard access

---

## Rollback Plan

If critical issues are discovered in production:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   ./deploy-prod.sh
   ```

2. **Partial Rollback:**
   - Disable problematic endpoints via feature flag
   - Route traffic to old implementation
   - Fix issue in staging

3. **Database Rollback:**
   - Use Airtable backup from `npm run backup`
   - Restore from `backups/daily/` directory

---

## Dependencies & Prerequisites

### Required Packages
```json
{
  "express-rate-limit": "^7.1.5",
  "express-session": "^1.17.3",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1"
}
```

### Environment Variables (add to .env)
```
SESSION_SECRET=<generate-strong-random-string>
JWT_SECRET=<generate-strong-random-string>
RATE_LIMIT_ENABLED=true
```

### Documentation Updates
- Update CLAUDE.md with new auth flow
- Document new security measures
- Update API documentation
- Add security best practices guide

---

## Success Criteria

✅ All 5 critical vulnerabilities fixed
✅ No new vulnerabilities introduced
✅ All tests passing
✅ Code review approved
✅ Security audit passed
✅ Deployed to production without incidents
✅ Monitoring shows no authentication failures
✅ User experience unchanged (no breaking changes)

---

## Post-Implementation

### Monitoring
- Monitor rate limit hits in logs
- Track failed authentication attempts
- Alert on suspicious patterns
- Review admin action audit logs weekly

### Future Improvements
- Implement 2FA for admin accounts
- Add security headers (Helmet.js)
- Implement proper RBAC system
- Add comprehensive input validation
- Security training for team
- Regular security audits (quarterly)

---

## Notes & Considerations

1. **Backward Compatibility:**
   - Auth refactor may require frontend changes
   - Plan coordinated deployment of backend + frontend
   - Consider versioning API endpoints

2. **Performance Impact:**
   - Rate limiting adds minimal overhead
   - Sanitization has negligible performance cost
   - Session management requires storage (consider Redis for scale)

3. **User Experience:**
   - Rate limits may frustrate legitimate users with typos
   - Provide clear error messages
   - Allow admin override for locked accounts

4. **Testing Environment:**
   - Test on staging environment first
   - Use separate Airtable base for testing
   - Don't test attacks on production

---

## Team Responsibilities

**Backend Developer:**
- Implement all fixes in server.js
- Create sanitizer utility
- Update scripts
- Write unit tests

**Frontend Developer:**
- Update auth flow if needed
- Handle new error responses
- Update rate limit messaging

**DevOps:**
- Review deployment plan
- Prepare rollback procedures
- Monitor production after deployment

**QA/Security:**
- Execute test checklist
- Perform penetration testing
- Validate fixes

---

## References

- Code Review Report: Generated 2026-01-24
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Airtable API Security: https://airtable.com/developers/web/api/introduction
- Express Rate Limit: https://github.com/express-rate-limit/express-rate-limit
- CLAUDE.md: Project documentation

---

**Last Updated:** 2026-01-24
**Next Review:** After implementation completion
