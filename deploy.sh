#!/bin/bash

# Deployment script for Linked.Coffee

# Directory where the project is located on the server
PROJECT_DIR="/opt/linking-coffee"

# Ensure we are in the correct directory
if [ -d "$PROJECT_DIR" ]; then
  cd "$PROJECT_DIR"
else
  echo "Error: Directory $PROJECT_DIR does not exist."
  echo "Please clone the repository to $PROJECT_DIR first."
  exit 1
fi

echo "🚀 Starting deployment for Linked.Coffee..."

# 1. Pull the latest changes from git
echo "📥 Pulling latest changes..."
git pull origin main

# 2. Rebuild and restart containers
echo "🔄 Rebuilding and restarting containers..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# 3. Check status
echo "✅ Deployment complete! Checking status..."
docker ps | grep linking-coffee

echo "📜 Logs (last 20 lines):"
docker logs linking-coffee-backend --tail 20

echo "🌍 Site should be live at https://linked.coffee"
