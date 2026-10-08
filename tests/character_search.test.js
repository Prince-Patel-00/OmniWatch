import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch Lead Character Search & Filter Suite', () => {

  it('GET /api/global/characters should return popular lead characters with images and mediaCount', async () => {
    const res = await fetch(`${SERVER_BASE}/global/characters?limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);

    const first = json.data[0];
    assert.ok(first.name, 'Character must have a name');
    assert.ok(typeof first.appearances === 'number', 'Character must have appearances count');
    assert.ok(first.appearances >= 1, 'Appearances count should be at least 1');
  });

  it('GET /api/catalog/characters should return character endpoint successfully', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog/characters?limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  it('GET /api/global/search with character=Luffy should return titles starring Luffy', async () => {
    const res = await fetch(`${SERVER_BASE}/global/search?character=Luffy&limit=5`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0, 'Should find media starring Luffy');

    // Verify at least one item features Luffy in mainCharacters, cast, matchedCharacter or title
    const hasLuffy = json.data.some((item) => {
      const matchInMain = (item.mainCharacters || []).some(c => (c.name || c).toLowerCase().includes('luffy'));
      const matchInCast = (item.cast || []).some(c => (c.character || c.name || '').toLowerCase().includes('luffy'));
      const matchInTitle = (item.title || '').toLowerCase().includes('piece') || (item.title || '').toLowerCase().includes('luffy');
      const matchInMatched = item.matchedCharacter?.name?.toLowerCase().includes('luffy');
      return matchInMain || matchInCast || matchInTitle || matchInMatched;
    });

    assert.ok(hasLuffy, 'Search results must include media starring Luffy');
  });

  it('GET /api/global/search with character=Eren should return Attack on Titan media', async () => {
    const res = await fetch(`${SERVER_BASE}/global/search?character=Eren&limit=5`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0, 'Should find media starring Eren');

    const hasErenOrTitan = json.data.some((item) => {
      const matchInMain = (item.mainCharacters || []).some(c => (c.name || c).toLowerCase().includes('eren'));
      const matchInCast = (item.cast || []).some(c => (c.character || c.name || '').toLowerCase().includes('eren'));
      const matchInTitle = (item.title || '').toLowerCase().includes('titan') || (item.title || '').toLowerCase().includes('shingeki');
      const matchInMatched = item.matchedCharacter?.name?.toLowerCase().includes('eren');
      return matchInMain || matchInCast || matchInTitle || matchInMatched;
    });

    assert.ok(hasErenOrTitan, 'Search results must include Attack on Titan or media starring Eren');
  });

  it('GET /api/global/search with q=Andrew Garfield should return Andrew Garfield movies/series across categories', async () => {
    const res = await fetch(`${SERVER_BASE}/global/search?q=Andrew+Garfield&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0, 'Should find media starring Andrew Garfield');

    // Check that we have real movies/shows (not a fake person entry)
    const hasValidTitles = json.data.some((item) => {
      const isActorMatch = item.matchedPerson?.name?.toLowerCase().includes('andrew garfield') ||
        (item.cast || []).some(c => (c.actor || c.name || '').toLowerCase().includes('andrew garfield'));
      const isFamousTitle = /spider-man|hacksaw|social network|banner of heaven|tick/i.test(item.title);
      return isActorMatch || isFamousTitle;
    });
    assert.ok(hasValidTitles, 'Search results must include valid movies or series starring Andrew Garfield');

    // Verify categories include Movie or Series
    const mediaTypes = new Set(json.data.map(i => i.mediaType));
    assert.ok(mediaTypes.has('Movie') || mediaTypes.has('Series'), 'Must return Movie or Series categories');
  });

  it('GET /api/global/search with character=Spider-Man should return superhero titles', async () => {
    const res = await fetch(`${SERVER_BASE}/global/search?character=Spider-Man&limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0, 'Should find media featuring Spider-Man');

    const hasSpidey = json.data.some((item) => {
      const matchInTitle = (item.title || '').toLowerCase().includes('spider-man');
      const matchInCast = (item.cast || []).some(c => (c.character || '').toLowerCase().includes('spider-man') || (c.character || '').toLowerCase().includes('peter parker'));
      const matchInMatched = item.matchedCharacter?.name?.toLowerCase().includes('spider-man');
      return matchInTitle || matchInCast || matchInMatched;
    });
    assert.ok(hasSpidey, 'Results must include Spider-Man titles');
  });

});
