# PRD: Persistent Script Logging System

**Version:** 1.0
**Date:** 2025-12-27
**Status:** Draft
**Author:** System Architecture

---

## Executive Summary

Implement a comprehensive logging system for automated cron scripts that captures all execution output to persistent log files, survives container rebuilds/deployments, and provides admin visibility through a web interface.

### Problem Statement

Currently, scheduled scripts (match-users.js, notify-matches.js, etc.) output to stdout/stderr which:
- Disappears when the Docker container is stopped or rebuilt
- Cannot be accessed after script execution completes
- Makes debugging production issues extremely difficult
- Provides no historical execution record

### Solution Overview

Enhance the scheduler to automatically capture all script output to individual log files stored in a Docker volume, ensuring logs persist across deployments. Add admin dashboard capabilities to view, search, and download these logs.

### Success Metrics

- 100% of script executions logged to persistent files
- Zero log loss during container rebuilds
- Admin can view last 30 days of script execution history
- Average time to debug script issues reduced by 80%

---

## Current Architecture

### Scheduler Implementation (`backend/scheduler.js`)

```javascript
// Current behavior (lines 112-125)
const child = spawn('node', [scriptPath], { env: process.env });

child.stdout.on('data', (data) => {
  console.log(`[${config.name}] ${data}`);  // Lost when container stops
});

child.stderr.on('data', (data) => {
  console.error(`[${config.name}] ERROR: ${data}`);  // Lost when container stops
});
```

**Problems:**
- Output only goes to container logs (volatile)
- No timestamp preservation
- No file-based persistence
- Cannot review historical runs

### Volume Mount Configuration

```yaml
# docker-compose.prod.yml (lines 14-16)
volumes:
  - /opt/linking-coffee/config:/app/config      # Scheduler config (persistent)
  - /opt/linking-coffee/logs:/app/logs          # General logs (persistent)
  - /opt/linking-coffee/backups:/app/backups    # Backups (persistent)
```

**Current Usage:**
- `/app/logs/auth.log` - User authentication events (22KB)
- `/app/logs/debug.log` - Debug messages (67KB)
- `/app/logs/scripts/` - **DOES NOT EXIST YET** ← This is what we're building

---

## Detailed Requirements

### Phase 1: Script Output Capture (HIGH PRIORITY)

#### FR-1.1: Log File Structure

**Requirement:** Create organized directory structure for script logs

```
/opt/linking-coffee/logs/
├── scripts/
│   ├── match-users.log
│   ├── notify-matches.log
│   ├── weekend-feedback.log
│   ├── midweek-checkin.log
│   ├── send-weekly-checkin.log
│   ├── backup-airtable.log
│   ├── generate-match-images.log
│   ├── activate-feedback-users.log
│   ├── broadcast-message.log
│   └── weekend-invitation-all.log
├── auth.log                    # Existing
└── debug.log                   # Existing
```

**Acceptance Criteria:**
- [ ] `/logs/scripts/` directory created automatically if missing
- [ ] One log file per script (named after script file)
- [ ] Directory has correct permissions (755)
- [ ] Logs persist across container rebuilds

#### FR-1.2: Log Entry Format

**Requirement:** Standardized, parseable log format

```
[TIMESTAMP] [LEVEL] [PID] Message content
[2025-12-27T14:30:45.123Z] [INFO] [12345] Starting match-users script
[2025-12-27T14:30:47.890Z] [INFO] [12345] Found 42 active members
[2025-12-27T14:31:02.456Z] [ERROR] [12345] Failed to generate intro: API timeout
[2025-12-27T14:32:15.789Z] [INFO] [12345] Script completed in 90.2s (exit code: 0)
```

**Fields:**
- **TIMESTAMP**: ISO 8601 format with milliseconds
- **LEVEL**: INFO, WARN, ERROR, DEBUG
- **PID**: Process ID (for tracking concurrent runs)
- **Message**: Original stdout/stderr content

**Acceptance Criteria:**
- [ ] All log entries follow consistent format
- [ ] Timestamps are in UTC (server timezone)
- [ ] Process ID captured for correlation
- [ ] Original message content preserved exactly

#### FR-1.3: Scheduler Enhancement

**Requirement:** Modify `scheduler.js` to write script output to files

**Implementation Location:** `backend/scheduler.js` - `runJob()` method (lines 100-135)

**Changes Required:**

1. **Create log file stream:**
```javascript
const scriptLogPath = path.join(__dirname, 'logs', 'scripts', `${config.script}.log`);
const logStream = fs.createWriteStream(scriptLogPath, { flags: 'a' }); // append mode
```

