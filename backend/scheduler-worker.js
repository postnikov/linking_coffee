/**
 * Standalone Scheduler Worker
 *
 * Runs the cron scheduler as a separate process from the API server.
 * Exposes a minimal HTTP health endpoint for Docker health checks.
 *
 * Usage:
 *   node scheduler-worker.js
 *
 * Environment:
 *   SCHEDULER_HEALTH_PORT - Health endpoint port (default: 3002)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const Scheduler = require('./scheduler');

const scheduler = new Scheduler(
  path.join(__dirname, 'scheduler.json'),
  path.join(__dirname, 'config/scheduler.json')
);
scheduler.init();

// Minimal health endpoint
const HEALTH_PORT = parseInt(process.env.SCHEDULER_HEALTH_PORT || '3002', 10);
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const health = scheduler.getHealthStatus();
    const statusCode = health.healthy ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(HEALTH_PORT, () => {
  console.log(`Scheduler worker started. Health endpoint on port ${HEALTH_PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Scheduler worker shutting down...');
  server.close();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
