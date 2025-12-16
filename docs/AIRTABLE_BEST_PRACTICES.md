# Airtable Integration Best Practices

This guide documents critical patterns and gotchas when working with Airtable in the Linking Coffee project.

---

## 1. Date/Time Field Formatting

### ⚠️ Critical Rule

Airtable Date/Time fields **reject full ISO strings** and require `YYYY-MM-DD` format.

### ❌ Wrong

```javascript
Created_At: new Date().toISOString(); // "2025-12-16T14:30:00.000Z" → INVALID_VALUE_FOR_COLUMN
```

### ✅ Correct

```javascript
Created_At: new Date().toISOString().split("T")[0]; // "2025-12-16" → Works!
```

### Affected Fields

- `Members.Created_At`
- `Community_Members.Joined_At`
- Any field with type `Date/Time` in schema

### Schema Reference

Always check `docs/DATABASE_SCHEMA.md` to verify field types before writing data.

---

## 2. Querying Linked Record Fields

### ⚠️ Critical Rule

Linked record fields cannot be queried directly by record ID. Use lookup fields or `FIND()` with `ARRAYJOIN()`.

### ❌ Wrong - Direct Record ID Comparison

```javascript
filterByFormula: `{Member} = '${recordId}'`; // Returns 0 results
```

### ✅ Correct - Use Lookup Fields

```javascript
// Query by a lookup field from the linked table
filterByFormula: `FIND('${username}', ARRAYJOIN({Tg_Username (from Member)}))`;
```

### Example: Finding Community Membership

```javascript
// ❌ This doesn't work:
base("Community_Members").select({
  filterByFormula: `{Member} = 'rec0wsWTTH1aHEgh1'`,
});

// ✅ This works:
base("Community_Members").select({
  filterByFormula: `FIND('kisodrakon', ARRAYJOIN({Tg_Username (from Member)}))`,
});
```

### Why?

- Linked record fields store **arrays of record IDs**
- Direct comparison `{Member} = 'recXXX'` compares an array to a string
- Lookup fields (e.g., `Tg_Username (from Member)`) are searchable text values

---

## 3. Schema Updates

### Always Update Documentation

When modifying Airtable schema:

1. **Update the schema docs:**

   ```bash
   cd backend
   npm run update-schema
   ```

2. **Verify the changes:**

   ```bash
   cat docs/DATABASE_SCHEMA.md
   ```

3. **Commit the updated schema:**
   ```bash
   git add docs/DATABASE_SCHEMA.md
   git commit -m "Update schema: [description]"
   ```

### Schema File Location

`docs/DATABASE_SCHEMA.md` is **auto-generated** by `backend/scripts/update-schema-docs.js`

---

## 4. Error Handling

### Always Log Airtable Errors in Detail

```javascript
try {
  await base('TableName').create([{ fields: {...} }]);
} catch (error) {
  // ❌ Bad: Generic logging
  console.error('Error:', error);

  // ✅ Good: Detailed logging
  console.error('Airtable Create Error:', JSON.stringify(error, null, 2));
  if (error.message) console.error('Error Message:', error.message);

  // Return error details to frontend
  res.status(500).json({
    success: false,
    message: 'Operation failed',
    details: error.message  // Helps debugging
  });
}
```

### Common Error Codes

- `INVALID_VALUE_FOR_COLUMN` → Check field type and format
- `INVALID_REQUEST_UNKNOWN` → Check table/field names
- `NOT_FOUND` → Check record IDs

---

## 5. Table and Field References

### Use Environment Variables for Table IDs

```javascript
// ✅ Good
base(process.env.AIRTABLE_MEMBERS_TABLE);

// ❌ Bad
base("tblCrnbDupkzWUx9P"); // Hardcoded
```

### Hardcoded Table IDs (When Necessary)

For tables without env vars, document the ID:

```javascript
// Community_Members table (tblPN0ni3zaaTCPcF)
base('tblPN0ni3zaaTCPcF').select({...})
```

### Field Name Conventions

- **Linked Records**: `{FieldName}` (e.g., `{Member}`)
- **Lookup Fields**: `{Name (from LinkedTable)}` (e.g., `{Tg_Username (from Member)}`)
- **Formula Fields**: Check schema for exact syntax

---

## 6. Testing Airtable Operations