2. **Log execution start:**
```javascript
const startTime = Date.now();
const logEntry = `[${new Date().toISOString()}] [INFO] [${child.pid}] Starting ${config.name}\n`;
logStream.write(logEntry);
console.log(logEntry.trim()); // Also to console
```

3. **Capture stdout with timestamps:**
```javascript
child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    const logEntry = `[${new Date().toISOString()}] [INFO] [${child.pid}] ${line}\n`;
    logStream.write(logEntry);
    console.log(logEntry.trim());
  });
});
```

4. **Capture stderr separately:**
```javascript
child.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    const logEntry = `[${new Date().toISOString()}] [ERROR] [${child.pid}] ${line}\n`;
    logStream.write(logEntry);
    console.error(logEntry.trim());
  });
});
```

5. **Log completion with stats:**
```javascript
child.on('close', (code) => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const status = code === 0 ? 'SUCCESS' : 'FAILED';
  const logEntry = `[${new Date().toISOString()}] [INFO] [${child.pid}] Script completed in ${duration}s (exit code: ${code}) - ${status}\n`;
  logStream.write(logEntry);
  console.log(logEntry.trim());

  logStream.end(); // Close stream

  // Update config with last run info
  config.lastRun = new Date().toISOString();
  config.lastStatus = status;
  this.saveConfig();
});
```

**Acceptance Criteria:**
- [ ] Script output written to individual log files
- [ ] Both stdout and stderr captured
- [ ] Execution metadata logged (start, duration, exit code)
- [ ] Original console logging preserved (for Docker logs)
- [ ] Graceful fallback if log file can't be created
- [ ] No breaking changes to existing scheduler functionality

#### FR-1.4: Error Handling

**Requirement:** Robust error handling for log operations

**Scenarios:**

1. **Log directory missing:**
   - Auto-create `/logs/scripts/` with `fs.mkdirSync(recursive: true)`
   - Log warning if creation fails

2. **Disk full:**
   - Catch ENOSPC error
   - Fall back to console-only logging
   - Send admin notification (future enhancement)

3. **Permission denied:**
   - Log error to console
   - Continue script execution
   - Don't fail the job

**Acceptance Criteria:**
- [ ] Scheduler doesn't crash on log errors
- [ ] Scripts execute even if logging fails
- [ ] Errors logged to debug.log

---

### Phase 2: Log Rotation (MEDIUM PRIORITY)

#### FR-2.1: Size-Based Rotation

**Requirement:** Rotate logs when they exceed size threshold

**Configuration:**
- Max log file size: 10 MB (configurable via env var)
- Rotation naming: `script-name.log.1`, `script-name.log.2`, etc.
- Keep last 5 rotations

**Implementation:** `backend/utils/logRotation.js` (NEW FILE)

```javascript
const MAX_LOG_SIZE = process.env.MAX_LOG_SIZE || 10 * 1024 * 1024; // 10MB
const MAX_ROTATIONS = process.env.MAX_ROTATIONS || 5;

function rotateLogIfNeeded(logPath) {
  const stats = fs.statSync(logPath);
  if (stats.size > MAX_LOG_SIZE) {
    // Rotate: log → log.1, log.1 → log.2, etc.
    for (let i = MAX_ROTATIONS - 1; i > 0; i--) {
      const oldPath = `${logPath}.${i}`;
      const newPath = `${logPath}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    }
    fs.renameSync(logPath, `${logPath}.1`);
  }
}
```

**Acceptance Criteria:**
- [ ] Logs rotate at 10MB threshold
- [ ] Old logs preserved with .1, .2, etc. suffix
- [ ] Oldest rotation deleted when limit exceeded
- [ ] Active log file always has canonical name

#### FR-2.2: Time-Based Cleanup

**Requirement:** Delete logs older than retention period

**Configuration:**
- Default retention: 30 days
- Configurable via env var: `LOG_RETENTION_DAYS`
- Runs daily at 3 AM UTC

**Cleanup Logic:**
```javascript
function cleanupOldLogs() {
  const cutoffDate = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const logsDir = path.join(__dirname, '../logs/scripts');

  fs.readdirSync(logsDir).forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtime.getTime() < cutoffDate) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old log: ${file}`);
    }
  });
}
```

**Cron Schedule:** Add to `scheduler.json`
```json
{
  "name": "Log Cleanup",
  "script": "../utils/logRotation.js",
  "cron": "0 3 * * *",
  "enabled": true
}
```

