# Codebase Concerns

**Analysis Date:** 2026-10-08

## Tech Debt

**Dual-Database Maintenance (`db.js` vs `db_neon.js`):**
- Issue: Queries are maintained separately across `apps/server/src/db.js` (SQLite via `node:sqlite`) and `apps/server/src/db_neon.js` (PostgreSQL via `@neondatabase/serverless`).
- Why: Implemented to allow zero-dependency local development via SQLite without requiring a PostgreSQL installation, while supporting serverless deployment on Vercel with Neon.
- Impact: Any schema or query modification must be implemented in both drivers to prevent subtle divergence between local and cloud behavior.
- Fix approach: Adopt a lightweight typed query builder (such as Kysely) with dialect adapters for SQLite and PostgreSQL.

**Large Monolithic UI Modal (`MediaDetailModal.jsx`):**
- Issue: `MediaDetailModal.jsx` is over 80 KB in size, managing details, trailer embeds, episodes, ratings, watch providers, and review notes in a single component.
- Why: Rapid feature iteration during 2.0 release consolidated detail-view controls into one unified drawer.
- Impact: High cognitive complexity when making changes; increased chance of UI regression.
- Fix approach: Decompose into modular child components (e.g., `WatchProviderSection.jsx`, `PersonalReviewForm.jsx`, `TrailerEmbed.jsx`).

**Live In-Memory Ingestion in Provider Orchestrator:**
- Issue: `ProviderOrchestrator.js` fetches and merges results from AniList, TVMaze, Kitsu, and TMDB in memory before slicing and caching.
- Why: Normalizing heterogeneous third-party schemas and deduplicating cross-provider entities cannot easily be performed directly in SQL before records are unified.
- Impact: Memory spikes during broad searches; search latency on cold queries averages 1.5–3 seconds.
- Fix approach: Implement a background ingestion queue or cache warm-up worker for trending titles.

## Known Edge Cases & Bugs

**Node.js Experimental SQLite Warning:**
- Symptoms: Terminal outputs `# (node:XXXX) ExperimentalWarning: SQLite is an experimental feature and might change at any time` during execution.
- Trigger: Loading `node:sqlite` in Node 22 without `--no-warnings`.
- Workaround: The warning is cosmetic and functionality is reliable in Node 22 LTS; can be suppressed with `node --no-warnings`.

**External API Availability in Tests:**
- Symptoms: Integration tests in `api_routes.test.js` or `end_to_end_scenarios.test.js` may fail or run slowly if AniList GraphQL or TVMaze experience network hiccups.
- Trigger: Executing `npm test` without an active internet connection.
- Workaround: Unit tests in `provider_adapters.test.js` and `database.test.js` run completely offline, but full integration tests require internet access for live endpoints.
- Recommendation: Introduce optional fixture-backed recorded HTTP responses (e.g. using MSW or Nock) when running in offline CI environments.

**Anime Format Distinction (Movie vs Series):**
- Symptoms: Third-party APIs (AniList/Kitsu) occasionally classify anime feature films under generic "Movie" instead of "Anime" with format "Movie".
- Trigger: Importing movies originating from Japanese animation studios.
- Workaround: Normalizer and database migration scripts enforce that any item with provider prefix `omni_ani_` or `omni_kitsu_` is categorized as `media_type = 'Anime'` and `format = 'Movie'`.

## Security Considerations

**Dynamic Mirror Registry Links:**
- Risk: Community streaming and download mirrors link to third-party domains which could change ownership, serve ads, or become malicious over time.
- Current mitigation: OmniWatch does not embed, host, or scrape video streams directly. It only resolves domain URLs and displays them to the user. `mirrorHealthService.js` conducts domain probing with timeouts and handles latency measurements.
- Recommendations: Maintain strict URL sanitization and ensure links always open in new tabs with `rel="noopener noreferrer"`.

**Database File Protection:**
- Risk: Personal viewing notes, watchlist records, and database backups stored locally could be exposed if committed to public repositories.
- Current mitigation: `apps/server/data/omniwatch.db`, WAL, and SHM files are explicitly included in `.gitignore`.

**SQL Injection Safeguards:**
- Current mitigation: Parameterized SQL statements (`prepare().run(...)`) are used throughout `db.js`.
- Rules: Never interpolate user-supplied strings directly into raw SQL query strings.

## Performance Bottlenecks

**Cold Multi-Provider Queries:**
- Problem: Cold multi-provider queries take 1.5 to 3 seconds on first search.
- Cause: HTTP requests to multiple distinct international APIs (AniList GraphQL, TVMaze REST, Kitsu JSON:API, TMDB REST) must resolve before deduplication.
- Improvement path: Leverage the 48-hour SQLite cache for repeat queries and acronym hits; show instant optimistic results from local database cache before streaming in remote additions.

**SQLite Database Concurrency & WAL Checkpoints:**
- Problem: Concurrent writes from multiple processes can lock SQLite if WAL mode is disabled.
- Current status: WAL mode (`PRAGMA journal_mode = WAL;`) and `PRAGMA busy_timeout = 5000;` are configured, resolving concurrency bottlenecks. Tests enforce sequential execution (`--test-concurrency=1`).

## Fragile Areas

**Entity Deduplication Heuristics:**
- Why fragile: Title matching must merge identical anime or Western shows with different naming conventions (e.g., "Attack on Titan" vs "Shingeki no Kyojin") while strictly avoiding merging separate seasons (e.g., Season 1 vs Season 2) or different shows with similar names.
- Common failures: Redundant season cards appearing or two distinct adaptations mistakenly coalescing.
- Safe modification: Any change to `areSameEntity()`, `getNormalizedTitleVariants()`, or `cleanTitleForMatch()` in `ProviderOrchestrator.js` must be verified against `tests/orchestrator_dedup.test.js` and `tests/seasons_multi_count.test.js`.

**Multi-Season Progress Tracking:**
- Why fragile: Tracking user watch progress across seasons with varying episode counts requires synchronized updates between `catalog_items` and `catalog_episode_progress`.
- Safe modification: Always execute updates within database transactions; verify with `tests/seasons_completion.test.js`.

---

*Concerns analysis: 2026-10-08*
*Update as technical debt is resolved or discovered*
