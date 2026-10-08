# ROADMAP.md — OmniWatch 2.5 Rebuild Phased Plan

**Status:** APPROVED  
**Architecture Spec:** `.gsd/SPEC.md`  
**Execution Methodology:** Get Shit Done (GSD) Atomic Phase Waves  
**Current Milestone:** v2.5 OmniWatch Core Rebuild

---

## Milestone Goal

Rebuild OmniWatch with multi-user authentication and catalog isolation, clean modern navigation with dedicated Want to Watch views, franchise-unified season tracking, automated dynamic mirror resolution, and taste-driven recommendations from user favorites.

---

## Phase Overview

| Phase | Title | Focus Area | Dependencies | Target Artifacts |
|---|---|---|---|---|
| **Phase 1** | User Authentication & Isolated Catalogs | Backend & DB Schema | None | `apps/server/src/auth.js`, `apps/server/src/db.js`, `apps/server/src/routes/authRoutes.js`, migration script |
| **Phase 2** | UI Cleanup, Navigation & Strict Pagination | Frontend Core & UX | Phase 1 | `apps/client/src/App.jsx`, `apps/client/src/components/Navbar.jsx`, `PaginationBar.jsx`, Auth UI |
| **Phase 3** | Unified Season & Episode Architecture | Full-Stack Tracking | Phase 1, Phase 2 | `ProviderOrchestrator.js`, `EpisodeGuide.jsx`, `MediaDetailModal.jsx` |
| **Phase 4** | Dynamic Mirror Registry Automation | Provider Infrastructure | Phase 1 | `mirrorHealthService.js`, `mirrorRoutes.js`, `SettingsModal.jsx` |
| **Phase 5** | Taste Insights & "More Like This" Engine | Intelligence & Analytics | Phase 1, Phase 3 | `recommendationEngine.js`, `StatsDashboard.jsx`, `/api/catalog/recommendations` |

---

## Detailed Phase Breakdown

### Phase 1: User Authentication & Isolated Catalogs (Multi-Tenant Schema)
**Goal:** Deliver secure email/password authentication, seed `makisanis106@gmail.com`, and migrate existing 208 catalog records to this user across SQLite and Neon DB.

- **Wave 1: Data Modeling & Migration**
  - **Task 1.1:** Add `users` table and `user_id` foreign keys to `catalog_items` and `catalog_episode_progress` in `apps/server/src/db.js` and `apps/server/src/db_neon.js`.
  - **Task 1.2:** Write automated migration and seed routine on startup: seed user `makisanis106@gmail.com` with password `OutCast106` (salted hash) and attach all unowned catalog items (208 items) and episode progress rows to this user ID.
- **Wave 2: Authentication Service & API Endpoints**
  - **Task 1.3:** Implement JWT token signing and verification middleware in `apps/server/src/middleware/authMiddleware.js`.
  - **Task 1.4:** Create `apps/server/src/routes/authRoutes.js` (`POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`) and wire into `apps/server/src/app.js`.
  - **Task 1.5:** Protect all `/api/catalog/*` endpoints to filter strictly by authenticated `req.userId`.
- **Verification Proof:**
  - Automated test verifying user login with `makisanis106@gmail.com` / `OutCast106` returns 200 + valid JWT.
  - SQL verification that `SELECT count(*) FROM catalog_items WHERE user_id = 'user_makisanis106'` returns exactly 208.
  - Verification that unauthenticated requests to `/api/catalog` return 401.

---

### Phase 2: UI Cleanup, Navigation & Strict Modern Pagination
**Goal:** Completely eliminate the Hero Spotlight, separate "Want to Watch" into its own dedicated top-level section, integrate user session/login UI, and overhaul pagination to a strict, modern 24-item bar.

- **Wave 1: Hero Spotlight Removal & Layout Simplification**
  - **Task 2.1:** Remove `<HeroSpotlight />` and references from `apps/client/src/App.jsx`. Content grid begins immediately under the filter controls.
  - **Task 2.2:** Add Auth modal / login status bar in `Navbar.jsx` with persistent token storage in `localStorage`.
