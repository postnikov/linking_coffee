#!/bin/bash

# Clean up Docker images older than 7 days (keep last 5 versions)

echo "🧹 Cleaning up old Docker images..."

# Remove untagged images
docker image prune -f

# Remove timestamped images older than 7 days (keep last 5)
docker images linking-coffee-backend --format "{{.Tag}}" | grep '^v' | sort -r | tail -n +6 | while read tag; do
  echo "Removing linking-coffee-backend:$tag"
  docker rmi linking-coffee-backend:$tag 2>/dev/null || true
done

docker images linking-coffee-frontend --format "{{.Tag}}" | grep '^v' | sort -r | tail -n +6 | while read tag; do
  echo "Removing linking-coffee-frontend:$tag"
  docker rmi linking-coffee-frontend:$tag 2>/dev/null || true
done

# Remove dangling build cache
docker builder prune -f 2>/dev/null || true

echo "✅ Cleanup complete."
echo "📊 Disk usage after cleanup:"
df -h / | tail -1
