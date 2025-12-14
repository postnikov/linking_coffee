/**
 * Airtable Backup Script
 *
 * Backs up all data from Airtable to local JSON files (gzipped).
 *
 * Features:
 * - Exports specified tables (Members, Matches, Countries, Cities, Logs)
 * - Saves as .json.gz
 * - Updates latest.json
 * - Cleans up backups older than RETENTION_DAYS
 *
 * Usage:
 *   node backend/scripts/backup-airtable.js [options]
 *
 * Options:
 *   --dry-run     : Show what would be done without writing files
 *   --no-cleanup  : Skip deletion of old backups
 *   --output=PATH : Custom output directory
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const gzip = util.promisify(zlib.gzip);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const unlink = util.promisify(fs.unlink);
const stat = util.promisify(fs.stat);

// Configuration
const CONFIG = {
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_BASE_ID,
    backupDir: process.env.BACKUP_DIR || '/backups/airtable',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
    tables: [
        { name: 'Members', id: 'tblCrnbDupkzWUx9P' },
        { name: 'Countries', id: 'tblTDQuqGDEDTPMLO' },
        { name: 'Cities', id: 'tbllGzaGTz3PsxxWT' },
        { name: 'Matches', id: 'tblx2OEN5sSR1xFI2' },
        { name: 'Logs', id: 'tbln4rLHEgXUkL9Jh' }
    ]
};

// Parse arguments
const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes('--dry-run');
const NO_CLEANUP = args.includes('--no-cleanup');
const customOutputArg = args.find(arg => arg.startsWith('--output='));
if (customOutputArg) {
    CONFIG.backupDir = customOutputArg.split('=')[1];
}

// Ensure backup directories exist
const DAILY_DIR = path.join(CONFIG.backupDir, 'daily');

function ensureDirectories() {
    if (IS_DRY_RUN) return;
    if (!fs.existsSync(CONFIG.backupDir)) fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    if (!fs.existsSync(DAILY_DIR)) fs.mkdirSync(DAILY_DIR, { recursive: true });
}

async function fetchTableRecords(base, tableConfig) {
    console.log(`[${new Date().toISOString()}] INFO: Fetching ${tableConfig.name}...`);
    const records = [];
    try {
        await base(tableConfig.id).select({
            view: 'Grid view' // Default view
        }).eachPage((pageRecords, fetchNextPage) => {
            records.push(...pageRecords.map(r => ({
                id: r.id,
                createdTime: r.createdTime,
                fields: r.fields
            })));
            fetchNextPage();
        });
        console.log(`[${new Date().toISOString()}] INFO: Fetched ${records.length} records from ${tableConfig.name}`);
        return {
            table_id: tableConfig.id,
            records_count: records.length,
            records: records
        };
    } catch (error) {
        // Fallback for tables that might not like "Grid view" or other errors
        console.warn(`[${new Date().toISOString()}] WARN: 'Grid view' failed for ${tableConfig.name}, trying default. Error: ${error.message}`);
         try {
             // Retry without view
            await base(tableConfig.id).select().eachPage((pageRecords, fetchNextPage) => {
                records.push(...pageRecords.map(r => ({
                    id: r.id,
                    createdTime: r.createdTime,
                    fields: r.fields
                })));
                fetchNextPage();
            });
            console.log(`[${new Date().toISOString()}] INFO: Fetched ${records.length} records from ${tableConfig.name} (fallback)`);
            return {
                table_id: tableConfig.id,
                records_count: records.length,
                records: records
            };
        } catch (retryError) {
             console.error(`[${new Date().toISOString()}] ERROR: Failed to fetch ${tableConfig.name}: ${retryError.message}`);
             throw retryError;
        }
    }
}

async function run() {
    console.log(`[${new Date().toISOString()}] INFO: Starting Airtable backup`);
    if (IS_DRY_RUN) console.log(`[${new Date().toISOString()}] INFO: DRY RUN MODE - no files will be written`);

    if (!CONFIG.apiKey || !CONFIG.baseId) {
        console.error('ERROR: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env');
        process.exit(1);
    }

    const base = new Airtable({ apiKey: CONFIG.apiKey }).base(CONFIG.baseId);
    
    ensureDirectories();

    const backupData = {
        metadata: {
            created_at: new Date().toISOString(),
            base_id: CONFIG.baseId,
            tables_count: CONFIG.tables.length,
            total_records: 0
        },
        tables: {}
    };

    try {
        // Fetch all tables
        for (const table of CONFIG.tables) {
            // Add small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const tableData = await fetchTableRecords(base, table);
            backupData.tables[table.name] = tableData;
            backupData.metadata.total_records += tableData.records_count;
        }

        console.log(`[${new Date().toISOString()}] INFO: Total records: ${backupData.metadata.total_records}`);

        // Prepare content
        const jsonContent = JSON.stringify(backupData, null, 2);
        const fileNameDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const archiveName = `backup-${fileNameDate}.json.gz`;
        const archivePath = path.join(DAILY_DIR, archiveName);
        const latestPath = path.join(CONFIG.backupDir, 'latest.json');

        if (!IS_DRY_RUN) {
            // 1. Write latest.json (uncompressed)
            await writeFile(latestPath, jsonContent);
            const latestStats = await stat(latestPath);
            console.log(`[${new Date().toISOString()}] INFO: Updated latest.json (${(latestStats.size / 1024 / 1024).toFixed(2)} MB)`);

            // 2. Write gzipped daily backup
            const compressed = await gzip(jsonContent);
            await writeFile(archivePath, compressed);
            const archiveStats = await stat(archivePath);
            console.log(`[${new Date().toISOString()}] INFO: Saved to ${archivePath} (${(archiveStats.size / 1024).toFixed(2)} KB)`);

            // 3. Cleanup old backups
            if (!NO_CLEANUP) {
                await performCleanup();
            }
        } else {
             console.log(`[${new Date().toISOString()}] INFO: [DRY RUN] Would save to ${archivePath}`);
             console.log(`[${new Date().toISOString()}] INFO: [DRY RUN] Would update ${latestPath}`);
             if (!NO_CLEANUP) console.log(`[${new Date().toISOString()}] INFO: [DRY RUN] Would perform cleanup`);
        }
        
        console.log(`[${new Date().toISOString()}] INFO: Backup completed successfully`);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Backup failed:`, error);
        process.exit(1);
    }
}

async function performCleanup() {
    try {
        const files = await readdir(DAILY_DIR);
        const now = Date.now();
        const retentionMs = CONFIG.retentionDays * 24 * 60 * 60 * 1000;
        let removedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.json.gz')) continue;
            
            const filePath = path.join(DAILY_DIR, file);
            const stats = await stat(filePath);
            
            if (now - stats.mtimeMs > retentionMs) {
                await unlink(filePath);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`[${new Date().toISOString()}] INFO: Cleanup: removed ${removedCount} old backup(s)`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] WARN: Cleanup failed:`, error.message);
    }
}

run();
