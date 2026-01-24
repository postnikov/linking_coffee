# Airtable Injection Fix Progress

**Date:** 2026-01-24
**Status:** In Progress

## Summary

Fixing 29 vulnerable `filterByFormula` queries in server.js by adding sanitization.

## Completed Fixes

### server.js

1. ✅ Line 257 - `bot.action('participate_yes')` - Telegram ID sanitization
2. ✅ Line 315 - `bot.action('participate_no')` - Telegram ID sanitization
3. ✅ Line 507 - `POST /api/register` - Username validation & sanitization

## Remaining Fixes (26 total)

### Authentication Endpoints (HIGH PRIORITY)
- Line ~615: `POST /api/verify` - Username sanitization
- Line ~705: OTP verification - Username sanitization
- Line ~863: Login endpoint - Email sanitization
- Line ~873: Login endpoint - Username sanitization

### Profile Endpoints (HIGH PRIORITY)
- Line ~2785: `PUT /api/profile` - Email sanitization
- Line ~2795: `PUT /api/profile` - Username sanitization
- Line ~2881: Profile update - Username sanitization

### User Lookup Endpoints
- Line ~902: Community code lookup
- Line ~989: Email lookup
- Line ~1041: Email lookup
- Line ~1156: LinkedIn ID lookup
- Line ~1179: Email lookup
- Line ~1327: Username lookup
- Line ~1349: Email lookup
- Line ~1405: Username lookup
- Line ~1504: Username lookup
- Line ~1512: Email lookup
- Line ~1674: Email lookup
- Line ~1822: Admin check - Username lookup
- Line ~1901: Admin check - Username lookup

### Match/Token Endpoints
- Line ~2380: Token profile view
- Line ~2496: Username lookup in token profile
- Line ~2500: Email lookup in token profile
- Line ~2511: Requester lookup
- Line ~2535: Match history query
- Line ~2644: Community match query

## Pattern to Apply

For each occurrence:

1. **Telegram ID:**
   ```javascript
   const safeTelegramId = sanitizeTelegramId(telegramId);
   filterByFormula: `{Tg_ID} = '${safeTelegramId}'`
   ```

2. **Username:**
   ```javascript
   const safeUsername = sanitizeUsername(cleanUsername);
   filterByFormula: `{Tg_Username} = '${safeUsername}'`
   ```

3. **Email:**
   ```javascript
   const safeEmail = sanitizeEmail(email);
   filterByFormula: `{Email} = '${safeEmail}'`
   ```

4. **Tokens (already validated, just sanitize):**
   ```javascript
   const safeToken = sanitizeForAirtable(token);
   filterByFormula: `{View_Token_1} = '${safeToken}'`
   ```

## Next Steps

1. Continue fixing server.js systematically
2. Update all backend scripts
3. Run comprehensive security tests
4. Deploy to staging for testing

## Testing Checklist

- [ ] Test with malicious username: `admin' OR 1=1 OR '`
- [ ] Test with malicious email: `test@example.com' OR {Status}='Admin' OR '`
- [ ] Test normal auth flow still works
- [ ] Test all endpoints return correct data
- [ ] Verify no regression in functionality
