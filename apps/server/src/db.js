import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDefaultMirrors, DEFAULT_MIRROR_REGISTRY } from '@omniwatch/shared';
import * as neonDB from './db_neon.js';
import { hashPassword, DEFAULT_USER_ID, DEFAULT_USER_EMAIL } from './auth.js';

export function isNeon() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}


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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

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

    const hasSeasonsCompleted = catInfo.some(col => col.name === 'seasons_completed');
    if (!hasSeasonsCompleted) {
      db.exec("ALTER TABLE catalog_items ADD COLUMN seasons_completed INTEGER DEFAULT 0;");
    }

    const hasTotalSeasons = catInfo.some(col => col.name === 'total_seasons');
    if (!hasTotalSeasons) {
      db.exec("ALTER TABLE catalog_items ADD COLUMN total_seasons INTEGER DEFAULT 1;");
    }

    const hasUserId = catInfo.some(col => col.name === 'user_id');
    if (!hasUserId) {
      db.exec(`ALTER TABLE catalog_items ADD COLUMN user_id TEXT DEFAULT '${DEFAULT_USER_ID}';`);
    }

    const progInfo = db.prepare('PRAGMA table_info(catalog_episode_progress);').all();
    const hasProgUserId = progInfo.some(col => col.name === 'user_id');
    if (!hasProgUserId) {
      db.exec(`ALTER TABLE catalog_episode_progress ADD COLUMN user_id TEXT DEFAULT '${DEFAULT_USER_ID}';`);
    }

    // Seed default user makisanis106@gmail.com if not exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(DEFAULT_USER_EMAIL);
    if (!existingUser) {
      const seedHash = hashPassword('OutCast106');
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(DEFAULT_USER_ID, DEFAULT_USER_EMAIL, seedHash, 'Maki Sanis', now, now);
    }

    // Migrate all unassigned legacy catalog records to default user
    db.prepare('UPDATE catalog_items SET user_id = ? WHERE user_id IS NULL OR user_id = \'\'').run(DEFAULT_USER_ID);
    db.prepare('UPDATE catalog_episode_progress SET user_id = ? WHERE user_id IS NULL OR user_id = \'\'').run(DEFAULT_USER_ID);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_catalog_user ON catalog_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_catalog_user_status ON catalog_items(user_id, user_status);
      CREATE INDEX IF NOT EXISTS idx_catalog_user_canonical ON catalog_items(user_id, canonical_id);
      CREATE INDEX IF NOT EXISTS idx_progress_user ON catalog_episode_progress(user_id);
    `);

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

    // Synchronize cached_media total_seasons with media_seasons count if media_seasons has more
    db.exec(`
      UPDATE cached_media
      SET total_seasons = (SELECT COUNT(*) FROM media_seasons WHERE canonical_id = cached_media.id)
      WHERE id IN (
        SELECT canonical_id FROM media_seasons GROUP BY canonical_id HAVING COUNT(*) > 1
      ) AND total_seasons < (SELECT COUNT(*) FROM media_seasons WHERE canonical_id = cached_media.id);
    `);

    // Clean up redundant subsequent season records (e.g. "Title Season 2", "Title Season 3", "Title 2nd Season")
    const SUBSEQUENT_SEASON_REGEX = /\s*[:\-–—]?\s*\b(?:Season\s+([2-9]|\d{2,})|[2-9]\d*(?:nd|rd|th)\s+Season|Final\s+Season|Season\s+Final|Cour\s+([2-9]|\d{2,}))\b.*/i;
    const seasonNumExtractRegex = /\b(?:Season\s+([2-9]|\d{2,})|([2-9]\d*)(?:nd|rd|th)\s+Season|Cour\s+([2-9]|\d{2,}))\b/i;

    const candidateSeasonRows = db.prepare(`
      SELECT id, title, media_type, format, total_seasons 
      FROM cached_media 
      WHERE (format != 'Movie' AND media_type != 'Movie') 
        AND (
          title LIKE '%Season 2%' OR title LIKE '%Season 3%' OR title LIKE '%Season 4%' OR
          title LIKE '%Season 5%' OR title LIKE '%Season 6%' OR title LIKE '%Season 7%' OR
          title LIKE '%Season 8%' OR title LIKE '%Season 9%' OR title LIKE '%Season 10%' OR
          title LIKE '%2nd Season%' OR title LIKE '%3rd Season%' OR title LIKE '%4th Season%' OR
          title LIKE '%5th Season%' OR title LIKE '%Final Season%' OR title LIKE '%Cour 2%'
        )
    `).all();

    for (const row of candidateSeasonRows) {
      if (SUBSEQUENT_SEASON_REGEX.test(row.title)) {
        const baseTitle = row.title.replace(SUBSEQUENT_SEASON_REGEX, '').trim();
        const numMatch = row.title.match(seasonNumExtractRegex);
        const extractedSeasonNum = numMatch ? parseInt(numMatch[1] || numMatch[2] || numMatch[3] || '2', 10) : 2;

        if (baseTitle) {
          const baseShow = db.prepare('SELECT id, title, total_seasons FROM cached_media WHERE LOWER(title) = ? OR LOWER(title) LIKE ? LIMIT 1').get(baseTitle.toLowerCase(), `${baseTitle.toLowerCase()}%`);
          if (baseShow && baseShow.id !== row.id) {
            db.prepare('UPDATE cached_media SET total_seasons = MAX(total_seasons, ?) WHERE id = ?').run(extractedSeasonNum, baseShow.id);
            try {
              remapDuplicateCanonicalMedia(baseShow.id, row.id);
            } catch (e) {}
            db.prepare('DELETE FROM cached_media WHERE id = ?').run(row.id);
          } else {
            db.prepare('UPDATE cached_media SET title = ?, total_seasons = MAX(total_seasons, ?) WHERE id = ?').run(baseTitle, extractedSeasonNum, row.id);
          }
        }
      }
    }
  } catch (e) {
    // Column already exists or table freshly created
  }
}

export function initDB() {
  if (isNeon()) return neonDB.initDB();
  return getDB();
}

/**
 * =========================================================================
 * CANONICAL MEDIA REPOSITORY METHODS
 * =========================================================================
 */

export function saveCanonicalMedia(media) {
  if (isNeon()) return neonDB.saveCanonicalMedia(media);
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
      total_seasons = MAX(COALESCE(excluded.total_seasons, 1), COALESCE(cached_media.total_seasons, 1), (SELECT COUNT(*) FROM media_seasons WHERE canonical_id = cached_media.id)),
      total_episodes = MAX(COALESCE(excluded.total_episodes, 0), COALESCE(cached_media.total_episodes, 0)),
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
    Math.max(media.totalSeasons || 1, Array.isArray(media.seasons) ? media.seasons.length : 1),
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
  if (isNeon()) return neonDB.getCanonicalMedia(canonicalId);
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
    mainCharacters: (() => {
      const parsed = JSON.parse(row.cast_json || '[]');
      const mains = parsed.filter(c => c.role === 'MAIN');
      return (mains.length > 0 ? mains : parsed).slice(0, 4).map(c => ({
        name: c.character,
        image: c.characterImage || c.actorImage || null,
        role: c.role || 'MAIN',
        actor: c.actor || null
      }));
    })(),
    relatedMedia,
    sources,
    totalSeasons: Math.max(row.total_seasons || 1, seasonsRows.length),
    totalEpisodes: Math.max(row.total_episodes || 0, seasons.reduce((sum, s) => sum + (s.episodes?.length || s.episodeCount || 0), 0)) || null,
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
  if (isNeon()) return neonDB.addMediaSource(canonicalId, newSource);
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
  if (isNeon()) return neonDB.deleteMediaSource(canonicalId, sourceId);
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

export function isSubsequentSeasonTitle(item) {
  if (!item || !item.title) return false;
  if (item.isMovie || item.format === 'Movie' || item.mediaType === 'Movie') return false;
  const pattern = /\b(?:Season\s+([2-9]|\d{2,})|[2-9]\d*(?:nd|rd|th)\s+Season|Final\s+Season|Season\s+Final|Cour\s+([2-9]|\d{2,}))\b/i;
  return pattern.test(item.title);
}

export function searchCachedMedia(query, opts = {}) {
  if (isNeon()) return neonDB.searchCachedMedia(query, opts.type || opts.mediaType);
  const { type = 'All', genre = 'All', sort = 'popularity_desc', limit = 24, page = 1, animeFormat = 'All', format = 'All', character = null, searchMode = 'all', mainCharOnly = false } = opts;
  const db = getDB();
  let sql = 'SELECT * FROM cached_media WHERE 1=1';
  const params = [];

  const targetChar = (character || (searchMode === 'character' ? query : '') || '').trim().toLowerCase();

  if (targetChar) {
    sql += ' AND LOWER(cast_json) LIKE ?';
    params.push(`%${targetChar}%`);
  } else if (query && query.trim()) {
    const rawQ = query.trim().toLowerCase();
    const cleanQ = rawQ.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const tokens = cleanQ.split(/\s+/).filter(t => t.length > 0);
    const qLike = `%${rawQ}%`;

    if (tokens.length > 1) {
      // Allow exact substring match OR all words matching across title and cast fields
      const tokenClause = tokens
        .map(() => '(LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ? OR LOWER(cast_json) LIKE ?)')
        .join(' AND ');
      sql += ` AND ((LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ? OR LOWER(cast_json) LIKE ?) OR (${tokenClause}))`;
      params.push(qLike, qLike, qLike, `%${rawQ.replace(/[^a-z0-9]+/g, '-')}%`, qLike);
      for (const t of tokens) {
        const tLike = `%${t}%`;
        params.push(tLike, tLike, tLike, tLike, tLike);
      }
    } else {
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(romaji_title) LIKE ? OR slug LIKE ? OR LOWER(cast_json) LIKE ?)';
      params.push(qLike, qLike, qLike, `%${rawQ.replace(/[^a-z0-9]+/g, '-')}%`, qLike);
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

  const excludeList = (typeof opts.excludeIds === 'string' ? opts.excludeIds.split(',') : Array.from(opts.excludeIds || [])).map(s => String(s).trim()).filter(Boolean);
  if (excludeList.length > 0) {
    const placeholders = excludeList.map(() => '?').join(',');
    sql += ` AND id NOT IN (${placeholders})`;
    params.push(...excludeList);
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
  const offset = excludeList.length > 0 ? 0 : (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const rows = db.prepare(sql).all(...params);
  let results = rows.map(r => hydrateCanonicalMedia(db, r));

  if (targetChar) {
    if (mainCharOnly) {
      results = results.filter(item => {
        return (item.cast || []).some(c => 
          ((c.character || '').toLowerCase().includes(targetChar) || (c.actor || '').toLowerCase().includes(targetChar)) && 
          (c.role === 'MAIN' || !c.role)
        );
      });
    }

    for (const item of results) {
      const match = (item.cast || []).find(c => 
        (c.character || '').toLowerCase().includes(targetChar) ||
        (c.actor || '').toLowerCase().includes(targetChar)
      );
      if (match) {
        item.matchedCharacter = {
          name: match.character || match.actor,
          actor: match.actor || null,
          image: match.characterImage || match.actorImage || null,
          role: match.role || 'MAIN'
        };
        item.matchedPerson = {
          name: match.actor || match.character,
          character: match.character,
          image: match.actorImage || match.characterImage || null,
          role: match.role || 'MAIN'
        };
      }
    }
  }

  return results.filter(item => !isSubsequentSeasonTitle(item));
}

export function remapDuplicateCanonicalMedia(primaryId, duplicateId) {
  if (isNeon()) return neonDB.remapDuplicateCanonicalMedia(primaryId, duplicateId);
  if (!primaryId || !duplicateId || primaryId === duplicateId) return;
  const db = getDB();
  try {
    // If catalog items referenced duplicateId, re-link them to primaryId
    db.prepare('UPDATE catalog_items SET canonical_id = ? WHERE canonical_id = ?').run(primaryId, duplicateId);
    // Delete duplicate from cached_media
    db.prepare('DELETE FROM cached_media WHERE id = ?').run(duplicateId);
  } catch (e) {}
}

export function getCachedTrending(type = 'All', limit = 24, opts = {}) {
  if (isNeon()) return neonDB.getCachedTrending({ type, limit, ...opts });
  const { animeFormat = 'All', format = 'All', page = 1, genre = 'All', sort = 'popularity_desc' } = opts;
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

  const excludeList = (typeof opts.excludeIds === 'string' ? opts.excludeIds.split(',') : Array.from(opts.excludeIds || [])).map(s => String(s).trim()).filter(Boolean);
  if (excludeList.length > 0) {
    const placeholders = excludeList.map(() => '?').join(',');
    sql += ` AND id NOT IN (${placeholders})`;
    params.push(...excludeList);
  }

  switch (sort) {
    case 'rating_desc':
      sql += ' ORDER BY rating DESC NULLS LAST, popularity_score DESC, id ASC';
      break;
    case 'release_desc':
    case 'year_desc':
      sql += ' ORDER BY release_year DESC NULLS LAST, release_date DESC NULLS LAST, id ASC';
      break;
    case 'title_asc':
      sql += ' ORDER BY title ASC, id ASC';
      break;
    case 'popularity_desc':
    default:
      sql += ' ORDER BY popularity_score DESC, rating DESC, id ASC';
      break;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 24);
  const offset = excludeList.length > 0 ? 0 : (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => hydrateCanonicalMedia(db, r)).filter(item => !isSubsequentSeasonTitle(item));
}

/**
 * =========================================================================
 * PERSONAL CATALOG REPOSITORY METHODS
 * =========================================================================
 */

export function getCatalogItems(opts = {}) {
  if (isNeon()) return neonDB.getCatalogItems(opts);
  const { status = 'All', type = 'All', sort = 'updated_desc', favoriteOnly = false, genre = 'All', search = '', animeFormat = 'All', format = 'All', character = '', mainCharOnly = false, page, limit, userId } = opts;
  const db = getDB();
  let sql = 'SELECT * FROM catalog_items WHERE 1=1';
  const params = [];

  const targetUserId = userId || DEFAULT_USER_ID;
  if (targetUserId !== 'all') {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(targetUserId);
  }

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
    const sTerm = `%${search.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(title) LIKE ? OR canonical_id IN (SELECT id FROM cached_media WHERE LOWER(cast_json) LIKE ?) OR id IN (SELECT id FROM cached_media WHERE LOWER(cast_json) LIKE ?))';
    params.push(sTerm, sTerm, sTerm);
  }

  if (character && character.trim()) {
    const cTerm = `%${character.trim().toLowerCase()}%`;
    sql += ' AND (canonical_id IN (SELECT id FROM cached_media WHERE LOWER(cast_json) LIKE ?) OR id IN (SELECT id FROM cached_media WHERE LOWER(cast_json) LIKE ?))';
    params.push(cTerm, cTerm);
  }

  if (genre && genre !== 'All') {
    sql += ' AND (canonical_id IN (SELECT id FROM cached_media WHERE LOWER(genres_json) LIKE ?) OR id IN (SELECT id FROM cached_media WHERE LOWER(genres_json) LIKE ?) OR LOWER(tags_json) LIKE ?)';
    const gPattern = `%"${genre.toLowerCase()}"%`;
    params.push(gPattern, gPattern, gPattern);
  }

  const excludeList = (typeof opts.excludeIds === 'string' ? opts.excludeIds.split(',') : Array.from(opts.excludeIds || [])).map(s => String(s).trim()).filter(Boolean);
  if (excludeList.length > 0) {
    const placeholders = excludeList.map(() => '?').join(',');
    sql += ` AND id NOT IN (${placeholders}) AND (canonical_id IS NULL OR canonical_id NOT IN (${placeholders}))`;
    params.push(...excludeList, ...excludeList);
  }

  switch (sort) {
    case 'rating_desc':
      sql += ' ORDER BY user_rating DESC NULLS LAST, updated_at DESC, id ASC';
      break;
    case 'title_asc':
      sql += ' ORDER BY title ASC, id ASC';
      break;
    case 'year_desc':
    case 'release_desc':
      sql += ' ORDER BY release_year DESC NULLS LAST, id ASC';
      break;
    case 'progress_desc':
      sql += ' ORDER BY current_episode DESC, updated_at DESC, id ASC';
      break;
    case 'popularity_desc':
      sql += ' ORDER BY user_rating DESC NULLS LAST, updated_at DESC, id ASC';
      break;
    case 'updated_desc':
    default:
      sql += ' ORDER BY updated_at DESC, id ASC';
      break;
  }

  if (page !== undefined && limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 24);
    const offset = excludeList.length > 0 ? 0 : (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => hydrateCatalogItem(db, r));
}

