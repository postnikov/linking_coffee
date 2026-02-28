const router = require('express').Router();
const crypto = require('crypto');
const base = require('../shared/base');
const { apiLimiter, adminLimiter, pollLimiter } = require('../shared/limiters');
const { logDebug } = require('../shared/logging');
const { sanitizeForAirtable, sanitizeUsername } = require('../utils/airtable-sanitizer');
const { checkCommunityMember, checkCommunityAdmin } = require('../utils/community-middleware');
const { getBotInstance, resolveRecipient } = require('../utils/alerting');

// Create Invite Link (Admin Only)
router.post('/api/community/:slug/invite-links', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { label, maxUses = -1, expiresAt = null } = req.body;

    // Validate inputs
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Label is required'
      });
    }

    if (typeof maxUses !== 'number' || (maxUses < -1 || maxUses === 0)) {
      return res.status(400).json({
        success: false,
        error: 'maxUses must be -1 (unlimited) or a positive integer'
      });
    }

    // Validate expiry date if provided
    if (expiresAt !== null) {
      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiresAt date format'
        });
      }
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'expiresAt must be in the future'
        });
      }
    }

    // Generate unique 8-char hex code
    const crypto = require('crypto');
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Create invite link record
    const inviteLinkRecord = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).create([
      {
        fields: {
          Community: [req.community.id],
          Code: code,
          Label: sanitizeForAirtable(label.trim()),
          Status: 'Active',
          Max_Uses: maxUses,
          Used_Count: 0,
          Expires_At: expiresAt,
          Created_By: [req.userId]
        }
      }
    ]);

    res.json({
      success: true,
      inviteLink: {
        id: inviteLinkRecord[0].id,
        code: code,
        label: label.trim(),
        status: 'Active',
        maxUses: maxUses,
        usedCount: 0,
        expiresAt: expiresAt,
        url: `https://linked.coffee/join/${code}`
      }
    });

    logDebug(`Invite link created for community ${req.params.slug} by ${req.membership.fields.Member}: ${code}`);
  } catch (error) {
    console.error('Error creating invite link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create invite link'
    });
  }
});

// Get Invite Link Info (Public - for join page)
router.get('/api/invite/:code/info', pollLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    // Validate code format
    if (!/^[A-F0-9]{8}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code format'
      });
    }

    const safeCode = sanitizeForAirtable(code.toUpperCase());

    // Find invite link
    const inviteLinkRecords = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `{Code} = '${safeCode}'`,
      maxRecords: 1
    }).firstPage();

    if (inviteLinkRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite link not found'
      });
    }

    const inviteLink = inviteLinkRecords[0].fields;

    // Check if invite is valid
    if (inviteLink.Status !== 'Active') {
      return res.status(400).json({
        success: false,
        error: 'This invite link has been disabled'
      });
    }

    // Check expiry
    if (inviteLink.Expires_At) {
      const expiryDate = new Date(inviteLink.Expires_At);
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This invite link has expired'
        });
      }
    }

    // Check usage limit
    if (inviteLink.Max_Uses !== -1 && inviteLink.Used_Count >= inviteLink.Max_Uses) {
      return res.status(400).json({
        success: false,
        error: 'This invite link has reached its usage limit'
      });
    }

    // Get community info
    const communityId = inviteLink.Community[0];
    const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityId);

    res.json({
      success: true,
      invite: {
        code: code.toUpperCase(),
        label: inviteLink.Label,
        community: {
          name: community.fields.Name,
          slug: community.fields.Slug,
          description: community.fields.Description || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching invite info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invite information'
    });
  }
});

