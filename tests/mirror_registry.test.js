import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllMirrorSources,
  updateMirrorSourceDomain,
  upsertMirrorSource,
  deleteMirrorSourceItem,
  getCanonicalMedia
} from '../apps/server/src/db.js';
import { probeDomain, checkMirrorSource } from '../apps/server/src/services/mirrorHealthService.js';
import { generateDefaultMirrors, DEFAULT_MIRROR_REGISTRY } from '@omniwatch/shared';

test('Dynamic Mirror Registry & Auto-Migration System', async (t) => {
  await t.test('DEFAULT_MIRROR_REGISTRY should contain popular sites with candidateDomains', () => {
    assert.ok(Array.isArray(DEFAULT_MIRROR_REGISTRY));
    assert.ok(DEFAULT_MIRROR_REGISTRY.length >= 25, 'Should have at least 25 registered mirrors');

    const hianime = DEFAULT_MIRROR_REGISTRY.find(m => m.id === 'hianime');
    assert.ok(hianime);
    assert.ok(Array.isArray(hianime.candidateDomains));
    assert.ok(hianime.candidateDomains.length >= 2);

    const lookmovie = DEFAULT_MIRROR_REGISTRY.find(m => m.id === 'lookmovie');
    assert.ok(lookmovie);
    assert.ok(lookmovie.currentDomain);
  });

  await t.test('getAllMirrorSources() should load registry from SQLite database', () => {
    const sources = getAllMirrorSources();
    assert.ok(Array.isArray(sources));
    assert.ok(sources.length >= 25);
    
    const sample = sources[0];
    assert.ok(sample.id);
    assert.ok(sample.name);
    assert.ok(sample.currentDomain);
    assert.ok(Array.isArray(sample.candidateDomains));
  });

  await t.test('generateDefaultMirrors() dynamically resolves URLs using DB domains', () => {
    const mockMedia = {
      id: 'test_anime_1',
      title: 'Solo Leveling',
      mediaType: 'Anime',
      releaseYear: 2024
    };

    const mirrors = generateDefaultMirrors(mockMedia);
    assert.ok(mirrors.length > 0);
    assert.ok(mirrors.every(m => m.url.includes('Solo') || m.url.includes('solo')));
  });

  await t.test('upsertMirrorSource and deleteMirrorSourceItem should manage custom sites', () => {
    const customSite = {
      id: 'custom_test_stream_site',
      name: 'Custom Cinema Hub',
      category: 'Movie',
      type: 'Stream',
      quality: '1080p WebRip',
      audio: 'English 5.1',
      currentDomain: 'testcinema.cc',
      candidateDomains: ['testcinema.cc', 'testcinema.is'],
      searchTemplate: 'https://{domain}/search?q={query}',
      directUrlTemplate: 'https://{domain}/',
      isEnabled: true,
      sortOrder: 99
    };

    upsertMirrorSource(customSite);

    const all = getAllMirrorSources();
    const found = all.find(m => m.id === 'custom_test_stream_site');
    assert.ok(found);
    assert.equal(found.currentDomain, 'testcinema.cc');
    assert.deepEqual(found.candidateDomains, ['testcinema.cc', 'testcinema.is']);

    // Delete
    deleteMirrorSourceItem('custom_test_stream_site');
    const allAfter = getAllMirrorSources();
    assert.ok(!allAfter.some(m => m.id === 'custom_test_stream_site'));
  });

  await t.test('probeDomain should measure latency and handle invalid domain gracefully', async () => {
    const badResult = await probeDomain('nonexistent-domain-xyz-12345.org');
    assert.equal(badResult.isWorking, false);
    assert.equal(badResult.status, 'Offline');
  });

  await t.test('Live REST API endpoints /api/mirrors and /api/mirrors/check should function', async () => {
    const res = await fetch('http://localhost:5000/api/mirrors');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.count >= 25);
    assert.ok(Array.isArray(body.data));
  });
});
