# Testing Patterns

**Analysis Date:** 2026-10-08

## Test Framework

**Runner:**
- Node.js native test runner (`node:test`).
- Built directly into Node.js 22 LTS without third-party test framework overhead (no Jest, Vitest, or Mocha required).

**Assertion Library:**
- Node.js native strict assertion module (`node:assert/strict`).
- Common assertions: `assert.equal`, `assert.strictEqual`, `assert.deepEqual`, `assert.ok`.

**Run Commands:**
```bash
# Run all automated test suites
npm test

# Run underlying command directly
node --test --test-concurrency=1 tests/*.test.js

# Run a specific test suite
node --test tests/database.test.js
node --test tests/api_routes.test.js
```

> **Note on Concurrency:** `--test-concurrency=1` is required when running tests across the suite to avoid lock contention on the shared SQLite database file.

## Test File Organization

**Location:**
- Centralized `tests/` directory at the project root.

**Naming:**
- Files named `[feature_or_system].test.js`.

**Test Suites:**
- `tests/api_routes.test.js`: Endpoints for trending, search, watchlist, and system status.
- `tests/character_search.test.js`: Lead character search, actor queries, and cross-category resolution.
- `tests/database.test.js`: SQLite schema validation, catalog persistence, and episode progress toggles.
- `tests/end_to_end_scenarios.test.js`: End-to-end integration workflows mimicking full user sessions.
- `tests/filters_and_sorting.test.js`: Multi-genre filtering, release sorting, and rating filters.
- `tests/mirror_registry.test.js`: Dynamic streaming/download mirror registry, health checking, and domain failover.
- `tests/orchestrator_dedup.test.js`: Entity deduplication and title canonicalization logic.
- `tests/pagination.test.js`: Strict page-by-page non-overlapping pagination guarantees.
- `tests/provider_adapters.test.js`: Normalization logic for AniList, TVMaze, Kitsu, and TMDB.
- `tests/seasons_completion.test.js`: Season completion workflows and watch status transitions.
- `tests/seasons_multi_count.test.js`: Multi-season count accuracy and cross-provider hydration.

## Test Structure & Patterns

**Standard Suite Structure:**
```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('Feature or Module Name', () => {
  it('should perform expected behavior under condition', async () => {
    // Arrange: Set up test state or input parameters
    const input = { ... };

    // Act: Invoke the function or API endpoint
    const result = await operation(input);

    // Assert: Verify state and invariants
    assert.equal(result.success, true);
    assert.ok(result.data.length > 0);
  });
});
```

**Testing REST APIs:**
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch REST API Live Endpoints', () => {
  it('GET /api/system/status should return health and provider status', async () => {
    const res = await fetch(`${SERVER_BASE}/system/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.database);
    assert.ok(json.providers.anilist.active);
  });
});
```

**Testing Database Persistence:**
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDB, saveCatalogItem, toggleEpisodeProgress } from '../apps/server/src/db.js';

describe('OmniWatch Database Persistence', () => {
  it('should toggle and persist individual episode progress', () => {
    const db = getDB();
    const itemId = 'test_item_1';
    
    // Toggle episode 1 watched
    const status = toggleEpisodeProgress(itemId, 1, 1, true);
    assert.equal(status.isWatched, true);
    
    // Query directly to assert durability
    const row = db.prepare('SELECT is_watched FROM catalog_episode_progress WHERE catalog_item_id = ? AND episode_number = 1').get(itemId);
    assert.equal(row.is_watched, 1);
  });
});
```

## Mocking & Isolation Strategy

**Live API vs Mocking:**
- Provider adapter tests (`tests/provider_adapters.test.js`) test normalization functions against static JSON fixtures representing real API payloads.
- Integration tests (`tests/api_routes.test.js`) test against running Express server instance with live network connectivity for public APIs.
- Database tests use temporary test IDs (e.g., `omni_api_test_*`) and clean up records or test isolated transactional states.

## Empirical Verification Checklist

Before marking any task or phase complete:
1. Run `npm test` and verify that all 61+ tests across all 10+ suites pass with 0 failures.
2. Run `npm run build` to verify frontend React/Vite builds cleanly without syntax errors or missing asset imports.
3. Verify that database operations do not leave unhandled transactions or locks.

---

*Testing analysis: 2026-10-08*
*Update after test framework or suite changes*
