/**
 * @omniwatch/shared - Core domain models, constants, and utilities
 */

export const MEDIA_TYPES = {
  ANIME: 'Anime',
  MOVIE: 'Movie',
  SERIES: 'Series'
};

export const MEDIA_TYPES_LIST = ['Anime', 'Movie', 'Series'];

export const ANIME_FORMATS = {
  ALL: 'All',
  SERIES: 'Series',
  MOVIE: 'Movie'
};

export const ANIME_SUB_TABS = [
  { id: 'All', label: 'All Anime' },
  { id: 'Series', label: 'Series' },
  { id: 'Movie', label: 'Movies' }
];

export const MEDIA_STATUSES = {
  AIRING: 'Airing',
  RELEASED: 'Released',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const USER_WATCH_STATUSES = {
  NOT_STARTED: 'Not Started',
  WANT_TO_WATCH: 'Want to Watch',
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  DROPPED: 'Dropped',
  REWATCHING: 'Rewatching'
};

export const USER_WATCH_STATUSES_LIST = [
  'Want to Watch',
  'Watching',
  'Completed',
  'On Hold',
  'Dropped',
  'Rewatching'
];

export const AVAILABILITY_TYPES = {
  FLATRATE: 'Subscription',
  RENT: 'Rent',
  BUY: 'Buy',
  FREE: 'Free',
  ADS: 'Free with Ads'
};

export const POPULAR_REGIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IN', label: 'India' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'JP', label: 'Japan' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' }
];

export const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Cyberpunk',
  'Dark Fantasy',
  'Documentary',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Shonen',
  'Slice of Life',
  'Supernatural',
  'Thriller',
  'Western'
];

export const SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'rating_desc', label: 'Highest Rated' },
  { value: 'title_asc', label: 'Title (A - Z)' },
  { value: 'year_desc', label: 'Release Year (Newest)' },
  { value: 'progress_desc', label: 'Most Progress' }
];

export const GLOBAL_SORT_OPTIONS = [
  { value: 'popularity_desc', label: 'Most Popular' },
  { value: 'rating_desc', label: 'Top Rated' },
  { value: 'release_desc', label: 'Latest Release' },
  { value: 'title_asc', label: 'Title (A - Z)' }
];

export const OFFICIAL_PLATFORM_LOGOS = {
  netflix: 'https://assets.nflxext.com/ffe/siteui/common/icons/monogram/v2/monogram_white.svg',
  crunchyroll: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.png',
  prime: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/320px-Amazon_Prime_Video_logo.svg.png',
  'prime video': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/320px-Amazon_Prime_Video_logo.svg.png',
  'amazon prime': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/320px-Amazon_Prime_Video_logo.svg.png',
  'disney+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/320px-Disney%2B_logo.svg.png',
  disney: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/320px-Disney%2B_logo.svg.png',
  hulu: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hulu_Logo.svg/320px-Hulu_Logo.svg.png',
  max: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Max_logo.svg/320px-Max_logo.svg.png',
  'apple tv+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/320px-Apple_TV_Plus_Logo.svg.png',
  'apple tv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/320px-Apple_TV_Plus_Logo.svg.png',
  tubi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Tubi_logo_2024.svg/320px-Tubi_logo_2024.svg.png',
  hidive: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/HIDIVE_logo.svg/320px-HIDIVE_logo.svg.png'
};

/**
 * Returns a high-res or normalized logo URL for a streaming service name
 */
export function getPlatformLogo(name = '', fallbackUrl = null) {
  if (!name) return fallbackUrl || '';
  const key = name.toLowerCase().trim();
  for (const [providerKey, url] of Object.entries(OFFICIAL_PLATFORM_LOGOS)) {
    if (key.includes(providerKey)) return url;
  }
  return fallbackUrl || '';
}

/**
 * Normalizes title string for deduplication comparison (Unicode-aware to preserve Japanese, Kanji, and Latin scripts)
 */
