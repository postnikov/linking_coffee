# Task: Fix layout width on Rules and Prices pages

## Problem
On https://linked.coffee/rules and https://linked.coffee/prices the content blocks are too narrow compared to the header. The cards/blocks don't span the full available width — there's too much empty space on both sides.

## Current state
- Header spans full width (looks good)
- On /rules: Two blocks ("The basics" / "Основное" and "Making it great" / "Как сделать разговор лучше") together are significantly narrower than header
- On /prices: Three pricing cards (Free, PRO, Premium) don't fill the available width properly

## Expected
- Content blocks should have similar max-width as the header content
- Cards should expand to fill more horizontal space
- Maintain good readability (not too wide for text)
- Keep responsive behavior for mobile

## Files to check
- `frontend/src/app/rules/page.tsx` (or similar)
- `frontend/src/app/prices/page.tsx` (or similar)  
- Related CSS/Tailwind classes
- Check if there's a shared layout component that constrains width

## Approach
1. Find the container/wrapper component that limits width on these pages
2. Compare with header's max-width settings
3. Adjust max-width or container classes to match header content width
4. Test on both desktop and mobile viewports
