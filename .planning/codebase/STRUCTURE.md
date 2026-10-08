# Codebase Structure

**Analysis Date:** 2026-10-08

## Directory Layout

```
omniwatch-monorepo/
├── .agent/                 # GSD methodology workflows, skills, and templates
├── .agents/                # Local skills directory (subagent delegation, planners, etc.)
├── .planning/              # Project planning memory, codebase maps, and phase plans
│   └── codebase/           # Codebase intelligence reference documents
├── adapters/               # Multi-agent instruction adapters (CLAUDE.md, GEMINI.md, GPT_OSS.md)
├── api/                    # Vercel serverless gateway
│   └── index.js            # Serverless entry point importing Express app
├── apps/
│   ├── client/             # Frontend React Single Page Application
│   │   ├── public/         # Static assets and icons
│   │   ├── src/
│   │   │   ├── components/ # Reusable React UI components
│   │   │   ├── services/   # Client HTTP API client
│   │   │   ├── App.jsx     # Root application component
│   │   │   ├── main.jsx    # React DOM mounting entry point
│   │   │   └── index.css   # Tailwind CSS imports & global styles
│   │   ├── package.json    # Client package definitions & dependencies
│   │   ├── vite.config.js  # Vite dev server & bundling config
│   │   └── tailwind.config.js # Tailwind CSS theme and content paths
│   └── server/             # Backend Express REST API
│       ├── data/           # SQLite database directory (omniwatch.db, WAL, SHM)
│       ├── src/
│       │   ├── controllers/# Business logic and route handlers
│       │   ├── providers/  # External API adapters (AniList, TVMaze, Kitsu, TMDB, Orchestrator)
│       │   ├── routes/     # Express route handlers
│       │   ├── services/   # Domain services (mirror health service)
│       │   ├── app.js      # Express application setup, middlewares, and routes
│       │   ├── db.js       # SQLite database driver and schema
│       │   ├── db_neon.js  # Neon Serverless PostgreSQL driver
│       │   └── index.js    # Local server listen entry point
│       └── package.json    # Server package dependencies
├── packages/
│   └── shared/             # Monorepo shared library (@omniwatch/shared)
│       ├── src/
│       │   ├── constants.js# Media types, statuses, regions, mirror defaults
│       │   ├── seedData.js # Fallback offline titles & initial seeds
│       │   └── index.js    # Shared package exports
│       └── package.json    # Shared package configuration
├── scripts/                # Repository validation and maintenance scripts
├── tests/                  # Automated integration and end-to-end test suites
├── package.json            # Monorepo workspace configuration and npm scripts
├── PROJECT_RULES.md        # Single Source of Truth for GSD development standards
├── README.md               # User & developer guide
└── vercel.json             # Vercel deployment and cron configuration
```

## Directory Purposes

**`apps/client`:**
- Purpose: Frontend web client for OmniWatch.
- Contains: React components, Tailwind styling, Vite configuration, and browser API client.
- Key files:
  - `src/App.jsx`: Master view router, state coordinator, and layout renderer.
  - `src/components/MediaDetailModal.jsx`: Comprehensive title detail modal with episode guide, official providers, trailers, and personal review inputs.
  - `src/components/EpisodeGuide.jsx`: Season/episode checklist component with batch completion.
  - `src/components/FilterBar.jsx`: Tab switcher, genre filter, status filter, and sort selector.
  - `src/components/SettingsModal.jsx`: Configuration for TMDB API key and mirror domains.
  - `src/services/api.js`: Standardized HTTP client wrapping backend endpoints.

**`apps/server`:**
- Purpose: Backend REST API server and multi-provider aggregator.
- Contains: Express server, route controllers, API adapters, SQLite/PostgreSQL drivers.
- Key files:
  - `src/app.js`: Express app instance, CORS, JSON parsing, logging, and route mounting.
  - `src/index.js`: Local standalone server listener.
  - `src/db.js`: Relational schema definitions, WAL initialization, and dual-driver routing.
  - `src/db_neon.js`: Serverless PostgreSQL implementation using `@neondatabase/serverless`.
  - `src/providers/ProviderOrchestrator.js`: Ingestion, deduplication, and cross-provider caching coordinator.
  - `src/providers/AniListProvider.js`: GraphQL anime provider.
  - `src/providers/TVMazeProvider.js`: Western TV shows and episode provider.
  - `src/providers/KitsuProvider.js`: Anime search and trailer provider.
  - `src/providers/TMDBProvider.js`: Movies and JustWatch provider.
  - `src/services/mirrorHealthService.js`: Latency prober and auto-migration service.

