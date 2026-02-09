# AI Matching Logic: Self-Correction & Retry Architecture
**Date:** 2026-02-04
**Script:** `backend/scripts/match-users-ai.js`

## Overview
The AI Matching script uses a "Human-in-the-Loop" style architecture (where the "Human" is replaced by deterministic code validation) to ensure high-quality matches. We do not blindly trust the AI's output, especially regarding "negative constraints" (e.g., "Do NOT match X and Y").

## The Problem: Constraint Hallucination
Generative AI models (like Gemini/GPT) are probabilistic. When given a negative constraint (e.g., "Avoid these 500 pairs"), they roughly follow it but occasionally "forget" or "hallucinate" that a pair is valid when it is not.
In previous versions, this led to users being re-matched with people they had already met, despite the prompt explicitly forbidding it.

## The Solution: Deterministic Feedback Loop
We implemented a **Code-Level Validation & Retry Loop** that acts as a strict gatekeeper before any data is written to the database.

### Workflow
1.  **Prompt**: Script sends candidates + history to Gemini.
2.  **AI Proposal**: Gemini returns a JSON list of matches.
3.  **Strict Validation (The Gate)**:
    *   The script iterates through *every* proposed pair.
    *   It reconstructs the unique history key (`ID1:ID2`).
    *   It checks this key against the `previous_matches` array (which is the source of truth).
4.  **Feedback & Retry (The Loop)**:
    *   If **ANY** duplicates are found in the batch, the **ENTIRE** batch is rejected.
    *   The script generates a specific error message: `Constraint Violation: You matched [Name A] & [Name B] who have ALREADY matched...`
    *   It effectively "re-prompts" the AI with this new information, forcing it to try again.
5.  **Failure**:
    *   This loop repeats up to **3 times**.
    *   If the AI fails to produce a valid batch after 3 attempts, the script aborts to prevent bad data corruption.

## Code Pattern
```javascript
while (attempt < MAX_RETRIES && !success) {
    // 1. Call AI
    const result = await callGemini(prompt + feedback);
    
    // 2. Validate
    const invalidPairs = validate(result, history);

    if (invalidPairs.length > 0) {
        // 3. Generate Feedback
        feedback = `CRITICAL: You failed to avoid ${invalidPairs}... Try again.`;
        continue; // Retry
    }

    // 4. Success
    success = true;
}
```

## Benefits
*   **Self-Healing**: The system corrects mistakes automatically without human intervention.
*   **Deterministic Integrity**: It is technically impossible for a known duplicate match to enter the database, regardless of the AI's "creativity."
*   **Fail-Safe**: It prefers doing *nothing* (aborting) over doing the *wrong thing* (saving duplicates).