**Acceptance Criteria:**
- [ ] Logs older than 30 days automatically deleted
- [ ] Cleanup runs daily without manual intervention
- [ ] Deletion logged to debug.log
- [ ] Doesn't delete currently active log files

#### FR-2.3: Compression (OPTIONAL)

**Requirement:** Compress rotated logs to save disk space

**Implementation:**
```javascript
const zlib = require('zlib');

function compressRotatedLog(logPath) {
  const gzip = zlib.createGzip();
  const source = fs.createReadStream(logPath);
  const destination = fs.createWriteStream(`${logPath}.gz`);

  source.pipe(gzip).pipe(destination).on('finish', () => {
    fs.unlinkSync(logPath); // Delete uncompressed version
  });
}
```

**Acceptance Criteria:**
- [ ] Rotated logs compressed to .gz format
- [ ] Original files deleted after successful compression
- [ ] Typical compression ratio: 80-90% size reduction

---

### Phase 3: Admin API Endpoints (HIGH PRIORITY)

#### FR-3.1: List Script Logs

**Endpoint:** `GET /api/admin/logs/scripts`

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "script": "match-users.log",
      "size": 1234567,
      "lastModified": "2025-12-27T14:30:00Z",
      "lines": 8432
    },
    {
      "script": "notify-matches.log",
      "size": 987654,
      "lastModified": "2025-12-27T10:15:00Z",
      "lines": 5621
    }
  ]
}
```

**Implementation:** `backend/server.js`

```javascript
app.get('/api/admin/logs/scripts', async (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'logs', 'scripts');
    const files = fs.readdirSync(logsDir);

    const logs = files.map(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;

      return {
        script: file,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        lines: lines
      };
    });

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

**Acceptance Criteria:**
- [ ] Returns list of all script log files
- [ ] Includes file metadata (size, last modified, line count)
- [ ] Requires admin authentication
- [ ] Returns 500 on error with message

#### FR-3.2: View Script Log

**Endpoint:** `GET /api/admin/logs/scripts/:scriptName`

**Query Parameters:**
- `offset` (optional): Line number to start from (default: 0)
- `limit` (optional): Number of lines to return (default: 100, max: 1000)
- `search` (optional): Filter lines containing search term

**Response:**
```json
{
  "success": true,
  "script": "match-users.log",
  "totalLines": 8432,
  "offset": 0,
  "limit": 100,
  "lines": [
    "[2025-12-27T14:30:45.123Z] [INFO] [12345] Starting match-users script",
    "[2025-12-27T14:30:47.890Z] [INFO] [12345] Found 42 active members"
  ],
  "hasMore": true
}
```

**Implementation:**
```javascript
app.get('/api/admin/logs/scripts/:scriptName', async (req, res) => {
  try {
    const { scriptName } = req.params;
    const { offset = 0, limit = 100, search = '' } = req.query;

    const logPath = path.join(__dirname, 'logs', 'scripts', scriptName);
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const content = fs.readFileSync(logPath, 'utf8');
    let lines = content.split('\n').filter(line => line.trim());

    // Apply search filter
    if (search) {
      lines = lines.filter(line => line.includes(search));
    }

    const totalLines = lines.length;
    const pageLines = lines.slice(offset, offset + Math.min(limit, 1000));

    res.json({
      success: true,
      script: scriptName,
      totalLines,
      offset: parseInt(offset),
      limit: parseInt(limit),
      lines: pageLines,
      hasMore: offset + pageLines.length < totalLines
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

**Acceptance Criteria:**
- [ ] Returns paginated log content
- [ ] Supports search filtering
- [ ] Returns 404 if log file doesn't exist
- [ ] Requires admin authentication
- [ ] Max limit enforced (1000 lines)

#### FR-3.3: Tail Script Log

**Endpoint:** `GET /api/admin/logs/scripts/:scriptName/tail`

**Query Parameters:**
- `lines` (optional): Number of lines from end (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "script": "match-users.log",
  "lines": [
    "[2025-12-27T14:32:10.456Z] [INFO] [12345] Created 21 matches",
    "[2025-12-27T14:32:15.789Z] [INFO] [12345] Script completed in 90.2s (exit code: 0)"
  ]
}
```

**Use Case:** Monitor currently running scripts

**Acceptance Criteria:**
- [ ] Returns last N lines efficiently
- [ ] Doesn't load entire file into memory
- [ ] Updates in near real-time (< 2s delay)

#### FR-3.4: Download Script Log

