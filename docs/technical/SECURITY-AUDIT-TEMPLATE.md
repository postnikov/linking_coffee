# Security Audit Template

Use this template when reviewing code changes or performing security audits.

---

## 📋 Audit Information

- **Date:** _____________
- **Auditor:** _____________
- **Files Reviewed:** _____________
- **Scope:** [ ] Full Codebase [ ] Specific Feature [ ] Bug Fix
- **Triggered By:** [ ] Routine Audit [ ] Security Issue [ ] New Feature [ ] Code Review

---

## 🔍 INPUT VALIDATION & SANITIZATION

### Database Queries (CRITICAL)

**Check all `filterByFormula` statements:**

- [ ] All queries with user input use sanitization functions
- [ ] No direct string interpolation of usernames: `'${username}'`
- [ ] No direct string interpolation of emails: `'${email}'`
- [ ] No direct string interpolation of IDs: `'${id}'`

**Files to check:**
- [ ] `backend/server.js`
- [ ] `backend/scripts/*.js`
- [ ] Custom utilities using Airtable

**Found Issues:**
```
Line: ____
File: ____
Issue: ____
Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### User Input Validation

- [ ] All POST endpoints validate input
- [ ] All PUT endpoints validate input
- [ ] File uploads validate type and size
- [ ] URL parameters validated
- [ ] Query string parameters validated

**Found Issues:**
```
Endpoint: ____
Missing validation for: ____
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Endpoint Protection

**Check all API endpoints:**

- [ ] Admin endpoints use `checkAdmin` middleware
- [ ] User endpoints verify ownership
- [ ] No unauthenticated access to sensitive data
- [ ] Session/token validation on protected routes

**Vulnerable Endpoints Found:**
```
Route: ____
Method: ____
Issue: No authentication / Weak authentication
```

---

### Password & Token Handling

- [ ] No passwords in logs
- [ ] OTPs deleted after use
- [ ] Tokens expire appropriately
- [ ] Cryptographically secure random generation
- [ ] No tokens in URLs

**Found Issues:**
```
Location: ____
Issue: ____
```

---

## 🚫 RATE LIMITING

### Authentication Endpoints

- [ ] `/api/register` has rate limiting
- [ ] `/api/verify` has rate limiting
- [ ] `/api/login` has rate limiting
- [ ] Reset password endpoints have rate limiting

**Missing Rate Limits:**
```
Endpoint: ____
Current limit: ____
Recommended: 5 requests per 15 minutes
```

---

## 📝 LOGGING & ERROR HANDLING

### Sensitive Data Exposure

**Check all log statements:**

- [ ] No passwords in logs
- [ ] No OTP codes in logs
- [ ] No API keys in logs
- [ ] No full user objects with sensitive fields
- [ ] Error messages don't expose internals

**Found Issues:**
```
File: ____
Line: ____
Logs: ____ (sensitive field)
```

---

### Error Handling

- [ ] Try-catch blocks around risky operations
- [ ] Generic error messages to clients
- [ ] Detailed errors logged server-side
- [ ] No stack traces sent to clients

**Missing Error Handling:**
```
Function: ____
Risk: ____
```

---

## 🔑 SECRETS MANAGEMENT

### Environment Variables

- [ ] All secrets in `.env` file
- [ ] No hardcoded API keys
- [ ] No hardcoded passwords
- [ ] No hardcoded tokens
- [ ] `.env` in `.gitignore`

**Hardcoded Secrets Found:**
```
File: ____
Line: ____
Type: ____ (API key / password / token)
ACTION REQUIRED: Remove and rotate secret
```

---

### Secret Validation

- [ ] All required env vars validated at startup
- [ ] Clear error messages if secrets missing
- [ ] No secrets in client-side code

---

## 🌐 CORS & HEADERS

### CORS Configuration

- [ ] Origins restricted (not `cors()` with no options)
- [ ] Credentials handled properly
- [ ] No wildcard origins in production

**Current CORS Config:**
```javascript
// Copy current config here
```

**Issues:** ____________

---

### Security Headers

- [ ] Helmet.js or equivalent installed
- [ ] Content Security Policy configured
- [ ] X-Frame-Options set
- [ ] X-Content-Type-Options set
- [ ] HTTPS enforcement in production

---

## 📁 FILE OPERATIONS

