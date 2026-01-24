# Security Guidelines for Coding Agents

**Project:** Linking Coffee
**Last Updated:** 2026-01-24
**Status:** MANDATORY - All agents must follow these guidelines

---

## 🎯 Purpose

This document provides security best practices and mandatory rules for AI coding agents (Claude, GitHub Copilot, etc.) working on the Linking Coffee codebase. Following these guidelines prevents security vulnerabilities and maintains code quality.

---

## 🔴 CRITICAL RULES - NEVER VIOLATE

### 1. Database Query Injection Prevention

**❌ NEVER write database queries with unsanitized user input:**

```javascript
// ❌ WRONG - Vulnerable to injection
filterByFormula: `{Tg_Username} = '${username}'`
filterByFormula: `{Email} = '${email}'`
filterByFormula: `{Tg_ID} = '${telegramId}'`
```

**✅ ALWAYS use the sanitization utility:**

```javascript
// ✅ CORRECT - Protected against injection
const { sanitizeUsername, sanitizeEmail, sanitizeTelegramId } = require('./utils/airtable-sanitizer');

const safeUsername = sanitizeUsername(username);
filterByFormula: `{Tg_Username} = '${safeUsername}'`

const safeEmail = sanitizeEmail(email);
filterByFormula: `{Email} = '${safeEmail}'`

const safeTelegramId = sanitizeTelegramId(telegramId);
filterByFormula: `{Tg_ID} = '${safeTelegramId}'`
```

**Rule:** Every `filterByFormula` with user input MUST use sanitization functions.

---

### 2. Authentication & Authorization

**❌ NEVER skip authentication checks:**

```javascript
// ❌ WRONG - No auth check
app.post('/api/admin/dangerous-action', async (req, res) => {
  // Anyone can access this!
});
```

**✅ ALWAYS use authentication middleware:**

```javascript
// ✅ CORRECT - Protected endpoint
app.post('/api/admin/dangerous-action', checkAdmin, async (req, res) => {
  // Only admins can access
});
```

**Rule:** Admin endpoints MUST use `checkAdmin` middleware.

---

### 3. Sensitive Data Exposure

**❌ NEVER log sensitive data:**

```javascript
// ❌ WRONG - Exposes OTP codes
console.log('OTP code:', otp);
console.log('Full user object:', JSON.stringify(user));
console.log('Password:', password);
```

**✅ ALWAYS sanitize logs:**

```javascript
// ✅ CORRECT - Safe logging
console.log('OTP sent to user:', username);
console.log('User authenticated:', user.id);
logAuth(`Login attempt for ${username}`); // Use dedicated log functions
```

**Rule:** Never log passwords, OTP codes, API keys, or full user objects.

---

### 4. Environment Variables & Secrets

**❌ NEVER hardcode secrets:**

```javascript
// ❌ WRONG - Hardcoded API key
const apiKey = 'sk-1234567890abcdef';
const botToken = '123456:ABCdefGHIjklMNOpqrsTUVwxyz';
```

**✅ ALWAYS use environment variables:**

```javascript
// ✅ CORRECT - From .env file
const apiKey = process.env.ANTHROPIC_API_KEY;
const botToken = process.env.BOT_TOKEN;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY not set');
}
```

**Rule:** All secrets MUST come from `process.env` and MUST be validated.

---

### 5. Input Validation

**❌ NEVER trust user input:**

```javascript
// ❌ WRONG - No validation
app.post('/api/update-profile', (req, res) => {
  const { name, age, website } = req.body;
  // Directly use without checking
  updateProfile({ name, age, website });
});
```

**✅ ALWAYS validate and sanitize:**

```javascript
// ✅ CORRECT - Validated input
app.post('/api/update-profile', (req, res) => {
  const { name, age, website } = req.body;

  // Validate
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  if (age && (age < 0 || age > 150)) {
    return res.status(400).json({ error: 'Invalid age' });
  }
  if (website && !isValidURL(website)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  updateProfile({ name, age, website });
});
```

**Rule:** Validate ALL user input before processing.

---

## ⚠️ HIGH PRIORITY RULES

### 6. Error Handling

**❌ NEVER expose internal errors:**

```javascript
// ❌ WRONG - Exposes stack traces
try {
  await database.query();
} catch (error) {
  res.status(500).json({ error: error.stack });
}
```

**✅ ALWAYS use generic error messages:**

