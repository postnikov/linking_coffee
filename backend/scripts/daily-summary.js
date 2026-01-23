/**
 * Daily Summary Script
 *
 * Generates a comprehensive daily summary report including:
 * - Queued warnings from the last 24h
 * - Script execution statistics
 * - System health metrics
 * - Disk space usage
 * - Recent error log patterns
 *
 * Usage:
 *   node backend/scripts/daily-summary.js
 *
 * Environment Variables:
 *   - ENABLE_MONITORING (default: true)
 *
 * Scheduled via scheduler.json:
 *   {"name": "Daily Summary", "script": "daily-summary.js", "cron": "0 9 * * *"}
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getQueuedWarnings, clearWarnings, sendWithRateLimit } = require('../utils/alerting');
const { recordDailySummary, loadState } = require('../utils/alertState');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SCRIPTS_LOG_DIR = path.join(__dirname, '../logs/scripts');

// Check if monitoring enabled
if (process.env.ENABLE_MONITORING === 'false') {
  console.log('⏸️  Monitoring disabled (ENABLE_MONITORING=false)');
  process.exit(0);
}

if (!ADMIN_CHAT_ID) {
  console.error('❌ ADMIN_CHAT_ID not configured');
  process.exit(1);
}

/**
 * Generate daily summary report
 */
async function generateDailySummary() {
  console.log('📊 Generating daily summary...');

  const sections = [];

  // 1. Header
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  sections.push(`🌅 **Daily Summary - ${dateStr}**`);
  sections.push(`━━━━━━━━━━━━━━━━━━━━━━━`);

  // 2. Warnings from queue
  const warnings = getQueuedWarnings();
  if (warnings.length > 0) {
    sections.push(`\n⚠️ **Warnings (${warnings.length})**`);

    // Group by category
    const grouped = warnings.reduce((acc, w) => {
      acc[w.category] = acc[w.category] || [];
      acc[w.category].push(w);
      return acc;
    }, {});

    for (const [category, items] of Object.entries(grouped)) {
      sections.push(`\n**${category}:**`);
      items.forEach(item => {
        sections.push(`• ${item.message}`);
      });
    }
  } else {
    sections.push(`\n✅ **No warnings in the last 24h**`);
  }

  // 3. Script execution statistics
  sections.push(`\n\n📜 **Script Statistics**`);
  const scriptStats = getScriptStats();
  if (scriptStats.total > 0) {
    sections.push(`Total Executions: ${scriptStats.total}`);
    sections.push(`✅ Successful: ${scriptStats.successful}`);
    sections.push(`❌ Failed: ${scriptStats.failed}`);

    if (scriptStats.failed > 0) {
      sections.push(`\n**Failed Scripts:**`);
      for (const [script, count] of Object.entries(scriptStats.failures)) {
        sections.push(`• ${script}: ${count} failure(s)`);
      }
    }
  } else {
    sections.push(`No script executions in last 24h`);
  }

  // 4. System metrics
  sections.push(`\n\n💻 **System Metrics**`);

  // Disk space (macOS/Linux compatible)
  try {
    const diskUsage = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const parts = diskUsage.trim().split(/\s+/);
    const usedPercent = parts[4] || 'N/A';
    const available = parts[3] || 'N/A';

    sections.push(`Disk Usage: ${usedPercent} (${available} free)`);

    // Warn if >80%
    const percent = parseInt(usedPercent);
    if (percent > 80) {
      sections.push(`⚠️ Disk space above 80%!`);
    }
  } catch (error) {
    sections.push(`Disk Usage: Unable to check (${error.message})`);
  }

  // Log directory size
  try {
    const logSize = execSync(
      `du -sh ${path.join(__dirname, '../logs')} | cut -f1`,
      { encoding: 'utf8' }
    ).trim();
    sections.push(`Log Directory Size: ${logSize}`);
  } catch (error) {
    sections.push(`Log Directory Size: Unable to check`);
  }

  // 5. Error log patterns (scan for ERROR, CRITICAL keywords)
  sections.push(`\n\n🔍 **Error Patterns (Last 24h)**`);
  const errorPatterns = scanLogsForErrors();
  if (errorPatterns.length > 0) {
    errorPatterns.forEach(pattern => {
      sections.push(`• ${pattern}`);
    });
  } else {
    sections.push(`No critical errors detected`);
  }

  // 6. State snapshot
  const state = loadState();
  if (state.consecutiveHealthFailures > 0) {
    sections.push(`\n⚠️ Health check failures: ${state.consecutiveHealthFailures}`);
  }

  // 7. Footer
  sections.push(`\n━━━━━━━━━━━━━━━━━━━━━━━`);
  sections.push(`Generated at: ${now.toISOString()}`);

  const summary = sections.join('\n');

  // Send summary
  console.log('📤 Sending daily summary to Telegram...');
  await sendWithRateLimit(ADMIN_CHAT_ID, summary, { parse_mode: 'Markdown' });
  console.log('✅ Daily summary sent');

  // Clear warnings and record summary time
  clearWarnings();
  recordDailySummary();
}

