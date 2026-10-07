/**
 * OmniWatch Client API Service
 * Interacts with /api/global, /api/catalog, and /api/system
 */

const BASE_GLOBAL = '/api/global';
const BASE_CATALOG = '/api/catalog';
const BASE_SYSTEM = '/api/system';

// -------------------------------------------------------------
// Global Discovery API
// -------------------------------------------------------------

export async function getTrendingMedia(type = 'All', sort = 'popularity_desc', animeFormat = 'All', page = 1, limit = 24, genre = 'All', character = '') {
  const q = new URLSearchParams();
  if (type && type !== 'All') q.set('type', type);
  if (sort) q.set('sort', sort);
  if (type === 'Anime' && animeFormat && animeFormat !== 'All') q.set('animeFormat', animeFormat);
  if (genre && genre !== 'All') q.set('genre', genre);
  if (character && character.trim()) q.set('character', character.trim());
  if (page) q.set('page', page);
  if (limit) q.set('limit', limit);
  const res = await fetch(`${BASE_GLOBAL}/trending?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch trending media: ${res.statusText}`);
  return res.json();
}

export async function getUpcomingMedia(type = 'All', sort = 'release_desc', animeFormat = 'All', page = 1, limit = 24, genre = 'All') {
  const q = new URLSearchParams();
  if (type && type !== 'All') q.set('type', type);
  if (sort) q.set('sort', sort);
  if (type === 'Anime' && animeFormat && animeFormat !== 'All') q.set('animeFormat', animeFormat);
  if (genre && genre !== 'All') q.set('genre', genre);
  if (page) q.set('page', page);
  if (limit) q.set('limit', limit);
  const res = await fetch(`${BASE_GLOBAL}/upcoming?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch upcoming media: ${res.statusText}`);
  return res.json();
}

export async function searchGlobalMedia(query, params = {}) {
  const q = new URLSearchParams();
  if (query) q.set('q', query);
  if (params.character) q.set('character', params.character);
  if (params.searchMode) q.set('searchMode', params.searchMode);
  if (params.mainCharOnly !== undefined) q.set('mainCharOnly', String(params.mainCharOnly));
  if (params.type && params.type !== 'All') q.set('type', params.type);
  if (params.genre && params.genre !== 'All') q.set('genre', params.genre);
  if (params.year) q.set('year', params.year);
  if (params.sort) q.set('sort', params.sort);
  if (params.type === 'Anime' && params.animeFormat && params.animeFormat !== 'All') {
    q.set('animeFormat', params.animeFormat);
  }
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);

  const res = await fetch(`${BASE_GLOBAL}/search?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to search media: ${res.statusText}`);
  return res.json();
}

export async function getGlobalCharacters(params = {}) {
  const q = new URLSearchParams();
  if (params.type && params.type !== 'All') q.set('type', params.type);
  if (params.search) q.set('search', params.search);
  if (params.limit) q.set('limit', params.limit);
  const res = await fetch(`${BASE_GLOBAL}/characters?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to load characters`);
  return res.json();
}

export async function getMediaDetail(canonicalId) {
  const res = await fetch(`${BASE_GLOBAL}/media/${encodeURIComponent(canonicalId)}`);
  if (!res.ok) throw new Error(`Failed to fetch title details for ${canonicalId}`);
  return res.json();
}

export async function refreshMediaDetail(canonicalId) {
  const res = await fetch(`${BASE_GLOBAL}/media/${encodeURIComponent(canonicalId)}/refresh`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to refresh title details`);
  return res.json();
}

export async function addMediaSource(canonicalId, sourceData) {
  const res = await fetch(`${BASE_GLOBAL}/media/${encodeURIComponent(canonicalId)}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sourceData)
  });
  if (!res.ok) throw new Error(`Failed to add mirror source`);
  return res.json();
}

export async function deleteMediaSource(canonicalId, sourceId) {
  const res = await fetch(`${BASE_GLOBAL}/media/${encodeURIComponent(canonicalId)}/sources/${encodeURIComponent(sourceId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete mirror source`);
  return res.json();
}

// -------------------------------------------------------------
// Personal Catalog API
// -------------------------------------------------------------

