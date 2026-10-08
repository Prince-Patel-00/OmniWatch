# Coding Conventions

**Analysis Date:** 2026-10-08

## Naming Patterns

**Files:**
- React components: `PascalCase.jsx` (e.g., `apps/client/src/components/MediaCard.jsx`, `EpisodeGuide.jsx`).
- Backend routes: `camelCaseRoutes.js` (e.g., `apps/server/src/routes/catalogRoutes.js`).
- Provider classes & services: `PascalCaseProvider.js` or `camelCaseService.js` (e.g., `AniListProvider.js`, `mirrorHealthService.js`).
- Test files: `snake_case.test.js` in `tests/` directory (e.g., `api_routes.test.js`, `seasons_completion.test.js`).
- Shared utilities: `camelCase.js` (e.g., `packages/shared/src/constants.js`).

**Functions & Methods:**
- camelCase for all function names (e.g., `getCanonicalMedia`, `toggleEpisodeProgress`, `batchCompleteSeason`, `formatDate`).
- Handler callbacks in React: `handle*` (e.g., `handleOpenDetail`, `handleQuickIncrementEpisode`, `handleStatusChange`).
- Boolean checks: `is*` or `has*` (e.g., `isNeon()`, `isWatched`, `hasMore`).

**Variables & Constants:**
- Local variables and state: `camelCase` (e.g., `searchQuery`, `currentView`, `activeRequestIdRef`).
- Global constants and enums: `UPPER_SNAKE_CASE` (e.g., `MEDIA_TYPES`, `USER_WATCH_STATUSES`, `DEFAULT_MIRROR_REGISTRY`, `ACRONYM_MAP`).

## Code Style

**Formatting:**
- ES Modules (`import`/`export`) required across all packages.
- Always include explicit file extensions in imports (e.g., `import app from './app.js'`, `import { normalizeTitle } from '@omniwatch/shared'`).
- Semicolons: Required and consistently used.
- Quotes: Single quotes for JavaScript strings, double quotes for JSX attributes.
- Indentation: 2 spaces.

**Linting & Validation:**
- Validate using `npm run lint` and `npm test`.
- Monorepo package references use workspace protocol (`@omniwatch/shared: "*"`).

## Import Organization

**Order:**
1. Node.js built-in modules (`node:fs`, `node:path`, `node:sqlite`, `node:test`, `node:assert/strict`).
2. Third-party packages (`react`, `express`, `cors`, `lucide-react`, `nanoid`).
3. Monorepo workspace packages (`@omniwatch/shared`).
4. Internal relative imports (`./db.js`, `./providers/AniListProvider.js`, `../components/Navbar.jsx`).

**Example:**
```javascript
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { normalizeTitle } from '@omniwatch/shared';
import { initDB, isNeon } from './db.js';
```

## Error Handling

**REST API Boundary:**
- Route handlers wrap asynchronous code in `try ... catch` blocks.
- Consistent JSON response contract:
  - Success: `res.json({ success: true, data: result, ...metadata })`
  - Client error: `res.status(400).json({ success: false, error: 'Validation message' })`
  - Not found: `res.status(404).json({ success: false, error: 'Entity not found' })`
  - Internal server error: `res.status(500).json({ success: false, error: err.message })`
- Global error fallback middleware in `apps/server/src/app.js` catches any unhandled errors.

**Provider Resilience:**
- External provider calls use `Promise.allSettled` or isolated `try ... catch` wrappers to prevent one slow or failing API from disrupting others.
- Failures in third-party metadata fetching log warnings but return cached or partial data.

**Database Operations:**
- Multi-statement mutations (e.g., toggling an episode and updating catalog item status) run inside database transactions (`db.exec('BEGIN TRANSACTION')` ... `COMMIT`).
- Rollback cleanly in `catch` blocks before re-throwing or reporting errors.

## React & Frontend Patterns

**Component Architecture:**
- Pure functional React components using hooks.
- Decoupled state management between `Global Discovery` and `My Catalog` to eliminate async race conditions.
- Stale request guard pattern using `useRef(activeRequestId)` to discard out-of-order search responses.
- Lucide React icons used for consistent visual language.
- Styling via Tailwind CSS utility classes: dark mode default (`bg-slate-900`, `text-slate-100`, `border-slate-800`), with purple/indigo/violet accents.

## Database Querying Patterns

**SQLite (`node:sqlite`):**
- Use parameterized queries with `db.prepare(...).run(...)` or `.all(...)` to protect against SQL injection.
- Store complex nested structures (genres, studios, creators, networks) as stringified JSON in `TEXT` columns (`genres_json`, `networks_json`).
- Parse JSON safely on hydration.
- WAL mode is mandatory for local concurrency.

---

*Conventions analysis: 2026-10-08*
*Update after coding standard updates*
