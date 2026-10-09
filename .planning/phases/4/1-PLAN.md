---
phase: 4
plan: 1
wave: 1
gap_closure: false
---

# Plan 4.1: Production Build Verification, Smoke Tests & Vercel Launch Guide

## Objective
Execute final production build validations across all workspaces, run the complete regression and serverless test suites, and produce a comprehensive, step-by-step GitHub-to-Vercel onboarding and verification manual (`VERCEL_DEPLOYMENT.md`).

## Context
Load these files for context:
- `.planning/REQUIREMENTS.md` (REQ-VERCEL-05)
- `.planning/ROADMAP.md` (Phase 4)
- `vercel.json`
- `.env.example`
- `package.json`

## Tasks

<task type="auto">
  <name>Run full automated test suite and production build verification</name>
  <files>
    apps/client/dist
    tests/*.test.js
  </files>
  <action>
    1. Execute `npm run build` to verify clean production compilation of the Vite client into `apps/client/dist`.
    2. Run the complete automated test suite (`npm test` including `tests/serverless_db_driver.test.js` and `tests/vercel_routing.test.js`).
    3. Confirm 100% passing tests with 0 failures or warnings.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    `npm run build` succeeds in < 10 seconds and test suite passes.
  </done>
</task>

<task type="auto">
  <name>Create comprehensive VERCEL_DEPLOYMENT.md deployment guide</name>
  <files>
    VERCEL_DEPLOYMENT.md
  </files>
  <action>
    Create a complete, step-by-step deployment guide `VERCEL_DEPLOYMENT.md` covering:
    1. **Pre-requisites:** GitHub repository (`Prince-Patel-00/OmniWatch`), Neon PostgreSQL database, TMDB API Key.
    2. **Connecting to Vercel:**
       - Step-by-step import from Vercel Dashboard (Add New Project -> Import Git Repository).
       - Framework Preset: `Vite`.
       - Root Directory: `./` (leave default repository root).
       - Build Command: `npm run build --workspace=apps/client` (configured in `vercel.json`).
       - Output Directory: `apps/client/dist`.
    3. **Environment Variables Configuration:**
       - Exact table with `DATABASE_URL`, `TMDB_API_KEY`, `JWT_SECRET`, `NODE_ENV=production`, `DEFAULT_STREAMING_REGION=US`.
    4. **Post-Deployment Smoke Verification:**
       - Checking `/api/health` for 200 OK + database connected.
       - Testing UI loading, catalog login with `makisanis106@gmail.com` / `OutCast106`.
       - Checking Vercel Cron jobs tab for `/api/mirrors/check`.
    5. **Troubleshooting & FAQs:**
       - Cold start behavior, connection pooling, and CORS verification.
  </action>
  <verify>
    node -e "import fs from 'node:fs'; console.log('VERCEL_DEPLOYMENT.md size:', fs.statSync('VERCEL_DEPLOYMENT.md').size)"
  </verify>
  <done>
    `VERCEL_DEPLOYMENT.md` exists, provides actionable instructions, and is committed to root.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Production build succeeds without errors.
- [ ] Complete automated tests pass.
- [ ] `VERCEL_DEPLOYMENT.md` exists at root.

## Success Criteria
- [ ] Zero build warnings or errors.
- [ ] Actionable, clear deployment documentation.