// List Invite Links (Visibility-Controlled)
router.get('/api/community/:slug/invite-links', pollLimiter, checkCommunityMember, async (req, res) => {
  try {
    const settings = req.community.fields.Settings ? JSON.parse(req.community.fields.Settings.replace(/\\_/g, '_')) : {};
    const visibleTo = settings.invite_links_visible_to || 'all_members';

    // Check visibility permissions
    const memberRole = req.membership.fields.Role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';

    if (visibleTo === 'admins_only' && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view invite links'
      });
    }

    // Fetch invite links for this community
    // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
    const safeCommunityNameForLinks = sanitizeForAirtable(req.community.fields.Name);
    const inviteLinks = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `FIND('${safeCommunityNameForLinks}', ARRAYJOIN({Name (from Community)}, '||'))`,
      sort: [{ field: 'Created_At', direction: 'desc' }]
    }).all();

    const links = inviteLinks.map(link => ({
      id: link.id,
      code: link.fields.Code,
      label: link.fields.Label,
      status: link.fields.Status,
      maxUses: link.fields.Max_Uses,
      usedCount: link.fields.Used_Count || 0,
      expiresAt: link.fields.Expires_At || null,
      createdAt: link.fields.Created_At,
      url: `https://linked.coffee/join/${link.fields.Code}`
    }));

    res.json({
      success: true,
      inviteLinks: links
    });
  } catch (error) {
    console.error('Error listing invite links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invite links'
    });
  }
});

// Disable Invite Link (Admin Only)
router.patch('/api/community/:slug/invite-links/:linkId', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { linkId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['Active', 'Disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be Active or Disabled'
      });
    }

    // Verify link belongs to this community
    const link = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).find(linkId);
    if (link.fields.Community[0] !== req.community.id) {
      return res.status(403).json({
        success: false,
        error: 'This invite link does not belong to this community'
      });
    }

    // Update status
    await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).update([
      {
        id: linkId,
        fields: {
          Status: status
        }
      }
    ]);

    res.json({
      success: true,
      message: `Invite link ${status === 'Disabled' ? 'disabled' : 'enabled'} successfully`
    });

    logDebug(`Invite link ${linkId} ${status} by ${req.membership.fields.Member} in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error updating invite link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invite link'
    });
  }
});

// Delete Invite Link (Admin Only)
router.delete('/api/community/:slug/invite-links/:linkId', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { linkId } = req.params;

    // Verify link belongs to this community
    const link = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).find(linkId);
    if (!link.fields.Community || link.fields.Community[0] !== req.community.id) {
      return res.status(403).json({
        success: false,
        error: 'This invite link does not belong to this community'
      });
    }

    await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).destroy([linkId]);

    res.json({ success: true });
    logDebug(`Invite link ${linkId} deleted by admin in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error deleting invite link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete invite link'
    });
  }
});

