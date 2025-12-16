## Task: Implement tokenized profile links for Linked.Coffee

### Problem
When users receive Telegram notifications with links to their match's profile, they open in Telegram's built-in browser where they're not logged in, resulting in an error.

### Solution
Create tokenized links that allow viewing a match's profile without authentication.

### Requirements

1. **Token Generation**
   - When a match is created, generate two unique tokens (one for each direction: Member1→Member2, Member2→Member1)
   - Store tokens in the Matches table in Airtable (add fields: `View_Token_1` and `View_Token_2`)
   - Tokens should be URL-safe, random strings (e.g., 32 chars)

2. **New API Endpoint**
   - `GET /api/view/:token` — returns the profile data for the match partner
   - No authentication required
   - Token lookup finds the match record and determines which profile to show
   - Return 404 if token invalid or match too old (>2 weeks)

3. **Frontend Route**
   - `/view/:token` — renders a read-only profile page
   - Shows: photo, name, profession, grade, city/country, professional description, interests
   - Simple page, no edit functionality needed

4. **Update Notification Script**
   - Modify `notify-matches.js` to use tokenized links instead of regular profile URLs
   - Link format: `https://linked.coffee/view/{token}`

### Tech Context
- Backend: Node.js + Express
- Database: Airtable (tables: Members, Matches)
- Frontend: React
- Existing profile component can be reused/adapted

### Start by
1. Explore current codebase structure
2. Check how matches are created and notifications sent
3. Propose implementation plan before coding