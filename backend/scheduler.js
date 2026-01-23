const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { sendCriticalAlert } = require('./utils/alerting');
const { recordScriptFailure, recordScriptSuccess } = require('./utils/alertState');

class Scheduler {
  constructor(defaultConfigFile, runtimeConfigFile) {
    this.defaultConfigFile = defaultConfigFile || path.join(__dirname, 'scheduler.json');
    this.runtimeConfigFile = runtimeConfigFile || this.defaultConfigFile;
    this.jobs = new Map(); // Map<jobName, cronTask>
    this.configs = [];
    this.logs = [];
  }

  init() {
    this.loadConfig();
    this.startAll();
  }

  loadConfig() {
    try {
      // Check if runtime config exists
      if (fs.existsSync(this.runtimeConfigFile)) {
        try {
          const data = fs.readFileSync(this.runtimeConfigFile, 'utf8');
          this.configs = JSON.parse(data);
          console.log(`📅 Scheduler loaded ${this.configs.length} jobs from runtime config.`);
          return;
        } catch (e) {
          console.error('❌ Error loading runtime config, falling back to default:', e);
        }
      }

      // Runtime config doesn't exist or failed to load, use default
      if (fs.existsSync(this.defaultConfigFile)) {
        const data = fs.readFileSync(this.defaultConfigFile, 'utf8');
        this.configs = JSON.parse(data);
        console.log(`📅 Scheduler loaded ${this.configs.length} jobs from default config.`);

        // Copy default to runtime location for future use
        const runtimeDir = path.dirname(this.runtimeConfigFile);
        if (!fs.existsSync(runtimeDir)) {
          fs.mkdirSync(runtimeDir, { recursive: true });
        }
        fs.writeFileSync(this.runtimeConfigFile, JSON.stringify(this.configs, null, 2));
        console.log(`📅 Copied default config to runtime location: ${this.runtimeConfigFile}`);
      } else {
        console.log('📅 No scheduler config found. Starting with empty list.');
        this.configs = [];
      }
    } catch (e) {
      console.error('❌ Error loading scheduler config:', e);
      this.configs = [];
    }
  }

