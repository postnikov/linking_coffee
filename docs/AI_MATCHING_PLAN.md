# AI Matching Implementation Plan

## Objective
Replace the current sequential/random matching algorithm with an AI-powered holistic matching system using Google Gemini. The goal is to leverage the LLM's ability to understand "soft" overlapping interests and goals better than simple keyword matching.

## Architecture
1.  **Data Extraction (Node.js)**
    *   Fetch **Active Members** from Airtable (`Next_Week_Status = 'Active'`).
    *   Fetch **Match History** from Airtable (`Matches` table).
    *   Pre-process data:
        *   Filter out ineligible members (e.g., no common languages with anyone - though AI can handle this).
        *   Construct a set of "Previous Matches" to avoid repetitions.

2.  **Prompt Engineering (Google Gemini)**
    *   **Model**: `gemini-1.5-pro` (or `gemini-3-pro` per request).
    *   **Context**:
        *   Rule 1: **Language Hard Constraint**. Users *must* match on at least one language.
        *   Rule 2: **Timezone Constraint**. Difference <= 6 hours (soft or hard? Script says hard -5000 score, effectively hard).
        *   Rule 3: **History Constraint**. Do not pair users who have met before (unless we allow re-matching after X weeks, currently we prioritize new friends).
    *   **Input Data**:
        *   `Users`: JSON array of user objects `{ id, name, languages, timezone, interests, goals, bio }`.
        *   `ForbiddenPairs`: Array of strings `"id1:id2"` representing past matches.
    *   **Output Format**:
        *   JSON structure containing a list of `Pairs`.
        *   Each pair includes: `user1_id`, `user2_id`, `logic` (explanation of why they are a good match).

3.  **Execution Logic**
    *   Send prompt to API.
    *   Parse JSON response.
    *   Validate pairs (check if they really exist, check constraints essentially as a sanity check).
    *   **Dry Run**: Output pairs and logic to console.
    *   **Live Run**:
        *   Create records in `Matches` table.
        *   Update `Members` status to `Matched`.
        *   (Optional) Generate Intros using the `logic` provided by the matching AI, or loop through standard intro generator (standard generator is separate, we can keep it for now).

## History Handling
*   We fetch all matches from Airtable.
*   We normalize pairs (sort IDs alphabetically) to ensure `A-B` matches `B-A`.
*   We pass this list to the LLM as: "The following pairs have already met and should NOT be matched again: ..."

## Documentation
*   Logic will be documented in `docs/AI_MATCHING_LOGIC.md`.
