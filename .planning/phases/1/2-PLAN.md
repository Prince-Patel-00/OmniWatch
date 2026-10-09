---
phase: 1
plan: 2
wave: 2
gap_closure: false
depends_on:
  - 1.1
---

# Plan 1.2: Serverless Neon Cold-Start & Health Verification

## Objective
Verify Neon PostgreSQL connection pooling, schema auto-initialization, and cold-start resilience under serverless conditions, establishing automated verification tests that validate both Neon routing and local SQLite regression safety.

## Context
Load these files for context:
- `.planning/REQUIREMENTS.md` (REQ-VERCEL-01, REQ-VERCEL-03)
- `.planning/phases/1/1-PLAN.md`
- `apps/server/src/db_neon.js`
- `apps/server/src/app.js`
- `tests/database.test.js`

## Tasks

<task type="auto">
  <name>Verify Neon connection resilience and cold-start schema caching</name>
  <files>
    apps/server/src/db_neon.js
  </files>
  <action>
    Harden Neon PostgreSQL initialization:
    1. In `apps/server/src/db_neon.js`, ensure `getSql()` reuses the pooled `sqlClient` across serverless lambdas.
    2. Add schema initialization idempotency flag (`let schemaInitialized = false`) so subsequent invocations in warm serverless containers skip redundant `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX` queries.
    3. Ensure error logging clearly distinguishes network/timeout errors from SQL syntax or permission errors.

    AVOID: Running 10+ DDL migration statements on every serverless function execution.
    USE: In-memory `schemaInitialized` boolean flag to guarantee DDL runs only once per serverless instance lifecycle.
  </action>
  <verify>
    node -e "import('./apps/server/src/db_neon.js').then(m => console.log('db_neon export verified'))"
  </verify>
  <done>
    `initDB()` in `db_neon.js` executes DDL on initial cold start and skips redundant execution on warm requests.
  </done>
</task>

<task type="auto">
  <name>Create automated test suite for database driver isolation and regression safety</name>
  <files>
    tests/serverless_db_driver.test.js
  </files>
  <action>
    Create a dedicated test suite `tests/serverless_db_driver.test.js` to empirically validate:
    1. Driver selection:
       - When `DATABASE_URL` is set, `isNeon()` returns `true`.
       - When `USE_SQLITE=1` is set, `isNeon()` returns `false` regardless of `DATABASE_URL`.
    2. Zero-SQLite leakage in Neon mode:
       - Validate that importing `apps/server/src/db.js` in a mocked serverless environment with `DATABASE_URL` set does NOT instantiate or require `node:sqlite`.
    3. Full backward compatibility:
       - Verify local SQLite operations (`saveCanonicalMedia`, `upsertCatalogItem`, `getCatalogItems`) work identically when running in SQLite mode.
    4. Run full test suite (`npm test`) to guarantee zero regressions across all 15 existing test suites.
  </action>
  <verify>
    node --test tests/serverless_db_driver.test.js
  </verify>
  <done>
    All assertions in `tests/serverless_db_driver.test.js` pass, and `npm test` runs with 0 failures.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Schema DDL in `db_neon.js` is executed only once per process lifecycle.
- [ ] `tests/serverless_db_driver.test.js` passes.
- [ ] `npm test` passes without errors.

## Success Criteria
- [ ] Cold-start schema caching implemented.
- [ ] Database driver selection tested and verified.
- [ ] Zero regressions across existing test suites.