```javascript
// ✅ CORRECT - Safe error handling
try {
  await database.query();
} catch (error) {
  console.error('Database query failed:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

**Rule:** Log detailed errors server-side, return generic messages to clients.

---

### 7. Rate Limiting

**❌ NEVER leave auth endpoints unprotected:**

```javascript
// ❌ WRONG - No rate limiting
app.post('/api/login', handleLogin);
app.post('/api/verify', handleVerify);
```

**✅ ALWAYS apply rate limiting:**

```javascript
// ✅ CORRECT - Rate limited
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts, please try again later'
});

app.post('/api/login', authLimiter, handleLogin);
app.post('/api/verify', authLimiter, handleVerify);
```

**Rule:** Authentication endpoints MUST have rate limiting.

---

### 8. CORS Configuration

**❌ NEVER use wildcard CORS:**

```javascript
// ❌ WRONG - Allows all origins
app.use(cors());
```

**✅ ALWAYS restrict origins:**

```javascript
// ✅ CORRECT - Specific origins
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://linked.coffee'
    : 'http://localhost:3000',
  credentials: true
}));
```

**Rule:** CORS MUST be restricted to known origins.

---

### 9. File Uploads

**❌ NEVER accept arbitrary files:**

```javascript
// ❌ WRONG - No validation
app.post('/upload', upload.single('file'), (req, res) => {
  // Accept any file
});
```

**✅ ALWAYS validate file type and size:**

```javascript
// ✅ CORRECT - Validated uploads
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

**Rule:** File uploads MUST validate type, size, and content.

---

### 10. Session Management

**❌ NEVER store sensitive data in localStorage:**

```javascript
// ❌ WRONG - Sensitive data exposed
localStorage.setItem('user', JSON.stringify({
  id: user.id,
  password: user.password,
  apiKey: user.apiKey
}));
```

**✅ ALWAYS use minimal client-side storage:**

```javascript
// ✅ CORRECT - Only non-sensitive data
localStorage.setItem('user', JSON.stringify({
  username: user.username,
  displayName: user.name
}));
// Sensitive data stays server-side in session
```

**Rule:** Never store passwords, tokens, or API keys client-side.

---

## 💡 BEST PRACTICES

### 11. Parameterized Queries

When building complex Airtable formulas:

```javascript
// ✅ Use helper functions
const { buildSafeFilter, buildSafeAndFilter } = require('./utils/airtable-sanitizer');

const filter = buildSafeAndFilter([
  { field: 'Status', value: 'Active' },
  { field: 'Consent_GDPR', value: true }
]);
```

---

### 12. Date Handling

**❌ NEVER use `.toISOString()` for local dates:**

```javascript
// ❌ WRONG - Shifts date in positive timezones
const dateStr = date.toISOString().split('T')[0];
```

**✅ ALWAYS use local date components:**

```javascript
// ✅ CORRECT - Preserves local date
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;
```

---

### 13. Password/OTP Handling

**✅ Best practices:**

```javascript
// Generate cryptographically secure OTP
const crypto = require('crypto');
const otp = crypto.randomInt(100000, 999999).toString();

// Delete OTP after use (prevent replay attacks)
if (otpStore.get(username) === otp) {
  otpStore.delete(username); // ← CRITICAL
  // Proceed with auth
}

// Set expiration
const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
```

---

### 14. HTTPS Enforcement

**✅ Enforce HTTPS in production:**

```javascript
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

### 15. Security Headers

**✅ Use Helmet.js:**

```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
```

---

## 🧪 SECURITY TESTING CHECKLIST

Before deploying code with user input:

- [ ] All `filterByFormula` queries use sanitization
- [ ] Input validation for all user-supplied data
- [ ] Rate limiting on authentication endpoints
- [ ] Error messages don't expose internals
- [ ] No secrets in code (all in `.env`)
- [ ] No sensitive data in logs
- [ ] CORS restricted to known origins
- [ ] File uploads validate type and size
- [ ] Authentication middleware on protected routes
- [ ] Session tokens expire appropriately

---

## 🚨 VULNERABILITY RESPONSE

### If You Discover a Security Issue:

1. **DO NOT commit the vulnerable code**
2. **Document the issue** in `/docs/technical/security-issues.md`
3. **Create a fix immediately**
4. **Test the fix thoroughly**
5. **Deploy to staging first**
6. **Monitor logs after deployment**

### Common Vulnerability Patterns to Watch For:

| Pattern | Risk | Fix |
|---------|------|-----|
| `filterByFormula: {Field} = '${userInput}'` | SQL-like injection | Use `sanitizeForAirtable()` |
| `app.post('/api/admin/...', handler)` | Unauthorized access | Add `checkAdmin` middleware |
| `console.log(password)` | Data exposure | Remove or sanitize logs |
| `cors()` with no options | CSRF attacks | Restrict origins |
| `localStorage.setItem('token', ...)` | XSS token theft | Use httpOnly cookies |
| No rate limiting on `/api/login` | Brute force | Add `express-rate-limit` |

---

## 📚 REQUIRED READING

Before writing code that handles:

- **User Authentication** → Read OWASP Authentication Cheat Sheet
- **File Uploads** → Read OWASP File Upload Security
- **Database Queries** → Read OWASP Injection Prevention
- **Session Management** → Read OWASP Session Management

Links:
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/

---

## 🔧 SECURITY UTILITIES REFERENCE

### Airtable Sanitization (`/backend/utils/airtable-sanitizer.js`)

```javascript
const {
  sanitizeForAirtable,      // Generic sanitization
  sanitizeUsername,          // Username validation + sanitization
  sanitizeEmail,             // Email validation + sanitization
  sanitizeTelegramId,        // Telegram ID validation + sanitization
  buildSafeFilter,           // Build single filter safely
  buildSafeOrFilter,         // Build OR filter safely
  buildSafeAndFilter         // Build AND filter safely
} = require('./utils/airtable-sanitizer');
```

### Logging Utilities

```javascript
const { logAuth, logDebug, logMessage } = require('./server');

