import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch 2.0 Complete End-to-End User Scenarios', () => {
  let scenario1CatalogItemId = null;
  let scenario2CatalogItemId = null;

  after(async () => {
    if (scenario1CatalogItemId) {
      await fetch(`${SERVER_BASE}/catalog/${scenario1CatalogItemId}`, { method: 'DELETE' }).catch(() => {});
    }
    if (scenario2CatalogItemId) {
      await fetch(`${SERVER_BASE}/catalog/${scenario2CatalogItemId}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  // Scenario 1: GLOBAL Anime Discovery -> Detailed inspection -> Catalog tracking -> Episode checkmark -> Persistence
  it('Scenario 1: Discover anime in Global, inspect details, add to catalog, log episode progress, and verify persistence', async () => {
    // 1. Search for anime
    const searchRes = await fetch(`${SERVER_BASE}/global/search?q=Frieren&type=Anime`);
    assert.equal(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.ok(searchJson.success);
    assert.ok(searchJson.data.length > 0);

    const title = searchJson.data[0];
    assert.ok(title.id);
    assert.ok(title.title.toLowerCase().includes('frieren'));

    // 2. Open title detail
    const detailRes = await fetch(`${SERVER_BASE}/global/media/${encodeURIComponent(title.id)}`);
    assert.equal(detailRes.status, 200);
    const detailJson = await detailRes.json();
    const media = detailJson.data;

    assert.ok(media.synopsis);
    assert.ok(Array.isArray(media.genres));
    assert.ok(Array.isArray(media.seasons));
    assert.ok(media.seasons.length > 0);
    assert.ok(Array.isArray(media.watchProviders));

    // 3. Add to My Catalog with status "Watching" (using isolated test canonicalId)
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: 'omni_test_e2e_frieren',
        title: media.title,
        mediaType: media.mediaType,
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        releaseYear: media.releaseYear,
        userStatus: 'Watching',
        userRating: 9.5,
        totalEpisodes: media.totalEpisodes || 28
      })
    });
    assert.equal(addRes.status, 200);
    const addJson = await addRes.json();
    assert.ok(addJson.success);
    scenario1CatalogItemId = addJson.data.id;
    assert.equal(addJson.data.userStatus, 'Watching');

    // 4. Log episode 1, 2, and 3 watched
    await fetch(`${SERVER_BASE}/catalog/${scenario1CatalogItemId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonNumber: 1, episodeNumber: 1, isWatched: true })
    });
    await fetch(`${SERVER_BASE}/catalog/${scenario1CatalogItemId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonNumber: 1, episodeNumber: 2, isWatched: true })
    });
    const ep3Res = await fetch(`${SERVER_BASE}/catalog/${scenario1CatalogItemId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonNumber: 1, episodeNumber: 3, isWatched: true })
    });
    const ep3Json = await ep3Res.json();
    assert.equal(ep3Json.data.currentEpisode, 3);
    assert.equal(ep3Json.data.watchedEpisodes.length, 3);

    // 5. Query /api/catalog to verify persistence
    const verifyRes = await fetch(`${SERVER_BASE}/catalog?status=Watching`);
    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    const verifiedItem = verifyJson.data.find(i => i.canonicalId === 'omni_test_e2e_frieren');
    assert.ok(verifiedItem);
    assert.equal(verifiedItem.currentEpisode, 3);
    assert.equal(verifiedItem.userStatus, 'Watching');
  });

  // Scenario 2: GLOBAL Anime Movie Discovery -> Detail inspection -> Add to Catalog as "Want to Watch"
  it('Scenario 2: Discover anime movie in Anime tab, inspect details, and mark Want to Watch', async () => {
    // 1. Search for anime movie in Anime tab
    const searchRes = await fetch(`${SERVER_BASE}/global/search?q=Spirited&type=Anime&animeFormat=Movie`);
    assert.equal(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.ok(searchJson.success);
    assert.ok(searchJson.data.length > 0);

    const movie = searchJson.data[0];
    assert.equal(movie.mediaType, 'Anime');
    assert.equal(movie.format, 'Movie');
    assert.equal(movie.isMovie, true);

    // 2. Add to Catalog as "Want to Watch" (using isolated test canonicalId)
    const addRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalId: 'omni_test_e2e_spirited',
        title: movie.title,
        mediaType: 'Anime',
        format: 'Movie',
        posterUrl: movie.posterUrl,
        backdropUrl: movie.backdropUrl,
        releaseYear: movie.releaseYear,
        userStatus: 'Want to Watch',
        isFavorite: true
      })
    });
    assert.equal(addRes.status, 200);
    const addJson = await addRes.json();
    scenario2CatalogItemId = addJson.data.id;
    assert.equal(addJson.data.userStatus, 'Want to Watch');
    assert.equal(addJson.data.isFavorite, true);
    assert.equal(addJson.data.mediaType, 'Anime');
    assert.equal(addJson.data.format, 'Movie');

    // 3. Verify in catalog under Anime Movies sub-tab filter
    const checkRes = await fetch(`${SERVER_BASE}/catalog?type=Anime&animeFormat=Movie`);
    const checkJson = await checkRes.json();
    assert.ok(checkJson.data.some(i => i.canonicalId === 'omni_test_e2e_spirited'));
  });

  // Scenario 3: MY CATALOG Filtering, Sorting, Status Updates, and Episode Rollback
  it('Scenario 3: Filter catalog by Watching and Completed, update status, and verify episode rollback', async () => {
    assert.ok(scenario1CatalogItemId, 'Scenario 1 item must exist');

    // 1. Fetch Watching titles and confirm our test item is present
    const watchingRes = await fetch(`${SERVER_BASE}/catalog?status=Watching`);
    const watchingJson = await watchingRes.json();
    assert.ok(watchingJson.data.length > 0);
    const targetItem = watchingJson.data.find(i => i.id === scenario1CatalogItemId);
    assert.ok(targetItem, 'Scenario 1 item must be present in Watching status');

    // 2. Update status to Completed and rate 10/10
    const updateRes = await fetch(`${SERVER_BASE}/catalog/${targetItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userStatus: 'Completed',
        userRating: 10.0,
        notes: 'Completed full run. Stunning.'
      })
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.data.userStatus, 'Completed');
    assert.equal(updateJson.data.userRating, 10.0);

    // 3. Verify item now shows in "Completed" filter
    const completedRes = await fetch(`${SERVER_BASE}/catalog?status=Completed`);
    const completedJson = await completedRes.json();
    assert.ok(completedJson.data.some(i => i.id === targetItem.id));

    // 4. Test unmarking an episode: unmark episode 3
    const unmarkRes = await fetch(`${SERVER_BASE}/catalog/${targetItem.id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonNumber: 1, episodeNumber: 3, isWatched: false })
    });
    const unmarkJson = await unmarkRes.json();
    assert.equal(unmarkJson.data.currentEpisode, 2); // rolled back to highest remaining (2)
  });

  // Scenario 4: GLOBAL On-Demand Freshness & Synchronization
  it('Scenario 4: Trigger on-demand metadata refresh and verify fresh timestamp', async () => {
    // 1. Get a title from trending
    const trendingRes = await fetch(`${SERVER_BASE}/global/trending`);
    const trendingJson = await trendingRes.json();
    assert.ok(trendingJson.data.length > 0);
    const item = trendingJson.data[0];

    // 2. Post refresh to /api/global/media/:id/refresh
    const refreshRes = await fetch(`${SERVER_BASE}/global/media/${encodeURIComponent(item.id)}/refresh`, {
      method: 'POST'
    });
    assert.equal(refreshRes.status, 200);
    const refreshJson = await refreshRes.json();
    assert.ok(refreshJson.success);
    assert.ok(refreshJson.data.lastSyncedAt);

    // 3. Confirm freshness timestamp is within the last 10 seconds
    const syncedTime = new Date(refreshJson.data.lastSyncedAt).getTime();
    const now = Date.now();
    assert.ok(now - syncedTime < 10000);
  });
});