- **Wave 2: Navigation Restructuring & "Want to Watch" Isolation**
  - **Task 2.3:** Add dedicated top-level view for **"Want to Watch" (`watchlist`)** separate from the watched library. Remove "Want to Watch" from the secondary status filter.
  - **Task 2.4:** Build `apps/client/src/components/PaginationBar.jsx` with active page indicator, quick jumps, and strict 24-item per page boundaries with zero item overlap.
- **Verification Proof:**
  - `npm run build` passes with zero bundle errors.
  - Visual inspection confirms Home view loads directly with media cards without Hero Spotlight.
  - Clicking "Want to Watch" in navigation displays backlog items exclusively.
  - Test verifying page 1 and page 2 contain exactly 24 items with zero duplicate IDs.

---

### Phase 3: Unified Season & Episode Architecture & Direct Launchers
**Goal:** Unify fragmented anime seasons (e.g. AOT Season 1, Season 2, Final Season) into interconnected franchise trees and provide direct episode launch links without duplicate streaming banners.

- **Wave 1: Franchise Relationship Linking**
  - **Task 3.1:** In `ProviderOrchestrator.js`, extract and store relational edges (`PREQUEL`, `SEQUEL`, `PARENT`) from AniList GraphQL to link related anime entries under a unified `franchise_id` or relations graph.
  - **Task 3.2:** Expose franchise chronology in `/api/global/media/:id` so clients can render direct season hops.
- **Wave 2: Streamlined Episode Guide & Direct Streaming Links**
  - **Task 3.3:** Redesign `EpisodeGuide.jsx` and `MediaDetailModal.jsx` to remove redundant duplicate streaming banner placeholders.
  - **Task 3.4:** Add direct "Watch Episode" button on each episode row linking directly to the active mirror search/watch template for that specific title and episode number.
- **Verification Proof:**
  - Searching/viewing Attack on Titan renders direct navigation to related seasons.
  - Episode guide displays clean individual episodes with direct stream links and persistent checkmarks.

---

### Phase 4: Dynamic Mirror Registry Automation & Daily Resolver
**Goal:** Implement automated daily mirror domain checks with automatic failover and direct stream/search URL generation.

- **Wave 1: Automated Background Resolver**
  - **Task 4.1:** Update `mirrorHealthService.js` with daily automated probe scheduling and automated failover when primary domains are unreachable.
  - **Task 4.2:** Expand `DEFAULT_MIRROR_REGISTRY` in `@omniwatch/shared` with up-to-date candidate domains and direct watch templates.
- **Wave 2: Mirror Direct Link Generation & UI Verification**
  - **Task 4.3:** Create URL generator helper `generateDirectStreamUrl(mirror, mediaTitle, seasonNum, episodeNum)` in `@omniwatch/shared`.
  - **Task 4.4:** Update `SettingsModal.jsx` to show live mirror latency status, candidate domain list, and test ping button.
- **Verification Proof:**
  - Test suite `tests/mirror_registry.test.js` passes with dynamic domain failover verification.
  - Calling `/api/mirrors/check` correctly tests candidates and updates DB.

---

### Phase 5: Redesigned Insights & Taste-Driven Recommendation Engine
**Goal:** Replace raw hour/episode counters with rich taste insights and implement the "More Like This" recommendation engine triggered by 9-10 rated titles.

- **Wave 1: Taste Profile Analytics**
  - **Task 5.1:** Implement `/api/catalog/insights` in `apps/server/src/routes/catalogRoutes.js` computing:
    - Genre affinity distribution (% breakdown).
    - Top studios & creators by rating.
    - Release era distribution (90s, 2000s, 2010s, 2020s).
    - Binge velocity & completion rates.
  - **Task 5.2:** Rebuild `StatsDashboard.jsx` to render visual taste cards, genre percentages, and era badges instead of simple counters.
- **Wave 2: "More Like This" Recommendation Engine**
  - **Task 5.3:** Create `apps/server/src/services/recommendationEngine.js` querying user titles with `user_rating >= 9`, extracting their feature vector, and finding uncataloged candidates from `cached_media` and provider recommendations.
  - **Task 5.4:** Create endpoint `GET /api/catalog/recommendations` and render a personalized "Because You Loved [Title]" carousel in the UI.
- **Verification Proof:**
  - Automated test verifying that adding a 10★ rating generates recommendations matching the title's genres/studio while excluding items already in the catalog.
  - `StatsDashboard.jsx` renders taste insights accurately for `makisanis106@gmail.com`.
