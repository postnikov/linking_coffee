/**
 * Community Access Control Middleware
 *
 * Provides authorization middleware for community member and admin endpoints.
 * Ensures users have appropriate permissions before accessing community resources.
 *
 * Created: 2026-02-10
 * Security: Critical - Access control for Closed Communities feature
 */

const base = require('../shared/base');
const { sanitizeForAirtable } = require('./airtable-sanitizer');

/**
 * Verifies that the authenticated user is an Active member of the specified community
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 *
 * Usage:
 *   app.get('/api/community/:slug/info', checkCommunityMember, async (req, res) => { ... })
 *
 * Requirements:
 *   - User must be authenticated (req.user must exist with Tg_Username)
 *   - Community slug must be in route params (req.params.slug)
 *   - User must have Community_Members record with Status = 'Active'
 */
async function checkCommunityMember(req, res, next) {
  try {
    // Check if user is authenticated
    const username = req.user?.Tg_Username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get community slug from route params
    const communitySlug = req.params.slug;
    if (!communitySlug) {
      return res.status(400).json({
        success: false,
        error: 'Community slug is required'
      });
    }

    // Sanitize inputs
    const safeUsername = sanitizeForAirtable(username.replace('@', '').trim().toLowerCase());
    const safeSlug = sanitizeForAirtable(communitySlug);

    // Find the community by slug
    const communityRecords = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({
      filterByFormula: `{Slug} = '${safeSlug}'`,
      maxRecords: 1
    }).firstPage();

    if (communityRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    const community = communityRecords[0];
    const communityId = community.id;

    // Find the user by username
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

    // Check if user is an Active member of the community
    // Note: Lookup fields like {Name (from Community)} return arrays when a record
    // links to multiple communities. Use FIND() + ARRAYJOIN() instead of = for matching.
    const communityName = community.fields.Name;
    const safeCommunityName = sanitizeForAirtable(communityName);
    const membershipRecords = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND(
        {Tg_Username (from Member)} = '${safeUsername}',
        FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
        {Status} = 'Active'
      )`,
      maxRecords: 1
    }).firstPage();

    if (membershipRecords.length === 0) {
      // Check if membership is Pending
      const pendingRecords = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
        filterByFormula: `AND(
          {Tg_Username (from Member)} = '${safeUsername}',
          FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
          {Status} = 'Pending'
        )`,
        maxRecords: 1
      }).firstPage();

      if (pendingRecords.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Membership pending approval',
          membershipStatus: 'Pending'
        });
      }

      return res.status(403).json({
        success: false,
        error: 'Not a member of this community or membership not active'
      });
    }

    // Attach community and membership info to request for downstream use
    req.community = community;
    req.membership = membershipRecords[0];
    req.userId = userId;

    next();
  } catch (error) {
    console.error('Community member check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify community membership'
    });
  }
}

/**
 * Verifies that the authenticated user is an Owner or Admin of the specified community
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 *
 * Usage:
 *   app.post('/api/community/:slug/invite-links', checkCommunityAdmin, async (req, res) => { ... })
 *
 * Requirements:
 *   - User must be authenticated (req.user must exist with Tg_Username)
 *   - Community slug must be in route params (req.params.slug)
 *   - User must have Community_Members record with Status = 'Active' and Role = 'Owner' or 'Admin'
 */
async function checkCommunityAdmin(req, res, next) {
  try {
    // Check if user is authenticated
    const username = req.user?.Tg_Username || req.headers['x-user'];
    if (!username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get community slug from route params
    const communitySlug = req.params.slug;
    if (!communitySlug) {
      return res.status(400).json({
        success: false,
        error: 'Community slug is required'
      });
    }

    // Sanitize inputs
    const safeUsername = sanitizeForAirtable(username.replace('@', '').trim().toLowerCase());
    const safeSlug = sanitizeForAirtable(communitySlug);

    // Find the community by slug
    const communityRecords = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({
      filterByFormula: `{Slug} = '${safeSlug}'`,
      maxRecords: 1
    }).firstPage();

    if (communityRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    const community = communityRecords[0];
    const communityId = community.id;

    // Find the user by username
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

    // Check if user is an Owner or Admin of the community
    // Note: Lookup fields like {Name (from Community)} return arrays when a record
    // links to multiple communities. Use FIND() + ARRAYJOIN() instead of = for matching.
    const communityName = community.fields.Name;
    const safeCommunityName = sanitizeForAirtable(communityName);
    const membershipRecords = await base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
      filterByFormula: `AND(
        {Tg_Username (from Member)} = '${safeUsername}',
        FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
        {Status} = 'Active',
        OR({Role} = 'Owner', {Role} = 'Admin')
      )`,
      maxRecords: 1
    }).firstPage();

    if (membershipRecords.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Not an admin of this community'
      });
    }

    // Attach community and membership info to request for downstream use
    req.community = community;
    req.membership = membershipRecords[0];
    req.userId = userId;
    req.isAdmin = true;

    next();
  } catch (error) {
    console.error('Community admin check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify community admin status'
    });
  }
}

module.exports = {
  checkCommunityMember,
  checkCommunityAdmin
};
