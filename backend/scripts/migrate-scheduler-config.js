/**
 * Migrate Scheduler Config
 *
 * One-time migration script that merges new fields (timeout, maxRetries, retryDelayMs)
 * from the default scheduler config into the runtime config, preserving production-specific
 * values (lastRun, lastStatus, enabled, cron).
 *
 * Usage:
 *   node backend/scripts/migrate-scheduler-config.js [--dry-run]
 *
 * Run once after deploying the reliability improvements.
 */
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const defaultPath = path.join(__dirname, '..', 'scheduler.json');
const runtimePath = path.join(__dirname, '..', 'config', 'scheduler.json');

// Fields to merge from default into runtime (only if missing in runtime)
const MERGE_FIELDS = ['timeout', 'maxRetries', 'retryDelayMs', 'description'];

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  console.log('Scheduler Config Migration');
  console.log(`  Default config: ${defaultPath}`);
  console.log(`  Runtime config: ${runtimePath}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  const defaults = loadJSON(defaultPath);
  const runtime = loadJSON(runtimePath);

  // Build lookup from default configs by script name
  const defaultByScript = {};
  for (const job of defaults) {
    defaultByScript[job.script] = job;
  }

  let changes = 0;

  // Merge new fields into runtime jobs
  const updated = runtime.map(runtimeJob => {
    const defaultJob = defaultByScript[runtimeJob.script];
    if (!defaultJob) {
      console.log(`  [skip] ${runtimeJob.name} (${runtimeJob.script}) — no default config found`);
      return runtimeJob;
    }

    const merged = { ...runtimeJob };
    const jobChanges = [];

    for (const field of MERGE_FIELDS) {
      if (merged[field] === undefined && defaultJob[field] !== undefined) {
        merged[field] = defaultJob[field];
        jobChanges.push(`${field}=${defaultJob[field]}`);
      }
    }

    if (jobChanges.length > 0) {
      console.log(`  [update] ${runtimeJob.name}: added ${jobChanges.join(', ')}`);
      changes += jobChanges.length;
    } else {
      console.log(`  [ok] ${runtimeJob.name}: already up to date`);
    }

    return merged;
  });

  // Check for default jobs not in runtime
  for (const defaultJob of defaults) {
    const exists = runtime.some(r => r.script === defaultJob.script);
    if (!exists) {
      console.log(`  [new] ${defaultJob.name} (${defaultJob.script}) — exists in default but not in runtime, skipping`);
    }
  }

  console.log('');
  console.log(`Total changes: ${changes}`);

  if (changes === 0) {
    console.log('Nothing to update.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDry run — no changes written. Run without --dry-run to apply.');
    return;
  }

  // Backup current runtime config
  const backupPath = runtimePath + '.backup-' + Date.now();
  fs.copyFileSync(runtimePath, backupPath);
  console.log(`Backup saved: ${backupPath}`);

  // Write updated config
  fs.writeFileSync(runtimePath, JSON.stringify(updated, null, 2));
  console.log(`Runtime config updated: ${runtimePath}`);
}

main();
