---
description: Create a feature specification from a natural language description.
---

## User Input

```text
$ARGUMENTS
```

## Instructions

1. **Parse** the feature description from `$ARGUMENTS`.
2. **Generate filename** in kebab-case (e.g., `tokenized-links.md`).
3. **Create** the spec file at `.agent/.specify/specs/<filename>.md`.
4. **Use this template**:

```markdown
# Feature: [Title]

## Problem

[What problem are we solving? 1-2 sentences.]

## Solution

[High-level approach. 1-2 sentences.]

## Requirements

1. [Requirement 1]
2. [Requirement 2]
   ...

## Tech Context

- Backend: Node.js + Express
- Database: Airtable (tables: Members, Matches, etc.)
- Frontend: React

## Verification Plan

- [ ] [How to test this feature]
- [ ] [Additional test case]
```

5. **Present** the spec to the user for review.

## Guidelines

- Focus on **WHAT** users need and **WHY**, not HOW to implement.
- Keep it concise. Specs should be under 50 lines.
- Requirements should be testable.
- If unclear, make a reasonable assumption and note it.
