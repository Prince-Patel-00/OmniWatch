import { BaseProvider } from './BaseProvider.js';
import { generateDefaultMirrors } from '@omniwatch/shared';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const TMDB_MOVIE_GENRES = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  'Sci-Fi': 878,
  Thriller: 53,
  War: 10752,
  Western: 37
};

const TMDB_TV_GENRES = {
  Action: 10759,
  Adventure: 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Kids: 10762,
  Mystery: 9648,
  News: 10763,
  Reality: 10764,
  'Sci-Fi': 10765,
  Fantasy: 10765,
  Soap: 10766,
  Talk: 10767,
  War: 10768,
  Western: 37
};
const TMDB_ALL_GENRES_MAP = {
  ...Object.fromEntries(Object.entries(TMDB_MOVIE_GENRES).map(([name, id]) => [id, name])),
  ...Object.fromEntries(Object.entries(TMDB_TV_GENRES).map(([name, id]) => [id, name]))
};

export class TMDBProvider extends BaseProvider {
  constructor(apiKey = process.env.TMDB_API_KEY) {
    super('tmdb', {
      movies: true,
      series: true,
      anime: true,
      episodes: true,
      trailers: true,
      watchProviders: true
    });
    this.apiKey = apiKey || null;
    if (!this.apiKey) {
      console.log('ℹ️ [TMDBProvider] No TMDB_API_KEY detected in environment. TMDB adapter is dormant until a key is set in .env.');
    }
  }

  isAvailable() {
    if (!this.apiKey && process.env.TMDB_API_KEY) {
      this.apiKey = process.env.TMDB_API_KEY;
    }
    return Boolean(this.apiKey);
  }

  async tmdbFetch(endpoint, params = {}) {
    if (!this.isAvailable()) return null;

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }

