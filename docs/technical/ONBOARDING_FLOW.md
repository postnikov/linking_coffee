# Onboarding Flow (Technical Reference)

How new users register and complete setup.

---

## Quick Overview

```
User opens bot → /start → Bot sends magic link
User clicks link → auto-verify (POST /api/verify) → GDPR modal → Dashboard
```

Alternative entry: Google/LinkedIn OAuth → same GDPR modal → Dashboard.

---

## Primary Flow: Telegram Bot (Magic Link)

### 1. Landing Page → Bot

**Frontend:** `Home.js`

Home page shows "Continue with Telegram" CTA — a link to `t.me/{BOT_NAME}`.
No username form. User goes directly to bot.

### 2. Bot generates OTP + magic link

**Backend:** `bot/callbacks.js:12-52`

User clicks `/start` or `/connect` in bot. Bot:

1. Generates 6-digit OTP
2. Stores in `otpStore` with `{ code, telegramId, firstName, lastName, expiresAt }`
3. Sends message with two clickable links:
   - **New user:** `{FRONTEND_URL}/login?code={otp}&user={username}`
   - **Existing user:** `{FRONTEND_URL}/dashboard?connectCode={otp}&connectUser={username}`

`FRONTEND_URL` comes from `shared/config.js`:
- Production: `https://linked.coffee` (default)
- Local dev: `http://localhost:3000` (set in `.env`)

### 3. Auto-verify on LoginPage

**Frontend:** `LoginPage.js` (useEffect + autoVerify function)
**Backend:** `routes/auth.js` — `POST /api/verify`
**Rate limiter:** `authLimiter` (10 req / 15 min)

When both `code` and `user` URL params are present, LoginPage auto-submits:

1. Shows loading spinner
2. POSTs to `/api/verify` with `{ telegramUsername, otp }`
3. Backend validates OTP, burns it, creates/updates user record
4. If `consentGdpr: true` → login + redirect to Dashboard
5. If `consentGdpr: false` → show GDPR modal
6. If verification fails → shows error, falls back to manual OTP form

Guard: `autoVerifyAttemptedRef` (useRef) prevents double-submit in React strict mode.

### 4. GDPR Consent

**Frontend:** `GdprModal.js`
**Backend:** `routes/auth.js` — `POST /api/consent`

Shown when `consentGdpr === false`. Collects:
- Name (required)
- Last Name (required)
- LinkedIn URL (optional)
- Three checkboxes: Terms, Age 18+, Telegram messaging

### 5. Dashboard (Profile Completion)

**Frontend:** `Dashboard.js`

Matching unlocks when Telegram + Name + Family are filled (`completionFields`).
Remaining fields (country, city, timezone, etc.) shown in "Improve your profile" block.

All fields autosave on blur via `PUT /api/profile`.

---

## Returning Users

Same flow: bot `/start` → magic link → auto-verify → Dashboard.

Additionally, `/api/register` still exists for the LoginPage manual flow:
if a returning user enters their username, backend proactively sends OTP to their Telegram.

---

## OAuth Paths

### Google OAuth
**Frontend:** `Home.js`
**Backend:** `routes/oauth.js` — `POST /api/auth/google`

### LinkedIn OAuth
**Frontend:** `Home.js`
**Backend:** `routes/oauth.js` — `GET /api/auth/linkedin/url`, callback handler

Both: find/create user by email → GDPR modal if needed → Dashboard.

---

## Key Files

| File | Role |
|------|------|
| `frontend/src/pages/Home.js` | Landing page: bot CTA + OAuth buttons |
| `frontend/src/pages/LoginPage.js` | Auto-verify from magic link, manual OTP fallback |
| `frontend/src/components/GdprModal.js` | Consent + name collection modal |
| `frontend/src/pages/Dashboard.js` | Profile completion + matching settings |
| `backend/bot/callbacks.js` | `/start` command, OTP + magic link generation |
| `backend/routes/auth.js` | `/register`, `/verify`, `/consent` |
| `backend/routes/oauth.js` | Google + LinkedIn OAuth |
| `backend/shared/config.js` | `FRONTEND_URL` config |
| `backend/shared/stores.js` | `otpStore` Map (in-memory) |
| `backend/shared/limiters.js` | `authLimiter` definition |

---

## Airtable Fields by Step

| Step | Fields Written |
|------|---------------|
| Verify (bot-first) | `Tg_Username`, `Tg_ID`, `Status: EarlyBird`, `Avatar`, `Created_At` |
| Verify (existing) | `Tg_ID`, `Avatar` |
| Consent | `Consent_GDPR: true`, `Name`, `Family`, `Linkedin` |
| Profile (Dashboard) | Everything else: profession, interests, city, etc. |

---

## Session Object

Stored in `localStorage` key `user`:

```js
{
  id,              // Airtable record ID
  username,        // Tg_Username (lowercase)
  Tg_Username,     // same
  Tg_ID,           // Telegram numeric ID
  status,          // 'EarlyBird' | 'Free' | 'PRO' | ...
  consentGdpr,     // true after consent step
  firstName,       // Name
  lastName,        // Family
  email,           // null for Telegram-first users
  telegramConnected,
  linkedAccounts   // ['google'] | ['linkedin'] | []
}
```

---

## Localhost Testing

`FRONTEND_URL=http://localhost:3000` in `.env` → bot sends localhost links.

LoginPage also has a DEV panel (only on `localhost`) with:
- Quick login buttons (no bot needed)
- E2E test accounts
- Custom username input

---

## Security & Validation

- **Rate limiting:** `authLimiter` on `/register` and `/verify` (10 req / 15 min)
- **Input sanitization:** `sanitizeUsername()` — alphanumeric + `_` + `-`, 3-50 chars
- **OTP store:** In-memory Map, entries expire after 10 min, burned after use
- **Formula injection:** `sanitizeForAirtable()` escapes `\`, `'`, newlines
- **Telegram ID:** `sanitizeTelegramId()` — positive integer, 1-15 digits
- **FRONTEND_URL:** Configured via env var, defaults to production domain
