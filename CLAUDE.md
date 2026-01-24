# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔒 SECURITY FIRST

**MANDATORY:** Before writing ANY code, read:
- **[Security Quick Reference](docs/technical/SECURITY-QUICK-REFERENCE.md)** ← Start here
- **[Full Security Guidelines](docs/technical/SECURITY-GUIDELINES.md)** ← Comprehensive rules
- **[Security Audit Template](docs/technical/SECURITY-AUDIT-TEMPLATE.md)** ← For code reviews

**Critical Rules:**
1. **ALL database queries MUST use sanitization** from `/backend/utils/airtable-sanitizer.js`
2. **Admin endpoints MUST use `checkAdmin` middleware**
3. **Never log passwords, OTP codes, or API keys**
4. **All secrets MUST come from `process.env`**
5. **Validate ALL user input before processing**

See [SECURITY-QUICK-REFERENCE.md](docs/technical/SECURITY-QUICK-REFERENCE.md) for copy-paste patterns.

---

## Project Overview

Linked.Coffee is a web service that connects people for meaningful conversations through Telegram using Random Coffee mechanics. It consists of a React frontend, Node.js/Express backend, and Airtable database integration.

## Essential Commands

### Development
```bash
# Start both frontend and backend servers
./start_local.sh
# Frontend runs on http://localhost:3000
# Backend runs on http://localhost:3001

# Run backend only
cd backend && npm run dev

# Run frontend only
cd frontend && npm start

# Update database schema documentation
cd backend && npm run update-schema

# Run individual scripts
cd backend && node scripts/match-users.js
cd backend && node scripts/notify-matches.js
```

### Docker Deployment
```bash
# Deploy with Docker Compose
docker compose up -d

# Production deployment (auto-commits, pushes, and deploys to server)
./deploy-prod.sh

# View logs
docker compose logs -f
```

### Admin Operations
```bash
# Backup Airtable data
cd backend && npm run backup

# Sync backups to Google Drive
cd backend && npm run sync
```

## Architecture & Key Components

### Backend (`/backend/server.js`)
The Express server handles all API endpoints and integrates with Airtable and Telegram:

**Core API Endpoints:**
- `POST /api/register` - New user registration with Telegram username
- `POST /api/verify` - Telegram OTP authentication verification
- `POST /api/consent` - GDPR consent handling
- `GET /api/profile` - Retrieve user profile
- `PUT /api/profile` - Update user profile with autosave support
- `POST /api/upload-avatar` - Avatar upload with multer
- `GET /api/countries` - Fetch approved countries list
- `GET/POST /api/cities` - Cities management
- `GET /api/interests` - Professional and personal interests
- `GET /api/admin/scheduler` - List scheduled jobs
- `POST /api/admin/scheduler` - Add/update/delete scheduled jobs
- `POST /api/admin/scheduler/run` - Trigger job immediately
- `GET /api/admin/logs` - View system logs
- `GET /api/health` - Health check endpoint

**Key Features:**
- Airtable integration for all data storage (Members, Countries, Cities, Matches tables)
- Telegram Bot authentication using OTP system (10-minute validity)
- Multer for file uploads to `/backend/uploads/`
- CORS enabled for frontend communication
- Environment-based configuration via dotenv
- Cron-based job scheduler for automated matching workflow

### Scheduler Architecture (`/backend/scheduler.js`)

The Scheduler is a cron-based job orchestration system that manages the weekly matching cycle:

**How It Works:**
- Loads job configs from `scheduler.json` (persistent storage)
- Uses `node-cron` to execute jobs on schedules (e.g., "0 9 * * MON" for Monday 9am)
- Spawns each script as a child process with environment variables
- Persists `lastRun` timestamp and `lastStatus` (Success/Failed) in config
- Provides REST API for job management via admin dashboard

**Job Config Structure:**
```javascript
{
  name: "Weekly Matches",
  script: "match-users.js",
  cron: "0 8 * * MON",  // Every Monday at 8am
  enabled: true,
  lastRun: "2025-12-23T08:15:00Z",
  lastStatus: "Success"
}
```

### Weekly Matching Workflow (`/backend/scripts/`)

