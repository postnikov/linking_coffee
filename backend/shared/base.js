const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

module.exports = base;
