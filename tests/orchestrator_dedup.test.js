import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrator } from '../apps/server/src/providers/ProviderOrchestrator.js';

describe('OmniWatch Entity Deduplication & Resolver', () => {
  it('should merge duplicate entities from different providers into a single canonical entry', () => {
    const itemA = {
      id: 'omni_ani_101',
      mediaType: 'Anime',
      title: 'Chainsaw Man',
      originalTitle: 'チェンソーマン',
      releaseYear: 2022,
      synopsis: 'Denji is a teenage boy living with a Chainsaw Devil named Pochita...',
      genres: ['Action', 'Supernatural'],
      watchProviders: [
        { name: 'Crunchyroll', region: 'US', type: 'FLATRATE', webUrl: 'https://crunchyroll.com/chainsaw-man' }
      ],
      trailers: [{ videoKey: 'q15CRdE5Bv0', site: 'YouTube' }]
    };

    const itemB = {
      id: 'omni_kitsu_505',
      mediaType: 'Anime',
      title: 'Chainsaw Man',
      originalTitle: 'Chainsaw Man',
      releaseYear: 2022,
      synopsis: 'Short summary...',
      genres: ['Action', 'Horror'],
      watchProviders: [
        { name: 'Hulu', region: 'US', type: 'FLATRATE', webUrl: 'https://hulu.com/chainsaw-man' }
      ],
      trailers: [{ videoKey: 'v4yLeNt-kCU', site: 'YouTube' }]
    };

    const deduplicated = orchestrator.deduplicateEntities([itemA, itemB]);
    assert.equal(deduplicated.length, 1);

    const merged = deduplicated[0];
    assert.equal(merged.title, 'Chainsaw Man');
    // Genres should be union
    assert.ok(merged.genres.includes('Action'));
    assert.ok(merged.genres.includes('Supernatural'));
    assert.ok(merged.genres.includes('Horror'));
    // Watch providers should be merged
    assert.equal(merged.watchProviders.length, 2);
    // Trailers should be merged
    assert.equal(merged.trailers.length, 2);
  });

  it('should preserve separate entities for different release years or different titles', () => {
    const show2011 = {
      id: 'omni_ani_2011',
      mediaType: 'Anime',
      title: 'Hunter x Hunter',
      releaseYear: 2011
    };

    const show1999 = {
      id: 'omni_ani_1999',
      mediaType: 'Anime',
      title: 'Hunter x Hunter',
      releaseYear: 1999
    };

    const deduplicated = orchestrator.deduplicateEntities([show2011, show1999]);
    assert.equal(deduplicated.length, 2);
  });
});
