/**
 * Airtable Formula Injection Prevention Utility
 *
 * This module provides sanitization functions to prevent formula injection attacks
 * in Airtable filterByFormula queries. Similar to SQL injection, malicious users
 * can craft input to manipulate queries if values aren't properly escaped.
 *
 * Created: 2026-01-24
 * Security Issue: Critical - Airtable Formula Injection
 */

/**
 * Sanitizes a value for safe use in Airtable filterByFormula strings
 *
 * Escapes single quotes and other special characters that could be used
 * to break out of formula context and inject malicious logic.
 *
 * @param {string|number|null|undefined} value - The value to sanitize
 * @returns {string} - Sanitized string safe for formula interpolation
 *
 * @example
 * // Safe usage:
 * const username = sanitizeForAirtable(userInput);
 * const formula = `{Tg_Username} = '${username}'`;
 *
 * // Prevents attack:
 * // Input: "admin' OR 1=1 OR '"
 * // Output: "admin\\' OR 1=1 OR \\'"
 */
function sanitizeForAirtable(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  const str = String(value);

  // Escape backslashes FIRST to prevent escape sequence manipulation
  let sanitized = str.replace(/\\/g, "\\\\");

  // Escape single quotes (most critical for formula injection)
  // In Airtable formulas, single quotes are escaped with backslash
  sanitized = sanitized.replace(/'/g, "\\'");

  // Remove or escape other potentially dangerous characters
  // Newlines and control characters
  sanitized = sanitized.replace(/\n/g, '\\n');
  sanitized = sanitized.replace(/\r/g, '\\r');
  sanitized = sanitized.replace(/\t/g, '\\t');

  return sanitized;
}

/**
 * Validates that a username meets safe format requirements
 *
 * @param {string} username - Username to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  // Username should be 3-50 characters, alphanumeric, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * Validates that an email meets safe format requirements
 *
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validates that a Telegram ID is a valid positive integer
 *
 * @param {string|number} telegramId - Telegram ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidTelegramId(telegramId) {
  if (!telegramId) {
    return false;
  }

  const id = String(telegramId);

  // Telegram IDs are positive integers
  const telegramIdRegex = /^[1-9][0-9]{0,15}$/;
  return telegramIdRegex.test(id);
}

/**
 * Combined sanitize and validate function for usernames
 *
 * @param {string} username - Username to sanitize and validate
 * @throws {Error} If username is invalid
 * @returns {string} - Sanitized username
 */
function sanitizeUsername(username) {
  if (!isValidUsername(username)) {
    throw new Error('Invalid username format. Must be 3-50 alphanumeric characters, underscores, or hyphens.');
  }
  return sanitizeForAirtable(username);
}

/**
 * Combined sanitize and validate function for emails
 *
 * @param {string} email - Email to sanitize and validate
 * @throws {Error} If email is invalid
 * @returns {string} - Sanitized email
 */
function sanitizeEmail(email) {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format.');
  }
  return sanitizeForAirtable(email);
}

/**
 * Combined sanitize and validate function for Telegram IDs
 *
 * @param {string|number} telegramId - Telegram ID to sanitize and validate
 * @throws {Error} If Telegram ID is invalid
 * @returns {string} - Sanitized Telegram ID
 */
function sanitizeTelegramId(telegramId) {
  if (!isValidTelegramId(telegramId)) {
    throw new Error('Invalid Telegram ID format.');
  }
  return sanitizeForAirtable(telegramId);
}

/**
 * Safely builds an Airtable filter formula with automatic sanitization
 *
 * @param {string} field - The Airtable field name (e.g., 'Tg_Username')
 * @param {string|number} value - The value to filter by
 * @param {string} operator - The comparison operator (default: '=')
 * @returns {string} - Safe filter formula
 *
 * @example
 * buildSafeFilter('Tg_Username', userInput)
 * // Returns: "{Tg_Username} = 'sanitized_value'"
 */
function buildSafeFilter(field, value, operator = '=') {
  const sanitizedValue = sanitizeForAirtable(value);
  return `{${field}} ${operator} '${sanitizedValue}'`;
}

/**
 * Builds a safe OR filter for multiple conditions
 *
 * @param {Array<{field: string, value: string|number}>} conditions
 * @returns {string} - Safe OR filter formula
 *
 * @example
 * buildSafeOrFilter([
 *   {field: 'Tg_Username', value: username},
 *   {field: 'Email', value: email}
 * ])
 * // Returns: "OR({Tg_Username} = 'user', {Email} = 'email@example.com')"
 */
function buildSafeOrFilter(conditions) {
  const filters = conditions.map(({field, value}) =>
    buildSafeFilter(field, value)
  );
  return `OR(${filters.join(', ')})`;
}

/**
 * Builds a safe AND filter for multiple conditions
 *
 * @param {Array<{field: string, value: string|number}>} conditions
 * @returns {string} - Safe AND filter formula
 *
 * @example
 * buildSafeAndFilter([
 *   {field: 'Status', value: 'Active'},
 *   {field: 'Consent_GDPR', value: true}
 * ])
 * // Returns: "AND({Status} = 'Active', {Consent_GDPR} = TRUE())"
 */
function buildSafeAndFilter(conditions) {
  const filters = conditions.map(({field, value}) => {
    // Handle boolean values
    if (typeof value === 'boolean') {
      return `{${field}} = ${value ? 'TRUE()' : 'FALSE()'}`;
    }
    return buildSafeFilter(field, value);
  });
  return `AND(${filters.join(', ')})`;
}

module.exports = {
  sanitizeForAirtable,
  isValidUsername,
  isValidEmail,
  isValidTelegramId,
  sanitizeUsername,
  sanitizeEmail,
  sanitizeTelegramId,
  buildSafeFilter,
  buildSafeOrFilter,
  buildSafeAndFilter
};
