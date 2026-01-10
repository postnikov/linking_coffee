---
trigger: always_on
---

# Agent Rules

These are the high-level rules for the agent working on this project.

## 1. Database Management

- **Schema Source of Truth**: \`docs/DATABASE_SCHEMA.md\` is the master definition.
- **Updates**: When changing the schema, always run:
  bash
  cd backend
  npm run update-schema

Or `node backend/scripts/update-schema-docs.js\`

## 2. Deployment

- **Manual Only**: Never deploy automatically. Wait for explicit user command (e.g., "deploy", "/deploy").
- **Production Safety**: Ensure all changes are tested locally before requesting deployment.

## 3. Communication

- **Format**: use clear Markdown.
- **Proactive**: Check for lint errors or logical issues before finishing a turn.


## 4. Coding Patterns

- **Date Handling**: When working with dates (especially for 'YYYY-MM-DD' query strings), **ALWAYS** use local date components (`getFullYear()`, `getMonth()`, `getDate()`) instead of `.toISOString()`. `toISOString()` converts to UTC, which can shift the date by -1 day in positive timezones, causing data mismatches.

## 5. AI Configuration

- **Valid Models**:
  - \`gemini-3-flash-preview\` is a valid existing model.
  - \`gemini-3-pro-preview\` is a valid existing model.
