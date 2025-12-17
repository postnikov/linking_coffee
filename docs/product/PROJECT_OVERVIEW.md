# Linking Coffee - Project Overview

## 📋 What We Built

A complete web application for **Linking Coffee** - a Random Coffee matching service with:

### ✨ Features Implemented

1. **Elegant Landing Page**
   - Modern gradient backgrounds with animated elements
   - Glassmorphism design effects
   - Fully responsive layout
   - Smooth animations and micro-interactions
   - Professional typography using Inter font

2. **Pre-Registration Form**
   - Telegram username input with validation
   - Real-time form validation
   - Success/error messaging
   - Loading states
   - Duplicate prevention

3. **Backend API**
   - Express.js server
   - Airtable integration
   - RESTful API endpoints
   - Input validation and sanitization
   - Error handling
   - Health check endpoint

4. **Database Integration**
   - Automatic user creation in Airtable
   - EarlyBird status assignment
   - Duplicate detection
   - Timestamp tracking

5. **Docker Setup**
   - Multi-container setup (frontend + backend)
   - Production-ready Dockerfiles
   - Docker Compose orchestration
   - Health checks
   - Nginx reverse proxy

6. **Development Tools**
   - Setup script for easy installation
   - Dev server startup script
   - Git repository initialized
   - Comprehensive documentation

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│          User's Browser                 │
│  (React App - Port 3000/80)            │
└─────────────┬───────────────────────────┘
              │
              │ HTTP Requests
              ▼
┌─────────────────────────────────────────┐
│      Express Backend API                │
│        (Port 3001)                      │
└─────────────┬───────────────────────────┘
              │
              │ Airtable API
              ▼
┌─────────────────────────────────────────┐
│         Airtable Database               │
│  Table: Members (tblCrnbDupkzWUx9P)    │
└─────────────────────────────────────────┘
```

## 📁 File Structure

```
Linking_Coffee/
├── backend/                    # Node.js API Server
│   ├── server.js              # Main Express server
│   ├── package.json           # Backend dependencies
│   └── Dockerfile             # Backend container config
│
├── frontend/                   # React Application
│   ├── src/
│   │   ├── App.js            # Main landing page component
│   │   ├── App.css           # Component-specific styles
│   │   ├── index.js          # React entry point
│   │   └── index.css         # Global design system
│   ├── public/
│   │   ├── index.html        # HTML template
│   │   └── logo.png          # Logo file
│   ├── package.json          # Frontend dependencies
│   ├── Dockerfile            # Frontend container config
│   └── nginx.conf            # Nginx reverse proxy config
│
├── docs/                       # Documentation
│   ├── airtable.md           # Airtable credentials
│   ├── bot.md                # Telegram bot tokens
│   ├── database.md           # Database schema
│   └── DEPLOYMENT.md         # Deployment guide
│
├── assets/                     # Static assets
│   └── Linking Coffee.png    # Original logo
│
├── docker-compose.yml          # Docker orchestration
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── README.md                  # Main documentation
├── setup.sh                   # Setup script
└── start-dev.sh               # Development server script
```

## 🎨 Design System

### Color Palette
- **Primary Gradient**: Purple to violet (#667eea → #764ba2)
- **Accent Gradient**: Pink to red (#f093fb → #f5576c)
- **Neutrals**: Gray scale for text and backgrounds

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 300 (Light), 400 (Regular), 600 (Semibold), 800 (Extra Bold)

### Effects
- Glassmorphism backgrounds
- Smooth transitions (0.3s ease)
- Hover animations
- Floating background circles
- Gradient text effects

## 🔌 API Endpoints

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "Linking Coffee API is running"
}
```

### POST /api/register
Register a new user for early bird access

