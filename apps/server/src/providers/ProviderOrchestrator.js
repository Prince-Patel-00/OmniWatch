import { AniListProvider } from './AniListProvider.js';
import { TVMazeProvider } from './TVMazeProvider.js';
import { KitsuProvider } from './KitsuProvider.js';
import { TMDBProvider } from './TMDBProvider.js';
import {
  saveCanonicalMedia,
  getCanonicalMedia,
  searchCachedMedia,
  getCachedTrending,
  remapDuplicateCanonicalMedia,
  getDistinctCharacters,
  isSubsequentSeasonTitle
} from '../db.js';
import { normalizeTitle } from '@omniwatch/shared';

const ACRONYM_MAP = {
  'got': 'Game of Thrones',
  'tvd': 'The Vampire Diaries',
  'bb': 'Breaking Bad',
  'bcs': 'Better Call Saul',
  'aot': 'Attack on Titan',
  'fma': 'Fullmetal Alchemist',
  'fmab': 'Fullmetal Alchemist: Brotherhood',
  'poi': 'Person of Interest',
  'b99': 'Brooklyn Nine-Nine',
  'himym': 'How I Met Your Mother',
  'tbbt': 'The Big Bang Theory',
  'mha': 'My Hero Academia',
  'jjk': 'Jujutsu Kaisen',
  'ds': 'Demon Slayer',
  'csm': 'Chainsaw Man',
  'op': 'One Piece',
  'hxh': 'Hunter x Hunter',
  'twd': 'The Walking Dead',
  'mr': 'Mr. Robot'
};

