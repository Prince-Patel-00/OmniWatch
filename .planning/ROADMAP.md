# ROADMAP.md — OmniWatch 2.6 Vercel Cloud Deployment Plan

**Status:** APPROVED  
**Architecture Spec:** `.gsd/SPEC.md` & `.planning/REQUIREMENTS.md`  
**Execution Methodology:** Get Shit Done (GSD) Atomic Phase Waves  
**Current Milestone:** v2.6 Vercel Cloud Deployment & Serverless Production  
**Date:** 2026-10-09  

---

## Milestone Goal

Deploy OmniWatch to Vercel as a scalable, serverless full-stack web application integrated with GitHub, Neon Serverless PostgreSQL, Vite SPA client distribution, and automated cron mirror health monitoring.

---

## Phase Matrix

| Phase | Title | Primary Components | Dependencies | Target Artifacts |
|---|---|---|---|---|
| **Phase 1** | Serverless Database & Runtime Hardening | `db.js`, `db_neon.js`, `app.js` | None | ✅ Complete (Verified 110/110 tests) |
| **Phase 2** | Vercel Monorepo Rewrites & Serverless Handler | `vercel.json`, `api/index.js`, `package.json` | Phase 1 | ✅ Complete (Verified routing & build) |
| **Phase 3** | Cloud Health Check, Security & Environment Secrets | `systemRoutes.js`, `auth.js`, `.env.example` | Phase 1, Phase 2 | `/api/health` endpoint, JWT secret hardening, secrets documentation |
| **Phase 4** | Build Verification, Smoke Tests & Vercel Launch Guide | Full Repo, GitHub Integration | Phase 1, 2, 3 | Clean `npm run build`, smoke test script, GitHub-to-Vercel onboarding guide |

---

## Detailed Phase Breakdown

### Phase 1: Serverless Database & Runtime Hardening
**Goal:** Safeguard the Express backend against serverless environment constraints by making `node:sqlite` dynamically imported when running locally, while prioritizing Neon Serverless PostgreSQL (`@neondatabase/serverless`) without native module dependency errors in cloud runtimes.

- **Wave 1: Conditional SQLite Loading & Driver Isolation**
  - **Task 1.1:** Refactor `apps/server/src/db.js` to dynamically load `DatabaseSync` only when `isNeon()` is false (local SQLite mode). When `DATABASE_URL` is present, route queries cleanly to `apps/server/src/db_neon.js` without loading SQLite native libraries.
  - **Task 1.2:** Verify that running in Neon mode (`DATABASE_URL` configured) does not trigger filesystem write operations or fail in read-only serverless filesystems.
- **Wave 2: Cold-Start Connection & Schema Verification**
  - **Task 1.3:** Verify `initDB()` in `apps/server/src/app.js` handles serverless cold starts gracefully with pooled Neon connections and cached schema check.
- **Verification Proof:**
  - Server boots and passes queries with `DATABASE_URL` set without calling or importing `node:sqlite`.
  - Local tests run successfully against both drivers.

---

### Phase 2: Vercel Monorepo Rewrites & Serverless Handler
**Goal:** Optimize `vercel.json` and `api/index.js` to ensure reliable monorepo routing, static client delivery, API route resolution, and cron job execution.

- **Wave 1: Monorepo Build & Output Configuration**
  - **Task 2.1:** Verify `vercel.json` configuration for Vite monorepo: `buildCommand`: `npm run build --workspace=apps/client`, `outputDirectory`: `apps/client/dist`.
  - **Task 2.2:** Verify Express route handler in `api/index.js` correctly forwards requests to `apps/server/src/app.js` while preserving `/api/*` subroutes and query parameters.
- **Wave 2: SPA Rewrites & Cron Verification**
  - **Task 2.3:** Ensure client routes (such as `/watchlist`, `/settings`, `/details/:id`) correctly rewrite to `/index.html` without conflicting with `/api/(.*)`.
  - **Task 2.4:** Validate cron schedule configuration in `vercel.json` for `/api/mirrors/check`.
- **Verification Proof:**
  - `npm run build` generates production assets in `apps/client/dist`.
  - Route simulation confirms `/api/*` hits serverless Express handler and non-api routes hit `index.html`.

---

### Phase 3: Cloud Health Check, Security & Environment Secrets
**Goal:** Provide visibility into live cloud deployments, ensure auth secrets are strictly validated, and document all production environment variables.

- **Wave 1: Healthcheck & Diagnostics Endpoint**
  - **Task 3.1:** Implement `GET /api/health` in `apps/server/src/routes/systemRoutes.js` (or root route) returning status: `ok`, database: `neon` / `sqlite`, latency, and timestamp.
  - **Task 3.2:** Ensure unhandled DB connection failures return structured JSON errors with 500 status rather than hanging serverless requests.
- **Wave 2: Production Security & Secret Hardening**
  - **Task 3.3:** Ensure `JWT_SECRET` in `apps/server/src/auth.js` enforces a robust production fallback or warning when running in `NODE_ENV=production`.
  - **Task 3.4:** Create `.env.example` documenting all mandatory Vercel environment variables: `DATABASE_URL`, `TMDB_API_KEY`, `JWT_SECRET`, `NODE_ENV`.
- **Verification Proof:**
  - `GET /api/health` returns `200 OK` with JSON diagnostics.
  - `.env.example` contains complete production template with zero secret leaks.

---

### Phase 4: Build Verification, Smoke Tests & Vercel Launch Guide
**Goal:** Validate all production builds, execute automated smoke tests, and produce a complete guide for linking the GitHub repository in the Vercel Dashboard.

- **Wave 1: Production Build & Monorepo Test Suite**
  - **Task 4.1:** Run full test suite (`npm test`) and Vite client build (`npm run build`).
  - **Task 4.2:** Test serverless function invocation locally using mock request/response handler.
- **Wave 2: GitHub-to-Vercel Deployment Guide**
  - **Task 4.3:** Create a clear deployment manual `VERCEL_DEPLOYMENT.md` detailing:
    1. Importing `Prince-Patel-00/OmniWatch` into Vercel Dashboard.
    2. Setting Project Root, Build Command, and Output Directory.
    3. Configuring Environment Variables in Vercel settings.
    4. Post-deployment smoke check list.
- **Verification Proof:**
  - Client build passes in < 10 seconds.
  - Smoke tests pass.
  - Deployment guide complete and verified.
