import { BaseProvider } from './BaseProvider.js';
import { getPlatformLogo, generateDefaultMirrors } from '@omniwatch/shared';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export class AniListProvider extends BaseProvider {
  constructor() {
    super('anilist', {
      anime: true,
      movies: true, // Anime movies
      series: true, // Anime series
      episodes: true,
      trailers: true,
      watchProviders: true
    });
  }

  async executeGraphQL(query, variables = {}, timeoutMs = 8000) {
    const data = await this.fetchWithTimeout(
      ANILIST_GRAPHQL_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ query, variables })
      },
      timeoutMs
    );

    if (data.errors && data.errors.length > 0) {
      throw new Error(`[AniList] GraphQL Error: ${data.errors[0].message}`);
    }
    return data.data;
  }

  normalizeAniListMedia(alItem, matchedChar = null) {
    if (!alItem) return null;

    const titleEnglish = alItem.title?.english;
    const titleRomaji = alItem.title?.romaji;
    const titleNative = alItem.title?.native;
    const primaryTitle = titleEnglish || titleRomaji || titleNative || 'Untitled Anime';

    const isMovie = alItem.format === 'MOVIE';
    const mediaType = 'Anime';
    const format = isMovie ? 'Movie' : 'Series';

    let status = 'Released';
    if (alItem.status === 'RELEASING') status = 'Airing';
    else if (alItem.status === 'NOT_YET_RELEASED') status = 'Upcoming';
    else if (alItem.status === 'CANCELLED') status = 'Cancelled';
    else if (alItem.status === 'FINISHED') status = 'Completed';

    const rating = alItem.averageScore ? parseFloat((alItem.averageScore / 10).toFixed(1)) : null;
    const releaseYear = alItem.startDate?.year || alItem.seasonYear || null;
    const releaseDate = alItem.startDate?.year
      ? `${alItem.startDate.year}-${String(alItem.startDate.month || 1).padStart(2, '0')}-${String(alItem.startDate.day || 1).padStart(2, '0')}`
      : null;

    const posterUrl = alItem.coverImage?.extraLarge || alItem.coverImage?.large || alItem.coverImage?.medium || null;
    const backdropUrl = alItem.bannerImage || posterUrl;

    const cleanSynopsis = (alItem.description || '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();

    const studios = (alItem.studios?.nodes || []).map(n => n.name);

    let cast = (alItem.characters?.edges || []).map(edge => ({
      character: edge.node?.name?.full,
      characterImage: edge.node?.image?.medium,
      actor: edge.voiceActors?.[0]?.name?.full || null,
      actorImage: edge.voiceActors?.[0]?.image?.medium || null,
      role: edge.role || 'SUPPORTING'
    }));

    if (matchedChar && matchedChar.name) {
      const existingIdx = cast.findIndex(c => (c.character || '').toLowerCase() === matchedChar.name.toLowerCase());
      if (existingIdx >= 0) {
        cast[existingIdx].role = matchedChar.role || cast[existingIdx].role || 'MAIN';
        if (matchedChar.image) cast[existingIdx].characterImage = matchedChar.image;
      } else {
        cast.unshift({
          character: matchedChar.name,
          characterImage: matchedChar.image || null,
          actor: null,
          actorImage: null,
          role: matchedChar.role || 'MAIN'
        });
      }
    }

    // Trailers
    const trailers = [];
    if (alItem.trailer && alItem.trailer.site === 'youtube' && alItem.trailer.id) {
      trailers.push({
        site: 'YouTube',
        videoKey: alItem.trailer.id,
        title: `${primaryTitle} - Official Trailer`,
        thumbnailUrl: `https://img.youtube.com/vi/${alItem.trailer.id}/hqdefault.jpg`,
        isOfficial: true
      });
    }

    // Official Watch Providers from externalLinks
    const watchProviders = [];
    const validStreamingSites = ['Crunchyroll', 'Netflix', 'Hulu', 'Amazon Prime', 'HIDIVE', 'Disney+', 'Tubi'];
    if (Array.isArray(alItem.externalLinks)) {
      for (const link of alItem.externalLinks) {
        const site = link.site;
        const isStreaming = validStreamingSites.some(v => site.toLowerCase().includes(v.toLowerCase())) || link.type === 'STREAMING';
        if (isStreaming && link.url) {
          watchProviders.push({
            name: site,
            logoUrl: getPlatformLogo(site, link.icon),
            region: 'Global',
            type: 'FLATRATE',
            webUrl: link.url,
            priority: 1
          });
        }
      }
    }

    // Seasons & Episodes
    const episodeCount = alItem.episodes || (alItem.nextAiringEpisode ? alItem.nextAiringEpisode.episode : 12);
    const cleanSlug = encodeURIComponent(primaryTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
    const seasons = isMovie ? [] : [
      {
        seasonNumber: 1,
        title: 'Season 1',
        episodeCount,
        episodes: Array.from({ length: Math.min(episodeCount, 150) }, (_, i) => ({
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
          runtimeMinutes: alItem.duration || 24,
          stillUrl: null,
          links: [
            `https://hianime.org/watch/${cleanSlug}?ep=${i + 1}`,
            `https://subsplease.org/shows/${cleanSlug}/`
          ]
        }))
      }
    ];

    const nextAiringAt = alItem.nextAiringEpisode?.airingAt
      ? new Date(alItem.nextAiringEpisode.airingAt * 1000).toISOString()
      : null;

    // Related & Recommended Titles
    const relatedMedia = [];
    if (Array.isArray(alItem.relations?.edges)) {
      for (const edge of alItem.relations.edges) {
        if (edge.node) {
          relatedMedia.push({
            id: `omni_ani_${edge.node.id}`,
            title: edge.node.title?.english || edge.node.title?.romaji || 'Related',
            posterUrl: edge.node.coverImage?.large || edge.node.coverImage?.medium,
            mediaType: 'Anime',
            format: edge.node.format === 'MOVIE' ? 'Movie' : 'Series',
            isMovie: edge.node.format === 'MOVIE',
            relationType: edge.relationType,
            rating: edge.node.averageScore ? parseFloat((edge.node.averageScore / 10).toFixed(1)) : null
          });
        }
      }
    }

    if (Array.isArray(alItem.recommendations?.nodes)) {
      for (const node of alItem.recommendations.nodes) {
        const rec = node.mediaRecommendation;
        if (rec && !relatedMedia.some(r => r.id === `omni_ani_${rec.id}`)) {
          relatedMedia.push({
            id: `omni_ani_${rec.id}`,
            title: rec.title?.english || rec.title?.romaji || 'Recommended',
            posterUrl: rec.coverImage?.large || rec.coverImage?.medium,
            mediaType: 'Anime',
            format: rec.format === 'MOVIE' ? 'Movie' : 'Series',
            isMovie: rec.format === 'MOVIE',
            relationType: 'RECOMMENDED',
            rating: rec.averageScore ? parseFloat((rec.averageScore / 10).toFixed(1)) : null
          });
        }
      }
    }

    return {
      id: `omni_ani_${alItem.id}`,
      mediaType: 'Anime',
      format,
      isMovie,
      title: primaryTitle,
      originalTitle: titleNative || titleRomaji || primaryTitle,
      romajiTitle: titleRomaji || null,
      synopsis: cleanSynopsis,
      releaseDate,
      releaseYear,
      runtimeMinutes: alItem.duration || (isMovie ? 105 : 24),
      status,
      rating,
      voteCount: alItem.popularity || 0,
      popularityScore: alItem.popularity || 0,
      posterUrl,
      backdropUrl,
      bannerUrl: alItem.bannerImage || backdropUrl,
      genres: alItem.genres || ['Animation'],
      countryOfOrigin: 'JP',
      studios,
      networks: studios,
      creators: studios,
      cast,
      matchedCharacter: matchedChar || (cast.find(c => c.role === 'MAIN') ? {
        name: cast.find(c => c.role === 'MAIN').character,
        image: cast.find(c => c.role === 'MAIN').characterImage,
        role: 'MAIN'
      } : null),
      totalSeasons: isMovie ? 1 : Math.max(
        1,
        1 + (alItem.relations?.edges || []).filter(e => e.relationType === 'PREQUEL' || e.relationType === 'SEQUEL').length
      ),
      totalEpisodes: alItem.episodes || null,
      nextAiringEpisode: alItem.nextAiringEpisode?.episode || null,
      nextAiringAt,
      providerMappings: [
        {
          provider: 'anilist',
          id: alItem.id,
          url: `https://anilist.co/anime/${alItem.id}`
        }
      ],
      seasons,
      trailers,
      watchProviders,
      relatedMedia,
      sources: generateDefaultMirrors({
        title: primaryTitle,
        mediaType,
        isMovie
      })
    };
  }

  mapAniListSort(sort, defaultSort = ['POPULARITY_DESC']) {
    switch (sort) {
      case 'rating_desc':
        return ['SCORE_DESC', 'POPULARITY_DESC'];
      case 'release_desc':
      case 'year_desc':
        return ['START_DATE_DESC', 'POPULARITY_DESC'];
      case 'title_asc':
        return ['TITLE_ROMAJI'];
      case 'popularity_desc':
      default:
        return defaultSort;
    }
  }

  async search(query, { page = 1, perPage = 20, format = null, isMovie = null, genre = 'All', sort = 'popularity_desc', character = null, searchMode = 'all' } = {}) {
    if (searchMode === 'character' || (character && character.trim())) {
      return this.searchByCharacter(character || query, { page, perPage, format, isMovie, genre, sort, mainOnly: true });
    }

    const gql = `
      query SearchAnime($search: String, $page: Int, $perPage: Int, $format: MediaFormat, $format_not: MediaFormat, $genre: String, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, format: $format, format_not: $format_not, genre: $genre, sort: $sort) {
            id
            title { english romaji native }
            description
            format
            status
            startDate { year month day }
            episodes
            duration
            coverImage { extraLarge large medium }
            bannerImage
            genres
            averageScore
            popularity
            nextAiringEpisode { airingAt timeUntilAiring episode }
            trailer { id site }
            externalLinks { site url type icon }
            characters(sort: ROLE, perPage: 4) {
              edges {
                role
                node { name { full } image { medium } }
                voiceActors(language: JAPANESE) { name { full } image { medium } }
              }
            }
          }
        }
      }
    `;

    let targetFormat = undefined;
    let targetFormatNot = undefined;
    if (format === 'Movie' || isMovie === true) {
      targetFormat = 'MOVIE';
    } else if (format === 'Series') {
      targetFormatNot = 'MOVIE';
    }

    const sortOption = this.mapAniListSort(sort, ['SEARCH_MATCH', 'POPULARITY_DESC']);
    const targetGenre = (genre && genre !== 'All') ? genre : undefined;

    const variables = {
      search: query,
      page,
      perPage,
      format: targetFormat,
      format_not: targetFormatNot,
      genre: targetGenre,
      sort: sortOption
    };

    try {
      const data = await this.executeGraphQL(gql, variables);
      const mediaList = data.Page?.media || [];
      return mediaList.map(item => this.normalizeAniListMedia(item)).filter(Boolean);
    } catch (err) {
      console.error('[AniListProvider] search error:', err.message);
      return [];
    }
  }

  /**
   * Search Anime directly by character name and filter by Lead / Main character status
   */
  async searchByCharacter(characterQuery, { page = 1, perPage = 20, format = null, isMovie = null, genre = 'All', sort = 'popularity_desc', mainOnly = false } = {}) {
    if (!characterQuery || !characterQuery.trim()) return [];

    const gql = `
      query SearchByCharacter($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: 8) {
          characters(search: $search) {
            id
            name { full native alternative }
            image { large medium }
            media(type: ANIME, sort: POPULARITY_DESC, perPage: $perPage) {
              edges {
                characterRole
                node {
                  id
                  title { english romaji native }
                  description
                  format
                  status
                  startDate { year month day }
                  episodes
                  duration
                  coverImage { extraLarge large medium }
                  bannerImage
                  genres
                  averageScore
                  popularity
                  nextAiringEpisode { airingAt timeUntilAiring episode }
                  trailer { id site }
                  externalLinks { site url type icon }
                  characters(sort: ROLE, perPage: 4) {
                    edges {
                      role
                      node { name { full } image { medium } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL(gql, {
        search: characterQuery.trim(),
        page: Math.max(1, page),
        perPage: Math.min(25, perPage || 20)
      });

      const characters = data?.Page?.characters || [];
      const results = [];
      const seenMediaIds = new Set();

      for (const char of characters) {
        const charName = char.name?.full || 'Unknown';
        const charImage = char.image?.medium || char.image?.large || null;
        const mediaEdges = char.media?.edges || [];

        for (const edge of mediaEdges) {
          if (!edge.node) continue;
          if (seenMediaIds.has(edge.node.id)) continue;
          if (mainOnly && edge.characterRole !== 'MAIN') continue;

          // Format filtering
          if (format === 'Movie' || isMovie === true) {
            if (edge.node.format !== 'MOVIE') continue;
          } else if (format === 'Series') {
            if (edge.node.format === 'MOVIE') continue;
          }

          // Genre filtering
          if (genre && genre !== 'All') {
            const genres = edge.node.genres || [];
            if (!genres.some(g => g.toLowerCase() === genre.toLowerCase())) continue;
          }

          seenMediaIds.add(edge.node.id);
          const matchedCharInfo = {
            id: char.id,
            name: charName,
            image: charImage,
            role: edge.characterRole
          };

          const normalized = this.normalizeAniListMedia(edge.node, matchedCharInfo);
          if (normalized) {
            results.push(normalized);
          }
        }
      }

      return results;
    } catch (err) {
      console.error('[AniListProvider] searchByCharacter error:', err.message);
      return [];
    }
  }

  async getTrending({ page = 1, perPage = 24, format = null, isMovie = false, genre = 'All', sort = 'popularity_desc' } = {}) {
    const gql = `
      query GetTrendingAnime($page: Int, $perPage: Int, $format: MediaFormat, $format_not: MediaFormat, $genre: String, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, format: $format, format_not: $format_not, genre: $genre, sort: $sort) {
            id
            title { english romaji native }
            description
            format
            status
            startDate { year month day }
            seasonYear
            episodes
            duration
            coverImage { extraLarge large medium }
            bannerImage
            genres
            averageScore
            popularity
            nextAiringEpisode { airingAt timeUntilAiring episode }
            trailer { id site }
            externalLinks { site url type icon }
            characters(sort: ROLE, perPage: 4) {
              edges {
                role
                node { name { full } image { medium } }
                voiceActors(language: JAPANESE) { name { full } image { medium } }
              }
            }
          }
        }
      }
    `;

    let targetFormat = undefined;
    let targetFormatNot = undefined;
    if (format === 'Movie' || isMovie === true) {
      targetFormat = 'MOVIE';
    } else if (format === 'Series') {
      targetFormatNot = 'MOVIE';
    }

    const sortOption = this.mapAniListSort(sort, ['TRENDING_DESC', 'POPULARITY_DESC']);
    const targetGenre = (genre && genre !== 'All') ? genre : undefined;

    try {
      const data = await this.executeGraphQL(gql, {
        page,
        perPage,
        format: targetFormat,
        format_not: targetFormatNot,
        genre: targetGenre,
        sort: sortOption
      });
      const mediaList = data.Page?.media || [];
      return mediaList.map(item => this.normalizeAniListMedia(item)).filter(Boolean);
    } catch (err) {
      console.error('[AniListProvider] getTrending error:', err.message);
      return [];
    }
  }

  async getUpcoming({ page = 1, perPage = 20, format = null, isMovie = false, genre = 'All', sort = 'release_desc' } = {}) {
    const gql = `
      query GetUpcomingAnime($page: Int, $perPage: Int, $format: MediaFormat, $format_not: MediaFormat, $genre: String, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: NOT_YET_RELEASED, format: $format, format_not: $format_not, genre: $genre, sort: $sort) {
            id
            title { english romaji native }
            description
            format
            status
            startDate { year month day }
            episodes
            duration
            coverImage { extraLarge large medium }
            bannerImage
            genres
            averageScore
            popularity
            nextAiringEpisode { airingAt timeUntilAiring episode }
            trailer { id site }
            externalLinks { site url type icon }
            characters(sort: ROLE, perPage: 4) {
              edges {
                role
                node { name { full } image { medium } }
                voiceActors(language: JAPANESE) { name { full } image { medium } }
              }
            }
          }
        }
      }
    `;

    let targetFormat = undefined;
    let targetFormatNot = undefined;
    if (format === 'Movie' || isMovie === true) {
      targetFormat = 'MOVIE';
    } else if (format === 'Series') {
      targetFormatNot = 'MOVIE';
    }

    const sortOption = this.mapAniListSort(sort, ['POPULARITY_DESC']);
    const targetGenre = (genre && genre !== 'All') ? genre : undefined;

    try {
      const data = await this.executeGraphQL(gql, {
        page,
        perPage,
        format: targetFormat,
        format_not: targetFormatNot,
        genre: targetGenre,
        sort: sortOption
      });
      const mediaList = data.Page?.media || [];
      return mediaList.map(item => this.normalizeAniListMedia(item)).filter(Boolean);
    } catch (err) {
      console.error('[AniListProvider] getUpcoming error:', err.message);
      return [];
    }
  }

  async getDetail(externalId) {
    const id = parseInt(String(externalId).replace(/^omni_ani_/, ''), 10);
    if (!id) return null;

    const gql = `
      query GetAnimeDetail($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { english romaji native }
          description
          format
          status
          startDate { year month day }
          seasonYear
          episodes
          duration
          coverImage { extraLarge large medium }
          bannerImage
          genres
          averageScore
          popularity
          nextAiringEpisode { airingAt timeUntilAiring episode }
          studios(isMain: true) { nodes { name } }
          trailer { id site }
          externalLinks { site url type icon }
          characters(sort: ROLE, perPage: 8) {
            edges {
              role
              node { name { full } image { medium } }
              voiceActors(language: JAPANESE) { name { full } image { medium } }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                title { english romaji }
                format
                coverImage { large medium }
                averageScore
              }
            }
          }
          recommendations(sort: RATING_DESC, perPage: 6) {
            nodes {
              mediaRecommendation {
                id
                title { english romaji }
                format
                coverImage { large medium }
                averageScore
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL(gql, { id });
      return this.normalizeAniListMedia(data.Media);
    } catch (err) {
      console.error('[AniListProvider] getDetail error:', err.message);
      return null;
    }
  }
}
