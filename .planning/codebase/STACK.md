# Technology Stack

**Analysis Date:** 2026-10-08

## Languages

**Primary:**
- JavaScript (ES Modules) - All frontend application code (`apps/client/src/**/*.jsx`, `*.js`), backend server code (`apps/server/src/**/*.js`), and shared domain library (`packages/shared/src/**/*.js`).
- JSX - React UI component rendering in `apps/client/src/components/*.jsx` and `apps/client/src/App.jsx`.

**Secondary:**
- TypeScript - Auxiliary configuration and migration scripts (`neon.ts`, `@neon/config`).
- HTML5 / CSS3 - Tailwind utility classes and CSS entry points (`apps/client/src/index.css`).
- PowerShell / Bash - Tooling validation and repository scripts in `scripts/*.ps1`, `scripts/*.sh`.

## Runtime

**Environment:**
- Node.js 22 LTS (`v22.16.0` verified) - Required for native experimental `node:sqlite` (`DatabaseSync`) and native `process.loadEnvFile()`.
- Modern Evergreen Web Browsers - Modern JavaScript and CSS features for the React SPA.

**Package Manager:**
- npm (workspaces enabled)
- Monorepo layout: `packages/*`, `apps/*`
- Lockfile: `package-lock.json` present and versioned.

## Frameworks

**Core:**
- Express 4.21.2 - REST API server in `apps/server/src/app.js` and `api/index.js`.
- React 18.3.1 / React DOM 18.3.1 - Reactive Single Page Application in `apps/client`.
- Vite 6.0.7 - Client build tooling, development server with HMR, and production bundling.

**Testing:**
- Native Node.js Test Runner (`node:test`) - Zero external test framework dependencies.
- Native Node Assert (`node:assert/strict`) - Invariant assertions and unit test assertions.
- Concurrency: `node --test --test-concurrency=1 tests/*.test.js`.

**Build/Dev:**
- Tailwind CSS 3.4.17 + PostCSS 8.4.49 + Autoprefixer 10.4.20 - Atomic CSS styling.
- `@vitejs/plugin-react` 4.3.4 - Fast React JSX transformation.
- `concurrently` 9.1.2 - Parallel execution of client and server in `npm run dev`.

## Key Dependencies

**Critical:**
- `node:sqlite` (Node standard library `DatabaseSync`) - Local zero-latency relational persistence with WAL mode in `apps/server/src/db.js`.
- `@neondatabase/serverless` 1.2.0 - Serverless PostgreSQL client used for cloud deployment and Neon database branches in `apps/server/src/db_neon.js`.
- `lucide-react` 1.16.0 - Icon set used across media cards, navigation, modals, and status badges.
- `nanoid` 5.0.9 - Generation of unique IDs for canonical records, mirror sources, and backups.

**Infrastructure & Middleware:**
- `cors` 2.8.5 - Cross-Origin Resource Sharing handling.
- `morgan` 1.10.0 - HTTP request logging in development.

## Configuration

**Environment:**
- Server loads variables via native `process.loadEnvFile` from `.env` or `apps/server/.env`.
- Key variables:
  - `PORT`: Server HTTP port (default `5000`).
  - `NODE_ENV`: Runtime environment (`development` | `production`).
  - `OMNIWATCH_DB_PATH`: Custom path to SQLite file (default `apps/server/data/omniwatch.db`).
  - `DATABASE_URL` / `POSTGRES_URL`: Neon PostgreSQL connection string (triggers Postgres mode).
  - `TMDB_API_KEY`: The Movie Database API key (optional; unlocks TMDB movies and JustWatch availability).
  - `DEFAULT_STREAMING_REGION`: ISO country code for streaming provider resolution (default `US`).

**Build & Deployment:**
- `package.json`: Root workspaces definition and orchestrator scripts.
- `apps/client/vite.config.js`: Vite dev server and proxy/build setup.
- `apps/client/tailwind.config.js`: Tailwind theme styling and content paths.
- `vercel.json`: Serverless rewrites `/api/(.*) -> /api` and client SPA static bundle deployment, plus cron schedule for mirror checks.

## Platform Requirements

**Development:**
- Windows, macOS, or Linux with Node.js 22 LTS or newer.
- No external database installation required for local development (uses bundled SQLite).

**Production:**
- Vercel Serverless deployment (Node.js runtime + Neon PostgreSQL).
- Alternatively, standalone container or VPS running Node 22 with persistent volume for SQLite `omniwatch.db`.

---

*Stack analysis: 2026-10-08*
*Update after major dependency changes*