The matching system operates on a **weekly cycle** with 5 main automated scripts:

1. **`match-users.js`** - Core matching engine (Monday mornings):
   - Fetches active members (`Next_Week_Status = 'Active'`)
   - Implements smart pairing algorithm with:
     - **Hard filters**: Language compatibility (-10000 penalty), timezone proximity (-5000 penalty for >6h diff)
     - **Soft scoring**: Meeting day overlap (+200), professional interests (+50), personal interests (+30), shared goals (+100)
     - **History optimization**: Prioritizes users who haven't met recently or never met (+1000 base for new pairs)
   - Generates **AI-powered personalized intros** using Anthropic Claude Haiku
   - Creates view tokens (32-char hex) for tokenized profile links
   - Creates Matches records with status "Matched"

2. **`notify-matches.js`** - Sends match notifications via Telegram (Monday):
   - Fetches matches with `Notifications = 'Pending'`
   - Generates language-aware messages (English/Russian based on `Notifications_Language`)
   - Includes partner profile links (tokenized) and AI-generated intro summaries
   - Optional image attachments from `generate-match-images.js`
   - Updates match status to 'Sent'

3. **`send-weekly-checkin.js`** - Weekend invitation for next week participation (Sunday):
   - Targets users with `Consent_GDPR=true` and valid Telegram ID
   - Sends "Are you up for coffee next week?" with inline buttons
   - Allows users to respond via callbacks (`participate_yes`/`participate_no`)
   - Updates `Next_Week_Status` to 'Active' or 'Passive'

4. **`midweek-checkin.js`** - Wednesday feedback checkpoint:
   - Targets current week matches not yet checked (`Midweek_Checkin = false`)
   - Asks "Have you met yet?" with 3 options: Met, Scheduled, Failed
   - Updates `We_Met_1/We_Met_2` fields
   - Triggers follow-up rating survey if "Met" is selected

5. **`weekend-feedback.js`** - Sunday feedback collection:
   - Targets matches with incomplete feedback (`Feedback1/Feedback2` empty)
   - Provides 4-option feedback: Met, Scheduled, Not Met, Something Wrong
   - Updates `Feedback1/Feedback2` with ratings (1-4 scale)
   - Marks `Weekend_Checkin = true`

**Supporting Scripts:**
- `generate-match-images.js` - Creates social cards using Google Gemini + Imagen for visual match context
- `backup-airtable.js` - Daily backup system (gzip-compressed to backups/daily/)
- `activate-feedback-users.js` - Processes event triggers for user activation
- `broadcast-message.js` - Admin tool for bulk messaging
- `update-schema-docs.js` - Generates database schema documentation

### Frontend (`/frontend/src/`)

React application with internationalization and routing:

**Routing Structure (`App.js`):**
```
/ or /dashboard - Dashboard (authenticated users) / Home (logged out)
/login - Telegram OTP verification
/view/:token - Tokenized match profile (no auth, 2-week expiration)
/profile/:username - Public profile (requires auth + match relationship)
/about, /rules, /prices - Info pages
/admin - Admin dashboard (no layout wrapper, admin-only)
```

**Main Pages:**
- `Home.js` - Landing page with Telegram login widget
- `LoginPage.js` - OTP verification form
- `Dashboard.js` - User's own profile (name, interests, languages, timezone, city, avatar)
- `PublicProfile.js` - View matched user's profile (access control via match relationship)
- `TokenProfile.js` - View match partner via secure token link (bypasses auth, time-limited)
- `AdminPage.js` - Admin dashboard with system health checks
- `AdminHealth.js` - Scheduler management, logs, backups monitoring

**Core Components:**
- `TelegramLoginButton.js` - Integrates Telegram WebApp widget
- `GdprModal.js` - GDPR consent flow with community code entry
- `Header.js` - Navigation with user dropdown
- `Footer.js` - Static footer
- `PageLayout.js` - Consistent page wrapper with sidebar/layout

**Key Features:**
- React Router for navigation
- i18next for internationalization (English/Russian)
- Local storage for auth persistence (stores `user` object with `Tg_Username` and `Tg_ID`)
- Responsive design with custom CSS
- Autosave on field blur for profile updates

