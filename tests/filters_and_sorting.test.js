import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch Filters and Sorting Suite', () => {
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

  it('GET /api/global/trending with genre filter should return titles containing the selected genre', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?genre=Action&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0);
    
    // Every item should either have Action in its genres or related tags
    for (const item of json.data) {
      const hasAction = (item.genres || []).some(g => g.toLowerCase().includes('action')) ||
        (item.synopsis || '').toLowerCase().includes('action');
      assert.ok(hasAction, `Item "${item.title}" should match Action genre`);
    }
  });

  it('GET /api/global/trending with sort=rating_desc should return items sorted by highest rating', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?sort=rating_desc&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 1);

    for (let i = 0; i < json.data.length - 1; i++) {
      const currentRating = json.data[i].rating || 0;
      const nextRating = json.data[i + 1].rating || 0;
      assert.ok(currentRating >= nextRating, `Rating order violated: ${currentRating} < ${nextRating}`);
    }
  });

  it('GET /api/global/trending with sort=release_desc should return items sorted by release year/date descending', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?sort=release_desc&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 1);

    for (let i = 0; i < json.data.length - 1; i++) {
      const currentYear = json.data[i].releaseYear || 0;
      const nextYear = json.data[i + 1].releaseYear || 0;
      assert.ok(currentYear >= nextYear, `Release year order violated: ${currentYear} < ${nextYear}`);
    }
  });

  it('GET /api/global/trending with sort=title_asc should return items sorted alphabetically', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?sort=title_asc&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 1);

    for (let i = 0; i < json.data.length - 1; i++) {
      const comp = json.data[i].title.localeCompare(json.data[i + 1].title);
      assert.ok(comp <= 0, `Alphabetical order violated: "${json.data[i].title}" > "${json.data[i + 1].title}"`);
    }
  });

  it('GET /api/catalog with genre and sort should properly filter and order personal catalog', async () => {
    let actionId = null;
    let comedyId = null;
    try {
      // 1. Seed two test items with distinct genres and ratings
      const resAction = await fetch(`${SERVER_BASE}/catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          canonicalId: 'omni_test_action_title',
          mediaType: 'Anime',
          format: 'Series',
          title: 'Alpha Action Test Force',
          userStatus: 'Watching',
          userRating: 9.5,
          genres: ['Action', 'Sci-Fi'],
          releaseYear: 2024
        })
      });
      const dataAction = await resAction.json();
      actionId = dataAction.data?.id;

      const resComedy = await fetch(`${SERVER_BASE}/catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          canonicalId: 'omni_test_comedy_title',
          mediaType: 'Anime',
          format: 'Series',
          title: 'Beta Comedy Laugh Show',
          userStatus: 'Completed',
          userRating: 7.0,
          genres: ['Comedy', 'Slice of Life'],
          releaseYear: 2020
        })
      });
      const dataComedy = await resComedy.json();
      comedyId = dataComedy.data?.id;

      // 2. Query catalog with genre=Action
      const actionRes = await fetch(`${SERVER_BASE}/catalog?genre=Action`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      assert.equal(actionRes.status, 200);
      const actionJson = await actionRes.json();
      assert.equal(actionJson.success, true);
      const hasActionItem = actionJson.data.some(d => d.title === 'Alpha Action Test Force');
      const hasComedyItem = actionJson.data.some(d => d.title === 'Beta Comedy Laugh Show');
      assert.ok(hasActionItem, 'Catalog with genre=Action should include Alpha Action Test Force');
      assert.equal(hasComedyItem, false, 'Catalog with genre=Action should NOT include Beta Comedy Laugh Show');

      // 3. Query catalog with sort=rating_desc
      const sortRes = await fetch(`${SERVER_BASE}/catalog?sort=rating_desc`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      assert.equal(sortRes.status, 200);
      const sortJson = await sortRes.json();
      assert.equal(sortJson.success, true);
      assert.ok(sortJson.data.length >= 2);
      for (let i = 0; i < sortJson.data.length - 1; i++) {
        const cur = sortJson.data[i].userRating || 0;
        const next = sortJson.data[i + 1].userRating || 0;
        assert.ok(cur >= next, `Catalog rating order violated: ${cur} < ${next}`);
      }
    } finally {
      if (actionId) await fetch(`${SERVER_BASE}/catalog/${actionId}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (comedyId) await fetch(`${SERVER_BASE}/catalog/${comedyId}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
    }
  });

  it('GET /api/global/trending with type=Anime and animeFormat=Movie should return anime movies', async () => {
    const res = await fetch(`${SERVER_BASE}/global/trending?type=Anime&animeFormat=Movie&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0);

    for (const item of json.data) {
      assert.equal(item.mediaType, 'Anime');
      assert.equal(item.format, 'Movie');
    }
  });
});