export function normalizeTitle(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats countdown duration into human-readable string
 */
export function formatTimeUntil(targetIsoDate) {
  if (!targetIsoDate) return null;
  const target = new Date(targetIsoDate).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0) return 'Airing soon / Just aired';

  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

export const QUALITIES = ['4K UHD', '1080p Full HD', '1080p HD', '1080p WebRip', '720p HD'];
export const SOURCE_TYPES = ['Stream', 'Download', 'Both'];

/**
 * Generates direct streaming & download mirror links for movies, TV series, and anime
 */
export const DEFAULT_MIRROR_REGISTRY = [
  {
    id: 'hianime',
    name: 'HiAnime Stream (Zoro)',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Dual Audio & Multi-Sub',
    currentDomain: 'hianime.org',
    candidateDomains: ['hianime.org', 'hianime.to', 'aniwatchtv.to', 'hianime.nz'],
    searchTemplate: 'https://{domain}/filter?search={query}',
    episodeTemplate: 'https://{domain}/search?keyword={query}+episode+{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .org mirror with multi-server playback',
    sortOrder: 1
  },
  {
    id: 'miruro',
    name: 'Miruro 2.0 Anime Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p Fast HD',
    audio: 'Sub & Dub (Miruro 2.0)',
    currentDomain: 'www.miruro.cx',
    candidateDomains: ['www.miruro.cx', 'miruro.bz', 'miruro.tv', 'barelystarted.miruro.tv'],
    searchTemplate: 'https://{domain}/search?query={query}',
    episodeTemplate: 'https://{domain}/search?query={query}+{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active Miruro 2.0 modern anime index',
    sortOrder: 2
  },
  {
    id: 'animepahe',
    name: 'AnimePahe Stream & DL',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p WebRip',
    audio: 'Japanese Multi-Sub & Dub',
    currentDomain: 'animepahe.ng',
    candidateDomains: ['animepahe.ng', 'animepahe.ru', 'animepahe.com', 'animepahe.org'],
    searchTemplate: 'https://{domain}/?s={query}',
    episodeTemplate: 'https://{domain}/?s={query}+{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .ng domain with direct multi-quality streams',
    sortOrder: 3
  },
  {
    id: 'aniwaves',
    name: 'AniWaves Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub Multi-Server',
    currentDomain: 'aniwaves.ru',
    candidateDomains: ['aniwaves.ru', 'aniwave.to', 'aniwave.se', 'aniwave.best'],
    searchTemplate: 'https://{domain}/filter?keyword={query}',
    episodeTemplate: 'https://{domain}/filter?keyword={query}+episode+{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .ru mirror with advanced filters',
    sortOrder: 4
  },
  {
    id: 'anikage',
    name: 'Anikage Anime Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub Ad-Free',
    currentDomain: 'anikage.to',
    candidateDomains: ['anikage.to', 'anikage.com'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .to domain with clean anime playback',
    sortOrder: 5
  },
  {
    id: 'animeheaven',
    name: 'AnimeHeaven Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub Schedule',
    currentDomain: 'animeheaven.com.co',
    candidateDomains: ['animeheaven.com.co', 'animeheaven.me', 'animeheaven.ru'],
    searchTemplate: 'https://{domain}/?s={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .com.co streaming mirror',
    sortOrder: 6
  },
  {
    id: 'gogo',
    name: 'Anitaku / GogoAnime',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub',
    currentDomain: 'anitaku.pe',
    candidateDomains: ['anitaku.pe', 'anitaku.to', 'anitaku.so', 'gogoanime3.co'],
    searchTemplate: 'https://{domain}/search.html?keyword={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Verified active .pe streaming domain',
    sortOrder: 7
  },
  {
    id: 'reanime',
    name: 'ReAnime Stream (TBCPL)',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Ad-Free Sub/Dub',
    currentDomain: 'reanime.to',
    candidateDomains: ['reanime.to', 'reanime.tv'],
    searchTemplate: 'https://{domain}/search?keyword={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Ad-free anime streaming',
    sortOrder: 8
  },
  {
    id: 'marin',
    name: 'Marin Anime Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub Minimalist',
    currentDomain: 'marin.moe',
    candidateDomains: ['marin.moe'],
    searchTemplate: 'https://{domain}/anime?search={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Fast, minimalist ad-free anime player',
    sortOrder: 9
  },
  {
    id: 'anikoto',
    name: 'Anikoto Stream (TBCPL)',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub',
    currentDomain: 'anikototv.to',
    candidateDomains: ['anikototv.to', 'anikoto.to'],
    searchTemplate: 'https://{domain}/filter?keyword={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Sub & Dub tracker',
    sortOrder: 10
  },
  {
    id: 'enma',
    name: 'Enma Stream (TBCPL)',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p Fast HD',
    audio: 'Sub & Dub',
    currentDomain: 'www.enma.lol',
    candidateDomains: ['www.enma.lol', 'enma.lol'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Fast HiAnime / AniWatch alternative',
    sortOrder: 11
  },
  {
    id: 'allmanga',
    name: 'AllManga Anime Stream',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Sub & Dub Multi-Server',
    currentDomain: 'allmanga.to',
    candidateDomains: ['allmanga.to'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Multi-server anime catalog',
    sortOrder: 12
  },
  {
    id: 'nyaa',
    name: 'Nyaa Torrents DL',
    category: 'Anime',
    type: 'Download',
    quality: '1080p BDRip',
    audio: 'FLAC Multi-Sub & Raw',
    currentDomain: 'nyaa.si',
    candidateDomains: ['nyaa.si', 'nyaa.land', 'nyaa.iss.ink'],
    searchTemplate: 'https://{domain}/?f=0&c=1_2&q={query}+1080p',
    episodeTemplate: 'https://{domain}/?f=0&c=1_2&q={query}+{episode}+1080p',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Primary global anime tracker',
    sortOrder: 13
  },
  {
    id: 'gaiaflix',
    name: 'GaiaFlix Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'Multi-Audio & Multi-Sub',
    currentDomain: 'gaiaflix.live',
    candidateDomains: ['gaiaflix.live'],
    searchTemplate: 'https://{domain}/#/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'High-speed CDN streaming for movies, series & sports',
    sortOrder: 14
  },
  {
    id: 'lookmovie',
    name: 'LookMovie Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'English Original & Multi-Sub',
    currentDomain: 'lookmovie-offcial.cyou',
    candidateDomains: ['lookmovie-offcial.cyou', 'lookmovie.buzz', 'lookmovie2.to', 'lookmovie.ag'],
    searchTemplate: 'https://{domain}/search/?q={query}',
    episodeTemplate: 'https://{domain}/search/?q={query}+season+{season}+episode+{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Verified active LookMovie mirror',
    sortOrder: 15
  },
  {
    id: 'nepu',
    name: 'Nepu Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Clean Multi-Sub',
    currentDomain: 'nepu-offcial.cyou',
    candidateDomains: ['nepu-offcial.cyou', 'nepu.to', 'nepu.cc'],
    searchTemplate: 'https://{domain}/search/?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Verified active Nepu mirror',
    sortOrder: 16
  },
  {
    id: 'cinezone',
    name: 'CineZone Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'English 5.1 & Multi-Sub',
    currentDomain: 'cinezone.city',
    candidateDomains: ['cinezone.city', 'cinezone.to'],
    searchTemplate: 'https://{domain}/?s={query}',
    episodeTemplate: 'https://{domain}/?s={query}+s{season}+e{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .city mirror with multi-host streaming',
    sortOrder: 17
  },
  {
    id: 'fbox',
    name: 'FBox Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'English 5.1 & Episodes',
    currentDomain: 'fbox.city',
    candidateDomains: ['fbox.city', 'fboxz.to'],
    searchTemplate: 'https://{domain}/?s={query}',
    episodeTemplate: 'https://{domain}/?s={query}+s{season}+e{episode}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .city mirror with multi-server playback',
    sortOrder: 18
  },
  {
    id: 'sflix',
    name: 'SFlix Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Fast HD',
    audio: 'Multi-Sub Clean',
    currentDomain: 'sflixgo.com',
    candidateDomains: ['sflixgo.com', 'sflix.to', 'sflix2.to'],
    searchTemplate: 'https://{domain}/search/{query}/',
    episodeTemplate: 'https://{domain}/search/{query}-s{season}-e{episode}/',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active SFlixGo mirror',
    sortOrder: 19
  },
  {
    id: 'cineby',
    name: 'Cineby Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'English 5.1 Multi-Sub',
    currentDomain: 'cineby.tv',
    candidateDomains: ['cineby.tv', 'cineby.bz', 'cineby.app'],
    searchTemplate: 'https://{domain}/search/?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .tv modern streaming mirror',
    sortOrder: 20
  },
  {
    id: '7reels',
    name: '7Reels Cinema & Series HD',
    category: 'All',
    type: 'Stream',
    quality: '1080p Fast HD',
    audio: 'English 5.1 & Multi-Sub',
    currentDomain: '7reels.cc',
    candidateDomains: ['7reels.cc'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Fast multi-server CDN streaming',
    sortOrder: 21
  },
  {
    id: '1flex',
    name: '1flex Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'English 5.1 & Multi-Sub',
    currentDomain: 'www.1flex.org',
    candidateDomains: ['www.1flex.org', '1flex.org'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Community megathread top streaming index',
    sortOrder: 22
  },
  {
    id: 'flixway',
    name: 'FlixWay Cinema & Series',
    category: 'All',
    type: 'Stream',
    quality: '1080p Full HD',
    audio: 'Multi-Sub Clean',
    currentDomain: 'flixway.to',
    candidateDomains: ['flixway.to'],
    searchTemplate: 'https://{domain}/search?query={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Clean multi-server stream index',
    sortOrder: 23
  },
  {
    id: 'bingr',
    name: 'Bingr Cinema & Shows',
    category: 'All',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Clean Multi-Sub',
    currentDomain: 'bingr.one',
    candidateDomains: ['bingr.one'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Modern binge-watching UI',
    sortOrder: 24
  },
  {
    id: 'meowtv',
    name: 'MeowTV Cinema & Shows',
    category: 'All',
    type: 'Stream',
    quality: '1080p Multi-Server',
    audio: 'Multi-Audio',
    currentDomain: 'meowtv.ru',
    candidateDomains: ['meowtv.ru'],
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Multi-source movie and shows mirror',
    sortOrder: 25
  },
  {
    id: 'yts',
    name: 'YTS Cinema DL',
    category: 'Movie',
    type: 'Download',
    quality: '1080p BluRay / 4K',
    audio: 'English 5.1 Dolby',
    currentDomain: 'yts.rs',
    candidateDomains: ['yts.rs', 'yts.mx', 'yts.lt'],
    searchTemplate: 'https://{domain}/browse-movies/{query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'High-speed verified YIFY mirror',
    sortOrder: 26
  },
  {
    id: 'hdhub4u',
    name: 'HDHub4u Cinema & Series DL',
    category: 'All',
    type: 'Download',
    quality: '1080p / 4K UHD',
    audio: 'Dual Audio & Multi-Quality',
    currentDomain: 'hdhub4u.bi',
    candidateDomains: ['hdhub4u.bi', 'hdhub4u.ms', 'hdhub4u.tv', 'hdhub4u.guru'],
    searchTemplate: 'https://{domain}/?s={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .bi domain for fast direct downloads',
    sortOrder: 27
  },
  {
    id: 'pahe',
    name: 'Pahe Direct DL',
    category: 'All',
    type: 'Download',
    quality: '1080p BluRay x265',
    audio: 'English 5.1 Multi-Sub',
    currentDomain: 'pahe.ink',
    candidateDomains: ['pahe.ink', 'pahe.li', 'pahe.ph'],
    searchTemplate: 'https://{domain}/?s={query}',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Pahe.ink active download indexer',
    sortOrder: 28
  },
  {
    id: '1337x',
    name: '1337x Torrents DL',
    category: 'All',
    type: 'Download',
    quality: '1080p Multi-Group',
    audio: 'Dual Audio 5.1',
    currentDomain: '1337x.ws',
    candidateDomains: ['1337x.ws', '1337x.to', '1337x.st', '1337x.so'],
    searchTemplate: 'https://{domain}/sort-search/{query}/seeders/desc/1/',
    episodeTemplate: 'https://{domain}/sort-search/{query}+s{season_pad}e{episode_pad}/seeders/desc/1/',
    directUrlTemplate: 'https://{domain}/',
    statusNote: 'Active .ws mirror sorted by seeders',
    sortOrder: 29
  },
  {
    id: 'mwsguy',
    name: 'MWSGuy Bulk Season Zip DL',
    category: 'All',
    type: 'Download',
    quality: '1080p Bulk Season Zip',
    audio: 'Dual Audio & Multi-Sub',
    currentDomain: 'v1-mwsguy.blogspot.com',
    candidateDomains: ['v1-mwsguy.blogspot.com'],
    searchTemplate: 'https://{domain}/p/search.html#{slug}',
    episodeTemplate: 'https://{domain}/p/search.html#{slug}-season-{season}',
    directUrlTemplate: 'https://{domain}/p/search.html',
    statusNote: 'Free bulk season zip & full batch downloads for series, anime & movies',
    sortOrder: 30
  }
];

/**
 * Generates direct streaming & download mirror links dynamically using the current active mirror registry
 * Supports title-level as well as granular episode-level links with {season} and {episode} interpolation.
 */
export function generateDefaultMirrors(media = {}, registry = DEFAULT_MIRROR_REGISTRY, options = {}) {
  if (!media || !media.title) return [];
  const title = media.title;
  const slug = encodeURIComponent(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
  const encTitle = encodeURIComponent(title);
  const mediaType = media.mediaType || 'Anime';
  const isMovie = mediaType === 'Movie' || media.isMovie || media.format === 'Movie';

  const seasonNumber = options.seasonNumber != null ? Number(options.seasonNumber) : null;
  const episodeNumber = options.episodeNumber != null ? Number(options.episodeNumber) : null;
  const isEpisode = episodeNumber != null;
  const seasonPad = seasonNumber != null ? String(seasonNumber).padStart(2, '0') : '01';
  const epPad = episodeNumber != null ? String(episodeNumber).padStart(2, '0') : '01';

  // Construct episode search query string (e.g. "Attack on Titan 01" or "Breaking Bad S01E01")
  let epQuery = encTitle;
  if (isEpisode) {
    if (mediaType === 'Anime') {
      epQuery = encodeURIComponent(`${title} ${episodeNumber}`);
    } else {
      epQuery = encodeURIComponent(`${title} S${seasonPad}E${epPad}`);
    }
  }

  return registry
    .filter((item) => {
      if (item.isEnabled === false || item.is_enabled === 0) return false;
      if (item.category === 'All') return true;
      if (mediaType === 'Anime') return item.category === 'Anime';
      if (isMovie) return item.category === 'Movie' || item.category === 'All';
      return item.category === 'Series' || item.category === 'All';
    })
    .sort((a, b) => (a.sortOrder || a.sort_order || 0) - (b.sortOrder || b.sort_order || 0))
    .map((item) => {
      const domain = item.currentDomain || item.current_domain || 'example.com';
      let template = item.searchTemplate || item.search_template || 'https://{domain}/search?q={query}';

      if (isEpisode && (item.episodeTemplate || item.episode_template)) {
        template = item.episodeTemplate || item.episode_template;
      }

      let url = template
        .replace(/{domain}/g, domain)
        .replace(/{slug}/g, slug)
        .replace(/{season}/g, String(seasonNumber || 1))
        .replace(/{season_pad}/g, seasonPad)
        .replace(/{episode}/g, String(episodeNumber || 1))
        .replace(/{episode_pad}/g, epPad);

      if (url.includes('{query}')) {
        const queryToUse = (isEpisode && !template.includes('{episode}')) ? epQuery : encTitle;
        url = url.replace(/{query}/g, queryToUse);
      }

      const idPrefix = item.id || 'mirror';
      const epSuffix = isEpisode ? `_s${seasonNumber || 1}_e${episodeNumber}` : '';
      return {
        id: `mirror_${idPrefix}_${slug || 'item'}${epSuffix}`,
        sourceId: item.id,
        sourceName: item.name,
        url,
        domain,
        type: item.type,
        quality: item.quality || '1080p HD',
        audio: item.audio || 'Multi-Audio',
        isSafe: true,
        verified: item.status !== 'Offline',
        isWorking: item.status !== 'Offline',
        status: item.status || 'Working',
        latencyMs: item.latencyMs || item.latency_ms || 0,
        lastCheckedAt: item.lastCheckedAt || item.last_checked_at || null,
        statusNote: item.statusNote || item.status_note || `Active domain: ${domain}`,
        isEpisodeLink: isEpisode,
        seasonNumber: seasonNumber || null,
        episodeNumber: episodeNumber || null
      };
    });
}

/**
 * Check if a title or record represents a standalone separate season entry
 * (e.g. "Attack on Titan Season 2", "Jujutsu Kaisen Season 2", "Mob Psycho 100 II")
 */
export function isStandaloneSeasonRecord(media) {
  if (!media) return false;
  const isMovie = media.mediaType === 'Movie' || media.format === 'Movie' || media.isMovie;
  if (isMovie) return false;
  if (media.isSeparateSeason || media.seasonRecord) return true;
  const title = (media.title || '').trim();
  return /(?:\bSeason\s*[2-9]|\bSeason\s*\d{2,}|\b[2-9]\d*(?:st|nd|rd|th)\s*Season|\bFinal\s*Season|\bSeason\s*Final|\bPart\s*[2-9]|\bCour\s*[2-9]|\bS[2-9]\b|\b(?:II|III|IV|V|VI)\b)/i.test(title);
}

/**
 * Determine if season count badges or steppers should be rendered for this record.
 * Returns false for movies, standalone season records, and single-season shows.
 */
export function shouldDisplaySeasonCount(media) {
  if (!media) return false;
  const isMovie = media.mediaType === 'Movie' || media.format === 'Movie' || media.isMovie;
  if (isMovie) return false;
  if (isStandaloneSeasonRecord(media)) return false;
  const total = media.totalSeasons;
  return Boolean(total && total > 1);
}


