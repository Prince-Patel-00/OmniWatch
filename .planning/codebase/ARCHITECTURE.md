# Architecture

**Analysis Date:** 2026-10-08

## Pattern Overview

**Overall:** Decoupled Full-Stack Monorepo (React SPA + Express REST API + Multi-Provider Orchestrator + Relational SQLite/PostgreSQL Database).

**Key Characteristics:**
- **Decoupled Architecture:** Clean separation between the React client (`apps/client`), Express backend (`apps/server`), and shared domain library (`packages/shared`).
- **Multi-Provider Normalization & Deduplication:** Multi-source ingestion from AniList, TVMaze, Kitsu, and TMDB synthesized into uniform canonical entities with fuzzy title and release year deduplication.
- **Durable Local-First Persistence with Cloud Dual-Driver:** SQLite via native `node:sqlite` in WAL mode for zero-overhead local development, with transparent runtime fallback to Neon Serverless PostgreSQL when cloud database connection strings are present.
- **Provider Redundancy & Dormancy:** Core application functions entirely without API keys using public APIs (AniList, TVMaze, Kitsu), while gracefully activating TMDB features when an API key is supplied.

## Layers

**1. Presentation Layer (`apps/client/src/components/*`):**
- Purpose: Reactive user interface and user interaction management.
- Contains:
  - `Navbar.jsx`: Global view switching (Global Discovery, My Catalog, Analytics Dashboard), search bar, and modal triggers.
  - `FilterBar.jsx`: Category filters (Anime, Movies, Series), anime format sub-tabs (All, Series, Movies), status filters, genres, and sort orders.
  - `HeroSpotlight.jsx`: Featured high-impact trending title banner with quick actions.
  - `MediaCard.jsx`: Reusable catalog/discovery cards with posters, badges, ratings, and "+1 Ep" quick-increment button.
  - `MediaDetailModal.jsx`: Comprehensive title drawer containing synopsis, official watch options, trailers, multi-season guides, episode checkmarks, and personal notes.
  - `EpisodeGuide.jsx`: Interactive season and episode tree with individual checkboxes and "Complete Season" action.
  - `StatsDashboard.jsx`: Watch time metrics, completion percentages, and media format breakdowns.
  - `SettingsModal.jsx`: TMDB API key configuration and dynamic mirror source management with latency probing.
  - `BackupModal.jsx`: JSON backup export and restore snapshot manager.
- Depends on: Client service layer (`apps/client/src/services/api.js`) and `@omniwatch/shared`.

**2. Client Service Layer (`apps/client/src/services/api.js`):**
- Purpose: HTTP client abstraction using browser `fetch` to communicate with backend REST endpoints.
- Contains: Wrapper functions for trending, search, catalog operations, episode tracking, backups, and mirror checks.

**3. Backend Route Layer (`apps/server/src/routes/*`):**
- Purpose: Express router endpoints validating parameters and mapping HTTP requests to service/database operations.
- Contains:
  - `globalRoutes.js`: Global discovery endpoints (`/api/global/trending`, `/api/global/search`, `/api/global/media/:id`, `/api/global/characters`).
  - `catalogRoutes.js`: Watchlist management (`/api/catalog`, `/api/catalog/:id`, `/api/catalog/:id/episode`, `/api/catalog/backup`).
  - `mirrorRoutes.js`: Mirror management and health checking (`/api/mirrors`, `/api/mirrors/check`).
  - `systemRoutes.js`: System health, provider readiness, and configuration (`/api/system/status`).
- Depends on: `ProviderOrchestrator`, `db.js`, `mirrorHealthService.js`.

**4. Aggregator & Orchestration Layer (`apps/server/src/providers/ProviderOrchestrator.js`):**
- Purpose: Coordinates multi-provider API calls, normalizes disparate schemas, merges duplicate items into canonical records, resolves acronym queries, and caches results.
- Contains:
  - Acronym mapping table (`got` -> Game of Thrones, `aot` -> Attack on Titan, etc.).
  - Entity deduplication algorithms (`areSameEntity()`, `cleanTitleForMatch()`, `getNormalizedTitleVariants()`).
  - Cross-provider hydration (e.g., merging AniList Japanese metadata with Kitsu trailers and TVMaze season hierarchies).
- Depends on: Provider adapters and database cache methods.

**5. Provider Adapters (`apps/server/src/providers/*`):**
- Purpose: Provider-specific HTTP integrations and response translation into canonical shapes.
- Contains:
  - `BaseProvider.js`: Base interface contract.
  - `AniListProvider.js`: GraphQL client for anime data and countdowns.
  - `TVMazeProvider.js`: REST client for Western TV shows, seasons, and episodes.
  - `KitsuProvider.js`: JSON:API client for anime search and YouTube trailer keys.
  - `TMDBProvider.js`: REST client for TMDB movies, series, and JustWatch streaming providers.

