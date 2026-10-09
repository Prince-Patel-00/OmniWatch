---
phase: 3
plan: 1
wave: 1
gap_closure: false
---

# Plan 3.1: Cloud Health Check, Security & Environment Secrets

## Objective
Provide comprehensive cloud observability by upgrading `/api/health` with live DB ping and latency reporting, harden JWT authentication secrets for production cloud execution, and create a complete `.env.example` template for Vercel Environment Variables.

## Context
Load these files for context:
- `.planning/REQUIREMENTS.md` (REQ-VERCEL-03, REQ-VERCEL-04)
- `.planning/ROADMAP.md` (Phase 3)
- `apps/server/src/app.js`
- `apps/server/src/auth.js`
- `.env`

## Tasks

<task type="auto">
  <name>Upgrade /api/health with active DB latency ping and structured status codes</name>
  <files>
    apps/server/src/app.js
  </files>
  <action>
    Enhance the `/api/health` route in `apps/server/src/app.js`:
    1. Probe database connectivity via `await ensureDB()`.
    2. Measure latency in milliseconds.
    3. Return structured JSON with:
       - `status`: `'ok'` (HTTP 200) or `'degraded'` (HTTP 503 if DB fails).
       - `database`: engine name, status (`'connected'` or `'disconnected'`), `latencyMs`, `error`.
       - `environment`: `process.env.NODE_ENV || 'development'`.
       - `timestamp`: ISO timestamp.
  </action>
  <verify>
    node -e "fetch('http://localhost:5000/api/health').then(r => r.json()).then(d => console.log('Health status:', d.status, 'DB:', d.database.status, 'Latency:', d.database.latencyMs))"
  </verify>
  <done>
    `GET /api/health` returns HTTP 200 with active DB ping and latency metrics.
  </done>
</task>

<task type="auto">
  <name>Harden JWT secret configuration & create .env.example production template</name>
  <files>
    apps/server/src/auth.js
    .env.example
  </files>
  <action>
    1. In `apps/server/src/auth.js`:
       - Accept either `JWT_SECRET` or `AUTH_JWT_SECRET` from environment variables.
       - If `NODE_ENV === 'production'` and neither secret is defined, log a security advisory warning while falling back safely.
    2. Create `.env.example` in repository root:
       - Document all mandatory and optional Vercel variables:
         - `DATABASE_URL` (Required: Neon PostgreSQL pooled connection string)
         - `TMDB_API_KEY` (Required: TMDB v3 API Key for movies/shows metadata)
         - `JWT_SECRET` (Required: 32+ character random hex or base64 secret)
         - `NODE_ENV` (`production`)
         - `DEFAULT_STREAMING_REGION` (`US`)
         - `PORT` (`5000` for local dev)
  </action>
  <verify>
    node -e "import fs from 'node:fs'; console.log('.env.example exists:', fs.existsSync('.env.example'))"
  </verify>
  <done>
    `auth.js` supports standard `JWT_SECRET` and `.env.example` is documented with zero real secrets exposed.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `/api/health` reports status, engine, and latency.
- [ ] `apps/server/src/auth.js` checks both `JWT_SECRET` and `AUTH_JWT_SECRET`.
- [ ] `.env.example` provides complete template for Vercel deployment without leaking production credentials.

## Success Criteria
- [ ] `/api/health` verified via test suite.
- [ ] `.env.example` created and committed.
