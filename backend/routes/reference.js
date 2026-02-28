const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const base = require('../shared/base');

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linked.Coffee API is running' });
});

// Step 3.5: Get Countries
router.get('/api/countries', async (req, res) => {
  try {
    const records = await base(process.env.AIRTABLE_COUNTRIES_TABLE || 'Countries')
      .select({
        view: 'Grid view' // Optional: specify view if needed
      })
      .all();

    const countries = records.map(record => {
      const isoCode = record.fields.ISO_Code;
      // Generate flag emoji from ISO code
      const flag = isoCode ? isoCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '';

      return {
        id: record.id,
        name: record.fields.Name_en,
        flag: flag,
        iso: isoCode
      };
    });

    res.json({ success: true, countries });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch countries' });
  }
});

// Step 3.6: Get Cities
router.get('/api/cities', async (req, res) => {
  const { countryIso } = req.query;
  try {
    const filterFormula = countryIso
      ? `AND({Approved} = 1, {country_iso} = '${countryIso}')`
      : `{Approved} = 1`;

    const records = await base(process.env.AIRTABLE_CITIES_TABLE || 'Cities')
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: "name_en", direction: "asc" }]
      })
      .all();

    const cities = records.map(record => ({
      id: record.id,
      name: record.fields.name_en,
      slug: record.fields.Slug
    }));

    res.json({ success: true, cities });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
});

// Add a new city
router.post('/api/cities', async (req, res) => {
  const { name, countryIso } = req.body;
  console.log('Adding city:', { name, countryIso });

  if (!name || !countryIso) {
    return res.status(400).json({ success: false, message: 'Name and Country ISO are required' });
  }

  try {
    const slug = name.toLowerCase().trim().replace(/[\s\W-]+/g, '-');

    const createdRecord = await base(process.env.AIRTABLE_CITIES_TABLE).create([
      {
        "fields": {
          "name_en": name,
          "country_iso": countryIso,
          "Slug": slug,
          "Approved": false
        }
      }
    ], { typecast: true });

    const newCity = {
      id: createdRecord[0].id,
      name: createdRecord[0].fields.name_en,
      slug: createdRecord[0].fields.Slug
    };

    res.json({ success: true, city: newCity });
  } catch (error) {
    console.error('Error adding city:', error);
    res.status(500).json({ success: false, message: 'Failed to add city: ' + error.message });
  }
});

// Step 3.5: Get Interests
router.get('/api/interests', (req, res) => {
  try {
    const interestsPath = path.join(__dirname, '..', 'interests.json');
    if (fs.existsSync(interestsPath)) {
      const interests = JSON.parse(fs.readFileSync(interestsPath, 'utf8'));
      res.json({ success: true, interests });
    } else {
      res.status(404).json({ success: false, message: 'Interests file not found' });
    }
  } catch (error) {
    console.error('Error reading interests:', error);
    res.status(500).json({ success: false, message: 'Failed to read interests' });
  }
});

module.exports = router;
