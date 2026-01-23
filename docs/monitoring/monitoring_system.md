# Telegram-Based Monitoring System Documentation

**Version:** 1.0
**Last Updated:** January 23, 2026
**Author:** Claude Code Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Components](#components)
4. [Alert Types](#alert-types)
5. [Configuration](#configuration)
6. [Testing Guide](#testing-guide)
7. [Deployment Guide](#deployment-guide)
8. [Maintenance & Operations](#maintenance--operations)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The Linking Coffee monitoring system is a **zero-cost, self-hosted Telegram-based alerting solution** that provides:

- ✅ **Immediate critical alerts** for script failures and server issues
- ✅ **Daily summary digest** at 9am UTC with warnings and metrics
- ✅ **Server health monitoring** every 5 minutes
- ✅ **Persistent failure tracking** across restarts
- ✅ **Low overhead** (<10MB memory, negligible CPU)

### Key Features

- **100% Free**: Uses existing Telegram bot, no paid services
- **Server-Based**: No external dependencies for core functionality
- **Rate-Limited**: Prevents Telegram API spam (100ms delay between messages)
- **State Persistence**: Tracks consecutive failures across server restarts
- **Easy Toggle**: Single environment variable to enable/disable

### What Gets Monitored

| Component | Check Frequency | Alert Type |
|-----------|----------------|------------|
| Script Failures | On execution | Immediate Critical |
| Health Endpoint | Every 5 minutes | Critical after 3 failures |
| Script Statistics | Daily at 9am UTC | Summary |
| System Metrics | Daily at 9am UTC | Summary |
| Error Log Patterns | Daily at 9am UTC | Summary |
| Disk Space | Daily at 9am UTC | Warning if >80% |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Linking Coffee Server                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Scheduler  │────────>│   Scripts    │                  │
│  │ scheduler.js │         │ (match-users,│                  │
│  └──────┬───────┘         │  notify, etc)│                  │
│         │                 └──────┬───────┘                  │
│         │ Spawns                 │ On Failure                │
│         │                        ↓                           │
│         │                 ┌──────────────┐                  │
│         │                 │  Alerting    │                  │
│         └────────────────>│   Module     │                  │
│                           │ alerting.js  │                  │
│  ┌──────────────┐         └──────┬───────┘                  │
│  │Health Monitor│                │                           │
│  │  (every 5m)  │────────────────┘                           │
│  └──────────────┘                │                           │
│                                   │                           │
│  ┌──────────────┐                │                           │
│  │Daily Summary │                │                           │
│  │  (9am UTC)   │────────────────┘                           │
│  └──────────────┘                │                           │
│                                   │                           │
│  ┌──────────────┐                │ Uses Bot Instance         │
│  │  server.js   │                │                           │
│  │ (exports bot)│────────────────┘                           │
│  └──────────────┘                │                           │
│                                   │                           │
│  ┌──────────────┐                │                           │
│  │ Alert State  │<───────────────┘                           │
│  │ (persistent) │                                            │
│  └──────────────┘                                            │
│                                                               │
└───────────────────────────────────┬───────────────────────────┘
                                    │
                                    ↓
                          ┌───────────────────┐
                          │   Telegram Bot    │
                          │  ADMIN_CHAT_ID    │
                          └───────────────────┘
                                    │
                                    ↓
                          ┌───────────────────┐
                          │  Admin's Phone    │
                          │  (Notifications)  │
                          └───────────────────┘
```

### Data Flow

1. **Script Execution**: Scheduler runs scripts on cron schedule
2. **Failure Detection**: Scheduler detects non-zero exit codes
3. **Alert Generation**: Alerting module formats message with log tail
4. **State Update**: Alert state manager records consecutive failures
5. **Rate Limiting**: Message queue enforces 100ms delays
6. **Telegram Delivery**: Bot instance sends message to admin chat

---

## Components

### 1. Core Alerting Module (`/backend/utils/alerting.js`)

**Purpose:** Central module for formatting and sending Telegram alerts

**Key Functions:**
```javascript
sendCriticalAlert(title, details, options)  // Immediate alerts
sendWarningAlert(title, details, options)   // Less urgent
sendInfoAlert(title, details, options)      // Informational
queueWarning(category, message, metadata)   // Add to daily summary
getQueuedWarnings()                         // Retrieve queue
clearWarnings()                             // Clear after summary
sendWithRateLimit(chatId, message, options) // Rate-limited sender
```

**Features:**
- Reuses bot instance from `server.js`
- Fallback: Creates new bot instance if needed
- Rate limiting: 100ms delay (max 10 msgs/sec)
- Markdown formatting with emojis
- In-memory warning queue

**Message Format:**
```
🚨 CRITICAL: Script Failure
━━━━━━━━━━━━━━━━━━━━━━━
Script: match-users.js
Exit Code: 1
Duration: 45.3s
Time: 2026-01-23 08:15:23 UTC

📋 Last 10 Lines of Log:
[ERROR] Failed to fetch members
[ERROR] Airtable API error: 500
━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Alert State Manager (`/backend/utils/alertState.js`)

**Purpose:** Persist alert state across restarts

**State File:** `/backend/config/alert-state.json`

**Key Functions:**
```javascript
loadState()                        // Load from disk
saveState(state)                   // Persist to disk
recordScriptFailure(scriptName)    // Increment failures
recordScriptSuccess(scriptName)    // Reset failures
getConsecutiveFailures(scriptName) // Get count
recordHealthFailure()              // Increment health failures
resetHealthFailures()              // Reset health failures
getConsecutiveHealthFailures()     // Get health count
recordDailySummary()               // Update timestamp
isDailySummaryDue()                // Check if 24h elapsed
```

**State Schema:**
```json
{
  "lastDailySummary": "2026-01-23T09:00:00Z",
  "consecutiveHealthFailures": 0,
  "scriptFailures": {
    "match-users.js": {
      "consecutiveFailures": 0,
      "lastFailure": null,
      "lastAlertSent": null,
      "totalFailures": 0
    }
  },
  "healthChecks": {
    "lastSuccess": null,
    "lastFailure": null
  }
}
```

### 3. Health Monitor Script (`/backend/scripts/health-monitor.js`)

**Purpose:** Periodically check server health

**Schedule:** Every 5 minutes (`*/5 * * * *`)

**Logic:**
1. Ping `GET /api/health` with 5s timeout
2. **Success**: Reset consecutive failures, exit 0
3. **Failure**: Increment consecutive failures
   - 1st-2nd failure: Queue warning only
   - 3rd+ failure: Send CRITICAL alert
4. Track slow responses (>5s) as warnings

**Environment Variables:**
- `HEALTH_CHECK_URL` (default: `http://localhost:3001/api/health`)
- `HEALTH_CHECK_TIMEOUT` (default: `5000` ms)
- `ENABLE_MONITORING` (toggle: `true`/`false`)

**Exit Codes:**
- `0` = Health check passed
- `1` = Health check failed

### 4. Daily Summary Script (`/backend/scripts/daily-summary.js`)

**Purpose:** Generate comprehensive daily digest

**Schedule:** Daily at 9:00 AM UTC (`0 9 * * *`)

**Summary Sections:**

1. **Header** - Date and summary icon
2. **Warnings** - Queued warnings grouped by category
3. **Script Statistics** - Last 24h execution counts
4. **System Metrics** - Disk usage, log directory size
5. **Error Patterns** - Scans logs for ERROR/CRITICAL keywords
6. **State Snapshot** - Current consecutive failures
7. **Footer** - Generation timestamp

**Example Output:**
```
🌅 Daily Summary - 2026-01-23
━━━━━━━━━━━━━━━━━━━━━━━

✅ No warnings in the last 24h

📜 Script Statistics
Total Executions: 12
✅ Successful: 11
❌ Failed: 1

Failed Scripts:
• notify-matches.js: 1 failure(s)

💻 System Metrics
Disk Usage: 45% (12G free)
Log Directory Size: 234M

🔍 Error Patterns (Last 24h)
• debug.log: 3 errors, 0 critical

━━━━━━━━━━━━━━━━━━━━━━━
Generated at: 2026-01-23T09:00:15Z
```

**Operations:**
- Scans `/backend/logs/` for error patterns
- Parses script logs for exit codes (last 24h)
- Checks disk usage via `df -h`
- Clears warning queue after sending
- Updates `lastDailySummary` timestamp

### 5. Test Script (`/backend/scripts/test-alerting.js`)

**Purpose:** Verify Telegram integration works

**Actions:**
1. Sends test critical alert
2. Queues test warning
3. Sends test info alert

**Usage:**
```bash
node backend/scripts/test-alerting.js
```

### 6. Enhanced Scheduler (`/backend/scheduler.js`)

**Modifications:**
- **Imports added**: `alerting.js`, `alertState.js`
- **Alert on script failure**: Sends critical alert with log tail
- **Alert on spawn error**: Sends critical alert if script fails to start
- **Track success/failure**: Records in alert state
- **Helper method**: `getLogTail(logPath, numLines)` reads last N lines

**Integration Points:**
```javascript
child.on('close', async (code) => {
  // ... existing code ...

  if (code !== 0 && process.env.ENABLE_MONITORING !== 'false') {
    recordScriptFailure(config.script);
    const logTail = await this.getLogTail(scriptLogPath, 10);
    await sendCriticalAlert('Script Failure', details);
  } else if (code === 0) {
    recordScriptSuccess(config.script);
  }
});

child.on('error', async (error) => {
  // ... error handling ...
  await sendCriticalAlert('Script Failed to Start', details);
});
```

### 7. Server Export (`/backend/server.js`)

**Modification:**
```javascript
// Export bot instance for alerting module
module.exports = { bot };
```

This allows the alerting module to reuse the existing bot instance instead of creating duplicates.

---

## Alert Types

### 🚨 CRITICAL (Immediate Telegram)

**Triggers:**
- Script execution failure (exit code ≠ 0)
- Script spawn error (failed to start)
- 3+ consecutive health check failures
- Manual critical alerts from scripts

**Response Time:** Immediate (within seconds)

**Format:** Markdown message with:
- Script/component name
- Error details
- Exit code (if applicable)
- Duration
- Timestamp
- Log tail (last 10 lines)

**Example:**
```
🚨 CRITICAL: Server Health Check Failed
━━━━━━━━━━━━━━━━━━━━━━━
Consecutive Failures: 3
URL: http://localhost:3001/api/health
Error: connect ECONNREFUSED
Response Time: 5012ms
Time: 2026-01-23T14:22:30Z

⚠️ Server may be down or unresponsive!
━━━━━━━━━━━━━━━━━━━━━━━
```

### ⚠️ WARNING (Daily Summary Only)

**Triggers:**
- 1-2 health check failures (not consecutive)
- ERROR/CRITICAL keywords in logs (threshold: >5 per file)
- Slow health check responses (>5s)
- Disk space 80-90%

**Response Time:** Included in next daily summary (9am UTC)

**Format:** Grouped by category in summary report

### ℹ️ INFO (Daily Summary)

**Included:**
- Script execution statistics (success/failure counts)
- System metrics (disk usage, log sizes)
- Recovery notices (e.g., "Server recovered after 3 failures")
- Daily summary metadata

**Response Time:** Daily at 9am UTC

---

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# Monitoring & Alerting
ENABLE_MONITORING=true                  # Enable/disable monitoring system
HEALTH_CHECK_URL=http://localhost:3001/api/health
HEALTH_CHECK_TIMEOUT=5000               # Health check timeout in ms
```

### Required Pre-Existing Variables

The monitoring system requires these variables to already be set:

```bash
ADMIN_CHAT_ID=your_admin_telegram_chat_id
BOT_TOKEN=your_telegram_bot_token
# OR
ADMIN_BOT_TOKEN=your_admin_bot_token_for_dev
```

### Scheduler Configuration

File: `/backend/scheduler.json`

```json
[
  {
    "name": "Health Monitor",
    "script": "health-monitor.js",
    "cron": "*/5 * * * *",
    "enabled": true,
    "lastRun": null,
    "lastStatus": null
  },
  {
    "name": "Daily Summary",
    "script": "daily-summary.js",
    "cron": "0 9 * * *",
    "enabled": true,
    "lastRun": null,
    "lastStatus": null
  }
]
```

**Cron Format:** Standard cron syntax
- `*/5 * * * *` = Every 5 minutes
- `0 9 * * *` = Daily at 9:00 AM UTC

**Customization:**
- Change health check frequency: Modify `cron` field (e.g., `*/10 * * * *` for 10 minutes)
- Change summary time: Modify `cron` field (e.g., `0 6 * * *` for 6am UTC)
- Disable: Set `enabled: false`

### Runtime Configuration

Runtime config is stored at: `/backend/config/scheduler.json`

This file is created from the default `scheduler.json` on first run and persists across restarts.

---

## Testing Guide

### Prerequisites

1. **Environment Setup:**
   ```bash
   cd /Users/admin/P2025/Linking_Coffee
   ```

2. **Add monitoring env vars to `.env`:**
   ```bash
   echo "ENABLE_MONITORING=true" >> .env
   echo "HEALTH_CHECK_URL=http://localhost:3001/api/health" >> .env
   echo "HEALTH_CHECK_TIMEOUT=5000" >> .env
   ```

3. **Verify existing vars are set:**
   ```bash
   grep -E "(ADMIN_CHAT_ID|BOT_TOKEN)" .env
   ```

### Test 1: Alerting Module

**Test basic Telegram integration:**

```bash
# Start backend
./start_local.sh

# In another terminal, run test script
cd backend
node scripts/test-alerting.js
```

**Expected Output:**
```
🧪 Testing alerting system...

1️⃣  Sending test critical alert...
   ✅ Critical alert sent

2️⃣  Queueing test warning...
   ✅ Warning queued (will appear in next daily summary)

3️⃣  Sending test info alert...
   ✅ Info alert sent

✅ Test complete!

Check your Telegram (ADMIN_CHAT_ID) for:
  - Critical alert (immediate)
  - Info alert (immediate)
  - Warning will appear in next daily summary
```

**Expected Telegram Messages:**
- 1 critical alert message
- 1 info alert message

**If No Messages:**
1. Check `ADMIN_CHAT_ID` is correct
2. Verify bot token is valid
3. Check console for errors

### Test 2: Health Monitor

**Test health check success:**

```bash
# Ensure backend is running
./start_local.sh

# Run health monitor
cd backend
node scripts/health-monitor.js
```

**Expected Output:**
```
🏥 Health check: http://localhost:3001/api/health
✅ Health check passed (45ms)
```

**Test health check failure:**

```bash
# Stop backend
docker compose stop backend
# OR if using start_local.sh, press Ctrl+C

# Run health monitor 3 times
node scripts/health-monitor.js  # 1st failure
node scripts/health-monitor.js  # 2nd failure
node scripts/health-monitor.js  # 3rd failure - CRITICAL ALERT!
```

**Expected Output (3rd run):**
```
🏥 Health check: http://localhost:3001/api/health
❌ Health check failed: connect ECONNREFUSED (5012ms)
   Consecutive failures: 3
```

**Expected Telegram:**
- Critical alert after 3rd run with failure details

**Test recovery:**

```bash
# Restart backend
./start_local.sh

# Run health monitor again
cd backend
node scripts/health-monitor.js
```

**Expected Output:**
```
🏥 Health check: http://localhost:3001/api/health
✅ Health check passed (52ms)
💚 Health check recovered
```

**Expected Behavior:**
- Recovery notice queued for next daily summary
- No immediate Telegram alert

### Test 3: Daily Summary

**Generate test summary:**

```bash
# Queue some test warnings first
node scripts/test-alerting.js

# Generate daily summary
node scripts/daily-summary.js
```

**Expected Output:**
```
📊 Generating daily summary...
📤 Sending daily summary to Telegram...
✅ Daily summary sent
🧹 Cleared X warnings from queue
```

**Expected Telegram:**
- Summary report with queued warnings
- Script statistics
- System metrics
- Error patterns (if any)

### Test 4: Scheduler Integration

**Test automatic failure detection:**

```bash
# Create intentionally failing script
echo "console.log('Test failure'); process.exit(1);" > backend/scripts/test-fail.js

# Option A: Add via Admin UI
# 1. Go to http://localhost:3000/admin
# 2. Click "Scheduler" tab
# 3. Add job:
#    - Name: Test Failure
#    - Script: test-fail.js
#    - Cron: * * * * * (every minute)
#    - Enabled: true

# Option B: Add manually to config
# Edit backend/config/scheduler.json and add:
# {
#   "name": "Test Failure",
#   "script": "test-fail.js",
#   "cron": "* * * * *",
#   "enabled": true
# }

# Restart scheduler (if using manual edit)
# Kill and restart backend

# Wait 1 minute
```

**Expected Output (in backend logs):**
```
[Test Failure] finished with code 1
```

**Expected Telegram:**
- Critical alert with:
  - Script name: Test Failure
  - Exit code: 1
  - Duration
  - Log tail showing "Test failure"

**Cleanup:**
```bash
# Remove test script
rm backend/scripts/test-fail.js

# Remove from scheduler via Admin UI or edit config
```

### Test 5: State Persistence

**Test state file creation:**

```bash
# Check state file was created
cat backend/config/alert-state.json
```

**Expected Output:**
```json
{
  "lastDailySummary": "2026-01-23T09:00:00Z",
  "consecutiveHealthFailures": 0,
  "scriptFailures": {},
  "healthChecks": {
    "lastSuccess": "2026-01-23T10:15:30Z",
    "lastFailure": null
  }
}
```

**Test persistence across restarts:**

```bash
# Trigger some failures (e.g., run health monitor with backend down)
docker compose stop backend
node scripts/health-monitor.js
node scripts/health-monitor.js

# Check state
cat backend/config/alert-state.json
# Should show consecutiveHealthFailures: 2

# Restart server
docker compose restart backend

# Check state persisted
cat backend/config/alert-state.json
# Should still show consecutiveHealthFailures: 2
```

### Test Checklist

Use this checklist to verify complete functionality:

- [ ] Test alert received in Telegram
- [ ] Health monitor runs successfully
- [ ] Health monitor detects failures (3 consecutive)
- [ ] Critical alert sent after 3 failures
- [ ] Daily summary generates and sends
- [ ] Warning queue works (test-alerting → daily-summary)
- [ ] Alert state file created at `/backend/config/alert-state.json`
- [ ] Script failure triggers immediate alert (test-fail.js)
- [ ] State persists across server restart
- [ ] Can disable with `ENABLE_MONITORING=false`
- [ ] Recovery notice appears in daily summary
- [ ] No alerts when monitoring disabled

---

## Deployment Guide

### Development Environment

**Step 1: Verify Files Created**

```bash
# Check new files exist
ls -la backend/utils/alerting.js
ls -la backend/utils/alertState.js
ls -la backend/scripts/health-monitor.js
ls -la backend/scripts/daily-summary.js
ls -la backend/scripts/test-alerting.js

# Check modified files
git diff backend/scheduler.js
git diff backend/server.js
git diff backend/scheduler.json
```

**Step 2: Add Environment Variables**

```bash
# Add to .env
cat >> .env << EOF

# Monitoring & Alerting
ENABLE_MONITORING=true
HEALTH_CHECK_URL=http://localhost:3001/api/health
HEALTH_CHECK_TIMEOUT=5000
EOF
```

**Step 3: Test Locally**

Follow the [Testing Guide](#testing-guide) above.

**Step 4: Verify Scheduler**

```bash
# Start backend
./start_local.sh

# Check scheduler logs (should show monitoring jobs loaded)
# In backend terminal, look for:
# ⏰ Scheduling "Health Monitor" [*/5 * * * *] -> health-monitor.js
# ⏰ Scheduling "Daily Summary" [0 9 * * *] -> daily-summary.js
```

### Production Deployment

**Step 1: Commit Changes**

```bash
# Stage all new and modified files
git add backend/utils/alerting.js
git add backend/utils/alertState.js
git add backend/scripts/health-monitor.js
git add backend/scripts/daily-summary.js
git add backend/scripts/test-alerting.js
git add backend/scheduler.js
git add backend/server.js
git add backend/scheduler.json
git add .env.example
git add docs/monitoring/

# Commit with detailed message
git commit -m "Add Telegram monitoring and alerting system

- Core alerting module with rate limiting (alerting.js)
- Alert state persistence for consecutive failure tracking (alertState.js)
- Health monitor script - runs every 5 min (health-monitor.js)
- Daily summary script - runs at 9am UTC (daily-summary.js)
- Test script for verification (test-alerting.js)
- Scheduler integration for script failure alerts
- Server.js bot export for instance reuse
- Updated scheduler.json with monitoring jobs
- Documentation in docs/monitoring/

Alert Types:
- Critical (immediate): Script failures, 3+ health check failures
- Warnings (daily digest): Error patterns, slow responses, metrics
- Daily summary: Full system health report at 9am UTC

Configuration:
- ENABLE_MONITORING=true (toggle on/off)
- HEALTH_CHECK_URL=http://localhost:3001/api/health
- HEALTH_CHECK_TIMEOUT=5000ms
"
```

**Step 2: Update Production Environment**

```bash
# SSH to production server
ssh admin@91.98.235.147

# Navigate to project
cd /root/Linking_Coffee

# Add monitoring env vars to .env
cat >> .env << EOF

# Monitoring & Alerting
ENABLE_MONITORING=true
HEALTH_CHECK_URL=http://localhost:3001/api/health
HEALTH_CHECK_TIMEOUT=5000
EOF

# Verify vars added
tail -5 .env

# Exit SSH
exit
```

**Step 3: Deploy to Production**

```bash
# Run deployment script (from local machine)
./deploy-prod.sh

# The script will:
# 1. Push changes to git
# 2. SSH to server
# 3. Pull latest code
# 4. Rebuild and restart Docker containers
```

**Step 4: Verify Deployment**

```bash
# SSH to production
ssh admin@91.98.235.147
cd /root/Linking_Coffee

# Check scheduler loaded monitoring jobs
docker compose exec backend cat config/scheduler.json
# Should show Health Monitor and Daily Summary jobs

# Test health monitor
docker compose exec backend node scripts/health-monitor.js
# Expected: ✅ Health check passed (XXms)

# Send test alert
docker compose exec backend node scripts/test-alerting.js
# Expected: Telegram messages received

# Check logs
docker compose logs -f backend
# Look for:
# ⏰ Scheduling "Health Monitor" [*/5 * * * *]
# ⏰ Scheduling "Daily Summary" [0 9 * * *]

# Exit SSH
exit
```

**Step 5: Monitor for 24 Hours**

After deployment, verify:

- [ ] Health monitor runs every 5 minutes (check scheduler logs)
- [ ] No unexpected critical alerts
- [ ] Daily summary received at 9am UTC (next day)
- [ ] Alert state file created: `docker compose exec backend cat config/alert-state.json`
- [ ] State updates with each health check

**Step 6: Create Production Backup (Optional)**

```bash
# SSH to server
ssh admin@91.98.235.147

# Backup alert state periodically
cd /root/Linking_Coffee
cp backend/config/alert-state.json backend/config/alert-state.json.backup

# Add to cron for weekly backups (optional)
# crontab -e
# Add: 0 0 * * 0 cp /root/Linking_Coffee/backend/config/alert-state.json /root/Linking_Coffee/backend/config/alert-state.json.backup
```

### Rollback Procedure

If issues arise after deployment:

**Option 1: Quick Disable (Non-Invasive)**

```bash
# SSH to server
ssh admin@91.98.235.147
cd /root/Linking_Coffee

# Disable monitoring
echo "ENABLE_MONITORING=false" >> .env

# Restart backend
docker compose restart backend

# Verify disabled
docker compose exec backend printenv ENABLE_MONITORING
# Should show: false
```

**Option 2: Remove Scheduled Jobs**

```bash
# SSH to server
ssh admin@91.98.235.147
cd /root/Linking_Coffee

# Edit runtime config
docker compose exec backend vi config/scheduler.json

# Set enabled: false for monitoring jobs:
# {
#   "name": "Health Monitor",
#   "enabled": false,
#   ...
# }

# Restart backend
docker compose restart backend
```

**Option 3: Full Revert**

```bash
# From local machine
git log --oneline  # Find commit hash before monitoring

# Revert commit
git revert <commit-hash>

# Deploy
./deploy-prod.sh
```

---

## Maintenance & Operations

### Daily Operations

**View Current Alert State:**

```bash
# Development
cat backend/config/alert-state.json

# Production
ssh admin@91.98.235.147 'docker compose exec backend cat config/alert-state.json'
```

**Manually Trigger Daily Summary:**

```bash
# Development
cd backend
node scripts/daily-summary.js

# Production
ssh admin@91.98.235.147
docker compose exec backend node scripts/daily-summary.js
```

**Check Scheduler Status:**

```bash
# Via Admin UI
# Go to https://linked.coffee/admin
# Click "Scheduler" tab
# View job status, last run times, success/failure

# Via Command Line (Production)
ssh admin@91.98.235.147
docker compose exec backend cat config/scheduler.json
```

### Configuration Changes

**Adjust Health Check Frequency:**

```bash
# Via Admin UI
# 1. Go to https://linked.coffee/admin
# 2. Scheduler tab
# 3. Find "Health Monitor"
# 4. Edit cron expression (e.g., */10 * * * * for 10 minutes)
# 5. Click "Update Job"

# Via File Edit (requires restart)
# Edit backend/config/scheduler.json
# Change: "cron": "*/10 * * * *"
# Restart: docker compose restart backend
```

**Change Daily Summary Time:**

Current: 9:00 AM UTC (`0 9 * * *`)

To change to 6:00 AM UTC:

```bash
# Via Admin UI
# 1. Go to https://linked.coffee/admin
# 2. Scheduler tab
# 3. Find "Daily Summary"
# 4. Edit cron: 0 6 * * *
# 5. Click "Update Job"
```

**Disable Monitoring Temporarily:**

```bash
# Add to .env
ENABLE_MONITORING=false

# Restart backend
docker compose restart backend

# All monitoring scripts will exit early with:
# ⏸️  Monitoring disabled (ENABLE_MONITORING=false)
```

**Re-enable Monitoring:**

```bash
# Edit .env
ENABLE_MONITORING=true

# Restart backend
docker compose restart backend
```

### Log Management

**View Script Logs:**

```bash
# Development
ls -lh backend/logs/scripts/
cat backend/logs/scripts/health-monitor.js.log

# Production
ssh admin@91.98.235.147
docker compose exec backend ls -lh logs/scripts/
docker compose exec backend tail -100 logs/scripts/health-monitor.js.log
```

**View System Logs:**

```bash
# Development
cat backend/logs/debug.log
cat backend/logs/auth.log
cat backend/logs/connections.log

# Production
ssh admin@91.98.235.147
docker compose exec backend tail -100 logs/debug.log
```

**Log Rotation:**

Logs are automatically rotated based on `/backend/utils/logRotation.js`:

- **Max size**: 10MB (configurable via `MAX_LOG_SIZE`)
- **Rotations**: 5 (configurable via `MAX_ROTATIONS`)
- **Retention**: 30 days (configurable via `LOG_RETENTION_DAYS`)
- **Compression**: Optional (set `ENABLE_LOG_COMPRESSION=true`)

**Check Log Sizes:**

```bash
# Production
ssh admin@91.98.235.147
docker compose exec backend du -sh logs/
docker compose exec backend du -sh logs/scripts/
```

### Alert State Management

**Reset Alert State:**

```bash
# Development
rm backend/config/alert-state.json
# Will be recreated on next monitoring script run

# Production
ssh admin@91.98.235.147
docker compose exec backend rm config/alert-state.json
docker compose restart backend
```

**Manually Edit State:**

```bash
# View current state
cat backend/config/alert-state.json

# Edit with jq (safer than manual edit)
# Example: Reset consecutive health failures
jq '.consecutiveHealthFailures = 0' backend/config/alert-state.json > temp.json
mv temp.json backend/config/alert-state.json

# Or edit directly (be careful with JSON syntax)
vi backend/config/alert-state.json
```

### Performance Monitoring

**Check Monitoring Overhead:**

```bash
# Production
ssh admin@91.98.235.147

# Check Docker stats
docker stats --no-stream

# Check process memory (backend container)
docker compose exec backend ps aux | grep node

# Check log file sizes
docker compose exec backend du -sh logs/
docker compose exec backend du -sh config/
```

**Expected Resource Usage:**
- **Memory**: <10MB additional overhead
- **CPU**: Negligible (<1% during script execution)
- **Disk**: ~1KB alert state file, grows slowly
- **Network**: 1-5 Telegram API calls per day (typical)

---

## Troubleshooting

### Problem: No Alerts Received

**Symptoms:**
- Test script runs but no Telegram messages
- Critical failures occur but no alerts

**Diagnosis Steps:**

1. **Check monitoring is enabled:**
   ```bash
   grep ENABLE_MONITORING .env
   # Should show: ENABLE_MONITORING=true
   ```

2. **Verify ADMIN_CHAT_ID is set:**
   ```bash
   grep ADMIN_CHAT_ID .env
   # Should show your Telegram chat ID
   ```

3. **Test bot token:**
   ```bash
   # Get bot info
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe

   # Should return bot details, not error
   ```

4. **Run test script with debug:**
   ```bash
   cd backend
   DEBUG=* node scripts/test-alerting.js

   # Check console output for errors
   ```

5. **Check bot instance:**
   ```bash
   # In backend console, look for:
   # 📱 Using bot instance from server.js
   # OR
   # 📱 Created new bot instance for alerting
   ```

**Solutions:**

- **If ENABLE_MONITORING=false**: Change to `true`, restart
- **If ADMIN_CHAT_ID missing**: Add to `.env`, restart
- **If bot token invalid**: Update `BOT_TOKEN` in `.env`, restart
- **If "bot not found" error**: Check bot instance export in `server.js`

### Problem: Too Many False Alerts

**Symptoms:**
- Health check alerts when server is fine
- Alerts for slow responses during normal load
- Spurious script failure alerts

**Solutions:**

1. **Increase health check timeout:**
   ```bash
   # In .env
   HEALTH_CHECK_TIMEOUT=10000  # 10 seconds instead of 5

   # Restart
   docker compose restart backend
   ```

2. **Adjust critical threshold:**
   Edit `backend/scripts/health-monitor.js`:
   ```javascript
   const CRITICAL_THRESHOLD = 5; // Instead of 3
   ```
   Redeploy.

3. **Disable health monitor temporarily:**
   ```bash
   # Via Admin UI
   # 1. Go to admin panel
   # 2. Scheduler tab
   # 3. Health Monitor → Edit
   # 4. Set enabled: false
   ```

4. **Increase slow response threshold:**
   Edit `backend/scripts/health-monitor.js`:
   ```javascript
   if (responseTime > 10000) {  // Instead of 5000
     queueWarning(...);
   }
   ```

### Problem: Missing Daily Summary

**Symptoms:**
- No summary received at 9am UTC
- Summary script not running

**Diagnosis Steps:**

1. **Check job is enabled:**
   ```bash
   cat backend/config/scheduler.json | grep -A 5 "Daily Summary"
   # Should show "enabled": true
   ```

2. **Verify cron schedule:**
   ```bash
   # Should be: "cron": "0 9 * * *"
   # NOT: "cron": "0 21 * * *" (9pm instead of 9am)
   ```

3. **Check script logs:**
   ```bash
   cat backend/logs/scripts/daily-summary.js.log
   # Look for recent execution or errors
   ```

4. **Test manually:**
   ```bash
   cd backend
   node scripts/daily-summary.js
   # Should send summary to Telegram
   ```

5. **Check timezone:**
   ```bash
   # Cron runs in server timezone (UTC)
   date -u
   # If current UTC time is before 9am, wait for scheduled run
   ```

**Solutions:**

- **If disabled**: Enable via Admin UI or edit `config/scheduler.json`
- **If wrong time**: Edit cron expression (e.g., `0 6 * * *` for 6am)
- **If script error**: Check logs, fix error, redeploy
- **If timezone confusion**: Remember cron uses UTC, not local time

### Problem: Script Logs Growing Too Large

**Symptoms:**
- `/backend/logs/scripts/` directory is very large
- Individual log files exceed 10MB

**Solutions:**

1. **Check log rotation settings:**
   ```bash
   grep -E "(MAX_LOG_SIZE|LOG_RETENTION_DAYS)" .env
   ```

2. **Adjust retention:**
   ```bash
   # In .env
   MAX_LOG_SIZE=5242880      # 5MB instead of 10MB
   LOG_RETENTION_DAYS=7      # 7 days instead of 30
   ENABLE_LOG_COMPRESSION=true

   # Restart
   docker compose restart backend
   ```

3. **Manually clean old logs:**
   ```bash
   # Find logs older than 7 days
   find backend/logs/scripts -name "*.log" -mtime +7

   # Delete old logs
   find backend/logs/scripts -name "*.log" -mtime +7 -delete
   ```

4. **Check for script spamming:**
   ```bash
   # Find largest log files
   du -sh backend/logs/scripts/* | sort -h

   # Investigate why certain scripts log excessively
   ```

### Problem: Alert State Not Persisting

**Symptoms:**
- Consecutive failures reset after server restart
- Daily summary timestamp lost

**Diagnosis:**

1. **Check state file exists:**
   ```bash
   ls -la backend/config/alert-state.json
   ```

2. **Check file permissions:**
   ```bash
   ls -la backend/config/
   # State file should be writable
   ```

3. **Check Docker volume mounting:**
   ```bash
   # Production
   docker compose exec backend ls -la config/
   # Should show alert-state.json
   ```

4. **Test state persistence:**
   ```bash
   # Trigger failure
   node backend/scripts/health-monitor.js  # With backend down

   # Check state
   cat backend/config/alert-state.json
   # Should show consecutiveHealthFailures: 1

   # Restart
   docker compose restart backend

   # Check state again
   cat backend/config/alert-state.json
   # Should still show consecutiveHealthFailures: 1
   ```

**Solutions:**

- **If file missing**: Run monitoring script to auto-create
- **If permissions issue**: `chmod 644 backend/config/alert-state.json`
- **If Docker volume issue**: Check `docker-compose.prod.yml` volume mounts
- **If JSON parse error**: Delete file, let it recreate: `rm backend/config/alert-state.json`

### Problem: Rate Limiting / Telegram API Errors

**Symptoms:**
- `Too Many Requests` error from Telegram
- Alerts delayed or dropped

**Diagnosis:**

```bash
# Check alerting module logs for rate limit errors
grep -i "rate limit" backend/logs/debug.log
grep -i "429" backend/logs/debug.log
```

**Solutions:**

1. **Increase delay between messages:**
   Edit `backend/utils/alerting.js`:
   ```javascript
   if (messageQueue.length > 0) {
     await new Promise(r => setTimeout(r, 200)); // 200ms instead of 100ms
   }
   ```

2. **Reduce alert frequency:**
   - Increase health check interval (e.g., every 10 min instead of 5)
   - Disable non-critical warnings
   - Use daily summary instead of immediate alerts where possible

3. **Check for alert loops:**
   ```bash
   # Check if same alert sent repeatedly
   grep "Critical alert sent" backend/logs/debug.log | sort | uniq -c

   # If same alert sent 100+ times, there's a loop
   ```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `❌ ADMIN_CHAT_ID not configured` | Environment variable missing | Add `ADMIN_CHAT_ID` to `.env` |
| `❌ No bot token available` | BOT_TOKEN not set | Add `BOT_TOKEN` or `ADMIN_BOT_TOKEN` to `.env` |
| `⏸️ Monitoring disabled` | `ENABLE_MONITORING=false` | Set to `true` in `.env` |
| `connect ECONNREFUSED` | Backend not running | Start backend with `./start_local.sh` |
| `❌ Error loading alert state` | Corrupt JSON file | Delete `alert-state.json`, let recreate |
| `Too Many Requests` | Telegram rate limit | Increase delay or reduce alert frequency |
| `Script not found` | Missing script file | Check script exists in `/backend/scripts/` |

---

## Future Enhancements

### Phase 2: External Monitoring

**Add UptimeRobot (Free Tier):**

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP monitor: `https://linked.coffee/api/health`
3. Configure webhook alert to your endpoint
4. Create webhook handler in `server.js`

**Benefits:**
- Detects complete server outages (VPS down, network issues)
- Works even when server offline
- 5-minute check interval (free tier)

**Implementation:**
```javascript
// Add to server.js
app.post('/api/admin/uptime-webhook', async (req, res) => {
  const { monitorFriendlyName, alertType } = req.body;

  if (alertType === 'down') {
    await sendCriticalAlert(
      'External Uptime Monitor Alert',
      `Monitor: ${monitorFriendlyName}\nStatus: Server DOWN`
    );
  }

  res.json({ success: true });
});
```

### Phase 3: Performance Metrics

**Track API Response Times:**

Add middleware to track response times:

```javascript
// In server.js
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      queueWarning('Performance', `Slow request: ${req.path} (${duration}ms)`);
    }
  });
  next();
});
```

**Track Script Execution Times:**

Modify scheduler to track and alert on slow scripts:

```javascript
// In scheduler.js
const duration = ((Date.now() - startTime) / 1000).toFixed(1);
if (duration > 60) {  // Script took >1 minute
  queueWarning('Performance', `Slow script: ${config.name} (${duration}s)`);
}
```

### Phase 4: Dashboard UI

**Add Monitoring Page to Admin UI:**

Create `/frontend/src/pages/AdminMonitoring.js`:

- Current alert state (consecutive failures)
- Last daily summary timestamp
- Health check history (graph)
- Script success/failure rates (last 7 days)
- Manual controls (trigger summary, reset state, test alert)

**API Endpoints to Add:**

```javascript
// GET /api/admin/monitoring/status
// Returns current monitoring state

// POST /api/admin/monitoring/test
// Sends test alert

// POST /api/admin/monitoring/summary
// Triggers daily summary manually

// POST /api/admin/monitoring/reset
// Resets alert state
```

### Phase 5: Advanced Alerting

**Alert Fatigue Prevention:**

- **Mute Alerts**: Button in Telegram to mute specific alert types for X hours
- **Alert Grouping**: Group similar alerts (e.g., "5 scripts failed" instead of 5 separate messages)
- **Smart Escalation**: Only alert on 2nd+ occurrence within 1 hour

**ML-Based Anomaly Detection:**

- Baseline normal behavior (script duration, response times)
- Alert on deviations (script takes 2x normal time)
- Learn seasonal patterns (higher load on Mondays)

**Custom Alert Rules:**

Allow admin to define custom rules via UI:

```javascript
{
  "name": "High Match Failure Rate",
  "condition": "match_success_rate < 0.8 AND total_matches > 10",
  "severity": "WARNING",
  "cooldown": "1h"
}
```

---

## Appendix

### File Structure

```
backend/
├── config/
│   └── alert-state.json          # Auto-created, persistent state
├── logs/
│   ├── scripts/
│   │   ├── health-monitor.js.log
│   │   ├── daily-summary.js.log
│   │   └── [other-script].js.log
│   ├── auth.log
│   ├── debug.log
│   └── connections.log
├── scripts/
│   ├── health-monitor.js         # NEW: Health check script
│   ├── daily-summary.js          # NEW: Daily digest script
│   ├── test-alerting.js          # NEW: Testing script
│   └── [existing scripts]
├── utils/
│   ├── alerting.js               # NEW: Core alerting module
│   ├── alertState.js             # NEW: State persistence
│   ├── logger.js                 # Existing
│   └── logRotation.js            # Existing
├── scheduler.js                  # MODIFIED: Alert integration
├── server.js                     # MODIFIED: Bot export
└── scheduler.json                # MODIFIED: Added monitoring jobs

docs/
└── monitoring/
    ├── README.md                 # This file
    ├── TESTING.md                # Detailed testing procedures
    └── DEPLOYMENT.md             # Step-by-step deployment
```

### Cron Schedule Reference

| Expression | Meaning | Use Case |
|------------|---------|----------|
| `* * * * *` | Every minute | Testing only |
| `*/5 * * * *` | Every 5 minutes | Health monitoring (default) |
| `*/10 * * * *` | Every 10 minutes | Reduced frequency health checks |
| `0 * * * *` | Every hour at :00 | Hourly summary |
| `0 9 * * *` | Daily at 9am UTC | Daily summary (default) |
| `0 6 * * *` | Daily at 6am UTC | Early morning summary |
| `0 0 * * 0` | Weekly on Sunday midnight | Weekly reports |

**Test Cron Expressions:** [crontab.guru](https://crontab.guru)

### Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_MONITORING` | Boolean | `true` | Master toggle for monitoring system |
| `HEALTH_CHECK_URL` | String | `http://localhost:3001/api/health` | URL to ping for health checks |
| `HEALTH_CHECK_TIMEOUT` | Integer | `5000` | Health check timeout in milliseconds |
| `ADMIN_CHAT_ID` | String | *Required* | Telegram chat ID for admin alerts |
| `BOT_TOKEN` | String | *Required* | Telegram bot token (production) |
| `ADMIN_BOT_TOKEN` | String | Optional | Alternative bot token (development) |

### Monitoring Metrics

**System Metrics Collected:**

- **Health Checks**: Pass/fail rate, response time, consecutive failures
- **Script Executions**: Total runs, success rate, failure rate, duration
- **Error Patterns**: Count of ERROR/CRITICAL keywords in logs
- **Disk Usage**: Total used %, available space, log directory size
- **Alert State**: Consecutive failures per component, last alert times

**Metrics NOT Collected:**

- Individual user actions
- API request details (beyond response time)
- Database query performance
- Memory/CPU usage (can be added in Phase 2)
- Network bandwidth

### Support & Contact

For issues with the monitoring system:

1. **Check Logs**: `/backend/logs/scripts/` and main logs
2. **Review This Guide**: Troubleshooting section
3. **Test Components**: Run individual scripts manually
4. **Check State**: View `/backend/config/alert-state.json`
5. **Report Issues**: GitHub Issues or project maintainer

---

**Document Version:** 1.0
**Last Updated:** January 23, 2026
**Maintained By:** Project Team

---

## Quick Reference Card

### Essential Commands

```bash
# Test alerting
node backend/scripts/test-alerting.js

# Run health check
node backend/scripts/health-monitor.js

# Generate summary
node backend/scripts/daily-summary.js

# View alert state
cat backend/config/alert-state.json

# View logs
tail -100 backend/logs/scripts/health-monitor.js.log
tail -100 backend/logs/debug.log

# Disable monitoring
echo "ENABLE_MONITORING=false" >> .env && docker compose restart backend

# Enable monitoring
sed -i 's/ENABLE_MONITORING=false/ENABLE_MONITORING=true/' .env && docker compose restart backend
```

### Quick Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| No alerts | Check `ADMIN_CHAT_ID` and `BOT_TOKEN` in `.env` |
| Too many alerts | Set `HEALTH_CHECK_TIMEOUT=10000` in `.env` |
| Missing summary | Check cron: `0 9 * * *` (9am UTC) |
| State not persisting | Delete `alert-state.json`, restart |
| Rate limit errors | Increase delay in `alerting.js` line ~100 |

---

*End of Documentation*
