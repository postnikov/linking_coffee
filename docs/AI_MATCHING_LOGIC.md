# AI Matching Logic & Prompts

## Core Concept
Instead of scoring potential pairs iteratively, we feed the entire pool of active candidates to a large context window LLM (Gemini 1.5 Pro). We ask the model to perform a "global optimization" problem: find the best set of pairs that maximizes overall satisfaction/quality, rather than local greedy optimization.

## Prompt Structure

### System Role
> You are an expert professional matchmaker for "Linked Coffee", a networking community for tech professionals. Your goal is to create the most engaging, valuable, and serendipitous pairs for this week's random coffee sessions.

### Input Data
The prompt will receive two JSON blocks:
1.  `previous_matches`: A list of pairs who have already met. format: `["ID_A:ID_B", "ID_C:ID_D"]`.
2.  `candidates`: A list of user objects.
    ```json
    {
      "id": "rec123...",
      "name": "Alex",
      "languages": ["English", "Russian"],
      "timezone_offset": 3,
      "professional_interests": ["AI", "Startups"],
      "personal_interests": ["Hiking"],
      "bio": "...",
      "goals": ["Professional Chat"]
    }
    ```

### Rules & Constraints

**1. HARD Constraints (Must Follow):**
*   **Language**: Partners MUST share at least one fluent language.
*   **Timezone**: The absolute difference in `timezone_offset` MUST be ≤ 6 hours.
*   **History**: Do NOT pair users if their pair appears in `previous_matches`.
*   **Uniqueness**: Each user can only be matched once (no polygamy in coffee matches).

**2. Optimization Goals (Soft Factors):**
*   **Interest Overlap**: Prioritize pairs with shared professional or personal interests.
*   **Complementary Goals**: Match "Mentor" with "Mentee" (if deducible) or "Peer" with "Peer" depending on their bio.
*   **Serendipity**: Occasionally match diverse backgrounds if they have a strong generic "vibe" match based on bio analysis.

### Output Schema
The model must return JSON:
```json
{
  "matches": [
    {
      "user1_id": "rec...",
      "user2_id": "rec...",
      "reasoning": "Alex and Bob both share a deep interest in AI startups. Alex's background in VC complements Bob's founding experience. They are both in compatible timezones (UTC+3, UTC+2)."
    }
  ],
  "leftovers": ["rec..."] 
}
```

## Security & Privacy
*   Only minimal necessary data is sent (IDs, public bio fields).
*   No PII like emails or phone numbers are sent to the reasoning model.
