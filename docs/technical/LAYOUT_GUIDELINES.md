# Layout Guidelines

This document outlines the layout strategy for Linked.Coffee, specifically focusing on how to maintain alignment between the header and various page types (Dashboard, Profile, Content Pages).

## Core Layout Philosophy

The application uses a **hybrid layout system** managed by `MainLayout` in `App.js`.

- **Header**: Always fixed width (max 1200px) and centered.
- **Main Content**: Can be either **Default (Constrained)** or **Fluid (Full Width)** depending on the route.

### 1. The Global Wrapper

The app is wrapped in `.app-container` (flex column) with a `.main-content` block that expands to fill available space (`flex: 1`).

```css
/* App.css */
.main-content {
  /* Default spacing for standard content pages */
  padding: var(--spacing-lg); /* ~2rem */
  display: flex;
  justify-content: center;
}
```

### 2. Layout Modes

#### A. Default Layout (Content Pages)

**Used for:** `About`, `Rules`, `Prices`, `Login`
**Behavior:**

- The `<main>` element has default padding (`2rem` / `var(--spacing-lg)`).
- Content is centered automatically.
- No special configuration needed.

#### B. Fluid Layout (Dashboard & Profiles)

**Used for:** `Dashboard` (`/`), `Public Profile` (`/profile/:username`)
**Behavior:**

- complex pages often need their own internal grid systems or full-width backgrounds that clash with the default global padding.
- We use a special class `.main-content-fluid` to **remove** global padding from `<main>`.

**Implementation:**
In `App.js`, the `MainLayout` component checks the current path:

```javascript
// App.js
const isFullWidth =
  location.pathname === "/" || location.pathname.startsWith("/profile");

<main className={`main-content ${isFullWidth ? "main-content-fluid" : ""}`}>
  {children}
</main>;
```

```css
/* App.css */
.main-content-fluid {
  padding: 0 !important;
  display: block !important;
  max-width: none !important;
}
```

### 3. Creating Aligned Containers

When using the **Fluid Layout**, your page component is responsible for its own constraints to align with the Header.

**The Golden Standard for Alignment:**
To vertically align content with the Header logo and navigation:

1.  **Max Width**: `1200px`
2.  **Padding**: `0 2rem` (or `2rem 2rem` if top/bottom spacing is needed)
3.  **Margin**: `0 auto` (to center)

**Example (MyNewPage.css):**

```css
.my-new-page-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto; /* Centers the container */
  padding: 2rem 2rem; /* Matches Header horizontal padding */
  box-sizing: border-box;
}
```

### 4. Common Pitfalls

- **Double Padding**: If you forget to add your route to the `isFullWidth` check in `App.js`, your page will have the global padding (`2rem`) PLUS your container padding (`2rem`), resulting in a narrow looking page (misaligned with header).
- **Missing Max-Width**: Without `max-width: 1200px`, your content will stretch to the edges on large screens, while the header remains constrained.

## Summary Checklist for New Pages

1.  **Determine Type**: Is this a simple text page (Default) or a complex app view (Fluid)?
2.  **If Fluid**:
    - Add path to `isFullWidth` in `App.js`.
    - Create a container in your page CSS.
    - Apply `max-width: 1200px; margin: 0 auto; padding: 0 2rem;`.
3.  **If Default**:
    - Just create your content; global styles handle the rest.