### File Uploads

- [ ] File type validation
- [ ] File size limits
- [ ] Filename sanitization
- [ ] Storage in safe location
- [ ] Access control on uploaded files

**Upload Endpoints:**
```
Route: ____
Allowed types: ____
Max size: ____
Validation: [ ] Yes [ ] No
```

---

### File Reads

- [ ] No path traversal vulnerabilities
- [ ] User input in file paths validated
- [ ] Proper permissions on read operations

---

## 🗄️ DATABASE SECURITY

### Airtable Queries

- [ ] All queries use sanitization
- [ ] No SQL-like injection vulnerabilities
- [ ] Queries limit results (not fetching entire tables)
- [ ] Sensitive fields not exposed unnecessarily

**Query Audit:**
```
Total queries: ____
Sanitized: ____
Unsanitized: ____
```

---

### Data Exposure

- [ ] Only necessary fields returned to client
- [ ] Admin-only fields protected
- [ ] No PII in logs
- [ ] GDPR compliance maintained

---

## 🔄 SESSION MANAGEMENT

### Client-Side Storage

- [ ] No passwords in localStorage
- [ ] No API keys in localStorage
- [ ] Minimal data in localStorage
- [ ] Sensitive data in httpOnly cookies

**localStorage Audit:**
```
Data stored: ____
Sensitivity: [ ] High [ ] Medium [ ] Low
```

---

### Server-Side Sessions

- [ ] Session expiration configured
- [ ] Session regeneration on login
- [ ] Logout clears sessions properly

---

## 🧪 TESTING

### Security Test Coverage

- [ ] Injection attack tests
- [ ] Authentication bypass tests
- [ ] Rate limit tests
- [ ] File upload validation tests
- [ ] Error handling tests

**Test Results:**
```
Total security tests: ____
Passing: ____
Failing: ____
```

---

### Manual Testing

**Test with malicious inputs:**

- [ ] Username: `admin' OR 1=1 OR 'x`
- [ ] Email: `test@x.com' OR {Status}='Admin' OR 'x`
- [ ] Telegram ID: `' OR 1=1 OR '`
- [ ] File upload: Executable file (.exe, .sh)
- [ ] File upload: Oversized file (100MB)

**Results:** ____________

---

## 📊 VULNERABILITY SUMMARY

### Critical Issues (Fix Immediately)
1. ____________
2. ____________
3. ____________

### High Priority Issues (Fix This Week)
1. ____________
2. ____________
3. ____________

### Medium Priority Issues (Fix This Month)
1. ____________
2. ____________

### Low Priority / Nice to Have
1. ____________
2. ____________

---

## ✅ RECOMMENDATIONS

### Immediate Actions:
1. ____________
2. ____________
3. ____________

### Short-Term Improvements:
1. ____________
2. ____________

### Long-Term Enhancements:
1. ____________
2. ____________

---

## 📈 METRICS

- **Total Files Reviewed:** ____
- **Lines of Code Reviewed:** ____
- **Critical Issues Found:** ____
- **High Priority Issues Found:** ____
- **Medium Priority Issues Found:** ____
- **Low Priority Issues Found:** ____

**Overall Security Score:** ____ / 100

**Calculation:**
- Critical Issue: -20 points each
- High Priority: -10 points each
- Medium Priority: -5 points each
- Low Priority: -2 points each
- Start with 100 points

---

## 📝 AUDIT NOTES

**General Observations:**
____________

**Code Quality:**
____________

**Security Awareness:**
____________

**Documentation Quality:**
____________

---

## 🔄 FOLLOW-UP

### Next Audit Date: ____________

### Items to Track:
- [ ] Critical issues fixed and verified
- [ ] High priority issues addressed
- [ ] Security training completed
- [ ] Updated security guidelines reviewed

---

## ✍️ SIGN-OFF

**Auditor Signature:** ____________
**Date:** ____________

**Reviewed By:** ____________
**Date:** ____________

**Approved By:** ____________
**Date:** ____________

---

## 📎 ATTACHMENTS

- [ ] Detailed vulnerability reports
- [ ] Code snippets showing issues
- [ ] Suggested fixes
- [ ] Test results
- [ ] Compliance documentation

---

**Template Version:** 1.0
**Last Updated:** 2026-01-24
