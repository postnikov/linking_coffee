# Bug Fix: Active Users Calculation

**Date**: 2026-01-24
**Issue**: Active Users showing 0 or same as Total Users
**Status**: ✅ Fixed

## Problem Description

The "Active Users" metric in the statistics dashboard was showing incorrect values due to a logical error in the calculation.

### Root Cause

The implementation had a **double-filter** problem:

1. **Backend query** already filtered to only get users with `Consent_GDPR = true`
2. **Calculation logic** tried to filter again on `Consent_GDPR`
3. **Result**: Both `totalUsers` and `activeUsers` would be identical (or 0 if field not included)

### Original Code

```javascript
// In server.js - Pre-filtered query
filterByFormula: '{Consent_GDPR}'

// In statistics.js - Redundant filter
activeUsers: members.filter(m => m.fields.Consent_GDPR).length
```

This meant:
- All members passed to the calculation already had `Consent_GDPR = true`
- Filtering again on the same field returned the same count
- If `Consent_GDPR` field wasn't included in the response, it would return 0

## Solution Implemented

### New Definition

**Total Users**: All users who have consented to GDPR (baseline)
**Active Users**: Users who have opted in for next week (`Next_Week_Status = 'Active'`)

This provides insight into **weekly participation rates**.

### Code Changes

#### 1. Backend Query (server.js)
Added `Next_Week_Status` and `Current_Week_Status` to the fields list:

```javascript
fields: [
  'Created_At', 'Tg_ID', 'Linkedin_ID', 'Status',
  'Name', 'Family', 'Avatar', 'Profession', 'Grade',
  'Professional_Description', 'Personal_Description',
  'Languages', 'Professional_Interests', 'Personal_Interests',
  'Coffee_Goals', 'Countries', 'City_Link', 'Time_Zone',
  'Best_Meetings_Days', 'Next_Week_Status', 'Current_Week_Status'  // ← Added
]
```

#### 2. Calculation Logic (statistics.js)
Changed the active users filter:

```javascript
function calculateOverview(members, matches, matchPerformance) {
  return {
    totalUsers: members.length,
    // Active = users who opted in for next week
    activeUsers: members.filter(m => m.fields.Next_Week_Status === 'Active').length,
    totalMatches: matches.length,
    avgRating: matchPerformance.averageRating
  };
}
```

## Interpretation

### What the Metrics Now Mean

- **Total Users**: Everyone who has given GDPR consent (your full user base)
- **Active Users**: Users who clicked "Yes" to participate next week
- **Participation Rate**: `(Active Users / Total Users) × 100%`

### Example

```
Total Users: 150
Active Users: 95
Participation Rate: 63%
```

This tells you that 63% of your user base is actively participating in weekly matchmaking.

### Use Cases

1. **Engagement tracking**: Monitor weekly participation trends
2. **Churn detection**: If participation rate drops, investigate why
3. **Growth metrics**: Track how many users stay engaged vs. just registered
4. **Marketing effectiveness**: Measure impact of reminder campaigns

## Alternative Definitions Considered

### Option 2: Current Week Participation
```javascript
activeUsers: members.filter(m =>
  m.fields.Current_Week_Status === 'Matched' ||
  m.fields.Current_Week_Status === 'Active'
).length
```
This would show users currently in a match or waiting to be matched.

### Option 3: Non-Passive Users
```javascript
activeUsers: members.filter(m =>
  m.fields.Next_Week_Status !== 'Passive'
).length
```
This would count everyone except those who explicitly opted out.

**Selected Option 1** as it provides the clearest signal of user intent and engagement.

## Testing

To verify the fix:

1. Check that Active Users count is different from Total Users
2. Verify Active Users count matches Airtable query:
   ```
   filterByFormula: "AND({Consent_GDPR}, {Next_Week_Status} = 'Active')"
   ```
3. Confirm participation rate makes sense (typically 50-80%)

## Files Modified

1. `backend/server.js` (line 2163) - Added status fields to query
2. `backend/utils/statistics.js` (line 437) - Updated active users calculation

## Future Enhancements

Could add additional metrics:
- **Engaged Users**: Have participated in at least one match
- **Churned Users**: Haven't opted in for 3+ consecutive weeks
- **New Active Users**: Registered and opted in within last 7 days
- **Retention Rate**: % of users still active after N weeks

---

**Fix implemented by Claude Code**
**Date**: 2026-01-24