function cleanTitleForMatch(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNormalizedTitleVariants(item) {
  const set = new Set();
  if (item.title) {
    const ct = cleanTitleForMatch(item.title);
    if (ct) set.add(ct);
    const subClean = cleanTitleForMatch(item.title.replace(/[:\-–—].*$/, ''));
    if (subClean && subClean.length >= 3) set.add(subClean);
  }
  if (item.originalTitle) {
    const ot = cleanTitleForMatch(item.originalTitle);
    if (ot) set.add(ot);
    const subOt = cleanTitleForMatch(item.originalTitle.replace(/[:\-–—].*$/, ''));
    if (subOt && subOt.length >= 3) set.add(subOt);
  }
  if (item.romajiTitle) {
    const rt = cleanTitleForMatch(item.romajiTitle);
    if (rt) set.add(rt);
    const subRt = cleanTitleForMatch(item.romajiTitle.replace(/[:\-–—].*$/, ''));
    if (subRt && subRt.length >= 3) set.add(subRt);
  }
  if (item.slug) {
    const st = cleanTitleForMatch(item.slug.replace(/-/g, ' '));
    if (st) set.add(st);
  }
  return Array.from(set);
}

function areSameEntity(a, b) {
  if (!a || !b) return false;

  // 1. Exact provider mapping match
  const aMaps = a.providerMappings || [];
  const bMaps = b.providerMappings || [];
  for (const am of aMaps) {
    for (const bm of bMaps) {
      if (am.provider && bm.provider && am.provider === bm.provider && String(am.id) === String(bm.id)) {
        return true;
      }
    }
  }

  // 2. Year compatibility: either year is missing/unknown or within 1 year
  const aYear = a.releaseYear;
  const bYear = b.releaseYear;
  const yearCompatible = (!aYear || !bYear || Math.abs(aYear - bYear) <= 1);
  if (!yearCompatible) return false;

  // 3. Media type compatibility
  const isOneAnime = a.mediaType === 'Anime' || b.mediaType === 'Anime';
  if (!isOneAnime) {
    // Both are Western: Movie does not match Series
    if (a.mediaType === 'Movie' && b.mediaType === 'Series') return false;
    if (a.mediaType === 'Series' && b.mediaType === 'Movie') return false;
  }

  // 4. Title comparison across all normalized variants
  const titlesA = getNormalizedTitleVariants(a);
  const titlesB = getNormalizedTitleVariants(b);

  for (const ta of titlesA) {
    for (const tb of titlesB) {
      if (ta === tb) return true;
      // Substring match for longer titles
      if (ta.length >= 8 && tb.length >= 8) {
        if (ta.includes(tb) || tb.includes(ta)) {
          return true;
        }
      }
    }
  }

  return false;
}

function mergeEntities(existing, incoming) {
  // Determine primary base:
  // For Anime: AniList / Kitsu (omni_ani_ / omni_kitsu_) takes precedence to preserve Japanese metadata & anime format
  // For Western: TMDB takes precedence for high-res artwork & JustWatch providers, while keeping TVMaze episodes
  const incomingIsAnime = incoming.mediaType === 'Anime' || (incoming.id && (incoming.id.startsWith('omni_ani_') || incoming.id.startsWith('omni_kitsu_')));
  const existingIsAnime = existing.mediaType === 'Anime' || (existing.id && (existing.id.startsWith('omni_ani_') || existing.id.startsWith('omni_kitsu_')));

  let base, extra;
  if (incomingIsAnime && !existingIsAnime) {
    base = { ...incoming };
    extra = existing;
  } else if (!incomingIsAnime && existingIsAnime) {
    base = { ...existing };
    extra = incoming;
  } else if (incoming.id?.startsWith('omni_tmdb_') && existing.id?.startsWith('omni_tv_')) {
    base = { ...incoming };
    extra = existing;
  } else {
    base = { ...existing };
    extra = incoming;
  }

  // Clean up duplicate row from SQLite database if both previously existed
  if (base.id && extra.id && base.id !== extra.id) {
    try {
      remapDuplicateCanonicalMedia(base.id, extra.id);
    } catch (e) {}
  }

  // Ensure Anime mediaType is retained if either is Anime
  if (existing.mediaType === 'Anime' || incoming.mediaType === 'Anime') {
    base.mediaType = 'Anime';
    const isMovie = existing.format === 'Movie' || incoming.format === 'Movie' || existing.isMovie || incoming.isMovie;
    base.format = isMovie ? 'Movie' : (base.format || 'Series');
    base.isMovie = isMovie;
  }

  // Merge Artwork (prefer TMDB high-res backdrop if available)
  if (extra.backdropUrl && (!base.backdropUrl || extra.id?.startsWith('omni_tmdb_'))) {
    base.backdropUrl = extra.backdropUrl;
  }
  base.posterUrl = base.posterUrl || extra.posterUrl;
  base.bannerUrl = base.bannerUrl || extra.bannerUrl || base.backdropUrl;

  // Merge synopsis (keep longer)
  if ((extra.synopsis || '').length > (base.synopsis || '').length) {
    base.synopsis = extra.synopsis;
  }

  // Merge rating / popularity
  base.rating = base.rating || extra.rating;
  base.popularityScore = Math.max(base.popularityScore || 0, extra.popularityScore || 0);

  // Merge genres
  base.genres = Array.from(new Set([...(base.genres || []), ...(extra.genres || [])]));

  // Merge watch providers
  const existingWpKeys = new Set((base.watchProviders || []).map(p => `${p.name}_${p.region}_${p.type}`));
  base.watchProviders = [...(base.watchProviders || [])];
  for (const wp of (extra.watchProviders || [])) {
    const key = `${wp.name}_${wp.region}_${wp.type}`;
    if (!existingWpKeys.has(key)) {
      base.watchProviders.push(wp);
      existingWpKeys.add(key);
    }
  }

  // Merge trailers
  const existingTrailerKeys = new Set((base.trailers || []).map(t => t.videoKey));
  base.trailers = [...(base.trailers || [])];
  for (const tr of (extra.trailers || [])) {
    if (!existingTrailerKeys.has(tr.videoKey)) {
      base.trailers.push(tr);
      existingTrailerKeys.add(tr.videoKey);
    }
  }

  // Merge provider mappings
  const existingMapKeys = new Set((base.providerMappings || []).map(m => `${m.provider}_${m.id}`));
  base.providerMappings = [...(base.providerMappings || [])];
  for (const m of (extra.providerMappings || [])) {
    const key = `${m.provider}_${m.id}`;
    if (!existingMapKeys.has(key)) {
      base.providerMappings.push(m);
      existingMapKeys.add(key);
    }
  }

  // Prefer richer seasons / episodes (e.g. from TVMaze)
  if ((extra.seasons || []).length > (base.seasons || []).length) {
    base.seasons = extra.seasons;
  }
  base.totalSeasons = Math.max(
    base.totalSeasons || 1,
    extra.totalSeasons || 1,
    (base.seasons || []).length,
    (extra.seasons || []).length
  );
  if (!base.totalEpisodes && extra.totalEpisodes) {
    base.totalEpisodes = extra.totalEpisodes;
  }

  // Next airing episode
  if (extra.nextAiringEpisode && !base.nextAiringEpisode) {
    base.nextAiringEpisode = extra.nextAiringEpisode;
    base.nextAiringAt = extra.nextAiringAt;
  }

  // Preserve richer cast and matched actor / character metadata
  if ((extra.cast || []).length > (base.cast || []).length) {
    base.cast = extra.cast;
  }
  base.matchedPerson = base.matchedPerson || extra.matchedPerson || null;
  base.matchedCharacter = base.matchedCharacter || extra.matchedCharacter || null;
  if (!base.mainCharacters || base.mainCharacters.length === 0) {
    base.mainCharacters = extra.mainCharacters || [];
  }

  return base;
}

function calculateRelevance(item, query) {
  if (!query || !query.trim()) return Number(item.popularityScore) || 0;

  const qLower = query.toLowerCase().trim();
  const cleanQ = cleanTitleForMatch(qLower);
  const expandedQ = ACRONYM_MAP[cleanQ] || ACRONYM_MAP[qLower.replace(/[^a-z0-9]/gi, '')];
  const cleanExpanded = expandedQ ? cleanTitleForMatch(expandedQ.toLowerCase()) : null;

  const title = (item.title || '').toLowerCase();
  const cleanTitle = cleanTitleForMatch(title);
  const orig = (item.originalTitle || '').toLowerCase();
  const romaji = (item.romajiTitle || '').toLowerCase();

  let score = 0;

  // 1. Exact title match (highest priority)
  if (cleanTitle === cleanQ || (cleanExpanded && cleanTitle === cleanExpanded)) {
    score += 30000;
  } else if (cleanTitle.startsWith(cleanQ) || (cleanExpanded && cleanTitle.startsWith(cleanExpanded))) {
    score += 15000;
  } else if (cleanTitle.includes(cleanQ) || (cleanExpanded && cleanTitle.includes(cleanExpanded))) {
    score += 8000;
  }

  // 2. Romaji or original title exact match (only if different from primary title)
  const cleanOrig = cleanTitleForMatch(orig);
  const cleanRomaji = cleanTitleForMatch(romaji);
  if (cleanOrig === cleanQ && cleanOrig !== cleanTitle) {
    score += 25000;
  } else if (cleanRomaji === cleanQ && cleanRomaji !== cleanTitle) {
    score += 25000;
  } else if ((cleanRomaji && cleanRomaji.includes(cleanQ)) || (cleanOrig && cleanOrig.includes(cleanQ))) {
    score += 7000;
  }

  // 3. Query tokens all in title
  const tokens = cleanQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every(t => cleanTitle.includes(t))) {
    score += 10000;
  } else if (tokens.length > 0) {
    const matchedTokens = tokens.filter(t => cleanTitle.includes(t) || (cleanRomaji && cleanRomaji.includes(t)) || (cleanOrig && cleanOrig.includes(t)));
    score += (matchedTokens.length / tokens.length) * 4000;
  }

  // 3.5. Main character, hero/heroine, and cast / actor match
  if (Array.isArray(item.cast)) {
    for (const c of item.cast) {
      const charName = (c.character || '').toLowerCase();
      const cleanChar = cleanTitleForMatch(charName);
      const actorName = (c.actor || '').toLowerCase();
      const cleanActor = cleanTitleForMatch(actorName);

      const isExact = (cleanChar === cleanQ || charName === qLower || cleanActor === cleanQ || actorName === qLower);
      const isPartial = (cleanChar && cleanChar.includes(cleanQ)) || (charName && charName.includes(qLower)) ||
                        (cleanActor && cleanActor.includes(cleanQ)) || (actorName && actorName.includes(qLower));

      if (isExact) {
        score += (c.role === 'MAIN' || !c.role) ? 24000 : 12000;
        break;
      } else if (isPartial) {
        score += (c.role === 'MAIN' || !c.role) ? 15000 : 7000;
        break;
      }
    }
  }

  // 3.6. Check matchedPerson or matchedCharacter
  if (item.matchedPerson) {
    const pName = (item.matchedPerson.name || '').toLowerCase();
    const pChar = (item.matchedPerson.character || '').toLowerCase();
    if (pName === qLower || cleanTitleForMatch(pName) === cleanQ || pChar === qLower || cleanTitleForMatch(pChar) === cleanQ) {
      score += 26000;
    } else if ((pName && pName.includes(qLower)) || (pChar && pChar.includes(qLower))) {
      score += 16000;
    }
  }

  // 4. Popularity tie-breaker (log-scaled: a title with 500,000 popularity outranks a 0.5 popularity obscure title)
  const pop = Number(item.popularityScore) || 0;
  score += Math.log10(pop + 1) * 2000;

  // 5. Rating tie-breaker
  score += (Number(item.rating) || 0) * 50;

  return score;
}

