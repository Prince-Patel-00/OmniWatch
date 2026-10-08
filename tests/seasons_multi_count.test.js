import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCanonicalMedia, saveCanonicalMedia, getDB } from '../apps/server/src/db.js';
import { orchestrator } from '../apps/server/src/providers/ProviderOrchestrator.js';

describe('OmniWatch Accurate Total Seasons & Hydration Suite', () => {

  it('orchestrator.getDetail should cross-hydrate FROM with all 5 seasons instead of 1', async () => {
    const detail = await orchestrator.getDetail('omni_tmdb_tv_124364');
    assert.ok(detail, 'Media detail must be found');
    assert.equal(detail.title, 'FROM');
    assert.ok(detail.totalSeasons >= 4, `FROM should have at least 4 seasons, received: ${detail.totalSeasons}`);
    assert.ok(Array.isArray(detail.seasons));
    assert.ok(detail.seasons.length >= 4, `FROM seasons array should have at least 4 seasons, received: ${detail.seasons.length}`);
  });

  it('Under the Dome (omni_tv_1) should hydrate totalSeasons matching seasons rows count (3)', async () => {
    const detail = await orchestrator.getDetail('omni_tv_1');
    assert.ok(detail, 'Media detail must be found');
    assert.equal(detail.title, 'Under the Dome');
    assert.equal(detail.totalSeasons, 3, `Under the Dome should have exactly 3 seasons, received: ${detail.totalSeasons}`);
    assert.equal(detail.seasons.length, 3);
  });

  it('saveCanonicalMedia should never overwrite or downgrade existing total_seasons to 1', async () => {
    // 1. Fetch FROM which has at least 4 seasons
    const current = getCanonicalMedia('omni_tmdb_tv_124364');
    assert.ok(current);
    const originalSeasons = current.totalSeasons;
    assert.ok(originalSeasons >= 4);

    // 2. Simulate saving a trending item with totalSeasons = 1 (as list endpoints omit seasons)
    const mockTrendingItem = {
      ...current,
      totalSeasons: 1,
      seasons: []
    };
    await saveCanonicalMedia(mockTrendingItem);

    // 3. Verify totalSeasons in DB was NOT downgraded
    const after = getCanonicalMedia('omni_tmdb_tv_124364');
    assert.equal(after.totalSeasons, originalSeasons, 'totalSeasons must not be downgraded by trending item');
  });

  it('TVMazeProvider normalizeTVMazeShow integrates explicit seasons array', () => {
    const rawShow = {
      id: 99999,
      name: 'Multi-Season Test Show',
      type: 'Scripted',
      genres: ['Drama'],
      summary: '<p>A multi-season drama.</p>'
    };
    const embedded = {
      episodes: [
        { id: 1, season: 1, number: 1, name: 'Pilot' },
        { id: 2, season: 2, number: 1, name: 'Return' }
      ],
      seasons: [
        { id: 101, number: 1, name: 'First Season', episodeOrder: 10 },
        { id: 102, number: 2, name: 'Second Season', episodeOrder: 10 },
        { id: 103, number: 3, name: 'Announced Third Season', episodeOrder: 8 }
      ]
    };

    const normalized = orchestrator.tvmaze.normalizeTVMazeShow(rawShow, embedded);
    assert.equal(normalized.totalSeasons, 3, 'totalSeasons must include all seasons from embedded.seasons');
    assert.equal(normalized.seasons.length, 3, 'seasons array must contain 3 seasons');
    assert.equal(normalized.seasons[2].seasonNumber, 3);
  });

  it('orchestrator.search with "GOT" should return Game of Thrones with all 8 seasons', async () => {
    const results = await orchestrator.search('GOT', { type: 'Series' });
    assert.ok(results.length > 0, 'Must find results for GOT');
    const got = results[0];
    assert.equal(got.title, 'Game of Thrones', 'First result for GOT must be Game of Thrones');
    assert.equal(got.totalSeasons, 8, 'Game of Thrones must have 8 seasons');
  });

  it('orchestrator.search with "The Mentalist" should return all 7 seasons', async () => {
    const results = await orchestrator.search('The Mentalist', { type: 'Series' });
    assert.ok(results.length > 0, 'Must find results for The Mentalist');
    const mentalist = results.find(r => r.title.toLowerCase().includes('mentalist'));
    assert.ok(mentalist, 'Must find The Mentalist');
    assert.equal(mentalist.totalSeasons, 7, 'The Mentalist must have 7 seasons');
  });

  it('orchestrator.search should filter out redundant subsequent season records (e.g. Season 2, Season 3)', async () => {
    const results = await orchestrator.search('Frieren', { type: 'Anime' });
    assert.ok(results.length > 0);
    const redundant = results.filter(r => /\b(?:Season\s+[2-9]|[2-9]\w*\s+Season|Final\s+Season)\b/i.test(r.title));
    assert.equal(redundant.length, 0, 'No redundant subsequent season records should be returned in search');
  });

});

