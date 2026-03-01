const router = require('express').Router();
const base = require('../shared/base');
const { upload } = require('../shared/upload');
const { logDebug } = require('../shared/logging');
const { sanitizeUsername, sanitizeEmail, sanitizeForAirtable } = require('../utils/airtable-sanitizer');

// ─── Tokenized Profile View (no auth) ───────────────────────────────────────

router.get('/api/view/:token', async (req, res) => {
  const { token } = req.params;

  if (!token || token.length !== 32) {
    return res.status(404).json({ success: false, message: 'Invalid token' });
  }

  try {
    // Move date calculation before query to use in filter
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dateFilter = twoWeeksAgo.toISOString().split('T')[0];

    // Find match by View_Token_1 or View_Token_2 AND ensure it's recent
    const matchRecords = await base('tblx2OEN5sSR1xFI2').select({
      filterByFormula: `AND(IS_AFTER({Week_Start}, '${dateFilter}'), OR({View_Token_1} = '${token}', {View_Token_2} = '${token}'))`,
      maxRecords: 1
    }).firstPage();

    if (matchRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found or expired' });
    }

    const match = matchRecords[0];
    const weekStart = new Date(match.fields.Week_Start);

    // Double check if match is older than 2 weeks (redundant but safe)
    if (weekStart < twoWeeksAgo) {
      return res.status(404).json({ success: false, message: 'Token expired' });
    }

    // Determine which profile to show based on which token was used
    const isToken1 = match.fields.View_Token_1 === token;
    // Token1 is for Member1 to view Member2, Token2 is for Member2 to view Member1
    const partnerField = isToken1 ? 'Member2' : 'Member1';
    const partnerLink = match.fields[partnerField];

    if (!partnerLink || partnerLink.length === 0) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // Fetch partner profile
    const partnerRecord = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(partnerLink[0]);
    const p = partnerRecord.fields;

    // Fetch country/city if linked
    let country = null;
    let city = null;

    if (p.Country && p.Country.length > 0) {
      try {
        const countryRecord = await base('tblTDQuqGDEDTPMLO').find(p.Country[0]);
        const isoCode = countryRecord.fields.ISO_Code;
        const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';
        country = { name: countryRecord.fields.Name_en, flag, iso: isoCode };
      } catch (e) { /* ignore */ }
    }

    if (p.City_Link && p.City_Link.length > 0) {
      try {
        const cityRecord = await base('tbllGzaGTz3PsxxWT').find(p.City_Link[0]);
        city = { name: cityRecord.fields.name_en };
      } catch (e) { /* ignore */ }
    }

    // Get intro for the viewer
    const introField = isToken1 ? 'Intro_1' : 'Intro_2';
    let intro = null;
    if (match.fields[introField]) {
      try {
        intro = JSON.parse(match.fields[introField]);
      } catch (e) { /* ignore */ }
    }

    const profile = {
      name: p.Name,
      family: p.Family,
      avatar: p.Avatar && p.Avatar.length > 0 ? p.Avatar[0].url : null,
      profession: p.Profession,
      grade: p.Grade,
      country,
      city,
      timezone: p.Time_Zone,
      professionalDesc: p.Professional_Description,
      personalDesc: p.Personal_Description,
      professionalInterests: p.Professional_Interests,
      personalInterests: p.Personal_Interests,
      coffeeGoals: p.Coffee_Goals,
      languages: p.Languages,
      bestMeetingDays: p.Best_Meeting_Days,
      linkedin: p.LinkedIn,
      tg_username: p.Tg_Username
    };

    res.json({ success: true, profile, intro });

  } catch (error) {
    console.error('View Token API Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Get User Profile ────────────────────────────────────────────────────────

// Step 4: Get User Profile
router.get('/api/profile', async (req, res) => {
  const { username, requester, id, email, communitySlug } = req.query;
  const requestId = Date.now();
  console.time(`Profile_Req_${requestId}`);

  // We need at least one identifier
  if (!username && !id && !email) {
    return res.status(400).json({ success: false, message: 'Username, ID, or Email is required' });
  }

  const cleanUsername = username ? username.replace('@', '').trim().toLowerCase() : null;
  const cleanRequester = requester ? requester.replace('@', '').trim().toLowerCase() : null;

  logDebug(`GET /api/profile request for ${cleanUsername || id || email} by ${cleanRequester || 'SELF'}`);

  try {
    // --- PHASE 1: Fetch Core Data in Parallel ---
    console.time(`Phase1_Core_${requestId}`);

    // 1. Fetch Target User
    let pTargetUser;
    if (id) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE).find(id)
        .then(record => [record]) // Wrap in array to match .select() output
        .catch(err => []);
    } else if (cleanUsername) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Tg_Username} = '${cleanUsername}'`, maxRecords: 1 })
        .firstPage();
    } else if (email) {
      pTargetUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Email} = '${email}'`, maxRecords: 1 })
        .firstPage();
    } else {
      // Should not happen
      pTargetUser = Promise.resolve([]);
    }

    // 2. Fetch Requester (if different and present, for Admin check)
    let pRequesterUser = Promise.resolve([]);
    if (cleanRequester && cleanUsername && cleanUsername !== cleanRequester) {
      pRequesterUser = base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({ filterByFormula: `{Tg_Username} = '${cleanRequester}'`, maxRecords: 1 })
        .firstPage();
    }

    // 3. Fetch Access Validation Match (if not self view)
    let pAccessMatch = Promise.resolve([]);
    if (cleanRequester && cleanUsername && cleanUsername !== cleanRequester) {
      pAccessMatch = base('tblx2OEN5sSR1xFI2').select({
        filterByFormula: `OR(
              AND({Tg_Username (from Member1)} = '${cleanRequester}', {Tg_Username (from Member2)} = '${cleanUsername}'),
              AND({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanRequester}')
          )`,
        maxRecords: 1
      }).firstPage();
    }

    // 4. Community Member Access Check (if communitySlug provided)
    let pCommunityMemberAccess = Promise.resolve({ requesterIsMember: false, targetIsMember: false });
    if (communitySlug && cleanRequester && cleanUsername && cleanUsername !== cleanRequester) {
      const safeSlug = sanitizeForAirtable(communitySlug);
      const safeRequester = sanitizeForAirtable(cleanRequester);
      const safeTarget = sanitizeForAirtable(cleanUsername);

      pCommunityMemberAccess = (async () => {
        const communityRecords = await base(process.env.AIRTABLE_COMMUNITIES_TABLE).select({
          filterByFormula: `{Slug} = '${safeSlug}'`,
          maxRecords: 1
        }).firstPage();

        if (communityRecords.length === 0) {
          return { requesterIsMember: false, targetIsMember: false };
        }

        const safeCommunityName = sanitizeForAirtable(communityRecords[0].fields.Name);

        const [requesterCheck, targetCheck] = await Promise.all([
          base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
            filterByFormula: `AND(
              {Tg_Username (from Member)} = '${safeRequester}',
              FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
              {Status} = 'Active'
            )`,
            maxRecords: 1
          }).firstPage(),
          base(process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE).select({
            filterByFormula: `AND(
              {Tg_Username (from Member)} = '${safeTarget}',
              FIND('${safeCommunityName}', ARRAYJOIN({Name (from Community)}, '||')),
              {Status} = 'Active'
            )`,
            maxRecords: 1
          }).firstPage()
        ]);

        return {
          requesterIsMember: requesterCheck.length > 0,
          targetIsMember: targetCheck.length > 0
        };
      })().catch(() => ({ requesterIsMember: false, targetIsMember: false }));
    }

    // 5. Fetch Latest Match (Deferred if no username yet)
    // We only care about matches from current week or older?
    // Actually we just want the *latest* match.
    const recentDate = '2024-01-01';
    let pLatestMatch = Promise.resolve([]);

    if (cleanUsername) {
      pLatestMatch = base('tblx2OEN5sSR1xFI2').select({
        filterByFormula: `AND(IS_AFTER({Week_Start}, '${recentDate}'), OR({Tg_Username (from Member1)} = '${cleanUsername}', {Tg_Username (from Member2)} = '${cleanUsername}'))`,
        sort: [{ field: 'Week_Start', direction: 'desc' }],
        maxRecords: 1
      }).firstPage();
    }

    const [targetUserRecords, requesterRecords, accessMatchRecords, latestMatchRecords, communityMemberAccess] =
      await Promise.all([pTargetUser, pRequesterUser, pAccessMatch, pLatestMatch, pCommunityMemberAccess]);

    console.timeEnd(`Phase1_Core_${requestId}`);

    // --- PHASE 2: Validation & Core Data Extraction ---

    // User Existence Check
    if (targetUserRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const targetRecord = targetUserRecords[0];
    const fields = targetRecord.fields;

    // Access Control Validation
    if (cleanUsername !== cleanRequester) {
      const isRequesterAdmin = requesterRecords.length > 0 && requesterRecords[0].fields.Status === 'Admin';
      const isMatched = accessMatchRecords.length > 0;
      const isCommunityMember = communityMemberAccess.requesterIsMember && communityMemberAccess.targetIsMember;

      if (!isRequesterAdmin && !isMatched && !isCommunityMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view profiles of your matches.',
          error_code: 'access_denied_match_only'
        });
      }
    }

    // --- PHASE 3: Fetch Enrichment Data in Parallel ---
    console.time(`Phase3_Enrich_${requestId}`);

    const enrichmentPromises = [];

    // 1. Country
    if (fields.Countries && fields.Countries.length > 0) {
      enrichmentPromises.push(
        base('tblTDQuqGDEDTPMLO').find(fields.Countries[0])
          .then(r => ({ type: 'country', data: r }))
          .catch(e => ({ type: 'country', error: e }))
      );
    }

    // 2. City
    if (fields.City_Link && fields.City_Link.length > 0) {
      enrichmentPromises.push(
        base(process.env.AIRTABLE_CITIES_TABLE || 'Cities').find(fields.City_Link[0])
          .then(r => ({ type: 'city', data: r }))
          .catch(e => ({ type: 'city', error: e }))
      );
    }

    // 3. Current Match Partner
    let matchDataRaw = null;
    if (latestMatchRecords.length > 0) {
      const match = latestMatchRecords[0];

      // Calculate start of current week (Monday)
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day == 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));

      // Use local date components to avoid UTC shifts
      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, '0');
      const dd = String(monday.getDate()).padStart(2, '0');
      const currentWeekStart = `${yyyy}-${mm}-${dd}`;

      // Only show if the match is for the current week
      if (match.fields.Week_Start === currentWeekStart) {
        matchDataRaw = match;

        // Identify partner ID to fetch
        const member1Username = match.fields['Tg_Username (from Member1)'] ? match.fields['Tg_Username (from Member1)'][0] : '';
        const isMember1 = member1Username === cleanUsername;
        const otherMemberPrefix = isMember1 ? 'Member2' : 'Member1';
        const otherMemberLink = match.fields[otherMemberPrefix];

        // Extract Intro for the current user
        let introRaw = isMember1 ? match.fields.Intro_1 : match.fields.Intro_2;
        let intro = null;
        if (introRaw) {
          try {
            intro = JSON.parse(introRaw);
          } catch (e) {
            console.error('Failed to parse current match intro:', e);
          }
        }

        if (otherMemberLink && otherMemberLink.length > 0) {
          enrichmentPromises.push(
            base(process.env.AIRTABLE_MEMBERS_TABLE).find(otherMemberLink[0])
              .then(r => ({ type: 'partner', data: r, intro: intro }))
              .catch(e => ({ type: 'partner', error: e }))
          );
        }
      }
    }

    // 4. Active Community
    // Fetch active community membership for this user by Tg_Username
    enrichmentPromises.push(
      base('tblPN0ni3zaaTCPcF').select({
        filterByFormula: `AND(FIND('${cleanUsername}', ARRAYJOIN({Tg_Username (from Member)})), {Status} = 'Active')`,
        maxRecords: 1
      }).firstPage()
        .then(records => {
          if (records.length > 0) {
            const comm = records[0];
            const commName = comm.fields['Name (from Community)'] ? comm.fields['Name (from Community)'][0] : null;
            return { type: 'community', name: commName };
          }
          return { type: 'community', name: null };
        })
        .catch(e => {
          console.error(`❌ Community query error:`, e);
          return { type: 'community', error: e };
        })
    );

    const enrichmentResults = await Promise.all(enrichmentPromises);
    console.timeEnd(`Phase3_Enrich_${requestId}`);

    // Process Enrichment Results
    let country = null;
    let city = null;
    let currentMatch = null;
    let activeCommunity = null;

    // Prepare Match Intro for the Public Profile View (Requester viewing User)
    let publicMatchIntro = null;
    if (cleanUsername !== cleanRequester && accessMatchRecords.length > 0) {
      const accessMatch = accessMatchRecords[0];
      // Who is the requester in this match?
      const m1Username = accessMatch.fields['Tg_Username (from Member1)'] ? accessMatch.fields['Tg_Username (from Member1)'][0] : '';
      // Note: accessMatch filter ensures one of them is requester and the other is target.
      const requesterIsMember1 = m1Username === cleanRequester;
      const introString = requesterIsMember1 ? accessMatch.fields.Intro_1 : accessMatch.fields.Intro_2;

      if (introString) {
        try {
          publicMatchIntro = JSON.parse(introString);
        } catch (e) {
          console.error('Failed to parse public match intro:', e);
        }
      }
    }

    enrichmentResults.forEach(res => {
      if (res.error) {
        console.error(`Error fetching ${res.type}:`, res.error);
        return;
      }
      if (res.type === 'country') {
        const r = res.data;
        const isoCode = r.fields.ISO_Code;
        const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';
        country = { id: r.id, name: r.fields.Name_en, flag, iso: isoCode };
      }
      if (res.type === 'city') {
        const r = res.data;
        city = { id: r.id, name: r.fields.name_en };
      }
      if (res.type === 'partner') {
        const r = res.data;
        currentMatch = {
          name: r.fields.Name,
          family: r.fields.Family,
          username: r.fields.Tg_Username,
          avatar: r.fields.Avatar && r.fields.Avatar.length > 0 ? r.fields.Avatar[0].url : '',
          intro: res.intro // Attach the intro we parsed earlier
        };
      }
      if (res.type === 'community') {
        if (res.name) {
          activeCommunity = { name: res.name };
        }
      }
    });

    // Construct Response
    const profile = {
      name: fields.Name || '',
      family: fields.Family || '',
      email: fields.Email || null,
      country: country,
      city: city,
      timezone: fields.Time_Zone || 'UTC (UTC+0)',
      profession: fields.Profession || '',
      grade: fields.Grade || 'Prefer not to say',
      community: activeCommunity,
      professionalDesc: fields.Professional_Description || '',
      personalDesc: fields.Personal_Description || '',
      professionalInterests: fields.Professional_Interests || [],
      otherProfessionalInterests: fields.Other_Professional_Interests || '',
      personalInterests: fields.Personal_Interests || [],
      otherPersonalInterests: fields.Other_Personal_Interests || '',
      coffeeGoals: fields.Coffee_Goals || [],
      linkedin: fields.Linkedin || '',
      languages: fields.Languages || [],
      bestMeetingDays: fields.Best_Meetings_Days || [],
      serendipity: fields.Serendipity || 5,
      proximity: fields.Proximity || 5,
      nextWeekStatus: fields.Next_Week_Status || 'Active',
      avatar: fields.Avatar && fields.Avatar.length > 0 ? fields.Avatar[0].url : '',
      tg_username: fields.Tg_Username || ''
    };

    console.timeEnd(`Profile_Req_${requestId}`);
    res.json({ success: true, profile, currentMatch, matchIntro: publicMatchIntro });

  } catch (error) {
    console.error('Profile API Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ─── Update User Profile ─────────────────────────────────────────────────────

// Step 5: Update User Profile
router.put('/api/profile', async (req, res) => {
  const { username, id, email, profile } = req.body;

  // We need at least one identifier
  if (!username && !id && !email) {
    return res.status(400).json({ success: false, message: 'User identifier (username, id, or email) is required' });
  }

  const cleanUsername = username ? username.replace('@', '').trim().toLowerCase() : null;
  logDebug(`PUT /api/profile request for ${cleanUsername || id || email}. Data: Name=${profile?.name}`);

  try {
    let record;

    // 1. Try finding by ID
    if (id) {
      try {
        record = await base(process.env.AIRTABLE_MEMBERS_TABLE).find(id);
      } catch (err) {
        console.log(`Could not find record by ID: ${id} for update`);
      }
    }

    // 2. Try finding by Email
    if (!record && email) {
      const safeEmail = sanitizeEmail(email);
      const emailRecords = await base(process.env.AIRTABLE_MEMBERS_TABLE).select({
        filterByFormula: `{Email} = '${safeEmail}'`,
        maxRecords: 1
      }).firstPage();
      if (emailRecords.length > 0) record = emailRecords[0];
    }

    // 3. Try finding by Username
    if (!record && cleanUsername) {
      const safeUsername = sanitizeUsername(cleanUsername);
      const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
        .select({
          filterByFormula: `{Tg_Username} = '${safeUsername}'`,
          maxRecords: 1
        })
        .firstPage();
      if (records.length > 0) record = records[0];
    }

    if (record) {
      // Prepare fields for Airtable
      const updateFields = {
        Name: profile.name,
        Family: profile.family,
        Time_Zone: profile.timezone,
        Profession: profile.profession,
        Grade: profile.grade,
        Professional_Description: profile.professionalDesc,
        Personal_Description: profile.personalDesc,
        Coffee_Goals: profile.coffeeGoals,
        Linkedin: profile.linkedin,
        Languages: profile.languages,
        Best_Meetings_Days: profile.bestMeetingDays,
        Serendipity: profile.serendipity,
        Proximity: profile.proximity,
        Next_Week_Status: profile.nextWeekStatus,
        Professional_Interests: profile.professionalInterests,
        Other_Professional_Interests: profile.otherProfessionalInterests,
        Personal_Interests: profile.personalInterests,
        Other_Personal_Interests: profile.otherPersonalInterests
      };

      // Handle Country Linking
      if (profile.country && profile.country.id) {
        updateFields.Countries = [profile.country.id];
      }

      // Handle City Linking
      if (profile.city && profile.city.id) {
        updateFields.City_Link = [profile.city.id];
      }

      await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
        {
          id: record.id,
          fields: updateFields
        }
      ], { typecast: true }); // Enable typecast to allow creating new options for selects

      res.json({ success: true, message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.error && error.error === 'INVALID_VALUE_FOR_COLUMN') {
      console.error('Invalid value details:', error.message);
    }
    res.status(500).json({ success: false, message: 'Failed to update profile: ' + error.message });
  }
});

// ─── Upload Avatar ───────────────────────────────────────────────────────────

// Step 6: Upload Avatar
router.post('/api/upload-avatar', upload.single('avatar'), async (req, res) => {
  const { username } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();

  // Construct the public URL
  // Force HTTPS in production to ensure Airtable can fetch it without redirects
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.headers['x-forwarded-proto'] || req.protocol);
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  console.log(`📤 Avatar uploaded for ${cleanUsername}: ${fileUrl}`);

  try {
    // Validate and sanitize username
    const safeUsername = sanitizeUsername(cleanUsername);

    // Verify user exists
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({
        filterByFormula: `{Tg_Username} = '${safeUsername}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      // Update Airtable with the new avatar URL
      // This works now because the server is deployed and the URL is public!
      try {
        await base(process.env.AIRTABLE_MEMBERS_TABLE).update([
          {
            id: records[0].id,
            fields: {
              Avatar: [
                { url: fileUrl }
              ]
            }
          }
        ]);
        console.log('✅ Airtable updated with new avatar URL');
      } catch (airtableError) {
        console.error('Failed to update Airtable (non-fatal):', airtableError);
        // We continue even if Airtable update fails, so the user sees their upload
      }

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: fileUrl
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload avatar' });
  }
});

module.exports = router;