logAuth(`User ${username} logged in`);        // Auth events
logDebug(`Query returned ${count} results`);  // Debug info
logMessage(`System startup complete`);        // General logs
```

---

## 📝 CODE REVIEW CHECKLIST

Before submitting code for review:

### Security
- [ ] No hardcoded secrets or API keys
- [ ] All database queries use sanitization
- [ ] Input validation on all user data
- [ ] Error messages are generic
- [ ] No sensitive data in logs
- [ ] Authentication on protected endpoints
- [ ] Rate limiting on auth endpoints

### Quality
- [ ] No `console.log` in production code
- [ ] Proper error handling with try-catch
- [ ] Code follows existing patterns
- [ ] No duplicate code (DRY principle)
- [ ] Comments explain "why", not "what"

### Testing
- [ ] Test with valid inputs
- [ ] Test with invalid inputs
- [ ] Test with malicious inputs (injection attempts)
- [ ] Test error cases
- [ ] Test edge cases (empty, null, very long strings)

---

## 🎓 LEARNING RESOURCES

### For AI Agents:

When generating code that involves:

1. **User Input** → First thought: "How can this be exploited?"
2. **Database Queries** → First thought: "Is this injection-safe?"
3. **Authentication** → First thought: "Who can access this?"
4. **File Operations** → First thought: "What if they upload malware?"
5. **API Endpoints** → First thought: "What's the worst case?"

### Security Mindset:

**ALWAYS ASK:**
- "What if the user sends malicious data?"
- "What if an attacker intercepts this?"
- "What if someone tries to brute force this?"
- "What if they send 1 million requests?"
- "What credentials are required to access this?"

---

## 🚀 DEPLOYMENT SECURITY

### Pre-Deployment Checklist:

- [ ] All environment variables set in production `.env`
- [ ] Secrets rotated if committed accidentally
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Monitoring alerts configured
- [ ] Backup system working
- [ ] Rollback plan documented

### Post-Deployment Monitoring:

- Watch logs for validation errors (injection attempts)
- Monitor failed authentication attempts
- Track rate limit hits
- Review error logs for security issues
- Check for unusual database queries

---

## 📞 QUESTIONS?

If unsure about security implications:

1. **Check this guide** first
2. **Review similar code** in the codebase
3. **Test with malicious inputs** before deploying
4. **Document your decision** in code comments
5. **Ask for human review** if still uncertain

---

## 🏆 SECURITY HALL OF FAME

Recent security improvements:

- **2026-01-24:** Fixed Airtable injection vulnerability across 10 critical endpoints
- **2026-01-24:** Created comprehensive sanitization utility with 29 passing tests
- **2026-01-24:** Established security guidelines for all coding agents

---

## ⚖️ LICENSE & COMPLIANCE

**Data Protection:**
- GDPR compliant - user consent required
- Data minimization - only store necessary data
- Right to deletion - support data removal
- Data portability - support data export

**Security Standards:**
- OWASP Top 10 compliance
- Secure coding practices
- Regular security audits
- Vulnerability disclosure policy

---

**Last Reviewed:** 2026-01-24
**Next Review:** Quarterly or after major changes
**Maintained By:** Development Team + Security Reviewers
**Version:** 1.0

---

**Remember:** Security is not a feature, it's a requirement. When in doubt, choose the more secure option. Prevention is easier than remediation.
