---
trigger: always_on
---

Find actual database schema here:
docs/DATABASE_SCHEMA.md

use this script to update schema 
backend/scripts/update-schema-docs.js

# From backend directory
cd backend
npm run update-schema

# Or directly
node backend/scripts/update-schema-docs.js