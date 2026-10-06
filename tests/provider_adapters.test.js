import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AniListProvider } from '../apps/server/src/providers/AniListProvider.js';
import { TVMazeProvider } from '../apps/server/src/providers/TVMazeProvider.js';
import { KitsuProvider } from '../apps/server/src/providers/KitsuProvider.js';
import { TMDBProvider } from '../apps/server/src/providers/TMDBProvider.js';

describe('OmniWatch Multi-Provider Adapters & Normalization', () => {
  const anilist = new AniListProvider();
  const tvmaze = new TVMazeProvider();
  const kitsu = new KitsuProvider();
  const tmdb = new TMDBProvider();

  it('AniListProvider should correctly normalize raw GraphQL anime item', () => {
    const raw = {
      id: 16498,
      title: { english: 'Attack on Titan', romaji: 'Shingeki no Kyojin', native: '進撃の巨人' },
      description: 'Humanity lives inside cities surrounded by enormous walls...',
      format: 'TV',
      status: 'FINISHED',
      startDate: { year: 2013, month: 4, day: 7 },
      episodes: 25,
      duration: 24,
      coverImage: { large: 'https://example.com/aot.jpg' },
      bannerImage: 'https://example.com/banner.jpg',
      genres: ['Action', 'Drama', 'Fantasy'],
      averageScore: 85,
      popularity: 350000,
      trailer: { id: 'LHtdKWJmk42', site: 'youtube' },
      externalLinks: [
        { site: 'Crunchyroll', url: 'https://crunchyroll.com/series/aot', type: 'STREAMING' },
        { site: 'Netflix', url: 'https://netflix.com/title/aot', type: 'STREAMING' }
      ]
    };

    const normalized = anilist.normalizeAniListMedia(raw);
    assert.equal(normalized.id, 'omni_ani_16498');
    assert.equal(normalized.title, 'Attack on Titan');
    assert.equal(normalized.originalTitle, '進撃の巨人');
    assert.equal(normalized.mediaType, 'Anime');
    assert.equal(normalized.format, 'Series');
    assert.equal(normalized.isMovie, false);
    assert.equal(normalized.rating, 8.5);
    assert.equal(normalized.releaseYear, 2013);
    assert.equal(normalized.trailers.length, 1);
    assert.equal(normalized.trailers[0].videoKey, 'LHtdKWJmk42');
    assert.equal(normalized.watchProviders.length, 2);
    assert.equal(normalized.watchProviders[0].name, 'Crunchyroll');
  });

  it('AniListProvider should keep Anime Movies under Anime with format Movie', () => {
    const rawMovie = {
      id: 199,
      title: { english: 'Spirited Away', romaji: 'Sen to Chihiro no Kamikakushi' },
      description: 'During her family move to the suburbs...',
      format: 'MOVIE',
      status: 'FINISHED',
      startDate: { year: 2001, month: 7, day: 20 },
      episodes: 1,
      duration: 125,
      coverImage: { large: 'https://example.com/spirited.jpg' },
      bannerImage: 'https://example.com/spirited_banner.jpg',
      genres: ['Animation', 'Adventure', 'Supernatural'],
      averageScore: 89,
      popularity: 420000
    };

    const normalized = anilist.normalizeAniListMedia(rawMovie);
    assert.equal(normalized.id, 'omni_ani_199');
    assert.equal(normalized.title, 'Spirited Away');
    assert.equal(normalized.mediaType, 'Anime');
    assert.equal(normalized.format, 'Movie');
    assert.equal(normalized.isMovie, true);
  });

  it('TVMazeProvider should correctly normalize raw TV show item and seasons', () => {
    const rawShow = {
      id: 169,
      name: 'Breaking Bad',
      type: 'Scripted',
      status: 'Ended',
      premiered: '2008-01-20',
      runtime: 47,
      rating: { average: 9.2 },
      image: { original: 'https://example.com/bb.jpg' },
      summary: '<p>A chemistry teacher diagnosed with cancer...</p>',
      genres: ['Drama', 'Crime', 'Thriller'],
      network: { name: 'AMC', country: { code: 'US' } }
    };

    const embedded = {
      episodes: [
        { season: 1, number: 1, name: 'Pilot', runtime: 58, airdate: '2008-01-20' },
        { season: 1, number: 2, name: "Cat's in the Bag...", runtime: 48, airdate: '2008-01-27' }
      ]
    };

    const normalized = tvmaze.normalizeTVMazeShow(rawShow, embedded);
    assert.equal(normalized.id, 'omni_tv_169');
    assert.equal(normalized.title, 'Breaking Bad');
    assert.equal(normalized.mediaType, 'Series');
    assert.equal(normalized.rating, 9.2);
    assert.equal(normalized.networks[0], 'AMC');
    assert.equal(normalized.seasons.length, 1);
    assert.equal(normalized.seasons[0].episodes.length, 2);
  });

  it('KitsuProvider should normalize Kitsu JSON:API attributes', () => {
    const rawKitsu = {
      id: '12',
      attributes: {
        canonicalTitle: 'One Piece',
        subtype: 'TV',
        status: 'current',
        averageRating: '84.2',
        startDate: '1999-10-20',
        posterImage: { large: 'https://example.com/op.jpg' },
        youtubeVideoId: 'S8_YwFLCh4U',
        episodeCount: 1100
      }
    };

    const normalized = kitsu.normalizeKitsuItem(rawKitsu);
    assert.equal(normalized.id, 'omni_kitsu_12');
    assert.equal(normalized.title, 'One Piece');
    assert.equal(normalized.mediaType, 'Anime');
    assert.equal(normalized.format, 'Series');
    assert.equal(normalized.isMovie, false);
    assert.equal(normalized.status, 'Airing');
    assert.equal(normalized.trailers[0].videoKey, 'S8_YwFLCh4U');
  });

  it('KitsuProvider should keep Anime Movies under Anime with format Movie', () => {
    const rawKitsuMovie = {
      id: '50',
      attributes: {
        canonicalTitle: 'Your Name.',
        subtype: 'movie',
        status: 'finished',
        averageRating: '90.5',
        startDate: '2016-08-26',
        posterImage: { large: 'https://example.com/yourname.jpg' },
        episodeCount: 1
      }
    };

    const normalized = kitsu.normalizeKitsuItem(rawKitsuMovie);
    assert.equal(normalized.id, 'omni_kitsu_50');
    assert.equal(normalized.title, 'Your Name.');
    assert.equal(normalized.mediaType, 'Anime');
    assert.equal(normalized.format, 'Movie');
    assert.equal(normalized.isMovie, true);
  });

  it('TMDBProvider should report capability status depending on API key availability', () => {
    assert.equal(typeof tmdb.isAvailable(), 'boolean');
  });
});
