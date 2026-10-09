import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePeachifyId,
  isPeachifySupported,
  buildPeachifyUrl,
  PEACHIFY_BASE_URL,
  PEACHIFY_DEFAULT_ACCENT
} from '../packages/shared/src/peachify.js';
import { TVMazeProvider } from '../apps/server/src/providers/TVMazeProvider.js';

test('Peachify Direct Streaming Architecture & Resolver Suite', async (t) => {

  await t.test('resolvePeachifyId should extract TMDB numeric ID from media.tmdbId', () => {
    const res = resolvePeachifyId({ tmdbId: 550, title: 'Fight Club' });
    assert.deepEqual(res, { type: 'tmdb', id: '550' });
  });

  await t.test('resolvePeachifyId should extract IMDb ID from media.imdbId', () => {
    const res = resolvePeachifyId({ imdbId: 'tt0137523', title: 'Fight Club' });
    assert.deepEqual(res, { type: 'imdb', id: 'tt0137523' });
  });

  await t.test('resolvePeachifyId should extract TMDB ID from providerMappings array', () => {
    const media = {
      title: 'Breaking Bad',
      providerMappings: [
        { provider: 'tvmaze', id: 169 },
        { provider: 'tmdb', id: 1396 }
      ]
    };
    const res = resolvePeachifyId(media);
    assert.deepEqual(res, { type: 'tmdb', id: '1396' });
    assert.equal(isPeachifySupported(media), true);
  });

  await t.test('resolvePeachifyId should extract IMDb ID from providerMappings array', () => {
    const media = {
      title: 'Game of Thrones',
      providerMappings: [
        { provider: 'tvmaze', id: 82 },
        { provider: 'imdb', id: 'tt0944947' }
      ]
    };
    const res = resolvePeachifyId(media);
    assert.deepEqual(res, { type: 'imdb', id: 'tt0944947' });
    assert.equal(isPeachifySupported(media), true);
  });

  await t.test('resolvePeachifyId should extract TMDB ID from providerMappings object', () => {
    const media = {
      title: 'Inception',
      providerMappings: {
        tmdb: '27205',
        imdb: 'tt1375666'
      }
    };
    const res = resolvePeachifyId(media);
    assert.deepEqual(res, { type: 'tmdb', id: '27205' });
  });

  await t.test('resolvePeachifyId should extract TMDB ID from canonical omni_tmdb ID string', () => {
    const movie = { id: 'omni_tmdb_m_157336', title: 'Interstellar' };
    const tv = { id: 'omni_tmdb_tv_76479', title: 'The Boys' };

    assert.deepEqual(resolvePeachifyId(movie), { type: 'tmdb', id: '157336' });
    assert.deepEqual(resolvePeachifyId(tv), { type: 'tmdb', id: '76479' });
  });

  await t.test('buildPeachifyUrl should generate Movie embed URL with emerald green accent', () => {
    const movie = {
      id: 'omni_tmdb_m_550',
      mediaType: 'Movie',
      title: 'Fight Club'
    };

    const url = buildPeachifyUrl(movie, { autoPlay: false });
    assert.ok(url.startsWith('https://peachify.top/embed/movie/550'));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('accent'), '10b981');
    assert.equal(parsed.searchParams.get('autoPlay'), 'false');
  });

  await t.test('buildPeachifyUrl should generate TV/Anime embed URL with season, episode, and autoNext', () => {
    const tv = {
      id: 'omni_tmdb_tv_76479',
      mediaType: 'Series',
      title: 'The Boys'
    };

    const url = buildPeachifyUrl(tv, { season: 3, episode: 4, autoPlay: true });
    assert.ok(url.startsWith('https://peachify.top/embed/tv/76479/3/4'));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('accent'), '10b981');
    assert.equal(parsed.searchParams.get('autoPlay'), 'true');
    assert.equal(parsed.searchParams.get('autoNext'), '30');
  });

  await t.test('buildPeachifyUrl should support IMDb ID for shows originating from TVMaze', () => {
    const tv = {
      id: 'omni_tv_82',
      mediaType: 'Series',
      title: 'Game of Thrones',
      providerMappings: [
        { provider: 'tvmaze', id: 82 },
        { provider: 'imdb', id: 'tt0944947' }
      ]
    };

    const url = buildPeachifyUrl(tv, { season: 1, episode: 1 });
    assert.ok(url.startsWith('https://peachify.top/embed/tv/tt0944947/1/1'));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('accent'), '10b981');
  });

  await t.test('buildPeachifyUrl should pass custom options (accent, startAt, dub, sub, server)', () => {
    const anime = {
      id: 'omni_tmdb_tv_1429',
      mediaType: 'Anime',
      title: 'Attack on Titan'
    };

    const url = buildPeachifyUrl(anime, {
      season: 2,
      episode: 5,
      accent: '#059669',
      startAt: 120,
      dub: 'Japanese',
      sub: 'English',
      server: 'iron'
    });

    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/embed/tv/1429/2/5');
    assert.equal(parsed.searchParams.get('accent'), '059669'); // Strips '#'
    assert.equal(parsed.searchParams.get('startAt'), '120');
    assert.equal(parsed.searchParams.get('dub'), 'Japanese');
    assert.equal(parsed.searchParams.get('sub'), 'English');
    assert.equal(parsed.searchParams.get('server'), 'iron');
  });

  await t.test('TVMazeProvider normalizeTVMazeShow maps show.externals.imdb to providerMappings', () => {
    const provider = new TVMazeProvider();
    const rawShow = {
      id: 82,
      name: 'Game of Thrones',
      genres: ['Drama', 'Fantasy'],
      externals: {
        imdb: 'tt0944947',
        thetvdb: 121361
      },
      _embedded: {
        episodes: [
          { id: 1, season: 1, number: 1, name: 'Winter Is Coming' }
        ]
      }
    };

    const normalized = provider.normalizeTVMazeShow(rawShow);
    const imdbMapping = normalized.providerMappings.find((m) => m.provider === 'imdb');
    assert.ok(imdbMapping, 'Should contain imdb provider mapping');
    assert.equal(imdbMapping.id, 'tt0944947');
    assert.equal(isPeachifySupported(normalized), true);
  });

  await t.test('buildPeachifyUrl and isPeachifySupported handle unsupported media safely', () => {
    assert.equal(isPeachifySupported(null), false);
    assert.equal(isPeachifySupported({}), false);
    assert.equal(isPeachifySupported({ id: 'custom_123', title: 'Unknown' }), false);
    assert.equal(buildPeachifyUrl(null), null);
    assert.equal(buildPeachifyUrl({ id: 'custom_123' }), null);
  });

  await t.test('Constants are correctly exported and configured', () => {
    assert.equal(PEACHIFY_BASE_URL, 'https://peachify.top');
    assert.equal(PEACHIFY_DEFAULT_ACCENT, '10b981');
  });

  await t.test('buildPeachifyUrl coerces invalid season and episode numbers safely', () => {
    const tv = { id: 'omni_tmdb_tv_100', mediaType: 'Series' };
    const url = buildPeachifyUrl(tv, { season: -5, episode: 'abc' });
    assert.ok(url.startsWith('https://peachify.top/embed/tv/100/1/1'));
  });
});
