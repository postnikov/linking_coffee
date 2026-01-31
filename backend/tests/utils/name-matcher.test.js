/**
 * Unit tests for name-matcher.js
 *
 * Run with: node backend/tests/utils/name-matcher.test.js
 */

const {
  normalizeName,
  levenshteinDistance,
  calculateMatchConfidence
} = require('../../utils/name-matcher');

// Simple test runner
let testsPassed = 0;
let testsFailed = 0;

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual: ${actual}`);
    testsFailed++;
  }
}

function assertRange(actual, min, max, testName) {
  if (actual >= min && actual <= max) {
    console.log(`✅ PASS: ${testName} (${actual})`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Expected range: ${min}-${max}`);
    console.error(`   Actual: ${actual}`);
    testsFailed++;
  }
}

console.log('\n=== Testing normalizeName() ===\n');

assertEqual(
  normalizeName('John'),
  'john',
  'Lowercase conversion'
);

assertEqual(
  normalizeName('  Maksim  '),
  'maksim',
  'Whitespace trimming'
);

assertEqual(
  normalizeName('José'),
  'jose',
  'Accent removal'
);

assertEqual(
  normalizeName('Müller'),
  'muller',
  'Umlaut removal'
);

assertEqual(
  normalizeName('John  Smith'),
  'john smith',
  'Multiple space collapse'
);

assertEqual(
  normalizeName(''),
  '',
  'Empty string'
);

assertEqual(
  normalizeName(null),
  '',
  'Null input'
);

console.log('\n=== Testing levenshteinDistance() ===\n');

assertEqual(
  levenshteinDistance('abc', 'abc'),
  0,
  'Identical strings'
);

assertEqual(
  levenshteinDistance('abc', 'abd'),
  1,
  'One substitution'
);

assertEqual(
  levenshteinDistance('abc', 'abcd'),
  1,
  'One insertion'
);

assertEqual(
  levenshteinDistance('abcd', 'abc'),
  1,
  'One deletion'
);

assertEqual(
  levenshteinDistance('maksim', 'maxim'),
  2,
  'Maksim vs Maxim (delete k, substitute s->x)'
);

assertEqual(
  levenshteinDistance('dubinin', 'dubenin'),
  1,
  'Dubinin vs Dubenin (i -> e)'
);

console.log('\n=== Testing calculateMatchConfidence() ===\n');

// Exact matches
assertEqual(
  calculateMatchConfidence('Maksim', 'Dubinin', 'Maksim', 'Dubinin'),
  100,
  'Exact match (case-insensitive)'
);

assertEqual(
  calculateMatchConfidence('maksim', 'dubinin', 'Maksim', 'Dubinin'),
  100,
  'Exact match (different case)'
);

assertEqual(
  calculateMatchConfidence('José', 'García', 'Jose', 'Garcia'),
  100,
  'Exact match (accents vs no accents)'
);

// Fuzzy matches
assertRange(
  calculateMatchConfidence('Maksim', 'Dubinin', 'Maxim', 'Dubinin'),
  75,
  85,
  'Fuzzy match: Maksim vs Maxim (same last name)'
);

assertRange(
  calculateMatchConfidence('John', 'Smith', 'Jon', 'Smith'),
  85,
  95,
  'Fuzzy match: John vs Jon (same last name)'
);

// Partial matches
assertRange(
  calculateMatchConfidence('Maksim', '', 'Maksim', 'Dubinin'),
  80,
  90,
  'First name exact, last name missing'
);

assertRange(
  calculateMatchConfidence('Maksim', 'Dubinin', 'Maksim', ''),
  80,
  90,
  'First name exact, existing has no last name'
);

// Low confidence
assertEqual(
  calculateMatchConfidence('John', 'Smith', 'Jane', 'Doe'),
  0,
  'Different names (low confidence)'
);

assertRange(
  calculateMatchConfidence('Maksim', 'Dubinin', 'Maksim', 'Johnson'),
  55,
  65,
  'Same first, very different last'
);

// Edge cases
assertEqual(
  calculateMatchConfidence('', '', 'John', 'Doe'),
  0,
  'Empty input names'
);

assertEqual(
  calculateMatchConfidence('John', 'Doe', '', ''),
  0,
  'Empty existing names'
);

// Real-world duplicate case (the actual issue)
assertEqual(
  calculateMatchConfidence('Maksim', 'Dubinin', 'Maksim', 'Dubinin'),
  100,
  'Real case: Maksim Dubinin (LinkedIn) vs maksdubinin (Telegram)'
);

console.log('\n=== Test Summary ===\n');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}\n`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
}
