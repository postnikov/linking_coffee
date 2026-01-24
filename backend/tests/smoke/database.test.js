const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

describe('Smoke Tests: Airtable Database', () => {

  test('Airtable API key is valid', async () => {
    // Simple read query (limit 1 to minimize impact)
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({ maxRecords: 1 })
      .firstPage();

    expect(records).toBeDefined();
    expect(Array.isArray(records)).toBe(true);
  });

  test('Members table is accessible', async () => {
    const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({ maxRecords: 1, fields: ['Tg_Username'] })
      .firstPage();

    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  test('Countries table is accessible', async () => {
    const records = await base(process.env.AIRTABLE_COUNTRIES_TABLE)
      .select({ maxRecords: 1, fields: ['ISO_Code'] })
      .firstPage();

    expect(records.length).toBeGreaterThan(0);
  });

  test('Matches table is accessible', async () => {
    const records = await base(process.env.AIRTABLE_MATCHES_TABLE)
      .select({ maxRecords: 1, fields: ['Status'] })
      .firstPage();

    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  test('Airtable response time is acceptable (<3s)', async () => {
    const start = Date.now();
    await base(process.env.AIRTABLE_MEMBERS_TABLE)
      .select({ maxRecords: 1 })
      .firstPage();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3000);
    console.log(`   Airtable query time: ${duration}ms`);
  });
});
