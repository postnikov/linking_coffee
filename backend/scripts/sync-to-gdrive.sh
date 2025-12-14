#!/bin/bash

# Sync Airtable Backups to Google Drive
#
# Usage:
#   ./sync-to-gdrive.sh [--dry-run]

# Resolve script directory to locate .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="$ROOT_DIR/.env"

# Load .env variables
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Configuration with defaults
BACKUP_DIR="${BACKUP_DIR:-/backups/airtable}"
GDRIVE_RETENTION_DAYS="${GDRIVE_RETENTION_DAYS:-30}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive:Backups/LinkedCoffee}"
LOG_FILE="/var/log/airtable-backup.log"

timestamp() {
    date +"[%Y-%m-%d %H:%M:%S]"
}

log() {
    echo "$(timestamp) $1"
}

# Check for dry-run flag
DRY_RUN_FLAG=""
if [[ "$*" == *"--dry-run"* ]]; then
    DRY_RUN_FLAG="--dry-run"
    log "INFO: DRY RUN MODE - no changes will be made"
fi

log "INFO: Starting Google Drive sync..."

# check if rclone is installed
if ! command -v rclone &> /dev/null; then
    log "ERROR: rclone is not installed"
    exit 1
fi

# 1. Copy local backups to Google Drive
# We use copy instead of sync because local retention (7 days) < remote retention (30 days)
log "INFO: Copying files from $BACKUP_DIR to $GDRIVE_REMOTE"
rclone copy "$BACKUP_DIR" "$GDRIVE_REMOTE" $DRY_RUN_FLAG --verbose 2>&1 | while read line; do log "RCLONE: $line"; done

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log "ERROR: rclone copy failed"
    exit 1
fi

# 2. Cleanup old files on Google Drive
log "INFO: Cleaning up files older than $GDRIVE_RETENTION_DAYS days on remote"
rclone delete "$GDRIVE_REMOTE/daily" --min-age "${GDRIVE_RETENTION_DAYS}d" $DRY_RUN_FLAG --verbose 2>&1 | while read line; do log "RCLONE: $line"; done

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log "WARN: rclone delete failed"
    # Don't exit with error, as copy might have succeeded
fi

log "INFO: Sync completed"