// Community Join Flow
router.post('/api/community/join/:code', apiLimiter, async (req, res) => {
  try {
    // Check authentication
    const username = req.body.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { code } = req.params;

    // Validate code format
    if (!/^[A-F0-9]{8}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code format'
      });
    }

    const safeCode = sanitizeForAirtable(code.toUpperCase());
    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // Find invite link
    const inviteLinkRecords = await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).select({
      filterByFormula: `{Code} = '${safeCode}'`,
      maxRecords: 1
    }).firstPage();

    if (inviteLinkRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite link not found'
      });
    }

    const inviteLink = inviteLinkRecords[0];
    const inviteFields = inviteLink.fields;

    // Validate invite status
    if (inviteFields.Status !== 'Active') {
      return res.status(400).json({
        success: false,
        error: 'This invite link has been disabled'
      });
    }

    // Check expiry
    if (inviteFields.Expires_At) {
      const expiryDate = new Date(inviteFields.Expires_At);
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This invite link has expired'
        });
      }
    }

    // Check usage limit
    if (inviteFields.Max_Uses !== -1 && inviteFields.Used_Count >= inviteFields.Max_Uses) {
      return res.status(400).json({
        success: false,
        error: 'This invite link has reached its usage limit'
      });
    }

    // Get community
    const communityId = inviteFields.Community[0];
    const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityId);
    const communityFields = community.fields;

    // Get user
    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please complete registration first.'
      });
    }

    const user = userRecords[0];
    const userId = user.id;
    const userTgId = user.fields.Tg_ID;

    // Check if user is already a member
    // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
    const safeCommunityName = sanitizeForAirtable(communityFields.Name);
    const existingMembership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Tg_Username (from Member)} = '${safeUsername}', FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')))`,
      maxRecords: 1
    }).firstPage();

    if (existingMembership.length > 0) {
      const status = existingMembership[0].fields.Status;
      if (status === 'Active') {
        return res.status(400).json({
          success: false,
          error: 'You are already a member of this community'
        });
      } else if (status === 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Your membership is pending approval'
        });
      }
    }

    // Determine initial status based on approval mode
    const settings = communityFields.Settings ? JSON.parse(communityFields.Settings.replace(/\\_/g, '_')) : {};
    const approvalMode = settings.approval_mode || 'auto';
    const initialStatus = approvalMode === 'manual' ? 'Pending' : 'Active';

    // Create Community_Members record
    const membershipRecord = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).create([
      {
        fields: {
          Member: [userId],
          Community: [communityId],
          Status: initialStatus,
          Role: 'Member',
          Invited_Via: [inviteLink.id]
        }
      }
    ]);

    // Set matching context to this community if auto-approved
    if (initialStatus === 'Active') {
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: userId,
          fields: {
            Matching_Context: `community:${communityFields.Slug}`
          }
        }
      ]);
    }

    // Increment invite usage counter
    await base(process.env.AIRTABLE_INVITE_LINKS_TABLE).update([
      {
        id: inviteLink.id,
        fields: {
          Used_Count: (inviteFields.Used_Count || 0) + 1
        }
      }
    ]);

    // Send Telegram notification to user
    const bot = getBotInstance();
    if (bot && userTgId) {
      const resolved = resolveRecipient(userTgId);
      try {
        if (initialStatus === 'Pending') {
          await bot.telegram.sendMessage(
            resolved.chatId,
            `${resolved.prefix}✅ You've requested to join *${communityFields.Name}*\n\n` +
            `Your request is pending approval from a community admin. You'll be notified once approved.`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await bot.telegram.sendMessage(
            resolved.chatId,
            `${resolved.prefix}🎉 Welcome to *${communityFields.Name}*!\n\n` +
            `You're now a member. You can start participating in weekly coffee matches.`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (tgErr) {
        console.error('Error sending join notification to user:', tgErr.message);
      }
    }

    // If manual approval, notify community admins
    if (initialStatus === 'Pending') {
      // Find community admins
      // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
      const adminMemberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
        filterByFormula: `AND(
          FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
          {Status} = 'Active',
          OR({Role} = 'Owner', {Role} = 'Admin')
        )`
      }).all();

      for (const adminMembership of adminMemberships) {
        const adminMemberIds = adminMembership.fields.Member;
        if (adminMemberIds && adminMemberIds.length > 0) {
          const adminMember = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(adminMemberIds[0]);
          const adminTgId = adminMember.fields.Tg_ID;

          if (bot && adminTgId) {
            const resolvedAdmin = resolveRecipient(adminTgId);
            try {
              await bot.telegram.sendMessage(
                resolvedAdmin.chatId,
                `${resolvedAdmin.prefix}👤 New membership request for *${communityFields.Name}*\n\n` +
                `User: @${safeUsername}\n` +
                `Name: ${user.fields.Name || 'Not set'}\n\n` +
                `Please approve or ignore this request.`,
                {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Approve', callback_data: `community_approve:${membershipRecord[0].id}` },
                        { text: '🚫 Ignore', callback_data: `community_ignore:${membershipRecord[0].id}` }
                      ]
                    ]
                  }
                }
              );
            } catch (tgErr) {
              console.error('Error sending admin notification:', tgErr.message);
            }
          }
        }
      }
    }

    res.json({
      success: true,
      membership: {
        id: membershipRecord[0].id,
        status: initialStatus,
        community: {
          name: communityFields.Name,
          slug: communityFields.Slug
        }
      },
      message: initialStatus === 'Pending'
        ? 'Your membership request has been submitted and is pending approval'
        : 'You have successfully joined the community'
    });

    logDebug(`User ${safeUsername} joined community ${communityFields.Slug} with status ${initialStatus} via invite ${code}`);
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join community'
    });
  }
});

