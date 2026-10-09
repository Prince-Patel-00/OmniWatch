# REQUIREMENTS.md — v2.6 Vercel Cloud Deployment & Serverless Production

**Milestone:** v2.6 Vercel Cloud Deployment & Serverless Production  
**Status:** DRAFT (Approved for Planning)  
**Date:** 2026-10-09  

---

## 1. Scope & Objectives

Deliver a zero-friction, production-ready Vercel deployment for OmniWatch using:
1. GitHub Git integration for automated builds on push to `main`.
2. Neon Serverless PostgreSQL for persistent, pooled cloud storage.
3. Express serverless adapter (`api/index.js`) serving all REST API endpoints.
4. Vite + React client serving the responsive SPA with clean routing.
5. Vercel Cron jobs for recurring mirror health checks.

---

## 2. Functional Requirements

### REQ-VERCEL-01: Serverless Runtime & Database Decoupling
- **Description:** `apps/server/src/db.js` must conditionally load `node:sqlite` so that when running in environments where Neon Postgres is configured (`DATABASE_URL`), the server does not throw errors due to missing or unsupported native `node:sqlite` modules in serverless runtimes.
- **Acceptance Criteria:**
  - Running server with `DATABASE_URL` set works seamlessly without attempting to create local SQLite databases or importing incompatible native modules.
  - Cold starts on Vercel initialize `neonDB` correctly within 500ms.

### REQ-VERCEL-02: Deterministic Monorepo Rewrites & Static Routing
- **Description:** Configure `vercel.json` to route all `/api/(.*)` requests directly to the serverless function handler in `api/index.js`, preserve URL paths and queries, and route all frontend routes to `apps/client/dist/index.html`.
- **Acceptance Criteria:**
  - Requests to `/api/catalog`, `/api/global/trending`, `/api/auth/me`, etc., hit the Express serverless function with correct route matching.
  - Non-API routes (e.g. `/`, `/watchlist`, `/settings`) serve the client SPA bundle without 404 errors.
  - Vercel Cron `/api/mirrors/check` is properly defined and accessible.

### REQ-VERCEL-03: Cloud Neon Database Verification & Migration
- **Description:** Verify Neon PostgreSQL schema generation, seeding default administrator account `makisanis106@gmail.com`, and ensure catalog items and episode progress are preserved.
- **Acceptance Criteria:**
  - `neonDB.initDB()` runs idempotently during serverless startup if tables are not initialized.
  - Queries execute successfully over `@neondatabase/serverless` connection pool.

### REQ-VERCEL-04: Health & Diagnostics Endpoint
- **Description:** Create `/api/health` returning system status, driver in use (`neon` or `sqlite`), uptime, and latency.
- **Acceptance Criteria:**
  - `GET /api/health` returns `200 OK` with JSON `{ status: 'ok', database: 'neon', timestamp: '...' }`.

### REQ-VERCEL-05: Build Reliability & Deployment Guide
- **Description:** Monorepo root build script `npm run build` must cleanly build the client and prepare all shared workspace packages for Vercel.
- **Acceptance Criteria:**
  - `npm run build` exits with code 0 in under 15 seconds.
  - Comprehensive guide documenting required Vercel Environment Variables (`DATABASE_URL`, `TMDB_API_KEY`, `JWT_SECRET`, `NODE_ENV=production`) provided for the user.

---

## 3. Non-Functional Requirements
- **Performance:** Serverless response latency under 300ms for cached/indexed queries.
- **Security:** Secret isolation (no API keys or DB passwords hardcoded in public repository files).
- **Maintainability:** Full compatibility with existing local development workflow (`npm run dev` with SQLite or local Neon).
