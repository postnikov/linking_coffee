const router = require('express').Router();

// Production safety: return empty router if somehow loaded in production
// Primary guard is in server.js (conditional mount), this is belt-and-suspenders
if (process.env.NODE_ENV === 'production') {
  module.exports = router;
} else {
  const base = require('../shared/base');
  const { sanitizeForAirtable } = require('../utils/airtable-sanitizer');
  const testUsers = require('../tests/fixtures/test-users.json');

  const TEST_PREFIX = testUsers.prefix;

  // Helper: build Created_At using local date (not UTC)
  function localDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper: find test user record by username
  async function findTestUser(username) {
    const safeUsername = sanitizeForAirtable(username);
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      })
      .firstPage();
    return records.length > 0 ? records[0] : null;
  }

  // Helper: build session object from fixture + record
  function buildSessionObject(userDef, record) {
    const tgId = (record && record.fields.Tg_ID) || userDef.fields.Tg_ID;
    return {
      id: record ? record.id : null,
      username: userDef.fields.Tg_Username,
      Tg_Username: userDef.fields.Tg_Username,
      Tg_ID: tgId,
      tgId: tgId,
      status: (record && record.fields.Status) || userDef.fields.Status,
      consentGdpr: (record && record.fields.Consent_GDPR) || userDef.fields.Consent_GDPR || false,
      firstName: (record && record.fields.Name) || userDef.fields.Name,
      lastName: (record && record.fields.Family) || userDef.fields.Family,
      email: (record && record.fields.Email) || userDef.fields.Email,
      telegramConnected: !!tgId,
      linkedAccounts: []
    };
  }

  // POST /api/dev/seed-test-users - Create test users (idempotent)
  router.post('/api/dev/seed-test-users', async (req, res) => {
    try {
      const { users: requestedKeys } = req.body || {};
      const usersToSeed = requestedKeys
        ? testUsers.users.filter(u => requestedKeys.includes(u.key))
        : testUsers.users;

      const created = [];
      const skipped = [];

      for (const userDef of usersToSeed) {
        const existing = await findTestUser(userDef.fields.Tg_Username);

        if (existing) {
          skipped.push({
            key: userDef.key,
            reason: 'already exists',
            recordId: existing.id
          });
          continue;
        }

        const fields = {
          ...userDef.fields,
          Created_At: localDateString()
        };

        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
          .create([{ fields }], { typecast: true });

        created.push({
          key: userDef.key,
          recordId: records[0].id,
          username: userDef.fields.Tg_Username
        });
      }

      console.log(`[DEV] Seeded test users: ${created.length} created, ${skipped.length} skipped`);
      res.json({ success: true, created, skipped });
    } catch (error) {
      console.error('[DEV] Seed error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DELETE /api/dev/seed-test-users - Remove test users + their matches
  router.delete('/api/dev/seed-test-users', async (req, res) => {
    try {
      const { users: requestedKeys } = req.body || {};
      const usersToDelete = requestedKeys
        ? testUsers.users.filter(u => requestedKeys.includes(u.key))
        : testUsers.users;

      const deleted = [];
      const notFound = [];

      for (const userDef of usersToDelete) {
        const existing = await findTestUser(userDef.fields.Tg_Username);

        if (!existing) {
          notFound.push(userDef.key);
          continue;
        }

        await base(process.env.AIRTABLE_MEMBERS_TABLE).destroy([existing.id]);
        deleted.push({ key: userDef.key, recordId: existing.id });
      }

      // Best-effort cleanup of matches involving test users
      try {
        const safePrefix = sanitizeForAirtable(TEST_PREFIX);
        const testMatches = await base(process.env.AIRTABLE_MATCHES_TABLE)
          .select({
            filterByFormula: `OR(FIND('${safePrefix}', ARRAYJOIN({Tg_Username (from Member1)}, '')), FIND('${safePrefix}', ARRAYJOIN({Tg_Username (from Member2)}, '')))`,
            maxRecords: 100
          })
          .firstPage();

        if (testMatches.length > 0) {
          const matchIds = testMatches.map(m => m.id);
          for (let i = 0; i < matchIds.length; i += 10) {
            const batch = matchIds.slice(i, i + 10);
            await base(process.env.AIRTABLE_MATCHES_TABLE).destroy(batch);
          }
          console.log(`[DEV] Cleaned up ${testMatches.length} test matches`);
        }
      } catch (matchError) {
        console.error('[DEV] Match cleanup error (non-fatal):', matchError.message);
      }

      console.log(`[DEV] Cleanup: ${deleted.length} deleted, ${notFound.length} not found`);
      res.json({ success: true, deleted, notFound });
    } catch (error) {
      console.error('[DEV] Cleanup error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/dev/seed-test-users/login - Auto-seed if needed + return session
  router.post('/api/dev/seed-test-users/login', async (req, res) => {
    try {
      const { key, username } = req.body || {};

      const userDef = key
        ? testUsers.users.find(u => u.key === key)
        : testUsers.users.find(u => u.fields.Tg_Username === username);

      if (!userDef) {
        return res.status(404).json({
          success: false,
          message: `Test user not found: ${key || username}`
        });
      }

      let record = await findTestUser(userDef.fields.Tg_Username);

      // Auto-seed if missing
      if (!record) {
        const fields = {
          ...userDef.fields,
          Created_At: localDateString()
        };

        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
          .create([{ fields }], { typecast: true });
        record = records[0];
        console.log(`[DEV] Auto-seeded test user: ${userDef.key}`);
      }

      const user = buildSessionObject(userDef, record);
      console.log(`[DEV] Test user login: ${userDef.key}`);
      res.json({ success: true, user });
    } catch (error) {
      console.error('[DEV] Login error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  module.exports = router;
}