/**
 * Get script execution statistics from logs
 * @returns {object} Statistics object
 */
function getScriptStats() {
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    failures: {}
  };

  try {
    if (!fs.existsSync(SCRIPTS_LOG_DIR)) {
      return stats;
    }

    const now = Date.now();
    const yesterday = now - (24 * 60 * 60 * 1000);

    const files = fs.readdirSync(SCRIPTS_LOG_DIR);

    files.forEach(file => {
      if (!file.endsWith('.log')) return;

      const filePath = path.join(SCRIPTS_LOG_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach(line => {
        // Match completion lines: [TIMESTAMP] [INFO] [PID] Script completed...
        const match = line.match(/\[([^\]]+)\].*Script completed.*\(exit code: (\d+)\) - (\w+)/);
        if (match) {
          const timestamp = new Date(match[1]).getTime();
          if (timestamp >= yesterday) {
            const exitCode = parseInt(match[2]);
            const status = match[3];

            stats.total++;

            if (exitCode === 0) {
              stats.successful++;
            } else {
              stats.failed++;
              const scriptName = file.replace('.log', '');
              stats.failures[scriptName] = (stats.failures[scriptName] || 0) + 1;
            }
          }
        }
      });
    });
  } catch (error) {
    console.error('❌ Error getting script stats:', error);
  }

  return stats;
}

/**
 * Scan logs for error patterns
 * @returns {Array} List of error patterns found
 */
function scanLogsForErrors() {
  const patterns = [];
  const logsDir = path.join(__dirname, '../logs');

  try {
    const now = Date.now();
    const yesterday = now - (24 * 60 * 60 * 1000);

    // Scan auth.log, debug.log, connections.log
    const logFiles = ['auth.log', 'debug.log', 'connections.log'];

    logFiles.forEach(logFile => {
      const logPath = path.join(logsDir, logFile);
      if (!fs.existsSync(logPath)) return;

      const stats = fs.statSync(logPath);
      if (stats.mtime.getTime() < yesterday) return; // Skip old files

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');

      let errorCount = 0;
      let criticalCount = 0;

      lines.forEach(line => {
        if (line.includes('[ERROR]') || line.includes('ERROR:')) errorCount++;
        if (line.includes('[CRITICAL]') || line.includes('CRITICAL:')) criticalCount++;
      });

      if (errorCount > 0 || criticalCount > 0) {
        patterns.push(`${logFile}: ${errorCount} errors, ${criticalCount} critical`);
      }
    });

    // Scan script logs
    if (fs.existsSync(SCRIPTS_LOG_DIR)) {
      const scriptFiles = fs.readdirSync(SCRIPTS_LOG_DIR);

      scriptFiles.forEach(file => {
        if (!file.endsWith('.log')) return;

        const filePath = path.join(SCRIPTS_LOG_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        const errorMatches = content.match(/\[ERROR\]/g) || [];
        if (errorMatches.length > 5) { // Threshold: >5 errors
          patterns.push(`${file}: ${errorMatches.length} errors`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error scanning logs:', error);
  }

  return patterns;
}

// Run summary generation
generateDailySummary()
  .then(() => {
    console.log('✅ Daily summary complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error generating daily summary:', error);
    process.exit(1);
  });
