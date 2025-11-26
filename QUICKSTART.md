# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies

Run the setup script:
```bash
./setup.sh
```

This will install all required dependencies for both frontend and backend.

### Step 2: Start the Application

**Option A: Development Mode (Recommended for testing)**

Run both servers simultaneously:
```bash
./start-dev.sh
```

OR run them separately:

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

**Option B: Production Mode (Docker)**

```bash
docker compose up -d
```

### Step 3: Open Your Browser

- **Development**: http://localhost:3000
- **Production (Docker)**: http://localhost:8080

---

## 📋 Testing the Application

1. Open the landing page in your browser
2. Enter a Telegram username (e.g., "john_doe")
3. Click "Join the Waitlist"
4. You should see a success message
5. Check your Airtable Members table to confirm the entry

---

## 🛠️ Troubleshooting

### Port Already in Use

If you see "Port already in use" errors:

```bash
# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9
```

### Dependencies Not Installing

```bash
# Clear npm cache
npm cache clean --force

# Try installing again
cd backend && npm install
cd ../frontend && npm install
```

### Docker Issues

```bash
# Stop all containers
docker-compose down

# Remove old images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose up -d --build
```

---

## 📝 Environment Check

Make sure your `.env` file exists and has all required variables:

```bash
# Check if .env exists
ls -la .env

# View contents (be careful with sensitive data)
cat .env
```

Required variables:
- AIRTABLE_API_KEY
- AIRTABLE_BASE_ID
- AIRTABLE_MEMBERS_TABLE
- BOT_TOKEN
- ADMIN_BOT_TOKEN
- ADMIN_CHAT_ID
- PORT
- NODE_ENV

---

## ✅ Success Checklist

- [ ] Dependencies installed successfully
- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 3000
- [ ] Landing page loads without errors
- [ ] Form accepts Telegram usernames
- [ ] Submissions create records in Airtable
- [ ] Success/error messages display correctly

---

## 🎯 Next Steps

After setup is complete:

1. **Test the pre-registration flow**
   - Register with different usernames
   - Try registering the same username twice (should get error)
   - Check Airtable for new entries

2. **Customize the design**
   - Edit `frontend/src/App.css` for styling changes
   - Update `frontend/src/App.js` for content changes

3. **Deploy to production**
   - See `docs/DEPLOYMENT.md` for detailed instructions

4. **Implement Telegram bot**
   - Use bot tokens from `docs/bot.md`
   - Create bot handlers for user interactions

---

## 📚 More Information

- Full documentation: `README.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- Project overview: `docs/PROJECT_OVERVIEW.md`
- Database schema: `docs/database.md`

---

**Need help?** Check the troubleshooting section or review the logs:
```bash
# Backend logs (if running with npm)
cd backend && npm run dev

# Frontend logs (if running with npm)
cd frontend && npm start

# Docker logs
docker-compose logs -f
```