### Database Schema (Airtable)

**Members Table (`tblCrnbDupkzWUx9P`)** - User profiles:
- **Auth**: `Tg_ID`, `Tg_Username`, `Consent_GDPR`
- **Status**: `Status` (Free, PRO, Premium, Admin, EarlyBird), `Current_Week_Status`, `Next_Week_Status`
- **Profile**: `Name`, `Family`, `Avatar`, `Profession`, `Grade`
- **Descriptions**: `Professional_Description`, `Personal_Description`
- **Interests**: `Professional_Interests`, `Personal_Interests`, `Coffee_Goals` (multiple selects)
- **Location**: `Countries` (link), `City_Link`, `Time_Zone`
- **Preferences**: `Languages`, `Best_Meetings_Days`, `Serendipity`, `Proximity`
- **Relations**: `Primary_Community` (link), `Matches`, `Matches 2`, `Logs`, `Community_Members`
- **Metadata**: `Created_At`, `Last_Seen`, `Notifications_Language`

**Matches Table (`tblx2OEN5sSR1xFI2`)** - Weekly match records:
- **Pair**: `Member1`, `Member2` (links to Members)
- **Status**: `Status`, `Notifications` (Pending/Sent), `Midweek_Checkin`, `Weekend_Checkin`
- **Feedback**: `Feedback1`, `Feedback2` (1-4 ratings), `We_Met_1`, `We_Met_2` (Met/Scheduled/No/Fail)
- **Intros**: `Intro_1`, `Intro_2` (JSON with greeting, why_interesting, conversation_starters)
- **Visual**: `Intro_Image` (generated social card), `Shared_Intro` (common context)
- **Tokens**: `View_Token_1`, `View_Token_2` (32-char hex for profile links)
- **Tracking**: `Week_Start` (date YYYY-MM-DD)

**Countries Table (`tblTDQuqGDEDTPMLO`)**:
- `ISO_Code`, `Name_en`, `Name_ru`, `Members` (link)

**Cities Table (`tbllGzaGTz3PsxxWT`)**:
- `Slug`, `name_en`, `name_ru`, `country_iso`, `Approved` (boolean)

**Communities Table (`tblSMXQlCTpl7BZED`)** - Optional community pools:
- `Name`, `Invite_Code`, `Status` (Active/Inactive)

**Community_Members Table (`tblPN0ni3zaaTCPcF`)** - Membership links:
- `Member`, `Community`, `Role`, `Status`, `Joined_At`, `Invited_By`

**Event_Logs Table (`tbln4rLHEgXUkL9Jh`)** - Activity tracking:
- `Event` (Activated, Deactivated), `Member` (link), `Timestamp`

## Environment Configuration

Required environment variables in `.env`:
```
AIRTABLE_API_KEY=         # Airtable Personal Access Token
AIRTABLE_BASE_ID=         # Base ID
AIRTABLE_MEMBERS_TABLE=   # Members table ID (tblCrnbDupkzWUx9P)
AIRTABLE_CITIES_TABLE=    # Cities table ID (tbllGzaGTz3PsxxWT)
AIRTABLE_MATCHES_TABLE=   # Matches table ID (tblx2OEN5sSR1xFI2)
BOT_TOKEN=                # Telegram bot token for notifications
ADMIN_BOT_TOKEN=          # Admin bot token
ADMIN_CHAT_ID=            # Admin notifications chat
ANTHROPIC_API_KEY=        # For AI-generated match intros
GOOGLE_AI_API_KEY=        # For match image generation (Gemini + Imagen)
PORT=3001                 # Backend port
BACKUP_DIR=               # Optional backup directory (default: backend/backups)

# OAuth (used by both backend and frontend build)
GOOGLE_CLIENT_ID=         # Google OAuth client ID for login
LINKEDIN_CLIENT_ID=       # LinkedIn OAuth client ID
LINKEDIN_CLIENT_SECRET=   # LinkedIn OAuth client secret
LINKEDIN_REDIRECT_URI=    # LinkedIn callback URL (https://linked.coffee/auth/linkedin/callback)

# Frontend Build Args (passed via docker-compose.prod.yml)
REACT_APP_TELEGRAM_BOT_NAME=Linked_Coffee_Bot  # Telegram bot name for widget

# Script Logging (Optional)
MAX_LOG_SIZE=10485760     # Max log file size in bytes (default: 10MB)
MAX_ROTATIONS=5           # Number of rotated log files to keep (default: 5)
LOG_RETENTION_DAYS=30     # Days to retain logs before deletion (default: 30)
ENABLE_LOG_COMPRESSION=false  # Compress rotated logs to .gz (default: false)
```

