import { AniListProvider } from './AniListProvider.js';
import { TVMazeProvider } from './TVMazeProvider.js';
import { KitsuProvider } from './KitsuProvider.js';
import { TMDBProvider } from './TMDBProvider.js';
import {
  saveCanonicalMedia,
  getCanonicalMedia,
  searchCachedMedia,
  getCachedTrending,
  remapDuplicateCanonicalMedia
} from '../db.js';
import { normalizeTitle } from '@omniwatch/shared';

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

  // Next airing episode
  if (extra.nextAiringEpisode && !base.nextAiringEpisode) {
    base.nextAiringEpisode = extra.nextAiringEpisode;
    base.nextAiringAt = extra.nextAiringAt;
  }

  return base;
}

function calculateRelevance(item, query) {
  if (!query || !query.trim()) return Number(item.popularityScore) || 0;

  const qLower = query.toLowerCase().trim();
  const cleanQ = cleanTitleForMatch(qLower);
  const title = (item.title || '').toLowerCase();
  const cleanTitle = cleanTitleForMatch(title);
  const orig = (item.originalTitle || '').toLowerCase();
  const romaji = (item.romajiTitle || '').toLowerCase();

  let score = 0;

  // 1. Exact title match (highest priority)
  if (cleanTitle === cleanQ) {
    score += 30000;
  } else if (cleanTitle.startsWith(cleanQ)) {
    score += 15000;
  } else if (cleanTitle.includes(cleanQ)) {
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
   * Universal Search across active providers with entity deduplication and relevance ranking
   */
  async search(query, { type = 'All', genre = 'All', year = null, sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24 } = {}) {
    const activeAnimeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);

    if (!query || !query.trim()) {
      return this.getTrending({ type, sort, animeFormat: activeAnimeFormat, page: pageNum, limit: limitNum });
    }

    const cleanQuery = query.trim();

    // 1. Check local cache first for instant hits
    const cachedHits = searchCachedMedia(cleanQuery, { type, genre, sort, limit: limitNum, page: pageNum, animeFormat: activeAnimeFormat });

    // 2. Dispatch queries to relevant upstream providers concurrently
    const promises = [];

    // Anime (All anime, including anime movies, queried here)
    if (type === 'All' || type === 'Anime' || type === 'Movie') {
      const aniFormat = type === 'Movie' ? 'Movie' : (type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null);
      promises.push(
        this.anilist.search(cleanQuery, { format: aniFormat, page: pageNum, perPage: limitNum, genre, sort })
          .then(async (aniResults) => {
            // If AniList returns very few results (< 3), also query Kitsu to ensure no anime is missed
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
    }

    // TV Series
    if (type === 'All' || type === 'Series') {
      promises.push(this.tvmaze.search(cleanQuery).then(tvResults => {
        // Filter out TVMaze results that don't match any query token in title (removes noise)
        const qTokens = cleanQuery.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
        if (qTokens.length === 0) return tvResults;
        return (tvResults || []).filter(show => {
          const sTitle = (show.title || '').toLowerCase();
          return qTokens.some(tok => sTitle.includes(tok));
        });
      }).catch(err => {
        console.warn('TVMaze search failed:', err.message);
        return [];
      }));
    }

    // TMDB (Movies and Series if API key present)
    if (this.tmdb.isAvailable() && (type === 'All' || type === 'Movie' || type === 'Series')) {
      promises.push(this.tmdb.search(cleanQuery, { type, page: pageNum, genre }).catch(err => {
        console.warn('TMDB search failed:', err.message);
        return [];
      }));
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
        saveCanonicalMedia(item);
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

    // 6. Apply sorting with search relevance ranking
    filtered = this.applySorting(filtered, sort, cleanQuery);

    return filtered.slice(0, limitNum);
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

    for (const item of items) {
      if (!item || !item.title) continue;

      let matchedIndex = -1;
      for (let i = 0; i < canonicalList.length; i++) {
        if (areSameEntity(canonicalList[i], item)) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex >= 0) {
        canonicalList[matchedIndex] = mergeEntities(canonicalList[matchedIndex], item);
      } else {
        canonicalList.push({ ...item });
      }
    }

    return canonicalList;
  }

  /**
   * Get trending titles across active providers with movie support
   */
  async getTrending({ type = 'All', sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All' } = {}) {
    const activeAnimeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);
    const upstreamLimit = Math.max(limitNum + 10, 30);
    const promises = [];

    if (type === 'All' || type === 'Anime') {
      const aniFormat = type === 'Anime' && activeAnimeFormat !== 'All' ? activeAnimeFormat : null;
      promises.push(this.anilist.getTrending({ page: pageNum, perPage: upstreamLimit, format: aniFormat, genre, sort }));
    }

    if (type === 'All' || type === 'Series') {
      promises.push(this.tvmaze.getTrending());
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

    if (rawResults.length === 0) {
      const cached = getCachedTrending(type, limitNum, { animeFormat: activeAnimeFormat, page: pageNum, genre, sort });
      return this.deduplicateEntities(cached);
    }

    const merged = this.deduplicateEntities(rawResults);

    for (const item of merged) {
      try {
        saveCanonicalMedia(item);
      } catch (e) {}
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

    const sorted = this.applySorting(filtered, sort);
    return sorted.slice(0, limitNum);
  }

  /**
   * Get upcoming releases across providers
   */
  async getUpcoming({ type = 'All', sort = 'release_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All' } = {}) {
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

    if (rawResults.length === 0) {
      const cached = getCachedTrending(type, limitNum, { animeFormat: activeAnimeFormat, page: pageNum, genre, sort });
      return this.deduplicateEntities(cached);
    }

    const merged = this.deduplicateEntities(rawResults);
    for (const item of merged) {
      try {
        saveCanonicalMedia(item);
      } catch (e) {}
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

    const sorted = this.applySorting(filtered, sort);
    return sorted.slice(0, limitNum);
  }

  /**
   * Fetch full title details with dynamic TTL freshness check
   */
  async getDetail(canonicalId, { forceRefresh = false } = {}) {
    if (!canonicalId) return null;

    const cached = getCanonicalMedia(canonicalId);
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

    if (freshItem) {
      // Merge with any cached watch providers if needed
      if (cached) {
        freshItem.watchProviders = (freshItem.watchProviders || []).concat(
          (cached.watchProviders || []).filter(cp => !(freshItem.watchProviders || []).some(fp => fp.name === cp.name && fp.region === cp.region))
        );
      }
      return saveCanonicalMedia(freshItem);
    }

    return cached;
  }
}

export const orchestrator = new ProviderOrchestrator();
