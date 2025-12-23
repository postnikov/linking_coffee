# implementation_plan_refactor_profile.md

## Goal
Refactor `PublicProfile.js` and `TokenProfile.js` to eliminate code duplication by extracting the shared UI logic into a reusable `ProfileView` component. This ensures the "DRY" (Don't Repeat Yourself) principle is followed and makes future UI updates easier.

## 1. Create New Component: `ProfileView`

**Location**: `frontend/src/components/ProfileView.js`

This component will be responsible for rendering the full profile UI (Main layout, Header, Info Columns, Sidebar).

### Props Interface
| Prop | Type | Description |
|------|------|-------------|
| `profile` | Object | The user profile data (name, avatar, interests, etc.) |
| `matchIntro` | Object | (Optional) Match context data (why_interesting, icebreakers) |
| `interests` | Object | The raw interests dictionary used for localization lookups |

### Internal Logic
- **Hooks**: 
  - `useTranslation` (i18next) for text support.
- **Helpers** (Moved inside component or generic utils):
  - `getInterestColor(string)`: Deterministic color generation.
  - `getLocalizedInterest(name, type)`: Resolves Ru/En names based on current locale.
  - `getAvatarUrl(path)`: formatting helper.

### Render Structure
- Wraps content in `<main className="main-content">` (or similar container).
- Renders `public-profile-container`.
- **Left/Main Column**: Profile Header, Bio, Interests (Professional/Personal).
- **Right Sidebar**: "Match of the Week" card with Message button and Match Intro (if provided).

## 2. Refactor `PublicProfile.js`

**Location**: `frontend/src/pages/PublicProfile.js`

- **Responsibilities**:
  1. Fetch `interests` data (for localization).
  2. Fetch `profile` data by `username` URL param.
  3. Handle `isLoading` and `error` states.
  4. Render `<ProfileView ... />` once data is ready.

## 3. Refactor `TokenProfile.js`

**Location**: `frontend/src/pages/TokenProfile.js`

- **Responsibilities**:
  1. Fetch `interests` data.
  2. Fetch `profile` data by `token` URL param (`/api/view/:token`).
  3. Handle `isLoading` and `error` states.
  4. Render `<ProfileView ... />` once data is ready.

## 4. Execution Steps

1.  **Extract Helpers**: Identify `getInterestColor`, `getAvatarUrl` and `DAY_COLORS`. Decide if they should live in `src/utils/uiUtils.js` or just inside `ProfileView.js`. (Inside component is fine for now as they are view-specific).
2.  **Create Component**: Copy the current JSX from `TokenProfile.js` into `ProfileView.js`. Replace `formData` variable with `profile` prop.
3.  **Update Pages**: 
    - Import `ProfileView`.
    - Remove the massive JSX block.
    - Remove unused CSS imports if they are moved to the component (or keep global).
    - Pass state (`formData`, `matchIntro`, `interests`) to the component.

## 5. css Cleanup
- Ensure `PublicProfile.css` and `Dashboard.css` styles used by the component are imported or accessible.