export class ProviderOrchestrator {
  constructor() {
    this.anilist = new AniListProvider();
    this.tvmaze = new TVMazeProvider();
    this.kitsu = new KitsuProvider();
    this.tmdb = new TMDBProvider();
  }

  getProviderStatus() {
    return {
      anilist: { active: true, authRequired: false, free: true },
      tvmaze: { active: true, authRequired: false, free: true },
      kitsu: { active: true, authRequired: false, free: true },
      tmdb: { active: this.tmdb.isAvailable(), authRequired: true, free: true }
    };
  }

  /**
   * Universal Search across active providers with entity deduplication, character matching, and relevance ranking
   */
  async search(query, { type = 'All', genre = 'All', year = null, sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, character = null, searchMode = 'all', mainCharOnly = false, excludeIds = '' } = {}) {
    const activeAnimeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);

    const targetChar = (character || (searchMode === 'character' ? query : '') || '').trim();

    if (!query && !targetChar) {
      return this.getTrending({ type, sort, animeFormat: activeAnimeFormat, page: pageNum, limit: limitNum, genre, excludeIds });
    }

    const cleanQuery = (query || targetChar).trim();
    const qLower = cleanQuery.toLowerCase();
    const expandedQuery = ACRONYM_MAP[qLower] || ACRONYM_MAP[cleanQuery.replace(/[^a-z0-9]/gi, '').toLowerCase()] || cleanQuery;

