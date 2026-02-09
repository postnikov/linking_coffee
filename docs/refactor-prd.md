# Refactoring PRD (For Coding Agents)

## Context
Linked.Coffee is a React + Node/Express app with Airtable + Telegram bot integrations. The primary maintainability issue is oversized, multi‑responsibility files and duplicated logic across frontend pages. This PRD defines a refactor plan that agents can execute without changing behavior.

## Goals
- Reduce complexity and risk by modularizing backend routes and frontend UI logic.
- Eliminate duplicate profile and auth flows on the frontend.
- Centralize Airtable access and sanitization to enforce security requirements.
- Improve testability by isolating side effects and making modules deterministic.

## Non‑Goals
- No functional changes or UI redesign.
- No database schema changes.
- No new features.
- No performance optimizations beyond what falls out of refactoring.

## Scope (High Priority)
- Backend decomposition of `backend/server.js` into route modules and services.
- Centralized Airtable data access layer with mandatory sanitization.
- Frontend refactor to extract reusable profile view and shared auth flow.
- Consolidated API client in frontend.

## Scope (Medium Priority)
- Consolidate logging utilities and enforce “no sensitive logs” policy.
- Remove dead code and unused imports.
- Improve cross‑module dependency boundaries to avoid circular imports.

## Out of Scope
- Rewriting matching algorithms.
- Changing Telegram bot flows or message content.
- Replacing Airtable.

## Constraints and Guardrails
- Follow security rules in `CLAUDE.md`.
- All Airtable queries must use sanitizer utilities in `backend/utils/airtable-sanitizer.js`.
- Do not log OTPs or secrets.
- Preserve existing API contract.

## Current Pain Points (Evidence)
- `backend/server.js` ~3,179 lines and mixes HTTP routes, bot lifecycle, scheduler init, logging, OAuth, and Airtable access.
- `frontend/src/pages/Dashboard.js` ~3,667 lines with extensive state, modal logic, data fetching, and rendering in one file.
- `frontend/src/pages/PublicProfile.js` and `frontend/src/pages/TokenProfile.js` are near duplicates.
- `frontend/src/pages/Home.js` and `frontend/src/pages/LoginPage.js` duplicate OTP + GDPR flows.
- Airtable queries are repeated with inconsistent sanitization in `backend/server.js`.
- Side effects and module coupling (alerting uses `server.js` bot instance) reduce testability.

## Proposed Architecture

### Backend
- `backend/server.js` becomes a thin bootstrap.
- Routes split by domain into modules.
- Services encapsulate Airtable logic and enforce sanitization.
- Bot lifecycle isolated in `backend/bot/index.js` to avoid circular imports.

### Frontend
- Extract a `ProfileView` component shared by `PublicProfile` and `TokenProfile`.
- Extract shared OTP + GDPR auth flow used by `Home` and `LoginPage`.
- Create a shared API client at `frontend/src/api/client.js`.

## Milestones and Deliverables
1. Backend route split and thin `server.js`.
2. Airtable service layer with mandatory sanitization.
3. Frontend profile refactor via shared `ProfileView`.
4. Frontend auth flow refactor via shared hook or component.
5. Frontend API client consolidation.

## Acceptance Criteria

### Backend
- `backend/server.js` under 500 lines.
- Routes organized by domain.
- Airtable sanitization enforced everywhere.
- No OTP or secrets logged.

### Frontend
- `Dashboard.js` reduced in size by extraction of sections or hooks.
- `PublicProfile.js` and `TokenProfile.js` share `ProfileView`.
- `Home.js` and `LoginPage.js` share OTP + GDPR flow.
- API URL defined once in the client.

### Testing
- All existing smoke tests in `backend/tests/smoke/` pass.
- Manual validation of key user flows: register, verify, login, profile load, admin dashboard.

## Risks and Mitigations
- Risk: behavior drift during refactor.
- Mitigation: refactor in small steps, keep API signatures unchanged, run smoke tests.
- Risk: circular dependencies.
- Mitigation: isolate bot init, avoid importing server inside utils.
- Risk: sanitization regressions.
- Mitigation: enforce sanitizer at service layer.

## Open Questions
1. Keep CommonJS or plan a TS migration later?
2. Extract a separate module for bot + notifications?
3. Add a shared logging wrapper with redaction?

## Immediate Next Steps
- Create route modules and move endpoints from `backend/server.js`.
- Add Airtable service wrappers and update routes.
- Implement `ProfileView` per `implementation_plan_refactor_profile.md`.
