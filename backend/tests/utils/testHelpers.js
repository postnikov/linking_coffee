function getApiUrl() {
  return process.env.API_URL || 'https://linked.coffee/api';
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://linked.coffee';
}

function expectSuccessfulResponse(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.data).toBeDefined();
}

function expectValidJson(data) {
  expect(typeof data).toBe('object');
  expect(data).not.toBeNull();
}

async function retryRequest(fn, maxRetries = 2, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = {
  getApiUrl,
  getFrontendUrl,
  expectSuccessfulResponse,
  expectValidJson,
  retryRequest
};
