# Database Schema Documentation Script

This script automatically fetches the current Airtable database schema and generates documentation.

## Usage

From the project root:
```bash
cd backend
npm run update-schema
```

Or directly:
```bash
node backend/scripts/update-schema-docs.js
```

## What it does

1. Connects to Airtable using the Meta API
2. Fetches all tables and their fields
3. Generates a markdown document with:
   - Table names and IDs
   - Field names, types, and descriptions
   - Field options (for select fields)
   - Primary field information
4. Saves to `docs/DATABASE_SCHEMA.md`

## Requirements

- `AIRTABLE_API_KEY` must be set in `.env`
- `AIRTABLE_BASE_ID` must be set in `.env`

## When to run

Run this script whenever:
- You add new tables to Airtable
- You add/modify fields in existing tables
- You want to update the documentation with the latest schema

## Output

The script generates `docs/DATABASE_SCHEMA.md` with:
- Timestamp of last update
- Overview of all tables
- Detailed field information for each table
- Field types and options

## Example Output

```markdown
# Airtable Database Schema

**Last Updated:** 2025-11-30T11:58:18.912Z

## Members

**Table ID:** `tblCrnbDupkzWUx9P`

### Fields

| Field Name | Type | Description |
|------------|------|-------------|
| Tg_Username | Text | - |
| Status | singleSelect (Free, PRO, Premium) | - |
...
```
