# ROADMAP_V2.6.md — OmniWatch 2.6 Phased Implementation Plan

**Milestone:** v2.6 Mobile Experience, Catalog Isolation & Dynamic Season Architecture  
**Execution Protocol:** Ralph Loop with Test-Driven Gates  
**Status:** DRAFT (Under Review)  
**Date:** 2026-10-08

---

## Phase Matrix

| Phase | Title | Primary Components | Verification Gate |
|---|---|---|---|
| **Phase 1** | Auth Session Integrity & Logout Catalog Clearing | `auth.js`, `catalogRoutes.js`, `App.jsx`, `AuthModal.jsx` | `node --test tests/user_auth_catalog.test.js` |
| **Phase 2** | Layout Expansion & Search Bar Overhaul (Max Width & 25/50/100 Pagination) | `Navbar.jsx`, `Pagination.jsx`, `App.jsx`, `constants.js` | `node --test tests/pagination.test.js` & `npm run build` |
| **Phase 3** | Mobile Responsiveness & Phone Optimization | `Navbar.jsx`, `FilterBar.jsx`, `MediaDetailModal.jsx`, `EpisodeGuide.jsx`, `MediaCard.jsx` | `npm run build` & Mobile Viewport CSS audit |
| **Phase 4** | Dynamic Season API Hydration, Season Badge Cleanup & Sequel Navigation | `TVMazeProvider.js`, `AniListProvider.js`, `EpisodeGuide.jsx`, `MediaDetailModal.jsx` | `node --test tests/unified_seasons_mirrors.test.js` |
| **Phase 5** | Regression Testing, Application Audit & CodeRabbit Review | `tests/*.test.js`, Full monorepo | `npm test` & CodeRabbit 4-pillar review report |

---

## Detailed Task Breakdown

### Phase 1: Auth Session Integrity & Logout Catalog Clearing
- **Task 1.1**: Update `authMiddleware` in `apps/server/src/auth.js` to ensure unauthenticated requests yield `req.userId = null` rather than falling back to `DEFAULT_USER_ID`.
- **Task 1.2**: In `apps/server/src/routes/catalogRoutes.js`, return `{ success: true, count: 0, data: [], hasMore: false }` for unauthenticated read requests and `401 Unauthorized` for mutations.
- **Task 1.3**: In `apps/client/src/App.jsx`, ensure `handleLogout()` immediately purges `catalogMediaList`, `catalogItems`, `catalogMap`, and resets `currentView` to `'global'` if viewing catalog or watchlist.
- **Task 1.4**: In `apps/client/src/components/AuthModal.jsx`, completely remove the "Fill Demo Credentials" button and hardcoded credentials.

### Phase 2: Layout Expansion & Search Bar Overhaul (Max Width & 25/50/100 Pagination)
- **Task 2.1**: Update `App.jsx` layout wrapper from `max-w-7xl` to `max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8` to maximize screen utilization.
- **Task 2.2**: Expand search input in `Navbar.jsx` with responsive flex-width (`max-w-xl md:max-w-2xl`) and clear search action.
- **Task 2.3**: Update pagination page sizes from `[24, 48]` to `[25, 50, 100]` in `Pagination.jsx`, `App.jsx`, and backend limit clamps.

### Phase 3: Mobile Responsiveness & Phone Optimization
- **Task 3.1**: Optimize `Navbar.jsx` for phone viewports: provide responsive mobile nav bar / mobile tab switcher.
- **Task 3.2**: In `FilterBar.jsx`, optimize filter pill rows with touch-friendly horizontal scrolling (`overflow-x-auto scrollbar-none flex-nowrap`).
- **Task 3.3**: In `MediaDetailModal.jsx` and `EpisodeGuide.jsx`, optimize modal headers, tabs, and episode checklists with comfortable tap targets (minimum 44x44px) and smooth scrolling on mobile.

### Phase 4: Dynamic Season API Hydration, Season Badge Cleanup & Sequel Navigation
- **Task 4.1**: In `MediaCard.jsx` and `MediaDetailModal.jsx`, suppress season count badges on movies (`isMovie`) and standalone franchise season entries (`isSubsequentSeasonTitle`).
- **Task 4.2**: In `EpisodeGuide.jsx` and `MediaDetailModal.jsx`, add a prominent **"Next Season →"** / **"Watch Sequel"** navigation button that switches active media to the sequel.
- **Task 4.3**: Remove all hardcoded season/episode data across providers and ensure dynamic free API hydration (TVMaze API for series, AniList/Kitsu for anime).

### Phase 5: Regression Testing, Application Audit & CodeRabbit Review
- **Task 5.1**: Update existing test suites for 25-item pagination bounds.
- **Task 5.2**: Write test suite `tests/v2.6_enhancements.test.js` verifying logout catalog clearing, sequel navigation, and pagination options.
- **Task 5.3**: Run full test verification suite (`npm test`) and Vite build (`npm run build`).
- **Task 5.4**: Run full CodeRabbit 4-pillar review with severity badges and fix any critical issues found.
