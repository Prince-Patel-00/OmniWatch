import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch Strict Pagination Non-Overlap Suite', () => {
  let authToken = null;

  before(async () => {
    const res = await fetch(`${SERVER_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'makisanis106@gmail.com',
        password: 'OutCast106'
      })
    });
    if (res.ok) {
      const data = await res.json();
      authToken = data.token;
    }
  });

  it('GET /api/global/trending across pages 1, 2, and 3 should have 0 overlapping titles', async () => {
    const seen = new Set();
    const duplicates = [];

    for (let p = 1; p <= 3; p++) {
      const res = await fetch(`${SERVER_BASE}/global/trending?type=All&page=${p}&limit=20`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.length > 0, `Page ${p} must return items`);

      for (const item of json.data) {
        if (seen.has(item.id)) {
          duplicates.push({ page: p, id: item.id, title: item.title });
        }
        seen.add(item.id);
      }
    }

    assert.equal(duplicates.length, 0, `Expected 0 duplicate items across trending pages, found: ${JSON.stringify(duplicates)}`);
  });

  it('GET /api/global/trending?type=Series across pages 1 and 2 should have 0 overlapping titles', async () => {
    const seen = new Set();
    const duplicates = [];

    for (let p = 1; p <= 2; p++) {
      const res = await fetch(`${SERVER_BASE}/global/trending?type=Series&page=${p}&limit=25`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      for (const item of json.data) {
        if (seen.has(item.id)) {
          duplicates.push({ page: p, id: item.id, title: item.title });
        }
        seen.add(item.id);
      }
    }

    assert.equal(duplicates.length, 0, `Expected 0 duplicate series across pages, found: ${JSON.stringify(duplicates)}`);
  });

  it('GET /api/global/search for Spider-Man across pages 1 and 2 should have 0 overlapping titles', async () => {
    const seen = new Set();
    const duplicates = [];

    for (let p = 1; p <= 2; p++) {
      const res = await fetch(`${SERVER_BASE}/global/search?q=Spider-Man&page=${p}&limit=10`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      for (const item of json.data) {
        if (seen.has(item.id)) {
          duplicates.push({ page: p, id: item.id, title: item.title });
        }
        seen.add(item.id);
      }
    }

    assert.equal(duplicates.length, 0, `Expected 0 duplicate search items across pages, found: ${JSON.stringify(duplicates)}`);
  });

  it('GET /api/global/search for Andrew Garfield across pages 1 and 2 should have 0 overlapping titles', async () => {
    const seen = new Set();
    const duplicates = [];

    for (let p = 1; p <= 2; p++) {
      const res = await fetch(`${SERVER_BASE}/global/search?q=Andrew+Garfield&page=${p}&limit=8`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      for (const item of json.data) {
        if (seen.has(item.id)) {
          duplicates.push({ page: p, id: item.id, title: item.title });
        }
        seen.add(item.id);
      }
    }

    assert.equal(duplicates.length, 0, `Expected 0 duplicate actor credits across pages, found: ${JSON.stringify(duplicates)}`);
  });

  it('GET /api/catalog across pages 1 and 2 should have 0 overlapping titles', async () => {
    const seen = new Set();
    const duplicates = [];

    for (let p = 1; p <= 2; p++) {
      const res = await fetch(`${SERVER_BASE}/catalog?page=${p}&limit=10`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      for (const item of json.data) {
        if (seen.has(item.id)) {
          duplicates.push({ page: p, id: item.id, title: item.title });
        }
        seen.add(item.id);
      }
    }

    assert.equal(duplicates.length, 0, `Expected 0 duplicate catalog items across pages, found: ${JSON.stringify(duplicates)}`);
  });

  it('GET /api/catalog with status=Want to Watch should return exclusively Want to Watch items', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog?status=Want+to+Watch&limit=50`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    for (const item of json.data) {
      assert.equal(item.userStatus, 'Want to Watch');
    }
  });

  it('GET /api/catalog with excludeStatus=Want to Watch should exclude all Want to Watch items', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog?excludeStatus=Want+to+Watch&limit=50`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    for (const item of json.data) {
      assert.notEqual(item.userStatus, 'Want to Watch');
    }
  });

  it('GET /api/global/trending with limit=25 should return exactly 25 uniform items', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?limit=25&page=1`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 25, 'Must return exactly uniform 25 items per page');
  });

  it('GET /api/global/trending with limit=50 should return uniform items clamped correctly', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?limit=50&page=1`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.limit, 50);
  });

  it('GET /api/global/trending with limit=100 should return uniform items clamped correctly', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?limit=100&page=1`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.limit, 100);
  });

});

