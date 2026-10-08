import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:5000/api';

describe('OmniWatch Modern Insights & Rating Recommendations Suite', () => {
  let primaryToken = null;
  let testUserToken = null;

  it('Authenticate seeded user makisanis106@gmail.com', async () => {
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
    assert.ok(json.token);
    primaryToken = json.token;
  });

  it('GET /api/catalog/stats returns modern taste metrics replacing raw episode counters', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog/stats`, {
      headers: { Authorization: `Bearer ${primaryToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    const stats = json.data;

    // 1. Total and core counts
    assert.ok(stats.totalTitles >= 200, 'Should have migrated catalog titles');

    // 2. Genre Distribution
    assert.ok(Array.isArray(stats.genreDistribution), 'Should have genre distribution');
    assert.ok(stats.genreDistribution.length > 0, 'Should have top genres');
    const firstGenre = stats.genreDistribution[0];
    assert.ok(firstGenre.genre, 'Genre item should have name');
    assert.ok(typeof firstGenre.count === 'number', 'Genre item should have count');
    assert.ok(typeof firstGenre.percentage === 'number', 'Genre item should have percentage');

    // 3. Rating Spread & Calibration Curve
    assert.ok(stats.ratingSpread, 'Should have rating spread metrics');
    assert.ok(typeof stats.ratingSpread.averageRating === 'number', 'Should have average rating');
    assert.ok(Array.isArray(stats.ratingSpread.distribution), 'Should have distribution tiers');
    assert.equal(stats.ratingSpread.distribution.length, 5, 'Should have 5 rating tiers (10, 9, 8, 7, <=6)');
    assert.ok(stats.ratingSpread.distribution.some(t => t.score.includes('10★ Masterpiece')));

    // 4. Top-Rated Highlights (9-10 rated or favorites)
    assert.ok(Array.isArray(stats.topRatedHighlights), 'Should have top rated highlights');
    if (stats.topRatedHighlights.length > 0) {
      const top = stats.topRatedHighlights[0];
      assert.ok(top.title, 'Highlight should have title');
      assert.ok(top.userRating >= 9 || top.isFavorite, 'Highlight should be 9-10 rated or favorite');
    }

    // 5. Completion Velocity & Rotation Health
    assert.ok(stats.completionVelocity, 'Should have completion velocity');
    assert.ok(typeof stats.completionVelocity.completionRate === 'number', 'Should calculate completion rate');
    assert.ok(typeof stats.completionVelocity.velocityRating === 'string', 'Should assign velocity badge');
    assert.ok(stats.completionVelocity.completedCount >= 0, 'Should have completed count');
  });

  it('GET /api/catalog/recommendations surfaces curated items based on 9-10 rated favorites', async () => {
    const res = await fetch(`${SERVER_BASE}/catalog/recommendations`, {
      headers: { Authorization: `Bearer ${primaryToken}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data), 'Recommendations should be an array');

    if (json.data.length > 0) {
      const rec = json.data[0];
      assert.ok(rec.id, 'Recommendation must have id');
      assert.ok(rec.title, 'Recommendation must have title');
      assert.ok(rec.sourceTitle, 'Recommendation must specify source title it is based on');
      assert.ok(rec.sourceRating >= 9 || rec.matchReason, 'Recommendation should be linked to user favorite/rating');
      assert.ok(rec.matchReason, 'Recommendation must provide transparent reason');
      assert.ok(Array.isArray(rec.matchTags), 'Recommendation should provide tag badges');
    }
  });

  it('Recommendations strictly exclude items already in user catalog', async () => {
    const [catRes, recsRes] = await Promise.all([
      fetch(`${SERVER_BASE}/catalog?limit=500`, { headers: { Authorization: `Bearer ${primaryToken}` } }),
      fetch(`${SERVER_BASE}/catalog/recommendations`, { headers: { Authorization: `Bearer ${primaryToken}` } })
    ]);

    const catJson = await catRes.json();
    const recsJson = await recsRes.json();

    const catalogIds = new Set(catJson.data.map(i => i.id || i.canonicalId));

    for (const rec of recsJson.data) {
      assert.equal(catalogIds.has(rec.id), false, `Recommendation ${rec.title} (${rec.id}) should NOT already be in user catalog`);
    }
  });

  it('Isolated user gets isolated recommendations based on their own ratings', async () => {
    // 1. Register a fresh user
    const newUserEmail = `recs_test_${Date.now()}@omniwatch.test`;
    const regRes = await fetch(`${SERVER_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail, password: 'NewUser123!' })
    });
    assert.equal(regRes.status, 201);
    const regJson = await regRes.json();
    testUserToken = regJson.token;

    // 2. New user has empty catalog, so recommendations should be empty or default
    const emptyRecsRes = await fetch(`${SERVER_BASE}/catalog/recommendations`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const emptyRecsJson = await emptyRecsRes.json();
    assert.equal(emptyRecsJson.success, true);
    assert.equal(emptyRecsJson.data.length, 0, 'Fresh user with no catalog has 0 personalized recommendations');

    // 3. User saves an item with a 10 rating (e.g., Project Hail Mary / Interstellar style)
    const saveRes = await fetch(`${SERVER_BASE}/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        id: 'user_saved_masterpiece_10',
        canonicalId: 'user_saved_masterpiece_10',
        title: 'Project Hail Mary',
        mediaType: 'Movie',
        userStatus: 'Completed',
        userRating: 10,
        isFavorite: 1,
        genres: ['Sci-Fi', 'Adventure']
      })
    });
    assert.equal(saveRes.status, 200);

    // 4. Stats should now reflect 10★ rating and Sci-Fi genre for this new user only
    const userStatsRes = await fetch(`${SERVER_BASE}/catalog/stats`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const userStats = await userStatsRes.json();
    assert.equal(userStats.data.totalTitles, 1);
    assert.equal(userStats.data.ratingSpread.tier10, 1);
    assert.equal(userStats.data.ratingSpread.averageRating, 10.0);
    assert.equal(userStats.data.completionVelocity.completedCount, 1);
    assert.equal(userStats.data.completionVelocity.velocityRating, 'Active Momentum');
  });
});
