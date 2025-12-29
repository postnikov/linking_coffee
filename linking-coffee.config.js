/**
 * Linking Coffee Project Configuration
 * Central source of truth for models, constants, and settings.
 */
module.exports = {
    ai: {
        // Model used for the advanced matching algorithm (Google Gemini)
        // Options: 'gemini-3-pro-preview', 'gemini-3-flash-preview' (if available)
        matchingModel: "gemini-3-flash-preview",

        // Allowed models for UI selection
        allowedMatchingModels: [
            "gemini-3-flash-preview",
            "gemini-3-pro-preview"
        ],

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
    },

    /**
     * Runtime Check: Verifies that critical environment variables are set.
     * Call this at application startup or script initialization.
     */
    checkRequiredEnv: () => {
        const required = ['GOOGLE_AI_API_KEY', 'ANTHROPIC_API_KEY'];
        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            console.warn(`⚠️  WARNING: Missing critical AI environment variables: ${missing.join(', ')}`);
            console.warn(`   AI features (Matching/Intros) will likely fail. Check docker-compose or .env.`);
        }
    }
};
