# SPEC_V2.6.md — OmniWatch 2.6 Architecture Contract

**Milestone:** v2.6 Mobile Experience, Catalog Isolation & Dynamic Season Architecture  
**Author:** Roo Architect  
**Status:** DRAFT (Under Review)  
**Date:** 2026-10-08

---

## 1. High-Level System Architecture

OmniWatch 2.6 enhances session privacy, mobile usability, layout bandwidth, and replaces static season definitions with dynamic external API hydration and franchise navigation.

```mermaid
graph TD
    Client[OmniWatch Web Client (React + Vite + Tailwind)]
    AuthLayer[Session Layer (JWT + LocalStorage)]
    ServerAPI[Express Server REST API]
    Orchestrator[Provider Orchestrator]
    DB[(SQLite / Neon DB)]
    TVMaze[TVMaze Free REST API]
    AniList[AniList GraphQL Free API]
    Kitsu[Kitsu REST Free API]

    Client -->|Authenticated Req with Bearer Token| ServerAPI
    Client -->|Logged Out / No Token| ServerAPI
    ServerAPI -->|Scoped by req.userId| DB
    ServerAPI -->|Unauthenticated / Logged Out| EmptyCatalog[Return Empty Catalog 0 Items]
    ServerAPI --> Orchestrator
    Orchestrator --> TVMaze
    Orchestrator --> AniList
    Orchestrator --> Kitsu
    Orchestrator --> DB
```

---

## 2. Requirement Specifications

### REQ-1: Strict Catalog Clearing on Logout
- **Problem**: When a user logs out, unauthenticated requests to `/api/catalog` currently fall back to `DEFAULT_USER_ID` (`user_makisanis106`), exposing all 208 catalog records to logged-out sessions.
- **Contract**:
  - In `authMiddleware`: When no Bearer token is provided, `req.user = null` and `req.userId = null`.
  - In `catalogRoutes.js`: When `req.userId` is null, all `/api/catalog` read routes return an empty catalog (`{ success: true, count: 0, data: [], hasMore: false }`) and stats return zeroes. Write routes return `401 Unauthorized`.
  - In `apps/client/src/App.jsx`: `handleLogout()` immediately purges `catalogMediaList = []`, `catalogItems = []`, `catalogMap = new Map()`, `stats = null`, `user = null`, and resets current view to `'global'` if on catalog views.

### REQ-2: Layout Expansion & Search Bar Overhaul
- **Problem**: Main view container is constrained to `max-w-7xl` (1280px) and search bar is restricted to `max-w-xs`, causing cramped search results and wasted monitor space.
- **Contract**:
  - Expand main content container to `max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8` for maximum screen utilization.
  - Expand `Navbar.jsx` search input width to flex-grow with max-width `max-w-2xl` on desktop, with an expanded search dropdown and instant clear (`X`) button.

### REQ-3: Full Mobile Responsiveness & Phone Optimization
- **Problem**: Navigation tabs, filters, modals, and card actions overflow or feel cramped on 360px-430px smartphone screens.
- **Contract**:
  - **Navbar**: Responsive mobile header with slide-over drawer or bottom navigation bar for view tabs (Global, Watchlist, Catalog, Insights).
  - **FilterBar**: Horizontally scrollable chip carousels (`overflow-x-auto scrollbar-none flex-nowrap`) with touch scrolling and visible scroll indicators.
  - **Media Detail Modal**: Optimized mobile drawer with sticky tab header, full-width actions, and vertical touch-friendly layout.
  - **Episode Guide**: Mobile accordion view with generous tap targets (minimum 44x44px touch targets).

### REQ-4: Pagination Sizes Overhaul (25, 50, 100)
- **Problem**: Previous pagination hardcoded 24 and 48 items per page.
- **Contract**:
  - Update `Pagination.jsx` per-page selector buttons to `[25, 50, 100]`.
  - Update default `pageSize` in `App.jsx` to `25`.
  - Update backend pagination limits in `catalogRoutes.js` and `globalRoutes.js` to clamp to `Math.min(100, parseInt(limit, 10) || 25)`.
  - Update `@omniwatch/shared` constants.

### REQ-5: Removal of Demo Credentials UI
- **Problem**: `AuthModal.jsx` includes a "Fill Demo Credentials" button that exposes personal credentials.
- **Contract**:
  - Completely remove the demo credentials button and any hardcoded email/password strings from `AuthModal.jsx`.

### REQ-6: Season Badge Cleanup (Movies & Separate Entries)
- **Problem**: Standalone anime seasons (e.g. Attack on Titan S2) and Movies display misleading "1 Sns" badges.
- **Contract**:
  - In `MediaCard.jsx` and `MediaDetailModal.jsx`:
    - If `isMovie` is true: Suppress all season count badges.
    - If `isSubsequentSeasonTitle(title)` is true: Suppress overall franchise season counts from the card header.

### REQ-7: Direct Season Navigation ("Next Season" / "Sequel" button)
- **Problem**: Users viewing Season 1 have to exit the modal and manually search to find Season 2 / Sequel.
- **Contract**:
  - In `EpisodeGuide.jsx` and `MediaDetailModal.jsx`, detect if an active media entry has an interconnected `SEQUEL` or higher season in its franchise timeline.
  - Render an interactive **"Next Season →"** or **"Watch Sequel: {Title}"** action banner. Clicking it immediately switches `selectedMedia` to that season.

### REQ-8 & REQ-9: Elimination of Hardcoded Seasons & Dynamic API Fetching
- **Problem**: Some season/episode structures were manually approximated.
- **Contract**:
  - Remove all hardcoded season arrays or static counts.
  - For TV Series: Dynamically query TVMaze `/shows/:id?embed[]=episodes&embed[]=seasons` to resolve live seasons and episode lists.
  - For Anime: Query AniList GraphQL and Kitsu to retrieve live season lists, episodes, and franchise relations.
  - Gracefully handle titles with unknown episode counts (airing shows) without crashing.

### REQ-10: Application-Wide Validation & Consistency
- **Contract**: Full regression testing covering auth isolation, 25/50/100 pagination non-overlap, dynamic season fetching, and mobile rendering.
