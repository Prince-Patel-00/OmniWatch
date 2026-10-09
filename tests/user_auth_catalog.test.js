import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch User Auth & Catalog Isolation Suite', () => {
  let primaryToken = null;
  let testUserToken = null;
  let testUserEmail = `tenant_${Date.now()}@omniwatch.test`;
  let testUserPassword = 'TestPassword123!';
  let createdCatalogItemId = null;

  it('POST /api/auth/login with seeded makisanis106 credentials should succeed', async () => {
    const res = await fetch(`${SERVER_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'makisanis106@gmail.com',
        password: 'OutCast106'
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.token, 'Should return a valid JWT token');
    assert.equal(json.user.email, 'makisanis106@gmail.com');
    assert.equal(json.user.id, 'user_makisanis106');

    primaryToken = json.token;
  });

  it('POST /api/auth/login with invalid password should be rejected with 401', async () => {
    const res = await fetch(`${SERVER_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'makisanis106@gmail.com',
        password: 'WrongPassword'
      })
    });

    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error, /invalid/i);
  });

  it('GET /api/auth/me should return authenticated user profile', async () => {
    const res = await fetch(`${SERVER_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${primaryToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.user.email, 'makisanis106@gmail.com');
  });

  it('GET /api/auth/me without token should return 401', async () => {
    const res = await fetch(`${SERVER_BASE}/auth/me`);
    assert.equal(res.status, 401);
  });

  it('GET /api/catalog for primary user should return all 208 migrated records', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog?limit=500`, {
      headers: { Authorization: `Bearer ${primaryToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 200, `Expected at least 200 items, got ${json.data.length}`);
  });

  it('POST /api/auth/register should create a new isolated tenant user', async () => {
    const res = await fetch(`${SERVER_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testUserPassword,
        displayName: 'Isolated Tester'
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.token);
    assert.equal(json.user.email, testUserEmail);

    testUserToken = json.token;
  });

  it('GET /api/catalog for new user must be completely empty (isolated catalog)', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 0, 'New tenant catalog must be initially empty');
  });

  it('POST /api/catalog for new user should add item strictly to new user catalog', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        canonicalId: 'omni_test_isolation_item',
        title: 'Tenant Isolation Test Title',
        mediaType: 'Anime',
        status: 'Watching',
        progressEpisode: 1,
        totalEpisodes: 12
      })
    });

    assert.ok([200, 201].includes(res.status));
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.id);
    createdCatalogItemId = json.data.id;

    // Verify it is visible to test user
    const checkRes = await fetch(`${SERVER_BASE}/catalog`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const checkJson = await checkRes.json();
    assert.equal(checkJson.data.length, 1);
    assert.equal(checkJson.data[0].id, createdCatalogItemId);
  });

  it('GET /api/catalog for primary user should NOT contain new tenant item', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog?search=Tenant+Isolation+Test+Title`, {
      headers: { Authorization: `Bearer ${primaryToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.length, 0, 'Primary user must not see other tenants items');
  });

  it('GET /api/catalog without auth token (logged out) must return empty catalog', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 0, 'Unauthenticated catalog request must be empty');
    assert.equal(json.count, 0);
  });

  it('POST /api/catalog without auth token must be rejected with 401', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: 'omni_unauth_test',
        title: 'Unauthenticated Test'
      })
    });
    assert.equal(res.status, 401);
  });

  after(async () => {
    // Cleanup created catalog item
    if (createdCatalogItemId && testUserToken) {
      await fetch(`${SERVER_BASE}/catalog/${createdCatalogItemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${testUserToken}` }
      }).catch(() => {});
    }
  });
});
