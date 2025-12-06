# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linked.Coffee is a web service that connects people for meaningful conversations through Telegram using Random Coffee mechanics. It consists of a React frontend, Node.js/Express backend, and Airtable database integration.

## Essential Commands

### Development
```bash
# Start both frontend and backend servers
./start-dev.sh
# Frontend runs on http://localhost:3002
# Backend runs on http://localhost:3001

# Run backend only
cd backend && npm run dev

# Run frontend only  
cd frontend && npm start

# Update database schema documentation
cd backend && npm run update-schema
```

### Docker Deployment
```bash
# Deploy with Docker Compose
docker compose up -d

# Production deployment
./deploy-prod.sh

# View logs
docker compose logs -f
```

## Architecture & Key Components

### Backend (`/backend/server.js`)
The Express server handles all API endpoints and integrates with Airtable and Telegram:

**Core API Endpoints:**
- `POST /api/register` - New user registration with Telegram username
- `POST /api/verify` - Telegram authentication verification  
- `POST /api/consent` - GDPR consent handling
- `GET /api/profile` - Retrieve user profile
- `PUT /api/profile` - Update user profile with autosave support
- `POST /api/upload-avatar` - Avatar upload with multer
- `GET /api/countries` - Fetch approved countries list
- `GET/POST /api/cities` - Cities management
- `GET /api/interests` - Professional and personal interests

**Key Features:**
- Airtable integration for all data storage (Members, Countries, Cities, Matches tables)
- Telegram Bot authentication using crypto.createHash for signature verification
- Multer for file uploads to `/backend/uploads/`
- CORS enabled for frontend communication
- Environment-based configuration via dotenv

### Frontend (`/frontend/src/`)
React application with internationalization and routing:

**Main Components:**
- `App.js` - Root component with router setup and auth state management
- `pages/Dashboard.js` - User profile management with autosave functionality
- `pages/Home.js` - Landing page with Telegram login
- `pages/PublicProfile.js` - Public profile view
- `components/GdprModal.js` - GDPR consent flow
- `components/TelegramLoginButton.js` - Telegram OAuth widget integration

**Key Features:**
- React Router for navigation
- i18next for internationalization (English/Russian)
- Local storage for auth persistence
- Responsive design with custom CSS
- Autosave on field blur for profile updates

### Database Schema (Airtable)

**Members Table (`tblCrnbDupkzWUx9P`)**
- Primary key: `Num` (autonumber)
- Core fields: `Tg_ID`, `Tg_Username`, `Name`, `Family`, `Status`
- Profile: `Avatar`, `Profession`, `Grade`, `Professional_Description`, `Personal_Description`
- Interests: `Professional_Interests`, `Personal_Interests` (multiple selects)
- Matching: `Current_Week_Status`, `Next_Week_Status`, `Serendipity`, `Proximity`
- Location: `Countries`, `City_Link`, `Time_Zone`

**Status Values:** Free, PRO, Premium, Admin, EarlyBird

**Countries Table (`tblTDQuqGDEDTPMLO`)**
- ISO codes with multilingual names

**Cities Table (`tbllGzaGTz3PsxxWT`)**
- City slugs with approval status

**Matches Table (`tblx2OEN5sSR1xFI2`)**
- Weekly match records with feedback tracking

## Environment Configuration

Required environment variables in `.env`:
```
AIRTABLE_API_KEY=         # Airtable Personal Access Token
AIRTABLE_BASE_ID=         # Base ID 
AIRTABLE_MEMBERS_TABLE=   # Members table ID (tblCrnbDupkzWUx9P)
BOT_TOKEN=                # Telegram bot token for notifications
ADMIN_BOT_TOKEN=          # Admin bot token
ADMIN_CHAT_ID=            # Admin notifications chat
PORT=3001                 # Backend port
```

## Important Implementation Details

1. **Telegram Authentication**: The backend verifies Telegram login data using HMAC-SHA256 with the bot token as key

2. **Autosave Logic**: Dashboard implements debounced autosave on blur for text fields and immediate save for multi-select changes

3. **GDPR Compliance**: Users must accept terms before profile completion, tracked via `Consent_GDPR` field

4. **File Uploads**: Avatar images stored locally in `/backend/uploads/` with timestamp-based naming

5. **Interest Categories**: Predefined lists in `/docs/interests.json` for professional and personal interests

6. **Weekly Matching**: Status fields track member availability for current and next week matching cycles

## Testing Approach

No formal test suite currently exists. Manual testing recommended for:
- User registration flow
- Profile update and autosave
- Avatar upload functionality  
- Telegram authentication
- GDPR consent flow