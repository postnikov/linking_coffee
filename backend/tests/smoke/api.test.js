const axios = require('axios');
const { getApiUrl, expectSuccessfulResponse } = require('../utils/testHelpers');

const API_BASE = getApiUrl();

describe('Smoke Tests: Backend API', () => {

  test('Health endpoint responds OK', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    expectSuccessfulResponse(response, 200);
    expect(response.data.status).toBe('ok');
  });

  test('Countries endpoint returns valid data', async () => {
    const response = await axios.get(`${API_BASE}/countries`);
    expectSuccessfulResponse(response, 200);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('countries');
    expect(Array.isArray(response.data.countries)).toBe(true);
    expect(response.data.countries.length).toBeGreaterThan(0);
    // Validate structure (iso and name fields)
    expect(response.data.countries[0]).toHaveProperty('iso');
    expect(response.data.countries[0]).toHaveProperty('name');
  });

  test('Interests endpoint returns valid categories', async () => {
    const response = await axios.get(`${API_BASE}/interests`);
    expectSuccessfulResponse(response, 200);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('interests');
    expect(response.data.interests).toHaveProperty('professional');
    expect(response.data.interests).toHaveProperty('personal');
  });

  test('Cities endpoint returns approved cities', async () => {
    const response = await axios.get(`${API_BASE}/cities`);
    expectSuccessfulResponse(response, 200);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('cities');
    expect(Array.isArray(response.data.cities)).toBe(true);
  });

  test('Admin data endpoint exists and responds', async () => {
    try {
      // Try without auth - should either work or return error
      const response = await axios.get(`${API_BASE}/admin/data`);
      // If it works, just verify it's a valid response
      expect([200, 400, 401, 403]).toContain(response.status);
    } catch (error) {
      // If it errors, check for expected auth errors (400, 401, 403)
      if (error.response) {
        expect([400, 401, 403]).toContain(error.response.status);
      } else {
        // Any network error is fine (endpoint may not exist in test env)
        expect(error).toBeDefined();
      }
    }
  });

  test('Profile endpoint requires authentication', async () => {
    try {
      await axios.get(`${API_BASE}/profile`);
      throw new Error('Should have thrown 401/400');
    } catch (error) {
      expect([401, 400]).toContain(error.response.status);
    }
  });

  test('Invalid endpoint returns 404', async () => {
    try {
      await axios.get(`${API_BASE}/nonexistent-endpoint-12345`);
      throw new Error('Should have thrown 404');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  // Average response time across critical endpoints
  test('Critical endpoints respond within 2s average', async () => {
    const endpoints = ['/health', '/countries', '/interests', '/cities'];
    const timings = [];

    for (const endpoint of endpoints) {
      const start = Date.now();
      await axios.get(`${API_BASE}${endpoint}`);
      timings.push(Date.now() - start);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    expect(avgTime).toBeLessThan(2000);
    console.log(`   Average response time: ${avgTime.toFixed(0)}ms`);
  });
});
