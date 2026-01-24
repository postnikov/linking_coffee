module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/smoke/**/*.test.js'],
  testTimeout: 10000, // 10s per test (30-60s total budget)
  verbose: true,
  bail: true, // Stop on first failure for fast rollback
  setupFilesAfterEnv: ['<rootDir>/tests/smoke/setup.js'],
  collectCoverage: false, // No coverage for smoke tests
  maxWorkers: 1, // Run tests sequentially to avoid rate limits
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './logs',
      outputName: 'deployment-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › '
    }]
  ]
};
