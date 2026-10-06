import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initDB,
  saveCanonicalMedia,
  getCanonicalMedia,
  upsertCatalogItem,
  getCatalogItem,
  getCatalogItems,
  deleteCatalogItem,
  toggleEpisodeProgress,
  batchSetSeasonProgress,
  getCatalogStats,
  exportCatalogData,
  importCatalogData
} from '../apps/server/src/db.js';

describe('OmniWatch SQLite Database & Relational Persistence', () => {
  before(() => {
    const db = initDB();
    const existing = getCatalogItems();
    for (const item of existing) {
      if (item.canonicalId === 'omni_test_frieren') {
        deleteCatalogItem(item.id);
      }
    }
    db.prepare('DELETE FROM media_watch_providers WHERE canonical_id = ?').run('omni_test_frieren');
    db.prepare('DELETE FROM cached_media WHERE id = ?').run('omni_test_frieren');
  });

  after(() => {
    const db = initDB();
    const existing = getCatalogItems();
    for (const item of existing) {
      if (item.canonicalId === 'omni_test_frieren') {
        deleteCatalogItem(item.id);
      }
    }
    db.prepare('DELETE FROM media_watch_providers WHERE canonical_id = ?').run('omni_test_frieren');
    db.prepare('DELETE FROM cached_media WHERE id = ?').run('omni_test_frieren');
  });

  const sampleCanonical = {
    id: 'omni_test_frieren',
    mediaType: 'Anime',
    title: 'Frieren: Beyond Journey’s End',
    originalTitle: 'Sousou no Frieren',
    romajiTitle: 'Sousou no Frieren',
    releaseYear: 2023,
    status: 'Completed',
    rating: 9.1,
    popularityScore: 95000,
    genres: ['Animation', 'Adventure', 'Fantasy'],
    studios: ['Madhouse'],
    totalEpisodes: 28,
    seasons: [
      {
        seasonNumber: 1,
        title: 'Season 1',
        episodeCount: 28,
        episodes: Array.from({ length: 28 }, (_, i) => ({
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
          runtimeMinutes: 24
        }))
      }
    ],
    watchProviders: [
      {
        name: 'Crunchyroll',
        region: 'US',
        type: 'FLATRATE',
        webUrl: 'https://crunchyroll.com/frieren'
      }
    ]
  };

  it('should save and hydrate canonical media with relations', () => {
    const saved = saveCanonicalMedia(sampleCanonical);
    assert.ok(saved);
    assert.equal(saved.id, 'omni_test_frieren');
    assert.equal(saved.title, 'Frieren: Beyond Journey’s End');
    assert.equal(saved.studios[0], 'Madhouse');
    assert.equal(saved.seasons.length, 1);
    assert.equal(saved.seasons[0].episodes.length, 28);
    assert.equal(saved.watchProviders[0].name, 'Crunchyroll');
  });

  it('should retrieve cached canonical media by id', () => {
    const fetched = getCanonicalMedia('omni_test_frieren');
    assert.ok(fetched);
    assert.equal(fetched.rating, 9.1);
    assert.equal(fetched.mediaType, 'Anime');
  });

  it('should add item to personal catalog with watch status', () => {
    const catalogItem = upsertCatalogItem({
      canonicalId: 'omni_test_frieren',
      title: 'Frieren: Beyond Journey’s End',
      mediaType: 'Anime',
      userStatus: 'Watching',
      userRating: 9.5,
      isFavorite: true,
      currentSeason: 1,
      currentEpisode: 4,
      totalEpisodes: 28,
      notes: 'Masterpiece storytelling.'
    });

    assert.ok(catalogItem);
    assert.ok(catalogItem.id);
    assert.equal(catalogItem.userStatus, 'Watching');
    assert.equal(catalogItem.isFavorite, true);
    assert.equal(catalogItem.userRating, 9.5);
    assert.equal(catalogItem.notes, 'Masterpiece storytelling.');
  });

  it('should toggle and persist individual episode progress', () => {
    const items = getCatalogItems({ search: 'Frieren' });
    assert.ok(items.length > 0);
    const itemId = items[0].id;

    // Check off Ep 1, 2, 3
    toggleEpisodeProgress(itemId, 1, 1, true);
    toggleEpisodeProgress(itemId, 1, 2, true);
    const updated = toggleEpisodeProgress(itemId, 1, 3, true);

    assert.ok(updated.watchedEpisodes.length >= 3);
    assert.equal(updated.currentEpisode, 4); // max of 4 or 3
  });

  it('should batch complete a full season', () => {
    const items = getCatalogItems({ search: 'Frieren' });
    const itemId = items[0].id;

    const completed = batchSetSeasonProgress(itemId, 1, 28, true);
    assert.equal(completed.watchedEpisodes.length, 28);
    assert.equal(completed.currentEpisode, 28);
  });

  it('should calculate accurate catalog analytics', () => {
    const stats = getCatalogStats();
    assert.ok(stats.totalTitles >= 1);
    assert.ok(stats.watchedEpisodesCount >= 28);
    assert.ok(stats.estimatedHoursWatched > 0);
    assert.ok(stats.byType.Anime >= 1);
  });

  it('should export and verify backup payload format', () => {
    const backup = exportCatalogData();
    assert.equal(backup.version, '2.0.0');
    assert.ok(Array.isArray(backup.catalog));
    assert.ok(Array.isArray(backup.progress));
    assert.ok(backup.catalog.length >= 1);
  });
});
