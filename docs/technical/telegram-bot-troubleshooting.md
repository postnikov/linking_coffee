# Telegram Bot Troubleshooting Guide

## Common Issue: 409 Conflict Error

### Symptom
```
❌ Telegram bot failed to start: TelegramError: 409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
```

Bot callbacks (inline buttons) stop working, and the bot doesn't respond to commands.

### Root Cause
The Telegram Bot API only allows **one active polling session** per bot token. When multiple processes try to poll for updates using `getUpdates` (which `bot.launch()` uses), Telegram terminates the older session, causing conflicts.

### Why This Happened in Linked.Coffee

Our codebase had a subtle issue:

1. **server.js** created a bot instance and called `bot.launch()` ✅
2. Scripts like **daily-summary.js** imported **alerting.js** to send messages
3. **alerting.js** tried to reuse the bot by doing `require('../server')`
4. This import caused **server.js to execute again**, calling `bot.launch()` a second time ❌
5. Result: Two polling sessions → 409 Conflict

### How We Fixed It

**1. Wrapped bot.launch() in main module check ([server.js:474](../backend/server.js#L474)):**
```javascript
// Only launch bot if running as main process (not when imported as module)
if (require.main === module) {
  bot.launch().then(() => {
    console.log('🤖 Telegram bot started');
  });
} else {
  console.log('📦 Bot instance created (not launching - imported as module)');
}
```

**2. Added clear warnings in [alerting.js](../backend/utils/alerting.js#L18-L35):**
```javascript
/**
 * WARNING: NEVER call bot.launch() on the returned instance! This would
 * create a second polling session and cause 409 Conflict errors.
 */
function getBotInstance() {
  // Reuses bot from server.js without launching it
}
```

### Quick Fix Procedure

If you encounter 409 errors in production:

**Step 1: Clear Pending Updates**
```bash
# Replace <BOT_TOKEN> with your actual token
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook?drop_pending_updates=true"
```

**Step 2: Verify Webhook Status**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

You should see:
```json
{
  "ok": true,
  "result": {
    "url": "",
    "pending_update_count": 0
  }
}
```

**Step 3: Restart Backend**
```bash
cd /opt/linking-coffee
docker compose restart backend
```

**Step 4: Check Logs**
```bash
docker compose logs backend --tail=50 | grep -i "bot\|409\|conflict"
```

Look for:
- ✅ `🤖 Telegram bot started` (good)
- ❌ `409: Conflict` (still broken)

### Prevention Checklist

When adding new scripts or features that use the Telegram bot:

- [ ] Does your script need to **send** messages? → Use `alerting.js` utilities
- [ ] Does your script need to **receive** updates (commands, callbacks)? → Add handlers in `server.js`
- [ ] Are you creating a new `Telegraf()` instance? → Make sure you NEVER call `.launch()` on it
- [ ] Does your script import `server.js`? → Verify the main module check is working
- [ ] Are you testing locally? → Make sure only ONE process is running with each bot token

### Testing Bot Functionality

**1. Test Bot is Responding:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getMe"
```

**2. Test Callback Buttons:**
- Send a test message with inline buttons
- Click a button
- Check logs for callback handler execution:
```bash
docker compose logs backend | grep "🤖 Received fb_stat\|🤖 Received fb_rate"
```

**3. Monitor for Conflicts:**
```bash
# Should remain at 0 pending updates
watch -n 5 "curl -s 'https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo' | jq '.result.pending_update_count'"
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ server.js (Main Process)                                │
│                                                          │
│  1. Creates bot instance: const bot = new Telegraf()    │
│  2. Registers handlers: bot.action(), bot.command()     │
│  3. Launches polling: bot.launch() ← ONLY HERE!         │
│  4. Exports bot: module.exports = { bot }               │
└─────────────────────────────────────────────────────────┘
                              │
                              │ require('../server')
                              │ (when imported, bot.launch() is skipped)
                              ↓
┌─────────────────────────────────────────────────────────┐
│ alerting.js (Utility Module)                            │
│                                                          │
│  1. Imports bot from server.js                          │
│  2. Uses bot.telegram.sendMessage() ← Send only!        │
│  3. NEVER calls bot.launch()                            │
└─────────────────────────────────────────────────────────┘
                              ↑
                              │ require('./utils/alerting')
                              │
┌─────────────────────────────────────────────────────────┐
│ Scripts (daily-summary.js, etc.)                        │
│                                                          │
│  Uses alerting utilities to send messages               │
└─────────────────────────────────────────────────────────┘
```

### Developer Rules (Summary)

| Action | Allowed | Location |
|--------|---------|----------|
| `new Telegraf(token)` | ✅ | server.js only |
| `bot.launch()` | ✅ | server.js (in main module check) |
| `bot.action()`, `bot.command()` | ✅ | server.js only |
| `bot.telegram.sendMessage()` | ✅ | Anywhere (via alerting.js) |
| `bot.telegram.sendPhoto()` | ✅ | Anywhere (via alerting.js) |
| `bot.startPolling()` | ❌ | Never |
| Multiple `bot.launch()` calls | ❌ | Never |

### Related Documentation
- [CLAUDE.md - Telegram Bot Instance Management](../CLAUDE.md#telegram-bot-instance-management)
- [alerting.js source code](../backend/utils/alerting.js)
- [server.js bot initialization](../backend/server.js#L186-L193)

---

**Last Updated:** 2026-01-24
**Issue Fixed:** 2026-01-24 (Commit: 636547f)