**Endpoint:** `GET /api/admin/logs/scripts/:scriptName/download`

**Response:** File download with appropriate headers

```javascript
app.get('/api/admin/logs/scripts/:scriptName/download', async (req, res) => {
  try {
    const { scriptName } = req.params;
    const logPath = path.join(__dirname, 'logs', 'scripts', scriptName);

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    res.download(logPath, scriptName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

**Acceptance Criteria:**
- [ ] Triggers browser download
- [ ] Correct filename in download
- [ ] Supports .gz compressed logs

---

### Phase 4: Admin Dashboard UI (MEDIUM PRIORITY)

#### FR-4.1: Script Logs Tab

**Location:** `frontend/src/pages/AdminHealth.js`

**Add new section under Logs tab:**

```jsx
{activeTab === 'logs' && (
  <div className="logs-view">
    <div className="logs-tabs">
      <button onClick={() => setLogType('system')}>System Logs</button>
      <button onClick={() => setLogType('scripts')} className="active">Script Logs</button>
    </div>

    {logType === 'scripts' && (
      <div className="script-logs">
        <div className="script-selector">
          <select value={selectedScript} onChange={(e) => loadScriptLog(e.target.value)}>
            <option value="">Select a script...</option>
            {scriptLogs.map(log => (
              <option key={log.script} value={log.script}>
                {log.script} ({(log.size / 1024).toFixed(1)} KB, {log.lines} lines)
              </option>
            ))}
          </select>

          <div className="log-actions">
            <button onClick={() => downloadLog(selectedScript)}>Download</button>
            <button onClick={() => refreshLog(selectedScript)}>Refresh</button>
            <label>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh (5s)
            </label>
          </div>
        </div>

        <div className="log-search">
          <input
            type="text"
            placeholder="Search in log..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="log-content">
          <pre>{scriptLogContent}</pre>
        </div>

        <div className="log-pagination">
          <button onClick={loadPrevious} disabled={offset === 0}>Previous</button>
          <span>Lines {offset + 1} - {offset + currentLines.length} of {totalLines}</span>
          <button onClick={loadNext} disabled={!hasMore}>Next</button>
        </div>
      </div>
    )}
  </div>
)}
```

**Features:**
- Dropdown to select script
- Search box to filter log lines
- Download button for full log
- Refresh button for manual update
- Auto-refresh toggle (5-second interval)
- Pagination controls

**Acceptance Criteria:**
- [ ] Can select any script log from dropdown
- [ ] Search highlights matching lines
- [ ] Download triggers file download
- [ ] Auto-refresh updates content every 5 seconds
- [ ] Pagination works correctly
- [ ] Mobile responsive design

#### FR-4.2: Log Viewer Styling

**CSS Requirements:** `frontend/src/pages/AdminHealth.css`

```css
.script-logs {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.script-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.script-selector select {
  flex: 1;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.log-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.log-search input {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.log-content {
  background: #1f2937;
  color: #f3f4f6;
  padding: 15px;
  border-radius: 4px;
  max-height: 600px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.log-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.log-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

**Acceptance Criteria:**
- [ ] Dark theme for log content (terminal-like)
- [ ] Monospace font for readability
- [ ] Scrollable log viewer
- [ ] Responsive on mobile devices

---

## Technical Specifications

### File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| Scheduler | `/backend/scheduler.js` | Enhanced to write logs |
| Log Rotation | `/backend/utils/logRotation.js` | NEW: Rotation logic |
| API Endpoints | `/backend/server.js` | Add script log endpoints |
| UI Component | `/frontend/src/pages/AdminHealth.js` | Script logs viewer |
| CSS Styles | `/frontend/src/pages/AdminHealth.css` | Log viewer styling |
| Log Directory | `/backend/logs/scripts/` | Persistent log storage |

### Environment Variables

```bash
# .env additions
MAX_LOG_SIZE=10485760              # 10MB in bytes
MAX_ROTATIONS=5                    # Keep 5 rotated versions
LOG_RETENTION_DAYS=30              # Delete after 30 days
ENABLE_LOG_COMPRESSION=false       # Compress rotated logs
```

### Dependencies

No new npm packages required. Uses built-in Node.js modules:
- `fs` - File system operations
- `path` - Path manipulation
- `zlib` - Compression (optional)

---

## Implementation Plan

### Sprint 1: Core Logging (Week 1)

**Tasks:**
1. Enhance `scheduler.js` `runJob()` method
   - Create log streams
   - Capture stdout/stderr
   - Add timestamps and formatting
   - Handle errors gracefully

2. Test log persistence
   - Run scripts manually
   - Verify log files created
   - Test container rebuild (logs survive)
   - Verify format correctness

**Deliverables:**
- [ ] All script output logged to files
- [ ] Logs persist across deployments
- [ ] Zero breaking changes

**Estimated Effort:** 4 hours

### Sprint 2: API Endpoints (Week 1)

**Tasks:**
1. Create `/api/admin/logs/scripts` endpoint
2. Create `/api/admin/logs/scripts/:name` endpoint
3. Create `/api/admin/logs/scripts/:name/tail` endpoint
4. Create `/api/admin/logs/scripts/:name/download` endpoint
5. Add authentication checks
6. Test all endpoints with Postman

**Deliverables:**
- [ ] 4 working API endpoints
- [ ] Authentication enforced
- [ ] Error handling complete

**Estimated Effort:** 6 hours

### Sprint 3: Log Rotation (Week 2)

**Tasks:**
1. Create `utils/logRotation.js` module
2. Implement size-based rotation
3. Implement time-based cleanup
4. Add rotation job to scheduler
5. Test rotation with large log files

**Deliverables:**
- [ ] Logs auto-rotate at 10MB
- [ ] Old logs cleaned up after 30 days
- [ ] Daily cleanup job running

**Estimated Effort:** 4 hours

### Sprint 4: Admin UI (Week 2)

**Tasks:**
1. Add Script Logs tab to AdminHealth
2. Create script selector dropdown
3. Implement log viewer with pagination
4. Add search functionality
5. Add download button
6. Add auto-refresh toggle
7. Style log viewer (dark theme)

**Deliverables:**
- [ ] Functional script log viewer
- [ ] Search works correctly
- [ ] Download triggers file save
- [ ] Auto-refresh updates content

**Estimated Effort:** 8 hours

### Total Estimated Effort: 22 hours (~3 days)

---

## Testing Strategy

### Unit Tests

**Scheduler Log Writing:**
```javascript
describe('Scheduler runJob', () => {
  it('should create log file when script runs', async () => {
    const config = { name: 'Test Job', script: 'test-script.js' };
    await scheduler.runJob(config);

    const logPath = path.join(__dirname, 'logs/scripts/test-script.log');
    expect(fs.existsSync(logPath)).toBe(true);
  });

  it('should append timestamps to log entries', async () => {
    // Test implementation
  });

  it('should handle log write errors gracefully', async () => {
    // Test implementation
  });
});
```

### Integration Tests

**API Endpoints:**
```javascript
describe('Script Logs API', () => {
  it('GET /api/admin/logs/scripts should return log list', async () => {
    const res = await request(app).get('/api/admin/logs/scripts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('should require admin authentication', async () => {
    const res = await request(app)
      .get('/api/admin/logs/scripts')
      .set('x-admin-user', 'regular_user');
    expect(res.status).toBe(403);
  });
});
```

### Manual Testing

**Checklist:**
- [ ] Run match-users.js script, verify log created
- [ ] Check log format matches specification
- [ ] Rebuild Docker container, verify logs persist
- [ ] Test API endpoints with Postman
- [ ] View logs in admin dashboard
- [ ] Test pagination with large log files
- [ ] Test search functionality
- [ ] Verify auto-refresh works
- [ ] Test download button
- [ ] Test rotation with 11MB log file
- [ ] Verify cleanup deletes old logs

---

## Deployment Checklist

### Pre-Deployment

- [ ] Create `/opt/linking-coffee/logs/scripts/` on production server
- [ ] Set directory permissions: `chmod 755 /opt/linking-coffee/logs/scripts`
- [ ] Add environment variables to `.env`
- [ ] Test in local Docker environment
- [ ] Review all code changes
- [ ] Update CLAUDE.md with new logging information

### Deployment Steps

1. Commit changes to Git
2. Run `./deploy-prod.sh`
3. Verify scheduler starts without errors
4. Trigger test job via admin dashboard
5. Check log file created in `/opt/linking-coffee/logs/scripts/`
6. Verify API endpoints work
7. Test admin UI log viewer

### Post-Deployment Validation

- [ ] All scheduled jobs create log files
- [ ] Logs survive container restart
- [ ] Admin can view logs in dashboard
- [ ] Search functionality works
- [ ] Download works correctly
- [ ] No errors in backend logs

### Rollback Plan

If issues occur:
1. SSH to server: `ssh root@91.98.235.147`
2. Restore previous version: `cd /opt/linking-coffee && git checkout <previous-commit>`
3. Rebuild: `docker compose -f docker-compose.prod.yml up -d --build`
4. Logs remain intact (volume mounted)

---

## Monitoring & Maintenance

### Health Metrics

**Monitor:**
- Total disk usage of `/opt/linking-coffee/logs/`
- Number of log files
- Average log file size
- Failed rotation attempts
- Failed cleanup attempts

**Alerts:**
- Disk usage > 80%
- Log directory > 1GB
- Rotation failures (3 consecutive)
- Cleanup failures

### Routine Maintenance

**Weekly:**
- Review log file sizes
- Check for anomalies in script output
- Verify rotation is working

**Monthly:**
- Review retention policy (adjust if needed)
- Archive critical logs for compliance
- Test disaster recovery (restore from backup)

---

## Security Considerations

### Access Control

- **API Endpoints:** Require admin authentication (`x-admin-user` header)
- **File Permissions:** Logs directory readable only by application user
- **Path Traversal:** Validate script names to prevent `../` attacks

### Data Privacy

- **PII in Logs:** Scripts should avoid logging sensitive user data
- **Log Retention:** 30-day retention complies with GDPR "right to erasure"
- **Encryption:** Consider encrypting logs at rest (future enhancement)

### Audit Trail

- Log all admin access to script logs
- Record downloads in audit log
- Track who triggered manual script runs

---

## Future Enhancements

### Phase 5: Real-Time Streaming (Optional)

- WebSocket connection for live log tailing
- Server-Sent Events (SSE) for push updates
- Color-coded log levels in UI

### Phase 6: Advanced Analytics (Optional)

- Parse log entries into structured data
- Dashboard charts for execution times
- Failure rate tracking
- Performance trend analysis

### Phase 7: Log Aggregation (Optional)

- Export logs to external service (Loggly, Datadog)
- Centralized log management
- Advanced search with Elasticsearch
- Long-term archival to S3

---

## Appendix

### A. Sample Log File

```
[2025-12-27T08:00:00.123Z] [INFO] [12345] Starting match-users script
[2025-12-27T08:00:01.456Z] [INFO] [12345] Environment: production
[2025-12-27T08:00:02.789Z] [INFO] [12345] Fetching active members from Airtable
[2025-12-27T08:00:05.234Z] [INFO] [12345] Found 42 members with Next_Week_Status=Active
[2025-12-27T08:00:06.567Z] [INFO] [12345] Calculating match scores...
[2025-12-27T08:00:15.890Z] [INFO] [12345] Generated 21 optimal pairs
[2025-12-27T08:00:16.123Z] [INFO] [12345] Creating match records in Airtable
[2025-12-27T08:00:20.456Z] [INFO] [12345] Generating AI intros with Claude Haiku
[2025-12-27T08:00:35.789Z] [WARN] [12345] API rate limit approaching (45/50 requests)
[2025-12-27T08:01:02.123Z] [INFO] [12345] All intros generated successfully
[2025-12-27T08:01:02.456Z] [INFO] [12345] Setting match notifications to Pending
[2025-12-27T08:01:05.789Z] [INFO] [12345] Script completed in 65.7s (exit code: 0) - SUCCESS
```

### B. API Examples

**Get list of logs:**
```bash
curl -H "x-admin-user: admin" \
  https://linked.coffee/api/admin/logs/scripts
```

**View specific log:**
```bash
curl -H "x-admin-user: admin" \
  "https://linked.coffee/api/admin/logs/scripts/match-users.log?offset=0&limit=50"
```

**Search logs:**
```bash
curl -H "x-admin-user: admin" \
  "https://linked.coffee/api/admin/logs/scripts/match-users.log?search=ERROR"
```

**Download log:**
```bash
curl -H "x-admin-user: admin" \
  -o match-users.log \
  https://linked.coffee/api/admin/logs/scripts/match-users.log/download
```

### C. References

- [Node.js fs module documentation](https://nodejs.org/api/fs.html)
- [Docker volumes best practices](https://docs.docker.com/storage/volumes/)
- [Log rotation strategies](https://www.loggly.com/ultimate-guide/log-rotation/)
- [Structured logging guide](https://www.honeycomb.io/blog/structured-logging-guide)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-27 | System | Initial PRD creation |

---

**Approval:**

- [ ] Product Owner: _________________ Date: _______
- [ ] Tech Lead: _________________ Date: _______
- [ ] DevOps: _________________ Date: _______
