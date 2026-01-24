# Security Quick Reference Card

**For AI Coding Agents** | Keep this open while coding

---

## 🔴 MANDATORY - Before Writing ANY Code

### 1. Database Queries
```javascript
// ❌ NEVER
filterByFormula: `{Field} = '${userInput}'`

// ✅ ALWAYS
const safe = sanitizeUsername(userInput);
filterByFormula: `{Field} = '${safe}'`
```

### 2. Authentication
```javascript
// ❌ NEVER
app.post('/api/admin/action', handler)

// ✅ ALWAYS
app.post('/api/admin/action', checkAdmin, handler)
```

### 3. Secrets
```javascript
// ❌ NEVER
const apiKey = 'sk-1234567890'

// ✅ ALWAYS
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error('API_KEY required')
```

### 4. Logging
```javascript
// ❌ NEVER
console.log('Password:', password)
console.log('OTP:', otp)

// ✅ ALWAYS
console.log('Auth attempt for user:', username)
logAuth(`User ${username} verified`)
```

---

## 🛡️ Import First, Code Second

```javascript
// COPY THIS to every file that queries Airtable:
const {
  sanitizeUsername,
  sanitizeEmail,
  sanitizeTelegramId
} = require('./utils/airtable-sanitizer');
```

---

## ✅ Quick Security Checklist

**Every time you write code, check:**

- [ ] User input? → **Sanitize it**
- [ ] Database query? → **Use sanitization**
- [ ] Admin endpoint? → **Add `checkAdmin`**
- [ ] Auth endpoint? → **Add rate limiting**
- [ ] Logging? → **No sensitive data**
- [ ] New secret? → **Add to `.env`**
- [ ] Error message? → **Generic for client**

---

## 📋 Common Patterns

### Pattern 1: User Lookup
```javascript
const safeUsername = sanitizeUsername(username);
const records = await base(MEMBERS_TABLE).select({
  filterByFormula: `{Tg_Username} = '${safeUsername}'`,
  maxRecords: 1
}).firstPage();
```

### Pattern 2: Email Lookup
```javascript
const safeEmail = sanitizeEmail(email);
const records = await base(MEMBERS_TABLE).select({
  filterByFormula: `{Email} = '${safeEmail}'`,
  maxRecords: 1
}).firstPage();
```

### Pattern 3: Telegram ID Lookup
```javascript
const safeTgId = sanitizeTelegramId(telegramId);
const records = await base(MEMBERS_TABLE).select({
  filterByFormula: `{Tg_ID} = '${safeTgId}'`,
  maxRecords: 1
}).firstPage();
```

### Pattern 4: Admin Endpoint
```javascript
app.post('/api/admin/action', checkAdmin, async (req, res) => {
  // Your code here
});
```

### Pattern 5: Rate Limited Auth
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.post('/api/login', authLimiter, handler);
```

---

## 🚨 Red Flags - Stop and Fix

If you see this pattern in code:

| Pattern | Problem | Fix |
|---------|---------|-----|
| `${username}` in query | Injection | Use `sanitizeUsername()` |
| `${email}` in query | Injection | Use `sanitizeEmail()` |
| `console.log(password)` | Data leak | Remove it |
| `cors()` no options | Open CORS | Restrict origin |
| No `checkAdmin` | Unauthorized access | Add middleware |
| No rate limit on auth | Brute force | Add `express-rate-limit` |

---

## 🧪 Test Before Commit

```bash
# Test with malicious input:
Username: admin' OR 1=1 OR 'x
Email: test@x.com' OR {Status}='Admin' OR 'x

# Expected: Validation error OR escaped safely
```

---

## 📞 Emergency Contacts

- **Full Guidelines:** `/docs/technical/SECURITY-GUIDELINES.md`
- **Sanitizer Code:** `/backend/utils/airtable-sanitizer.js`
- **Test Suite:** `/backend/utils/test-sanitizer.js`

---

**Remember: When in doubt, sanitize. When unsure, ask.**
