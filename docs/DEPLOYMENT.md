# Deployment Guide

server: root@91.98.235.147

## Current Server Setup
The production server is running **Traefik** as the main reverse proxy.
- **Network**: All public-facing containers must be connected to the `traefik-public` Docker network.
- **Routing**: Routing is handled via Docker labels on the services (see `docker-compose.yml`).
- **SSL**: Traefik handles SSL certificates automatically.
- **Ports**: The application containers do NOT expose ports directly to the host (except Backend for internal health checks if needed, but Frontend is purely internal to Docker network).

## Docker Deployment

### Prerequisites
- Docker installed
- Docker Compose installed
- `.env` file configured with production credentials

### Steps

1. **Prepare environment variables**
   ```bash
   # Make sure .env file exists with all required variables
   cp .env.example .env
   # Edit .env with your production credentials
   ```

2. **Build and start containers**
   ```bash
   docker-compose up -d
   ```

3. **Check status**
   ```bash
   docker-compose ps
   ```

4. **View logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

5. **Stop containers**
   ```bash
   docker-compose down
   ```

6. **Rebuild after changes**
   ```bash
   docker-compose up -d --build
   ```

### Health Checks

- Frontend: http://your-domain/
- Backend health: http://your-domain/api/health

### Troubleshooting

**Containers won't start:**
```bash
# Check logs
docker-compose logs

# Remove old containers and rebuild
docker-compose down
docker-compose up -d --build
```

**Port conflicts:**
```bash
# Change ports in docker-compose.yml
# Frontend: "8080:80" instead of "80:80"
# Backend: "3002:3001" instead of "3001:3001"
```

**Environment variables not loading:**
- Ensure `.env` file is in the root directory
- Check variable names match exactly
- Restart containers: `docker-compose restart`

## Production Deployment (VPS/Cloud)

### Option 1: Docker on VPS

1. **SSH into your server**
   ```bash
   ssh user@your-server-ip
   ```

2. **Install Docker and Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **Clone repository**
   ```bash
   git clone <your-repo-url>
   cd Linking_Coffee
   ```

4. **Configure environment**
   ```bash
   nano .env
   # Add your production credentials
   ```

5. **Start application**
   ```bash
   docker-compose up -d
   ```

6. **Traefik Configuration**
   The server uses Traefik as a reverse proxy. The `docker-compose.yml` is already configured with the necessary labels:
   - `traefik.enable=true`
   - Host rules for `linkingcoffee.com` and `www.linkingcoffee.com`
   - Connection to `traefik-public` external network

   Ensure the `traefik-public` network exists on the server (it should already be there).

### Option 2: Separate Deployment

**Backend (Node.js):**
```bash
cd backend
npm ci --only=production
NODE_ENV=production node server.js
```

**Frontend (Static hosting):**
```bash
cd frontend
npm ci
npm run build
# Deploy /build folder to hosting service
# (Netlify, Vercel, AWS S3, etc.)
```

## Environment Variables

Required variables for production:

```env
# Airtable
AIRTABLE_API_KEY=your_production_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_MEMBERS_TABLE=tblCrnbDupkzWUx9P

# Telegram
BOT_TOKEN=your_production_bot_token
ADMIN_BOT_TOKEN=your_admin_bot_token
ADMIN_CHAT_ID=your_admin_chat_id

# Server
PORT=3001
NODE_ENV=production
```

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set strong environment variables
- [ ] Enable firewall (ufw on Ubuntu)
- [ ] Regularly update Docker images
- [ ] Set up monitoring and logging
- [ ] Configure CORS properly for your domain
- [ ] Use secrets management for sensitive data
- [ ] Set up automated backups for Airtable

## Monitoring

**Check application health:**
```bash
curl http://localhost:3001/api/health
```

**Monitor logs:**
```bash
docker-compose logs -f --tail=100
```

**Resource usage:**
```bash
docker stats
```

## Backup

**Export Docker volumes:**
```bash
docker-compose down
docker run --rm -v linking-coffee_data:/data -v $(pwd):/backup ubuntu tar czf /backup/backup.tar.gz /data
docker-compose up -d
```

## Updates

**Update application:**
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

## Rollback

**Revert to previous version:**
```bash
git log --oneline  # Find commit hash
git checkout <commit-hash>
docker-compose down
docker-compose up -d --build
```
