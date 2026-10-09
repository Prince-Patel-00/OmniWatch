/**
 * Peachify Direct Streaming Player Utility
 * Protocol & API reference: https://peachify.pro/ -> https://peachify.top
 */

export const PEACHIFY_BASE_URL = 'https://peachify.top';
export const PEACHIFY_DEFAULT_ACCENT = '10b981'; // Emerald Green hex without '#'
export const PEACHIFY_EVENT_PLAYER = 'PLAYER_EVENT';
export const PEACHIFY_EVENT_MEDIA_DATA = 'MEDIA_DATA';

/**
 * Resolves a TMDB numeric ID or IMDb 'tt' ID from media object metadata
 * @param {object} media 
 * @returns {{ type: 'tmdb'|'imdb', id: string } | null}
 */
export function resolvePeachifyId(media) {
  if (!media) return null;

  // Direct explicit fields
  if (media.tmdbId) {
    return { type: 'tmdb', id: String(media.tmdbId).trim() };
  }
  if (media.imdbId && String(media.imdbId).startsWith('tt')) {
    return { type: 'imdb', id: String(media.imdbId).trim() };
  }

  // Provider mappings array: [{ provider: 'tmdb', id: 123 }, ...]
  if (Array.isArray(media.providerMappings)) {
    const tmdbMap = media.providerMappings.find(
      (m) => m && (m.provider === 'tmdb' || m.provider_name === 'tmdb') && m.id
    );
    if (tmdbMap) {
      return { type: 'tmdb', id: String(tmdbMap.id).trim() };
    }

    const imdbMap = media.providerMappings.find(
      (m) => m && (m.provider === 'imdb' || m.provider_name === 'imdb') && m.id
    );
    if (imdbMap && String(imdbMap.id).startsWith('tt')) {
      return { type: 'imdb', id: String(imdbMap.id).trim() };
    }
  }

  // Provider mappings object: { tmdb: 123, imdb: 'tt1234' }
  if (media.providerMappings && typeof media.providerMappings === 'object' && !Array.isArray(media.providerMappings)) {
    if (media.providerMappings.tmdb) {
      return { type: 'tmdb', id: String(media.providerMappings.tmdb).trim() };
    }
    if (media.providerMappings.imdb && String(media.providerMappings.imdb).startsWith('tt')) {
      return { type: 'imdb', id: String(media.providerMappings.imdb).trim() };
    }
  }

  // Media ID regex extraction (e.g. omni_tmdb_m_123, omni_tmdb_tv_456, tmdb_789)
  if (typeof media.id === 'string') {
    const tmdbMatch = media.id.match(/^omni_tmdb_(?:m|tv)_(\d+)$/i) || media.id.match(/^tmdb_(\d+)$/i);
    if (tmdbMatch) {
      return { type: 'tmdb', id: tmdbMatch[1] };
    }
    if (/^tt\d+$/i.test(media.id)) {
      return { type: 'imdb', id: media.id };
    }
  }

  // External IDs (e.g. from TVMaze externals)
  if (media.externals && typeof media.externals === 'object') {
    if (media.externals.imdb && String(media.externals.imdb).startsWith('tt')) {
      return { type: 'imdb', id: String(media.externals.imdb).trim() };
    }
    if (media.externals.tmdb) {
      return { type: 'tmdb', id: String(media.externals.tmdb).trim() };
    }
  }

  return null;
}

/**
 * Checks whether an item is eligible for direct Peachify streaming
 * @param {object} media 
 * @returns {boolean}
 */
export function isPeachifySupported(media) {
  return Boolean(resolvePeachifyId(media));
}

/**
 * Builds the official embed or direct launch URL for the Peachify player
 * @param {object} media 
 * @param {object} options 
 * @returns {string | null}
 */
export function buildPeachifyUrl(media, options = {}) {
  const resolved = resolvePeachifyId(media);
  if (!resolved) return null;

  const isMovie = Boolean(
    media.mediaType === 'Movie' ||
    media.format === 'Movie' ||
    media.isMovie ||
    (typeof media.id === 'string' && media.id.includes('_m_'))
  );

  const season = Math.max(1, parseInt(options.season, 10) || 1);
  const episode = Math.max(1, parseInt(options.episode, 10) || 1);

  // Endpoint format per peachify.pro:
  // Movies: https://peachify.top/embed/movie/{id}
  // TV:     https://peachify.top/embed/tv/{id}/{season}/{episode}
  const basePath = isMovie
    ? `${PEACHIFY_BASE_URL}/embed/movie/${resolved.id}`
    : `${PEACHIFY_BASE_URL}/embed/tv/${resolved.id}/${season}/${episode}`;

  const queryParams = new URLSearchParams();

  // Accent color without '#' (default: 10b981 for emerald green)
  const accent = (options.accent || PEACHIFY_DEFAULT_ACCENT).replace(/^#/, '');
  queryParams.set('accent', accent);

  // Autoplay (defaults to false to respect user control)
  if (options.autoPlay !== undefined) {
    queryParams.set('autoPlay', String(Boolean(options.autoPlay)));
  }

  // Auto-next for TV/Anime
  if (!isMovie) {
    if (options.autoNext !== undefined) {
      queryParams.set('autoNext', String(options.autoNext));
    } else {
      queryParams.set('autoNext', '30');
    }
  }

  // Start timestamp
  if (options.startAt || options.progress || options.t) {
    const startSec = Math.floor(Number(options.startAt || options.progress || options.t) || 0);
    if (startSec > 0) {
      queryParams.set('startAt', String(startSec));
    }
  }

  // Dub / Sub / Audio
  if (options.dub) queryParams.set('dub', options.dub);
  if (options.sub) queryParams.set('sub', options.sub);
  if (options.server) queryParams.set('server', options.server);

  return `${basePath}?${queryParams.toString()}`;
}
