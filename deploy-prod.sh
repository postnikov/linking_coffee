#!/bin/bash

# Fast Deployment Script for Linked.Coffee
# Usage: ./deploy-prod.sh

SERVER_USER="root"
SERVER_IP="91.98.235.147"
SERVER_DIR="/opt/linking-coffee"

echo "🚀 Starting production deployment..."

# 1. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "⚠️  You have uncommitted changes:"
  git status -s
  echo ""
  echo "🤖 Auto-committing changes..."
  
  # Stage all changes
  git add .
  
  # Generate message based on staged files
  CHANGED_FILES=$(git diff --cached --name-only | head -n 3 | paste -sd ", " -)
  TOTAL_FILES=$(git diff --cached --name-only | wc -l | tr -d ' ')
  
  if [ "$TOTAL_FILES" -gt "3" ]; then
      MORE=$((TOTAL_FILES - 3))
      COMMIT_MSG="Auto-deploy: $CHANGED_FILES (and $MORE others)"
  else
      COMMIT_MSG="Auto-deploy: $CHANGED_FILES"
  fi
  
  echo "📝 Generated Message: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
fi

# 2. Push to remote
echo "📤 Pushing to origin main..."
git push origin main

if [ $? -ne 0 ]; then
  echo "❌ Git push failed. Please check your connection and try again."
  exit 1
fi

# 3. Trigger deployment on server
# 3. Copy production docker-compose file and trigger deployment
echo "📡 Connecting to server ($SERVER_IP) to deploy..."
scp docker-compose.prod.yml $SERVER_USER@$SERVER_IP:$SERVER_DIR/docker-compose.yml

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy docker-compose.prod.yml to server."
  exit 1
fi

ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && git pull && cp linking-coffee.config.js backend/ && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build"

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    echo "🌍 Check the site at https://linked.coffee"
else
    echo "❌ Deployment failed on server."
    exit 1
fi
