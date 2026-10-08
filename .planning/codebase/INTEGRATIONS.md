# External Integrations

**Analysis Date:** 2026-10-08

## APIs & External Services

**AniList GraphQL:**
- What it's used for: Live anime trending, search, airing countdowns, native Japanese & Romaji titles, genres, studio credits, and character casting.
- Integration method: HTTP POST with GraphQL query payload to `https://graphql.anilist.co`.
- Client: Native `fetch` in `apps/server/src/providers/AniListProvider.js`.
- Auth: None (public open API).
- Caching: 48-hour TTL in SQLite/Postgres `cached_media` table.

**TVMaze REST API:**
- What it's used for: Western TV series discovery, multi-season hierarchy, episode breakdowns with runtimes, air dates, and episode stills.
- Integration method: REST API via `https://api.tvmaze.com/shows/{id}` and `/search/shows?q=`.
- Client: Native `fetch` in `apps/server/src/providers/TVMazeProvider.js`.
- Auth: None (public open API).
- Caching: Relational storage in `media_seasons` and `media_episodes`.

**Kitsu JSON:API:**
- What it's used for: Anime search supplementation, YouTube trailer video keys, alternative poster/backdrop art, and episode counts.
- Integration method: JSON:API format via `https://kitsu.io/api/edge/anime`.
- Client: Native `fetch` in `apps/server/src/providers/KitsuProvider.js`.
- Auth: None (public open API).

**The Movie Database (TMDB) API v3:**
- What it's used for: Western movies, global multi-category search, cast/creator credits, and verified legal streaming availability (powered by JustWatch).
- Integration method: REST API via `https://api.themoviedb.org/3`.
- Client: Native `fetch` in `apps/server/src/providers/TMDBProvider.js`.
- Auth: Query param `api_key` or Bearer header via `TMDB_API_KEY` env var.
- Fallback / Graceful degradation: Dormant when `TMDB_API_KEY` is omitted; OmniWatch continues functioning using AniList, TVMaze, and Kitsu.

**YouTube Embedded Player:**
- What it's used for: In-modal official trailer video playback.
- Implementation: Privacy-enhanced iframe embedding using `https://www.youtube-nocookie.com/embed/{videoKey}` with fallback to standard `https://www.youtube.com/watch?v={videoKey}`.
- Component: `apps/client/src/components/TrailerModal.jsx`.

## Data Storage

**Local Relational Database (Default):**
- Engine: SQLite via Node.js standard library `node:sqlite` (`DatabaseSync`).
- Location: `apps/server/data/omniwatch.db` (overrideable with `OMNIWATCH_DB_PATH`).
- Mode: Write-Ahead Logging (`PRAGMA journal_mode = WAL;`), `PRAGMA synchronous = NORMAL;`, `PRAGMA foreign_keys = ON;`.
- Tables:
  - `cached_media`: Normalized global entity cache (titles, genres, ratings, status, format).
  - `media_provider_mappings`: Cross-reference table mapping canonical IDs to external provider IDs.
  - `media_seasons` & `media_episodes`: Granular season and episode metadata.
  - `media_trailers`: Video keys and sources for trailers.
  - `media_watch_providers`: Official regional watch providers (Subscription, Rent, Buy, Free).
  - `catalog_items`: Personal watchlist items with user status, ratings, notes, and tags.
  - `catalog_episode_progress`: Persistent per-episode watched checkmarks.
  - `mirror_sources`: Dynamic community streaming and download mirror registry.

**Cloud / Serverless Database (Optional):**
- Engine: Neon Serverless PostgreSQL.
- Driver: `@neondatabase/serverless` in `apps/server/src/db_neon.js`.
- Activation: Activated automatically when `DATABASE_URL` or `POSTGRES_URL` is detected in the environment via `isNeon()` check in `apps/server/src/db.js`.

## Dynamic Mirror Registry & Probing

**Community Mirror Providers:**
- Purpose: Provides streaming and download quick-links for media.
- Storage: Dynamic table `mirror_sources` with fallback constants in `packages/shared/src/constants.js`.
- Health Probing: `apps/server/src/services/mirrorHealthService.js` conducts periodic HTTP HEAD/GET latency checks (`probeDomain()`) to measure response times and detect blocked or dead domains.
- Automatic Domain Migration: Automatically switches `current_domain` when primary domain goes offline to an available backup in `candidate_domains`.
- Automated Cron: Scheduled via `vercel.json` every 6 hours hitting `/api/mirrors/check`.

## Authentication & Identity

**Current Model:**
- Single-user / local personal vault architecture.
- No third-party OAuth or login requirement for local use.
- Catalog data is stored directly in the SQLite / Postgres database instance.
- Data export & import via JSON backup snapshots (`BackupModal.jsx` and `/api/catalog/backup`).

## CI/CD & Deployment

**Hosting:**
- Production Target: Vercel Serverless.
- Frontend: Static Vite build output served from `apps/client/dist`.
- Backend: Vercel serverless function entry in `api/index.js` routing to Express app (`apps/server/src/app.js`).
- Routing rules: Configured in `vercel.json` with URL rewrites `/api/(.*) -> /api` and SPA fallback `/(.*) -> /index.html`.

## Environment Configuration

**Server Environment Variables (`.env` or `apps/server/.env`):**
- `PORT`: HTTP port for Express server (default `5000`).
- `NODE_ENV`: `development` or `production`.
- `OMNIWATCH_DB_PATH`: Custom path to SQLite file.
- `TMDB_API_KEY`: API token for TMDB (optional).
- `DEFAULT_STREAMING_REGION`: ISO country code for JustWatch region (e.g., `US`, `GB`, `IN`).
- `DATABASE_URL` / `POSTGRES_URL`: PostgreSQL connection string (activates Neon mode).

---

*Integration analysis: 2026-10-08*
*Update after external API or storage changes*
