/**
 * Name Matching Utility for Duplicate Detection
 *
 * Provides fuzzy name matching to detect potential duplicate user accounts
 * before creating new records via LinkedIn OAuth.
 */

const { sanitizeForAirtable } = require('./airtable-sanitizer');

/**
 * Normalize a name for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove accents/diacritics
 * - Collapse multiple spaces
 *
 * @param {string} name - Name to normalize
 * @returns {string} Normalized name
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Calculate Levenshtein distance between two strings
 * (Edit distance: minimum number of single-character edits)
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate confidence score for name match
 *
 * @param {string} inputFirst - Input first name
 * @param {string} inputLast - Input last name
 * @param {string} existingFirst - Existing first name
 * @param {string} existingLast - Existing last name
 * @returns {number} Confidence score (0-100)
 */
function calculateMatchConfidence(inputFirst, inputLast, existingFirst, existingLast) {
  const normInputFirst = normalizeName(inputFirst);
  const normInputLast = normalizeName(inputLast);
  const normExistingFirst = normalizeName(existingFirst);
  const normExistingLast = normalizeName(existingLast);

  // Both names empty - no match
  if (!normInputFirst && !normInputLast) return 0;
  if (!normExistingFirst && !normExistingLast) return 0;

  // Exact match (case-insensitive, accent-insensitive)
  if (normInputFirst === normExistingFirst && normInputLast === normExistingLast) {
    return 100;
  }

  // First name exact, last name missing or match
  if (normInputFirst === normExistingFirst && (!normInputLast || !normExistingLast)) {
    return 85;
  }

  // Last name exact, first name missing or match
  if (normInputLast === normExistingLast && (!normInputFirst || !normExistingFirst)) {
    return 85;
  }

  // Calculate edit distances
  const firstDist = levenshteinDistance(normInputFirst, normExistingFirst);
  const lastDist = levenshteinDistance(normInputLast, normExistingLast);

  // Both names very close (1-2 character difference each)
  if (firstDist <= 2 && lastDist <= 2) {
    // Exact first, fuzzy last
    if (firstDist === 0) return 90 - (lastDist * 5);
    // Exact last, fuzzy first
    if (lastDist === 0) return 90 - (firstDist * 5);
    // Both fuzzy
    return 75 - ((firstDist + lastDist) * 5);
  }

  // Only first name matches closely
  if (firstDist <= 2 && (!normInputLast || !normExistingLast)) {
    return 70 - (firstDist * 5);
  }

  // Only last name matches closely
  if (lastDist <= 2 && (!normInputFirst || !normExistingFirst)) {
    return 70 - (lastDist * 5);
  }

  // One name exact, other very different
  if (normInputFirst === normExistingFirst && lastDist > 3) return 60;
  if (normInputLast === normExistingLast && firstDist > 3) return 60;

  // Low confidence - names are too different
  return 0;
}

/**
 * Find potential duplicate users by name
 *
 * @param {string} givenName - First name from LinkedIn
 * @param {string} familyName - Last name from LinkedIn
 * @param {object} base - Airtable base instance
 * @param {string} tableId - Members table ID
 * @returns {Promise<Array>} Array of {record, confidence, matchReason}
 */
async function findPotentialDuplicates(givenName, familyName, base, tableId) {
  const normFirst = normalizeName(givenName);
  const normLast = normalizeName(familyName);

  if (!normFirst && !normLast) {
    return []; // Cannot match on empty names
  }

  try {
    // Build query to find records with similar names
    // We'll fetch records with matching first OR last name, then score them
    const filters = [];

    if (normFirst) {
      const safeFirst = sanitizeForAirtable(normFirst);
      filters.push(`LOWER({Name}) = '${safeFirst}'`);
    }

    if (normLast) {
      const safeLast = sanitizeForAirtable(normLast);
      filters.push(`LOWER({Family}) = '${safeLast}'`);
    }

    // Query for exact matches on either field
    const filterFormula = filters.length > 0 ? `OR(${filters.join(', ')})` : '';

    if (!filterFormula) return [];

    const records = await base(tableId)
      .select({
        filterByFormula: filterFormula,
        maxRecords: 20 // Limit to prevent excessive queries
      })
      .firstPage();

    // Score each record
    const matches = [];

    for (const record of records) {
      const existingFirst = record.fields.Name || '';
      const existingLast = record.fields.Family || '';

      const confidence = calculateMatchConfidence(
        givenName,
        familyName,
        existingFirst,
        existingLast
      );

      // Only include if confidence >= 60
      if (confidence >= 60) {
        let matchReason = '';

        if (confidence === 100) {
          matchReason = 'Exact name match';
        } else if (confidence >= 90) {
          matchReason = 'Very close name match';
        } else if (confidence >= 75) {
          matchReason = 'Similar names (fuzzy match)';
        } else {
          matchReason = 'Partial name match';
        }

        matches.push({
          record,
          confidence,
          matchReason
        });
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;

  } catch (error) {
    console.error('Error finding potential duplicates:', error);
    // Non-fatal: return empty array to allow account creation
    return [];
  }
}

module.exports = {
  normalizeName,
  levenshteinDistance,
  calculateMatchConfidence,
  findPotentialDuplicates
};
