/**
 * E2E Test Helper for Playwright
 *
 * Provides setup/teardown lifecycle for e2e tests using test accounts.
 *
 * Usage:
 *   const { seedTestUsers, cleanupTestUsers, loginAsTestUser } = require('./e2eTestHelper');
 *
 *   test.beforeAll(async () => { await seedTestUsers(); });
 *   test.afterAll(async () => { await cleanupTestUsers(); });
 *
 *   test('user can view dashboard', async ({ page }) => {
 *     const user = await loginAsTestUser(page, 'alice');
 *     await page.goto('http://localhost:3000/dashboard');
 *     // ... assertions
 *   });
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

async function seedTestUsers(keys) {
  const response = await fetch(`${API_BASE}/api/dev/seed-test-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys ? { users: keys } : {})
  });
  if (!response.ok) {
    throw new Error(`Seed failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function cleanupTestUsers(keys) {
  const response = await fetch(`${API_BASE}/api/dev/seed-test-users`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys ? { users: keys } : {})
  });
  if (!response.ok) {
    throw new Error(`Cleanup failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function loginAsTestUser(page, key) {
  const response = await fetch(`${API_BASE}/api/dev/seed-test-users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${key}: ${response.status}`);
  }

  const data = await response.json();

  // Set localStorage in the browser context
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, data.user);

  return data.user;
}

module.exports = { seedTestUsers, cleanupTestUsers, loginAsTestUser };
