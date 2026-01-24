#!/usr/bin/env node
/**
 * Fix Telegram Bot 409 Conflict Error
 *
 * This script deletes any existing webhook and clears pending updates
 * to allow the bot to use polling mode without conflicts.
 *
 * Usage: node fix-bot-webhook.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found in environment variables');
  process.exit(1);
}

async function fixWebhook() {
  const bot = new Telegraf(BOT_TOKEN);

  try {
    // Check current webhook status
    console.log('🔍 Checking webhook info...');
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('📊 Current webhook:', JSON.stringify(webhookInfo, null, 2));

    // Delete webhook and drop pending updates
    console.log('🗑️  Deleting webhook and clearing pending updates...');
    const result = await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    if (result) {
      console.log('✅ Webhook deleted successfully');
      console.log('✅ Pending updates cleared');
      console.log('');
      console.log('🔄 Now restart the backend service:');
      console.log('   docker compose restart backend');
    } else {
      console.log('⚠️  Webhook deletion returned false');
    }

    // Verify webhook is deleted
    const verifyInfo = await bot.telegram.getWebhookInfo();
    console.log('📊 Webhook after deletion:', JSON.stringify(verifyInfo, null, 2));

  } catch (error) {
    console.error('❌ Error fixing webhook:', error);
    process.exit(1);
  }
}

fixWebhook();
