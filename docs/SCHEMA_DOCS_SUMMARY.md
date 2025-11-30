# Schema Documentation System - Summary

## What was created

A service script that automatically fetches and documents your Airtable database schema.

## Files Created

1. **`backend/scripts/update-schema-docs.js`** - Main script
   - Connects to Airtable Meta API
   - Fetches all tables and fields
   - Generates markdown documentation
   - Saves to `docs/DATABASE_SCHEMA.md`

2. **`backend/scripts/README.md`** - Documentation for the script

3. **`docs/DATABASE_SCHEMA.md`** - Auto-generated schema documentation
   - Updated automatically when script runs
   - Contains all tables, fields, types, and options

## How to Use

### Quick Run
```bash
cd backend
npm run update-schema
```

### Direct Run
```bash
node backend/scripts/update-schema-docs.js
```

## Current Schema

The script successfully documented:
- **Members** table: 12 fields
  - Tg_ID, Tg_Username, Status, Languages, Countries, etc.
- **Countries** table: 4 fields
  - iso_code, name_ru, name_en, Members link

## Features

✅ Fetches live schema from Airtable
✅ Formats field types nicely (Text, Number, Boolean, etc.)
✅ Shows select field options
✅ Displays linked tables
✅ Timestamps each update
✅ Easy to run via npm script

## When to Run

Run this script whenever you:
- Add new tables to Airtable
- Modify existing fields
- Want to update documentation
- Need to share schema with team

## Requirements

The script uses environment variables from `.env`:
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`

Both are already configured in your project.

## Next Steps

You can now:
1. Run `npm run update-schema` anytime to refresh docs
2. Check `docs/DATABASE_SCHEMA.md` for current schema
3. Share the generated docs with your team
4. Add this to your deployment workflow if needed