**Request:**
```json
{
  "telegramUsername": "john_doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully registered! Welcome to Linking Coffee 🎉",
  "data": {
    "username": "john_doe",
    "status": "EarlyBird"
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing or invalid username
- **409 Conflict**: Username already registered
- **500 Internal Server Error**: Server/database error

## 🗄️ Database Schema

### Members Table Fields

| Field Name   | Type           | Description                    |
|-------------|----------------|--------------------------------|
| Num         | Autonumber     | Primary key                    |
| Tg_Username | Single line    | Telegram username              |
| Tg_ID       | Number         | Telegram user ID               |
| Name        | Single line    | User's first name              |
| Family      | Single line    | User's last name               |
| Status      | Single select  | EarlyBird/Visitor/Starter/Premium/Admin |
| Languages   | Multiple select| User's languages               |
| Created_At  | Date           | Registration timestamp         |
| Last_Seen   | Date           | Last activity timestamp        |
| Notes       | Long text      | Additional notes               |

### Status Types
1. **EarlyBird**: Pre-launch registrations (current implementation)
2. **Visitor**: Free tier users
3. **Starter**: Basic paid tier
4. **Premium**: Premium paid tier
5. **Admin**: Administrative users

## 🚀 Getting Started

### Quick Start (Development)

1. **Install dependencies:**
   ```bash
   ./setup.sh
   ```

2. **Start development servers:**
   ```bash
   ./start-dev.sh
   ```

3. **Access the app:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Quick Start (Production)

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production credentials
   ```

2. **Start with Docker:**
   ```bash
   docker-compose up -d
   ```

3. **Access the app:**
   - Application: http://localhost

## 📝 Environment Variables

All environment variables are configured in `.env`:

```env
# Airtable Configuration
AIRTABLE_API_KEY=          # Your Airtable PAT token
AIRTABLE_BASE_ID=          # Base ID (appA0Vaq5r5436SGp)
AIRTABLE_MEMBERS_TABLE=    # Table ID (tblCrnbDupkzWUx9P)

# Telegram Bot Configuration
BOT_TOKEN=                 # Main bot token
ADMIN_BOT_TOKEN=           # Admin bot token
ADMIN_CHAT_ID=             # Admin chat ID

# Server Configuration
PORT=3001                  # Backend server port
NODE_ENV=development       # Environment (development/production)
```

## 🔐 Security Features

- Input validation and sanitization
- Environment variable protection
- CORS configuration
- Security headers in Nginx
- No sensitive data in Git
- Docker secrets support

## 📱 Responsive Design

- **Desktop**: Full two-column layout
- **Tablet** (< 968px): Single column, centered layout
- **Mobile** (< 640px): Optimized spacing and typography

## 🎯 User Flow

1. User visits landing page
2. Reads about Linking Coffee
3. Enters Telegram username in form
4. Clicks "Join the Waitlist"
5. Backend validates username
6. Checks for duplicates in Airtable
7. Creates new record with EarlyBird status
8. Shows success message to user
9. User receives confirmation

## 🔄 Next Steps

### Phase 2: Telegram Bot
- Implement bot authentication
- Welcome messages for EarlyBird users
- Profile completion flow
- Language selection

### Phase 3: Matching System
- Weekly matching algorithm
- Notification system
- Match history tracking

### Phase 4: Premium Features
- Status upgrades (Starter, Premium)
- Advanced matching preferences
- Analytics dashboard

## 📚 Additional Resources

- **Setup Guide**: `README.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **Database Schema**: `docs/database.md`
- **API Credentials**: `docs/airtable.md`, `docs/bot.md`

## 🛠️ Tech Stack Summary

| Layer        | Technology      | Purpose                    |
|-------------|-----------------|----------------------------|
| Frontend    | React 18        | User interface             |
| Styling     | CSS3            | Modern design system       |
| Backend     | Node.js + Express | API server              |
| Database    | Airtable        | Data storage               |
| Bot         | Telegram Bot API | Communication platform    |
| Deployment  | Docker          | Containerization           |
| Proxy       | Nginx           | Reverse proxy              |
| Version Control | Git         | Source control             |

## ✅ What's Ready

- ✅ Elegant landing page
- ✅ Pre-registration form
- ✅ Backend API with Airtable integration
- ✅ Docker deployment setup
- ✅ Git repository
- ✅ Development scripts
- ✅ Comprehensive documentation
- ✅ Responsive design
- ✅ Error handling
- ✅ Loading states

## 🎨 Design Highlights

- **Modern Aesthetics**: Vibrant gradients and glassmorphism
- **Smooth Animations**: Fade-in, slide-in, hover effects
- **Interactive Elements**: Buttons, inputs with micro-interactions
- **Professional Typography**: Clean, readable Inter font
- **Visual Hierarchy**: Clear information structure
- **Brand Consistency**: Logo integration and color scheme

---

**Built with ❤️ for meaningful connections**
