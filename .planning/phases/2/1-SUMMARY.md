# Plan 2.1 Summary: Vercel Monorepo Rewrites & Serverless Handler Optimization

**Status:** COMPLETE  
**Wave:** 1  
**Executed:** 2026-10-09  

## Deliverables
1. **Serverless Handler Hardening (`api/index.js`):**
   - Implemented async `handler(req, res)` that normalizes `req.url` by restoring the `/api` prefix if stripped by upstream serverless proxies.
   - Guaranteed DB cold-start completion (`await ensureDB()`) before request routing.
2. **Serverless Socket Fallback in `apps/server/src/app.js`:**
   - Added middleware fallback ensuring `req.socket` always has `remoteAddress` so IP parsing and logger middleware (`morgan`) never throw in lambda or mock environments.
3. **Optimized `vercel.json`:**
   - Configured deterministic rewrites: `/api/(.*)` -> `/api` and SPA fallback `/(.*)` -> `/index.html`.
   - Added 1-year immutable caching headers for `/assets/(.*)`.
   - Preserved `/api/mirrors/check` cron schedule (`0 */6 * * *`).
4. **Automated Verification Suite (`tests/vercel_routing.test.js`):**
   - Verified `vercel.json` structure and rewrites.
   - Verified serverless handler serves `/api/health` and normalizes stripped `/health` paths.

## Verification Proof
- `node --test tests/vercel_routing.test.js` passes all 3 tests.
- `npm run build` succeeds in 4.37s.
