/**
 * Statistics Utility Module
 *
 * Provides functions for calculating various statistics from Airtable data.
 * All calculations are done in-memory for real-time results.
 *
 * CRITICAL: Always use local date components (not UTC) to avoid timezone shifts.
 */

// Required profile fields for completion analysis
const REQUIRED_PROFILE_FIELDS = [
  'Name',
  'Family',
  'Avatar',
  'Profession',
  'Grade',
  'Professional_Description',
  'Personal_Description',
  'Languages',
  'Professional_Interests',
  'Personal_Interests',
  'Coffee_Goals',
  'Countries',
  'City_Link',
  'Time_Zone',
  'Best_Meetings_Days'
];

/**
 * Format date as YYYY-MM-DD using local timezone components
 * CRITICAL: Don't use toISOString() as it causes timezone shifts
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the Monday of the week for a given date (local timezone)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return formatLocalDate(monday);
}

/**
 * Generate week boundaries (Mondays) for the given period
 */
function generateWeekBoundaries(startDate, numWeeks) {
  const weeks = [];
  const current = new Date(startDate);

  for (let i = 0; i < numWeeks; i++) {
    const weekDate = new Date(current);
    weekDate.setDate(current.getDate() - (i * 7));
    weeks.push(getWeekStart(weekDate));
  }

  return weeks.sort();
}

/**
 * Check if a field value is empty
 */
function isFieldEmpty(value) {
  return !value ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === '');
}

/**
 * Calculate daily metrics (new users, Telegram connections, LinkedIn connections)
 */
function calculateDailyMetrics(members, period) {
  const dailyMap = new Map();
  const today = new Date();

  // Initialize all days in period
  for (let i = 0; i < period; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatLocalDate(date);
    dailyMap.set(dateStr, {
      date: dateStr,
      newUsers: 0,
      telegramConnections: 0,
      linkedinConnections: 0
    });
  }

  // Aggregate member data
  members.forEach(member => {
    const createdAt = member.fields.Created_At;
    if (!createdAt) return;

    const createdDate = formatLocalDate(new Date(createdAt));
    const dayData = dailyMap.get(createdDate);

    if (dayData) {
      dayData.newUsers++;

      // Count Telegram connection (Tg_ID populated)
      if (member.fields.Tg_ID) {
        dayData.telegramConnections++;
      }

      // Count LinkedIn connection (Linkedin_ID populated, not just Linkedin URL)
      if (member.fields.Linkedin_ID) {
        dayData.linkedinConnections++;
      }
    }
  });

  // Return sorted by date (newest first)
  return Array.from(dailyMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

/**
 * Calculate weekly metrics (aggregated daily metrics + match data)
 */
function calculateWeeklyMetrics(members, matches, period) {
  const numWeeks = Math.ceil(period / 7);
  const weeklyMap = new Map();
  const today = new Date();

  // Generate week boundaries
  const weeks = generateWeekBoundaries(today, numWeeks);

  weeks.forEach(weekStart => {
    weeklyMap.set(weekStart, {
      weekStart,
      newUsers: 0,
      telegramConnections: 0,
      linkedinConnections: 0,
      matchesCreated: 0,
      feedback: {
        met: 0,
        scheduled: 0,
        no: 0,
        fail: 0,
        total: 0,
        responseRate: 0
      }
    });
  });

  // Aggregate members by week
  members.forEach(member => {
    const createdAt = member.fields.Created_At;
    if (!createdAt) return;

    const weekStart = getWeekStart(new Date(createdAt));
    const weekData = weeklyMap.get(weekStart);

    if (weekData) {
      weekData.newUsers++;
      if (member.fields.Tg_ID) weekData.telegramConnections++;
      if (member.fields.Linkedin_ID) weekData.linkedinConnections++;
    }
  });

  // Aggregate matches by week
  matches.forEach(match => {
    const weekStartField = match.fields.Week_Start;
    if (!weekStartField) return;

    const weekStart = formatLocalDate(new Date(weekStartField));
    const weekData = weeklyMap.get(weekStart);

    if (weekData) {
      weekData.matchesCreated++;

      // Aggregate feedback (count both members' responses)
      const weMet1 = match.fields.We_Met_1;
      const weMet2 = match.fields.We_Met_2;

      if (weMet1) {
        weekData.feedback.total++;
        if (weMet1 === 'Met') weekData.feedback.met++;
        else if (weMet1 === 'Scheduled') weekData.feedback.scheduled++;
        else if (weMet1 === 'No') weekData.feedback.no++;
        else if (weMet1 === 'Fail') weekData.feedback.fail++;
      }

      if (weMet2) {
        weekData.feedback.total++;
        if (weMet2 === 'Met') weekData.feedback.met++;
        else if (weMet2 === 'Scheduled') weekData.feedback.scheduled++;
        else if (weMet2 === 'No') weekData.feedback.no++;
        else if (weMet2 === 'Fail') weekData.feedback.fail++;
      }
    }
  });

  // Calculate response rates
  weeklyMap.forEach(week => {
    if (week.matchesCreated > 0) {
      const totalPossibleResponses = week.matchesCreated * 2;
      week.feedback.responseRate = Math.round(
        (week.feedback.total / totalPossibleResponses) * 100
      );
    }
  });

  // Return sorted by date (newest first)
  return Array.from(weeklyMap.values()).sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart)
  );
}

/**
 * Analyze profile completion (all required fields must be filled)
 */
