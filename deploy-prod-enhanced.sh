#!/bin/bash

# Production Deployment with Automated Testing and Rollback
# Usage: ./deploy-prod-enhanced.sh

set -e

SERVER_USER="root"
SERVER_IP="91.98.235.147"
SERVER_DIR="/opt/linking-coffee"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🚀 Starting production deployment (with smoke tests)..."

# 0. Safety Check: Verify Backend Dependencies
echo "🔍 Checking backend dependencies..."
cd backend
npx --yes depcheck
if [ $? -ne 0 ]; then
  echo "❌ Dependency check failed in backend/. Aborting deployment."
  echo "👉 Run 'cd backend && npx depcheck' to investigate."
  exit 1
fi
cd ..
echo "✅ Dependencies look good."

# 1. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "⚠️  You have uncommitted changes:"
  git status -s
  echo ""
  echo "🤖 Auto-committing changes..."

  git add .
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

# 3. Deploy to server with image preservation
echo "📡 Connecting to server ($SERVER_IP) to deploy..."
scp .env $SERVER_USER@$SERVER_IP:$SERVER_DIR/.env

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy configuration files to server."
  exit 1
fi

# Load environment variables for Telegram alerts
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -E 'BOT_TOKEN|ADMIN_CHAT_ID' | xargs)
fi

# SSH to server and execute deployment with rollback capability
ssh $SERVER_USER@$SERVER_IP << ENDSSH
  set -e
  cd $SERVER_DIR

  echo "🔍 Pulling latest code..."
  git checkout docker-compose.yml
  git pull
  cp linking-coffee.config.js backend/

  echo "📦 Preserving current images as :previous..."
  # Tag current :latest as :previous (for rollback)
  if docker images linking-coffee-backend:latest | grep -q latest; then
    docker tag linking-coffee-backend:latest linking-coffee-backend:previous
    docker tag linking-coffee-frontend:latest linking-coffee-frontend:previous
    echo "✅ Current images saved as :previous"
  else
    echo "⚠️  No existing images to preserve (first deployment)"
  fi

  # Create timestamped backup tags
  if docker images linking-coffee-backend:latest | grep -q latest; then
    docker tag linking-coffee-backend:latest linking-coffee-backend:v$TIMESTAMP
    docker tag linking-coffee-frontend:latest linking-coffee-frontend:v$TIMESTAMP
    echo "✅ Timestamped backup created: :v$TIMESTAMP"
  fi

  echo "🛠️  Building new images..."
  docker compose -f docker-compose.prod.yml build

  echo "🔄 Stopping old containers..."
  docker compose -f docker-compose.prod.yml down

  echo "🚀 Starting new containers..."
  docker compose -f docker-compose.prod.yml up -d

  echo "⏳ Waiting 10s for services to stabilize..."
  sleep 10
ENDSSH

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed on server."
  exit 1
fi

echo "✅ Deployment completed. Starting smoke tests..."

# 4. Run smoke tests on server
echo "🧪 Running smoke tests against production..."

ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
  cd /opt/linking-coffee/backend

  # Install test dependencies if not present
  if ! npm list jest > /dev/null 2>&1; then
    echo "📦 Installing test dependencies..."
    npm install --save-dev jest@29.7.0 jest-junit@16.0.0
  fi

  # Run tests with production environment
  API_URL="https://linked.coffee/api" \
  FRONTEND_URL="https://linked.coffee" \
  npm test -- --testPathPattern=smoke

  echo $? > /tmp/test_exit_code
ENDSSH

# Get test exit code from server
TEST_EXIT_CODE=$(ssh $SERVER_USER@$SERVER_IP "cat /tmp/test_exit_code 2>/dev/null || echo 1")

if [ "$TEST_EXIT_CODE" -eq 0 ]; then
  echo "✅ All smoke tests passed!"
  echo "🌍 Deployment successful! Check the site at https://linked.coffee"

  # Send success alert to admin
  if [ -n "$ADMIN_CHAT_ID" ] && [ -n "$BOT_TOKEN" ]; then
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d "chat_id=$ADMIN_CHAT_ID" \
      -d "text=✅ *Deployment Successful*%0A%0ATimestamp: $TIMESTAMP%0ATests: PASSED%0ASite: https://linked.coffee" \
      -d "parse_mode=Markdown" > /dev/null 2>&1 || true
  fi

  exit 0
else
  echo "❌ Smoke tests FAILED! Initiating rollback..."

  # Send failure alert to admin
  if [ -n "$ADMIN_CHAT_ID" ] && [ -n "$BOT_TOKEN" ]; then
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d "chat_id=$ADMIN_CHAT_ID" \
      -d "text=🚨 *Deployment Failed - Rollback Initiated*%0A%0ATimestamp: $TIMESTAMP%0ATests: FAILED%0ARolling back to previous version..." \
      -d "parse_mode=Markdown" > /dev/null 2>&1 || true
  fi

  # Execute rollback
  echo "🔄 Executing rollback script..."
  ./scripts/rollback-deployment.sh SERVER

  if [ $? -eq 0 ]; then
    echo "✅ Rollback successful. Previous version restored."

    # Send rollback success alert
    if [ -n "$ADMIN_CHAT_ID" ] && [ -n "$BOT_TOKEN" ]; then
      curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
        -d "chat_id=$ADMIN_CHAT_ID" \
        -d "text=✅ *Rollback Complete*%0A%0APrevious version restored successfully.%0ASite: https://linked.coffee" \
        -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi

    exit 1
  else
    echo "❌ CRITICAL: Rollback failed! Manual intervention required."

    # Send critical alert
    if [ -n "$ADMIN_CHAT_ID" ] && [ -n "$BOT_TOKEN" ]; then
      curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
        -d "chat_id=$ADMIN_CHAT_ID" \
        -d "text=🚨🚨 *CRITICAL: Rollback Failed*%0A%0AManual intervention required!%0ACheck server logs immediately." \
        -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi

    exit 2
  fi
fi
