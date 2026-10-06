import { BaseProvider } from './BaseProvider.js';
import { generateDefaultMirrors } from '@omniwatch/shared';

const KITSU_BASE_URL = 'https://kitsu.io/api/edge';

export class KitsuProvider extends BaseProvider {
  constructor() {
    super('kitsu', {
      anime: true,
      movies: true,
      trailers: true
    });
  }

  normalizeKitsuItem(item) {
    if (!item || !item.attributes) return null;
    const attr = item.attributes;

    const title = attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Untitled Anime';
    const originalTitle = attr.titles?.ja_jp || attr.titles?.en_jp || title;
    const isMovie = attr.subtype === 'movie';
    const mediaType = 'Anime';
    const format = isMovie ? 'Movie' : 'Series';

    const posterUrl = attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || null;
    const backdropUrl = attr.coverImage?.large || attr.coverImage?.original || posterUrl;

    const rating = attr.averageRating ? parseFloat((parseFloat(attr.averageRating) / 10).toFixed(1)) : null;
    const releaseDate = attr.startDate || null;
    const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;

    let status = 'Released';
    if (attr.status === 'current') status = 'Airing';
    else if (attr.status === 'unreleased') status = 'Upcoming';
    else if (attr.status === 'finished') status = 'Completed';

    const trailers = [];
    if (attr.youtubeVideoId) {
      trailers.push({
        site: 'YouTube',
        videoKey: attr.youtubeVideoId,
        title: `${title} - Official Trailer`,
        thumbnailUrl: `https://img.youtube.com/vi/${attr.youtubeVideoId}/hqdefault.jpg`,
        isOfficial: true
      });
    }

    const episodeCount = attr.episodeCount || (isMovie ? null : 12);
    const seasons = isMovie ? [] : [
      {
        seasonNumber: 1,
        title: 'Season 1',
        episodeCount: episodeCount || 12,
        episodes: Array.from({ length: Math.min(episodeCount || 12, 100) }, (_, i) => ({
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
          runtimeMinutes: attr.episodeLength || 24,
          stillUrl: null
        }))
      }
    ];

    return {
      id: `omni_kitsu_${item.id}`,
      mediaType: 'Anime',
      format,
      isMovie,
      title,
      originalTitle,
      romajiTitle: attr.titles?.en_jp || null,
      synopsis: attr.synopsis || attr.description || '',
      tagline: null,
      releaseDate,
      releaseYear,
      runtimeMinutes: attr.episodeLength || (isMovie ? 110 : 24),
      status,
      rating,
      voteCount: attr.userCount || 0,
      popularityScore: attr.popularityRank ? 100000 - attr.popularityRank : 0,
      posterUrl,
      backdropUrl,
      bannerUrl: backdropUrl,
      genres: ['Animation', isMovie ? 'Drama' : 'Action'],
      countryOfOrigin: 'JP',
      studios: [],
      networks: [],
      creators: [],
      cast: [],
      totalSeasons: isMovie ? 1 : 1,
      totalEpisodes: episodeCount,
      nextAiringEpisode: null,
      nextAiringAt: null,
      providerMappings: [
        {
          provider: 'kitsu',
          id: item.id,
          url: `https://kitsu.io/anime/${item.id}`
        }
      ],
      seasons,
      trailers,
      watchProviders: [],
      sources: generateDefaultMirrors({
        title,
        mediaType,
        isMovie
      })
    };
  }

  async search(query, { format = null, isMovie = false, page = 1, limit = 20 } = {}) {
    if (!query?.trim()) return [];
    try {
      let filterSubtype = '';
      if (format === 'Movie' || isMovie === true) {
        filterSubtype = '&filter[subtype]=movie';
      } else if (format === 'Series') {
        filterSubtype = '&filter[subtype]=tv,ova,ona';
      }
      const offset = Math.max(0, (page - 1) * limit);
      const url = `${KITSU_BASE_URL}/anime?filter[text]=${encodeURIComponent(query.trim())}${filterSubtype}&page[limit]=${limit}&page[offset]=${offset}`;
      const res = await this.fetchWithTimeout(url);
      const items = res?.data || [];
      return items.map(i => this.normalizeKitsuItem(i)).filter(Boolean);
    } catch (err) {
      console.error('[KitsuProvider] search error:', err.message);
      return [];
    }
  }

  async getDetail(externalId) {
    const id = String(externalId).replace(/^omni_kitsu_/, '');
    if (!id) return null;
    try {
      const url = `${KITSU_BASE_URL}/anime/${id}`;
      const res = await this.fetchWithTimeout(url);
      return this.normalizeKitsuItem(res?.data);
    } catch (err) {
      console.error('[KitsuProvider] getDetail error:', err.message);
      return null;
    }
  }
}
