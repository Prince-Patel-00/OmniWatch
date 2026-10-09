import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch REST API Live Endpoints', () => {
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
  it('GET /api/system/status should return health and provider status', async () => {
    const res = await fetch(`${SERVER_BASE}/system/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.database);
    assert.ok(json.providers.anilist.active);
  });

  it('GET /api/global/trending should return live trending media', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
  });

  it('GET /api/global/trending should support page and limit pagination', async () => {
    const res1 = await fetch(`${SERVER_BASE}/global/trending?page=1&limit=12`);
    assert.equal(res1.status, 200);
    const json1 = await res1.json();
    assert.equal(json1.success, true);
    assert.equal(json1.page, 1);
    assert.equal(json1.limit, 12);
    assert.ok(json1.data.length <= 12);

    const res2 = await fetch(`${SERVER_BASE}/global/trending?page=2&limit=12`);
    assert.equal(res2.status, 200);
    const json2 = await res2.json();
    assert.equal(json2.success, true);
    assert.equal(json2.page, 2);
    assert.equal(json2.limit, 12);
    assert.ok(json2.data.length > 0);
  });

  it('GET /api/global/search should find titles by query', async () => {
    const res = await fetch(`${SERVER_BASE}/global/search?q=Severance`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0);
    assert.ok(json.data.some(d => d.title.toLowerCase().includes('severance')));
  });

  it('POST /api/catalog and PATCH /api/catalog/:id should manage watchlist lifecycle', async () => {
    // 1. Add title
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        canonicalId: 'omni_api_test_cyberpunk',
        title: 'Cyberpunk: Edgerunners',
        mediaType: 'Anime',
        userStatus: 'Want to Watch',
        userRating: 9.0,
        totalEpisodes: 10
      })
    });
    assert.equal(addRes.status, 200);
    const addJson = await addRes.json();
    assert.equal(addJson.success, true);
    const itemId = addJson.data.id;

    try {
      // 2. Update status to Watching
      const patchRes = await fetch(`${SERVER_BASE}/catalog/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ userStatus: 'Watching', currentEpisode: 2 })
      });
      assert.equal(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.equal(patchJson.data.userStatus, 'Watching');
      assert.equal(patchJson.data.currentEpisode, 2);

      // 3. Increment episode progress
      const progRes = await fetch(`${SERVER_BASE}/catalog/${itemId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ seasonNumber: 1, episodeNumber: 3, isWatched: true })
      });
      assert.equal(progRes.status, 200);
      const progJson = await progRes.json();
      assert.equal(progJson.data.currentEpisode, 3);
    } finally {
      // 4. Delete item
      await fetch(`${SERVER_BASE}/catalog/${itemId}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      }).catch(() => {});
    }
  });

  it('GET /api/global/media/:id should return streaming & download mirrors', async () => {
    // Search for an anime to get ID
    const searchRes = await fetch(`${SERVER_BASE}/global/search?q=Frieren`);
    const searchJson = await searchRes.json();
    assert.ok(searchJson.data.length > 0);
    const mediaId = searchJson.data[0].id;

    // Fetch detail
    const detailRes = await fetch(`${SERVER_BASE}/global/media/${encodeURIComponent(mediaId)}`);
    assert.equal(detailRes.status, 200);
    const detailJson = await detailRes.json();
    assert.equal(detailJson.success, true);
    assert.ok(Array.isArray(detailJson.data.sources));
    assert.ok(detailJson.data.sources.length >= 2);

    // Verify mirrors contain valid URLs and types
    const firstMirror = detailJson.data.sources[0];
    assert.ok(firstMirror.sourceName);
    assert.ok(firstMirror.url.startsWith('http'));
    assert.ok(firstMirror.quality);

    // Add a custom mirror link
    const addSourceRes = await fetch(`${SERVER_BASE}/global/media/${encodeURIComponent(mediaId)}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test_mirror_123',
        sourceName: 'Test Direct DL',
        url: 'https://testmirror.example.com/dl',
        type: 'Download',
        quality: '1080p WebRip',
        audio: 'Multi-Sub'
      })
    });
    assert.equal(addSourceRes.status, 200);
    const addSourceJson = await addSourceRes.json();
    assert.ok(addSourceJson.data.sources.some(s => s.id === 'test_mirror_123'));

    // Delete custom mirror link
    const delSourceRes = await fetch(`${SERVER_BASE}/global/media/${encodeURIComponent(mediaId)}/sources/test_mirror_123`, {
      method: 'DELETE'
    });
    assert.equal(delSourceRes.status, 200);
    const delSourceJson = await delSourceRes.json();
    assert.ok(!delSourceJson.data.sources.some(s => s.id === 'test_mirror_123'));
  });
});
