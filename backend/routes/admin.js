const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const base = require('../shared/base');
const { adminLimiter } = require('../shared/limiters');
const { checkAdmin } = require('../shared/middleware');
const { logDebug } = require('../shared/logging');
const { LOG_DIR, SCRIPTS_DIR, BACKUP_DIR } = require('../shared/config');
const statisticsUtils = require('../utils/statistics');
const { sanitizeUsername } = require('../utils/airtable-sanitizer');
const { getBotInstance } = require('../utils/alerting');

// Read scheduler config directly from file (used when scheduler runs in separate container)
const SCHEDULER_CONFIG_FILE = path.join(__dirname, '..', 'config', 'scheduler.json');
const DEFAULT_SCHEDULER_CONFIG = path.join(__dirname, '..', 'scheduler.json');

function readSchedulerConfig() {
  try {
    const configPath = fs.existsSync(SCHEDULER_CONFIG_FILE)
      ? SCHEDULER_CONFIG_FILE
      : DEFAULT_SCHEDULER_CONFIG;
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read scheduler config:', e.message);
    return [];
  }
}

function writeSchedulerConfig(configs) {
  const dir = path.dirname(SCHEDULER_CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SCHEDULER_CONFIG_FILE, JSON.stringify(configs, null, 2));
}

module.exports = function createAdminRouter(scheduler, projectConfig) {
  const router = require('express').Router();

  // Admin Data (users + matches overview)
  router.get('/api/admin/data', async (req, res) => {
    const { requester } = req.query;

    if (!requester) {
      return res.status(400).json({ success: false, message: 'Requester is required' });
    }

    const cleanRequester = requester.replace('@', '').trim().toLowerCase();

    try {
      // 1. Verify Admin Status
      const requesterRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${cleanRequester}'`,
          maxRecords: 1
        })
        .firstPage();

      const isRequesterAdmin = requesterRecord.length > 0 && requesterRecord[0].fields.Status === 'Admin';

      if (!isRequesterAdmin) {
        return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
      }

      // 2. Fetch Users with Consent_GDPR
      const usersRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: '{Consent_GDPR}',
          sort: [{ field: 'Created_At', direction: 'desc' }]
        })
        .all();

      const users = usersRecords.map(r => ({
        id: r.id,
        name: r.fields.Name,
        family: r.fields.Family,
        username: r.fields.Tg_Username
      }));

      // 3. Fetch Recent Matches (Last 500)
      // Instead of strict "current week" filtering which is timezone-fragile, we fetch the latest matches.
      // The frontend can display the 'Week_Start' to clarify which week it is.
      const matchesRecords = await base('tblx2OEN5sSR1xFI2')
        .select({
          sort: [{ field: 'Week_Start', direction: 'desc' }],
          maxRecords: 500
        })
        .all();

      const matches = await Promise.all(matchesRecords.map(async (m) => {
        const m1Id = m.fields.Member1 ? m.fields.Member1[0] : null;
        const m2Id = m.fields.Member2 ? m.fields.Member2[0] : null;

        const findUser = (id) => usersRecords.find(u => u.id === id);
        const u1 = findUser(m1Id);
        const u2 = findUser(m2Id);

        return {
          id: m.id,
          weekStart: m.fields.Week_Start,
          introImage: m.fields.Intro_Image && m.fields.Intro_Image.length > 0 ? m.fields.Intro_Image[0].url : null,
          member1: {
            name: u1 ? u1.fields.Name : 'Unknown',
            username: u1 ? u1.fields.Tg_Username : ''
          },
          member2: {
            name: u2 ? u2.fields.Name : 'Unknown',
            username: u2 ? u2.fields.Tg_Username : ''
          },
          status: m.fields.Status
        };
      }));

      res.json({ success: true, users, matches });

    } catch (error) {
      console.error('Admin data error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch admin data' });
    }
  });

  // Bot Health Check
  router.post('/api/admin/bot/test', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const bot = getBotInstance();
      const me = await bot.telegram.getMe();

      // Optional: Send a test message to the admin if chat ID is available
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, `🤖 Bot Health Check: Online as @${me.username}`);
      }

      res.json({
        success: true,
        bot: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        message: 'Bot is online and responding.'
      });
    } catch (error) {
      console.error('Bot Health Check Failed:', error);
      res.status(500).json({ success: false, message: `Bot check failed: ${error.message}` });
    }
  });

  // Logs
  router.get('/api/admin/logs', adminLimiter, checkAdmin, (req, res) => {
    const files = [];

    if (fs.existsSync(LOG_DIR)) {
      try {
        const items = fs.readdirSync(LOG_DIR);
        items.forEach(f => {
          const filePath = path.join(LOG_DIR, f);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            files.push({
              name: f,
              path: `logs/${f}`,
              size: stats.size,
              mtime: stats.mtime
            });
          }
        });

        // Sort by modified time, newest first
        files.sort((a, b) => b.mtime - a.mtime);

      } catch (e) {
        console.error('Error listing log files:', e);
      }
    }

    res.json({ success: true, files });
  });

  router.get('/api/admin/logs/view', adminLimiter, checkAdmin, (req, res) => {
    const { file } = req.query; // 'debug.log' or 'logs/auth.log'

    if (!file) return res.status(400).json({ message: 'File required' });

    // Basic security: prevent directory traversal
    if (file.includes('..')) return res.status(400).json({ message: 'Invalid file path' });

    const filePath = path.join(LOG_DIR, '..', file);

    if (fs.existsSync(filePath)) {
      // Simple implementation: read file, take last 2000 lines.
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ message: 'Read error' });
        const lines = data.split('\n');
        const tail = lines.slice(-2000).join('\n');
        res.json({ success: true, content: tail });
      });
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  });

  // Script Logs Endpoints
  router.get('/api/admin/logs/scripts', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const logsDir = path.join(LOG_DIR, 'scripts');

      if (!fs.existsSync(logsDir)) {
        return res.json({ success: true, logs: [] });
      }

      const files = fs.readdirSync(logsDir);
      const logs = files.map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        // Count lines efficiently
        let lines = 0;
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          lines = content.split('\n').length;
        } catch (e) {
          lines = 0;
        }

        return {
          script: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          lines: lines
        };
      });

      // Sort by last modified, newest first
      logs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      res.json({ success: true, logs });
    } catch (error) {
      console.error('Error listing script logs:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/api/admin/logs/scripts/:scriptName', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const { scriptName } = req.params;
      const { offset = 0, limit = 100, search = '' } = req.query;

      // Security: prevent directory traversal
      if (scriptName.includes('..') || scriptName.includes('/')) {
        return res.status(400).json({ success: false, message: 'Invalid script name' });
      }

      const logPath = path.join(LOG_DIR, 'scripts', scriptName);

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
      const maxLimit = Math.min(parseInt(limit), 1000);
      const pageLines = lines.slice(parseInt(offset), parseInt(offset) + maxLimit);

      res.json({
        success: true,
        script: scriptName,
        totalLines,
        offset: parseInt(offset),
        limit: maxLimit,
        lines: pageLines,
        hasMore: parseInt(offset) + pageLines.length < totalLines
      });
    } catch (error) {
      console.error('Error reading script log:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/api/admin/logs/scripts/:scriptName/tail', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const { scriptName } = req.params;
      const { lines = 100 } = req.query;

      // Security: prevent directory traversal
      if (scriptName.includes('..') || scriptName.includes('/')) {
        return res.status(400).json({ success: false, message: 'Invalid script name' });
      }

      const logPath = path.join(LOG_DIR, 'scripts', scriptName);

      if (!fs.existsSync(logPath)) {
        return res.status(404).json({ success: false, message: 'Log file not found' });
      }

      const content = fs.readFileSync(logPath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      const maxLines = Math.min(parseInt(lines), 1000);
      const tailLines = allLines.slice(-maxLines);

      res.json({
        success: true,
        script: scriptName,
        lines: tailLines
      });
    } catch (error) {
      console.error('Error tailing script log:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/api/admin/logs/scripts/:scriptName/download', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const { scriptName } = req.params;

      // Security: prevent directory traversal
      if (scriptName.includes('..') || scriptName.includes('/')) {
        return res.status(400).json({ success: false, message: 'Invalid script name' });
      }

      const logPath = path.join(LOG_DIR, 'scripts', scriptName);

      if (!fs.existsSync(logPath)) {
        return res.status(404).json({ success: false, message: 'Log file not found' });
      }

      res.download(logPath, scriptName);
    } catch (error) {
      console.error('Error downloading script log:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Statistics
  router.get('/api/admin/statistics', adminLimiter, checkAdmin, async (req, res) => {
    try {
      const period = parseInt(req.query.period) || 30;

      // Validate period
      if (period < 1 || period > 365) {
        return res.status(400).json({
          success: false,
          message: 'Period must be between 1 and 365 days'
        });
      }

      console.log(`📊 Fetching statistics for ${period} days...`);

      // Fetch data from Airtable in parallel
      const [membersRecords, matchesRecords, countriesRecords, citiesRecords] = await Promise.all([
        // Members with Consent_GDPR
        base(process.env.AIRTABLE_MEMBERS_TABLE).select({
          filterByFormula: '{Consent_GDPR}',
          fields: [
            'Created_At', 'Tg_ID', 'Linkedin_ID', 'Status',
            'Name', 'Family', 'Avatar', 'Profession', 'Grade',
            'Professional_Description', 'Personal_Description',
            'Languages', 'Professional_Interests', 'Personal_Interests',
            'Coffee_Goals', 'Countries', 'City_Link', 'Time_Zone',
            'Best_Meetings_Days', 'Next_Week_Status', 'Current_Week_Status'
          ]
        }).all(),

        // Matches within period (fetch all to get historical data)
        base(process.env.AIRTABLE_MATCHES_TABLE).select({
          fields: [
            'Week_Start', 'Member1', 'Member2', 'Status',
            'We_Met_1', 'We_Met_2', 'Feedback1', 'Feedback2',
            'Notifications', 'Midweek_Checkin', 'Weekend_Checkin'
          ]
        }).all(),

        // Countries for geographic analysis
        base(process.env.AIRTABLE_COUNTRIES_TABLE).select({
          fields: ['ISO_Code', 'Name_en']
        }).all(),

        // Cities for geographic analysis
        base(process.env.AIRTABLE_CITIES_TABLE).select({
          fields: ['Slug', 'name_en', 'country_iso']
        }).all()
      ]);

      console.log(`✅ Fetched ${membersRecords.length} members, ${matchesRecords.length} matches`);

      // Create lookup maps for countries and cities
      const countriesMap = new Map(countriesRecords.map(r => [r.id, r]));
      const citiesMap = new Map(citiesRecords.map(r => [r.id, r]));

      // Calculate all statistics in parallel
      const [
        dailyMetrics,
        weeklyMetrics,
        profileCompletion,
        matchPerformance,
        userStatus,
        geography,
        languages
      ] = await Promise.all([
        Promise.resolve(statisticsUtils.calculateDailyMetrics(membersRecords, period)),
        Promise.resolve(statisticsUtils.calculateWeeklyMetrics(membersRecords, matchesRecords, period)),
        Promise.resolve(statisticsUtils.analyzeProfileCompletion(membersRecords)),
        Promise.resolve(statisticsUtils.analyzeMatchPerformance(matchesRecords)),
        Promise.resolve(statisticsUtils.analyzeUserStatus(membersRecords)),
        Promise.resolve(statisticsUtils.analyzeGeography(membersRecords, countriesMap, citiesMap)),
        Promise.resolve(statisticsUtils.analyzeLanguages(membersRecords))
      ]);

      // Calculate overview
      const overview = statisticsUtils.calculateOverview(
        membersRecords,
        matchesRecords,
        matchPerformance
      );

      console.log('✅ Statistics calculated successfully');

      res.json({
        success: true,
        data: {
          overview,
          daily: dailyMetrics,
          weekly: weeklyMetrics,
          userStatus,
          profileCompletion,
          geography,
          languages,
          matchPerformance
        }
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: error.message
      });
    }
  });

  // Backups
  router.get('/api/admin/backups', adminLimiter, checkAdmin, (req, res) => {
    // Use the same logic as initialization
    const dir = BACKUP_DIR;
    console.log(`📂 Listing backups from: ${dir}`);

    if (fs.existsSync(dir)) {
      try {
        let fileList = [];
        console.log('✅ Directory exists.');

        // Helper to process a directory
        const processDir = (baseDir, relativePath = '') => {
          const fullPath = path.join(baseDir, relativePath);
          console.log(`🔎 Scanning: ${fullPath}`);

          if (fs.existsSync(fullPath)) {
            const items = fs.readdirSync(fullPath);
            console.log(`📄 Found ${items.length} items in ${relativePath || 'root'}:`, items);

            items.forEach(f => {
              const itemPath = path.join(fullPath, f);
              const stats = fs.statSync(itemPath);
              if (stats.isDirectory()) {
                // Only recurse into 'daily' for now to match script logic
                if (f === 'daily') {
                  processDir(baseDir, path.join(relativePath, f));
                }
              } else {
                fileList.push({
                  name: path.join(relativePath, f), // e.g. "daily/backup.json.gz"
                  size: stats.size,
                  created: stats.birthtime,
                  mtime: stats.mtime
                });
              }
            });
          } else {
            console.log(`❌ Path does not exist: ${fullPath}`);
          }
        };

        processDir(dir);

        console.log(`🏁 Total files found: ${fileList.length}`);
        const files = fileList.sort((a, b) => b.mtime - a.mtime); // Newest first
        res.json({ success: true, files });
      } catch (e) {
        console.error('Backup listing error:', e);
        res.status(500).json({ success: false, message: 'Failed to list backups' });
      }
    } else {
      console.log(`❌ Backup directory not found: ${dir}`);
      res.json({ success: true, files: [], message: 'Backup directory not found' });
    }
  });

  // Scheduler — works with in-process scheduler OR reads shared config file
  router.get('/api/admin/scheduler', adminLimiter, checkAdmin, (req, res) => {
    if (scheduler) {
      return res.json({ success: true, jobs: scheduler.getJobs() });
    }
    const jobs = readSchedulerConfig();
    res.json({ success: true, jobs, external: true });
  });

  router.get('/api/admin/scheduler/health', adminLimiter, checkAdmin, (req, res) => {
    if (scheduler) {
      return res.json({ success: true, ...scheduler.getHealthStatus() });
    }
    const jobs = readSchedulerConfig();
    const enabled = jobs.filter(j => j.enabled).length;
    res.json({ success: true, external: true, totalJobs: jobs.length, enabledJobs: enabled });
  });

  router.post('/api/admin/scheduler', adminLimiter, checkAdmin, (req, res) => {
    const { action, job } = req.body;
    try {
      if (scheduler) {
        if (action === 'add') scheduler.addJob(job);
        else if (action === 'update') scheduler.updateJob(job.name, job);
        else if (action === 'delete') scheduler.deleteJob(job.name);
        return res.json({ success: true, jobs: scheduler.getJobs() });
      }
      // File-based operations for external scheduler
      const configs = readSchedulerConfig();
      if (action === 'add') {
        configs.push(job);
      } else if (action === 'update') {
        const idx = configs.findIndex(c => c.name === job.name);
        if (idx >= 0) configs[idx] = { ...configs[idx], ...job };
      } else if (action === 'delete') {
        const idx = configs.findIndex(c => c.name === job.name);
        if (idx >= 0) configs.splice(idx, 1);
      }
      writeSchedulerConfig(configs);
      res.json({ success: true, jobs: configs, external: true });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/api/admin/scheduler/run', adminLimiter, checkAdmin, (req, res) => {
    if (!scheduler) {
      return res.status(503).json({ success: false, message: 'Run Now requires in-process scheduler. Restart the scheduler container to pick up config changes.' });
    }
    const { name } = req.body;
    if (scheduler.runJobNow(name)) {
      res.json({ success: true, message: 'Job started' });
    } else {
      res.status(404).json({ success: false, message: 'Job not found' });
    }
  });

  // Available scripts
  router.get('/api/admin/scripts', adminLimiter, checkAdmin, (req, res) => {
    if (fs.existsSync(SCRIPTS_DIR)) {
      const files = fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.js'));
      res.json({ success: true, scripts: files });
    } else {
      res.json({ success: true, scripts: [] });
    }
  });

  // Deployment Tests - View test results
  router.get('/api/admin/tests', adminLimiter, checkAdmin, (req, res) => {
    const testLogFile = path.join(LOG_DIR, 'deployment-tests.log');

    if (!fs.existsSync(testLogFile)) {
      return res.json({ logs: '', lastRun: null, fileSize: 0 });
    }

    try {
      const logs = fs.readFileSync(testLogFile, 'utf8');
      const stats = fs.statSync(testLogFile);

      // Parse last test run
      const lines = logs.split('\n').filter(line => line.includes('TEST RUN START'));
      const lastRun = lines.length > 0 ? lines[lines.length - 1].match(/\[(.*?)\]/)?.[1] : null;

      // Return last 100 lines
      const logLines = logs.split('\n');
      const last100 = logLines.slice(-100).join('\n');

      res.json({
        success: true,
        logs: last100,
        lastRun,
        fileSize: stats.size
      });
    } catch (error) {
      console.error('Error reading deployment test logs:', error);
      res.status(500).json({ success: false, message: 'Failed to read test logs' });
    }
  });

  // Deployment Tests - Trigger tests manually
  router.post('/api/admin/tests/run', adminLimiter, checkAdmin, async (req, res) => {
    res.json({ success: true, status: 'started', message: 'Smoke tests initiated' });

    // Run tests in background
    const backendDir = path.join(__dirname, '..');
    const testProcess = spawn('npm', ['test', '--', '--testPathPattern=smoke'], {
      cwd: backendDir,
      env: {
        ...process.env,
        API_URL: 'http://localhost:3001/api',
        FRONTEND_URL: 'http://localhost:8181'
      }
    });

    testProcess.on('exit', (code) => {
      const status = code === 0 ? 'passed' : 'failed';
      console.log(`Smoke tests ${status} (exit code: ${code})`);
    });
  });

  // Admin Config
  router.get('/api/admin/config', (req, res) => {
    // Basic security check (same as run-matching)
    res.json({ success: true, config: projectConfig });
  });

  // --- Admin: Run AI Matching Script ---
  router.get('/api/admin/run-matching', async (req, res) => {
    const { dryRun, model } = req.query; // e.g. ?dryRun=true&model=gemini-1.5-pro

    console.log(`🚀 API Request: Run Matching (DryRun: ${dryRun}, Model: ${model})`);

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const scriptArgs = [path.join(SCRIPTS_DIR, 'match-users-ai.js')];
    if (dryRun === 'true') scriptArgs.push('--dry-run');
    if (model) scriptArgs.push(`--model=${model}`);

    const child = spawn('node', scriptArgs, {
      cwd: path.join(__dirname, '..'), // Run from backend dir
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    // Heartbeat to keep connection alive during long AI waits
    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 15000); // Ping every 15s

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
        }
      });
    });

    child.on('close', (code) => {
      clearInterval(heartbeat);
      res.write(`data: ${JSON.stringify({ type: 'done', code: code })}\n\n`);
      res.end();
    });
  });

  // --- Admin: Regenerate Match Image ---
  router.post('/api/admin/regenerate-image', async (req, res) => {
    const { matchId } = req.body;
    if (!matchId) {
      return res.status(400).json({ success: false, message: 'Missing matchId' });
    }

    console.log(`♻️  Regenerating image for match ${matchId}...`);

    // Set headers for streaming text
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const scriptPath = path.join(SCRIPTS_DIR, 'generate-match-images.js');

    // Spawn the generation script
    const child = spawn('node', [scriptPath, '--match-id=' + matchId, '--force']);

    // Pipe outputs to response
    child.stdout.on('data', (data) => {
      res.write(data);
    });

    child.stderr.on('data', (data) => {
      res.write(data);
    });

    child.on('close', (code) => {
      res.write(`\n--- Process exited with code ${code} ---`);
      res.end();
    });

    child.on('error', (err) => {
      res.write(`\n❌ Error spawning process: ${err.message}`);
      res.end();
    });
  });

  return router;
};
