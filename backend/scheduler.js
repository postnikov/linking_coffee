const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class Scheduler {
  constructor(configFile) {
    this.configFile = configFile;
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
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.configs = JSON.parse(data);
        console.log(`📅 Scheduler loaded ${this.configs.length} jobs from config.`);
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
      fs.writeFileSync(this.configFile, JSON.stringify(this.configs, null, 2));
      console.log('💾 Scheduler config saved.');
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

    // Spawn process
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname), // Scripts run from backend root usually? Or backend/scripts? 
      // Existing scripts seem to expect running from backend root based on "node backend/scripts/..." usage in package.json
      // Let's assume we run them same as `node scripts/xxx.js` from backend dir.
      env: { ...process.env, FROM_SCHEDULER: 'true' }
    });

    child.stdout.on('data', (data) => {
      console.log(`[${config.name}] ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[${config.name}] ERROR: ${data}`);
    });

    child.on('close', (code) => {
      console.log(`[${config.name}] finished with code ${code}`);
      config.lastRun = new Date().toISOString();
      config.lastStatus = code === 0 ? 'Success' : 'Failed';
      this.saveConfig(); // Persist last run status (optional, maybe too much IO?)
      // Actually modifying the config file on every run might be risky if concurrent edits happen.
      // For now, let's keep runtime state in memory or separate status file? 
      // The requirement says "modify cron", implies config editing. 
      // Let's blindly save for now, but be aware.
    });
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
