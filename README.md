# Linked.Coffee 🔗☕

**Expand your world. One conversation at a time.**

Linked.Coffee is a web service built on Random Coffee mechanics that connects people for meaningful conversations through Telegram.

## 🌟 Features

- **Random Matching**: Get matched with new people every week
- **Telegram Integration**: All communications happen through Telegram
- **Early Bird Program**: Join now for exclusive benefits
- **Simple & Elegant**: Beautiful landing page with easy registration

## 🏗️ Tech Stack

- **Database**: Airtable
- **Backend**: Node.js + Express
- **Frontend**: React (Linked.Coffee)
- **Bot**: Telegram Bot API
- **Deployment**: Docker

## 📦 Project Structure

```
Linking_Coffee/
├── backend/          # Node.js Express API
│   ├── server.js     # Main server file
│   ├── package.json
│   └── Dockerfile
├── frontend/         # React application
│   ├── src/
│   │   ├── App.js    # Main component
│   │   ├── App.css   # Component styles
│   │   ├── index.js
│   │   └── index.css # Global styles
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docs/             # Documentation
│   ├── airtable.md   # Airtable credentials
│   ├── bot.md        # Bot tokens
│   └── database.md   # Database schema
├── assets/           # Static assets
│   └── Linking Coffee.png
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker & Docker Compose (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Linked.Coffee
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start the backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```

5. **Access the application**
   - Frontend: http://localhost:3000 (Linked.Coffee)
   - Backend API: http://localhost:3001 (Linked.Coffee API)

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker compose up -d
   ```

2. **Access the application**
   - Application: http://localhost:8080

3. **View logs**
   ```bash
   docker compose logs -f
   ```

4. **Stop the application**
   ```bash
   docker compose down
   ```

## 🗃️ Database Schema

### Members Table (tblCrnbDupkzWUx9P)

- **Num**: Autonumber (Primary field)
- **Tg_Username**: Single line text
- **Tg_ID**: Number
- **Name**: Single line text
- **Family**: Single line text
- **Status**: Single select (Visitor, Starter, Premium, Admin, EarlyBird)
- **Languages**: Multiple select
- **Created_At**: Date
- **Last_Seen**: Date
- **Notes**: Long text

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Register User
```
POST /api/register
Body: {
  "telegramUsername": "string"
}
```

## 🎨 Design Features

- Modern gradient backgrounds
- Glassmorphism effects
- Smooth animations and transitions
- Fully responsive design
- Clean and intuitive UI

## 🔐 Environment Variables

See `.env.example` for all required environment variables:

- `AIRTABLE_API_KEY`: Your Airtable API key
- `AIRTABLE_BASE_ID`: Your Airtable base ID
- `AIRTABLE_MEMBERS_TABLE`: Members table ID
- `BOT_TOKEN`: Telegram bot token
- `ADMIN_BOT_TOKEN`: Admin bot token
- `ADMIN_CHAT_ID`: Admin chat ID
- `PORT`: Backend server port (default: 3001)

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. Contact the maintainers for contribution guidelines.

---

Built with ❤️ for meaningful connections