function analyzeProfileCompletion(members) {
  let complete = 0;
  const missingFields = {};

  // Initialize field counters
  REQUIRED_PROFILE_FIELDS.forEach(field => {
    missingFields[field] = 0;
  });

  members.forEach(member => {
    const fields = member.fields;
    let isComplete = true;

    REQUIRED_PROFILE_FIELDS.forEach(fieldName => {
      const value = fields[fieldName];

      if (isFieldEmpty(value)) {
        missingFields[fieldName]++;
        isComplete = false;
      }
    });

    if (isComplete) complete++;
  });

  const totalUsers = members.length;

  return {
    complete,
    incomplete: totalUsers - complete,
    completionRate: totalUsers > 0 ? Math.round((complete / totalUsers) * 100) : 0,
    missingFields: Object.entries(missingFields)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
  };
}

/**
 * Analyze match performance (feedback, ratings, success rate)
 */
function analyzeMatchPerformance(matches) {
  const stats = {
    totalMatches: matches.length,
    withFeedback: 0,
    feedbackRate: 0,
    statusBreakdown: {
      Met: { count: 0, percentage: 0 },
      Scheduled: { count: 0, percentage: 0 },
      No: { count: 0, percentage: 0 },
      Fail: { count: 0, percentage: 0 }
    },
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 }
  };

  let totalResponses = 0;
  let totalRatings = 0;
  let ratingSum = 0;

  matches.forEach(match => {
    const weMet1 = match.fields.We_Met_1;
    const weMet2 = match.fields.We_Met_2;
    const feedback1 = match.fields.Feedback1;
    const feedback2 = match.fields.Feedback2;

    // Count feedback responses (each member can provide one)
    if (weMet1) {
      totalResponses++;
      if (stats.statusBreakdown[weMet1]) {
        stats.statusBreakdown[weMet1].count++;
      }
    }

    if (weMet2) {
      totalResponses++;
      if (stats.statusBreakdown[weMet2]) {
        stats.statusBreakdown[weMet2].count++;
      }
    }

    // Count matches with at least one feedback
    if (weMet1 || weMet2) {
      stats.withFeedback++;
    }

    // Aggregate ratings
    if (feedback1 && typeof feedback1 === 'number') {
      stats.ratingDistribution[feedback1] = (stats.ratingDistribution[feedback1] || 0) + 1;
      ratingSum += feedback1;
      totalRatings++;
    }

    if (feedback2 && typeof feedback2 === 'number') {
      stats.ratingDistribution[feedback2] = (stats.ratingDistribution[feedback2] || 0) + 1;
      ratingSum += feedback2;
      totalRatings++;
    }
  });

  // Calculate percentages for status breakdown
  Object.keys(stats.statusBreakdown).forEach(status => {
    stats.statusBreakdown[status].percentage = totalResponses > 0
      ? Math.round((stats.statusBreakdown[status].count / totalResponses) * 100)
      : 0;
  });

  // Calculate feedback rate (% of matches with at least one response)
  stats.feedbackRate = stats.totalMatches > 0
    ? Math.round((stats.withFeedback / stats.totalMatches) * 100)
    : 0;

  // Calculate average rating
  stats.averageRating = totalRatings > 0
    ? Math.round((ratingSum / totalRatings) * 10) / 10
    : 0;

  return stats;
}

/**
 * Analyze user status distribution
 */
function analyzeUserStatus(members) {
  const statusCounts = {
    Free: 0,
    PRO: 0,
    Premium: 0,
    Admin: 0,
    EarlyBird: 0
  };

  members.forEach(member => {
    const status = member.fields.Status;
    if (status && statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    }
  });

  return statusCounts;
}

/**
 * Analyze geographic distribution
 */
function analyzeGeography(members, countriesMap, citiesMap) {
  const countryCounts = {};
  const cityCounts = {};

  members.forEach(member => {
    // Count countries (Countries is a link field, array of record IDs)
    const countryLinks = member.fields.Countries;
    if (countryLinks && countryLinks.length > 0) {
      countryLinks.forEach(countryId => {
        const country = countriesMap.get(countryId);
        if (country) {
          const countryName = country.fields.Name_en || country.fields.ISO_Code;
          countryCounts[countryName] = (countryCounts[countryName] || 0) + 1;
        }
      });
    }

    // Count cities (City_Link is a link field, array of record IDs)
    const cityLinks = member.fields.City_Link;
    if (cityLinks && cityLinks.length > 0) {
      cityLinks.forEach(cityId => {
        const city = citiesMap.get(cityId);
        if (city) {
          const cityName = city.fields.name_en || city.fields.Slug;
          cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
        }
      });
    }
  });

  // Convert to sorted arrays
  const countries = Object.entries(countryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topCities = Object.entries(cityCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 cities

  return { countries, topCities };
}

/**
 * Analyze language distribution
 */
function analyzeLanguages(members) {
  const languageCounts = {};

  members.forEach(member => {
    const languages = member.fields.Languages;
    if (languages && Array.isArray(languages)) {
      languages.forEach(lang => {
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      });
    }
  });

  // Sort by count descending
  return Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
}

/**
 * Calculate overview statistics
 */
function calculateOverview(members, matches, matchPerformance) {
  return {
    totalUsers: members.length,
    // Active = users who opted in for next week
    activeUsers: members.filter(m => m.fields.Next_Week_Status === 'Active').length,
    totalMatches: matches.length,
    avgRating: matchPerformance.averageRating
  };
}

module.exports = {
  formatLocalDate,
  getWeekStart,
  calculateDailyMetrics,
  calculateWeeklyMetrics,
  analyzeProfileCompletion,
  analyzeMatchPerformance,
  analyzeUserStatus,
  analyzeGeography,
  analyzeLanguages,
  calculateOverview,
  REQUIRED_PROFILE_FIELDS
};
