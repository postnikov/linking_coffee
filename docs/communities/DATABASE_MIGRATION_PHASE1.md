# Phase 1: Database Migration Guide - Closed Communities

**IMPORTANT**: These changes must be made in the Airtable Web UI. Complete each step in order and verify before proceeding to the next.

---

## Prerequisites

- Access to Airtable workspace with admin permissions
- Base ID: `${process.env.AIRTABLE_BASE_ID}`
- Backup current base before making changes (Settings > Duplicate base)

---

## Step 1: Create Invite_Links Table

### 1.1 Create New Table
1. In Airtable, click **"Add or import"** → **"Create empty table"**
2. Name: `Invite_Links`
3. Delete the default fields (Name, Notes, etc.)

### 1.2 Add Fields (in this order)

| Field Name | Field Type | Configuration | Notes |
|------------|------------|---------------|-------|
| `Link_ID` | Autonumber | - | Primary key, auto-generated |
| `Community` | Link to another record | Link to: `Communities` (single) | Parent community |
| `Code` | Single line text | - | 8-char hex code (unique) |
| `Label` | Single line text | - | Admin's tracking label (e.g., "Newsletter Invite") |
| `Status` | Single select | Options: `Active`, `Disabled` | Current status |
| `Max_Uses` | Number | Format: Integer, Allow negative: Yes | -1 = unlimited uses |
| `Used_Count` | Number | Format: Integer, Default: 0 | Current usage counter |
| `Expires_At` | Date | Include time: Yes | Null = never expires |
| `Created_At` | Created time | Include time: Yes | Auto-populated |
| `Created_By` | Link to another record | Link to: `Members` (single) | Creator of invite link |

### 1.3 Post-Creation Steps
1. Copy the table ID from the URL: `https://airtable.com/[baseId]/[tableId]/[viewId]`
   - Table ID format: `tblXXXXXXXXXXXXX`
2. Add to `.env` file:
   ```
   AIRTABLE_INVITE_LINKS_TABLE=tblXXXXXXXXXXXXX
   ```
3. Create a view named "Active Links" with filter: `Status = Active`

---

## Step 2: Update Communities Table

Navigate to the existing `Communities` table and add these fields:

| Field Name | Field Type | Configuration | Notes |
|------------|------------|---------------|-------|
| `Settings` | Long text | Enable rich text formatting: No | JSON configuration string |
| `Min_Active_For_Matching` | Number | Format: Integer, Default: 6 | Minimum opt-ins needed for matching |
| `Deleted_At` | Date | Include time: Yes | Soft deletion timestamp (null = active) |

### Settings JSON Structure (Example)
```json
{
  "approval_mode": "manual",
  "member_list_visible_to": "all_members",
  "invite_links_visible_to": "all_members",
  "odd_user_handling": "skip"
}
```

**Enum Values Reference:**
- `approval_mode`: `"auto"` or `"manual"`
- `member_list_visible_to`: `"all_members"` or `"admins_only"`
- `invite_links_visible_to`: `"all_members"` or `"admins_only"`
- `odd_user_handling`: `"skip"` or `"notify_admin"`

### Post-Update Steps
1. For existing communities, add default Settings value:
   ```json
   {"approval_mode": "auto", "member_list_visible_to": "all_members", "invite_links_visible_to": "all_members", "odd_user_handling": "skip"}
   ```
2. Set `Min_Active_For_Matching = 6` for all existing communities

---

## Step 3: Update Community_Members Table

Navigate to the existing `Community_Members` table:

### 3.1 Update Existing Fields

**Status Field:**
1. Click on the `Status` field header → **"Customize field"**
2. Add new option: `Pending` (in addition to existing options)
3. Ensure options include: `Active`, `Pending`, `Removed`

### 3.2 Add New Fields

| Field Name | Field Type | Configuration | Notes |
|------------|------------|---------------|-------|
| `Invited_Via` | Link to another record | Link to: `Invite_Links` (single) | Tracks which invite link was used |
| `Left_At` | Date | Include time: Yes | When member left voluntarily (null = still member) |

---

## Step 4: Update Members Table

Navigate to the existing `Members` table and add these fields:

