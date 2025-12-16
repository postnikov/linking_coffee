# Feature: Tokenized Profile Links

## Problem

When users receive Telegram notifications with links to their match's profile, they open in Telegram's built-in browser where they're not logged in, resulting in a "Failed to load profile" error.

## Solution

Generate unique, time-limited tokens for each match that allow viewing the partner's profile without authentication.

## Requirements

1. **Token Generation** — When a match is created, generate two URL-safe tokens (32 chars each), one per direction (Member1→Member2, Member2→Member1). Store in Airtable fields `View_Token_1` and `View_Token_2`.

2. **API Endpoint** — `GET /api/view/:token` returns the partner's profile data. No auth required. Returns 404 if token is invalid or match is >2 weeks old.

3. **Frontend Route** — `/view/:token` renders a read-only profile page showing: photo, name, profession, grade, city/country, professional description, interests.

4. **Update Notifications** — Modify `notify-matches.js` to use `https://linked.coffee/view/{token}` instead of regular profile URLs.

## Tech Context

- Backend: Node.js + Express
- Database: Airtable (Members, Matches tables)
- Frontend: React
- Existing `PublicProfile.js` component can be adapted

## Verification Plan

- [ ] Create a match with `--dry-run` and verify tokens are generated
- [ ] Call `/api/view/{token}` and confirm profile data is returned
- [ ] Open `/view/{token}` in browser and verify profile renders
- [ ] Test with expired token (>2 weeks) → should return 404
- [ ] Test with invalid token → should return 404
- [ ] Send test notification and verify link works in Telegram browser
