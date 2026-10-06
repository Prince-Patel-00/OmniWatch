import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDefaultMirrors, DEFAULT_MIRROR_REGISTRY } from '@omniwatch/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = process.env.OMNIWATCH_DB_PATH || path.join(DATA_DIR, 'omniwatch.db');

let dbInstance = null;

export function getDB() {
  if (!dbInstance) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA busy_timeout = 5000;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_media (
      id TEXT PRIMARY KEY,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      original_title TEXT,
      romaji_title TEXT,
      slug TEXT,
      synopsis TEXT,
      tagline TEXT,
      release_date TEXT,
      release_year INTEGER,
      runtime_minutes INTEGER,
      status TEXT NOT NULL,
      rating REAL,
      vote_count INTEGER,
      popularity_score REAL,
      poster_url TEXT,
      backdrop_url TEXT,
      banner_url TEXT,
      genres_json TEXT,
      country_of_origin TEXT,
      studios_json TEXT,
      networks_json TEXT,
      creators_json TEXT,
      cast_json TEXT,
      related_json TEXT,
      total_seasons INTEGER DEFAULT 1,
      total_episodes INTEGER,
      next_airing_episode INTEGER,
      next_airing_at TEXT,
      last_synced_at TEXT NOT NULL,
      cache_ttl_hours INTEGER DEFAULT 48,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE INDEX IF NOT EXISTS idx_cached_media_type ON cached_media(media_type);
    CREATE INDEX IF NOT EXISTS idx_cached_media_title ON cached_media(title);
    CREATE INDEX IF NOT EXISTS idx_cached_media_popularity ON cached_media(popularity_score);

    CREATE TABLE IF NOT EXISTS media_provider_mappings (
      canonical_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      external_id TEXT NOT NULL,
      external_url TEXT,
      matched_confidence REAL DEFAULT 1.0,
      PRIMARY KEY (provider_name, external_id),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_seasons (
      canonical_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      episode_count INTEGER NOT NULL DEFAULT 0,
      poster_url TEXT,
      air_date TEXT,
      PRIMARY KEY (canonical_id, season_number),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_episodes (
      canonical_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      air_date TEXT,
      runtime_minutes INTEGER,
      still_url TEXT,
      vote_average REAL,
      PRIMARY KEY (canonical_id, season_number, episode_number),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_trailers (
      id TEXT PRIMARY KEY,
      canonical_id TEXT NOT NULL,
      source_site TEXT NOT NULL DEFAULT 'YouTube',
      video_key TEXT NOT NULL,
      title TEXT,
      thumbnail_url TEXT,
      is_official INTEGER DEFAULT 1,
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_watch_providers (
      id TEXT PRIMARY KEY,
      canonical_id TEXT NOT NULL,
      region_code TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      provider_logo_url TEXT,
      availability_type TEXT NOT NULL,
      web_url TEXT,
      display_priority INTEGER DEFAULT 10,
      last_verified_at TEXT NOT NULL,
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      canonical_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_url TEXT,
      backdrop_url TEXT,
      release_year INTEGER,
      user_status TEXT NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      user_rating REAL,
      current_season INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 0,
      total_episodes INTEGER,
      notes TEXT,
      tags_json TEXT,
      started_at TEXT,
      completed_at TEXT,
      last_watched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_status ON catalog_items(user_status);
    CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog_items(media_type);
    CREATE INDEX IF NOT EXISTS idx_catalog_canonical ON catalog_items(canonical_id);

    CREATE TABLE IF NOT EXISTS catalog_episode_progress (
      catalog_item_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      is_watched INTEGER NOT NULL DEFAULT 1,
      watched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (catalog_item_id, season_number, episode_number),
      FOREIGN KEY(catalog_item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
    );
  `);

  // Non-destructive schema migration: check if related_json, sources_json, and format columns exist
  try {
    const tableInfo = db.prepare('PRAGMA table_info(cached_media);').all();
    const hasRelated = tableInfo.some(col => col.name === 'related_json');
    if (!hasRelated) {
      db.exec('ALTER TABLE cached_media ADD COLUMN related_json TEXT;');
    }
    const hasSources = tableInfo.some(col => col.name === 'sources_json');
    if (!hasSources) {
      db.exec('ALTER TABLE cached_media ADD COLUMN sources_json TEXT;');
    }
    const hasFormat = tableInfo.some(col => col.name === 'format');
    if (!hasFormat) {
      db.exec("ALTER TABLE cached_media ADD COLUMN format TEXT DEFAULT 'Series';");
    }

    const catInfo = db.prepare('PRAGMA table_info(catalog_items);').all();
    const hasCatFormat = catInfo.some(col => col.name === 'format');
    if (!hasCatFormat) {
      db.exec("ALTER TABLE catalog_items ADD COLUMN format TEXT DEFAULT 'Series';");
    }

    const hasRewatching = catInfo.some(col => col.name === 'is_rewatching');
    if (!hasRewatching) {
      db.exec("ALTER TABLE catalog_items ADD COLUMN is_rewatching INTEGER DEFAULT 0;");
    }

    // Keep all anime inside Anime tab: fix any anime movies mistakenly saved as media_type = 'Movie'
    db.exec(`
      UPDATE cached_media SET media_type = 'Anime', format = 'Movie' 
      WHERE (id LIKE 'omni_ani_%' OR id LIKE 'omni_kitsu_%') AND (media_type = 'Movie' OR format = 'Movie');

      UPDATE catalog_items SET media_type = 'Anime', format = 'Movie' 
      WHERE (canonical_id LIKE 'omni_ani_%' OR canonical_id LIKE 'omni_kitsu_%') AND (media_type = 'Movie' OR format = 'Movie');

      UPDATE cached_media SET sources_json = REPLACE(sources_json, 'hianime.to', 'hianime.org') WHERE sources_json LIKE '%hianime.to%';
      UPDATE cached_media SET sources_json = REPLACE(sources_json, 'anitaku.to', 'anitaku.pe') WHERE sources_json LIKE '%anitaku.to%';
    `);

    // Create mirror_sources registry table for dynamic domain management
    db.exec(`
      CREATE TABLE IF NOT EXISTS mirror_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        quality TEXT DEFAULT '1080p HD',
        audio TEXT DEFAULT 'Multi-Audio',
        current_domain TEXT NOT NULL,
        candidate_domains TEXT NOT NULL,
        search_template TEXT NOT NULL,
        direct_url_template TEXT,
        status TEXT DEFAULT 'Working',
        latency_ms INTEGER DEFAULT 0,
        last_checked_at TEXT,
        is_enabled INTEGER DEFAULT 1,
        status_note TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Initialize default registry if table is empty
    const mCount = db.prepare('SELECT COUNT(*) as cnt FROM mirror_sources').get();
    if (!mCount || mCount.cnt === 0) {
      const insStmt = db.prepare(`
        INSERT INTO mirror_sources (
          id, name, category, type, quality, audio, current_domain, candidate_domains,
          search_template, direct_url_template, status_note, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of DEFAULT_MIRROR_REGISTRY) {
        insStmt.run(
          m.id,
          m.name,
          m.category,
          m.type,
          m.quality || '1080p HD',
          m.audio || 'Multi-Audio',
          m.currentDomain,
          JSON.stringify(m.candidateDomains || [m.currentDomain]),
          m.searchTemplate,
          m.directUrlTemplate || null,
          m.statusNote || null,
          m.sortOrder || 0
        );
      }
    }
  } catch (e) {
    // Column already exists or table freshly created
  }
}

export function initDB() {
  return getDB();
}

/**
 * =========================================================================
 * CANONICAL MEDIA REPOSITORY METHODS
 * =========================================================================
 */

export function saveCanonicalMedia(media) {
  if (!media || !media.id) return null;
  const db = getDB();

  const isAnimeSource = media.id.startsWith('omni_ani_') || media.id.startsWith('omni_kitsu_');
  const mediaType = isAnimeSource ? 'Anime' : (media.mediaType || 'Anime');
  const isMovie = Boolean(media.isMovie || media.format === 'Movie' || media.mediaType === 'Movie');
  const format = media.format || (isMovie ? 'Movie' : 'Series');

  const stmt = db.prepare(`
    INSERT INTO cached_media (
      id, media_type, format, title, original_title, romaji_title, slug, synopsis, tagline,
      release_date, release_year, runtime_minutes, status, rating, vote_count,
      popularity_score, poster_url, backdrop_url, banner_url, genres_json,
      country_of_origin, studios_json, networks_json, creators_json, cast_json, related_json,
      total_seasons, total_episodes, next_airing_episode, next_airing_at,
      last_synced_at, cache_ttl_hours
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      media_type = excluded.media_type,
      format = excluded.format,
      title = excluded.title,
      original_title = excluded.original_title,
      romaji_title = excluded.romaji_title,
      synopsis = excluded.synopsis,
      tagline = excluded.tagline,
      release_date = excluded.release_date,
      release_year = excluded.release_year,
      runtime_minutes = excluded.runtime_minutes,
      status = excluded.status,
      rating = excluded.rating,
      vote_count = excluded.vote_count,
      popularity_score = excluded.popularity_score,
      poster_url = excluded.poster_url,
      backdrop_url = excluded.backdrop_url,
      banner_url = excluded.banner_url,
      genres_json = excluded.genres_json,
      studios_json = excluded.studios_json,
      networks_json = excluded.networks_json,
      creators_json = excluded.creators_json,
      cast_json = excluded.cast_json,
      related_json = excluded.related_json,
      total_seasons = excluded.total_seasons,
      total_episodes = excluded.total_episodes,
      next_airing_episode = excluded.next_airing_episode,
      next_airing_at = excluded.next_airing_at,
      last_synced_at = excluded.last_synced_at
  `);

  stmt.run(
    media.id,
    mediaType,
    format,
    media.title,
    media.originalTitle || null,
    media.romajiTitle || null,
    media.slug || media.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    media.synopsis || null,
    media.tagline || null,
    media.releaseDate || null,
    media.releaseYear || (media.releaseDate ? parseInt(media.releaseDate.substring(0, 4), 10) : null),
    media.runtimeMinutes || null,
    media.status || 'Released',
    media.rating || null,
    media.voteCount || 0,
    media.popularityScore || 0,
    media.posterUrl || null,
    media.backdropUrl || media.posterUrl || null,
    media.bannerUrl || media.backdropUrl || null,
    JSON.stringify(media.genres || []),
    media.countryOfOrigin || null,
    JSON.stringify(media.studios || []),
    JSON.stringify(media.networks || []),
    JSON.stringify(media.creators || []),
    JSON.stringify(media.cast || []),
    JSON.stringify(media.relatedMedia || []),
    media.totalSeasons || 1,
    media.totalEpisodes || null,
    media.nextAiringEpisode || null,
    media.nextAiringAt || null,
    media.lastSyncedAt || new Date().toISOString(),
    media.cacheTtlHours || 48
  );

  // Save provider mappings
  if (Array.isArray(media.providerMappings)) {
    const mapStmt = db.prepare(`
      INSERT OR REPLACE INTO media_provider_mappings (
        canonical_id, provider_name, external_id, external_url, matched_confidence
      ) VALUES (?, ?, ?, ?, ?)
    `);
    for (const m of media.providerMappings) {
      if (m.provider && m.id) {
        mapStmt.run(media.id, m.provider, String(m.id), m.url || null, m.confidence || 1.0);
      }
    }
  }

  // Save seasons & episodes
  if (Array.isArray(media.seasons)) {
    const seasonStmt = db.prepare(`
      INSERT OR REPLACE INTO media_seasons (
        canonical_id, season_number, title, overview, episode_count, poster_url, air_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const epStmt = db.prepare(`
      INSERT OR REPLACE INTO media_episodes (
        canonical_id, season_number, episode_number, title, overview, air_date, runtime_minutes, still_url, vote_average
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of media.seasons) {
      seasonStmt.run(
        media.id,
        s.seasonNumber,
        s.title || `Season ${s.seasonNumber}`,
        s.overview || null,
        s.episodeCount || (s.episodes ? s.episodes.length : 0),
        s.posterUrl || null,
        s.airDate || null
      );

      if (Array.isArray(s.episodes)) {
        for (const ep of s.episodes) {
          epStmt.run(
            media.id,
            s.seasonNumber,
            ep.episodeNumber,
            ep.title || `Episode ${ep.episodeNumber}`,
            ep.overview || null,
            ep.airDate || null,
            ep.runtimeMinutes || null,
            ep.stillUrl || null,
            ep.voteAverage || null
          );
        }
      }
    }
  }

  // Save trailers
  if (Array.isArray(media.trailers)) {
    const trailerStmt = db.prepare(`
      INSERT OR REPLACE INTO media_trailers (
        id, canonical_id, source_site, video_key, title, thumbnail_url, is_official
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tr of media.trailers) {
      const trId = tr.id || `${media.id}_tr_${tr.videoKey}`;
      trailerStmt.run(
        trId,
        media.id,
        tr.site || 'YouTube',
        tr.videoKey,
        tr.title || 'Official Trailer',
        tr.thumbnailUrl || `https://img.youtube.com/vi/${tr.videoKey}/hqdefault.jpg`,
        tr.isOfficial ? 1 : 0
      );
    }
  }

  // Save watch providers
  if (Array.isArray(media.watchProviders)) {
    const wpStmt = db.prepare(`
      INSERT OR REPLACE INTO media_watch_providers (
        id, canonical_id, region_code, provider_name, provider_logo_url,
        availability_type, web_url, display_priority, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const wp of media.watchProviders) {
      const wpId = `${media.id}_${wp.region || 'US'}_${wp.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${wp.type}`;
      wpStmt.run(
        wpId,
        media.id,
        wp.region || 'US',
        wp.name,
        wp.logoUrl || null,
        wp.type || 'FLATRATE',
        wp.webUrl || null,
        wp.priority || 10,
        new Date().toISOString()
      );
    }
  }

  // Save custom or provided sources
  if (Array.isArray(media.sources) && media.sources.length > 0) {
    db.prepare('UPDATE cached_media SET sources_json = ? WHERE id = ?').run(JSON.stringify(media.sources), media.id);
  }

  return getCanonicalMedia(media.id);
}

export function getCanonicalMedia(canonicalId) {
  const db = getDB();
  const row = db.prepare('SELECT * FROM cached_media WHERE id = ?').get(canonicalId);
  if (!row) return null;

  return hydrateCanonicalMedia(db, row);
}

function hydrateCanonicalMedia(db, row) {
  const mappings = db.prepare('SELECT * FROM media_provider_mappings WHERE canonical_id = ?').all(row.id);
  const seasonsRows = db.prepare('SELECT * FROM media_seasons WHERE canonical_id = ? ORDER BY season_number ASC').all(row.id);
  const trailers = db.prepare('SELECT * FROM media_trailers WHERE canonical_id = ?').all(row.id);
  const watchProviders = db.prepare('SELECT * FROM media_watch_providers WHERE canonical_id = ? ORDER BY display_priority ASC').all(row.id);

  const cleanTitle = row.title || 'Media';
  const cleanSlug = encodeURIComponent(cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

  const seasons = seasonsRows.map((s) => {
    const episodes = db.prepare(`
      SELECT * FROM media_episodes 
      WHERE canonical_id = ? AND season_number = ? 
      ORDER BY episode_number ASC
    `).all(row.id, s.season_number);

    return {
      seasonNumber: s.season_number,
      title: s.title,
      overview: s.overview,
      episodeCount: s.episode_count,
      posterUrl: s.poster_url,
      airDate: s.air_date,
      episodes: episodes.map(e => ({
        episodeNumber: e.episode_number,
        title: e.title,
        overview: e.overview,
        airDate: e.air_date,
        runtimeMinutes: e.runtime_minutes,
        stillUrl: e.still_url,
        voteAverage: e.vote_average,
        links: row.media_type === 'Anime'
          ? [
              `https://hianime.org/filter?search=${encodeURIComponent(cleanTitle)}`,
              `https://anitaku.pe/search.html?keyword=${encodeURIComponent(cleanTitle)}`
            ]
          : [
              `https://7reels.cc/search?q=${encodeURIComponent(cleanTitle)}`,
              `https://www.1flex.org/search?q=${encodeURIComponent(cleanTitle)}`
            ]
      }))
    };
  });

  let relatedMedia = JSON.parse(row.related_json || '[]');

  // If no upstream relatedMedia cached, generate fallback recommendations from same genre
  if (relatedMedia.length === 0) {
    const genres = JSON.parse(row.genres_json || '[]');
    if (genres.length > 0) {
      const primaryGenre = genres[0];
      const relatedRows = db.prepare(`
        SELECT id, title, poster_url, media_type, rating 
        FROM cached_media 
        WHERE id != ? AND genres_json LIKE ? 
        ORDER BY popularity_score DESC LIMIT 6
      `).all(row.id, `%"${primaryGenre}"%`);

      relatedMedia = relatedRows.map(r => ({
        id: r.id,
        title: r.title,
        posterUrl: r.poster_url,
        mediaType: r.media_type,
        rating: r.rating,
        relationType: 'RECOMMENDED'
      }));
    }
  }

  // Hydrate streaming and download mirrors
  let customSources = [];
  try {
    if (row.sources_json) {
      customSources = JSON.parse(row.sources_json);
    }
  } catch (e) {
    customSources = [];
  }
  const isMovie = row.format === 'Movie' || row.media_type === 'Movie';
  const format = row.format || (isMovie ? 'Movie' : 'Series');

  const registry = getAllMirrorSources();
  const defaultMirrors = generateDefaultMirrors({
    id: row.id,
    title: row.title,
    mediaType: row.media_type,
    releaseYear: row.release_year,
    isMovie
  }, registry.length > 0 ? registry : undefined);

  const customOnly = (customSources || []).filter(cs => cs && cs.id && !cs.id.startsWith('mirror_'));
  const sources = [...defaultMirrors, ...customOnly];

  return {
    id: row.id,
    mediaType: row.media_type,
    format,
    isMovie,
    title: row.title,
    originalTitle: row.original_title,
    romajiTitle: row.romaji_title,
    slug: row.slug,
    synopsis: row.synopsis,
    tagline: row.tagline,
    releaseDate: row.release_date,
    releaseYear: row.release_year,
    runtimeMinutes: row.runtime_minutes,
    status: row.status,
    rating: row.rating,
    voteCount: row.vote_count,
    popularityScore: row.popularity_score,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    bannerUrl: row.banner_url,
    genres: JSON.parse(row.genres_json || '[]'),
    countryOfOrigin: row.country_of_origin,
    studios: JSON.parse(row.studios_json || '[]'),
    networks: JSON.parse(row.networks_json || '[]'),
    creators: JSON.parse(row.creators_json || '[]'),
    cast: JSON.parse(row.cast_json || '[]'),
    relatedMedia,
    sources,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
    nextAiringEpisode: row.next_airing_episode,
    nextAiringAt: row.next_airing_at,
    lastSyncedAt: row.last_synced_at,
    cacheTtlHours: row.cache_ttl_hours,
    providerMappings: mappings.map(m => ({
      provider: m.provider_name,
      id: m.external_id,
      url: m.external_url
    })),
    seasons,
    trailers: trailers.map(t => ({
      id: t.id,
      site: t.source_site,
      videoKey: t.video_key,
      title: t.title,
      thumbnailUrl: t.thumbnail_url,
      isOfficial: Boolean(t.is_official)
    })),
    watchProviders: watchProviders.map(wp => ({
      id: wp.id,
      region: wp.region_code,
      name: wp.provider_name,
      logoUrl: wp.provider_logo_url,
      type: wp.availability_type,
      webUrl: wp.web_url
    }))
  };
}

export function addMediaSource(canonicalId, newSource) {
  const db = getDB();
  const row = db.prepare('SELECT sources_json, title, media_type, release_year FROM cached_media WHERE id = ?').get(canonicalId);
  if (!row) return null;

  let sources = [];
  try {
    if (row.sources_json) sources = JSON.parse(row.sources_json);
  } catch (e) {}

  if (!sources || sources.length === 0) {
    sources = generateDefaultMirrors({ title: row.title, mediaType: row.media_type, releaseYear: row.release_year });
  }

  const sourceId = newSource.id || `custom_mirror_${Date.now()}`;
  sources.unshift({
    id: sourceId,
    sourceName: newSource.sourceName || 'Custom Mirror',
    url: newSource.url,
    type: newSource.type || 'Stream',
    quality: newSource.quality || '1080p HD',
    audio: newSource.audio || 'Multi-Audio',
    isSafe: true,
    verified: true,
    isCustom: true
  });

  db.prepare('UPDATE cached_media SET sources_json = ? WHERE id = ?').run(JSON.stringify(sources), canonicalId);
  return getCanonicalMedia(canonicalId);
}

export function deleteMediaSource(canonicalId, sourceId) {
  const db = getDB();
  const row = db.prepare('SELECT sources_json, title, media_type, release_year FROM cached_media WHERE id = ?').get(canonicalId);
  if (!row) return null;

  let sources = [];
  try {
    if (row.sources_json) sources = JSON.parse(row.sources_json);
  } catch (e) {}

  if (!sources || sources.length === 0) {
    sources = generateDefaultMirrors({ title: row.title, mediaType: row.media_type, releaseYear: row.release_year });
  }

  sources = sources.filter(s => s.id !== sourceId && s.sourceName !== sourceId);
  db.prepare('UPDATE cached_media SET sources_json = ? WHERE id = ?').run(JSON.stringify(sources), canonicalId);
  return getCanonicalMedia(canonicalId);
}

export function searchCachedMedia(query, { type = 'All', genre = 'All', sort = 'popularity_desc', limit = 24, page = 1, animeFormat = 'All', format = 'All' } = {}) {
  const db = getDB();
  let sql = 'SELECT * FROM cached_media WHERE 1=1';
  const params = [];

  if (query && query.trim()) {
    const rawQ = query.trim().toLowerCase();
    const cleanQ = rawQ.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const tokens = cleanQ.split(/\s+/).filter(t => t.length > 0);
    const qLike = `%${rawQ}%`;

    if (tokens.length > 1) {
      // Allow exact substring match OR all words matching across title fields
      const tokenClause = tokens
        .map(() => '(LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ?)')
        .join(' AND ');
      sql += ` AND ((LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ?) OR (${tokenClause}))`;
      params.push(qLike, qLike, qLike, `%${rawQ.replace(/[^a-z0-9]+/g, '-')}%`);
      for (const t of tokens) {
        const tLike = `%${t}%`;
        params.push(tLike, tLike, tLike, tLike);
      }
    } else {
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ?)';
      params.push(qLike, qLike, qLike, `%${rawQ.replace(/[^a-z0-9]+/g, '-')}%`);
    }
  }

  if (type && type !== 'All') {
    sql += ' AND media_type = ?';
    params.push(type);
  }

  const activeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
  if (type === 'Anime' && activeFormat !== 'All') {
    sql += ' AND format = ?';
    params.push(activeFormat);
  }

  if (genre && genre !== 'All') {
    sql += ' AND genres_json LIKE ?';
    params.push(`%"${genre}"%`);
  }

  switch (sort) {
    case 'rating_desc':
      sql += ' ORDER BY rating DESC NULLS LAST, popularity_score DESC';
      break;
    case 'release_desc':
      sql += ' ORDER BY release_year DESC NULLS LAST, release_date DESC NULLS LAST';
      break;
    case 'title_asc':
      sql += ' ORDER BY title ASC';
      break;
    case 'popularity_desc':
    default:
      sql += ' ORDER BY popularity_score DESC, rating DESC';
      break;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 24);
  const offset = (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => hydrateCanonicalMedia(db, r));
}

export function remapDuplicateCanonicalMedia(primaryId, duplicateId) {
  if (!primaryId || !duplicateId || primaryId === duplicateId) return;
  const db = getDB();
  try {
    // If catalog items referenced duplicateId, re-link them to primaryId
    db.prepare('UPDATE catalog_items SET canonical_id = ? WHERE canonical_id = ?').run(primaryId, duplicateId);
    // Delete duplicate from cached_media
    db.prepare('DELETE FROM cached_media WHERE id = ?').run(duplicateId);
  } catch (e) {}
}

export function getCachedTrending(type = 'All', limit = 24, { animeFormat = 'All', format = 'All', page = 1, genre = 'All', sort = 'popularity_desc' } = {}) {
  const db = getDB();
  let sql = 'SELECT * FROM cached_media WHERE 1=1';
  const params = [];

  if (type && type !== 'All') {
    sql += ' AND media_type = ?';
    params.push(type);
  }

  const activeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
  if (type === 'Anime' && activeFormat !== 'All') {
    sql += ' AND format = ?';
    params.push(activeFormat);
  }

  if (genre && genre !== 'All') {
    sql += ' AND LOWER(genres_json) LIKE ?';
    params.push(`%"${genre.toLowerCase()}"%`);
  }

  switch (sort) {
    case 'rating_desc':
      sql += ' ORDER BY rating DESC NULLS LAST, popularity_score DESC';
      break;
    case 'release_desc':
    case 'year_desc':
      sql += ' ORDER BY release_year DESC NULLS LAST, release_date DESC NULLS LAST';
      break;
    case 'title_asc':
      sql += ' ORDER BY title ASC';
      break;
    case 'popularity_desc':
    default:
      sql += ' ORDER BY popularity_score DESC, rating DESC';
      break;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 24);
  const offset = (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => hydrateCanonicalMedia(db, r));
}

/**
 * =========================================================================
 * PERSONAL CATALOG REPOSITORY METHODS
 * =========================================================================
 */

export function getCatalogItems({ status = 'All', type = 'All', sort = 'updated_desc', favoriteOnly = false, genre = 'All', search = '', animeFormat = 'All', format = 'All', page, limit } = {}) {
  const db = getDB();
  let sql = 'SELECT * FROM catalog_items WHERE 1=1';
  const params = [];

  if (status && status !== 'All') {
    if (status === 'Rewatching') {
      sql += ' AND (user_status = ? OR is_rewatching = 1)';
      params.push('Rewatching');
    } else {
      sql += ' AND user_status = ?';
      params.push(status);
    }
  }

  if (type && type !== 'All') {
    sql += ' AND media_type = ?';
    params.push(type);
  }

  const activeFormat = animeFormat !== 'All' ? animeFormat : (format !== 'All' ? format : 'All');
  if (type === 'Anime' && activeFormat !== 'All') {
    sql += ' AND format = ?';
    params.push(activeFormat);
  }

  if (favoriteOnly) {
    sql += ' AND is_favorite = 1';
  }

  if (search && search.trim()) {
    sql += ' AND LOWER(title) LIKE ?';
    params.push(`%${search.trim().toLowerCase()}%`);
  }

  if (genre && genre !== 'All') {
    sql += ' AND (canonical_id IN (SELECT id FROM cached_media WHERE LOWER(genres_json) LIKE ?) OR id IN (SELECT id FROM cached_media WHERE LOWER(genres_json) LIKE ?) OR LOWER(tags_json) LIKE ?)';
    const gPattern = `%"${genre.toLowerCase()}"%`;
    params.push(gPattern, gPattern, gPattern);
  }

  switch (sort) {
    case 'rating_desc':
      sql += ' ORDER BY user_rating DESC NULLS LAST, updated_at DESC';
      break;
    case 'title_asc':
      sql += ' ORDER BY title ASC';
      break;
    case 'year_desc':
    case 'release_desc':
      sql += ' ORDER BY release_year DESC NULLS LAST';
      break;
    case 'progress_desc':
      sql += ' ORDER BY current_episode DESC, updated_at DESC';
      break;
    case 'popularity_desc':
      sql += ' ORDER BY user_rating DESC NULLS LAST, updated_at DESC';
      break;
    case 'updated_desc':
    default:
      sql += ' ORDER BY updated_at DESC';
      break;
  }

  if (page !== undefined && limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);
    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => hydrateCatalogItem(db, r));
}

export function getCatalogItem(id) {
  const db = getDB();
  const row = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
  if (!row) return null;
  return hydrateCatalogItem(db, row);
}

export function getCatalogItemByCanonicalId(canonicalId) {
  const db = getDB();
  const row = db.prepare('SELECT * FROM catalog_items WHERE canonical_id = ?').get(canonicalId);
  if (!row) return null;
  return hydrateCatalogItem(db, row);
}

function hydrateCatalogItem(db, row) {
  const progressRows = db.prepare(`
    SELECT season_number, episode_number, is_watched, watched_at 
    FROM catalog_episode_progress 
    WHERE catalog_item_id = ? AND is_watched = 1
    ORDER BY season_number ASC, episode_number ASC
  `).all(row.id);

  const isMovie = row.format === 'Movie' || row.media_type === 'Movie';
  const format = row.format || (isMovie ? 'Movie' : 'Series');

  const cached = row.canonical_id ? db.prepare('SELECT genres_json FROM cached_media WHERE id = ?').get(row.canonical_id) : null;
  let genres = [];
  try {
    if (cached && cached.genres_json) {
      genres = JSON.parse(cached.genres_json);
    }
  } catch (e) {}
  if (!genres || genres.length === 0) {
    try {
      genres = JSON.parse(row.tags_json || '[]');
    } catch (e) {}
  }

  return {
    id: row.id,
    canonicalId: row.canonical_id,
    mediaType: row.media_type,
    format,
    isMovie,
    title: row.title,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    releaseYear: row.release_year,
    userStatus: row.user_status,
    isFavorite: Boolean(row.is_favorite),
    isRewatching: Boolean(row.is_rewatching),
    userRating: row.user_rating,
    currentSeason: row.current_season,
    currentEpisode: row.current_episode,
    totalEpisodes: row.total_episodes,
    notes: row.notes,
    genres: genres || [],
    tags: JSON.parse(row.tags_json || '[]'),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastWatchedAt: row.last_watched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    watchedEpisodes: progressRows.map(p => ({
      seasonNumber: p.season_number,
      episodeNumber: p.episode_number,
      watchedAt: p.watched_at
    }))
  };
}

export function upsertCatalogItem(item) {
  const db = getDB();
  const now = new Date().toISOString();

  let existing = null;
  if (item.id) {
    existing = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(item.id);
  } else if (item.canonicalId) {
    existing = db.prepare('SELECT * FROM catalog_items WHERE canonical_id = ?').get(item.canonicalId);
  }

  const id = existing ? existing.id : (item.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

  const isAnimeSource = (item.canonicalId && (item.canonicalId.startsWith('omni_ani_') || item.canonicalId.startsWith('omni_kitsu_'))) || item.mediaType === 'Anime';
  const mediaType = isAnimeSource ? 'Anime' : (item.mediaType || 'Anime');
  const isMovie = Boolean(item.isMovie || item.format === 'Movie' || mediaType === 'Movie');
  const format = item.format || (isMovie ? 'Movie' : 'Series');

  let itemTags = [];
  if (Array.isArray(item.tags)) itemTags.push(...item.tags);
  if (Array.isArray(item.genres)) {
    for (const g of item.genres) {
      if (!itemTags.includes(g)) itemTags.push(g);
    }
  }
  if (itemTags.length === 0 && existing?.tags_json) {
    try { itemTags = JSON.parse(existing.tags_json); } catch (e) {}
  }

  // Ensure cached_media has reference for canonical_id with genres
  if (item.canonicalId) {
    try {
      const existingMedia = db.prepare('SELECT id FROM cached_media WHERE id = ?').get(item.canonicalId);
      if (!existingMedia) {
        db.prepare(`
          INSERT OR IGNORE INTO cached_media (id, media_type, format, title, poster_url, backdrop_url, release_year, genres_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.canonicalId,
          mediaType,
          format,
          item.title,
          item.posterUrl || null,
          item.backdropUrl || null,
          item.releaseYear || null,
          JSON.stringify(item.genres || itemTags || [])
        );
      }
    } catch (e) {}
  }

  const stmt = db.prepare(`
    INSERT INTO catalog_items (
      id, canonical_id, media_type, format, title, poster_url, backdrop_url, release_year,
      user_status, is_favorite, is_rewatching, user_rating, current_season, current_episode,
      total_episodes, notes, tags_json, started_at, completed_at, last_watched_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      media_type = excluded.media_type,
      format = excluded.format,
      user_status = excluded.user_status,
      is_favorite = excluded.is_favorite,
      is_rewatching = excluded.is_rewatching,
      user_rating = excluded.user_rating,
      current_season = excluded.current_season,
      current_episode = excluded.current_episode,
      total_episodes = COALESCE(excluded.total_episodes, catalog_items.total_episodes),
      notes = excluded.notes,
      tags_json = excluded.tags_json,
      started_at = COALESCE(excluded.started_at, catalog_items.started_at),
      completed_at = excluded.completed_at,
      last_watched_at = excluded.last_watched_at,
      updated_at = excluded.updated_at
  `);

  const completedAt = (item.userStatus === 'Completed' && !existing?.completed_at) ? now : (item.completedAt || existing?.completed_at || null);
  const startedAt = (item.userStatus === 'Watching' && !existing?.started_at) ? now : (item.startedAt || existing?.started_at || null);
  const isRewatchingVal = item.isRewatching !== undefined
    ? (item.isRewatching ? 1 : 0)
    : (existing?.is_rewatching ? 1 : 0);

  stmt.run(
    id,
    item.canonicalId,
    mediaType,
    format,
    item.title,
    item.posterUrl || null,
    item.backdropUrl || null,
    item.releaseYear || null,
    item.userStatus || 'Want to Watch',
    item.isFavorite ? 1 : 0,
    isRewatchingVal,
    item.userRating !== undefined ? item.userRating : (existing?.user_rating || null),
    item.currentSeason || (existing?.current_season || 1),
    item.currentEpisode !== undefined ? item.currentEpisode : (existing?.current_episode || 0),
    item.totalEpisodes !== undefined ? item.totalEpisodes : (existing?.total_episodes || null),
    item.notes !== undefined ? item.notes : (existing?.notes || null),
    JSON.stringify(itemTags),
    startedAt,
    completedAt,
    now,
    existing ? existing.created_at : now,
    now
  );

  return getCatalogItem(id);
}

export function deleteCatalogItem(id) {
  const db = getDB();
  db.prepare('DELETE FROM catalog_episode_progress WHERE catalog_item_id = ?').run(id);
  const res = db.prepare('DELETE FROM catalog_items WHERE id = ?').run(id);
  return res.changes > 0;
}

export function toggleEpisodeProgress(catalogItemId, seasonNumber, episodeNumber, isWatched = true) {
  const db = getDB();
  const now = new Date().toISOString();

  if (isWatched) {
    db.prepare(`
      INSERT OR REPLACE INTO catalog_episode_progress (
        catalog_item_id, season_number, episode_number, is_watched, watched_at
      ) VALUES (?, ?, ?, 1, ?)
    `).run(catalogItemId, seasonNumber, episodeNumber, now);

    db.prepare(`
      UPDATE catalog_items
      SET current_season = MAX(current_season, ?),
          current_episode = MAX(current_episode, ?),
          last_watched_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(seasonNumber, episodeNumber, now, now, catalogItemId);
  } else {
    db.prepare(`
      DELETE FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND season_number = ? AND episode_number = ?
    `).run(catalogItemId, seasonNumber, episodeNumber);

    // Recalculate remaining highest episode
    const maxProg = db.prepare(`
      SELECT MAX(episode_number) as max_ep, MAX(season_number) as max_season 
      FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND is_watched = 1
    `).get(catalogItemId);

    const remainingEp = maxProg?.max_ep || 0;
    const remainingSeason = maxProg?.max_season || 1;

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          current_episode = ?,
          updated_at = ?
      WHERE id = ?
    `).run(remainingSeason, remainingEp, now, catalogItemId);
  }

  return getCatalogItem(catalogItemId);
}

export function batchSetSeasonProgress(catalogItemId, seasonNumber, episodeCount, isWatched = true) {
  const db = getDB();
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO catalog_episode_progress (
      catalog_item_id, season_number, episode_number, is_watched, watched_at
    ) VALUES (?, ?, ?, 1, ?)
  `);

  const deleteStmt = db.prepare(`
    DELETE FROM catalog_episode_progress 
    WHERE catalog_item_id = ? AND season_number = ?
  `);

  if (isWatched) {
    for (let ep = 1; ep <= episodeCount; ep++) {
      insertStmt.run(catalogItemId, seasonNumber, ep, now);
    }
    db.prepare(`
      DELETE FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND season_number = ? AND episode_number > ?
    `).run(catalogItemId, seasonNumber, episodeCount);

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          current_episode = MAX(current_episode, ?),
          last_watched_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(seasonNumber, episodeCount, now, now, catalogItemId);
  } else {
    deleteStmt.run(catalogItemId, seasonNumber);

    const maxProg = db.prepare(`
      SELECT MAX(episode_number) as max_ep, MAX(season_number) as max_season 
      FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND is_watched = 1
    `).get(catalogItemId);

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          current_episode = ?,
          updated_at = ?
      WHERE id = ?
    `).run(maxProg?.max_season || 1, maxProg?.max_ep || 0, now, catalogItemId);
  }

  return getCatalogItem(catalogItemId);
}

export function getCatalogStats() {
  const db = getDB();

  const totalTitles = db.prepare('SELECT COUNT(*) as count FROM catalog_items').get().count;
  const statusCounts = db.prepare('SELECT user_status, COUNT(*) as count FROM catalog_items GROUP BY user_status').all();
  const typeCounts = db.prepare('SELECT media_type, COUNT(*) as count FROM catalog_items GROUP BY media_type').all();
  const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE is_favorite = 1').get().count;
  const watchedEpsCount = db.prepare('SELECT COUNT(*) as count FROM catalog_episode_progress WHERE is_watched = 1').get().count;

  const completedMoviesCount = db.prepare("SELECT COUNT(*) as count FROM catalog_items WHERE media_type = 'Movie' AND user_status = 'Completed'").get().count;
  const estimatedHours = Math.round((watchedEpsCount * 30 + completedMoviesCount * 110) / 60);

  const statusMap = {};
  for (const s of statusCounts) {
    statusMap[s.user_status] = s.count;
  }

  const typeMap = {};
  for (const t of typeCounts) {
    typeMap[t.media_type] = t.count;
  }

  return {
    totalTitles,
    favoriteCount,
    watchedEpisodesCount: watchedEpsCount,
    estimatedHoursWatched: estimatedHours,
    byStatus: {
      'Want to Watch': statusMap['Want to Watch'] || 0,
      Watching: statusMap['Watching'] || 0,
      Completed: statusMap['Completed'] || 0,
      'On Hold': statusMap['On Hold'] || 0,
      Dropped: statusMap['Dropped'] || 0,
      Rewatching: statusMap['Rewatching'] || 0
    },
    byType: {
      Anime: typeMap['Anime'] || 0,
      Movie: typeMap['Movie'] || 0,
      Series: typeMap['Series'] || 0
    }
  };
}

export function exportCatalogData() {
  const db = getDB();
  const catalog = db.prepare('SELECT * FROM catalog_items').all();
  const progress = db.prepare('SELECT * FROM catalog_episode_progress').all();

  return {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    catalog,
    progress
  };
}

export function importCatalogData(data) {
  if (!data || !Array.isArray(data.catalog)) {
    throw new Error('Invalid catalog backup data format.');
  }

  const db = getDB();
  let importedCount = 0;

  for (const item of data.catalog) {
    upsertCatalogItem({
      id: item.id,
      canonicalId: item.canonical_id || item.canonicalId,
      mediaType: item.media_type || item.mediaType,
      title: item.title,
      posterUrl: item.poster_url || item.posterUrl,
      backdropUrl: item.backdrop_url || item.backdropUrl,
      releaseYear: item.release_year || item.releaseYear,
      userStatus: item.user_status || item.userStatus,
      isFavorite: Boolean(item.is_favorite || item.isFavorite),
      userRating: item.user_rating || item.userRating,
      currentSeason: item.current_season || item.currentSeason,
      currentEpisode: item.current_episode || item.currentEpisode,
      totalEpisodes: item.total_episodes || item.totalEpisodes,
      notes: item.notes,
      tags: typeof item.tags_json === 'string' ? JSON.parse(item.tags_json) : (item.tags || [])
    });
    importedCount++;
  }

  if (Array.isArray(data.progress)) {
    const epStmt = db.prepare(`
      INSERT OR REPLACE INTO catalog_episode_progress (
        catalog_item_id, season_number, episode_number, is_watched, watched_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    for (const p of data.progress) {
      epStmt.run(
        p.catalog_item_id || p.catalogItemId,
        p.season_number || p.seasonNumber,
        p.episode_number || p.episodeNumber,
        p.is_watched !== undefined ? p.is_watched : 1,
        p.watched_at || p.watchedAt || new Date().toISOString()
      );
    }
  }

  return { success: true, importedCount };
}

/**
 * =========================================================================
 * DYNAMIC MIRROR REGISTRY REPOSITORY METHODS
 * =========================================================================
 */

export function getAllMirrorSources() {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM mirror_sources ORDER BY sort_order ASC, name ASC').all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    type: r.type,
    quality: r.quality,
    audio: r.audio,
    currentDomain: r.current_domain,
    candidateDomains: JSON.parse(r.candidate_domains || '[]'),
    searchTemplate: r.search_template,
    directUrlTemplate: r.direct_url_template,
    status: r.status,
    latencyMs: r.latency_ms,
    lastCheckedAt: r.last_checked_at,
    isEnabled: Boolean(r.is_enabled),
    statusNote: r.status_note,
    sortOrder: r.sort_order
  }));
}

export function updateMirrorSourceDomain(id, newDomain, status = 'Working', latencyMs = 0, statusNote = null) {
  const db = getDB();
  db.prepare(`
    UPDATE mirror_sources 
    SET current_domain = ?, status = ?, latency_ms = ?, status_note = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(newDomain, status, latencyMs, statusNote, id);
}

export function updateMirrorStatus(id, status, latencyMs, statusNote) {
  const db = getDB();
  db.prepare(`
    UPDATE mirror_sources 
    SET status = ?, latency_ms = ?, status_note = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, latencyMs, statusNote, id);
}

export function upsertMirrorSource(item) {
  const db = getDB();
  db.prepare(`
    INSERT INTO mirror_sources (
      id, name, category, type, quality, audio, current_domain, candidate_domains,
      search_template, direct_url_template, is_enabled, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      type = excluded.type,
      quality = excluded.quality,
      audio = excluded.audio,
      current_domain = excluded.current_domain,
      candidate_domains = excluded.candidate_domains,
      search_template = excluded.search_template,
      direct_url_template = excluded.direct_url_template,
      is_enabled = excluded.is_enabled,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `).run(
    item.id,
    item.name,
    item.category || 'All',
    item.type || 'Stream',
    item.quality || '1080p HD',
    item.audio || 'Multi-Audio',
    item.currentDomain,
    JSON.stringify(item.candidateDomains || [item.currentDomain]),
    item.searchTemplate,
    item.directUrlTemplate || null,
    item.isEnabled !== false ? 1 : 0,
    item.sortOrder || 0
  );
}

export function deleteMirrorSourceItem(id) {
  const db = getDB();
  db.prepare('DELETE FROM mirror_sources WHERE id = ?').run(id);
}
