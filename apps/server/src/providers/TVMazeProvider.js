import { BaseProvider } from './BaseProvider.js';
import { getPlatformLogo, generateDefaultMirrors } from '@omniwatch/shared';

const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

export class TVMazeProvider extends BaseProvider {
  constructor() {
    super('tvmaze', {
      series: true,
      episodes: true,
      watchProviders: true
    });
  }

  normalizeTVMazeShow(show, embedded = {}) {
    if (!show) return null;

    const isAnimation = show.type === 'Animation' || (show.genres && show.genres.includes('Anime'));
    const mediaType = isAnimation ? 'Anime' : 'Series';

    let status = 'Released';
    if (show.status === 'Running') status = 'Airing';
    else if (show.status === 'Ended') status = 'Completed';
    else if (show.status === 'In Development') status = 'Upcoming';

    const rating = show.rating?.average ? parseFloat(show.rating.average.toFixed(1)) : null;
    const releaseDate = show.premiered || null;
    const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;

    const posterUrl = show.image?.original || show.image?.medium || null;
    const backdropUrl = posterUrl;

    const cleanSynopsis = (show.summary || '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();

    const networkName = show.webChannel?.name || show.network?.name || null;
    const networks = networkName ? [networkName] : [];

    // Cast
    const rawCast = embedded.cast || show._embedded?.cast || [];
    const cast = rawCast.slice(0, 8).map(c => ({
      character: c.character?.name,
      characterImage: c.character?.image?.medium,
      actor: c.person?.name,
      actorImage: c.person?.image?.medium
    }));

    // Watch Providers from network / webChannel
    const watchProviders = [];
    if (networkName) {
      watchProviders.push({
        name: networkName,
        logoUrl: getPlatformLogo(networkName),
        region: 'Global',
        type: 'FLATRATE',
        webUrl: show.officialSite || null,
        priority: 1
      });
    }

    // Seasons & Episodes
    const rawEpisodes = embedded.episodes || show._embedded?.episodes || [];
    const seasonsMap = {};

    for (const ep of rawEpisodes) {
      const sNum = ep.season || 1;
      if (!seasonsMap[sNum]) {
        seasonsMap[sNum] = {
          seasonNumber: sNum,
          title: `Season ${sNum}`,
          episodeCount: 0,
          episodes: []
        };
      }

      seasonsMap[sNum].episodeCount++;
      seasonsMap[sNum].episodes.push({
        episodeNumber: ep.number || seasonsMap[sNum].episodes.length + 1,
        title: ep.name || `Episode ${ep.number}`,
        overview: (ep.summary || '').replace(/<\/?[^>]+(>|$)/g, '').trim(),
        airDate: ep.airdate || null,
        runtimeMinutes: ep.runtime || show.runtime || 45,
        stillUrl: ep.image?.original || ep.image?.medium || null,
        voteAverage: ep.rating?.average || null,
        links: [
          `https://7reels.cc/search?q=${encodeURIComponent(show.name)}`,
          `https://www.1flex.org/search?q=${encodeURIComponent(show.name)}`
        ]
      });
    }

    const seasons = Object.values(seasonsMap).sort((a, b) => a.seasonNumber - b.seasonNumber);
    const totalEpisodes = rawEpisodes.length > 0 ? rawEpisodes.length : null;

    return {
      id: `omni_tv_${show.id}`,
      mediaType,
      title: show.name,
      originalTitle: show.name,
      romajiTitle: null,
      synopsis: cleanSynopsis,
      releaseDate,
      releaseYear,
      runtimeMinutes: show.averageRuntime || show.runtime || 45,
      status,
      rating,
      voteCount: show.weight || 0,
      popularityScore: show.weight || 0,
      posterUrl,
      backdropUrl,
      bannerUrl: backdropUrl,
      genres: show.genres && show.genres.length > 0 ? show.genres : ['Drama'],
      countryOfOrigin: show.network?.country?.code || 'US',
      studios: networks,
      networks,
      creators: [],
      cast,
      totalSeasons: seasons.length > 0 ? seasons.length : 1,
      totalEpisodes,
      nextAiringEpisode: null,
      nextAiringAt: null,
      providerMappings: [
        {
          provider: 'tvmaze',
          id: show.id,
          url: show.url
        }
      ],
      seasons,
      trailers: [],
      watchProviders,
      sources: generateDefaultMirrors({
        title: show.name,
        mediaType,
        isMovie: false
      })
    };
  }

  async search(query) {
    if (!query || !query.trim()) return [];

    try {
      const results = await this.fetchWithTimeout(
        `${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(query.trim())}`
      );
      return (results || []).map(r => this.normalizeTVMazeShow(r.show)).filter(Boolean);
    } catch (err) {
      console.error('[TVMazeProvider] search error:', err.message);
      return [];
    }
  }

  async getTrending() {
    try {
      // TVMaze schedules for today / high weight shows
      const shows = await this.fetchWithTimeout(`${TVMAZE_BASE_URL}/shows?page=0`);
      // Sort by weight descending
      const sorted = (shows || []).sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 20);
      return sorted.map(s => this.normalizeTVMazeShow(s)).filter(Boolean);
    } catch (err) {
      console.error('[TVMazeProvider] getTrending error:', err.message);
      return [];
    }
  }

  async getDetail(externalId) {
    const id = String(externalId).replace(/^omni_tv_/, '');
    if (!id) return null;

    try {
      const show = await this.fetchWithTimeout(
        `${TVMAZE_BASE_URL}/shows/${id}?embed[]=episodes&embed[]=cast`
      );
      return this.normalizeTVMazeShow(show, show._embedded || {});
    } catch (err) {
      console.error('[TVMazeProvider] getDetail error:', err.message);
      return null;
    }
  }
}
