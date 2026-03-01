const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { sendCriticalAlert } = require('./utils/alerting');
const { recordScriptFailure, recordScriptSuccess } = require('./utils/alertState');

const DEFAULT_TIMEOUT = 300000; // 5 minutes
const FORCE_KILL_DELAY = 5000;  // 5 seconds after SIGTERM

class Scheduler {
  constructor(defaultConfigFile, runtimeConfigFile) {
    this.defaultConfigFile = defaultConfigFile || path.join(__dirname, 'scheduler.json');
    this.runtimeConfigFile = runtimeConfigFile || this.defaultConfigFile;
    this.jobs = new Map();        // Map<jobName, cronTask>
    this.runningJobs = new Map(); // Map<jobName, { child, startTime, timeout }>
    this.configs = [];
    this.logs = [];
  }

  init() {
    this.loadConfig();
    this.startAll();
  }

  loadConfig() {
    try {
      // Check if runtime config exists and has jobs
      if (fs.existsSync(this.runtimeConfigFile)) {
        try {
          const data = fs.readFileSync(this.runtimeConfigFile, 'utf8');
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.configs = parsed;
            console.log(`📅 Scheduler loaded ${this.configs.length} jobs from runtime config.`);
            return;
          }
          console.warn('⚠️ Runtime config is empty, falling back to default.');
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

  runJob(config, retryCount = 0) {
    const retryLabel = retryCount > 0 ? ` (retry ${retryCount}/${config.maxRetries || 0})` : '';
    console.log(`▶️ Triggering job: ${config.name}${retryLabel}`);
    const scriptPath = path.join(__dirname, 'scripts', config.script);

    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Script not found: ${scriptPath}`);
      return;
    }

    // Prevent running the same job concurrently
    if (this.runningJobs.has(config.name)) {
      console.log(`⏳ Job "${config.name}" is already running. Skipping.`);
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
    }

    const startTime = Date.now();
    const timeout = config.timeout || DEFAULT_TIMEOUT;
    let killed = false;
    let forceKillTimer = null;

    // Spawn process
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname),
      env: { ...process.env, FROM_SCHEDULER: 'true' }
    });

    // Track running job
    this.runningJobs.set(config.name, { child, startTime, timeout });

    // Set up timeout to kill hung processes
    const timer = setTimeout(() => {
      killed = true;
      const timeoutMsg = `[${new Date().toISOString()}] [ERROR] [${child.pid}] TIMEOUT: Script killed after ${timeout / 1000}s\n`;
      if (logStream) {
        logStream.write(timeoutMsg);
      }
      console.error(`[${config.name}] TIMEOUT after ${timeout / 1000}s - killing process`);

      child.kill('SIGTERM');
      // Force kill after delay if SIGTERM doesn't work
      forceKillTimer = setTimeout(() => {
        try {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        } catch (e) {
          // Process may have already exited
        }
      }, FORCE_KILL_DELAY);
    }, timeout);

    // Log execution start
    const startLog = `[${new Date().toISOString()}] [INFO] [${child.pid}] Starting ${config.name}${retryLabel}\n`;
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
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      this.runningJobs.delete(config.name);

      try {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const status = killed ? 'TIMEOUT' : (code === 0 ? 'SUCCESS' : 'FAILED');
        const endLog = `[${new Date().toISOString()}] [INFO] [${child.pid}] Script completed in ${duration}s (exit code: ${code}) - ${status}\n`;

        if (logStream) {
          logStream.write(endLog);
          logStream.end();
        }

        console.log(`[${config.name}] finished with code ${code} (${status})`);

        config.lastRun = new Date().toISOString();
        config.lastStatus = status;
        this.saveConfig();

        if (code === 0) {
          recordScriptSuccess(config.script);
          if (retryCount > 0) {
            console.log(`[${config.name}] Succeeded on retry ${retryCount}`);
          }
          return;
        }

        // Handle failure — check if retry is appropriate
        const maxRetries = config.maxRetries || 0;
        if (maxRetries > 0 && retryCount < maxRetries) {
          const baseDelay = config.retryDelayMs || 60000;
          const delay = baseDelay * Math.pow(3, retryCount); // exponential: 1x, 3x, 9x
          const nextRetry = retryCount + 1;

          console.log(`[${config.name}] Scheduling retry ${nextRetry}/${maxRetries} in ${delay / 1000}s`);

          try {
            const retryLog = fs.createWriteStream(scriptLogPath, { flags: 'a' });
            retryLog.write(`[${new Date().toISOString()}] [INFO] Retry ${nextRetry}/${maxRetries} scheduled in ${delay / 1000}s\n`);
            retryLog.end();
          } catch (e) {
            // Non-critical logging error
          }

          setTimeout(() => {
            try {
              console.log(`[${config.name}] Executing retry ${nextRetry}/${maxRetries}`);
              this.runJob(config, nextRetry);
            } catch (retryError) {
              console.error(`[${config.name}] Retry ${nextRetry} failed to start:`, retryError.message);
            }
          }, delay);

          return; // Don't send failure alert yet — wait for final retry
        }

        // All retries exhausted (or no retries configured) — alert
        if (process.env.ENABLE_MONITORING !== 'false') {
          recordScriptFailure(config.script);

          const logTail = await this.getLogTail(scriptLogPath, 10);
          const retryInfo = maxRetries > 0 ? `\n**Retries:** ${retryCount}/${maxRetries} exhausted` : '';

          await sendCriticalAlert(
            killed ? 'Script Timeout' : 'Script Failure',
            `**Script:** ${config.name}\n` +
            `**File:** ${config.script}\n` +
            `**Exit Code:** ${code}\n` +
            `**Status:** ${status}\n` +
            `**Duration:** ${duration}s${retryInfo}\n` +
            `**Time:** ${new Date().toISOString()}\n\n` +
            `**Last 10 Lines of Log:**\n\`\`\`\n${logTail}\n\`\`\``,
            { scriptName: config.script }
          );
        }
      } catch (closeError) {
        console.error(`[${config.name}] Error in close handler:`, closeError.message);
      }
    });

    // Add error handler for spawn failures
    child.on('error', async (error) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      this.runningJobs.delete(config.name);
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

  // Health status for monitoring
  getHealthStatus() {
    const now = Date.now();
    const jobStatuses = this.configs.map(config => {
      const running = this.runningJobs.get(config.name);
      return {
        name: config.name,
        enabled: config.enabled,
        lastRun: config.lastRun,
        lastStatus: config.lastStatus,
        isRunning: !!running,
        runningForSec: running
          ? Math.round((now - running.startTime) / 1000)
          : null
      };
    });

    // Detect stuck jobs: running longer than 2x their configured timeout
    const stuckJobs = jobStatuses.filter(j => {
      if (!j.isRunning) return false;
      const config = this.configs.find(c => c.name === j.name);
      const timeout = config?.timeout || DEFAULT_TIMEOUT;
      return j.runningForSec * 1000 > timeout * 2;
    });

    return {
      healthy: stuckJobs.length === 0,
      uptime: Math.round(process.uptime()),
      jobCount: this.configs.length,
      enabledCount: this.configs.filter(c => c.enabled).length,
      runningCount: this.runningJobs.size,
      stuckJobs: stuckJobs.map(j => j.name),
      jobs: jobStatuses
    };
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