### Create Debug Scripts

For complex operations, create standalone test scripts:

```javascript
// backend/debug-community-creation.js
require("dotenv").config({ path: "../.env" });
const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

async function testCommunityCreation() {
  try {
    const result = await base("tblPN0ni3zaaTCPcF").create([
      {
        fields: {
          Member: ["rec0wsWTTH1aHEgh1"],
          Community: ["recXXXXXXXXXXXXXX"],
          Status: "Active",
          Joined_At: new Date().toISOString().split("T")[0],
        },
      },
    ]);
    console.log("✅ Success:", result);
  } catch (error) {
    console.error("❌ Error:", JSON.stringify(error, null, 2));
  }
}

testCommunityCreation();
```

Run with:

```bash
node backend/debug-community-creation.js
```

---

## 7. Common Patterns

### Pattern: Find User by Username

```javascript
const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
  .select({
    filterByFormula: `{Tg_Username} = '${cleanUsername}'`,
    maxRecords: 1,
  })
  .firstPage();

if (records.length > 0) {
  const user = records[0];
  // Use user.id for linking
  // Use user.fields.* for data
}
```

### Pattern: Create Linked Record

```javascript
await base("Community_Members").create([
  {
    fields: {
      Member: [userRecordId], // Array of record IDs
      Community: [communityRecordId], // Array of record IDs
      Status: "Active",
      Joined_At: new Date().toISOString().split("T")[0],
    },
  },
]);
```

### Pattern: Query with Multiple Conditions

```javascript
base("TableName").select({
  filterByFormula: `AND(
    {Field1} = 'Value1',
    {Field2} > 10,
    FIND('text', {TextField})
  )`,
});
```

---

## 8. Debugging Checklist

When Airtable operations fail:

1. ✅ **Check field types** in `docs/DATABASE_SCHEMA.md`
2. ✅ **Verify table IDs** match the schema
3. ✅ **Check date formats** (use `split('T')[0]` for Date/Time fields)
4. ✅ **Use lookup fields** for linked record queries
5. ✅ **Log full error objects** with `JSON.stringify(error, null, 2)`
6. ✅ **Test in isolation** with a debug script
7. ✅ **Check Airtable UI** to verify data structure

---

## 9. Performance Considerations

### Batch Operations

```javascript
// ✅ Good: Batch create
await base('TableName').create([
  { fields: {...} },
  { fields: {...} },
  { fields: {...} }
]);

// ❌ Bad: Multiple individual creates
for (const item of items) {
  await base('TableName').create([{ fields: item }]);
}
```

### Parallel Queries

```javascript
// ✅ Good: Parallel fetching
const [users, communities, matches] = await Promise.all([
  base('Members').select({...}).firstPage(),
  base('Communities').select({...}).firstPage(),
  base('Matches').select({...}).firstPage()
]);
```

---

## 10. Quick Reference

### Environment Variables

```bash
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_MEMBERS_TABLE=tblCrnbDupkzWUx9P
AIRTABLE_CITIES_TABLE=tbllGzaGTz3PsxxWT
AIRTABLE_COUNTRIES_TABLE=tblTDQuqGDEDTPMLO
AIRTABLE_LOGS_TABLE=tbln4rLHEgXUkL9Jh
```

### Key Table IDs

- **Members**: `tblCrnbDupkzWUx9P`
- **Communities**: `tblSMXQlCTpl7BZED`
- **Community_Members**: `tblPN0ni3zaaTCPcF`
- **Matches**: `tblx2OEN5sSR1xFI2`
- **Cities**: `tbllGzaGTz3PsxxWT`
- **Countries**: `tblTDQuqGDEDTPMLO`
- **Logs**: `tbln4rLHEgXUkL9Jh`

### Useful Commands

```bash
# Update schema documentation
npm run update-schema

# Test Airtable connection
node backend/debug-community-creation.js

# View schema
cat docs/DATABASE_SCHEMA.md
```

---

## Summary

**Golden Rules:**

1. 📅 Date fields need `YYYY-MM-DD` format
2. 🔗 Linked records need lookup field queries
3. 📝 Always update schema docs after changes
4. 🐛 Log errors with full details
5. 🧪 Test complex operations in isolation

Following these practices will prevent 90% of Airtable-related bugs!
