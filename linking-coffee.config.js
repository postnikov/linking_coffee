/**
 * Linking Coffee Project Configuration
 * Central source of truth for models, constants, and settings.
 */
module.exports = {
    ai: {
        // Model used for the advanced matching algorithm (Google Gemini)
        // Options: 'gemini-1.5-pro-002', 'gemini-1.5-flash-002', 'gemini-3-pro' (if available)
        matchingModel: "gemini-3-pro-preview",

        // Model used for generating intro descriptions (Anthropic Claude)
        introModel: "claude-haiku-4-5-20251001",

        // Default parameters
        temperature: 0.2,
    },

    matching: {
        // Hard limit on candidates to process in one batch if needed
        maxCandidates: 200,

        // Minimum score or logic thresholds can go here
        minTimezoneDiff: 6, // Hours
    }
};
