# Duplicate Detection System

## Overview

The duplicate detection system prevents creating duplicate user accounts when users authenticate via different methods (Telegram first, then LinkedIn). This addresses the issue where a user creates an account with Telegram (no email) and then logs in with LinkedIn (same name, different email), resulting in two separate accounts.

## How It Works

### Detection Flow

1. **LinkedIn Authentication**: When a user logs in via LinkedIn OAuth
2. **Name Extraction**: System extracts `given_name` and `family_name` from LinkedIn profile
3. **Duplicate Search**: Before creating a new account, system searches for existing users with similar names
4. **Confidence Scoring**: Each potential match receives a confidence score (0-100)
5. **Action Based on Confidence**:
   - **≥90% (High)**: Block account creation, notify admin, ask user to link accounts
   - **70-89% (Medium)**: Create account but notify admin for review
   - **60-69% (Low)**: Create account, log for audit only
   - **<60%**: Create account (no duplicate detected)

### Confidence Scoring Algorithm

| Match Type | Confidence | Example |
|------------|-----------|---------|
| Exact match (case-insensitive, accent-insensitive) | 100% | "Maksim Dubinin" = "maksim dubinin" |
| First name exact, last name fuzzy (1-2 char diff) | 85-95% | "Maksim Dubinin" ≈ "Maksim Dubenin" |
| Both names fuzzy (1-2 char diff each) | 75-85% | "Maksim Dubinin" ≈ "Maxim Dubinin" |
| One name exact, other missing | 85% | "Maksim" matches "Maksim Dubinin" |
| One name exact, other very different | 60% | "Maksim Smith" vs "Maksim Dubinin" |
| Both names very different | 0% | "John Smith" vs "Jane Doe" |

The algorithm uses **Levenshtein distance** (edit distance) to measure similarity between names.

## Implementation Files

### Core Utility
- **[backend/utils/name-matcher.js](../../backend/utils/name-matcher.js)** - Name normalization and fuzzy matching logic
  - `normalizeName()` - Lowercase, trim, remove accents
  - `levenshteinDistance()` - Calculate edit distance between strings
  - `calculateMatchConfidence()` - Score a potential match (0-100)
  - `findPotentialDuplicates()` - Query Airtable for similar names

### Integration
- **[backend/server.js](../../backend/server.js)** - LinkedIn auth endpoint (lines ~1256-1360)
  - Calls `findPotentialDuplicates()` before creating new LinkedIn users
  - Sends admin notifications via `sendWarningAlert()`
  - Logs all duplicates to `backend/logs/duplicates.log`

### Logging
- **`logDuplicate()`** function in server.js
- Dedicated log file: `backend/logs/duplicates.log`
- Format: `[TIMESTAMP] [DUP] TYPE: Message`

## Testing

### Unit Tests
Run with:
```bash
node backend/tests/utils/name-matcher.test.js
```

Tests cover:
- Name normalization (accents, case, whitespace)
- Levenshtein distance calculation
- Confidence scoring for various scenarios
- Edge cases (empty names, null inputs)

### Integration Tests
Run with:
```bash
node backend/scripts/test-duplicate-detection.js
```

Tests real scenarios:
- Exact name match (Maksim Dubinin case)
- Fuzzy match (Maxim vs Maksim)
- No match scenario

## Example Scenarios

### Scenario 1: High-Confidence Duplicate (≥90%)

**Existing User (Telegram)**:
- Tg_Username: `maksdubinin`
- Tg_ID: `269846945`
- Name: `Maksim`
- Family: `Dubinin`
- Email: `undefined`

**LinkedIn Login Attempt**:
- Email: `Dubinin.me@gmail.com`
- Name: `Maksim`
- Family: `Dubinin`

**Result**:
- ❌ Account creation **BLOCKED**
- 🚨 Admin notification sent
- 📝 Logged to `duplicates.log`
- 💬 User sees: "We found an existing account for Maksim Dubinin. Please contact support to link your accounts."

### Scenario 2: Medium-Confidence Duplicate (70-89%)

**Existing User**:
- Name: `Maksim`
- Family: `Dubinin`

**LinkedIn Login Attempt**:
- Name: `Maxim`  (fuzzy match: 1 char difference)
- Family: `Dubinin`

