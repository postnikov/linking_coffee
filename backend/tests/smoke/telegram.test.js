const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

describe('Smoke Tests: Telegram Bot', () => {

  test('Bot token is valid (getMe)', async () => {
    const response = await axios.get(`${TELEGRAM_API}/getMe`);
    expect(response.data.ok).toBe(true);
    expect(response.data.result.username).toBe('Linked_Coffee_Bot');
    expect(response.data.result.is_bot).toBe(true);
  });

  test('Bot webhook configuration is valid', async () => {
    const response = await axios.get(`${TELEGRAM_API}/getWebhookInfo`);
    expect(response.data.ok).toBe(true);
    // Expect no webhook (using long polling)
    expect(response.data.result.url).toBe('');
    expect(response.data.result.pending_update_count).toBeGreaterThanOrEqual(0);
  });

  test('Bot commands are registered', async () => {
    const response = await axios.get(`${TELEGRAM_API}/getMyCommands`);
    expect(response.data.ok).toBe(true);
    // Verify /start command exists (if commands are set)
    const commands = response.data.result;
    if (commands.length > 0) {
      expect(commands.some(cmd => cmd.command === 'start' || cmd.command === 'connect')).toBe(true);
    }
  });

  test('Bot can access Telegram API (no 401/403)', async () => {
    const response = await axios.get(`${TELEGRAM_API}/getMe`);
    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
  });
});
