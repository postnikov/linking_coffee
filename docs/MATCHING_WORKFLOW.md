# Matching Workflow Guide

This guide explains how to use the matching script to pair up users for the weekly coffee chats.

## Script Location
`backend/scripts/match-users.js`

## Prerequisites
- Node.js installed
- `.env` file in the project root with Airtable credentials (`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`)

## How it works
1. **Identifies the Week**: Determines the current week's Monday.
2. **Checks Existing Matches**: Looks for matches already created for this week to avoid duplicates.
3. **Fetches Active Users**: Gets all users who have `Next_Week_Status = 'Active'`.
4. **Filters**: Excludes users who are already matched.
5. **Pairs Users**: Randomly shuffles the available users and creates pairs.
6. **Updates Database**:
   - Creates new records in the `Matches` table.
   - Updates `Current_Week_Status` to `Matched` for the paired members.
   - Any leftover user (if an odd number) remains unmatched for now.

## Usage

### 1. Dry Run (Test Mode)
Always run this first to see who will be matched without making any changes to the database.

```bash
# From project root
node backend/scripts/match-users.js --dry-run
```

**Output:**
The script will print the list of proposed pairs:
```
👀 DRY RUN - No changes will be made.
Proposed Matches:
  Match #1: Alice <—> Bob
  Match #2: Charlie <—> Dave
```

### 2. Live Run (Save to Database)
When you are satisfied with the proposed matches (or just ready to randomize), run without the flag.

```bash
# From project root
node backend/scripts/match-users.js
```

**Output:**
```
🚀 Starting Match Script (Dry Run: false)
...
💾 Saving matches to Airtable...
   - Created 5 match records...
💾 Updating members status to "Matched"...
   - Updated 10 member statuses...
✅ All changes saved successfully!
```

## Troubleshooting
- **No matches found?** Ensure users have set their status to "Active" for the coming week.
- **Error: "Cannot find module"?** Make sure you are running the command from the root directory (`~/P/Linking_Coffee`) or adjust the path (`node scripts/match-users.js` if inside `backend`).
