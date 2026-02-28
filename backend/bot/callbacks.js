const { Markup } = require('telegraf');
const base = require('../shared/base');
const { otpStore, linkingTokenStore } = require('../shared/stores');
const { logAuth, logConnection } = require('../shared/logging');
const { sanitizeTelegramId } = require('../utils/airtable-sanitizer');
const { resolveRecipient } = require('../utils/alerting');
const { FRONTEND_URL } = require('../shared/config');

module.exports = function registerBotCallbacks(bot) {

  // --- /start and /connect commands ---

  const handleConnect = (ctx) => {
    const username = ctx.from.username;
    logAuth(`Bot connect received from: ${username} (ID: ${ctx.from.id})`);

    if (!username) {
      return ctx.reply('Please set a username in your Telegram settings to use this bot.');
    }

    const cleanUsername = username.toLowerCase();
    console.log(`🤖 Bot received connect from: ${username} (clean: ${cleanUsername})`);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP (valid for 10 minutes)
    otpStore.set(cleanUsername, {
      code: otp,
      telegramId: ctx.from.id, // Store ID to update later
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    console.log(`✅ Generated OTP for ${cleanUsername}: ${otp}`);
    logAuth(`Generated OTP for ${cleanUsername}: ${otp}`);

    // Provide both login link (for new users) and dashboard link (for Gmail users connecting Telegram)
    const loginUrl = `${FRONTEND_URL}/login?code=${otp}&user=${encodeURIComponent(cleanUsername)}`;
    const dashboardUrl = `${FRONTEND_URL}/dashboard?connectCode=${otp}&connectUser=${encodeURIComponent(cleanUsername)}`;

    const useButtons = FRONTEND_URL.startsWith('https');

    if (useButtons) {
      ctx.reply(
        `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\nClick a button below to verify:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('New user? Click here', loginUrl)],
            [Markup.button.url('Already logged in? Click here', dashboardUrl)]
          ])
        }
      );
    } else {
      ctx.reply(
        `☕️☕️☕️\nYour verification code for Linked.Coffee is:\n\n\`${otp}\`\n\n` +
        `Click to verify:\n${loginUrl}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }
  };

  // Register both /start and /connect commands
  bot.start(handleConnect);
  bot.command('connect', handleConnect);

  // --- Participation callbacks ---

  // Localized participation messages
  const PARTICIPATION_MESSAGES = {
    En: {
      yes_response: "Awesome 🎉\nOn Monday you'll get your new match!\n💜",
      no_response: "Got it 👍\nNo matches this week.\nRecharge your social battery 🪫↗️🔋\n\nI'll come back to you next weekend\n😉"
    },
    Ru: {
      yes_response: "Отлично 🎉\nВ понедельник ты получишь нового собеседника!\n💜",
      no_response: "Принято 👍\nНа этой неделе без встреч.\nЗаряжай социальную батарейку 🪫↗️🔋\n\nВернусь к тебе в следующие выходные\n😉"
    }
  };

  // Handle "I'm in" callback from weekly check-in
  // Handle "Yes! I'm in!"
  bot.action('participate_yes', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    console.log(`🤖 Received participate_yes from Tg_ID: ${telegramId}`);
    logAuth(`User ${telegramId} clicked YES for next week`);

    try {
      // Find user by Tg_ID
      const safeTelegramId = sanitizeTelegramId(telegramId);
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_ID} = '${safeTelegramId}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length > 0) {
        const record = records[0];
        const lang = (record.fields.Notifications_Language === 'Ru') ? 'Ru' : 'En';
        const t = PARTICIPATION_MESSAGES[lang];

        // Conditional Logging: If previously Passive -> Activated
        if (record.fields.Next_Week_Status === 'Passive') {
          try {
            await base(process.env.AIRTABLE_LOGS_TABLE || 'tbln4rLHEgXUkL9Jh').create([{
              fields: {
                'Event': 'Activated',
                'Member': [record.id]
              }
            }]);
            console.log(`📝 Logged Activated event for ${record.id}`);
          } catch (logErr) {
            console.error('❌ Failed to log activation:', logErr);
          }
        }

        // Update Next_Week_Status to 'Active'
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: record.id,
            fields: {
              'Next_Week_Status': 'Active'
            }
          }
        ]);

        await ctx.answerCbQuery(lang === 'Ru' ? 'Вы участвуете!' : 'You are in!');
        await ctx.editMessageText(t.yes_response);
      } else {
        await ctx.answerCbQuery('User not found.');
      }
    } catch (error) {
      console.error('Error handling participate_yes:', error);
      await ctx.answerCbQuery('Error updating status.');
    }
  });

  // Handle "No, I'll skip this week"
  bot.action('participate_no', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    console.log(`🤖 Received participate_no from Tg_ID: ${telegramId}`);
    logAuth(`User ${telegramId} clicked NO for next week`);

    try {
      // Find user by Tg_ID to check status first
      const safeTelegramId = sanitizeTelegramId(telegramId);
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_ID} = '${safeTelegramId}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length > 0) {
        const record = records[0];
        const lang = (record.fields.Notifications_Language === 'Ru') ? 'Ru' : 'En';
        const t = PARTICIPATION_MESSAGES[lang];

        // Conditional Logging: If previously Active -> Deactivated
        if (record.fields.Next_Week_Status === 'Active') {
          try {
            await base(process.env.AIRTABLE_LOGS_TABLE || 'tbln4rLHEgXUkL9Jh').create([{
              fields: {
                'Event': 'Deactivated',
                'Member': [record.id]
              }
            }]);
            console.log(`📝 Logged Deactivated event for ${record.id}`);
          } catch (logErr) {
            console.error('❌ Failed to log deactivation:', logErr);
          }
        }

        // Update Next_Week_Status to 'Passive'
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: record.id,
            fields: {
              'Next_Week_Status': 'Passive'
            }
          }
        ]);

        await ctx.answerCbQuery(lang === 'Ru' ? 'Пропущено.' : 'Skipped.');
        await ctx.editMessageText(t.no_response);

      } else {
        await ctx.answerCbQuery('User not found.');
        // Should we remove the message or something if user not found?
        // Current logic just doesn't reply.
      }

    } catch (error) {
      console.error('Error handling participate_no:', error);
    }
  });

  // --- Feedback callbacks ---

  // Localized feedback messages
  const FEEDBACK_MESSAGES = {
    En: {
      thankYou: "Thank you! 🙏",
      ratingPrompt: "❤️ Wow! Awesome! ❤️\nSo how was your Linked Coffee experience?\nDid it go well?",
      btn_awful: '😡 awful',
      btn_boring: '😐 boring',
      btn_ok: '🙂 ok',
      btn_wonderful: '😃 wonderful'
    },
    Ru: {
      thankYou: "Спасибо! 🙏",
      ratingPrompt: "❤️ Вау! Потрясающе! ❤️\nНу как прошла твоя встреча Linked Coffee?\nВсё хорошо?",
      btn_awful: '😡 ужасно',
      btn_boring: '😐 скучно',
      btn_ok: '🙂 норм',
      btn_wonderful: '😃 чудесно'
    }
  };

  // Handle Midweek Feedback Status
  // Callback format: fb_stat:matchId:role:status or fb_stat:matchId:role:status:lang
  bot.action(/^fb_stat:(.+):(\d+):([^:]+)(?::([A-Za-z]{2}))?$/, async (ctx) => {
    const matchId = ctx.match[1];
    const role = parseInt(ctx.match[2]);
    const status = ctx.match[3];
    const language = ctx.match[4] || 'En'; // Default to English if no language specified

    console.log(`🤖 Received fb_stat: Match=${matchId}, Role=${role}, Status=${status}, Lang=${language}`);
    const fieldName = role === 1 ? 'We_Met_1' : 'We_Met_2';
    const t = FEEDBACK_MESSAGES[language] || FEEDBACK_MESSAGES.En;

    try {
      await base('tblx2OEN5sSR1xFI2').update([{
        id: matchId,
        fields: {
          [fieldName]: status
        }
      }], { typecast: true });

      await ctx.answerCbQuery('Status updated!');

      // Append localized "Thank you!" to the original message
      const originalText = ctx.callbackQuery.message.text;
      await ctx.editMessageText(originalText + "\n\n" + t.thankYou);

      // If 'Met', send follow-up rating message in the same language
      if (status === 'Met') {
        const ratingKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(t.btn_awful, `fb_rate:${matchId}:${role}:1:${language}`),
            Markup.button.callback(t.btn_boring, `fb_rate:${matchId}:${role}:2:${language}`)
          ],
          [
            Markup.button.callback(t.btn_ok, `fb_rate:${matchId}:${role}:3:${language}`),
            Markup.button.callback(t.btn_wonderful, `fb_rate:${matchId}:${role}:4:${language}`)
          ]
        ]);
        await ctx.reply(t.ratingPrompt, ratingKeyboard);
      }

    } catch (error) {
      console.error('Error handling fb_stat:', error);
      await ctx.answerCbQuery('Error updating status.');
    }
  });

  // Handle Midweek Feedback Rating
  // Callback format: fb_rate:matchId:role:rating or fb_rate:matchId:role:rating:lang
  bot.action(/^fb_rate:(.+):(\d+):(\d+)(?::([A-Za-z]{2}))?$/, async (ctx) => {
    const matchId = ctx.match[1];
    const role = parseInt(ctx.match[2]);
    const rating = parseInt(ctx.match[3]);
    const language = ctx.match[4] || 'En';

    console.log(`🤖 Received fb_rate: Match=${matchId}, Role=${role}, Rating=${rating}, Lang=${language}`);
    const fieldName = role === 1 ? 'Feedback1' : 'Feedback2';
    const t = FEEDBACK_MESSAGES[language] || FEEDBACK_MESSAGES.En;

    try {
      await base('tblx2OEN5sSR1xFI2').update([{
        id: matchId,
        fields: {
          [fieldName]: rating
        }
      }]);

      await ctx.answerCbQuery('Feedback received!');

      const originalText = ctx.callbackQuery.message.text;
      await ctx.editMessageText(originalText + "\n\n" + t.thankYou);

    } catch (error) {
      console.error('Error handling fb_rate:', error);
      await ctx.answerCbQuery('Error saving feedback.');
    }
  });

  // --- Community callbacks ---

  // Community: Approve Membership
  bot.action(/^community_approve:(.+)$/, async (ctx) => {
    const membershipId = ctx.match[1];

    try {
      // Update membership status to Active
      await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
        {
          id: membershipId,
          fields: {
            Status: 'Active'
          }
        }
      ]);

      // Get membership details to notify user
      const membership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).find(membershipId);
      const memberIds = membership.fields.Member;
      const communityIds = membership.fields.Community;

      if (memberIds && memberIds.length > 0 && communityIds && communityIds.length > 0) {
        const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
        const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityIds[0]);

        const userTgId = member.fields.Tg_ID;
        const communityName = community.fields.Name;
        const communitySlug = community.fields.Slug;

        // Set matching context to this community
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: memberIds[0],
            fields: {
              Matching_Context: `community:${communitySlug}`
            }
          }
        ]);

        // Notify user of approval
        if (userTgId) {
          const resolved = resolveRecipient(userTgId);
          try {
            await bot.telegram.sendMessage(
              resolved.chatId,
              `${resolved.prefix}🎉 Your membership to *${communityName}* has been approved!\n\n` +
              `You can now participate in weekly coffee matches within this community.`,
              { parse_mode: 'Markdown' }
            );
          } catch (tgErr) {
            console.error('Error sending approval notification to user:', tgErr.message);
          }
        }
      }

      await ctx.answerCbQuery('✅ Membership approved');
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ Approved'
      );
    } catch (error) {
      console.error('Error approving membership:', error);
      await ctx.answerCbQuery('❌ Error approving membership');
    }
  });

  // Community: Ignore Membership Request
  bot.action(/^community_ignore:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Request ignored. User can re-apply if needed.');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n🚫 Ignored'
    );
  });

  // Community: Participate Yes
  bot.action(/^community_participate_yes:(.+):(.+)$/, async (ctx) => {
    const memberId = ctx.match[1];
    const slug = ctx.match[2];

    try {
      // Set Matching_Context and Next_Week_Status
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: memberId,
          fields: {
            Matching_Context: `community:${slug}`,
            Next_Week_Status: 'Active'
          }
        }
      ]);

      await ctx.answerCbQuery('✅ You\'re in for next week\'s community match!');
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ Confirmed for community matching'
      );
    } catch (error) {
      console.error('Error setting community participation:', error);
      await ctx.answerCbQuery('❌ Error confirming participation');
    }
  });

  // Community: Participate No
  bot.action(/^community_participate_no:(.+):(.+)$/, async (ctx) => {
    const memberId = ctx.match[1];

    try {
      // Clear participation
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: memberId,
          fields: {
            Next_Week_Status: 'Passive'
          }
        }
      ]);

      await ctx.answerCbQuery('👍 Skipping this week');
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n🪫 Skipping this week'
      );
    } catch (error) {
      console.error('Error clearing participation:', error);
      await ctx.answerCbQuery('❌ Error updating status');
    }
  });

  // Community Deleted: Join Global
  bot.action(/^community_deleted_join_global:(.+)$/, async (ctx) => {
    const memberId = ctx.match[1];

    try {
      // Clear No_Global_Notifications flag
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: memberId,
          fields: {
            No_Global_Notifications: false,
            Matching_Context: 'global'
          }
        }
      ]);

      await ctx.answerCbQuery('✅ Welcome to the global pool!');
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ Joined global matching pool'
      );
    } catch (error) {
      console.error('Error joining global pool:', error);
      await ctx.answerCbQuery('❌ Error updating preferences');
    }
  });

  // Community Deleted: Skip
  bot.action(/^community_deleted_skip:(.+)$/, async (ctx) => {
    const memberId = ctx.match[1];

    try {
      // Set No_Global_Notifications flag
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: memberId,
          fields: {
            No_Global_Notifications: true
          }
        }
      ]);

      await ctx.answerCbQuery('👍 You won\'t receive global invitations');
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n🪫 Opted out of global matching'
      );
    } catch (error) {
      console.error('Error opting out:', error);
      await ctx.answerCbQuery('❌ Error updating preferences');
    }
  });

  // --- Account Linking callbacks ---

  // Account Linking: Confirm (LinkedIn <-> Telegram)
  bot.action(/^link_confirm:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    const tokenData = linkingTokenStore.get(token);

    if (!tokenData) {
      await ctx.answerCbQuery('This link has expired or was already used.');
      return;
    }

    if (Date.now() > tokenData.expiresAt) {
      linkingTokenStore.delete(tokenData.pollingToken);
      linkingTokenStore.delete(tokenData.linkingToken);
      await ctx.answerCbQuery('This link has expired. Please try logging in again.');
      return;
    }

    if (tokenData.status !== 'pending') {
      await ctx.answerCbQuery('This link has already been used.');
      return;
    }

    // Verify the caller is the intended Telegram recipient
    if (ctx.from.id.toString() !== tokenData.existingTgId.toString()) {
      await ctx.answerCbQuery('This link is not for your account.');
      return;
    }

    // Atomically mark as processing to prevent double-click race condition
    // Both Map entries (pollingToken + linkingToken) point to same object, so update is visible from both
    const processingEntry = { ...tokenData, status: 'processing' };
    linkingTokenStore.set(tokenData.pollingToken, processingEntry);
    linkingTokenStore.set(tokenData.linkingToken, processingEntry);

    try {
      // Build update fields for the existing record
      const updateFields = {
        Linkedin_ID: tokenData.linkedinSub
      };

      // Only set email if the existing record doesn't have one
      const existingRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(tokenData.existingRecordId);
      if (!existingRecord.fields.Email && tokenData.linkedinEmail) {
        updateFields.Email = tokenData.linkedinEmail;
      }

      // Set avatar if the existing record doesn't have one
      if ((!existingRecord.fields.Avatar || existingRecord.fields.Avatar.length === 0) && tokenData.linkedinPicture) {
        updateFields.Avatar = [{ url: tokenData.linkedinPicture }];
      }

      // Update Airtable record
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: tokenData.existingRecordId,
          fields: updateFields
        }
      ]);

      // Fetch the updated record to build session
      const updatedRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(tokenData.existingRecordId);

      // Build session object (same shape as LinkedIn OAuth success response)
      const session = {
        id: updatedRecord.id,
        username: updatedRecord.fields.Tg_Username || null,
        Tg_Username: updatedRecord.fields.Tg_Username || null,
        Tg_ID: updatedRecord.fields.Tg_ID || null,
        email: tokenData.linkedinEmail,
        status: updatedRecord.fields.Status,
        consentGdpr: updatedRecord.fields.Consent_GDPR,
        firstName: updatedRecord.fields.Name,
        lastName: updatedRecord.fields.Family,
        telegramConnected: !!updatedRecord.fields.Tg_ID,
        tgId: updatedRecord.fields.Tg_ID,
        linkedAccounts: ['linkedin', 'telegram']
      };

      // Mark token as completed with session data (immutable update)
      // Both keys share the same entry so the polling endpoint sees the update
      const completedEntry = { ...tokenData, status: 'completed', session };
      linkingTokenStore.set(tokenData.pollingToken, completedEntry);
      linkingTokenStore.set(tokenData.linkingToken, completedEntry);

      logConnection(`Account linked via Telegram confirmation: ${tokenData.linkedinEmail} → ${updatedRecord.fields.Tg_Username}`, 'SUCCESS');

      await ctx.answerCbQuery('Accounts linked!');
      await ctx.editMessageText(
        '✅ *Accounts linked successfully!*\n\n' +
        'Your LinkedIn and Telegram accounts are now connected.\n' +
        'Return to your browser — you should be logged in automatically.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error linking accounts:', error);
      // Revert to pending so user can retry
      const pendingEntry = { ...tokenData, status: 'pending' };
      linkingTokenStore.set(tokenData.pollingToken, pendingEntry);
      linkingTokenStore.set(tokenData.linkingToken, pendingEntry);
      await ctx.answerCbQuery('Error linking accounts. Please try again.');
    }
  });

  // Account Linking: Reject (LinkedIn <-> Telegram)
  bot.action(/^link_reject:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    const tokenData = linkingTokenStore.get(token);
    if (tokenData) {
      linkingTokenStore.delete(tokenData.pollingToken);
      linkingTokenStore.delete(tokenData.linkingToken);
    } else {
      linkingTokenStore.delete(token);
    }

    await ctx.answerCbQuery('Request rejected');
    await ctx.editMessageText(
      '🚫 *Linking request rejected*\n\n' +
      'If this wasn\'t you, your account is safe. No changes were made.',
      { parse_mode: 'Markdown' }
    );
  });

  // --- Bot menu commands ---

  // Register bot menu commands
  bot.telegram.setMyCommands([
    { command: 'start', description: '🚀 Start the bot' },
    { command: 'connect', description: '☕ Connect to Linked.Coffee' }
  ]).then(() => {
    console.log('📋 Bot menu commands registered');
  }).catch(err => {
    console.error('Failed to set bot commands:', err);
  });

};
