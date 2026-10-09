import { neon } from '@neondatabase/serverless';
import { generateDefaultMirrors, DEFAULT_MIRROR_REGISTRY, normalizeTitle } from '@omniwatch/shared';
import { hashPassword, DEFAULT_USER_ID, DEFAULT_USER_EMAIL } from './auth.js';

let sqlClient = null;

function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is not defined for Neon PostgreSQL.');
  }
  if (!sqlClient) {
    sqlClient = neon(dbUrl);
  }
  return sqlClient;
}

export async function initDB() {
  const sql = getSql();

  // Create tables in PostgreSQL
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`;

  await sql`
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
      rating DOUBLE PRECISION,
      vote_count INTEGER,
      popularity_score DOUBLE PRECISION,
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
      sources_json TEXT,
      format TEXT DEFAULT 'Series',
      total_seasons INTEGER DEFAULT 1,
      total_episodes INTEGER,
      next_airing_episode INTEGER,
      next_airing_at TEXT,
      last_synced_at TEXT NOT NULL,
      cache_ttl_hours INTEGER DEFAULT 48,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_cached_media_type ON cached_media(media_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cached_media_title ON cached_media(title);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cached_media_popularity ON cached_media(popularity_score);`;

  await sql`
    CREATE TABLE IF NOT EXISTS media_provider_mappings (
      canonical_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      external_id TEXT NOT NULL,
      external_url TEXT,
      matched_confidence DOUBLE PRECISION DEFAULT 1.0,
      PRIMARY KEY (provider_name, external_id),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );
  `;

  await sql`
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
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS media_episodes (
      canonical_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      air_date TEXT,
      runtime_minutes INTEGER,
      still_url TEXT,
      vote_average DOUBLE PRECISION,
      PRIMARY KEY (canonical_id, season_number, episode_number),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );
  `;

  await sql`
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
  `;

  await sql`
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
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      canonical_id TEXT NOT NULL,
      user_id TEXT DEFAULT 'user_makisanis106',
      media_type TEXT NOT NULL,
      format TEXT DEFAULT 'Series',
      title TEXT NOT NULL,
      poster_url TEXT,
      backdrop_url TEXT,
      release_year INTEGER,
      user_status TEXT NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      is_rewatching INTEGER DEFAULT 0,
      user_rating DOUBLE PRECISION,
      current_season INTEGER DEFAULT 1,
      seasons_completed INTEGER DEFAULT 0,
      total_seasons INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 0,
      total_episodes INTEGER,
      notes TEXT,
      tags_json TEXT,
      started_at TEXT,
      completed_at TEXT,
      last_watched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_catalog_status ON catalog_items(user_status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog_items(media_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_catalog_canonical ON catalog_items(canonical_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_episode_progress (
      catalog_item_id TEXT NOT NULL,
      user_id TEXT DEFAULT 'user_makisanis106',
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      is_watched INTEGER NOT NULL DEFAULT 1,
      watched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      PRIMARY KEY (catalog_item_id, season_number, episode_number),
      FOREIGN KEY(catalog_item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
    );
  `;

  try {
    await sql`ALTER TABLE cached_media ADD COLUMN IF NOT EXISTS related_json TEXT;`;
    await sql`ALTER TABLE cached_media ADD COLUMN IF NOT EXISTS sources_json TEXT;`;
    await sql`ALTER TABLE cached_media ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'Series';`;

    await sql`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'Series';`;
    await sql`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_rewatching INTEGER DEFAULT 0;`;
    await sql`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS seasons_completed INTEGER DEFAULT 0;`;
    await sql`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS total_seasons INTEGER DEFAULT 1;`;
    await sql`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'user_makisanis106';`;
    await sql`ALTER TABLE catalog_episode_progress ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'user_makisanis106';`;

    // Seed default user if not exists
    const existingUser = await sql`SELECT id FROM users WHERE email = ${DEFAULT_USER_EMAIL} LIMIT 1`;
    if (!existingUser || existingUser.length === 0) {
      const seedHash = hashPassword('OutCast106');
      await sql`
        INSERT INTO users (id, email, password_hash, display_name)
        VALUES (${DEFAULT_USER_ID}, ${DEFAULT_USER_EMAIL}, ${seedHash}, 'Maki Sanis')
        ON CONFLICT (email) DO NOTHING;
      `;
    }

    // Migrate any unassigned legacy catalog records
    await sql`UPDATE catalog_items SET user_id = 'user_makisanis106' WHERE user_id IS NULL OR user_id = '';`;
    await sql`UPDATE catalog_episode_progress SET user_id = 'user_makisanis106' WHERE user_id IS NULL OR user_id = '';`;

    // Clean up movie seasons so Movie records don't have total_seasons
    await sql`UPDATE cached_media SET total_seasons = NULL WHERE media_type = 'Movie' OR format = 'Movie';`;
    await sql`UPDATE catalog_items SET total_seasons = NULL, seasons_completed = 0 WHERE media_type = 'Movie';`;

    await sql`CREATE INDEX IF NOT EXISTS idx_catalog_user ON catalog_items(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_catalog_user_status ON catalog_items(user_id, user_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_catalog_user_canonical ON catalog_items(user_id, canonical_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_progress_user ON catalog_episode_progress(user_id);`;
  } catch (err) {
    console.error('Migration warning in Neon:', err.message);
  }

  await sql`
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
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP::text),
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP::text)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_sources (
      id TEXT PRIMARY KEY,
      canonical_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      quality TEXT,
      language TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      FOREIGN KEY(canonical_id) REFERENCES cached_media(id) ON DELETE CASCADE
    );
  `;

  // Seed default mirror sources
  for (const m of DEFAULT_MIRROR_REGISTRY) {
    await sql`
      INSERT INTO mirror_sources (
        id, name, category, type, quality, audio, current_domain, candidate_domains,
        search_template, direct_url_template, status_note, sort_order
      ) VALUES (
        ${m.id}, ${m.name}, ${m.category}, ${m.type}, ${m.quality || '1080p HD'},
        ${m.audio || 'Multi-Audio'}, ${m.currentDomain}, ${JSON.stringify(m.candidateDomains || [m.currentDomain])},
        ${m.searchTemplate}, ${m.directUrlTemplate || null}, ${m.statusNote || null}, ${m.sortOrder || 0}
      ) ON CONFLICT (id) DO NOTHING;
    `;
  }

  console.log('✅ [Neon PostgreSQL] Database schema initialized successfully');
}

export async function saveCanonicalMedia(media) {
  if (!media || !media.id) return null;
  const sql = getSql();

  const now = new Date().toISOString();
  await sql`
    INSERT INTO cached_media (
      id, media_type, title, original_title, romaji_title, slug,
      synopsis, tagline, release_date, release_year, runtime_minutes,
      status, rating, vote_count, popularity_score, poster_url,
      backdrop_url, banner_url, genres_json, country_of_origin,
      studios_json, networks_json, creators_json, cast_json, related_json, sources_json,
      format, total_seasons, total_episodes, next_airing_episode,
      next_airing_at, last_synced_at, cache_ttl_hours
    ) VALUES (
      ${media.id}, ${media.mediaType}, ${media.title}, ${media.originalTitle || null},
      ${media.romajiTitle || null}, ${media.slug || null}, ${media.synopsis || null},
      ${media.tagline || null}, ${media.releaseDate || null}, ${media.releaseYear || null},
      ${media.runtimeMinutes || null}, ${media.status || 'Ended'}, ${media.rating || null},
      ${media.voteCount || 0}, ${media.popularityScore || 0}, ${media.posterUrl || null},
      ${media.backdropUrl || null}, ${media.bannerUrl || null}, ${JSON.stringify(media.genres || [])},
      ${media.countryOfOrigin || null}, ${JSON.stringify(media.studios || [])},
      ${JSON.stringify(media.networks || [])}, ${JSON.stringify(media.creators || [])},
      ${JSON.stringify(media.cast || [])}, ${JSON.stringify(media.related || [])},
      ${JSON.stringify(media.sources || [])}, ${media.format || (media.mediaType === 'Movie' ? 'Movie' : 'Series')},
      ${Math.max(media.totalSeasons || 1, Array.isArray(media.seasons) ? media.seasons.length : 1)}, ${media.totalEpisodes || null}, ${media.nextAiringEpisode || null},
      ${media.nextAiringAt || null}, ${now}, ${media.cacheTtlHours || 48}
    )
    ON CONFLICT (id) DO UPDATE SET
      media_type = EXCLUDED.media_type,
      title = EXCLUDED.title,
      original_title = EXCLUDED.original_title,
      romaji_title = EXCLUDED.romaji_title,
      slug = EXCLUDED.slug,
      synopsis = EXCLUDED.synopsis,
      tagline = EXCLUDED.tagline,
      release_date = EXCLUDED.release_date,
      release_year = EXCLUDED.release_year,
      runtime_minutes = EXCLUDED.runtime_minutes,
      status = EXCLUDED.status,
      rating = EXCLUDED.rating,
      vote_count = EXCLUDED.vote_count,
      popularity_score = EXCLUDED.popularity_score,
      poster_url = EXCLUDED.poster_url,
      backdrop_url = EXCLUDED.backdrop_url,
      banner_url = EXCLUDED.banner_url,
      genres_json = EXCLUDED.genres_json,
      country_of_origin = EXCLUDED.country_of_origin,
      studios_json = EXCLUDED.studios_json,
      networks_json = EXCLUDED.networks_json,
      creators_json = EXCLUDED.creators_json,
      cast_json = EXCLUDED.cast_json,
      related_json = EXCLUDED.related_json,
      sources_json = EXCLUDED.sources_json,
      format = EXCLUDED.format,
      total_seasons = GREATEST(COALESCE(EXCLUDED.total_seasons, 1), COALESCE(cached_media.total_seasons, 1), (SELECT COUNT(*)::int FROM media_seasons WHERE canonical_id = cached_media.id)),
      total_episodes = GREATEST(COALESCE(EXCLUDED.total_episodes, 0), COALESCE(cached_media.total_episodes, 0)),
      next_airing_episode = EXCLUDED.next_airing_episode,
      next_airing_at = EXCLUDED.next_airing_at,
      last_synced_at = EXCLUDED.last_synced_at,
      cache_ttl_hours = EXCLUDED.cache_ttl_hours;
  `;

  // Save provider mappings
  if (media.providerMappings) {
    for (const [providerName, externalId] of Object.entries(media.providerMappings)) {
      if (!externalId) continue;
      await sql`
        INSERT INTO media_provider_mappings (
          canonical_id, provider_name, external_id, external_url
        ) VALUES (
          ${media.id}, ${providerName}, ${String(externalId)}, ${null}
        )
        ON CONFLICT (provider_name, external_id) DO UPDATE SET
          canonical_id = EXCLUDED.canonical_id;
      `;
    }
  }

  // Save seasons
  if (Array.isArray(media.seasons)) {
    for (const s of media.seasons) {
      await sql`
        INSERT INTO media_seasons (
          canonical_id, season_number, title, overview, episode_count, poster_url, air_date
        ) VALUES (
          ${media.id}, ${s.seasonNumber}, ${s.title || null}, ${s.overview || null},
          ${s.episodeCount || 0}, ${s.posterUrl || null}, ${s.airDate || null}
        )
        ON CONFLICT (canonical_id, season_number) DO UPDATE SET
          title = EXCLUDED.title,
          overview = EXCLUDED.overview,
          episode_count = EXCLUDED.episode_count,
          poster_url = EXCLUDED.poster_url,
          air_date = EXCLUDED.air_date;
      `;
    }
  }

  // Save episodes
  if (Array.isArray(media.episodes)) {
    for (const ep of media.episodes) {
      await sql`
        INSERT INTO media_episodes (
          canonical_id, season_number, episode_number, title, overview, air_date, runtime_minutes, still_url, vote_average
        ) VALUES (
          ${media.id}, ${ep.seasonNumber}, ${ep.episodeNumber}, ${ep.title || null},
          ${ep.overview || null}, ${ep.airDate || null}, ${ep.runtimeMinutes || null},
          ${ep.stillUrl || null}, ${ep.voteAverage || null}
        )
        ON CONFLICT (canonical_id, season_number, episode_number) DO UPDATE SET
          title = EXCLUDED.title,
          overview = EXCLUDED.overview,
          air_date = EXCLUDED.air_date,
          runtime_minutes = EXCLUDED.runtime_minutes,
          still_url = EXCLUDED.still_url,
          vote_average = EXCLUDED.vote_average;
      `;
    }
  }

  // Save trailers
  if (Array.isArray(media.trailers)) {
    for (const t of media.trailers) {
      const tid = t.id || `${media.id}_${t.videoKey}`;
      await sql`
        INSERT INTO media_trailers (
          id, canonical_id, source_site, video_key, title, thumbnail_url, is_official
        ) VALUES (
          ${tid}, ${media.id}, ${t.sourceSite || 'YouTube'}, ${t.videoKey},
          ${t.title || null}, ${t.thumbnailUrl || null}, ${t.isOfficial ? 1 : 0}
        )
        ON CONFLICT (id) DO UPDATE SET
          video_key = EXCLUDED.video_key,
          title = EXCLUDED.title,
          thumbnail_url = EXCLUDED.thumbnail_url;
      `;
    }
  }

  // Save watch providers
  if (Array.isArray(media.watchProviders)) {
    for (const wp of media.watchProviders) {
      const providerName = wp.providerName || wp.name || 'Stream Provider';
      const regionCode = wp.regionCode || wp.region || 'US';
      const availType = wp.availabilityType || wp.type || 'Subscription';
      const wpid = `${media.id}_${regionCode}_${providerName}_${availType}`;
      await sql`
        INSERT INTO media_watch_providers (
          id, canonical_id, region_code, provider_name, provider_logo_url, availability_type, web_url, display_priority, last_verified_at
        ) VALUES (
          ${wpid}, ${media.id}, ${regionCode}, ${providerName},
          ${wp.providerLogoUrl || wp.logoUrl || null}, ${availType},
          ${wp.webUrl || null}, ${wp.displayPriority || wp.priority || 10}, ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          provider_logo_url = EXCLUDED.provider_logo_url,
          web_url = EXCLUDED.web_url,
          last_verified_at = EXCLUDED.last_verified_at;
      `;
    }
  }

  return getCanonicalMedia(media.id);
}

export async function getCanonicalMedia(id) {
  if (!id) return null;
  const sql = getSql();

  const rows = await sql`SELECT * FROM cached_media WHERE id = ${id} LIMIT 1;`;
  if (!rows || rows.length === 0) return null;

  const item = rows[0];
  const mappings = await sql`SELECT * FROM media_provider_mappings WHERE canonical_id = ${id};`;
  const seasons = await sql`SELECT * FROM media_seasons WHERE canonical_id = ${id} ORDER BY season_number ASC;`;
  const episodes = await sql`SELECT * FROM media_episodes WHERE canonical_id = ${id} ORDER BY season_number ASC, episode_number ASC;`;
  const trailers = await sql`SELECT * FROM media_trailers WHERE canonical_id = ${id};`;
  const providers = await sql`SELECT * FROM media_watch_providers WHERE canonical_id = ${id} ORDER BY display_priority ASC;`;
  const userSources = await sql`SELECT * FROM user_sources WHERE canonical_id = ${id} ORDER BY created_at DESC;`;

  const providerMappings = {};
  for (const m of mappings) {
    providerMappings[m.provider_name] = m.external_id;
  }

  let baseSources = [];
  try {
    baseSources = JSON.parse(item.sources_json || '[]');
  } catch (e) {}

  const mergedSources = [
    ...baseSources,
    ...userSources.map(us => ({
      id: us.id,
      name: us.name,
      sourceName: us.name,
      url: us.url,
      type: 'Custom Source',
      quality: us.quality || 'HD',
      audio: us.language || 'Original'
    }))
  ];

  return {
    id: item.id,
    mediaType: item.media_type,
    format: item.format || (item.media_type === 'Movie' ? 'Movie' : 'Series'),
    title: item.title,
    originalTitle: item.original_title,
    romajiTitle: item.romaji_title,
    slug: item.slug,
    synopsis: item.synopsis,
    tagline: item.tagline,
    releaseDate: item.release_date,
    releaseYear: item.release_year,
    runtimeMinutes: item.runtime_minutes,
    status: item.status,
    rating: item.rating,
    voteCount: item.vote_count,
    popularityScore: item.popularity_score,
    posterUrl: item.poster_url,
    backdropUrl: item.backdrop_url,
    bannerUrl: item.banner_url,
    genres: JSON.parse(item.genres_json || '[]'),
    countryOfOrigin: item.country_of_origin,
    studios: JSON.parse(item.studios_json || '[]'),
    networks: JSON.parse(item.networks_json || '[]'),
    creators: JSON.parse(item.creators_json || '[]'),
    cast: JSON.parse(item.cast_json || '[]'),
    related: JSON.parse(item.related_json || '[]'),
    sources: mergedSources,
    totalSeasons: Math.max(item.total_seasons || 1, seasons.length),
    totalEpisodes: Math.max(item.total_episodes || 0, episodes.length) || null,
    nextAiringEpisode: item.next_airing_episode,
    nextAiringAt: item.next_airing_at,
    lastSyncedAt: item.last_synced_at,
    providerMappings,
    seasons: seasons.map(s => ({
      seasonNumber: s.season_number,
      title: s.title,
      overview: s.overview,
      episodeCount: s.episode_count,
      posterUrl: s.poster_url,
      airDate: s.air_date
    })),
    episodes: episodes.map(e => ({
      seasonNumber: e.season_number,
      episodeNumber: e.episode_number,
      title: e.title,
      overview: e.overview,
      airDate: e.air_date,
      runtimeMinutes: e.runtime_minutes,
      stillUrl: e.still_url,
      voteAverage: e.vote_average
    })),
    trailers: trailers.map(t => ({
      id: t.id,
      sourceSite: t.source_site,
      videoKey: t.video_key,
      title: t.title,
      thumbnailUrl: t.thumbnail_url,
      isOfficial: Boolean(t.is_official)
    })),
    watchProviders: providers.map(p => ({
      id: p.id,
      regionCode: p.region_code,
      providerName: p.provider_name,
      providerLogoUrl: p.provider_logo_url,
      availabilityType: p.availability_type,
      webUrl: p.web_url,
      displayPriority: p.display_priority
    }))
  };
}

export async function addMediaSource(canonicalId, source) {
  const sql = getSql();
  const id = source.id || `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const name = source.sourceName || source.name || 'Custom Mirror';
  await sql`
    INSERT INTO user_sources (id, canonical_id, name, url, quality, language)
    VALUES (${id}, ${canonicalId}, ${name}, ${source.url}, ${source.quality || 'HD'}, ${source.audio || source.language || 'Original'});
  `;
  return getCanonicalMedia(canonicalId);
}

export async function deleteMediaSource(canonicalId, sourceId) {
  const sql = getSql();
  await sql`DELETE FROM user_sources WHERE canonical_id = ${canonicalId} AND id = ${sourceId};`;
  return getCanonicalMedia(canonicalId);
}
export function isSubsequentSeasonTitle(item) {
  if (!item || !item.title) return false;
  if (item.isMovie || item.format === 'Movie' || item.mediaType === 'Movie') return false;
  const pattern = /\b(?:Season\s+([2-9]|\d{2,})|[2-9]\d*(?:nd|rd|th)\s+Season|Final\s+Season|Season\s+Final|Cour\s+([2-9]|\d{2,}))\b/i;
  return pattern.test(item.title);
}

export async function searchCachedMedia(query, mediaType) {
  const sql = getSql();
  const tokens = (query || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);

  if (tokens.length === 0) return [];

  let rows;
  if (mediaType && mediaType !== 'All') {
    rows = await sql`
      SELECT * FROM cached_media 
      WHERE media_type = ${mediaType}
      ORDER BY popularity_score DESC LIMIT 100;
    `;
  } else {
    rows = await sql`
      SELECT * FROM cached_media 
      ORDER BY popularity_score DESC LIMIT 100;
    `;
  }

  // Filter in-memory matching tokens across titles
  return rows.filter(item => !isSubsequentSeasonTitle(item)).filter(item => {
    const combined = `${item.title} ${item.original_title || ''} ${item.romaji_title || ''} ${item.slug || ''}`.toLowerCase();
    return tokens.every(token => combined.includes(token));
  }).map(row => ({
    id: row.id,
    mediaType: row.media_type,
    format: row.format || (row.media_type === 'Movie' ? 'Movie' : 'Series'),
    title: row.title,
    originalTitle: row.original_title,
    romajiTitle: row.romaji_title,
    slug: row.slug,
    synopsis: row.synopsis,
    releaseDate: row.release_date,
    releaseYear: row.release_year,
    rating: row.rating,
    popularityScore: row.popularity_score,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    genres: JSON.parse(row.genres_json || '[]')
  }));
}

export async function remapDuplicateCanonicalMedia(primaryId, duplicateId) {
  if (!primaryId || !duplicateId || primaryId === duplicateId) return;
  const sql = getSql();

  try {
    await sql`
      UPDATE catalog_items
      SET canonical_id = ${primaryId}
      WHERE canonical_id = ${duplicateId};
    `;

    try {
      await sql`
        UPDATE media_provider_mappings
        SET canonical_id = ${primaryId}
        WHERE canonical_id = ${duplicateId};
      `;
    } catch (e) {
      await sql`DELETE FROM media_provider_mappings WHERE canonical_id = ${duplicateId};`;
    }

    await sql`DELETE FROM cached_media WHERE id = ${duplicateId};`;
    console.log(`[Neon Postgres] Remapped duplicate canonical media: ${duplicateId} -> ${primaryId}`);
  } catch (err) {
    console.warn(`[Neon Postgres] Remap warning for ${duplicateId}:`, err.message);
  }
}

export async function getCachedTrending({ type = 'All', animeFormat = 'All', limit = 24, offset, page = 1, genre = 'All', sort = 'popularity_desc', excludeIds = '' } = {}) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM cached_media
    ORDER BY popularity_score DESC
    LIMIT 500;
  `;

  let filtered = rows.filter(i => !isSubsequentSeasonTitle(i));
  if (type !== 'All') {
    if (type === 'Movie') {
      filtered = filtered.filter(i => i.media_type === 'Movie' || i.format === 'Movie');
    } else {
      filtered = filtered.filter(i => i.media_type === type);
    }
  }
  if (type === 'Anime' && animeFormat !== 'All') {
    filtered = filtered.filter(i => (i.format || 'Series') === animeFormat);
  }
  if (genre !== 'All') {
    filtered = filtered.filter(i => {
      try {
        const g = JSON.parse(i.genres_json || '[]');
        return g.includes(genre);
      } catch (e) {
        return false;
      }
    });
  }

  const excludeList = (typeof excludeIds === 'string' ? excludeIds.split(',') : Array.from(excludeIds || [])).map(s => String(s).trim()).filter(Boolean);
  if (excludeList.length > 0) {
    const excludeSet = new Set(excludeList);
    filtered = filtered.filter(i => !excludeSet.has(i.id));
  }

  const limitNum = Math.max(1, parseInt(limit, 10) || 24);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offsetNum = offset !== undefined ? offset : (pageNum - 1) * limitNum;

  return filtered.slice(offsetNum, offsetNum + limitNum).map(row => ({
    id: row.id,
    mediaType: row.media_type,
    format: row.format || (row.media_type === 'Movie' ? 'Movie' : 'Series'),
    title: row.title,
    originalTitle: row.original_title,
    romajiTitle: row.romaji_title,
    slug: row.slug,
    synopsis: row.synopsis,
    releaseDate: row.release_date,
    releaseYear: row.release_year,
    rating: row.rating,
    popularityScore: row.popularity_score,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    genres: JSON.parse(row.genres_json || '[]')
  }));
}

export async function getCatalogItems(filters = {}) {
  const sql = getSql();
  const { status = 'All', excludeStatus = '', type = 'All', sort = 'updated_desc', favoriteOnly = false, search = '', genre = 'All', animeFormat = 'All', page = 1, limit = 24, userId } = filters;
  const targetUserId = userId || 'user_makisanis106';

  const rows = await sql`
    SELECT ci.*, cm.genres_json, cm.synopsis, cm.rating as global_rating, cm.total_episodes as canonical_total_episodes, cm.cast_json
    FROM catalog_items ci
    LEFT JOIN cached_media cm ON ci.canonical_id = cm.id
    WHERE (ci.user_id = ${targetUserId} OR ci.user_id IS NULL)
    ORDER BY ci.updated_at DESC;
  `;

  let filtered = rows;

  if (status !== 'All') {
    filtered = filtered.filter(i => i.user_status === status);
  }
  if (excludeStatus && excludeStatus.trim()) {
    filtered = filtered.filter(i => i.user_status !== excludeStatus.trim());
  }
  if (type !== 'All') {
    filtered = filtered.filter(i => i.media_type === type);
  }
  if (type === 'Anime' && animeFormat !== 'All') {
    filtered = filtered.filter(i => (i.format || 'Series') === animeFormat);
  }
  if (favoriteOnly) {
    filtered = filtered.filter(i => Boolean(i.is_favorite));
  }
  if (genre !== 'All') {
    filtered = filtered.filter(i => {
      try {
        let g = JSON.parse(i.genres_json || '[]');
        if (!Array.isArray(g) || g.length === 0) {
          g = JSON.parse(i.tags_json || '[]');
        }
        return Array.isArray(g) && g.some(itemG => itemG && itemG.toLowerCase() === genre.toLowerCase());
      } catch (e) {
        return false;
      }
    });
  }
  if (search && search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i => (i.title || '').toLowerCase().includes(q));
  }

  // Sorting
  filtered.sort((a, b) => {
    if (sort === 'rating_desc') return (b.user_rating || 0) - (a.user_rating || 0);
    if (sort === 'release_desc') return (b.release_year || 0) - (a.release_year || 0);
    if (sort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const offset = (Math.max(1, page) - 1) * limit;
  return filtered.slice(offset, offset + limit).map(row => {
    const totalSeasons = Math.max(row.total_seasons || 1, row.canonical_total_seasons || 1);
    const seasonsCompleted = (row.seasons_completed !== null && row.seasons_completed !== undefined)
      ? row.seasons_completed
      : (row.user_status === 'Completed' ? totalSeasons : Math.max(0, (row.current_season || 1) - 1));

    return {
      id: row.id,
      canonicalId: row.canonical_id,
      mediaType: row.media_type,
      format: row.format || (row.media_type === 'Movie' ? 'Movie' : 'Series'),
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
      totalEpisodes: row.total_episodes || row.canonical_total_episodes,
      notes: row.notes,
      tags: JSON.parse(row.tags_json || '[]'),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      lastWatchedAt: row.last_watched_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      genres: JSON.parse(row.genres_json || '[]'),
      synopsis: row.synopsis
    };
  });
}

export async function getCatalogItem(id, userId) {
  if (!id) return null;
  const sql = getSql();
  const targetUserId = userId || 'user_makisanis106';
  const rows = await sql`
    SELECT * FROM catalog_items 
    WHERE (id = ${id} OR canonical_id = ${id}) AND (user_id = ${targetUserId} OR user_id IS NULL)
    LIMIT 1;
  `;
  if (!rows || rows.length === 0) return null;

  const item = rows[0];
  const progressRows = await sql`
    SELECT * FROM catalog_episode_progress 
    WHERE catalog_item_id = ${item.id} AND (user_id = ${targetUserId} OR user_id IS NULL) AND is_watched = 1;
  `;

  return {
    id: item.id,
    canonicalId: item.canonical_id,
    mediaType: item.media_type,
    format: item.format || (item.media_type === 'Movie' ? 'Movie' : 'Series'),
    title: item.title,
    posterUrl: item.poster_url,
    backdropUrl: item.backdrop_url,
    releaseYear: item.release_year,
    userStatus: item.user_status,
    isFavorite: Boolean(item.is_favorite),
    isRewatching: Boolean(item.is_rewatching),
    userRating: item.user_rating,
    currentSeason: item.current_season || 1,
    seasonsCompleted: item.seasons_completed ?? (item.user_status === 'Completed' ? (item.total_seasons || 1) : Math.max(0, (item.current_season || 1) - 1)),
    totalSeasons: item.total_seasons || 1,
    currentEpisode: item.current_episode,
    totalEpisodes: item.total_episodes,
    notes: item.notes,
    tags: JSON.parse(item.tags_json || '[]'),
    startedAt: item.started_at,
    completedAt: item.completed_at,
    lastWatchedAt: item.last_watched_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    watchedEpisodes: progressRows.map(p => ({
      seasonNumber: p.season_number,
      episodeNumber: p.episode_number,
      watchedAt: p.watched_at
    }))
  };
}

export async function getCatalogItemByCanonicalId(canonicalId, userId) {
  return getCatalogItem(canonicalId, userId);
}

export async function upsertCatalogItem(item, userId) {
  const sql = getSql();
  const targetUserId = userId || item.userId || 'user_makisanis106';
  const id = item.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const isMovie = item.mediaType === 'Movie' || item.format === 'Movie' || item.isMovie;
  const isStandaloneSeason = !isMovie && Boolean(
    item.isSeparateSeason ||
    /(?:\bSeason\s*[2-9]|\bSeason\s*\d{2,}|\b[2-9]\d*(?:st|nd|rd|th)\s*Season|\bFinal\s*Season|\bSeason\s*Final|\bPart\s*[2-9]|\bCour\s*[2-9]|\bS[2-9]\b|\b(?:II|III|IV|V|VI)\b)/i.test(item.title || '')
  );

  const totalSeasonsVal = isMovie || isStandaloneSeason ? null : (item.totalSeasons !== undefined ? item.totalSeasons : 1);
  const seasonsCompletedVal = isMovie || isStandaloneSeason ? 0 : (item.seasonsCompleted !== undefined ? item.seasonsCompleted : 0);
  const currentSeasonVal = isMovie ? null : (item.currentSeason || (seasonsCompletedVal > 0 ? seasonsCompletedVal + 1 : 1));

  let itemTags = [];
  if (Array.isArray(item.tags)) itemTags.push(...item.tags);
  if (Array.isArray(item.genres)) {
    for (const g of item.genres) {
      if (!itemTags.includes(g)) itemTags.push(g);
    }
  }

  if (item.canonicalId && Array.isArray(item.genres) && item.genres.length > 0) {
    try {
      await sql`
        INSERT INTO cached_media (id, media_type, format, title, genres_json, poster_url, backdrop_url, release_year, status, last_synced_at)
        VALUES (${item.canonicalId}, ${item.mediaType || 'Series'}, ${item.format || 'Series'}, ${item.title}, ${JSON.stringify(item.genres)}, ${item.posterUrl || null}, ${item.backdropUrl || null}, ${item.releaseYear || null}, 'Ended', ${now})
        ON CONFLICT (id) DO UPDATE SET
          genres_json = COALESCE(EXCLUDED.genres_json, cached_media.genres_json);
      `;
    } catch (e) {}
  }

  await sql`
    INSERT INTO catalog_items (
      id, canonical_id, user_id, media_type, format, title, poster_url, backdrop_url,
      release_year, user_status, is_favorite, is_rewatching, user_rating,
      current_season, seasons_completed, total_seasons, current_episode, total_episodes, notes, tags_json,
      started_at, completed_at, last_watched_at, updated_at
    ) VALUES (
      ${id}, ${item.canonicalId || id}, ${targetUserId}, ${item.mediaType}, ${item.format || 'Series'},
      ${item.title}, ${item.posterUrl || null}, ${item.backdropUrl || null},
      ${item.releaseYear || null}, ${item.userStatus || 'Want to Watch'},
      ${item.isFavorite ? 1 : 0}, ${item.isRewatching ? 1 : 0}, ${item.userRating || null},
      ${currentSeasonVal}, ${seasonsCompletedVal}, ${totalSeasonsVal}, ${item.currentEpisode || 0}, ${item.totalEpisodes || null},
      ${item.notes || null}, ${JSON.stringify(itemTags)},
      ${item.startedAt || null}, ${item.completedAt || null}, ${item.lastWatchedAt || null},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = COALESCE(EXCLUDED.user_id, catalog_items.user_id),
      user_status = EXCLUDED.user_status,
      is_favorite = EXCLUDED.is_favorite,
      is_rewatching = EXCLUDED.is_rewatching,
      user_rating = EXCLUDED.user_rating,
      current_season = EXCLUDED.current_season,
      seasons_completed = EXCLUDED.seasons_completed,
      total_seasons = COALESCE(EXCLUDED.total_seasons, catalog_items.total_seasons),
      current_episode = EXCLUDED.current_episode,
      notes = EXCLUDED.notes,
      tags_json = EXCLUDED.tags_json,
      started_at = EXCLUDED.started_at,
      completed_at = EXCLUDED.completed_at,
      last_watched_at = EXCLUDED.last_watched_at,
      updated_at = EXCLUDED.updated_at;
  `;

  return getCatalogItem(id, targetUserId);
}

export async function setSeasonsCompleted(catalogItemId, seasonsCompleted, opts = {}) {
  const sql = getSql();
  const now = new Date().toISOString();
  const targetUserId = opts.userId || 'user_makisanis106';
  const existing = await getCatalogItem(catalogItemId, targetUserId);
  if (!existing) return null;

  const count = Math.max(0, parseInt(seasonsCompleted, 10) || 0);
  const totalSeasons = opts.totalSeasons || existing.totalSeasons || 1;
  const userStatus = opts.userStatus || existing.userStatus;
  const currentSeason = opts.currentSeason || (count < totalSeasons ? count + 1 : totalSeasons);

  const completedAt = (userStatus === 'Completed' && !existing.completedAt) ? now : (userStatus !== 'Completed' ? null : existing.completedAt);

  await sql`
    UPDATE catalog_items
    SET seasons_completed = ${count},
        current_season = ${currentSeason},
        total_seasons = GREATEST(total_seasons, ${totalSeasons}),
        user_status = ${userStatus},
        completed_at = ${completedAt},
        last_watched_at = ${now},
        updated_at = ${now}
    WHERE id = ${catalogItemId} AND (user_id = ${targetUserId} OR user_id IS NULL);
  `;

  return getCatalogItem(catalogItemId, targetUserId);
}

export async function deleteCatalogItem(id, userId) {
  const sql = getSql();
  const targetUserId = userId || 'user_makisanis106';
  await sql`DELETE FROM catalog_items WHERE (id = ${id} OR canonical_id = ${id}) AND (user_id = ${targetUserId} OR user_id IS NULL);`;
  return { success: true };
}

export async function toggleEpisodeProgress(catalogItemId, seasonNumber, episodeNumber, isWatched, userId) {
  const sql = getSql();
  const now = new Date().toISOString();
  const targetUserId = userId || 'user_makisanis106';

  if (isWatched) {
    await sql`
      INSERT INTO catalog_episode_progress (user_id, catalog_item_id, season_number, episode_number, is_watched, watched_at)
      VALUES (${targetUserId}, ${catalogItemId}, ${seasonNumber}, ${episodeNumber}, 1, ${now})
      ON CONFLICT (catalog_item_id, season_number, episode_number) DO UPDATE SET
        user_id = COALESCE(catalog_episode_progress.user_id, ${targetUserId}),
        is_watched = 1,
        watched_at = EXCLUDED.watched_at;
    `;

    await sql`
      UPDATE catalog_items
      SET current_season = GREATEST(COALESCE(current_season, 1), ${seasonNumber}),
          current_episode = GREATEST(COALESCE(current_episode, 0), ${episodeNumber}),
          last_watched_at = ${now},
          updated_at = ${now}
      WHERE id = ${catalogItemId} AND (user_id = ${targetUserId} OR user_id IS NULL);
    `;
  } else {
    await sql`
      DELETE FROM catalog_episode_progress
      WHERE catalog_item_id = ${catalogItemId} AND season_number = ${seasonNumber} AND episode_number = ${episodeNumber}
        AND (user_id = ${targetUserId} OR user_id IS NULL);
    `;

    const maxProg = await sql`
      SELECT MAX(episode_number)::int as max_ep, MAX(season_number)::int as max_season
      FROM catalog_episode_progress
      WHERE catalog_item_id = ${catalogItemId} AND (user_id = ${targetUserId} OR user_id IS NULL) AND is_watched = 1;
    `;

    const remainingEp = maxProg[0]?.max_ep || 0;
    const remainingSeason = maxProg[0]?.max_season || 1;

    await sql`
      UPDATE catalog_items
      SET current_season = ${remainingSeason},
          current_episode = ${remainingEp},
          last_watched_at = ${now},
          updated_at = ${now}
      WHERE id = ${catalogItemId} AND (user_id = ${targetUserId} OR user_id IS NULL);
    `;
  }

  return getCatalogItem(catalogItemId, targetUserId);
}

export async function batchSetSeasonProgress(catalogItemId, seasonNumber, episodes, isWatched, userId) {
  const sql = getSql();
  const now = new Date().toISOString();
  const targetUserId = userId || 'user_makisanis106';

  if (isWatched) {
    for (const ep of episodes) {
      await sql`
        INSERT INTO catalog_episode_progress (user_id, catalog_item_id, season_number, episode_number, is_watched, watched_at)
        VALUES (${targetUserId}, ${catalogItemId}, ${seasonNumber}, ${ep}, 1, ${now})
        ON CONFLICT (catalog_item_id, season_number, episode_number) DO UPDATE SET
          user_id = COALESCE(catalog_episode_progress.user_id, ${targetUserId}),
          is_watched = 1,
          watched_at = EXCLUDED.watched_at;
      `;
    }
  } else {
    for (const ep of episodes) {
      await sql`
        DELETE FROM catalog_episode_progress
        WHERE catalog_item_id = ${catalogItemId} AND season_number = ${seasonNumber} AND episode_number = ${ep}
          AND (user_id = ${targetUserId} OR user_id IS NULL);
      `;
    }
  }

  return { success: true, catalogItemId, seasonNumber, isWatched };
}

export async function getCatalogStats(userId) {
  const sql = getSql();
  const targetUserId = userId || 'user_makisanis106';
  const rows = await sql`
    SELECT ci.id, ci.title, ci.user_status, ci.media_type, ci.user_rating, ci.is_favorite,
           ci.canonical_id, cm.genres_json, cm.poster_url, cm.rating as global_rating
    FROM catalog_items ci
    LEFT JOIN cached_media cm ON ci.canonical_id = cm.id OR ci.id = cm.id
    WHERE ci.user_id = ${targetUserId} OR ci.user_id IS NULL;
  `;

  const epRows = await sql`
    SELECT COUNT(*)::int as cnt 
    FROM catalog_episode_progress 
    WHERE is_watched = 1 AND (user_id = ${targetUserId} OR user_id IS NULL);
  `;

  const totalTitles = rows.length;
  const statusCounts = {};
  const typeCounts = { Anime: 0, Movie: 0, Series: 0 };
  const genreCountMap = {};

  let ratingSum = 0;
  let ratedCount = 0;
  let tier10 = 0;
  let tier9 = 0;
  let tier8 = 0;
  let tier7 = 0;
  let tierBelow7 = 0;
  let unratedCount = 0;

  for (const r of rows) {
    statusCounts[r.user_status] = (statusCounts[r.user_status] || 0) + 1;
    if (typeCounts[r.media_type] !== undefined) typeCounts[r.media_type]++;

    let genres = [];
    try { genres = JSON.parse(r.genres_json || '[]'); } catch (e) {}
    for (const g of genres) {
      if (!g || (g === 'Animation' && r.media_type === 'Anime')) continue;
      genreCountMap[g] = (genreCountMap[g] || 0) + 1;
    }

    const ur = r.user_rating;
    if (ur && ur > 0) {
      ratingSum += ur;
      ratedCount++;
      if (ur === 10) tier10++;
      else if (ur === 9) tier9++;
      else if (ur === 8) tier8++;
      else if (ur === 7) tier7++;
      else tierBelow7++;
    } else {
      unratedCount++;
    }
  }

  const genreDistribution = Object.entries(genreCountMap)
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: totalTitles > 0 ? Math.round((count / totalTitles) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const averageRating = ratedCount > 0 ? parseFloat((ratingSum / ratedCount).toFixed(1)) : 0;
  const ratingSpread = {
    averageRating,
    totalRated: ratedCount,
    unrated: unratedCount,
    tier10,
    tier9,
    tier8,
    tier7,
    tierBelow7,
    distribution: [
      { score: '10★ Masterpiece', count: tier10, percentage: ratedCount > 0 ? Math.round((tier10 / ratedCount) * 100) : 0, color: 'bg-amber-400' },
      { score: '9★ Exceptional', count: tier9, percentage: ratedCount > 0 ? Math.round((tier9 / ratedCount) * 100) : 0, color: 'bg-emerald-400' },
      { score: '8★ Great', count: tier8, percentage: ratedCount > 0 ? Math.round((tier8 / ratedCount) * 100) : 0, color: 'bg-sky-400' },
      { score: '7★ Good', count: tier7, percentage: ratedCount > 0 ? Math.round((tier7 / ratedCount) * 100) : 0, color: 'bg-purple-400' },
      { score: '≤6★ Mixed', count: tierBelow7, percentage: ratedCount > 0 ? Math.round((tierBelow7 / ratedCount) * 100) : 0, color: 'bg-zinc-500' }
    ]
  };

  const topRatedHighlights = rows
    .filter((r) => (r.user_rating && r.user_rating >= 9) || r.is_favorite)
    .sort((a, b) => (b.user_rating || 0) - (a.user_rating || 0))
    .slice(0, 6)
    .map((r) => {
      let genres = [];
      try { genres = JSON.parse(r.genres_json || '[]'); } catch (e) {}
      return {
        id: r.id,
        title: r.title,
        canonicalId: r.canonical_id,
        posterUrl: r.poster_url,
        mediaType: r.media_type,
        userRating: r.user_rating || null,
        userStatus: r.user_status,
        isFavorite: Boolean(r.is_favorite),
        genres: genres.slice(0, 3)
      };
    });

  const completed = statusCounts['Completed'] || 0;
  const watching = statusCounts['Watching'] || 0;
  const onHold = statusCounts['On Hold'] || 0;
  const dropped = statusCounts['Dropped'] || 0;
  const startedTotal = completed + watching + onHold + dropped;
  const completionRate = startedTotal > 0 ? Math.round((completed / startedTotal) * 100) : (totalTitles > 0 ? Math.round((completed / totalTitles) * 100) : 0);

  let velocityRating = 'Steady Pacing';
  if (completionRate >= 80 && completed >= 5) velocityRating = 'High Velocity (Master Finisher)';
  else if (completionRate >= 60) velocityRating = 'Active Momentum';
  else if (watching > completed) velocityRating = 'Parallel Bingeing';
  else if (totalTitles > 0) velocityRating = 'Curating Backlog';

  const completionVelocity = {
    completionRate,
    velocityRating,
    completedCount: completed,
    watchingCount: watching,
    onHoldCount: onHold,
    droppedCount: dropped,
    wantToWatchCount: statusCounts['Want to Watch'] || 0
  };

  return {
    totalTitles,
    favoriteCount: rows.filter((r) => Boolean(r.is_favorite)).length,
    watchedEpisodesCount: epRows[0]?.cnt || 0,
    estimatedHoursWatched: Math.round(((epRows[0]?.cnt || 0) * 30) / 60),
    genreDistribution,
    ratingSpread,
    topRatedHighlights,
    completionVelocity,
    byStatus: {
      'Want to Watch': statusCounts['Want to Watch'] || 0,
      Watching: statusCounts['Watching'] || 0,
      Completed: statusCounts['Completed'] || 0,
      'On Hold': statusCounts['On Hold'] || 0,
      Dropped: statusCounts['Dropped'] || 0,
      Rewatching: statusCounts['Rewatching'] || 0
    },
    byType: typeCounts
  };
}

export async function getCatalogRecommendations(userId) {
  const sql = getSql();
  const favorites = userId
    ? await sql`
        SELECT ci.id, ci.title, ci.user_rating, ci.is_favorite, ci.media_type, ci.canonical_id,
               cm.genres_json, cm.related_json as related_media_json, cm.rating as global_rating
        FROM catalog_items ci
        LEFT JOIN cached_media cm ON ci.canonical_id = cm.id OR ci.id = cm.id
        WHERE (ci.user_id = ${userId} OR ci.user_id IS NULL) AND (ci.user_rating >= 9 OR ci.is_favorite = 1)
        ORDER BY ci.user_rating DESC, ci.updated_at DESC
        LIMIT 10;
      `
    : await sql`
        SELECT ci.id, ci.title, ci.user_rating, ci.is_favorite, ci.media_type, ci.canonical_id,
               cm.genres_json, cm.related_json as related_media_json, cm.rating as global_rating
        FROM catalog_items ci
        LEFT JOIN cached_media cm ON ci.canonical_id = cm.id OR ci.id = cm.id
        WHERE ci.user_rating >= 9 OR ci.is_favorite = 1
        ORDER BY ci.user_rating DESC, ci.updated_at DESC
        LIMIT 10;
      `;

  const existingRows = userId
    ? await sql`SELECT id, canonical_id FROM catalog_items WHERE user_id = ${userId} OR user_id IS NULL;`
    : await sql`SELECT id, canonical_id FROM catalog_items;`;

  const existingCatalogIds = new Set(existingRows.flatMap((r) => [r.id, r.canonical_id].filter(Boolean)));
  const recommendations = [];
  const seenIds = new Set();

  for (const fav of favorites) {
    let related = [];
    try { related = JSON.parse(fav.related_media_json || '[]'); } catch (e) {}
    let favGenres = [];
    try { favGenres = JSON.parse(fav.genres_json || '[]'); } catch (e) {}

    const sourceRating = fav.user_rating || 10;
    for (const rel of related) {
      if (!rel || !rel.id || seenIds.has(rel.id) || existingCatalogIds.has(rel.id)) continue;
      seenIds.add(rel.id);
      recommendations.push({
        id: rel.id,
        title: rel.title,
        posterUrl: rel.posterUrl,
        backdropUrl: rel.backdropUrl || null,
        mediaType: rel.mediaType || fav.media_type,
        rating: rel.rating || 8.5,
        genres: rel.genres || favGenres.slice(0, 3),
        sourceTitle: fav.title,
        sourceRating,
        matchScore: 98,
        matchReason: `Curated recommendation based on ${fav.title} (Rated ${sourceRating}/10)`,
        matchTags: ['Shared Themes', ...(favGenres.slice(0, 2))]
      });
      if (recommendations.length >= 24) break;
    }
  }

  return recommendations.slice(0, 24);
}

export async function exportCatalogData() {
  const sql = getSql();
  const items = await sql`SELECT * FROM catalog_items;`;
  const progress = await sql`SELECT * FROM catalog_episode_progress;`;
  const mirrors = await sql`SELECT * FROM mirror_sources;`;

  return {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    catalogItems: items,
    episodeProgress: progress,
    mirrors
  };
}

export async function importCatalogData(payload) {
  if (!payload || !Array.isArray(payload.catalogItems)) {
    throw new Error('Invalid catalog backup payload');
  }

  const sql = getSql();
  for (const item of payload.catalogItems) {
    await upsertCatalogItem(item);
  }

  if (Array.isArray(payload.episodeProgress)) {
    for (const p of payload.episodeProgress) {
      await toggleEpisodeProgress(p.catalog_item_id, p.season_number, p.episode_number, Boolean(p.is_watched));
    }
  }

  return { success: true, count: payload.catalogItems.length };
}

export async function getAllMirrorSources() {
  const sql = getSql();
  const rows = await sql`SELECT * FROM mirror_sources ORDER BY sort_order ASC, name ASC;`;
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

export async function updateMirrorSourceDomain(id, currentDomain, status, latencyMs, statusNote) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE mirror_sources
    SET current_domain = ${currentDomain},
        status = ${status || 'Working'},
        latency_ms = ${latencyMs || 0},
        status_note = ${statusNote || null},
        last_checked_at = ${now},
        updated_at = ${now}
    WHERE id = ${id};
  `;
}

export async function updateMirrorStatus(id, status, latencyMs, statusNote) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE mirror_sources
    SET status = ${status},
        latency_ms = ${latencyMs || 0},
        status_note = ${statusNote || null},
        last_checked_at = ${now},
        updated_at = ${now}
    WHERE id = ${id};
  `;
}

export async function upsertMirrorSource(item) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO mirror_sources (
      id, name, category, type, quality, audio, current_domain, candidate_domains,
      search_template, direct_url_template, status, latency_ms, is_enabled, status_note, sort_order, updated_at
    ) VALUES (
      ${item.id}, ${item.name}, ${item.category}, ${item.type}, ${item.quality || '1080p HD'},
      ${item.audio || 'Multi-Audio'}, ${item.currentDomain}, ${JSON.stringify(item.candidateDomains || [item.currentDomain])},
      ${item.searchTemplate}, ${item.directUrlTemplate || null}, ${item.status || 'Working'},
      ${item.latencyMs || 0}, ${item.isEnabled !== false ? 1 : 0}, ${item.statusNote || null},
      ${item.sortOrder || 0}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      type = EXCLUDED.type,
      quality = EXCLUDED.quality,
      audio = EXCLUDED.audio,
      current_domain = EXCLUDED.current_domain,
      candidate_domains = EXCLUDED.candidate_domains,
      search_template = EXCLUDED.search_template,
      direct_url_template = EXCLUDED.direct_url_template,
      status = EXCLUDED.status,
      latency_ms = EXCLUDED.latency_ms,
      is_enabled = EXCLUDED.is_enabled,
      status_note = EXCLUDED.status_note,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at;
  `;
}

export async function deleteMirrorSourceItem(id) {
  const sql = getSql();
  await sql`DELETE FROM mirror_sources WHERE id = ${id};`;
  return { success: true };
}

export async function getDistinctCharacters({ limit = 25 } = {}) {
  const sql = getSql();
  const rows = await sql`
    SELECT cast_json, poster_url, title FROM cached_media
    WHERE cast_json IS NOT NULL AND cast_json != '[]'
    LIMIT 200;
  `;

  const charMap = new Map();
  for (const row of rows) {
    try {
      const cast = JSON.parse(row.cast_json || '[]');
      for (const c of cast) {
        if (!c.character) continue;
        const charName = c.character.trim();
        const key = charName.toLowerCase();
        if (!charMap.has(key)) {
          charMap.set(key, {
            name: charName,
            image: c.characterImage || c.actorImage || row.poster_url || null,
            role: c.role || 'MAIN',
            appearances: 1,
            count: 1,
            titles: [row.title],
            mediaTitles: [row.title],
            actor: c.actor || null
          });
        } else {
          const entry = charMap.get(key);
          entry.appearances += 1;
          entry.count += 1;
          if (!entry.image && (c.characterImage || c.actorImage)) {
            entry.image = c.characterImage || c.actorImage;
          }
          if (!entry.titles.includes(row.title) && entry.titles.length < 3) {
            entry.titles.push(row.title);
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

export async function getCatalogCharacters({ limit = 25 } = {}) {
  const sql = getSql();
  const rows = await sql`
    SELECT cm.cast_json, cm.poster_url, ci.title
    FROM catalog_items ci
    JOIN cached_media cm ON ci.canonical_id = cm.id OR ci.id = cm.id
    WHERE cm.cast_json IS NOT NULL AND cm.cast_json != '[]'
    LIMIT 200;
  `;

  const charMap = new Map();
  for (const row of rows) {
    try {
      const cast = JSON.parse(row.cast_json || '[]');
      for (const c of cast) {
        if (!c.character) continue;
        const charName = c.character.trim();
        const key = charName.toLowerCase();
        if (!charMap.has(key)) {
          charMap.set(key, {
            name: charName,
            image: c.characterImage || c.actorImage || row.poster_url || null,
            role: c.role || 'MAIN',
            appearances: 1,
            count: 1,
            titles: [row.title],
            mediaTitles: [row.title],
            actor: c.actor || null
          });
        } else {
          const entry = charMap.get(key);
          entry.appearances += 1;
          entry.count += 1;
          if (!entry.image && (c.characterImage || c.actorImage)) {
            entry.image = c.characterImage || c.actorImage;
          }
          if (!entry.titles.includes(row.title) && entry.titles.length < 3) {
            entry.titles.push(row.title);
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

export async function createUser({ id, email, password, displayName }) {
  const sql = getSql();
  const userId = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const hash = hashPassword(password);
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
    VALUES (${userId}, ${email.toLowerCase().trim()}, ${hash}, ${displayName || null}, ${now}, ${now})
  `;
  return { id: userId, email: email.toLowerCase().trim(), displayName: displayName || null };
}

export async function findUserByEmail(email) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM users WHERE LOWER(email) = ${email.toLowerCase().trim()} LIMIT 1
  `;
  return rows[0] || null;
}

export async function findUserById(id) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, display_name, created_at FROM users WHERE id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