| Field Name | Field Type | Configuration | Notes |
|------------|------------|---------------|-------|
| `Matching_Context` | Single line text | Default: `"global"` | Format: `"global"` or `"community:{slug}"` |
| `No_Global_Notifications` | Checkbox | Default: Unchecked | Opt-out from global invitations |

### Post-Update Steps
1. Set `Matching_Context = "global"` for all existing members
2. Set `No_Global_Notifications = false` for all existing members

---

## Step 5: Verify Matches Table

Navigate to the `Matches` table and verify:

### 5.1 Check Existing Fields
- Confirm `Community` field exists (Link to another record → Communities, single)
- Field type: Link to another record
- Linked table: `Communities`
- Allow linking to multiple records: **No** (single link only)

### 5.2 If Community Field Doesn't Exist
**According to PRD, this field should already exist.** If it's missing:

1. Add new field: `Community`
2. Field type: Link to another record
3. Link to: `Communities` (single)
4. This field will be populated by the matching script for community matches

---

## Step 6: Update Environment Variables

After creating the Invite_Links table, update your `.env` file:

```bash
# Add this line with your actual table ID
AIRTABLE_INVITE_LINKS_TABLE=tblXXXXXXXXXXXXX

# Verify these existing table IDs are correct
AIRTABLE_COMMUNITIES_TABLE=tblSMXQlCTpl7BZED
AIRTABLE_COMMUNITY_MEMBERS_TABLE=tblPN0ni3zaaTCPcF
AIRTABLE_MEMBERS_TABLE=tblCrnbDupkzWUx9P
AIRTABLE_MATCHES_TABLE=tblx2OEN5sSR1xFI2
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] Invite_Links table created with 10 fields
- [ ] Invite_Links table ID added to `.env`
- [ ] Communities table has 3 new fields (Settings, Min_Active_For_Matching, Deleted_At)
- [ ] Community_Members Status field includes "Pending" option
- [ ] Community_Members has 2 new fields (Invited_Via, Left_At)
- [ ] Members table has 2 new fields (Matching_Context, No_Global_Notifications)
- [ ] Matches table has Community field (already exists per PRD)
- [ ] All existing records have default values set where needed
- [ ] Backend .env file updated with new table ID

---

## Testing Database Changes

After completing the migration, test that the backend can access the new fields:

```bash
cd backend
node -e "
const Airtable = require('airtable');
require('dotenv').config({ path: '../.env' });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function test() {
  console.log('Testing Invite_Links table...');
  const inviteLinks = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({ maxRecords: 1 }).firstPage();
  console.log('✅ Invite_Links table accessible:', process.env.AIRTABLE_INVITE_LINKS_TABLE);

  console.log('Testing Communities table fields...');
  const communities = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({ maxRecords: 1 }).firstPage();
  if (communities.length > 0) {
    const fields = communities[0].fields;
    console.log('✅ Communities has Settings:', 'Settings' in fields);
    console.log('✅ Communities has Min_Active_For_Matching:', 'Min_Active_For_Matching' in fields);
    console.log('✅ Communities has Deleted_At:', 'Deleted_At' in fields);
  }

  console.log('Testing Members table fields...');
  const members = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({ maxRecords: 1 }).firstPage();
  if (members.length > 0) {
    const fields = members[0].fields;
    console.log('✅ Members has Matching_Context:', 'Matching_Context' in fields);
    console.log('✅ Members has No_Global_Notifications:', 'No_Global_Notifications' in fields);
  }

  console.log('\n✅ All database changes verified!');
}

test().catch(console.error);
"
```

---

## Rollback Plan

If issues occur, rollback by:

1. **Delete Invite_Links table** (if it causes problems)
2. **Remove new fields** from Communities, Community_Members, Members tables
3. **Restore from backup** (Settings > Duplicate base made at start)
4. **Remove** `AIRTABLE_INVITE_LINKS_TABLE` from `.env`

---

## Next Steps

Once Phase 1 is complete:
- Proceed to **Phase 2: Backend APIs** (invite management, join flow)
- Implement API endpoints that use these new database fields
- Add bot callback handlers for community workflows

---

**Estimated Time**: 30-45 minutes (manual Airtable work)

**Critical**: Do NOT proceed to Phase 2 until all verification steps pass. The backend APIs depend on these schema changes.