// Get Community Info (Member-Only)
router.get('/api/community/:slug', pollLimiter, checkCommunityMember, async (req, res) => {
  try {
    const community = req.community;
    const settings = community.fields.Settings ? JSON.parse(community.fields.Settings.replace(/\\_/g, '_')) : {};

    // Get member count
    // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
    const safeCommunityNameForCount = sanitizeForAirtable(community.fields.Name);
    const memberCount = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND(FIND('${safeCommunityNameForCount}', ARRAYJOIN({Name (from Community)}, '||')), {Status} = 'Active')`
    }).all();

    res.json({
      success: true,
      community: {
        name: community.fields.Name,
        slug: community.fields.Slug,
        description: community.fields.Description || '',
        memberCount: memberCount.length,
        minActiveForMatching: community.fields.Min_Active_For_Matching || 6,
        settings: settings,
        myRole: req.membership.fields.Role
      }
    });
  } catch (error) {
    console.error('Error fetching community info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community information'
    });
  }
});

// Get Community Members List (Visibility-Controlled)
router.get('/api/community/:slug/members', pollLimiter, checkCommunityMember, async (req, res) => {
  try {
    const settings = req.community.fields.Settings ? JSON.parse(req.community.fields.Settings.replace(/\\_/g, '_')) : {};
    const visibleTo = settings.member_list_visible_to || 'all_members';

    // Check visibility permissions
    const memberRole = req.membership.fields.Role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';

    if (visibleTo === 'admins_only' && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view member list'
      });
    }

    // Fetch community members
    // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
    const safeCommunityNameForMembers = sanitizeForAirtable(req.community.fields.Name);
    const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND(FIND('${safeCommunityNameForMembers}', ARRAYJOIN({Name (from Community)}, '||')), {Status} = 'Active')`,
      sort: [{ field: 'Joined_At', direction: 'asc' }]
    }).all();

    const members = [];
    for (const membership of memberships) {
      const memberIds = membership.fields.Member;
      if (memberIds && memberIds.length > 0) {
        const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
        members.push({
          membershipId: membership.id,
          username: member.fields.Tg_Username,
          name: member.fields.Name || '',
          role: membership.fields.Role,
          joinedAt: membership.fields.Joined_At
        });
      }
    }

    res.json({
      success: true,
      members: members
    });
  } catch (error) {
    console.error('Error fetching community members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community members'
    });
  }
});

// Update Community Settings (Admin-Only)
router.put('/api/community/:slug', apiLimiter, adminLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { name, description, minActiveForMatching, settings } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Name must be a non-empty string'
        });
      }
      updates.Name = sanitizeForAirtable(name.trim());
    }

    if (description !== undefined) {
      updates.Description = sanitizeForAirtable(description);
    }

    if (minActiveForMatching !== undefined) {
      if (typeof minActiveForMatching !== 'number' || minActiveForMatching < 2) {
        return res.status(400).json({
          success: false,
          error: 'minActiveForMatching must be a number >= 2'
        });
      }
      updates.Min_Active_For_Matching = minActiveForMatching;
    }

    if (settings !== undefined) {
      // Validate settings structure
      const validApprovalModes = ['auto', 'manual'];
      const validVisibility = ['all_members', 'admins_only'];
      const validOddHandling = ['skip', 'notify_admin'];

      if (settings.approval_mode && !validApprovalModes.includes(settings.approval_mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid approval_mode'
        });
      }

      if (settings.member_list_visible_to && !validVisibility.includes(settings.member_list_visible_to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid member_list_visible_to'
        });
      }

      if (settings.invite_links_visible_to && !validVisibility.includes(settings.invite_links_visible_to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid invite_links_visible_to'
        });
      }

      if (settings.odd_user_handling && !validOddHandling.includes(settings.odd_user_handling)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid odd_user_handling'
        });
      }

      updates.Settings = JSON.stringify(settings);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Update community
    await base(process.env.AIRTABLE_COMMUNITIES_TABLE).update([
      {
        id: req.community.id,
        fields: updates
      }
    ]);

    res.json({
      success: true,
      message: 'Community updated successfully'
    });

    logDebug(`Community ${req.params.slug} updated by ${req.membership.fields.Member}`);
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update community'
    });
  }
});

