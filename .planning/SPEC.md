# SPEC.md — OmniWatch 2.5 Architecture Contract & Specification

**Status:** FINALIZED  
**Version:** 2.5.0  
**Architect:** Roo Architect Mode  
**Target Date:** 2026-10-08  
**Repository:** OmniWatch Monorepo (`apps/client`, `apps/server`, `packages/shared`, `tests/`)

---

## 1. Executive Summary & Problem Statement

OmniWatch is currently a personal entertainment tracking hub operating as a single-tenant local application. While it possesses robust multi-provider ingestion (AniList, TVMaze, Kitsu, TMDB) and SQLite WAL storage, it lacks:
1. User multi-tenancy and authentication — all visitors share a single catalog.
2. Visual clarity on Home — the bulky Hero Spotlight banner occupies excessive viewport height, "Want to Watch" is mixed into a generic status filter, and pagination counts fluctuate unpredictably.
3. Unified franchise hierarchy — anime sequels (e.g., Attack on Titan Season 1 vs Season 2 vs Final Season) exist as fragmented separate records, while Western TV series exist as unified multi-season trees. Direct episode stream links are cluttered with duplicate provider banners.
4. Autonomous mirror maintenance — mirror domain updates require manual intervention when domains shift.
5. High-value analytics — analytics currently only count raw hours and episodes, offering zero taste insights or intelligent recommendations based on user favorites.

This specification defines the architectural contracts, data schemas, API endpoints, UI layouts, and verification standards to rebuild OmniWatch into a multi-tenant, clean, franchise-unified, and taste-driven entertainment platform.

---

## 2. Pillar 1: User Authentication & Isolated Catalogs

### 2.1 Schema Architecture (SQLite & Neon PostgreSQL)

A new `users` table is introduced, and existing catalog tables (`catalog_items`, `catalog_episode_progress`) are partitioned by `user_id`.