export async function getCatalog(params = {}) {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'All') q.set('status', params.status);
  if (params.type && params.type !== 'All') q.set('type', params.type);
  if (params.sort) q.set('sort', params.sort);
  if (params.favorite) q.set('favorite', 'true');
  if (params.search) q.set('search', params.search);
  if (params.character) q.set('character', params.character);
  if (params.genre && params.genre !== 'All') q.set('genre', params.genre);
  if (params.type === 'Anime' && params.animeFormat && params.animeFormat !== 'All') {
    q.set('animeFormat', params.animeFormat);
  }
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);

  const res = await fetch(`${BASE_CATALOG}?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to load personal catalog: ${res.statusText}`);
  return res.json();
}

export async function getCatalogCharacters(params = {}) {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', params.limit);
  const res = await fetch(`${BASE_CATALOG}/characters?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to load catalog characters`);
  return res.json();
}

export async function getCatalogStats() {
  const res = await fetch(`${BASE_CATALOG}/stats`);
  if (!res.ok) throw new Error(`Failed to load catalog statistics`);
  return res.json();
}

export async function checkInCatalog(canonicalId) {
  const res = await fetch(`${BASE_CATALOG}/check/${encodeURIComponent(canonicalId)}`);
  if (!res.ok) return { success: false, inCatalog: false };
  return res.json();
}

export async function saveToCatalog(itemData) {
  const res = await fetch(BASE_CATALOG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData)
  });
  if (!res.ok) throw new Error(`Failed to save to catalog: ${res.statusText}`);
  return res.json();
}

export async function updateCatalogItem(id, updateData) {
  const res = await fetch(`${BASE_CATALOG}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) throw new Error(`Failed to update catalog item: ${res.statusText}`);
  return res.json();
}

export async function deleteFromCatalog(id) {
  const res = await fetch(`${BASE_CATALOG}/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to remove item from catalog`);
  return res.json();
}

export async function toggleEpisodeProgress(catalogItemId, { seasonNumber = 1, episodeNumber, isWatched = true }) {
  const res = await fetch(`${BASE_CATALOG}/${encodeURIComponent(catalogItemId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonNumber, episodeNumber, isWatched })
  });
  if (!res.ok) throw new Error(`Failed to update episode progress`);
  return res.json();
}

export async function batchSeasonProgress(catalogItemId, { seasonNumber = 1, episodeCount = 12, isWatched = true }) {
  const res = await fetch(`${BASE_CATALOG}/${encodeURIComponent(catalogItemId)}/batch-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonNumber, episodeCount, isWatched })
  });
  if (!res.ok) throw new Error(`Failed to update season progress`);
  return res.json();
}

export async function importCatalogBackup(backupData) {
  const res = await fetch(`${BASE_CATALOG}/backup/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  if (!res.ok) throw new Error(`Failed to import backup`);
  return res.json();
}

// -------------------------------------------------------------
// System API
// -------------------------------------------------------------

export async function getSystemStatus() {
  const res = await fetch(`${BASE_SYSTEM}/status`);
  if (!res.ok) throw new Error(`Failed to fetch system status`);
  return res.json();
}

// -------------------------------------------------------------
// Mirror Registry & Domain Health API
// -------------------------------------------------------------

const BASE_MIRRORS = '/api/mirrors';

export async function getMirrorSources() {
  const res = await fetch(BASE_MIRRORS);
  if (!res.ok) throw new Error(`Failed to fetch mirror sources: ${res.statusText}`);
  return res.json();
}

export async function checkMirrorsHealth(id = null) {
  const res = await fetch(`${BASE_MIRRORS}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { id } : {})
  });
  if (!res.ok) throw new Error(`Failed to run mirror health check: ${res.statusText}`);
  return res.json();
}

export async function saveMirrorSource(sourceItem) {
  const res = await fetch(BASE_MIRRORS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sourceItem)
  });
  if (!res.ok) throw new Error(`Failed to save mirror source: ${res.statusText}`);
  return res.json();
}

export async function updateMirrorSource(id, updates) {
  const res = await fetch(`${BASE_MIRRORS}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Failed to update mirror source: ${res.statusText}`);
  return res.json();
}

export async function deleteMirrorSourceItem(id) {
  const res = await fetch(`${BASE_MIRRORS}/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete mirror source: ${res.statusText}`);
  return res.json();
}
