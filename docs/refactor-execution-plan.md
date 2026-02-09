# Refactoring Execution Plan (Task Breakdown Per Agent)

## Assumptions
- No functional changes.
- Keep CommonJS backend for now.
- Use existing smoke tests in `backend/tests/smoke/`.

## Agent 0: Coordinator and Integrator
1. Create a `codex/refactor-modularization` branch.
2. Define target folder structure (routes, services, bot, middleware).
3. Track acceptance checklist and status across agents.
4. Integrate changes and resolve conflicts.
5. Run smoke tests and record results.
6. Prepare PR summary and risk notes.

## Agent 1: Backend Routes Split
1. Extract routes from `backend/server.js` into domain modules:
   - `backend/routes/auth.js`
   - `backend/routes/profile.js`
   - `backend/routes/admin.js`
   - `backend/routes/interests.js`
2. Keep `server.js` as a thin bootstrap with middleware and route mounts.
3. Ensure `checkAdmin` stays on admin endpoints.
4. Preserve all request and response shapes.

## Agent 2: Backend Airtable Services
1. Create Airtable service layer:
   - `backend/services/airtable/members.js`
   - `backend/services/airtable/matches.js`
   - `backend/services/airtable/cities.js`
   - `backend/services/airtable/interests.js`
2. Enforce sanitization at the service layer using `backend/utils/airtable-sanitizer.js`.
3. Replace direct `filterByFormula` usage in routes with service calls.
4. Verify behavior using existing smoke tests.

## Agent 3: Backend Bot and Alerting Decoupling
1. Extract bot lifecycle to `backend/bot/index.js` and expose a safe getter.
2. Update `backend/utils/alerting.js` to import bot via the getter to avoid circular imports.
3. Ensure bot launches only when `server.js` is the main module.
4. Verify alerting still works from scripts.

## Agent 4: Frontend Profile Refactor
1. Implement `frontend/src/components/ProfileView.js` per `implementation_plan_refactor_profile.md`.
2. Refactor `frontend/src/pages/PublicProfile.js` to fetch data only and render `ProfileView`.
3. Refactor `frontend/src/pages/TokenProfile.js` similarly.
4. Ensure existing CSS still applies.

## Agent 5: Frontend Auth Flow Refactor
1. Extract shared OTP + GDPR flow from `Home.js` and `LoginPage.js`.
2. Implement a shared hook or component, for example `frontend/src/hooks/useOtpLogin.js` or `frontend/src/components/OtpLoginFlow.js`.
3. Replace duplicated flow in both pages.
4. Confirm Google login + OTP login behavior remains identical.

## Agent 6: Frontend API Client Consolidation
1. Add `frontend/src/api/client.js` with base URL and standard `get/post` helpers.
2. Replace repeated `fetch` boilerplate in pages with the shared client.
3. Centralize `REACT_APP_API_URL` usage to one place.

## Sequencing and Dependencies
1. Agent 0 creates the branch and folder structure first.
2. Backend work runs in parallel by Agents 1 through 3.
3. Frontend work runs in parallel by Agents 4 through 6.
4. Agent 0 integrates and resolves conflicts.
5. Agent 0 runs smoke tests and verifies critical flows.

## Acceptance Checks
1. `backend/server.js` under 500 lines.
2. No direct `filterByFormula` in routes.
3. No OTP or sensitive logs remain.
4. `PublicProfile.js` and `TokenProfile.js` share `ProfileView`.
5. `Home.js` and `LoginPage.js` share OTP + GDPR flow.
6. API client defined once and reused.
7. All smoke tests pass.
