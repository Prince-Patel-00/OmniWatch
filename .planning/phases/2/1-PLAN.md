---
phase: 2
plan: 1
wave: 1
gap_closure: false
---

# Plan 2.1: Vercel Monorepo Rewrites & Serverless Handler Optimization

## Objective
Optimize `vercel.json` routing configuration and harden `api/index.js` with serverless request URL normalization, ensuring all API endpoints (`/api/*`), SPA client navigation (`index.html`), and cron routes (`/api/mirrors/check`) resolve deterministically in Vercel production.

## Context
Load these files for context:
- `.planning/REQUIREMENTS.md` (REQ-VERCEL-02)
- `.planning/ROADMAP.md` (Phase 2)
- `vercel.json`
- `api/index.js`
- `apps/server/src/app.js`

## Tasks

<task type="auto">
  <name>Harden api/index.js serverless handler with URL normalization & cold-start readiness</name>
  <files>
    api/index.js
  </files>
  <action>
    Update `api/index.js` to export an async serverless handler function:
    1. Import `app` and `ensureDB` from `../apps/server/src/app.js`.
    2. Normalize `req.url` if the runtime passes stripped paths (ensure prefix `/api` is always present so Express route matching succeeds).
    3. Await `ensureDB()` to guarantee database readiness before processing the request.
    4. Delegate execution to `app(req, res)`.

    AVOID: Blindly assuming `req.url` always includes `/api` in all serverless proxy modes.
    USE: Idempotent URL normalization prefix check.
  </action>
  <verify>
    node -e "import('./api/index.js').then(m => console.log('api handler export verified:', typeof m.default))"
  </verify>
  <done>
    `api/index.js` exports an async handler function ready for Vercel Serverless invocation.
  </done>
</task>

<task type="auto">
  <name>Audit and optimize vercel.json rewrites, crons, and build settings</name>
  <files>
    vercel.json
  </files>
  <action>
    Audit and update `vercel.json`:
    1. Verify `buildCommand`: `npm run build --workspace=apps/client`.
    2. Verify `outputDirectory`: `apps/client/dist`.
    3. Verify `framework`: `vite`.
    4. Confirm deterministic rewrites:
       - `{ "source": "/api/(.*)", "destination": "/api" }`
       - `{ "source": "/(.*)", "destination": "/index.html" }`
    5. Confirm crons schedule:
       - `/api/mirrors/check` running every 6 hours (`0 */6 * * *`).
    6. Add recommended caching headers for static assets in `headers` block (1 year immutable cache for `/assets/*`).
  </action>
  <verify>
    node -e "const v = JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('Rewrites count:', v.rewrites.length, 'Crons count:', v.crons.length)"
  </verify>
  <done>
    `vercel.json` is fully valid JSON with tested rewrites, crons, and asset headers.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `api/index.js` handles both `/api/route` and `/route` inputs.
- [ ] `vercel.json` contains valid rewrites and cron job definitions.
- [ ] Client builds cleanly to `apps/client/dist`.

## Success Criteria
- [ ] `api/index.js` tested with mocked request objects.
- [ ] `vercel.json` passes JSON validation.
- [ ] `npm run build` succeeds without errors.
