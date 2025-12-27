const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_LOG_SIZE = parseInt(process.env.MAX_LOG_SIZE) || 10 * 1024 * 1024; // 10MB default
const MAX_ROTATIONS = parseInt(process.env.MAX_ROTATIONS) || 5;
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
const ENABLE_LOG_COMPRESSION = process.env.ENABLE_LOG_COMPRESSION === 'true';

/**
 * Rotate a log file if it exceeds the size threshold
 * @param {string} logPath - Path to the log file
 */
function rotateLogIfNeeded(logPath) {
  try {
    if (!fs.existsSync(logPath)) {
      return;
    }

    const stats = fs.statSync(logPath);
    if (stats.size <= MAX_LOG_SIZE) {
      return; // No rotation needed
    }

    console.log(`📋 Rotating log file: ${logPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Rotate existing rotated files
    for (let i = MAX_ROTATIONS - 1; i > 0; i--) {
      const oldPath = `${logPath}.${i}`;
      const newPath = `${logPath}.${i + 1}`;

      if (fs.existsSync(oldPath)) {
        if (i + 1 > MAX_ROTATIONS) {
          // Delete the oldest rotation
          fs.unlinkSync(oldPath);
          console.log(`🗑️ Deleted oldest rotation: ${oldPath}`);
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // Rotate the current log file
    fs.renameSync(logPath, `${logPath}.1`);
    console.log(`✅ Log rotated: ${logPath} → ${logPath}.1`);

    // Optionally compress the rotated file
    if (ENABLE_LOG_COMPRESSION) {
      compressRotatedLog(`${logPath}.1`);
    }
  } catch (error) {
    console.error(`❌ Error rotating log ${logPath}:`, error);
  }
}

/**
 * Compress a rotated log file to .gz format
 * @param {string} logPath - Path to the log file to compress
 */
function compressRotatedLog(logPath) {
  try {
    if (!fs.existsSync(logPath)) {
      return;
    }

    console.log(`🗜️ Compressing log file: ${logPath}`);

    const gzip = zlib.createGzip();
    const source = fs.createReadStream(logPath);
    const destination = fs.createWriteStream(`${logPath}.gz`);

    source
      .pipe(gzip)
      .pipe(destination)
      .on('finish', () => {
        // Delete uncompressed version after successful compression
        fs.unlinkSync(logPath);
        console.log(`✅ Log compressed and original deleted: ${logPath}.gz`);
      })
      .on('error', (error) => {
        console.error(`❌ Error compressing log ${logPath}:`, error);
      });
  } catch (error) {
    console.error(`❌ Error compressing log ${logPath}:`, error);
  }
}

/**
 * Delete logs older than the retention period
 * @param {string} logsDir - Directory containing log files
 */
function cleanupOldLogs(logsDir) {
  try {
    if (!fs.existsSync(logsDir)) {
      console.log(`📂 Logs directory does not exist: ${logsDir}`);
      return;
    }

    const cutoffDate = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(logsDir);

    let deletedCount = 0;
    let totalSize = 0;

    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtime.getTime() < cutoffDate) {
        const fileSize = stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
        totalSize += fileSize;
        console.log(`🗑️ Deleted old log: ${file} (${(fileSize / 1024).toFixed(2)} KB)`);
      }
    });

    if (deletedCount > 0) {
      console.log(`✅ Cleanup complete: Deleted ${deletedCount} files (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`);
    } else {
      console.log(`✅ Cleanup complete: No old logs to delete`);
    }
  } catch (error) {
    console.error(`❌ Error cleaning up old logs:`, error);
  }
}

/**
 * Rotate all script logs if needed
 * @param {string} scriptsLogDir - Directory containing script log files
 */
function rotateAllScriptLogs(scriptsLogDir) {
  try {
    if (!fs.existsSync(scriptsLogDir)) {
      console.log(`📂 Script logs directory does not exist: ${scriptsLogDir}`);
      return;
    }

    const files = fs.readdirSync(scriptsLogDir);
    files.forEach(file => {
      const filePath = path.join(scriptsLogDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && file.endsWith('.log')) {
        rotateLogIfNeeded(filePath);
      }
    });
  } catch (error) {
    console.error(`❌ Error rotating script logs:`, error);
  }
}

// If run directly, perform cleanup and rotation
if (require.main === module) {
  const scriptsLogDir = path.join(__dirname, '..', 'logs', 'scripts');

  console.log(`🔄 Starting log maintenance...`);
  console.log(`   Max log size: ${(MAX_LOG_SIZE / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Max rotations: ${MAX_ROTATIONS}`);
  console.log(`   Retention: ${LOG_RETENTION_DAYS} days`);
  console.log(`   Compression: ${ENABLE_LOG_COMPRESSION ? 'Enabled' : 'Disabled'}`);

  // Rotate logs if needed
  rotateAllScriptLogs(scriptsLogDir);

  // Cleanup old logs
  cleanupOldLogs(scriptsLogDir);

  console.log(`✅ Log maintenance complete`);
}

module.exports = {
  rotateLogIfNeeded,
  compressRotatedLog,
  cleanupOldLogs,
  rotateAllScriptLogs
};
