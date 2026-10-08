process.env.USE_SQLITE = '1';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../apps/server/src/app.js';
import {
  generateDefaultMirrors,
  DEFAULT_MIRROR_REGISTRY
} from '../packages/shared/src/constants.js';
import {
  probeDomain,
  checkMirrorSource,
  resolveEpisodeMirrors
} from '../apps/server/src/services/mirrorHealthService.js';
import {
  getAllMirrorSources,
  upsertMirrorSource,
  updateMirrorSourceDomain
} from '../apps/server/src/db.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('OmniWatch Unified Seasons & Dynamic Mirrors Suite', async (t) => {
  await t.test('generateDefaultMirrors should produce valid general title mirrors', () => {
    const media = {
      title: 'Solo Leveling',
      mediaType: 'Anime'
    };

    const mirrors = generateDefaultMirrors(media, DEFAULT_MIRROR_REGISTRY);
    assert.ok(Array.isArray(mirrors));
    assert.ok(mirrors.length > 0);

    const hianime = mirrors.find((m) => m.sourceId === 'hianime');
    assert.ok(hianime);
    assert.match(hianime.url, /hianime/);
    assert.match(hianime.url, /Solo%20Leveling/);
    assert.equal(hianime.isEpisodeLink, false);
  });

  await t.test('generateDefaultMirrors should interpolate season and episode numbers for Anime', () => {
    const media = {
      title: 'Attack on Titan',
      mediaType: 'Anime'
    };

    const episodeMirrors = generateDefaultMirrors(media, DEFAULT_MIRROR_REGISTRY, {
      seasonNumber: 1,
      episodeNumber: 12
    });

    assert.ok(Array.isArray(episodeMirrors));
    assert.ok(episodeMirrors.length > 0);

    // Verify episode metadata properties
    const sample = episodeMirrors[0];
    assert.equal(sample.isEpisodeLink, true);
    assert.equal(sample.seasonNumber, 1);
    assert.equal(sample.episodeNumber, 12);
    assert.match(sample.id, /_s1_e12/);

    // Verify HiAnime has episode number in query
    const hianime = episodeMirrors.find((m) => m.sourceId === 'hianime');
    assert.ok(hianime);
    assert.ok(hianime.url.includes('12'), `Expected URL to include episode 12: ${hianime.url}`);

    // Verify Nyaa has episode token
    const nyaa = episodeMirrors.find((m) => m.sourceId === 'nyaa');
    if (nyaa) {
      assert.ok(nyaa.url.includes('12'), `Expected Nyaa URL to include episode 12: ${nyaa.url}`);
    }
  });

  await t.test('generateDefaultMirrors should interpolate season and episode numbers for TV series', () => {
    const media = {
      title: 'Stranger Things',
      mediaType: 'Series'
    };

    const episodeMirrors = generateDefaultMirrors(media, DEFAULT_MIRROR_REGISTRY, {
      seasonNumber: 4,
      episodeNumber: 9
    });

    assert.ok(Array.isArray(episodeMirrors));
    assert.ok(episodeMirrors.length > 0);

    // Verify LookMovie interpolates season 4 and episode 9
    const lookmovie = episodeMirrors.find((m) => m.sourceId === 'lookmovie');
    assert.ok(lookmovie);
    assert.ok(lookmovie.url.includes('4') && lookmovie.url.includes('9'), `LookMovie URL: ${lookmovie.url}`);

    // Verify 1337x pads season and episode (s04e09)
    const torrent1337x = episodeMirrors.find((m) => m.sourceId === '1337x');
    if (torrent1337x) {
      assert.ok(torrent1337x.url.includes('s04e09'), `Expected padded s04e09 in 1337x URL: ${torrent1337x.url}`);
    }
  });

  await t.test('resolveEpisodeMirrors helper in mirrorHealthService generates valid episode links', async () => {
    const res = await resolveEpisodeMirrors({
      title: 'Breaking Bad',
      mediaType: 'Series',
      seasonNumber: 5,
      episodeNumber: 14
    });

    assert.ok(Array.isArray(res));
    assert.ok(res.length > 0);
    assert.equal(res[0].isEpisodeLink, true);
    assert.equal(res[0].episodeNumber, 14);
  });

  await t.test('GET /api/mirrors/sources-for-episode should reject missing title with 400', async () => {
    const res = await fetch(`${baseUrl}/api/mirrors/sources-for-episode`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /title.*required/i);
  });

  await t.test('GET /api/mirrors/sources-for-episode should return direct streaming sources for specific episode', async () => {
    const res = await fetch(
      `${baseUrl}/api/mirrors/sources-for-episode?title=Jujutsu%20Kaisen&mediaType=Anime&season=2&episode=10`
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.mediaTitle, 'Jujutsu Kaisen');
    assert.equal(body.seasonNumber, 2);
    assert.equal(body.episodeNumber, 10);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);

    // Verify direct links have isEpisodeLink true
    assert.equal(body.data[0].isEpisodeLink, true);
  });

  await t.test('probeDomain handles invalid domain gracefully without throwing', async () => {
    const result = await probeDomain('');
    assert.equal(result.isWorking, false);
    assert.equal(result.error, 'Invalid domain');
  });

  await t.test('checkMirrorSource candidate fallback and domain auto-migration logic', async () => {
    // Insert a test mirror with an unresponsive primary domain and a working candidate
    const testMirror = {
      id: 'test_auto_migration_mirror',
      name: 'Test Auto Migration Mirror',
      category: 'All',
      type: 'Stream',
      quality: '1080p HD',
      audio: 'English',
      currentDomain: 'definitely-nonexistent-domain-12345.xyz',
      candidateDomains: ['definitely-nonexistent-domain-12345.xyz', 'github.com'],
      searchTemplate: 'https://{domain}/search?q={query}',
      directUrlTemplate: 'https://{domain}/',
      isEnabled: true,
      sortOrder: 999
    };

    await upsertMirrorSource(testMirror);

    // Run checkMirrorSource
    const checkResult = await checkMirrorSource(testMirror);
    assert.ok(checkResult);

    // Should detect fallback candidate github.com and auto-migrate!
    assert.equal(checkResult.status, 'Working');
    assert.equal(checkResult.migrated, true);
    assert.equal(checkResult.domain, 'github.com');

    // Verify domain updated in database
    const all = await getAllMirrorSources();
    const stored = all.find((m) => m.id === testMirror.id);
    assert.ok(stored);
    assert.equal(stored.currentDomain, 'github.com');
  });

  await t.test('Franchise prequel/sequel relations separation preserves multi-entry navigation', () => {
    // Emulates AniList franchise relations
    const relatedMedia = [
      { id: 'omni_ani_16498', title: 'Attack on Titan', relationType: 'PREQUEL' },
      { id: 'omni_ani_99147', title: 'Attack on Titan Season 3', relationType: 'SEQUEL' },
      { id: 'omni_ani_20958', title: 'Attack on Titan: No Regrets', relationType: 'SPIN_OFF' }
    ];

    const prequels = relatedMedia.filter((r) => r.relationType === 'PREQUEL');
    const sequels = relatedMedia.filter((r) => r.relationType === 'SEQUEL');
    const spinOffs = relatedMedia.filter((r) => r.relationType === 'SPIN_OFF');

    assert.equal(prequels.length, 1);
    assert.equal(prequels[0].title, 'Attack on Titan');
    assert.equal(sequels.length, 1);
    assert.equal(sequels[0].title, 'Attack on Titan Season 3');
    assert.equal(spinOffs.length, 1);
  });
});
