# Backend Scripts

This directory contains various utility scripts for the Linked Coffee backend.

## 1. Database Schema Documentation

**Script:** `update-schema-docs.js`

Automatically fetches the current Airtable database schema and generates documentation.

**Usage:**

```bash
npm run update-schema
# OR
node backend/scripts/update-schema-docs.js
```

**Output:** `docs/DATABASE_SCHEMA.md`

## 2. Airtable Backup

**Script:** `backup-airtable.js`

Fetches all data from Airtable, saves it as a gzipped JSON file, updates `latest.json`, and manages local retention on the VPS.

**Usage (Docker):**

```bash
docker exec linking-coffee-backend node scripts/backup-airtable.js
```

## 3. Google Drive Sync

**Script:** `sync-to-gdrive.sh`

Syncs the local backup directory to Google Drive using `rclone`.

**Usage (Docker):**

```bash
docker exec linking-coffee-backend scripts/sync-to-gdrive.sh
```

---

## Setup for Backups (Docker environment)

1.  **Preparation (Host)**:
    Ensure `rclone` is installed on the host to generate the config file:

    ```bash
    curl https://rclone.org/install.sh | sudo bash
    rclone config
    # Follow prompts to set up 'gdrive' remote
    ```

2.  **Directories**:
    Create the backup directory on the host:

    ```bash
    sudo mkdir -p /backups/airtable
    sudo chown -R 1000:1000 /backups/airtable
    ```

3.  **Deployment**:
    Deploy the updated `Dockerfile` and `docker-compose.prod.yml`.
    This ensures `rclone` is installed in the container and volumes are mounted.

4.  **Cron Jobs (Host)**:
    Add to `/etc/crontab` or `crontab -e`:

    ```cron
    # Backup at 03:00 UTC
    0 3 * * * root docker exec linking-coffee-backend node scripts/backup-airtable.js >> /var/log/airtable-backup.log 2>&1

    # Sync at 03:30 UTC
    30 3 * * * root docker exec linking-coffee-backend scripts/sync-to-gdrive.sh >> /var/log/airtable-backup.log 2>&1
    ```