    // 1. Check local cache first for instant hits (with character support)
    // Fetch cached hits up to current page extent so all known items are sorted consistently
    let cachedHits = await searchCachedMedia(cleanQuery, {
      type,
      genre,
      sort,
      limit: limitNum * pageNum + 30,
      page: 1,
      animeFormat: activeAnimeFormat,
      character: targetChar,
      searchMode,
      mainCharOnly,
      excludeIds
    });

    if (expandedQuery !== cleanQuery) {
      const expandedHits = await searchCachedMedia(expandedQuery, {
        type,
        genre,
        sort,
        limit: limitNum * pageNum + 30,
        page: 1,
        animeFormat: activeAnimeFormat,
        character: targetChar,
        searchMode,
        mainCharOnly,
        excludeIds
      });
      cachedHits = this.deduplicateEntities([...cachedHits, ...expandedHits]);
    }

    // 2. Dispatch queries to relevant upstream providers concurrently if cache needs more hits
    const promises = [];
    const neededHits = pageNum * limitNum;

    if (cachedHits.length < neededHits) {
      if (targetChar) {
        // Dedicated Character / Actor Search across ALL categories (Movies, Series, Anime)
        if (type === 'All' || type === 'Anime' || type === 'Movie') {
          const aniFormat = type === 'Movie' ? 'Movie' : (type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null);
          promises.push(
            this.anilist.searchByCharacter(targetChar, {
              format: aniFormat,
              page: pageNum,
              perPage: limitNum,
              genre,
              sort,
              mainOnly: true
            }).catch(err => {
              console.warn('[ProviderOrchestrator] AniList character search failed:', err.message);
              return [];
            })
          );
        }

        // TMDB (Movies and Series actor / character credit search)
        if (this.tmdb.isAvailable() && (type === 'All' || type === 'Movie' || type === 'Series')) {
          promises.push(
            this.tmdb.search(targetChar, {
              type,
              page: pageNum,
              limit: limitNum,
              genre,
              character: targetChar,
              searchMode: 'character'
            }).catch(err => {
              console.warn('[ProviderOrchestrator] TMDB character search failed:', err.message);
              return [];
            })
          );
        }

        // TV Series (TVMaze actor & character credit search)
        if (type === 'All' || type === 'Series') {
          promises.push(
            this.tvmaze.search(targetChar, {
              character: targetChar,
              searchMode: 'character',
              page: pageNum,
              limit: limitNum
            }).catch(err => {
              console.warn('[ProviderOrchestrator] TVMaze character search failed:', err.message);
              return [];
            })
          );
        }
      } else {
        // General Universal Search across all sources
        if (type === 'All' || type === 'Anime' || type === 'Movie') {
          const aniFormat = type === 'Movie' ? 'Movie' : (type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null);
          promises.push(
            this.anilist.search(cleanQuery, { format: aniFormat, page: pageNum, perPage: limitNum, genre, sort })
              .then(async (aniResults) => {
                if (Array.isArray(aniResults) && aniResults.length < 3) {
                  try {
                    const kitsuResults = await this.kitsu.search(cleanQuery, { format: aniFormat, page: pageNum, limit: limitNum });
                    return [...aniResults, ...(kitsuResults || [])];
                  } catch (e) {
                    return aniResults;
                  }
                }
                return aniResults;
              })
              .catch(err => {
                console.warn('AniList search failed, trying Kitsu:', err.message);
                return this.kitsu.search(cleanQuery, { format: aniFormat, page: pageNum, limit: limitNum });
              })
          );

          // Also query AniList character search in parallel so character searches yield rich hits
          promises.push(
            this.anilist.searchByCharacter(cleanQuery, {
              format: aniFormat,
              page: pageNum,
              perPage: 6,
              genre,
              sort,
              mainOnly: true
            }).catch(() => [])
          );
        }

        // TV Series (TVMaze titles and actor credits)
        if (type === 'All' || type === 'Series') {
          promises.push(this.tvmaze.search(expandedQuery, { page: pageNum, limit: limitNum }).catch(err => {
            console.warn('TVMaze search failed:', err.message);
            return [];
          }));
          if (expandedQuery !== cleanQuery) {
            promises.push(this.tvmaze.search(cleanQuery, { page: pageNum, limit: limitNum }).catch(() => []));
          }
        }

        // TMDB (Movies and Series if API key present)
        if (this.tmdb.isAvailable() && (type === 'All' || type === 'Movie' || type === 'Series')) {
          promises.push(this.tmdb.search(cleanQuery, { type, page: pageNum, limit: limitNum, genre }).catch(err => {
            console.warn('TMDB search failed:', err.message);
            return [];
          }));
        }
      }
    }

