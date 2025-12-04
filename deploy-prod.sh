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
  read -p "Do you want to commit and push these changes? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      echo "❌ Commit message cannot be empty."
      exit 1
    fi
    git add .
    git commit -m "$COMMIT_MSG"
  else
    echo "❌ Deployment aborted. Please commit or stash your changes first."
    exit 1
  fi
fi

# 2. Push to remote
echo "📤 Pushing to origin main..."
git push origin main

if [ $? -ne 0 ]; then
  echo "❌ Git push failed. Please check your connection and try again."
  exit 1
fi

# 3. Trigger deployment on server
echo "📡 Connecting to server ($SERVER_IP) to deploy..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && ./deploy.sh"

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    echo "🌍 Check the site at https://linked.coffee"
else
    echo "❌ Deployment failed on server."
    exit 1
fi