**`packages/shared`:**
- Purpose: Shared code between frontend and backend.
- Contains: Domain models, constants, seed data, and text normalizers.
- Key files:
  - `src/constants.js`: Domain enums (`MEDIA_TYPES`, `USER_WATCH_STATUSES`, `AVAILABILITY_TYPES`).
  - `src/seedData.js`: Curated fallback media dataset.
  - `src/index.js`: Barrel export file.

**`tests`:**
- Purpose: Integration and end-to-end verification suites.
- Contains: Test files executed via `node:test`.
- Key files:
  - `tests/api_routes.test.js`: Core REST endpoint testing.
  - `tests/database.test.js`: SQLite relational schema, foreign keys, and progress persistence.
  - `tests/orchestrator_dedup.test.js`: Cross-provider entity deduplication.
  - `tests/seasons_completion.test.js`: Multi-season tracking and batch completion.
  - `tests/mirror_registry.test.js`: Dynamic mirror latency checks and domain auto-migration.
  - `tests/character_search.test.js`: Character search and actor filtering.
  - `tests/pagination.test.js`: Strict pagination without duplicate items.

## Key File Locations

**Entry Points:**
- Server Local: `apps/server/src/index.js`
- Serverless Cloud: `api/index.js`
- Client Web: `apps/client/index.html` -> `apps/client/src/main.jsx`

**Configuration:**
- Workspace root: `package.json`
- Environment variables: `.env` and `apps/server/.env`
- Frontend bundling: `apps/client/vite.config.js`
- Styling: `apps/client/tailwind.config.js`
- Deployment: `vercel.json`

**Database Storage:**
- SQLite Database: `apps/server/data/omniwatch.db`
- WAL and SHM files: `apps/server/data/omniwatch.db-wal`, `apps/server/data/omniwatch.db-shm`

## Naming Conventions

**Files:**
- React components: `PascalCase.jsx` in `apps/client/src/components/` (e.g., `MediaCard.jsx`, `EpisodeGuide.jsx`).
- Backend routes: `camelCaseRoutes.js` in `apps/server/src/routes/` (e.g., `catalogRoutes.js`, `globalRoutes.js`).
- Provider classes: `PascalCaseProvider.js` in `apps/server/src/providers/` (e.g., `AniListProvider.js`, `TMDBProvider.js`).
- Test files: `snake_case.test.js` in `tests/` (e.g., `api_routes.test.js`, `database.test.js`).
- Scripts: `kebab-case.ps1` and `kebab-case.sh` in `scripts/`.

**Functions & Variables:**
- Functions & methods: `camelCase` (e.g., `getCanonicalMedia`, `toggleEpisodeProgress`, `saveToCatalog`).
- Constants & Enums: `UPPER_SNAKE_CASE` (e.g., `MEDIA_TYPES`, `USER_WATCH_STATUSES`, `ACRONYM_MAP`).

## Where to Add New Code

**Adding a New Provider Adapter:**
- Implementation: Add `apps/server/src/providers/NewProvider.js` extending `BaseProvider.js`.
- Registration: Instantiate and attach in `apps/server/src/providers/ProviderOrchestrator.js`.
- Tests: Add test cases to `tests/provider_adapters.test.js`.

**Adding a New REST Endpoint:**
- Route definition: Register route in the appropriate file in `apps/server/src/routes/` (or create a new route module and mount it in `apps/server/src/app.js`).
- Database logic: Add data queries to `apps/server/src/db.js` (and `apps/server/src/db_neon.js` if Postgres-specific).
- Client service: Expose the endpoint function in `apps/client/src/services/api.js`.
- Tests: Add endpoint tests in `tests/api_routes.test.js`.

**Adding a New UI Component / Modal:**
- Implementation: Create `apps/client/src/components/NewComponent.jsx`.
- Integration: Import and render in `apps/client/src/App.jsx` or parent component.
- Styling: Use standard Tailwind utility classes conforming to the dark aesthetic.

---

*Structure analysis: 2026-10-08*
*Update after directory structure changes*
