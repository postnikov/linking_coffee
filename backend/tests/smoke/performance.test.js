const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getApiUrl, getFrontendUrl } = require('../utils/testHelpers');

const BASELINE_FILE = path.join(__dirname, '../fixtures/baseline-performance.json');
const API_BASE = getApiUrl();
const FRONTEND_URL = getFrontendUrl();

describe('Smoke Tests: Performance Benchmarks', () => {

  let baseline = {};

  beforeAll(() => {
    if (fs.existsSync(BASELINE_FILE)) {
      baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    } else {
      baseline = {
        health_endpoint: 200,
        countries_endpoint: 500,
        frontend_load: 800,
        airtable_query: 1500
      };
    }
  });

  test('Health endpoint performance regression (<20% slower)', async () => {
    const start = Date.now();
    await axios.get(`${API_BASE}/health`);
    const duration = Date.now() - start;

    const threshold = baseline.health_endpoint * 1.2; // 20% tolerance
    expect(duration).toBeLessThan(threshold);
    console.log(`   Health: ${duration}ms (baseline: ${baseline.health_endpoint}ms)`);
  });

  test('Countries endpoint performance regression', async () => {
    const start = Date.now();
    await axios.get(`${API_BASE}/countries`);
    const duration = Date.now() - start;

    const threshold = baseline.countries_endpoint * 1.2;
    expect(duration).toBeLessThan(threshold);
    console.log(`   Countries: ${duration}ms (baseline: ${baseline.countries_endpoint}ms)`);
  });
});
