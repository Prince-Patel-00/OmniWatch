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

});
