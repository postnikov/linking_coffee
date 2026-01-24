#!/bin/bash

# Rollback to previous Docker images
# Usage: ./scripts/rollback-deployment.sh [SERVER|LOCAL]

set -e

MODE="${1:-SERVER}"  # SERVER or LOCAL
SERVER_USER="root"
SERVER_IP="91.98.235.147"
SERVER_DIR="/opt/linking-coffee"

echo "🔄 Initiating rollback to previous images..."

if [ "$MODE" == "SERVER" ]; then
  echo "📡 Rolling back on production server..."

  ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/linking-coffee

    # Check if previous images exist
    if ! docker images linking-coffee-backend:previous | grep -q previous; then
      echo "❌ No previous backend image found. Cannot rollback."
      exit 1
    fi

    if ! docker images linking-coffee-frontend:previous | grep -q previous; then
      echo "❌ No previous frontend image found. Cannot rollback."
      exit 1
    fi

    echo "✅ Previous images found. Proceeding with rollback..."

    # Stop current containers
    docker compose -f docker-compose.prod.yml down

    # Re-tag previous as latest
    docker tag linking-coffee-backend:previous linking-coffee-backend:latest
    docker tag linking-coffee-frontend:previous linking-coffee-frontend:latest

    # Start containers with previous images
    docker compose -f docker-compose.prod.yml up -d --no-build

    # Verify health
    sleep 5
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
      echo "✅ Rollback successful! Backend is healthy."
    else
      echo "⚠️  Rollback completed but health check failed."
      exit 1
    fi
ENDSSH

  if [ $? -eq 0 ]; then
    echo "✅ Server rollback completed successfully!"
    echo "🌍 Check the site at https://linked.coffee"
  else
    echo "❌ Rollback failed on server."
    exit 1
  fi

else
  # Local rollback
  echo "🏠 Rolling back locally..."

  cd "$(dirname "$0")/.."

  # Check for previous images
  if ! docker images linking-coffee-backend:previous | grep -q previous; then
    echo "❌ No previous backend image found."
    exit 1
  fi

  if ! docker images linking-coffee-frontend:previous | grep -q previous; then
    echo "❌ No previous frontend image found."
    exit 1
  fi

  docker compose -f docker-compose.prod.yml down
  docker tag linking-coffee-backend:previous linking-coffee-backend:latest
  docker tag linking-coffee-frontend:previous linking-coffee-frontend:latest
  docker compose -f docker-compose.prod.yml up -d --no-build

  echo "✅ Local rollback completed!"
fi