#### Tables:
```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

#### Alterations / Multi-Tenant Foreign Keys:
- `catalog_items`: Add column `user_id TEXT REFERENCES users(id) ON DELETE CASCADE`.
- `catalog_episode_progress`: Add column `user_id TEXT REFERENCES users(id) ON DELETE CASCADE`.
- Composite Unique Indexes:
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_canonical_catalog ON catalog_items(user_id, canonical_id);`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_episode_progress ON catalog_episode_progress(user_id, catalog_item_id, season_number, episode_number);`

### 2.2 Seed User & Existing 208 Records Migration Contract
1. System checks on boot if user `makisanis106@gmail.com` exists.
2. If missing, automatically creates seed user:
   - Email: `makisanis106@gmail.com`
   - Password: `OutCast106` (salted hash via Node standard library `crypto.scryptSync`)
   - User ID: deterministic or nano-id, e.g., `user_makisanis106`.
3. Database migration script (`migrateToMultiUser`):
   - Updates all existing unassigned catalog records (`WHERE user_id IS NULL OR user_id = ''`) setting `user_id = 'user_makisanis106'`.
   - Updates all `catalog_episode_progress` records setting `user_id = 'user_makisanis106'`.
4. Verification: Query `SELECT COUNT(*) FROM catalog_items WHERE user_id = 'user_makisanis106'` must return exactly 208 items.

### 2.3 Authentication API Contract
- `POST /api/auth/login`:
  - Body: `{ email, password }`
  - Success Response (200): `{ success: true, token, user: { id, email, displayName } }`
  - Error Response (401): `{ success: false, error: "Invalid email or password" }`
- `POST /api/auth/register`:
  - Body: `{ email, password, displayName }`
  - Success Response (201): `{ success: true, token, user: { id, email, displayName } }`
- `GET /api/auth/me`:
  - Header: `Authorization: Bearer <token>`
  - Success Response (200): `{ success: true, user: { id, email, displayName } }`
- Token Strategy: JWT token containing `{ userId, email }` signed with server secret (`AUTH_JWT_SECRET` with fallback to stable instance secret) with 30-day expiration.
- Middleware: `requireAuth` extracts `req.userId` from Bearer token or fails with 401. All catalog routes (`/api/catalog/*`) enforce `requireAuth`.

---

## 3. Pillar 2: UI Cleanup, Navigation & Strict Pagination

### 3.1 Removal of Hero Spotlight Banner
- Completely remove `<HeroSpotlight />` from `apps/client/src/App.jsx`.
- Clean up any unused assets or orphan props associated with Hero Spotlight.
- Elevate the primary content grid immediately below the Navigation Bar and Filter Bar.

### 3.2 Top-Level Navigation & Status Separation
- Restructure the top navigation views into three distinct operational spaces:
  1. **Global Discovery (`/global`)**: Live trending, airing countdowns, and universal search across all providers.
  2. **Want to Watch / Backlog (`/watchlist`)**: Dedicated, focused view for titles the user intends to watch, with priority sorting, release countdowns, and quick "Start Watching" actions.
  3. **My Library (`/catalog`)**: Active consumption vault with distinct tabs:
     - `Watching` (In-progress titles with quick "+1 Ep")
     - `Completed` (Finished series & movies)
     - `On Hold` & `Dropped`
  4. **Taste Insights (`/insights`)**: Redesigned analytics and personalized recommendation engine.
- Remove "Want to Watch" from the secondary status filter inside the watched library to prevent status clutter.

### 3.3 Strict, Predictable Pagination Overhaul
- Standardize on exact page sizes: **24 items per page** across all views (Discovery, Want to Watch, My Library).
- Backend Contract:
  - Enforce explicit `LIMIT :limit OFFSET :offset` in database queries.
  - Return `{ page: N, limit: 24, totalItems: X, totalPages: Math.ceil(X / 24), data: [...] }`.
  - Zero overlapping items across consecutive pages (guaranteed by strict primary ordering `popularity DESC, id ASC` or `updated_at DESC, id ASC`).
- Frontend Component (`PaginationBar.jsx`):
  - Numbered page pills (`1`, `2`, `...`, `N-1`, `N`), previous/next arrows, and direct page jumping.
  - Sticky or fixed at the bottom of the media grid with instant smooth scroll to top on page transition.

---

## 4. Pillar 3: Unified Season & Episode Architecture

### 4.1 Franchise & Fragmented Anime Unification
- **The Challenge:** AniList and Kitsu treat anime sequels (e.g. *Attack on Titan*, *Attack on Titan Season 2*, *Attack on Titan The Final Season*) as disconnected standalone media records, whereas Western TV series in TVMaze use a single root show with nested `seasons` and `episodes`.
- **Franchise Linking Resolver:**
  - Introduce `franchise_id` or `related_media_relations` in `cached_media`.
  - AniList GraphQL already provides `relations` edges (`PREQUEL`, `SEQUEL`, `PARENT`, `SIDE_STORY`).
  - Parse relations during ingestion to build an interconnected Franchise Tree.
  - In `MediaDetailModal.jsx`: Display a Franchise Chronology timeline allowing users to navigate directly from Season 1 to Season 2 to Final Season without re-searching.
  - Overall franchise watch progress indicator: Aggregate total watched episodes across the entire franchise saga.

### 4.2 Streamlined Episode Launcher & Direct Links
- In `MediaDetailModal.jsx` and `EpisodeGuide.jsx`:
  - Eliminate redundant, duplicate streaming banners and promotional placeholders.
  - Provide a clean, direct action per episode:
    - **Watch Episode**: Direct deep link to current active mirror stream (e.g., `HiAnime /watch/{slug}?ep={num}` or query resolver).
    - **Checkmark Progress**: Persistent toggle with optimistic UI update.
  - Episode guide header displays clean season selector pills (`Season 1`, `Season 2`, etc.) with episode runtimes and air dates.

---

## 5. Pillar 4: Dynamic Mirror Registry Automation

### 5.1 Dynamic Domain Auto-Resolution
- Dynamic table `mirror_sources` maintained in database with candidate backup domains (e.g., `hianime.to` -> `hianime.org` -> `hianime.pe`; `flixhq.to` -> `flixhq.se`).
- Backend Service (`mirrorHealthService.js`):
  - Daily automatic probe cron checking latency and HTTP status code.
  - Domain failover: If the active domain returns DNS failure, timeout (>3500ms), or HTTP 4xx/5xx, automatically promote the fastest responsive candidate domain in the registry.
- Direct URL Generation:
  - Standardized URL templating:
    - Search: `{domain}/search?keyword={query}`
    - Direct Media Stream: `{domain}/watch/{slug}`
    - Anime Specific: Support slugified English, Romaji, and title variants.
- Frontend Settings & Status Indicator:
  - Settings modal displays live ping latency and working domain badge for all active mirrors.
  - Fallback search launcher button on every media card and detail modal.

---

## 6. Pillar 5: Taste Insights & "More Like This" Recommendation Engine

### 6.1 Taste Insights Dashboard (Replacing Raw Counters)
- Replace generic "total hours and episodes" counters with rich, narrative taste metrics:
  1. **Top Genre Affinity Radar / Breakdown**: Percentage distribution of completed & high-rated genres (e.g., *Cyberpunk 32%*, *Psychological Thriller 28%*, *Sci-Fi 20%*).
  2. **Studio & Creator Signatures**: Top animation studios (e.g., *MAPPA*, *ufotable*, *Bones*) and creators with highest average ratings.
  3. **Release Era Affinity**: User preference distribution across decades (*90s Classics*, *2000s Golden Era*, *2010s*, *Contemporary 2020s*).
  4. **Pacing & Velocity Insights**: Average completion time per season and current binge streak.

### 6.2 "More Like This" High-Rating Recommendation Engine
- **Trigger:** Catalog titles rated **9 or 10** by the authenticated user.
- **Algorithm:**
  1. Extract core feature vector from user's 9/10 rated titles:
     - Top genres (weighted by rating).
     - Creators, studios, and network origins.
     - Content tags (e.g., *Dystopian*, *Time Travel*, *Dark Fantasy*).
  2. Candidate Generation:
     - Query `cached_media` for matching high-overlap titles.
     - Leverage AniList `recommendations` and TMDB `/similar` endpoints for top-tier seed titles.
  3. Catalog Exclusion Filter:
     - Automatically filter out any title already in user's catalog (`user_status IS NOT NULL`).
  4. Scoring & Presentation:
     - Compute Match Score (e.g., *98% Match based on your 10★ rating of Steins;Gate*).
     - Render in a dedicated "Curated For You" row with explanation badges.

---

## 7. Verification & Proof Standards

Every phase must prove its completion with empirical evidence:

| Component | Required Empirical Evidence |
|-----------|-----------------------------|
| Auth & Multi-Tenancy | `curl` login returns JWT; SQL query verifies 208 records attached to `makisanis106@gmail.com`; unauthenticated requests return 401 |
| UI & Navigation | Clean build (`npm run build`); verification that `HeroSpotlight` is removed; strict 24 items per page test passes |
| Unified Seasons | Test suite verifies franchise links between anime seasons and direct stream links |
| Mirror Registry | API response from `/api/mirrors/check` showing domain latency and active promotion |
| Insights & Recommendations | Test verifying taste calculation and recommendations generated from 9/10 rated items |
| Regression Suite | Full test suite `npm test` passing with 0 failures |