// Get User's Communities
router.get('/api/my/communities', pollLimiter, async (req, res) => {
  try {
    const username = req.query.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // Find user
    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userRecords[0];
    const userId = user.id;
    const matchingContext = user.fields.Matching_Context || 'global';

    // Find user's community memberships (use lookup field for linked record matching)
    const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND({Tg_Username (from Member)} = '${safeUsername}', OR({Status} = 'Active', {Status} = 'Pending'))`
    }).all();

    const communities = [];
    for (const membership of memberships) {
      const communityIds = membership.fields.Community;
      if (communityIds && communityIds.length > 0) {
        const community = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).find(communityIds[0]);
        communities.push({
          slug: community.fields.Slug,
          name: community.fields.Name,
          role: membership.fields.Role,
          status: membership.fields.Status,
          isCurrentMatchingContext: matchingContext === `community:${community.fields.Slug}`
        });
      }
    }

    res.json({
      success: true,
      matchingContext: matchingContext,
      communities: communities
    });
  } catch (error) {
    console.error('Error fetching user communities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch communities'
    });
  }
});

// Update User's Matching Context
router.put('/api/my/matching-context', apiLimiter, async (req, res) => {
  try {
    const username = req.body.username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { matchingContext } = req.body;

    // Validate matching context format
    if (!matchingContext || typeof matchingContext !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'matchingContext is required'
      });
    }

    if (matchingContext !== 'global' && !matchingContext.startsWith('community:')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid matchingContext format. Must be "global" or "community:{slug}"'
      });
    }

    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    // If community context, verify user is active member
    if (matchingContext.startsWith('community:')) {
      const slug = matchingContext.replace('community:', '');

      // Find community
      const communityRecords = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({
        filterByFormula: `{Slug} = '${sanitizeForAirtable(slug)}'`,
        maxRecords: 1
      }).firstPage();

      if (communityRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Community not found'
        });
      }

      const communityName = communityRecords[0].fields.Name;
      const safeCommunityName = sanitizeForAirtable(communityName);

      // Find user
      const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      }).firstPage();

      if (userRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const userId = userRecords[0].id;

      // Verify active membership
      // Note: Lookup fields return arrays — use FIND() + ARRAYJOIN() instead of = for matching
      const memberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
        filterByFormula: `AND({Tg_Username (from Member)} = '${safeUsername}', FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')), {Status} = 'Active')`,
        maxRecords: 1
      }).firstPage();

      if (memberships.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You are not an active member of this community'
        });
      }

      // Update matching context
      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: userId,
          fields: {
            Matching_Context: matchingContext
          }
        }
      ]);
    } else {
      // Global context
      const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      }).firstPage();

      if (userRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: userRecords[0].id,
          fields: {
            Matching_Context: 'global'
          }
        }
      ]);
    }

    res.json({
      success: true,
      matchingContext: matchingContext,
      message: 'Matching context updated successfully'
    });

    logDebug(`User ${safeUsername} set matching context to ${matchingContext}`);
  } catch (error) {
    console.error('Error updating matching context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update matching context'
    });
  }
});

// Leave Community
router.post('/api/community/:slug/leave', apiLimiter, checkCommunityMember, async (req, res) => {
  try {
    // Prevent owner from leaving
    if (req.membership.fields.Role === 'Owner') {
      return res.status(403).json({
        success: false,
        error: 'Community owner cannot leave. Transfer ownership first or delete the community.'
      });
    }

    // Update membership status
    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: req.membership.id,
        fields: {
          Status: 'Removed',
          Left_At: new Date().toISOString()
        }
      }
    ]);

    // If user's matching context is this community, reset to global
    const username = req.user?.Tg_Username || req.headers['x-user'];
    const safeUsername = sanitizeUsername(username.replace('@', '').trim().toLowerCase());

    const userRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length > 0) {
      const user = userRecords[0];
      const matchingContext = user.fields.Matching_Context || 'global';

      if (matchingContext === `community:${req.params.slug}`) {
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: user.id,
            fields: {
              Matching_Context: 'global'
            }
          }
        ]);
      }
    }

    res.json({
      success: true,
      message: 'You have successfully left the community'
    });

    logDebug(`User ${safeUsername} left community ${req.params.slug}`);
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave community'
    });
  }
});