## Important Implementation Details

### Date Handling for Queries

**CRITICAL**: When constructing 'YYYY-MM-DD' date strings for Airtable queries, always use local date components (`getFullYear()`, `getMonth()`, `getDate()`) instead of `.toISOString()`.

```javascript
// ✅ CORRECT
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;

// ❌ WRONG - shifts date by -1 day in positive timezones
const dateStr = date.toISOString().split('T')[0];
```

Using `.toISOString()` converts to UTC, which can shift the date by -1 day in positive timezones, causing data mismatches in match queries and scheduling logic.

### Telegram Bot Instance Management

**CRITICAL**: The Telegram Bot API only allows **one active polling session per bot token**. Multiple polling sessions will cause `409 Conflict: terminated by other getUpdates request` errors and break all bot functionality (callbacks, commands, etc.).

**How We Prevent This:**

1. **Single Launch Point**: `bot.launch()` is only called in [server.js](backend/server.js) when it's the main module:
   ```javascript
   // Only launch bot if running as main process (not when imported as module)
   if (require.main === module) {
     bot.launch().then(() => {
       console.log('🤖 Telegram bot started');
     });
   }
   ```

2. **Shared Bot Instance**: Scripts that need to send messages (via [alerting.js](backend/utils/alerting.js)) reuse the bot instance from server.js:
   ```javascript
   const server = require('../server');
   botInstance = server.bot;  // Reuses existing instance
   ```

3. **Send-Only Pattern**: Scripts NEVER call `bot.launch()` - they only use `bot.telegram.sendMessage()` which doesn't start polling.

**Rules for Developers:**

- ✅ **DO**: Use `bot.telegram.sendMessage()`, `bot.telegram.sendPhoto()`, etc. for sending messages
- ✅ **DO**: Import bot instance from server.js via alerting.js utilities
- ✅ **DO**: Register callback handlers with `bot.action()` in server.js
- ❌ **DON'T**: Call `bot.launch()` anywhere except server.js main module check
- ❌ **DON'T**: Call `bot.startPolling()` or `bot.handleUpdate()` in scripts
- ❌ **DON'T**: Create multiple `new Telegraf()` instances that call launch()

**Debugging 409 Errors:**

If you see `409 Conflict` errors:
1. Check if multiple processes are running the same bot token
2. Clear pending updates: `curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook?drop_pending_updates=true"`
3. Restart the backend service
4. Verify only one `bot.launch()` call exists in the codebase

### Authentication Flow
1. User enters Telegram username → `POST /api/register`
2. Backend sends OTP to user via Telegram bot (valid 10 minutes)
3. User enters OTP → `POST /api/verify` (updates `Tg_ID`)
4. User completes GDPR & profile → `POST /api/consent` + `PUT /api/profile`
5. JWT-equivalent: Store `user` object in localStorage with `Tg_Username` and `Tg_ID`

### AI Integration

**Match Intros (Anthropic Claude Haiku):**
- Generates personalized "why you should meet" for each person
- Language detection based on shared languages
- Output: JSON with `shared_ground`, `for_member1`, `for_member2`
- Stored in Matches table as `Intro_1`, `Intro_2`, `Shared_Intro`

**Match Images (Google Gemini + Imagen):**
- Generates scene prompt via Gemini based on shared interests
- Creates background image via Imagen REST API
- Overlays user avatars using Sharp image processing library
- Stores as attachment in `Intro_Image` field

### File Upload System
- Multer middleware stores avatars in `/backend/uploads/`
- Filename format: `avatar-[timestamp]-[random].png`
- Files are served statically via Express on `/uploads/` path
- URLs stored in Airtable as attachment records with `url` field