    const settled = await Promise.allSettled(promises);
    const rawResults = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawResults.push(...res.value);
      }
    }

    // 3. Deduplicate and merge entities across all providers
    const mergedResults = this.deduplicateEntities([...cachedHits, ...rawResults]);

    // 4. Save newly discovered items to SQLite cache in background
    for (const item of mergedResults) {
      try {
        await saveCanonicalMedia(item);
      } catch (err) {
        console.error('Failed to cache canonical item:', err.message);
      }
    }

    // 5. Apply filters
    let filtered = mergedResults;
    if (type !== 'All') {
      if (type === 'Movie') {
        filtered = filtered.filter(item => item.mediaType === 'Movie' || item.format === 'Movie' || item.isMovie);
      } else {
        filtered = filtered.filter(item => item.mediaType === type);
      }
    }
    if (type === 'Anime' && activeAnimeFormat !== 'All') {
      filtered = filtered.filter(item => item.format === activeAnimeFormat);
    }
    if (genre !== 'All') {
      filtered = filtered.filter(item => (item.genres || []).some(g => g.toLowerCase() === genre.toLowerCase()));
    }
    if (year) {
      filtered = filtered.filter(item => item.releaseYear === parseInt(year, 10));
    }

    // Filter by hero/character or actor/casting if requested
    if (targetChar) {
      const charLower = targetChar.toLowerCase();
      filtered = filtered.filter(item => {
        if ((item.title || '').toLowerCase().includes(charLower)) {
          return true;
        }
        if (item.matchedPerson && (
          (item.matchedPerson.name || '').toLowerCase().includes(charLower) ||
          (item.matchedPerson.character || '').toLowerCase().includes(charLower)
        )) {
          return true;
        }
        if (item.matchedCharacter && (
          (item.matchedCharacter.name || '').toLowerCase().includes(charLower) ||
          (item.matchedCharacter.actor || '').toLowerCase().includes(charLower)
        )) {
          return true;
        }
        const castList = item.cast || [];
        return castList.some(c => {
          const cChar = (c.character || '').toLowerCase();
          const cActor = (c.actor || '').toLowerCase();
          const match = cChar.includes(charLower) || cActor.includes(charLower);
          if (!match) return false;
          if (mainCharOnly) return c.role === 'MAIN' || !c.role;
          return true;
        });
      });
    }

    // 6. Apply sorting with search relevance ranking
    filtered = this.applySorting(filtered, sort, cleanQuery);

    const excludeSet = new Set(
      (typeof excludeIds === 'string' ? excludeIds.split(',') : Array.from(excludeIds || []))
        .map(s => String(s).trim())
        .filter(Boolean)
    );

    if (excludeSet.size > 0) {
      filtered = filtered.filter(item => !excludeSet.has(item.id) && !excludeSet.has(item.canonicalId));
      const paged = filtered.slice(0, limitNum);
      return await this.resolveSeriesSeasons(paged);
    }

    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paged = filtered.slice(startIndex, endIndex);
    return await this.resolveSeriesSeasons(paged);
  }

  /**
   * Resolve and hydrate accurate multi-season counts for Series from TVMaze
   */
  async resolveSeriesSeasons(items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const seriesNeedingSeasons = items.filter(item => {
      if (!item || !item.id) return false;
      const isSeries = item.mediaType === 'Series' || (item.mediaType === 'Anime' && item.format !== 'Movie' && !item.isMovie);
      return isSeries && (item.totalSeasons || 1) <= 1 && (!item.seasons || item.seasons.length <= 1);
    });

    if (seriesNeedingSeasons.length === 0) return items;

    const batch = seriesNeedingSeasons.slice(0, 15);
    await Promise.allSettled(batch.map(async (item) => {
      try {
        let seasonCount = null;
        if (item.id.startsWith('omni_tv_')) {
          const tvId = item.id.replace('omni_tv_', '');
          const res = await fetch(`https://api.tvmaze.com/shows/${tvId}?embed=seasons`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data._embedded?.seasons)) {
              seasonCount = data._embedded.seasons.length;
            }
          }
        } else {
          const cleanTitle = (item.title || '').trim();
          if (cleanTitle) {
            const hits = await this.tvmaze.search(cleanTitle);
            const cleanQ = cleanTitle.toLowerCase();
            const match = hits.find(h => (h.title || '').toLowerCase() === cleanQ) || hits[0];
            if (match) {
              const tvId = match.id.replace('omni_tv_', '');
              const detailRes = await fetch(`https://api.tvmaze.com/shows/${tvId}?embed=seasons`, { signal: AbortSignal.timeout(3000) });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (Array.isArray(detail._embedded?.seasons)) {
                  seasonCount = detail._embedded.seasons.length;
                }
              }
            }
          }
        }

        if (seasonCount && seasonCount > 1) {
          item.totalSeasons = Math.max(item.totalSeasons || 1, seasonCount);
          try {
            const { getDB } = await import('../db.js');
            getDB().prepare('UPDATE cached_media SET total_seasons = MAX(total_seasons, ?) WHERE id = ?').run(seasonCount, item.id);
          } catch (e) {}
        }
      } catch (e) {}
    }));

    return items;
  }

  async getPopularCharacters(options = {}) {
    return await getDistinctCharacters(options);
  }

  /**
   * Sort items by selected criterion (with query relevance support)
   */
  applySorting(items, sort = 'popularity_desc', query = '') {
    const list = [...items];
    switch (sort) {
      case 'rating_desc':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'release_desc':
      case 'year_desc':
        return list.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
      case 'title_asc':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'popularity_desc':
      default:
        if (query && query.trim()) {
          return list.sort((a, b) => calculateRelevance(b, query) - calculateRelevance(a, query));
        }
        return list.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
    }
  }

  /**
   * Deduplicate entities from different providers based on title similarity, release year, and provider mappings
   */
  deduplicateEntities(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const canonicalList = [];

    const SUBSEQUENT_SEASON_REGEX = /\s*[:\-–—]?\s*\b(?:Season\s+([2-9]|\d{2,})|[2-9]\d*(?:nd|rd|th)\s+Season|Final\s+Season|Season\s+Final|Cour\s+([2-9]|\d{2,}))\b.*/i;
    const seasonNumExtractRegex = /\b(?:Season\s+([2-9]|\d{2,})|([2-9]\d*)(?:nd|rd|th)\s+Season|Cour\s+([2-9]|\d{2,}))\b/i;

    for (const item of items) {
      if (!item || !item.title) continue;

      let target = item;
      if (isSubsequentSeasonTitle(item)) {
        const baseTitle = item.title.replace(SUBSEQUENT_SEASON_REGEX, '').trim();
        const numMatch = item.title.match(seasonNumExtractRegex);
        const extractedSeasonNum = numMatch ? parseInt(numMatch[1] || numMatch[2] || numMatch[3] || '2', 10) : 2;

        const existingBaseIdx = canonicalList.findIndex(c => {
          const cTitle = (c.title || '').toLowerCase().trim();
          return cTitle === baseTitle.toLowerCase() || cleanTitleForMatch(cTitle) === cleanTitleForMatch(baseTitle);
        });

        if (existingBaseIdx >= 0) {
          canonicalList[existingBaseIdx].totalSeasons = Math.max(canonicalList[existingBaseIdx].totalSeasons || 1, extractedSeasonNum);
          continue; // Drop the separate season entry
        } else {
          target = { ...item, title: baseTitle, totalSeasons: Math.max(item.totalSeasons || 1, extractedSeasonNum) };
        }
      }

      let matchedIndex = -1;
      for (let i = 0; i < canonicalList.length; i++) {
        if (areSameEntity(canonicalList[i], target)) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex >= 0) {
        canonicalList[matchedIndex] = mergeEntities(canonicalList[matchedIndex], target);
      } else {
        canonicalList.push({ ...target });
      }
    }

    return canonicalList;
  }

  /**
   * Get trending titles across active providers with movie support
   */
  async getTrending({ type = 'All', sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All', excludeIds = '' } = {}) {
    const activeAnimeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);

    // If cache already has enough items for this page, return without upstream calls to avoid ranking shifts
    const cachedBefore = await getCachedTrending(type, limitNum * pageNum + 10, { animeFormat: activeAnimeFormat, page: 1, genre, sort, excludeIds });
    if (cachedBefore.length >= pageNum * limitNum) {
      const paged = await getCachedTrending(type, limitNum, { animeFormat: activeAnimeFormat, page: pageNum, genre, sort, excludeIds });
      return this.applySorting(this.deduplicateEntities(paged), sort);
    }

    const upstreamLimit = Math.max(limitNum + 10, 30);
    const promises = [];

    if (type === 'All' || type === 'Anime') {
      const aniFormat = type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null;
      promises.push(this.anilist.getTrending({ page: pageNum, perPage: upstreamLimit, format: aniFormat, genre, sort }));
    }

    if (type === 'All' || type === 'Series') {
      promises.push(this.tvmaze.getTrending({ page: pageNum, limit: upstreamLimit }));
    }

    if (this.tmdb.isAvailable() && (type === 'All' || type === 'Movie' || type === 'Series')) {
      promises.push(this.tmdb.getTrending({ type, page: pageNum, timeWindow: 'week', genre, sort }));
    }

    const settled = await Promise.allSettled(promises);
    const rawResults = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawResults.push(...res.value);
      }
    }

    const merged = this.deduplicateEntities(rawResults);

    for (const item of merged) {
      try {
        await saveCanonicalMedia(item);
      } catch (e) {}
    }

    const excludeSet = new Set(
      (typeof excludeIds === 'string' ? excludeIds.split(',') : Array.from(excludeIds || []))
        .map(s => String(s).trim())
        .filter(Boolean)
    );

    // Use canonical SQLite cache with strict non-overlapping LIMIT ? OFFSET ?
    const cached = await getCachedTrending(type, limitNum, { animeFormat: activeAnimeFormat, page: pageNum, genre, sort, excludeIds });
    if (cached.length >= limitNum) {
      return await this.resolveSeriesSeasons(this.applySorting(this.deduplicateEntities(cached), sort));
    }

    let filtered = merged;
    if (type !== 'All') {
      if (type === 'Movie') {
        filtered = filtered.filter(item => item.mediaType === 'Movie' || item.format === 'Movie' || item.isMovie);
      } else {
        filtered = filtered.filter(item => item.mediaType === type);
      }
    }
    if (type === 'Anime' && activeAnimeFormat !== 'All') {
      filtered = filtered.filter(item => item.format === activeAnimeFormat);
    }
    if (genre && genre !== 'All') {
      const gLower = genre.toLowerCase();
      filtered = filtered.filter(item => (item.genres || []).some(g => g.toLowerCase().includes(gLower) || gLower.includes(g.toLowerCase())));
    }

    let combined = this.deduplicateEntities([...cached, ...filtered]);
    if (excludeSet.size > 0) {
      combined = combined.filter(item => !excludeSet.has(item.id) && !excludeSet.has(item.canonicalId));
      const sorted = this.applySorting(combined, sort);
      return await this.resolveSeriesSeasons(sorted.slice(0, limitNum));
    }

    const sorted = this.applySorting(combined, sort);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    return await this.resolveSeriesSeasons(sorted.slice(startIndex, endIndex));
  }

  /**
   * Get upcoming releases across providers
   */
  async getUpcoming({ type = 'All', sort = 'release_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All', excludeIds = '' } = {}) {
    const activeAnimeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);
    const upstreamLimit = Math.max(limitNum + 10, 30);
    const promises = [];

    if (type === 'All' || type === 'Anime') {
      const aniFormat = type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null;
      promises.push(this.anilist.getUpcoming({ page: pageNum, perPage: upstreamLimit, format: aniFormat, genre, sort }));
    }

    if (this.tmdb.isAvailable() && (type === 'All' || type === 'Movie' || type === 'Series')) {
      promises.push(this.tmdb.getUpcoming({ type: type === 'Series' ? 'Series' : 'Movie', page: pageNum, genre, sort }));
    }

    const settled = await Promise.allSettled(promises);
    const rawResults = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawResults.push(...res.value);
      }
    }

    const merged = this.deduplicateEntities(rawResults);
    for (const item of merged) {
      try {
        await saveCanonicalMedia(item);
      } catch (e) {}
    }

    const excludeSet = new Set(
      (typeof excludeIds === 'string' ? excludeIds.split(',') : Array.from(excludeIds || []))
        .map(s => String(s).trim())
        .filter(Boolean)
    );

    // Use canonical SQLite cache with strict non-overlapping LIMIT ? OFFSET ?
    const cached = await getCachedTrending(type, limitNum, { animeFormat: activeAnimeFormat, page: pageNum, genre, sort: 'release_desc', excludeIds });
    if (cached.length >= limitNum) {
      return await this.resolveSeriesSeasons(this.applySorting(this.deduplicateEntities(cached), sort));
    }

    let filtered = merged;
    if (type !== 'All') {
      if (type === 'Movie') {
        filtered = filtered.filter(item => item.mediaType === 'Movie' || item.format === 'Movie' || item.isMovie);
      } else {
        filtered = filtered.filter(item => item.mediaType === type);
      }
    }
    if (type === 'Anime' && activeAnimeFormat !== 'All') {
      filtered = filtered.filter(item => item.format === activeAnimeFormat);
    }
    if (genre && genre !== 'All') {
      const gLower = genre.toLowerCase();
      filtered = filtered.filter(item => (item.genres || []).some(g => g.toLowerCase().includes(gLower) || gLower.includes(g.toLowerCase())));
    }

    let combined = this.deduplicateEntities([...cached, ...filtered]);
    if (excludeSet.size > 0) {
      combined = combined.filter(item => !excludeSet.has(item.id) && !excludeSet.has(item.canonicalId));
      const sorted = this.applySorting(combined, sort);
      return await this.resolveSeriesSeasons(sorted.slice(0, limitNum));
    }

    const sorted = this.applySorting(combined, sort);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    return await this.resolveSeriesSeasons(sorted.slice(startIndex, endIndex));
  }

  /**
   * Fetch full title details with dynamic TTL freshness check
   */
  async getDetail(canonicalId, { forceRefresh = false } = {}) {
    if (!canonicalId) return null;

    const cached = await getCanonicalMedia(canonicalId);
    if (cached && !forceRefresh) {
      const now = Date.now();
      const lastSynced = new Date(cached.lastSyncedAt || 0).getTime();
      const isAiring = cached.status === 'Airing';
      
      // Dynamic TTL:
      // Airing titles: 3 hours TTL
      // Completed titles: 7 days TTL
      const ttlMs = isAiring ? (3 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
      const isExpired = (now - lastSynced) > ttlMs;

      // Also expire if next airing time has passed
      const nextAiringPassed = cached.nextAiringAt && now > new Date(cached.nextAiringAt).getTime();

      if (!isExpired && !nextAiringPassed && cached.seasons && cached.seasons.length > 0) {
        return cached;
      }
    }

    // Refresh from appropriate upstream provider
    let freshItem = null;

    if (canonicalId.startsWith('omni_ani_')) {
      freshItem = await this.anilist.getDetail(canonicalId);
    } else if (canonicalId.startsWith('omni_tv_')) {
      freshItem = await this.tvmaze.getDetail(canonicalId);
    } else if (canonicalId.startsWith('omni_tmdb_')) {
      freshItem = await this.tmdb.getDetail(canonicalId);
    } else if (canonicalId.startsWith('omni_kitsu_')) {
      freshItem = await this.kitsu.getDetail(canonicalId);
    }

    // Cross-provider season & episode hydration (e.g. for TV series where TMDB has no key or lacks episodes):
    const targetItem = freshItem || cached;
    const isSeries = targetItem && (
      targetItem.mediaType === 'Series' ||
      (targetItem.mediaType === 'Anime' && targetItem.format !== 'Movie' && !targetItem.isMovie) ||
      canonicalId.includes('_tv_')
    );

    if (isSeries && (!targetItem.seasons || targetItem.seasons.length <= 1)) {
      try {
        const cleanTitle = (targetItem.title || '').trim();
        if (cleanTitle) {
          const tvHits = await this.tvmaze.search(cleanTitle);
          const cleanQ = cleanTitle.toLowerCase();
          const match = tvHits.find(h => {
            const hTitle = (h.title || '').toLowerCase();
            return hTitle === cleanQ || hTitle.includes(cleanQ) || cleanQ.includes(hTitle);
          }) || (cleanTitle.length >= 3 ? tvHits[0] : null);

          if (match) {
            const tvDetail = await this.tvmaze.getDetail(match.id);
            if (tvDetail && tvDetail.seasons && tvDetail.seasons.length > 0) {
              if (freshItem) {
                if ((tvDetail.seasons.length > (freshItem.seasons || []).length)) {
                  freshItem.seasons = tvDetail.seasons;
                }
                freshItem.totalSeasons = Math.max(freshItem.totalSeasons || 1, tvDetail.totalSeasons || 1, tvDetail.seasons.length);
                freshItem.totalEpisodes = freshItem.totalEpisodes || tvDetail.totalEpisodes;
                if (!freshItem.providerMappings?.some(m => m.provider === 'tvmaze')) {
                  freshItem.providerMappings = (freshItem.providerMappings || []).concat(tvDetail.providerMappings || []);
                }
              } else if (cached) {
                freshItem = { ...cached };
                freshItem.seasons = tvDetail.seasons;
                freshItem.totalSeasons = Math.max(cached.totalSeasons || 1, tvDetail.totalSeasons || 1, tvDetail.seasons.length);
                freshItem.totalEpisodes = tvDetail.totalEpisodes || cached.totalEpisodes;
                if (tvDetail.cast && tvDetail.cast.length > (cached.cast || []).length) {
                  freshItem.cast = tvDetail.cast;
                }
                if (!freshItem.providerMappings?.some(m => m.provider === 'tvmaze')) {
                  freshItem.providerMappings = (freshItem.providerMappings || []).concat(tvDetail.providerMappings || []);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ProviderOrchestrator] Cross-provider season hydration warning:', err.message);
      }
    }

    if (freshItem) {
      // Merge with any cached watch providers if needed
      if (cached) {
        freshItem.watchProviders = (freshItem.watchProviders || []).concat(
          (cached.watchProviders || []).filter(cp => !(freshItem.watchProviders || []).some(fp => fp.name === cp.name && fp.region === cp.region))
        );
      }
      return await saveCanonicalMedia(freshItem);
    }

    return cached;
  }
}

export const orchestrator = new ProviderOrchestrator();