  saveConfig() {
    try {
      // Ensure runtime config directory exists
      const runtimeDir = path.dirname(this.runtimeConfigFile);
      if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true });
      }

      // Always write to runtime config
      fs.writeFileSync(this.runtimeConfigFile, JSON.stringify(this.configs, null, 2));
      console.log('💾 Scheduler config saved to runtime location.');
    } catch (e) {
      console.error('❌ Error saving scheduler config:', e);
    }
  }

  startAll() {
    // Stop existing
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();

    // Start enabled
    this.configs.forEach(config => {
      if (config.enabled) {
        this.scheduleJob(config);
      }
    });
  }

  scheduleJob(config) {
    if (!cron.validate(config.cron)) {
      console.error(`❌ Invalid cron expression for ${config.name}: ${config.cron}`);
      return;
    }

    console.log(`⏰ Scheduling "${config.name}" [${config.cron}] -> ${config.script}`);
    
    // Create cron task
    const task = cron.schedule(config.cron, () => {
      this.runJob(config);
    });

    this.jobs.set(config.name, task);
  }

  runJob(config) {
    console.log(`▶️ Triggering job: ${config.name}`);
    const scriptPath = path.join(__dirname, 'scripts', config.script);

    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Script not found: ${scriptPath}`);
      return;
    }

    // Ensure logs/scripts directory exists
    const logsDir = path.join(__dirname, 'logs', 'scripts');
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (e) {
        console.error('❌ Failed to create script logs directory:', e);
      }
    }

    // Create log file stream
    const scriptLogPath = path.join(logsDir, `${config.script}.log`);
    let logStream = null;

    try {
      logStream = fs.createWriteStream(scriptLogPath, { flags: 'a' }); // append mode
    } catch (e) {
      console.error(`❌ Failed to create log stream for ${config.script}:`, e);
      // Continue execution without file logging
    }

    const startTime = Date.now();

    // Spawn process
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname), // Scripts run from backend root usually? Or backend/scripts?
      // Existing scripts seem to expect running from backend root based on "node backend/scripts/..." usage in package.json
      // Let's assume we run them same as `node scripts/xxx.js` from backend dir.
      env: { ...process.env, FROM_SCHEDULER: 'true' }
    });

    // Log execution start
    const startLog = `[${new Date().toISOString()}] [INFO] [${child.pid}] Starting ${config.name}\n`;
    if (logStream) {
      logStream.write(startLog);
    }
    console.log(startLog.trim());

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const logEntry = `[${new Date().toISOString()}] [INFO] [${child.pid}] ${line}\n`;
        if (logStream) {
          logStream.write(logEntry);
        }
        console.log(`[${config.name}] ${line}`);
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const logEntry = `[${new Date().toISOString()}] [ERROR] [${child.pid}] ${line}\n`;
        if (logStream) {
          logStream.write(logEntry);
        }
        console.error(`[${config.name}] ERROR: ${line}`);
      });
    });

    child.on('close', async (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const status = code === 0 ? 'SUCCESS' : 'FAILED';
      const endLog = `[${new Date().toISOString()}] [INFO] [${child.pid}] Script completed in ${duration}s (exit code: ${code}) - ${status}\n`;

      if (logStream) {
        logStream.write(endLog);
        logStream.end(); // Close stream
      }

      console.log(`[${config.name}] finished with code ${code}`);

      config.lastRun = new Date().toISOString();
      config.lastStatus = status;
      this.saveConfig(); // Persist last run status (optional, maybe too much IO?)

      // Alert on failure
      if (code !== 0 && process.env.ENABLE_MONITORING !== 'false') {
        try {
          // Record failure in state
          recordScriptFailure(config.script);

          // Get last 10 lines of log for context
          const logTail = await this.getLogTail(scriptLogPath, 10);

          // Send critical alert
          await sendCriticalAlert(
            'Script Failure',
            `**Script:** ${config.name}\n` +
            `**File:** ${config.script}\n` +
            `**Exit Code:** ${code}\n` +
            `**Duration:** ${duration}s\n` +
            `**Time:** ${new Date().toISOString()}\n\n` +
            `**📋 Last 10 Lines of Log:**\n\`\`\`\n${logTail}\n\`\`\``,
            { scriptName: config.script }
          );
        } catch (alertError) {
          console.error('❌ Failed to send failure alert:', alertError.message);
        }
      } else if (code === 0) {
        // Record success (resets consecutive failures)
        recordScriptSuccess(config.script);
      }
    });

    // Add error handler for spawn failures
    child.on('error', async (error) => {
      console.error(`[${config.name}] Failed to start: ${error.message}`);

      if (logStream) {
        const errorLog = `[${new Date().toISOString()}] [ERROR] [${child.pid || 'N/A'}] Failed to spawn: ${error.message}\n`;
        logStream.write(errorLog);
        logStream.end();
      }

      if (process.env.ENABLE_MONITORING !== 'false') {
        try {
          await sendCriticalAlert(
            'Script Failed to Start',
            `**Script:** ${config.name}\n` +
            `**File:** ${config.script}\n` +
            `**Error:** ${error.message}\n` +
            `**Time:** ${new Date().toISOString()}`
          );
        } catch (alertError) {
          console.error('❌ Failed to send spawn error alert:', alertError.message);
        }
      }
    });
  }

  // Helper method to read last N lines of log file
  async getLogTail(logPath, numLines = 10) {
    try {
      if (!fs.existsSync(logPath)) return '(Log file not found)';

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const tail = lines.slice(-numLines);
      return tail.join('\n');
    } catch (error) {
      return `(Error reading log: ${error.message})`;
    }
  }

  // Admin API Methods
  getJobs() {
    return this.configs;
  }

  addJob(jobConfig) {
    this.configs.push(jobConfig);
    this.saveConfig();
    if (jobConfig.enabled) {
      this.scheduleJob(jobConfig);
    }
  }

  updateJob(jobName, newConfig) {
    const idx = this.configs.findIndex(c => c.name === jobName);
    if (idx !== -1) {
      const oldConfig = this.configs[idx];
      // Stop old if running
      if (this.jobs.has(oldConfig.name)) {
        this.jobs.get(oldConfig.name).stop();
        this.jobs.delete(oldConfig.name);
      }
      
      this.configs[idx] = newConfig;
      this.saveConfig();
      
      if (newConfig.enabled) {
        this.scheduleJob(newConfig);
      }
    }
  }

  deleteJob(jobName) {
    const idx = this.configs.findIndex(c => c.name === jobName);
    if (idx !== -1) {
      if (this.jobs.has(jobName)) {
        this.jobs.get(jobName).stop();
        this.jobs.delete(jobName);
      }
      this.configs.splice(idx, 1);
      this.saveConfig();
    }
  }

  runJobNow(jobName) {
    const config = this.configs.find(c => c.name === jobName);
    if (config) {
      this.runJob(config);
      return true;
    }
    return false;
  }
}

module.exports = Scheduler;