### Telegram Bot Integration
- **Telegraf library** (`telegraf` npm package)
- Handles `/start` command (OTP generation)
- **Callback handlers** for inline button interactions:
  - `participate_yes/participate_no` - Weekly participation toggle
  - `fb_stat:matchId:role:status` - Midweek feedback status
  - `fb_rate:matchId:role:rating` - Rating feedback (1-4)
- Events logged to `auth.log` and `debug.log` in `/backend/logs/`

### Logging System
- **Custom logging functions**: `logAuth()`, `logDebug()`, `logMessage()`
- **Separate log files**: `auth.log`, `debug.log` in `/backend/logs/`
- **Event tracking**: Event_Logs table for member activation/deactivation
- **Admin endpoints**: `GET /api/admin/logs`, `GET /api/admin/logs/view`

**Script Logging (NEW):**
- **Persistent logs**: All scheduled script output automatically saved to `/backend/logs/scripts/`
- **Log format**: `[TIMESTAMP] [LEVEL] [PID] Message`
- **Metadata tracking**: Start time, duration, exit code, success/failure status
- **Admin UI**: View, search, paginate, and download script logs via Admin Health dashboard
- **API endpoints**:
  - `GET /api/admin/logs/scripts` - List all script logs
  - `GET /api/admin/logs/scripts/:name` - View log with pagination/search
  - `GET /api/admin/logs/scripts/:name/tail` - Get last N lines
  - `GET /api/admin/logs/scripts/:name/download` - Download log file
- **Log rotation**: `backend/utils/logRotation.js` handles size-based rotation (10MB) and cleanup (30-day retention)
- **Volume persistence**: Logs survive container rebuilds via `/opt/linking-coffee/logs` mount

### Performance Optimizations
- Parallel Promise.all() for Airtable queries in profile endpoint
- Batch operations: Creates/updates in 10-record batches
- Date filtering in queries to avoid scanning ancient history
- Rate limiting: 100ms delay between Telegram messages to avoid bot API limits
- Caching: Scheduler configs loaded once, reused until modified

### Error Handling
- Graceful failures: Non-fatal errors don't halt execution (e.g., failed avatar fetch)
- Try-catch blocks with logging for all Airtable operations
- Telegram API error handling with retry logic
- Admin notifications for critical failures (sent to `ADMIN_CHAT_ID`)

## Testing Approach

No formal test suite currently exists. Manual testing recommended for:
- User registration flow (Telegram username → OTP → verification)
- Profile update and autosave (Dashboard)
- Avatar upload functionality
- Telegram authentication
- GDPR consent flow
- Match generation algorithm (`match-users.js`)
- Notification delivery (`notify-matches.js`)
- Feedback collection workflow (midweek + weekend)

## Deployment Notes

### Production Deployment Script (`deploy-prod.sh`)
1. Auto-commits uncommitted changes with generated message
2. Pushes to origin main
3. Copies `docker-compose.prod.yml` to server as `docker-compose.yml`
4. SSHs to server (91.98.235.147), pulls latest code, rebuilds and restarts containers
5. Deployed site accessible at https://linked.coffee

### Docker Configuration
- Frontend runs on port 8080 (nginx serving React build)
- Backend runs on port 3001 (Express API)
- Logs persisted to `/opt/linking-coffee/logs` on host
- Environment variables loaded from `.env` file
- Health checks configured for backend service

**Frontend Build-Time Variables (CRITICAL):**
React apps require environment variables at **build time**, not runtime. Variables are embedded into the JavaScript bundle during `npm run build`. In Docker:
- Variables must be passed as `args` in `docker-compose.prod.yml` (not `environment`)
- The `frontend/Dockerfile` declares them as `ARG` and sets them as `ENV` before build
- Currently passed: `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_TELEGRAM_BOT_NAME`
- If adding new `REACT_APP_*` variables, update BOTH `frontend/Dockerfile` AND `docker-compose.prod.yml`

**Production Build Configuration:**
- `.env.production` disables webpack-dev-server WebSocket (prevents "ws://localhost:3000/ws" errors in production)
- Settings: `WDS_SOCKET_PORT=0` and `FAST_REFRESH=false`
- These only apply to production builds, not local development
