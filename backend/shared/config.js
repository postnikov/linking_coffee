const path = require('path');

let projectConfig = {};
try {
  projectConfig = require('../../linking-coffee.config.js');
} catch (e) {
  try {
    projectConfig = require('../linking-coffee.config.js');
  } catch (e2) {
    console.warn("Could not load linking-coffee.config.js");
  }
}

module.exports = {
  projectConfig,
  PORT: process.env.PORT || 3001,
  MEMBERS_TABLE: process.env.AIRTABLE_MEMBERS_TABLE,
  MATCHES_TABLE: process.env.AIRTABLE_MATCHES_TABLE,
  CITIES_TABLE: process.env.AIRTABLE_CITIES_TABLE,
  COMMUNITIES_TABLE: process.env.AIRTABLE_COMMUNITIES_TABLE,
  COMMUNITY_MEMBERS_TABLE: process.env.AIRTABLE_COMMUNITY_MEMBERS_TABLE,
  INVITE_LINKS_TABLE: process.env.AIRTABLE_INVITE_LINKS_TABLE,
  LOGS_TABLE: process.env.AIRTABLE_LOGS_TABLE || 'tbln4rLHEgXUkL9Jh',
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'),
  LOG_DIR: path.join(__dirname, '..', 'logs'),
  SCRIPTS_DIR: path.join(__dirname, '..', 'scripts'),
  UPLOADS_DIR: path.join(__dirname, '..', 'uploads'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://linked.coffee',
};
