import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

let authToken = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (typeof url === 'string' && url.includes('/catalog') && authToken) {
    const headers = { ...options.headers, Authorization: `Bearer ${authToken}` };
    return originalFetch(url, { ...options, headers });
  }
  return originalFetch(url, options);
};

describe('OmniWatch Season Completion & Tracking Scenarios', () => {
  before(async () => {
    const res = await originalFetch(`${SERVER_BASE}/auth/login`, {
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

  // Scenario 1: "FROM" series - Completed 3 seasons, remaining 4th, Want to Watch Season 4
  it('Scenario 1: Series with remaining upcoming seasons (FROM: 3 completed, Want to Watch S4)', async () => {
    const fromId = `test_from_${Date.now()}`;
    
    // Add "FROM" to catalog
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: fromId,
        title: 'FROM',
        mediaType: 'Series',
        format: 'Series',
        releaseYear: 2022,
        totalSeasons: 4,
        totalEpisodes: 40,
        userStatus: 'Want to Watch'
      })
    });
    assert.equal(addRes.status, 200);
    const added = await addRes.json();
    assert.equal(added.success, true);
    const catalogItemId = added.data.id;

    // User marks 3 seasons completed and sets status to Want to Watch (waiting for Season 4)
    const seasonsRes = await fetch(`${SERVER_BASE}/catalog/${catalogItemId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonsCompleted: 3,
        userStatus: 'Want to Watch',
        currentSeason: 4,
        totalSeasons: 4,
        syncEpisodes: true
      })
    });
    assert.equal(seasonsRes.status, 200);
    const updated = await seasonsRes.json();
    assert.equal(updated.success, true);
    assert.equal(updated.data.seasonsCompleted, 3);
    assert.equal(updated.data.totalSeasons, 4);
    assert.equal(updated.data.currentSeason, 4);
    assert.equal(updated.data.userStatus, 'Want to Watch');

    // Verify catalog fetching persists seasonsCompleted and totalSeasons
    const getRes = await fetch(`${SERVER_BASE}/catalog/${catalogItemId}`);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.data.seasonsCompleted, 3);
    assert.equal(fetched.data.totalSeasons, 4);
    assert.equal(fetched.data.currentSeason, 4);
    assert.equal(fetched.data.userStatus, 'Want to Watch');

    // Clean up
    await fetch(`${SERVER_BASE}/catalog/${catalogItemId}`, { method: 'DELETE' });
  });

  // Scenario 2: "The Vampire Diaries" - Completed 3 seasons and dropped
  it('Scenario 2: Series dropped after specific season (The Vampire Diaries: 3 completed, Dropped)', async () => {
    const vdId = `test_vd_${Date.now()}`;
    
    // Add "The Vampire Diaries" to catalog
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: vdId,
        title: 'The Vampire Diaries',
        mediaType: 'Series',
        format: 'Series',
        releaseYear: 2009,
        totalSeasons: 8,
        totalEpisodes: 171,
        userStatus: 'Watching'
      })
    });
    assert.equal(addRes.status, 200);
    const added = await addRes.json();
    const catalogItemId = added.data.id;

    // User completed 3 seasons, then dropped the show
    const seasonsRes = await fetch(`${SERVER_BASE}/catalog/${catalogItemId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonsCompleted: 3,
        userStatus: 'Dropped',
        currentSeason: 4,
        totalSeasons: 8,
        syncEpisodes: true
      })
    });
    assert.equal(seasonsRes.status, 200);
    const updated = await seasonsRes.json();
    assert.equal(updated.success, true);
    assert.equal(updated.data.seasonsCompleted, 3);
    assert.equal(updated.data.totalSeasons, 8);
    assert.equal(updated.data.userStatus, 'Dropped');

    // Query catalog filtered by status 'Dropped' to ensure it appears in the Dropped category
    const listRes = await fetch(`${SERVER_BASE}/catalog?status=Dropped`);
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    const found = listJson.data.find(item => item.id === catalogItemId);
    assert.ok(found, 'Should find Vampire Diaries in Dropped list');
    assert.equal(found.seasonsCompleted, 3);
    assert.equal(found.totalSeasons, 8);
    assert.equal(found.userStatus, 'Dropped');

    // Clean up
    await fetch(`${SERVER_BASE}/catalog/${catalogItemId}`, { method: 'DELETE' });
  });

  // Scenario 3: On Hold after a specific season
  it('Scenario 3: Series paused on hold after specific season (Westworld: 2 completed, On Hold)', async () => {
    const wwId = `test_ww_${Date.now()}`;
    
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: wwId,
        title: 'Westworld',
        mediaType: 'Series',
        format: 'Series',
        releaseYear: 2016,
        totalSeasons: 4,
        totalEpisodes: 36,
        userStatus: 'Watching'
      })
    });
    assert.equal(addRes.status, 200);
    const added = await addRes.json();
    const catalogItemId = added.data.id;

    // User paused on hold after season 2
    const seasonsRes = await fetch(`${SERVER_BASE}/catalog/${catalogItemId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonsCompleted: 2,
        userStatus: 'On Hold',
        currentSeason: 3,
        totalSeasons: 4
      })
    });
    assert.equal(seasonsRes.status, 200);
    const updated = await seasonsRes.json();
    assert.equal(updated.success, true);
    assert.equal(updated.data.seasonsCompleted, 2);
    assert.equal(updated.data.userStatus, 'On Hold');
    assert.equal(updated.data.currentSeason, 3);

    // Clean up
    await fetch(`${SERVER_BASE}/catalog/${catalogItemId}`, { method: 'DELETE' });
  });

  // Scenario 4: Fully completing all seasons
  it('Scenario 4: Series fully completed (Breaking Bad: 5 of 5 completed, Completed)', async () => {
    const bbId = `test_bb_${Date.now()}`;
    
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: bbId,
        title: 'Breaking Bad',
        mediaType: 'Series',
        format: 'Series',
        releaseYear: 2008,
        totalSeasons: 5,
        totalEpisodes: 62,
        userStatus: 'Watching'
      })
    });
    const added = await addRes.json();
    const catalogItemId = added.data.id;

    // User marks all 5 seasons completed
    const seasonsRes = await fetch(`${SERVER_BASE}/catalog/${catalogItemId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonsCompleted: 5,
        userStatus: 'Completed',
        currentSeason: 5,
        totalSeasons: 5
      })
    });
    assert.equal(seasonsRes.status, 200);
    const updated = await seasonsRes.json();
    assert.equal(updated.success, true);
    assert.equal(updated.data.seasonsCompleted, 5);
    assert.equal(updated.data.userStatus, 'Completed');
    assert.ok(updated.data.completedAt, 'completedAt should be timestamped');

    // Clean up
    await fetch(`${SERVER_BASE}/catalog/${catalogItemId}`, { method: 'DELETE' });
  });

  // Scenario 5: Direct saving with seasonsCompleted via POST /api/catalog and PATCH /api/catalog/:id
  it('Scenario 5: Frictionless direct save and PATCH with seasonsCompleted', async () => {
    const shId = `test_sh_${Date.now()}`;
    
    // Direct save with seasonsCompleted = 2
    const postRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: shId,
        title: 'Sherlock',
        mediaType: 'Series',
        format: 'Series',
        releaseYear: 2010,
        totalSeasons: 4,
        seasonsCompleted: 2,
        currentSeason: 3,
        userStatus: 'Watching'
      })
    });
    assert.equal(postRes.status, 200);
    const posted = await postRes.json();
    assert.equal(posted.data.seasonsCompleted, 2);
    assert.equal(posted.data.totalSeasons, 4);

    // PATCH to increment to 3
    const patchRes = await fetch(`${SERVER_BASE}/catalog/${posted.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonsCompleted: 3,
        currentSeason: 4
      })
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.data.seasonsCompleted, 3);
    assert.equal(patched.data.currentSeason, 4);

    // Clean up
    await fetch(`${SERVER_BASE}/catalog/${posted.data.id}`, { method: 'DELETE' });
  });
});
