// In-memory OTP store: Map<username_lowercase, { code, expiresAt, telegramId, firstName, lastName }>
const otpStore = new Map();

// In-memory store for account linking tokens (LinkedIn <-> Telegram)
// Map<token, { linkedinSub, linkedinEmail, linkedinName, linkedinPicture,
//              existingRecordId, existingTgId, expiresAt, status, session }>
const linkingTokenStore = new Map();

// Clean up expired and stale linking tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  const seen = new Set();
  for (const [token, data] of linkingTokenStore) {
    if (seen.has(token)) continue;
    const isExpired = now > data.expiresAt;
    const isStaleCompleted = data.status === 'completed' && now > data.expiresAt - 9 * 60 * 1000;
    if (isExpired || isStaleCompleted) {
      if (data.pollingToken) { seen.add(data.pollingToken); linkingTokenStore.delete(data.pollingToken); }
      if (data.linkingToken) { seen.add(data.linkingToken); linkingTokenStore.delete(data.linkingToken); }
      linkingTokenStore.delete(token);
    }
  }
}, 5 * 60 * 1000);

module.exports = { otpStore, linkingTokenStore };
