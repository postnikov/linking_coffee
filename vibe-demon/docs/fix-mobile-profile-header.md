# Task: Fix mobile profile header layout in Dashboard.js

**File:** `/frontend/src/pages/Dashboard.js`

**Problem:** On mobile, the profile header info looks scattered and poorly grouped:
- "Vibe-Founder • Prefer not to say •" has trailing separator
- "LinkedIn" text link floats on its own line
- No visual hierarchy

**Current state (bad):**
```
Max Post
Vibe-Founder • Prefer not to say •
LinkedIn
🇪🇸 Spain • Barcelona • Europe/Paris (UTC+1)
```

**Desired state (Variant B - grouped by meaning):**
```
Max Post
Vibe-Founder

🇪🇸 Barcelona, Spain • UTC+1
[LinkedIn icon only, no text]
```

## Changes needed:

1. **Profession line:** Show only profession (and grade if exists). Remove "Prefer not to say" — don't show empty/placeholder values.

2. **Location line:** Reorder to "City, Country • Timezone". More natural reading order.

3. **LinkedIn:** Show as icon-only link (the img tag already exists), remove the text "LinkedIn". Position it either:
   - Next to the name, or
   - As a small icon row below location

4. **Remove trailing separators:** Don't render "•" if the next element is empty or it's the last item.

5. **Mobile-specific:** In the CSS media query for mobile, ensure proper spacing between groups (add margin-bottom to profession, etc.)

## Where to look:

The JSX rendering `profile-subtitle`, `profile-location`, and the LinkedIn link in the **view mode section** (not edit mode).

## Constraints:

**Don't break:** Desktop layout should remain unchanged — changes should be mobile-specific or gracefully degrade.
