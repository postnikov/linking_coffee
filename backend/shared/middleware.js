const base = require('./base');
const { sanitizeUsername } = require('../utils/airtable-sanitizer');

const checkAdmin = async (req, res, next) => {
  const requester = req.headers['x-admin-user'] || req.query.requester;
  if (!requester) return res.status(403).json({ success: false, message: 'No admin user specified' });

  const cleanRequester = requester.replace('@', '').trim().toLowerCase();

  try {
    const safeUsername = sanitizeUsername(cleanRequester);

    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
      filterByFormula: `{Tg_Username} = '${safeUsername}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length > 0 && records[0].fields.Status === 'Admin') {
      req.adminUser = cleanRequester;
      next();
    } else {
      res.status(403).json({ success: false, message: 'Not an admin' });
    }
  } catch (e) {
    console.error('Admin check error:', e);
    res.status(500).json({ success: false, message: 'Auth error' });
  }
};

module.exports = { checkAdmin };