**6. Database & Persistence Layer (`apps/server/src/db.js` & `apps/server/src/db_neon.js`):**
- Purpose: Data access, schema migrations, and relational persistence.
- Contains:
  - SQLite driver via Node 22 `DatabaseSync` in WAL mode (`db.js`).
  - Neon PostgreSQL driver via `@neondatabase/serverless` (`db_neon.js`).
  - Unified data access interface: `saveCanonicalMedia`, `getCanonicalMedia`, `getCatalogItems`, `saveCatalogItem`, `toggleEpisodeProgress`, `batchCompleteSeason`, `getAllMirrorSources`.

**7. Shared Domain Model (`packages/shared/src/*`):**
- Purpose: Cross-boundary single source of truth for constants, types, and utilities.
- Contains:
  - `constants.js`: Media types, watch statuses, availability types, mirror registry defaults.
  - `seedData.js`: Curated fallback media items and catalog seed items.
  - Normalization helpers: `normalizeTitle()`.

## Data Flow

**1. Global Discovery & Search Flow:**
```
User Search (Client)
   │
   ▼
GET /api/global/search?q=... (Express)
   │
   ▼
ProviderOrchestrator.search()
   ├── Check ACRONYM_MAP (expand acronym if applicable)
   ├── Query DB cache (`searchCachedMedia`)
   ├── Query Provider Adapters in parallel (AniList, TVMaze, Kitsu, TMDB)
   ├── Normalize results to Canonical Media Shape
   ├── Deduplicate cross-provider items into single canonical records
   ├── Save newly discovered media to `cached_media` in SQLite/Postgres
   └── Return paginated list of Canonical Media to Client
```

**2. Watchlist & Episode Checkmark Flow:**
```
User clicks "+1 Ep" or checks episode in Guide
   │
   ▼
PATCH /api/catalog/:id/episode (Express)
   │
   ▼
db.toggleEpisodeProgress(catalogItemId, seasonNum, epNum, isWatched)
   ├── Begin Transaction
   ├── Upsert row in `catalog_episode_progress`
   ├── Recalculate `current_episode` and `user_status`
   ├── Update `catalog_items` row
   ├── Commit Transaction
   └── Return updated Catalog Item & Progress list to Client
```

**3. Mirror Health Probing & Auto-Migration Flow:**
```
Vercel Cron (every 6h) or User click in Settings
   │
   ▼
POST /api/mirrors/check (Express)
   │
   ▼
mirrorHealthService.checkAllMirrors()
   ├── Load all mirror sources from DB
   ├── Concurrently probe each candidate domain with HTTP HEAD/GET
   ├── Record latency and HTTP response status
   ├── If primary domain is unreachable, promote next healthy candidate domain
   ├── Update `mirror_sources` in DB
   └── Return health status report
```

## Key Abstractions

- **Canonical Media Object:** Standardized entity shape containing `id`, `mediaType`, `format`, `title`, `originalTitle`, `romajiTitle`, `synopsis`, `releaseYear`, `status`, `rating`, `posterUrl`, `backdropUrl`, `genres`, `seasons`, `episodes`, `trailers`, and `watchProviders`.
- **BaseProvider Interface:** Contract defining standard provider behavior (`search()`, `getTrending()`, `getDetail()`, `isAvailable()`).
- **Database Engine Switcher (`isNeon()`):** Transparently shifts query execution between SQLite DatabaseSync and Neon Postgres without altering API endpoint signatures.

## Entry Points

- **Backend Development Server:** `apps/server/src/index.js` (starts Express listener on `PORT`).
- **Vercel Serverless Gateway:** `api/index.js` (exports Express `app` for Vercel Serverless Function runtime).
- **Frontend Development / Production Build:** `apps/client/index.html` loading `apps/client/src/main.jsx`.

## Error Handling

- **API Boundary:** Global Express error handler in `apps/server/src/app.js` catches uncaught errors and returns `{ success: false, error: message }` with 500 status code.
- **Provider Resilience:** In `ProviderOrchestrator`, individual provider API failures are caught with `Promise.allSettled` or individual try/catch blocks; failure of one provider (e.g. rate limits or downtime) does not crash the search or trending results from other providers.
- **Client Toast Notification:** Client UI surfaces errors to users using the `Toast.jsx` notification component.

---

*Architecture analysis: 2026-10-08*
*Update after structural architecture changes*