export function getCatalogItem(id, userId) {
  if (isNeon()) return neonDB.getCatalogItem(id, userId);
  const db = getDB();
  const targetUserId = userId || DEFAULT_USER_ID;
  const row = db.prepare('SELECT * FROM catalog_items WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(id, targetUserId);
  if (!row) return null;
  return hydrateCatalogItem(db, row, targetUserId);
}

export function getCatalogItemByCanonicalId(canonicalId, userId) {
  if (isNeon()) return neonDB.getCatalogItemByCanonicalId(canonicalId, userId);
  const db = getDB();
  const targetUserId = userId || DEFAULT_USER_ID;
  const row = db.prepare('SELECT * FROM catalog_items WHERE canonical_id = ? AND (user_id = ? OR user_id IS NULL)').get(canonicalId, targetUserId);
  if (!row) return null;
  return hydrateCatalogItem(db, row, targetUserId);
}

function hydrateCatalogItem(db, row, userId) {
  const targetUserId = userId || row.user_id || DEFAULT_USER_ID;
  const progressRows = db.prepare(`
    SELECT season_number, episode_number, is_watched, watched_at 
    FROM catalog_episode_progress 
    WHERE catalog_item_id = ? AND (user_id = ? OR user_id IS NULL) AND is_watched = 1
    ORDER BY season_number ASC, episode_number ASC
  `).all(row.id, targetUserId);

  const isMovie = row.format === 'Movie' || row.media_type === 'Movie';
  const format = row.format || (isMovie ? 'Movie' : 'Series');

  const cached = row.canonical_id ? db.prepare('SELECT genres_json, cast_json, total_seasons FROM cached_media WHERE id = ?').get(row.canonical_id) : null;
  let genres = [];
  let cast = [];
  try {
    if (cached && cached.genres_json) {
      genres = JSON.parse(cached.genres_json);
    }
  } catch (e) {}
  try {
    if (cached && cached.cast_json) {
      cast = JSON.parse(cached.cast_json);
    }
  } catch (e) {}
  if (!genres || genres.length === 0) {
    try {
      genres = JSON.parse(row.tags_json || '[]');
    } catch (e) {}
  }

  const mainCharacters = (() => {
    const mains = cast.filter(c => c.role === 'MAIN');
    return (mains.length > 0 ? mains : cast).slice(0, 3).map(c => ({
      name: c.character,
      image: c.characterImage || c.actorImage || null,
      role: c.role || 'MAIN',
      actor: c.actor || null
    }));
  })();

  const totalSeasons = Math.max(
    row.total_seasons || 1,
    cached?.totalSeasons || 1,
    cached?.total_seasons || 1,
    cached?.seasons?.length || 1
  );
  const seasonsCompleted = (row.seasons_completed !== null && row.seasons_completed !== undefined)
    ? row.seasons_completed
    : (row.user_status === 'Completed' ? totalSeasons : Math.max(0, (row.current_season || 1) - 1));

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
    currentSeason: row.current_season || 1,
    seasonsCompleted,
    totalSeasons,
    currentEpisode: row.current_episode,
    totalEpisodes: row.total_episodes,
    notes: row.notes,
    genres: genres || [],
    tags: JSON.parse(row.tags_json || '[]'),
    cast,
    mainCharacters,
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

export function upsertCatalogItem(item, userId) {
  if (isNeon()) return neonDB.upsertCatalogItem(item, userId);
  const db = getDB();
  const now = new Date().toISOString();
  const targetUserId = userId || item.userId || DEFAULT_USER_ID;

  let existing = null;
  if (item.id) {
    existing = db.prepare('SELECT * FROM catalog_items WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(item.id, targetUserId);
  } else if (item.canonicalId) {
    existing = db.prepare('SELECT * FROM catalog_items WHERE canonical_id = ? AND (user_id = ? OR user_id IS NULL)').get(item.canonicalId, targetUserId);
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
      id, canonical_id, user_id, media_type, format, title, poster_url, backdrop_url, release_year,
      user_status, is_favorite, is_rewatching, user_rating, current_season, seasons_completed,
      total_seasons, current_episode, total_episodes, notes, tags_json, started_at, completed_at,
      last_watched_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, catalog_items.user_id),
      media_type = excluded.media_type,
      format = excluded.format,
      user_status = excluded.user_status,
      is_favorite = excluded.is_favorite,
      is_rewatching = excluded.is_rewatching,
      user_rating = excluded.user_rating,
      current_season = excluded.current_season,
      seasons_completed = excluded.seasons_completed,
      total_seasons = COALESCE(excluded.total_seasons, catalog_items.total_seasons),
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

  const cachedForAdd = item.canonicalId ? getCanonicalMedia(item.canonicalId) : null;
  const totalSeasonsVal = Math.max(
    item.totalSeasons || 1,
    cachedForAdd?.totalSeasons || 1,
    cachedForAdd?.seasons?.length || 1,
    existing?.total_seasons || 1
  );
  const seasonsCompletedVal = item.seasonsCompleted !== undefined ? item.seasonsCompleted : (existing?.seasons_completed ?? 0);
  const currentSeasonVal = item.currentSeason || (existing?.current_season || (seasonsCompletedVal > 0 ? seasonsCompletedVal + 1 : 1));

  stmt.run(
    id,
    item.canonicalId,
    targetUserId,
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
    currentSeasonVal,
    seasonsCompletedVal,
    totalSeasonsVal,
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

  return getCatalogItem(id, targetUserId);
}

export function deleteCatalogItem(id, userId) {
  if (isNeon()) return neonDB.deleteCatalogItem(id, userId);
  const db = getDB();
  const targetUserId = userId || DEFAULT_USER_ID;
  db.prepare('DELETE FROM catalog_episode_progress WHERE catalog_item_id = ? AND (user_id = ? OR user_id IS NULL)').run(id, targetUserId);
  const res = db.prepare('DELETE FROM catalog_items WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(id, targetUserId);
  return res.changes > 0;
}

export function toggleEpisodeProgress(catalogItemId, seasonNumber, episodeNumber, isWatched = true, userId) {
  if (isNeon()) return neonDB.toggleEpisodeProgress(catalogItemId, seasonNumber, episodeNumber, isWatched, userId);
  const db = getDB();
  const now = new Date().toISOString();
  const targetUserId = userId || DEFAULT_USER_ID;

  if (isWatched) {
    db.prepare(`
      INSERT OR REPLACE INTO catalog_episode_progress (
        user_id, catalog_item_id, season_number, episode_number, is_watched, watched_at
      ) VALUES (?, ?, ?, ?, 1, ?)
    `).run(targetUserId, catalogItemId, seasonNumber, episodeNumber, now);

    db.prepare(`
      UPDATE catalog_items
      SET current_season = MAX(current_season, ?),
          current_episode = MAX(current_episode, ?),
          last_watched_at = ?,
          updated_at = ?
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).run(seasonNumber, episodeNumber, now, now, catalogItemId, targetUserId);
  } else {
    db.prepare(`
      DELETE FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND season_number = ? AND episode_number = ? AND (user_id = ? OR user_id IS NULL)
    `).run(catalogItemId, seasonNumber, episodeNumber, targetUserId);

    // Recalculate remaining highest episode
    const maxProg = db.prepare(`
      SELECT MAX(episode_number) as max_ep, MAX(season_number) as max_season 
      FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND (user_id = ? OR user_id IS NULL) AND is_watched = 1
    `).get(catalogItemId, targetUserId);

    const remainingEp = maxProg?.max_ep || 0;
    const remainingSeason = maxProg?.max_season || 1;

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          current_episode = ?,
          updated_at = ?
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).run(remainingSeason, remainingEp, now, catalogItemId, targetUserId);
  }

  return getCatalogItem(catalogItemId, targetUserId);
}

export function batchSetSeasonProgress(catalogItemId, seasonNumber, episodeCount, isWatched = true, userId) {
  if (isNeon()) return neonDB.batchSetSeasonProgress(catalogItemId, seasonNumber, Array.from({ length: episodeCount }, (_, i) => i + 1), isWatched, userId);

  const db = getDB();
  const now = new Date().toISOString();
  const targetUserId = userId || DEFAULT_USER_ID;

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO catalog_episode_progress (
      user_id, catalog_item_id, season_number, episode_number, is_watched, watched_at
    ) VALUES (?, ?, ?, ?, 1, ?)
  `);

  const deleteStmt = db.prepare(`
    DELETE FROM catalog_episode_progress 
    WHERE catalog_item_id = ? AND season_number = ? AND (user_id = ? OR user_id IS NULL)
  `);

  const existing = db.prepare('SELECT seasons_completed FROM catalog_items WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(catalogItemId, targetUserId);

  if (isWatched) {
    for (let ep = 1; ep <= episodeCount; ep++) {
      insertStmt.run(targetUserId, catalogItemId, seasonNumber, ep, now);
    }
    db.prepare(`
      DELETE FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND season_number = ? AND episode_number > ? AND (user_id = ? OR user_id IS NULL)
    `).run(catalogItemId, seasonNumber, episodeCount, targetUserId);

    const newSeasonsCompleted = Math.max(existing?.seasons_completed || 0, seasonNumber);

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          seasons_completed = ?,
          current_episode = MAX(current_episode, ?),
          last_watched_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(seasonNumber, newSeasonsCompleted, episodeCount, now, now, catalogItemId);
  } else {
    deleteStmt.run(catalogItemId, seasonNumber);

    const maxProg = db.prepare(`
      SELECT MAX(episode_number) as max_ep, MAX(season_number) as max_season 
      FROM catalog_episode_progress 
      WHERE catalog_item_id = ? AND is_watched = 1
    `).get(catalogItemId);

    let newSeasonsCompleted = existing?.seasons_completed || 0;
    if (newSeasonsCompleted >= seasonNumber) {
      newSeasonsCompleted = Math.max(0, seasonNumber - 1);
    }

    db.prepare(`
      UPDATE catalog_items
      SET current_season = ?,
          seasons_completed = ?,
          current_episode = ?,
          updated_at = ?
      WHERE id = ?
    `).run(maxProg?.max_season || 1, newSeasonsCompleted, maxProg?.max_ep || 0, now, catalogItemId);
  }

  return getCatalogItem(catalogItemId);
}

export function setSeasonsCompleted(catalogItemId, seasonsCompleted, opts = {}) {
  if (isNeon()) return neonDB.setSeasonsCompleted(catalogItemId, seasonsCompleted, opts);

  const db = getDB();
  const now = new Date().toISOString();
  const targetUserId = opts.userId || DEFAULT_USER_ID;
  const existing = db.prepare('SELECT * FROM catalog_items WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(catalogItemId, targetUserId);
  if (!existing) return null;

  const count = Math.max(0, parseInt(seasonsCompleted, 10) || 0);
  const cached = existing.canonical_id ? db.prepare('SELECT total_seasons FROM cached_media WHERE id = ?').get(existing.canonical_id) : null;
  const seasonsRows = existing.canonical_id ? db.prepare('SELECT COUNT(*) as cnt FROM media_seasons WHERE canonical_id = ?').get(existing.canonical_id) : null;
  const totalSeasons = Math.max(opts.totalSeasons || 0, existing.total_seasons || 0, cached?.total_seasons || 0, seasonsRows?.cnt || 0, 1);
  const userStatus = opts.userStatus || existing.user_status;
  const currentSeason = opts.currentSeason || (count < totalSeasons ? count + 1 : totalSeasons);

  // Sync episodes if requested (defaults to true)
  if (opts.syncEpisodes !== false) {
    const canonicalId = existing.canonical_id;
    const mediaSeasons = db.prepare('SELECT season_number, episode_count FROM media_seasons WHERE canonical_id = ? ORDER BY season_number ASC').all(canonicalId);

    const insertProg = db.prepare(`
      INSERT OR REPLACE INTO catalog_episode_progress (
        user_id, catalog_item_id, season_number, episode_number, is_watched, watched_at
      ) VALUES (?, ?, ?, ?, 1, ?)
    `);

    if (mediaSeasons && mediaSeasons.length > 0) {
      for (const s of mediaSeasons) {
        if (s.season_number <= count) {
          const epCount = s.episode_count || 1;
          for (let ep = 1; ep <= epCount; ep++) {
            insertProg.run(targetUserId, catalogItemId, s.season_number, ep, now);
          }
        } else {
          db.prepare('DELETE FROM catalog_episode_progress WHERE catalog_item_id = ? AND season_number = ? AND (user_id = ? OR user_id IS NULL)').run(catalogItemId, s.season_number, targetUserId);
        }
      }
    } else {
      for (let s = 1; s <= count; s++) {
        insertProg.run(targetUserId, catalogItemId, s, 1, now);
      }
      db.prepare('DELETE FROM catalog_episode_progress WHERE catalog_item_id = ? AND season_number > ? AND (user_id = ? OR user_id IS NULL)').run(catalogItemId, count, targetUserId);
    }
  }

  const completedAt = (userStatus === 'Completed' && !existing.completed_at) ? now : (userStatus !== 'Completed' ? null : existing.completed_at);

  db.prepare(`
    UPDATE catalog_items
    SET seasons_completed = ?,
        current_season = ?,
        total_seasons = MAX(total_seasons, ?),
        user_status = ?,
        completed_at = ?,
        last_watched_at = ?,
        updated_at = ?
    WHERE id = ? AND (user_id = ? OR user_id IS NULL)
  `).run(count, currentSeason, totalSeasons, userStatus, completedAt, now, now, catalogItemId, targetUserId);

  return getCatalogItem(catalogItemId, targetUserId);
}

export function getCatalogStats(userId) {
  if (isNeon()) return neonDB.getCatalogStats(userId);
  const db = getDB();
  const targetUserId = userId || DEFAULT_USER_ID;

  const totalTitles = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE (user_id = ? OR user_id IS NULL)').get(targetUserId).count;
  const statusCounts = db.prepare('SELECT user_status, COUNT(*) as count FROM catalog_items WHERE (user_id = ? OR user_id IS NULL) GROUP BY user_status').all(targetUserId);
  const typeCounts = db.prepare('SELECT media_type, COUNT(*) as count FROM catalog_items WHERE (user_id = ? OR user_id IS NULL) GROUP BY media_type').all(targetUserId);
  const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE is_favorite = 1 AND (user_id = ? OR user_id IS NULL)').get(targetUserId).count;
  const watchedEpsCount = db.prepare('SELECT COUNT(*) as count FROM catalog_episode_progress WHERE is_watched = 1 AND (user_id = ? OR user_id IS NULL)').get(targetUserId).count;

  const completedMoviesCount = db.prepare("SELECT COUNT(*) as count FROM catalog_items WHERE media_type = 'Movie' AND user_status = 'Completed' AND (user_id = ? OR user_id IS NULL)").get(targetUserId).count;
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
  if (isNeon()) return neonDB.exportCatalogData();
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
  if (isNeon()) return neonDB.importCatalogData(data);
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
  if (isNeon()) return neonDB.getAllMirrorSources();
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
  if (isNeon()) return neonDB.updateMirrorSourceDomain(id, newDomain, status, latencyMs, statusNote);
  const db = getDB();
  db.prepare(`
    UPDATE mirror_sources 
    SET current_domain = ?, status = ?, latency_ms = ?, status_note = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(newDomain, status, latencyMs, statusNote, id);
}

export function updateMirrorStatus(id, status, latencyMs, statusNote) {
  if (isNeon()) return neonDB.updateMirrorStatus(id, status, latencyMs, statusNote);
  const db = getDB();
  db.prepare(`
    UPDATE mirror_sources 
    SET status = ?, latency_ms = ?, status_note = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, latencyMs, statusNote, id);
}

export function upsertMirrorSource(item) {
  if (isNeon()) return neonDB.upsertMirrorSource(item);
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
  if (isNeon()) return neonDB.deleteMirrorSourceItem(id);
  const db = getDB();
  db.prepare('DELETE FROM mirror_sources WHERE id = ?').run(id);
}

/**
 * Returns distinct characters (especially Main Characters) from cached media
 * for autocomplete, quick filter badges, and character exploration.
 */
export function getDistinctCharacters(options = {}) {
  if (isNeon()) return neonDB.getDistinctCharacters(options);
  const { type = 'All', role = 'MAIN', search = '', limit = 30 } = options;
  const db = getDB();
  let sql = "SELECT cast_json, popularity_score, title, poster_url FROM cached_media WHERE cast_json IS NOT NULL AND cast_json != '[]'";
  const params = [];
  if (type && type !== 'All') {
    sql += ' AND media_type = ?';
    params.push(type);
  }
  sql += ' ORDER BY popularity_score DESC LIMIT 250';
  const rows = db.prepare(sql).all(...params);

  const charMap = new Map();
  const searchLower = (search || '').toLowerCase().trim();

  for (const row of rows) {
    try {
      const cast = JSON.parse(row.cast_json || '[]');
      for (const c of cast) {
        if (!c.character) continue;
        const charName = c.character.trim();
        const isMain = c.role === 'MAIN' || !c.role;
        if (role === 'MAIN' && !isMain) continue;
        if (searchLower && !charName.toLowerCase().includes(searchLower)) continue;

        const key = charName.toLowerCase();
        if (!charMap.has(key)) {
          charMap.set(key, {
            name: charName,
            image: c.characterImage || c.actorImage || row.poster_url || null,
            role: c.role || 'MAIN',
            appearances: 1,
            mediaTitles: [row.title],
            actor: c.actor || null
          });
        } else {
          const entry = charMap.get(key);
          entry.appearances += 1;
          if (!entry.image && (c.characterImage || c.actorImage)) {
            entry.image = c.characterImage || c.actorImage;
          }
          if (!entry.mediaTitles.includes(row.title) && entry.mediaTitles.length < 3) {
            entry.mediaTitles.push(row.title);
          }
        }
      }
    } catch (e) {}
  }

  return Array.from(charMap.values())
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, limit);
}

/**
 * Returns distinct characters from items in the user's personal watchlist.
 */
export function getCatalogCharacters(options = {}) {
  if (isNeon()) return neonDB.getCatalogCharacters(options);
  const { limit = 25 } = options;
  const db = getDB();
  const rows = db.prepare(`
    SELECT cm.cast_json, ci.title, ci.user_status, ci.media_type, ci.poster_url
    FROM catalog_items ci
    JOIN cached_media cm ON ci.canonical_id = cm.id OR ci.id = cm.id
    WHERE cm.cast_json IS NOT NULL AND cm.cast_json != '[]'
  `).all();

  const charMap = new Map();
  for (const row of rows) {
    try {
      const cast = JSON.parse(row.cast_json || '[]');
      for (const c of cast) {
        if (!c.character) continue;
        const charName = c.character.trim();
        const isMain = c.role === 'MAIN' || !c.role;
        const key = charName.toLowerCase();
        if (!charMap.has(key)) {
          charMap.set(key, {
            name: charName,
            image: c.characterImage || c.actorImage || row.poster_url || null,
            role: c.role || 'MAIN',
            count: 1,
            titles: [row.title]
          });
        } else {
          const entry = charMap.get(key);
          entry.count += 1;
          if (!entry.image && (c.characterImage || c.actorImage)) {
            entry.image = c.characterImage || c.actorImage;
          }
          if (!entry.titles.includes(row.title)) {
            entry.titles.push(row.title);
          }
        }
      }
    } catch (e) {}
  }

  return Array.from(charMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function createUser({ id, email, password, displayName }) {
  if (isNeon()) return neonDB.createUser({ id, email, password, displayName });
  const db = getDB();
  const userId = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const hash = hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email.toLowerCase().trim(), hash, displayName || null, now, now);
  return { id: userId, email: email.toLowerCase().trim(), displayName: displayName || null };
}

export function findUserByEmail(email) {
  if (isNeon()) return neonDB.findUserByEmail(email);
  const db = getDB();
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email.toLowerCase().trim()) || null;
}

export function findUserById(id) {
  if (isNeon()) return neonDB.findUserById(id);
  const db = getDB();
  return db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(id) || null;
}

