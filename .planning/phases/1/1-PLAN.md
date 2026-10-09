---
phase: 1
plan: 1
wave: 1
gap_closure: false
---

# Plan 1.1: Dynamic SQLite Decoupling & Serverless Isolation

## Objective
Safeguard the Express backend against serverless environment constraints on Vercel by decoupling `node:sqlite`. When running in cloud mode with Neon PostgreSQL (`DATABASE_URL`), the server must never load `node:sqlite` or perform local filesystem mutations (`fs.mkdirSync`), preventing serverless cold-start crashes.

## Context
Load these files for context:
- `.planning/REQUIREMENTS.md` (REQ-VERCEL-01)
- `.planning/ROADMAP.md` (Phase 1)
- `apps/server/src/db.js`
- `apps/server/src/db_neon.js`
- `apps/server/src/app.js`

## Tasks

<task type="auto">
  <name>Decouple node:sqlite with conditional lazy loading in db.js</name>
  <files>
    apps/server/src/db.js
  </files>
  <action>
    Refactor `apps/server/src/db.js` to isolate SQLite dependencies:
    1. Remove static top-level `import { DatabaseSync } from 'node:sqlite'`.
    2. Implement lazy or dynamic loading:
       - Maintain `let DatabaseSync = null;`
       - Inside `getDB()`, if `!DatabaseSync`, dynamically import or require `node:sqlite` within a try/catch block.
       - If `node:sqlite` is unavailable (e.g., in serverless runtime), provide a descriptive error indicating that `DATABASE_URL` is required for Neon PostgreSQL in cloud environments.
    3. Ensure `DATA_DIR` filesystem checks (`fs.mkdirSync`) and local file paths are strictly enclosed within `getDB()`, so when `isNeon()` is true, no local filesystem directories (`../data`) or database files (`omniwatch.db`) are created or queried.
    4. Guard all repository functions in `db.js` to route immediately to `neonDB.*` without touching SQLite state.

    AVOID: Static top-level imports of `node:sqlite` because they crash Vercel lambdas running on Node runtimes without `node:sqlite` or where native C++ SQLite bindings are missing.
    USE: Lazy-loaded SQLite module reference initialized only upon invocation of `getDB()`.
  </action>
  <verify>
    node -e "process.env.DATABASE_URL='postgresql://dummy:pass@localhost:5432/db'; import('./apps/server/src/db.js').then(m => console.log('isNeon:', m.isNeon()))"
  </verify>
  <done>
    `apps/server/src/db.js` imports cleanly in pure ESM without loading `node:sqlite` when `DATABASE_URL` is set, and `isNeon()` returns `true`.
  </done>
</task>

<task type="auto">
  <name>Ensure read-only filesystem safety and serverless startup stability</name>
  <files>
    apps/server/src/db.js
    apps/server/src/app.js
  </files>
  <action>
    Audit and harden serverless environment execution:
    1. In `apps/server/src/app.js`, verify `ensureDB()` handles asynchronous initialization cleanly:
       - Cache `dbInitPromise` so concurrent incoming serverless requests share a single initialization resolution.
       - Log clear database connectivity status on startup: `[DB] Running on Neon PostgreSQL (Serverless)` vs `[DB] Running on Local SQLite`.
    2. In `apps/server/src/db.js`, verify `initDB()`:
       - When `isNeon()` is true, delegates to `neonDB.initDB()` and returns the promise.
       - Ensures zero write operations to the local filesystem in cloud mode.

    AVOID: Repeated schema migrations or parallel connection storms on every incoming serverless request.
    USE: Memoized `dbInitPromise` across warm serverless invocations.
  </action>
  <verify>
    node -e "import('./apps/server/src/app.js').then(async m => { await m.ensureDB(); console.log('DB ensureDB succeeded'); })"
  </verify>
  <done>
    Server initializes database connection without crashing and memoizes initialization promise.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `node:sqlite` is never loaded into memory when `DATABASE_URL` is configured.
- [ ] Local SQLite operation remains 100% backward compatible for development and test suites.

## Success Criteria
- [ ] No static top-level import of `node:sqlite` in `apps/server/src/db.js`.
- [ ] Dynamic import loads only on demand when `isNeon()` is false.
- [ ] Existing database tests continue to pass with zero regressions.