// Remove Member from Community (Admin Only)
router.post('/api/community/:slug/members/:membershipId/remove', apiLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { membershipId } = req.params;

    const membership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).find(membershipId);

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership not found' });
    }

    const communityIds = membership.fields.Community;
    if (!communityIds || !communityIds.includes(req.community.id)) {
      return res.status(403).json({ success: false, error: 'Membership does not belong to this community' });
    }

    if (membership.fields.Role === 'Owner') {
      return res.status(403).json({ success: false, error: 'Cannot remove the community owner' });
    }

    if (membership.fields.Status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Member is not active' });
    }

    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: membershipId,
        fields: {
          Status: 'Removed',
          Left_At: new Date().toISOString()
        }
      }
    ]);

    // Reset matching context if it was set to this community
    const memberIds = membership.fields.Member;
    if (memberIds && memberIds.length > 0) {
      const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
      const matchingContext = member.fields.Matching_Context || 'global';

      if (matchingContext === `community:${req.params.slug}`) {
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: member.id,
            fields: { Matching_Context: 'global' }
          }
        ]);
      }
    }

    res.json({ success: true });
    logDebug(`Membership ${membershipId} removed by admin in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

// Get Pending Members (Admin Only)
router.get('/api/community/:slug/pending-members', pollLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const safeCommunityName = sanitizeForAirtable(req.community.fields.Name);

    const pendingMemberships = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND(FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')), {Status} = 'Pending')`,
      sort: [{ field: 'Joined_At', direction: 'asc' }]
    }).all();

    const pendingMembers = [];
    for (const membership of pendingMemberships) {
      const memberIds = membership.fields.Member;
      if (memberIds && memberIds.length > 0) {
        const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
        pendingMembers.push({
          membershipId: membership.id,
          username: member.fields.Tg_Username,
          name: member.fields.Name || '',
          requestedAt: membership.fields.Joined_At || null
        });
      }
    }

    res.json({
      success: true,
      pendingMembers
    });
  } catch (error) {
    console.error('Error fetching pending members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending members'
    });
  }
});

// Approve Pending Member (Admin Only)
router.post('/api/community/:slug/members/:membershipId/approve', apiLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { membershipId } = req.params;

    // Verify membership belongs to this community and is Pending
    const membership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).find(membershipId);

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership not found' });
    }

    const communityIds = membership.fields.Community;
    if (!communityIds || !communityIds.includes(req.community.id)) {
      return res.status(403).json({ success: false, error: 'Membership does not belong to this community' });
    }

    if (membership.fields.Status !== 'Pending') {
      return res.status(400).json({ success: false, error: 'Membership is not pending' });
    }

    // Update status to Active
    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: membershipId,
        fields: { Status: 'Active' }
      }
    ]);

    // Send Telegram notification to user
    const memberIds = membership.fields.Member;
    if (memberIds && memberIds.length > 0) {
      const member = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(memberIds[0]);
      const userTgId = member.fields.Tg_ID;

      if (userTgId) {
        const bot = getBotInstance();
        if (bot) {
          const resolvedUser = resolveRecipient(userTgId);
          try {
            await bot.telegram.sendMessage(
              resolvedUser.chatId,
              `${resolvedUser.prefix}🎉 Your membership to *${req.community.fields.Name}* has been approved!\n\n` +
              `You can now participate in weekly coffee matches within this community.`,
              { parse_mode: 'Markdown' }
            );
          } catch (tgErr) {
            console.error('Error sending approval notification:', tgErr);
          }
        }
      }
    }

    res.json({ success: true });
    logDebug(`Membership ${membershipId} approved by admin in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error approving membership:', error);
    res.status(500).json({ success: false, error: 'Failed to approve membership' });
  }
});

// Reject Pending Member (Admin Only)
router.post('/api/community/:slug/members/:membershipId/reject', apiLimiter, checkCommunityAdmin, async (req, res) => {
  try {
    const { membershipId } = req.params;

    // Verify membership belongs to this community and is Pending
    const membership = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).find(membershipId);

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Membership not found' });
    }

    const communityIds = membership.fields.Community;
    if (!communityIds || !communityIds.includes(req.community.id)) {
      return res.status(403).json({ success: false, error: 'Membership does not belong to this community' });
    }

    if (membership.fields.Status !== 'Pending') {
      return res.status(400).json({ success: false, error: 'Membership is not pending' });
    }

    // Update status to Removed
    await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).update([
      {
        id: membershipId,
        fields: { Status: 'Removed' }
      }
    ]);

    res.json({ success: true });
    logDebug(`Membership ${membershipId} rejected by admin in community ${req.params.slug}`);
  } catch (error) {
    console.error('Error rejecting membership:', error);
    res.status(500).json({ success: false, error: 'Failed to reject membership' });
  }
});

module.exports = router;