    return await this.fetchWithTimeout(url.toString(), {}, 8000);
  }

  normalizeTMDBItem(item, detailed = false) {
    if (!item) return null;
    // Skip raw person entities from multi-search
    if (item.media_type === 'person') return null;

    const isMovie = item.media_type === 'movie' || Boolean(item.title) || !item.name;
    const mediaType = isMovie ? 'Movie' : 'Series';

    const title = item.title || item.name || 'Untitled';
    const originalTitle = item.original_title || item.original_name || title;
    const releaseDate = item.release_date || item.first_air_date || null;
    const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;

    const posterUrl = item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null;
    const backdropUrl = item.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}` : posterUrl;

    const rating = item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : null;

    let status = 'Released';
    if (item.status === 'In Production' || item.status === 'Planned') status = 'Upcoming';
    else if (item.status === 'Returning Series') status = 'Airing';
    else if (item.status === 'Ended' || item.status === 'Canceled') status = 'Completed';

    let genres = (item.genres || []).map(g => g.name);
    if (genres.length === 0 && Array.isArray(item.genre_ids)) {
      genres = item.genre_ids.map(id => TMDB_ALL_GENRES_MAP[id]).filter(Boolean);
    }

    // Cast & Crew
    let cast = (item.credits?.cast || []).slice(0, 10).map((c, idx) => ({
      character: c.character,
      characterImage: c.profile_path ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}` : null,
      actor: c.name,
      actorImage: c.profile_path ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}` : null,
      role: idx < 3 ? 'MAIN' : 'SUPPORTING'
    }));

    // If item was derived from an actor / credit search, inject the matched actor & role
    if (item.matchedPerson) {
      const charName = item.character || item.matchedPerson.character || 'Lead';
      const actorName = item.matchedPerson.name;
      const existingIdx = cast.findIndex(c => (c.actor || '').toLowerCase() === actorName.toLowerCase());
      if (existingIdx >= 0) {
        cast[existingIdx].character = charName;
        cast[existingIdx].role = 'MAIN';
      } else {
        cast.unshift({
          character: charName,
          characterImage: null,
          actor: actorName,
          actorImage: item.matchedPerson.image || null,
          role: 'MAIN'
        });
      }
    }

    const directors = (item.credits?.crew || [])
      .filter(c => c.job === 'Director')
      .map(c => c.name);

    const creators = (item.created_by || []).map(c => c.name).concat(directors);

    // Trailers (YouTube)
    const trailers = [];
    const videos = item.videos?.results || [];
    for (const v of videos) {
      if (v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) {
        trailers.push({
          site: 'YouTube',
          videoKey: v.key,
          title: v.name,
          thumbnailUrl: `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`,
          isOfficial: Boolean(v.official)
        });
      }
    }

    // Official Watch Providers (JustWatch via TMDB)
    const watchProviders = [];
    const allProviders = item['watch/providers']?.results || {};
    for (const [regionCode, regData] of Object.entries(allProviders)) {
      const link = regData.link;
      // Flatrate
      if (Array.isArray(regData.flatrate)) {
        for (const p of regData.flatrate) {
          watchProviders.push({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${TMDB_IMAGE_BASE}/original${p.logo_path}` : null,
            region: regionCode,
            type: 'FLATRATE',
            webUrl: link,
            priority: p.display_priority || 10
          });
        }
      }
      // Rent
      if (Array.isArray(regData.rent)) {
        for (const p of regData.rent) {
          watchProviders.push({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${TMDB_IMAGE_BASE}/original${p.logo_path}` : null,
            region: regionCode,
            type: 'RENT',
            webUrl: link,
            priority: p.display_priority || 15
          });
        }
      }
      // Buy
      if (Array.isArray(regData.buy)) {
        for (const p of regData.buy) {
          watchProviders.push({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${TMDB_IMAGE_BASE}/original${p.logo_path}` : null,
            region: regionCode,
            type: 'BUY',
            webUrl: link,
            priority: p.display_priority || 20
          });
        }
      }
      // Free / Ads
      if (Array.isArray(regData.free) || Array.isArray(regData.ads)) {
        const freeItems = (regData.free || []).concat(regData.ads || []);
        for (const p of freeItems) {
          watchProviders.push({
            name: p.provider_name,
            logoUrl: p.logo_path ? `${TMDB_IMAGE_BASE}/original${p.logo_path}` : null,
            region: regionCode,
            type: 'FREE',
            webUrl: link,
            priority: p.display_priority || 5
          });
        }
      }
    }

    // Seasons summary for TV
    const seasons = [];
    if (!isMovie && Array.isArray(item.seasons)) {
      for (const s of item.seasons) {
        if (s.season_number > 0) {
          seasons.push({
            seasonNumber: s.season_number,
            title: s.name,
            overview: s.overview,
            episodeCount: s.episode_count || 0,
            posterUrl: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : null,
            airDate: s.air_date,
            episodes: []
          });
        }
      }
    }

    const totalEpisodes = isMovie ? null : (item.number_of_episodes || null);
    const totalSeasons = isMovie ? 1 : (item.number_of_seasons || seasons.length || 1);

    return {
      id: `omni_tmdb_${isMovie ? 'm' : 'tv'}_${item.id}`,
      mediaType,
      title,
      originalTitle,
      romajiTitle: null,
      synopsis: item.overview || '',
      tagline: item.tagline || null,
      releaseDate,
      releaseYear,
      runtimeMinutes: item.runtime || (item.episode_run_time ? item.episode_run_time[0] : null) || (isMovie ? 110 : 45),
      status,
      rating,
      voteCount: item.vote_count || 0,
      popularityScore: item.popularity || 0,
      posterUrl,
      backdropUrl,
      bannerUrl: backdropUrl,
      genres,
      countryOfOrigin: (item.origin_country && item.origin_country[0]) || (item.production_countries && item.production_countries[0]?.iso_3166_1) || 'US',
      studios: (item.production_companies || []).map(p => p.name),
      networks: (item.networks || []).map(n => n.name),
      creators,
      cast,
      mainCharacters: (() => {
        const mains = cast.filter(c => c.role === 'MAIN');
        return (mains.length > 0 ? mains : cast).slice(0, 4).map(c => ({
          name: c.character || c.actor,
          image: c.characterImage || c.actorImage || null,
          role: c.role || 'MAIN',
          actor: c.actor || null
        }));
      })(),
      matchedPerson: item.matchedPerson || null,
      matchedCharacter: item.matchedPerson ? {
        name: item.matchedPerson.character || item.matchedPerson.name,
        actor: item.matchedPerson.name,
        image: item.matchedPerson.image || null,
        role: 'MAIN'
      } : null,
      totalSeasons,
      totalEpisodes,
      nextAiringEpisode: item.next_episode_to_air?.episode_number || null,
      nextAiringAt: item.next_episode_to_air?.air_date || null,
      providerMappings: [
        {
          provider: 'tmdb',
          id: item.id,
          url: `https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${item.id}`
        }
      ],
      seasons,
      trailers,
      watchProviders,
      sources: generateDefaultMirrors({
        title,
        mediaType,
        isMovie
      })
    };
  }

  async searchPersonCredits(personQuery, { type = 'All', page = 1, limit = 24 } = {}) {
    if (!this.isAvailable() || !personQuery?.trim()) return [];

    try {
      const q = personQuery.trim();
      const personRes = await this.tmdbFetch('/search/person', { query: q, page: 1 });
      const persons = personRes?.results || [];
      if (persons.length === 0) return [];

      // Find top matched person
      const qLower = q.toLowerCase();
      const topPerson = persons.find(p => p.name?.toLowerCase() === qLower) || persons[0];
      if (!topPerson || !topPerson.id) return [];

      const creditsRes = await this.tmdbFetch(`/person/${topPerson.id}/combined_credits`);
      const rawCredits = creditsRes?.cast || [];
      if (rawCredits.length === 0) return [];

      // Filter out talk show / self appearances unless that's all that exists
      let filteredCredits = rawCredits.filter(c => {
        const char = (c.character || '').trim().toLowerCase();
        const isTalkShow = char.startsWith('self') || char === '' || c.genre_ids?.includes(10767);
        return !isTalkShow;
      });

      if (filteredCredits.length === 0) {
        filteredCredits = rawCredits;
      }

      // Filter by type if requested
      if (type === 'Movie') {
        filteredCredits = filteredCredits.filter(c => c.media_type === 'movie');
      } else if (type === 'Series') {
        filteredCredits = filteredCredits.filter(c => c.media_type === 'tv');
      }

      // Sort by popularity descending
      filteredCredits.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      const personImage = topPerson.profile_path ? `${TMDB_IMAGE_BASE}/w185${topPerson.profile_path}` : null;
      const matchedPerson = {
        name: topPerson.name,
        image: personImage,
        type: 'ACTOR'
      };

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 24);
      const offset = (pageNum - 1) * limitNum;

      const items = filteredCredits.slice(offset, offset + limitNum).map(credit => {
        const withPerson = {
          ...credit,
          matchedPerson: {
            ...matchedPerson,
            character: credit.character
          }
        };
        return this.normalizeTMDBItem(withPerson);
      }).filter(Boolean);

      return items;
    } catch (err) {
      console.warn('[TMDBProvider] searchPersonCredits error:', err.message);
      return [];
    }
  }

  async search(query, { type = 'All', page = 1, genre = 'All', character = null, searchMode = 'all' } = {}) {
    if (!this.isAvailable() || (!query?.trim() && !character?.trim())) return [];

    const cleanQ = (query || character || '').trim();
    const isCharacterSearch = Boolean(character) || searchMode === 'character';

    // If explicit character/actor search, query person credits directly
    if (isCharacterSearch) {
      const personHits = await this.searchPersonCredits(character || cleanQ, { type, page, limit: 30 });
      if (personHits.length > 0) return personHits;
    }

    let endpoint = '/search/multi';
    if (type === 'Movie') endpoint = '/search/movie';
    else if (type === 'Series') endpoint = '/search/tv';

    try {
      const [titleRes, personItems] = await Promise.all([
        this.tmdbFetch(endpoint, { query: cleanQ, page }),
        this.searchPersonCredits(cleanQ, { type, page, limit: 24 }).catch(() => [])
      ]);

      let items = (titleRes?.results || [])
        .filter(r => r.media_type !== 'person') // Skip raw person entities from multi-search
        .map(r => this.normalizeTMDBItem(r))
        .filter(Boolean);

      if (Array.isArray(personItems) && personItems.length > 0) {
        // Prepend person credit items so actor filmography appears at the top
        items = [...personItems, ...items];
      }

      if (genre && genre !== 'All') {
        const gLower = genre.toLowerCase();
        items = items.filter(it => (it.genres || []).some(g => g.toLowerCase().includes(gLower)));
      }
      return items;
    } catch (err) {
      console.error('[TMDBProvider] search error:', err.message);
      return [];
    }
  }

  async getTrending({ type = 'All', timeWindow = 'week', page = 1, genre = 'All', sort = 'popularity_desc' } = {}) {
    if (!this.isAvailable()) return [];

    const isCustomFilter = (genre && genre !== 'All') || (sort && sort !== 'popularity_desc');

    if (isCustomFilter) {
      const results = [];
      const today = new Date().toISOString().split('T')[0];

      // Build movie discover params
      if (type === 'All' || type === 'Movie') {
        const movieParams = { page };
        if (genre && genre !== 'All' && TMDB_MOVIE_GENRES[genre]) {
          movieParams.with_genres = TMDB_MOVIE_GENRES[genre];
        }
        if (sort === 'rating_desc') {
          movieParams.sort_by = 'vote_average.desc';
          movieParams['vote_count.gte'] = 50;
        } else if (sort === 'release_desc' || sort === 'year_desc') {
          movieParams.sort_by = 'primary_release_date.desc';
          movieParams['primary_release_date.lte'] = today;
          movieParams['vote_count.gte'] = 10;
        } else if (sort === 'title_asc') {
          movieParams.sort_by = 'title.asc';
        } else {
          movieParams.sort_by = 'popularity.desc';
        }

        try {
          const res = await this.tmdbFetch('/discover/movie', movieParams);
          results.push(...(res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean));
        } catch (e) {
          console.warn('[TMDBProvider] discover movie error:', e.message);
        }
      }

      // Build tv discover params
      if (type === 'All' || type === 'Series') {
        const tvParams = { page };
        if (genre && genre !== 'All' && TMDB_TV_GENRES[genre]) {
          tvParams.with_genres = TMDB_TV_GENRES[genre];
        }
        if (sort === 'rating_desc') {
          tvParams.sort_by = 'vote_average.desc';
          tvParams['vote_count.gte'] = 30;
        } else if (sort === 'release_desc' || sort === 'year_desc') {
          tvParams.sort_by = 'first_air_date.desc';
          tvParams['first_air_date.lte'] = today;
          tvParams['vote_count.gte'] = 10;
        } else if (sort === 'title_asc') {
          tvParams.sort_by = 'name.asc';
        } else {
          tvParams.sort_by = 'popularity.desc';
        }

        try {
          const res = await this.tmdbFetch('/discover/tv', tvParams);
          results.push(...(res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean));
        } catch (e) {
          console.warn('[TMDBProvider] discover tv error:', e.message);
        }
      }

      return results;
    }

    let endpoint = `/trending/all/${timeWindow}`;
    if (type === 'Movie') endpoint = `/trending/movie/${timeWindow}`;
    else if (type === 'Series') endpoint = `/trending/tv/${timeWindow}`;

    try {
      const res = await this.tmdbFetch(endpoint, { page });
      return (res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean);
    } catch (err) {
      console.error('[TMDBProvider] getTrending error:', err.message);
      return [];
    }
  }

  async getUpcoming({ type = 'Movie', page = 1, genre = 'All', sort = 'release_desc' } = {}) {
    if (!this.isAvailable()) return [];

    const today = new Date().toISOString().split('T')[0];

    if (genre && genre !== 'All') {
      if (type === 'Series') {
        const params = {
          page,
          'air_date.gte': today,
          sort_by: 'first_air_date.asc'
        };
        if (TMDB_TV_GENRES[genre]) params.with_genres = TMDB_TV_GENRES[genre];
        try {
          const res = await this.tmdbFetch('/discover/tv', params);
          return (res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean);
        } catch (e) {
          return [];
        }
      } else {
        const params = {
          page,
          'primary_release_date.gte': today,
          sort_by: 'primary_release_date.asc'
        };
        if (TMDB_MOVIE_GENRES[genre]) params.with_genres = TMDB_MOVIE_GENRES[genre];
        try {
          const res = await this.tmdbFetch('/discover/movie', params);
          return (res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean);
        } catch (e) {
          return [];
        }
      }
    }

    const endpoint = type === 'Series' ? '/tv/on_the_air' : '/movie/upcoming';
    try {
      const res = await this.tmdbFetch(endpoint, { page });
      return (res?.results || []).map(r => this.normalizeTMDBItem(r)).filter(Boolean);
    } catch (err) {
      console.error('[TMDBProvider] getUpcoming error:', err.message);
      return [];
    }
  }

  async getDetail(externalId) {
    if (!this.isAvailable()) return null;

    const parts = String(externalId).split('_');
    const isTv = parts.includes('tv');
    const id = parts[parts.length - 1];

    const endpoint = isTv ? `/tv/${id}` : `/movie/${id}`;
    try {
      const res = await this.tmdbFetch(endpoint, {
        append_to_response: 'credits,videos,watch/providers,recommendations'
      });
      return this.normalizeTMDBItem(res, true);
    } catch (err) {
      console.error('[TMDBProvider] getDetail error:', err.message);
      return null;
    }
  }

  async getSeasonEpisodes(tvId, seasonNumber) {
    if (!this.isAvailable()) return [];

    try {
      const res = await this.tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
      return (res?.episodes || []).map(e => ({
        episodeNumber: e.episode_number,
        title: e.name,
        overview: e.overview,
        airDate: e.air_date,
        runtimeMinutes: e.runtime,
        stillUrl: e.still_path ? `${TMDB_IMAGE_BASE}/w300${e.still_path}` : null,
        voteAverage: e.vote_average
      }));
    } catch (err) {
      console.error('[TMDBProvider] getSeasonEpisodes error:', err.message);
      return [];
    }
  }
}