**Result**:
- ✅ Account **CREATED**
- ⚠️ Admin notification sent for review
- 📝 Logged to `duplicates.log`
- Admin can manually merge if confirmed duplicate

### Scenario 3: Low-Confidence or No Match (<70%)

**Result**:
- ✅ Account **CREATED** normally
- 📝 Logged to `duplicates.log` (if 60-69%) or no log (if <60%)
- No admin notification

## Admin Notifications

### High-Confidence Duplicate (≥90%)
Sent to `ADMIN_CHAT_ID` via Telegram:
```
🚨 High-Confidence Duplicate Detected

New Login Attempt:
• Email: Dubinin.me@gmail.com
• Name: Maksim Dubinin
• LinkedIn Sub: 69Z_6T0aox

Potential Existing Account:
• Record ID: recCMbRlXIIUcrm2M
• Name: Maksim Dubinin
• Email: N/A
• Telegram: @maksdubinin

Match Details:
• Confidence: 100%
• Reason: Exact name match

⚠️ Action: New account was NOT created. User should be directed to link accounts.
```

### Medium-Confidence Duplicate (70-89%)
Similar notification but states "New account was created but may be duplicate. Please review and merge if needed."

## Security Considerations

### Input Sanitization
All name inputs are sanitized using `sanitizeForAirtable()` before querying:
```javascript
const safeFirst = sanitizeForAirtable(normFirst);
const filterFormula = `LOWER({Name}) = '${safeFirst}'`;
```

This prevents:
- SQL/NoSQL injection
- Formula injection in Airtable queries
- Special character exploits

### Rate Limiting
- Query limited to `maxRecords: 20` to prevent excessive database load
- Non-fatal error handling: If duplicate check fails, account creation proceeds normally

### Privacy
- Admin notifications only include necessary fields (name, email, Telegram username)
- No passwords or sensitive data logged
- Duplicate log file has same permissions as other logs

## Future Enhancements

### Potential Improvements
1. **User-Initiated Linking**: Add "Link Accounts" button in dashboard
2. **Phonetic Matching**: Handle names that sound similar but spelled differently (e.g., "Catherine" vs "Kathryn")
3. **Location Context**: Increase confidence if location/timezone matches
4. **Profession Context**: Increase confidence if profession field matches
5. **Admin Dashboard**: UI for viewing and resolving detected duplicates
6. **Bulk Deduplication**: Script to find and merge historical duplicates

### Known Limitations
- **Common Names**: May generate false positives for very common names (e.g., "John Smith")
  - Mitigation: Requires manual admin review for medium/high confidence
- **Name Variations**: May miss culturally different name formats (e.g., "李明" vs "Li Ming")
  - Mitigation: Future enhancement with multi-language support
- **Performance**: Duplicate check adds ~100-300ms to LinkedIn auth flow
  - Mitigation: Acceptable trade-off for data integrity

## Monitoring

### Log Files
- **duplicates.log**: All duplicate detection events
- **auth.log**: Authentication events (mirrors duplicate logs)
- **connections.log**: Connection attempts

### Queries
Check recent duplicates:
```bash
tail -50 backend/logs/duplicates.log
```

Filter by confidence level:
```bash
grep "Confidence: 100%" backend/logs/duplicates.log
```

View admin notifications sent:
```bash
grep "High-Confidence Duplicate" backend/logs/duplicates.log
```

## Maintenance

### Periodic Review
Recommended monthly:
1. Review `duplicates.log` for patterns
2. Check for false positives (high confidence but actually different people)
3. Adjust confidence thresholds if needed in `name-matcher.js`
4. Merge confirmed duplicates manually in Airtable

### Threshold Tuning
If too many false positives:
- Increase minimum confidence for blocking (currently 90%)
- Tighten Levenshtein distance threshold (currently ≤2)

If missing duplicates:
- Lower minimum confidence for medium tier (currently 70%)
- Expand query to include phonetic matching

## References

- **CLAUDE.md**: Security requirements for input sanitization
- **SECURITY-QUICK-REFERENCE.md**: Database query security patterns
- **server.js**: LinkedIn auth implementation (lines 1141-1360)
- **name-matcher.js**: Core matching algorithm

---

**Last Updated**: 2026-01-31
**Version**: 1.0
**Author**: Claude Code (AI-assisted implementation)
