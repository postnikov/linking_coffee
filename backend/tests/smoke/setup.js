require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

// Set test timeout
jest.setTimeout(10000);

// Global test configuration
global.TEST_CONFIG = {
  API_URL: process.env.API_URL || 'https://linked.coffee/api',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://linked.coffee',
  TIMEOUT: 10000
};

// Disable console noise during tests (optional)
if (process.env.TEST_QUIET === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn()
  };
}
