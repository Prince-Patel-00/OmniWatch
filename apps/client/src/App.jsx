import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import FilterBar from './components/FilterBar.jsx';
import MediaCard from './components/MediaCard.jsx';
import MediaDetailModal from './components/MediaDetailModal.jsx';
import TrailerModal from './components/TrailerModal.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import BackupModal from './components/BackupModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import Toast from './components/Toast.jsx';
import Pagination from './components/Pagination.jsx';

import {
  getTrendingMedia,
  getUpcomingMedia,
  searchGlobalMedia,
  getMediaDetail,
  refreshMediaDetail,
  getCatalog,
  getCatalogStats,
  saveToCatalog,
  updateCatalogItem,
  deleteFromCatalog,
  toggleEpisodeProgress,
  batchSeasonProgress,
  updateSeasonsCompleted,
  getSystemStatus,
  getMe,
  logout,
  getStoredUser
} from './services/api.js';
import { normalizeTitle } from '@omniwatch/shared';

export default function App() {
  // Navigation View: 'global' | 'want_to_watch' | 'catalog' | 'stats' (persisted in localStorage / URL)
  const [currentView, setCurrentView] = useState(() => {
    try {
      const urlTab = new URLSearchParams(window.location.search).get('view');
      if (urlTab && ['global', 'want_to_watch', 'catalog', 'stats'].includes(urlTab)) return urlTab;
      const saved = localStorage.getItem('omniwatch_view');
      if (saved && ['global', 'want_to_watch', 'catalog', 'stats'].includes(saved)) return saved;
    } catch (e) {}
    return 'global';
  });
  const [globalTab, setGlobalTab] = useState('trending'); // 'trending' | 'upcoming'

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCharacter, setActiveCharacter] = useState('');
  const [searchMode, setSearchMode] = useState('all'); // 'all' | 'title' | 'character'
  const [activeType, setActiveType] = useState('All');
  const [animeSubTab, setAnimeSubTab] = useState('All'); // 'All' | 'Series' | 'Movie'
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeSort, setActiveSort] = useState('popularity_desc');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hideInCatalog, setHideInCatalog] = useState(true); // Exclude items with any status in My Catalog from Global

  // Data State - Decoupled to eliminate any async race conditions between Global & Catalog
  const [globalMediaList, setGlobalMediaList] = useState([]);
  const [catalogMediaList, setCatalogMediaList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [hasMore, setHasMore] = useState(false);

  // Request counter to ensure stale async responses never overwrite active view
  const activeRequestIdRef = useRef(0);
  const seenPagesRef = useRef(new Map());

  // Modals & Popups
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [trailerModal, setTrailerModal] = useState({ isOpen: false, videoKey: '', title: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Sync auth state with server on boot
  useEffect(() => {
    getMe().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    refreshCatalogVault();
    loadContent();
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    showToast('Signed out of personal catalog', 'info');
    refreshCatalogVault();
    loadContent();
  };

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Catalog items & stats for fast status lookup across the entire app
  const refreshCatalogVault = useCallback(async () => {
    try {
      const [catRes, statsRes, sysRes] = await Promise.all([
        getCatalog({}),
        getCatalogStats(),
        getSystemStatus()
      ]);
      if (catRes.success) setCatalogItems(catRes.data || []);
      if (statsRes.success) setStats(statsRes.data || null);
      if (sysRes.success) setSystemStatus(sysRes);
    } catch (err) {
      console.error('Error refreshing catalog vault:', err);
    }
  }, []);

  useEffect(() => {
    refreshCatalogVault();
  }, [refreshCatalogVault]);

  // Create lookup dictionary: canonicalId -> catalogItem
  const catalogMap = useMemo(() => {
    const map = new Map();
    for (const item of catalogItems) {
      if (item.canonicalId) map.set(item.canonicalId, item);
      if (item.id) map.set(item.id, item);
    }
    return map;
  }, [catalogItems]);

  // Load Main Content (Global Discovery vs Personal Catalog)
  const loadContent = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    const requestedView = currentView;

    try {
      setLoading(true);
      setError(null);

      const activeAnimeFormat = activeType === 'Anime' ? animeSubTab : 'All';

      // Collect IDs seen on prior pages to strictly eliminate any cross-page duplicates
      const priorIds = [];
      if (currentPage > 1) {
        for (const [p, ids] of seenPagesRef.current.entries()) {
          if (p < currentPage && Array.isArray(ids)) {
            priorIds.push(...ids);
          }
        }
      }
      const excludeIdsParam = priorIds.length > 0 ? priorIds.join(',') : '';

      if (requestedView === 'want_to_watch') {
        const catalogSort = activeSort === 'popularity_desc' 
          ? 'updated_desc' 
          : (activeSort === 'release_desc' ? 'year_desc' : activeSort);

        const res = await getCatalog({
          status: 'Want to Watch',
          type: activeType,
          sort: catalogSort,
          favorite: favoriteOnly,
          search: debouncedSearch,
          character: activeCharacter || (searchMode === 'character' ? debouncedSearch : undefined),
          genre: activeGenre,
          animeFormat: activeAnimeFormat,
          page: currentPage,
          limit: pageSize,
          excludeIds: excludeIdsParam
        });

        if (requestId !== activeRequestIdRef.current) return;
        if (requestedView !== currentView) return;

        if (res.success) {
          setCatalogMediaList(res.data || []);
          setHasMore(Boolean(res.hasMore));
          seenPagesRef.current.set(currentPage, (res.data || []).map((m) => m.id || m.canonicalId).filter(Boolean));
        }
      } else if (requestedView === 'catalog') {
        const catalogSort = activeSort === 'popularity_desc' 
          ? 'updated_desc' 
          : (activeSort === 'release_desc' ? 'year_desc' : activeSort);

        const res = await getCatalog({
          status: activeStatus,
          excludeStatus: activeStatus === 'All' ? 'Want to Watch' : '',
          type: activeType,
          sort: catalogSort,
          favorite: favoriteOnly,
          search: debouncedSearch,
          character: activeCharacter || (searchMode === 'character' ? debouncedSearch : undefined),
          genre: activeGenre,
          animeFormat: activeAnimeFormat,
          page: currentPage,
          limit: pageSize,
          excludeIds: excludeIdsParam
        });

        // Guard against race conditions: ignore if newer request initiated or view switched
        if (requestId !== activeRequestIdRef.current) return;
        if (requestedView !== currentView) return;

        if (res.success) {
          setCatalogMediaList(res.data || []);
          setHasMore(Boolean(res.hasMore));
          seenPagesRef.current.set(currentPage, (res.data || []).map((m) => m.id || m.canonicalId).filter(Boolean));
        }
      } else if (requestedView === 'global') {
        const globalSort = activeSort === 'updated_desc' || activeSort === 'progress_desc'
          ? 'popularity_desc'
          : (activeSort === 'year_desc' ? 'release_desc' : activeSort);

        let res;
        const hasSearch = Boolean(debouncedSearch);
        const hasCharFilter = Boolean(activeCharacter) || (searchMode === 'character' && hasSearch);
        const characterTerm = activeCharacter || (searchMode === 'character' ? debouncedSearch : '');

        if (hasSearch || hasCharFilter) {
          const effectiveSearch = hasSearch ? debouncedSearch : characterTerm;
          res = await searchGlobalMedia(effectiveSearch, {
            type: activeType,
            genre: activeGenre,
            sort: globalSort,
            animeFormat: activeAnimeFormat,
            character: characterTerm,
            searchMode: searchMode,
            mainCharOnly: Boolean(activeCharacter || searchMode === 'character'),
            page: currentPage,
            limit: pageSize,
            excludeIds: excludeIdsParam
          });
        } else if (globalTab === 'upcoming') {
          res = await getUpcomingMedia(activeType, globalSort, activeAnimeFormat, currentPage, pageSize, activeGenre, excludeIdsParam);
        } else {
          res = await getTrendingMedia(activeType, globalSort, activeAnimeFormat, currentPage, pageSize, activeGenre, '', excludeIdsParam);
        }

        // Guard against race conditions: ignore if newer request initiated or view switched
        if (requestId !== activeRequestIdRef.current) return;
        if (requestedView !== currentView) return;

        if (res.success) {
          setGlobalMediaList(res.data || []);
          setHasMore(Boolean(res.hasMore));
          seenPagesRef.current.set(currentPage, (res.data || []).map((m) => m.id || m.canonicalId).filter(Boolean));
        }
      }
    } catch (err) {
      if (requestId === activeRequestIdRef.current) {
        console.error('Failed to load media:', err);
        setError('Unable to reach OmniWatch API server. Please check backend connection.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [currentView, globalTab, debouncedSearch, activeCharacter, searchMode, activeType, animeSubTab, activeStatus, activeGenre, activeSort, favoriteOnly, currentPage, pageSize]);

  // Reset page when search or filters change
  useEffect(() => {
    seenPagesRef.current.clear();
    setCurrentPage(1);
  }, [currentView, globalTab, debouncedSearch, activeCharacter, searchMode, activeType, animeSubTab, activeStatus, activeGenre, activeSort, favoriteOnly, pageSize]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Quick "+1 Ep" Progress Increment directly from MediaCard
  const handleIncrementProgress = async (catalogEntry) => {
    if (!catalogEntry) return;
    const nextEp = (catalogEntry.currentEpisode || 0) + 1;
    const season = catalogEntry.currentSeason || 1;

    const updater = (item) =>
      item.id === catalogEntry.id
        ? {
            ...item,
            currentEpisode: nextEp,
            watchedEpisodes: [
              ...(item.watchedEpisodes || []),
              { seasonNumber: season, episodeNumber: nextEp }
            ]
          }
        : item;

    // Optimistic UI updates
    setCatalogItems((prev) => prev.map(updater));
    setCatalogMediaList((prev) => prev.map(updater));

    try {
      await toggleEpisodeProgress(catalogEntry.id, {
        seasonNumber: season,
        episodeNumber: nextEp,
        isWatched: true
      });
      showToast(`Logged Ep ${nextEp} for "${catalogEntry.title}"`, 'success');
      refreshCatalogVault();
    } catch (err) {
      showToast('Failed to log episode progress', 'error');
      refreshCatalogVault();
    }
  };

  // Favorite toggle from card or detail
  const handleToggleFavorite = async (catalogEntry) => {
    if (!catalogEntry) return;
    const nextFav = !catalogEntry.isFavorite;

    const updater = (item) => (item.id === catalogEntry.id ? { ...item, isFavorite: nextFav } : item);
    // Optimistic update
    setCatalogItems((prev) => prev.map(updater));
    setCatalogMediaList((prev) => prev.map(updater));

    try {
      await updateCatalogItem(catalogEntry.id, { isFavorite: nextFav });
      showToast(nextFav ? 'Saved to favorites' : 'Removed from favorites', 'info');
      refreshCatalogVault();
    } catch (err) {
      showToast('Failed to update favorite', 'error');
      refreshCatalogVault();
    }
  };

  // Save to Catalog from detail modal
  const handleSaveCatalog = async (itemData) => {
    try {
      const res = await saveToCatalog(itemData);
      if (res.success) {
        showToast(`Saved "${itemData.title}" to catalog`, 'success');
        await refreshCatalogVault();
        if (currentView === 'catalog') {
          await loadContent();
        }
        if (selectedMedia && selectedMedia.id === itemData.canonicalId) {
          setSelectedMedia((prev) => ({ ...prev }));
        }
      }
    } catch (err) {
      showToast(`Error saving to catalog: ${err.message}`, 'error');
    }
  };

  // Update Catalog from detail modal
  const handleUpdateCatalog = async (id, updateData) => {
    try {
      const res = await updateCatalogItem(id, updateData);
      if (res.success) {
        await refreshCatalogVault();
        setCatalogMediaList((prev) => prev.map((item) => (item.id === id ? { ...item, ...res.data } : item)));
      }
    } catch (err) {
      showToast(`Error updating item: ${err.message}`, 'error');
    }
  };

  // Delete from Catalog
  const handleDeleteCatalog = async (id) => {
    try {
      const res = await deleteFromCatalog(id);
      if (res.success) {
        await refreshCatalogVault();
        setCatalogMediaList((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      showToast(`Error removing item: ${err.message}`, 'error');
    }
  };

  // Direct Quick Status setter from MediaCard ("Want to Watch" and "Completed")
  const handleQuickSetStatus = async (mediaItem, targetStatus) => {
    try {
      const canonicalId = mediaItem.canonicalId || mediaItem.id;
      const existingEntry = catalogMap.get(canonicalId) || catalogMap.get(mediaItem.id);

      if (existingEntry) {
        // If clicking the same status, toggle back to Not Started (removes from catalog)
        const nextStatus = existingEntry.userStatus === targetStatus ? 'Not Started' : targetStatus;
        if (nextStatus === 'Not Started') {
          await deleteFromCatalog(existingEntry.id);
          showToast(`Removed "${mediaItem.title}" from catalog`, 'info');
          setCatalogMediaList((prev) => prev.filter((m) => m.id !== existingEntry.id));
        } else {
          await updateCatalogItem(existingEntry.id, { userStatus: nextStatus });
          showToast(`Updated "${mediaItem.title}" to "${nextStatus}"`, 'success');
          setCatalogMediaList((prev) =>
            prev.map((m) => (m.id === existingEntry.id ? { ...m, userStatus: nextStatus } : m))
          );
        }
      } else {
        // Save new item directly to catalog with target status
        const res = await saveToCatalog({
          canonicalId,
          title: mediaItem.title,
          mediaType: mediaItem.mediaType,
          format: mediaItem.format || (mediaItem.isMovie ? 'Movie' : 'Series'),
          posterUrl: mediaItem.posterUrl,
          backdropUrl: mediaItem.backdropUrl,
          releaseYear: mediaItem.releaseYear,
          totalEpisodes: mediaItem.totalEpisodes,
          userStatus: targetStatus
        });
        showToast(`Added "${mediaItem.title}" to My Catalog as "${targetStatus}"`, 'success');
        if (res.success && res.data) {
          setCatalogMediaList((prev) => [res.data, ...prev]);
        }
      }

      await refreshCatalogVault();
      if (currentView === 'catalog') {
        await loadContent();
      }
    } catch (err) {
      showToast(`Error updating status: ${err.message}`, 'error');
    }
  };

  // Toggle Episode Watched
  const handleToggleEpisode = async (catalogItemId, { seasonNumber, episodeNumber, isWatched }) => {
    try {
      await toggleEpisodeProgress(catalogItemId, { seasonNumber, episodeNumber, isWatched });
      await refreshCatalogVault();
    } catch (err) {
      showToast('Failed to update episode progress', 'error');
    }
  };

  // Batch Season Progress
  const handleBatchSeason = async (catalogItemId, { seasonNumber, episodeCount, isWatched }) => {
    try {
      await batchSeasonProgress(catalogItemId, { seasonNumber, episodeCount, isWatched });
      showToast(isWatched ? `Marked Season ${seasonNumber} complete` : `Unmarked Season ${seasonNumber}`, 'success');
      await refreshCatalogVault();
    } catch (err) {
      showToast('Failed to batch update season', 'error');
    }
  };

  // Update Seasons Completed Progress & Status
  const handleUpdateSeasonsCompleted = async (catalogItemId, { seasonsCompleted, userStatus, syncEpisodes, currentSeason, totalSeasons }) => {
    try {
      const res = await updateSeasonsCompleted(catalogItemId, {
        seasonsCompleted,
        userStatus,
        syncEpisodes,
        currentSeason,
        totalSeasons
      });

      if (res.success && res.data) {
        setCatalogMediaList((prev) =>
          prev.map((item) => (item.id === catalogItemId ? { ...item, ...res.data } : item))
        );
        if (selectedMedia) {
          setSelectedMedia((prev) => ({ ...prev }));
        }
        await refreshCatalogVault();
      }
    } catch (err) {
      showToast(`Error updating season progress: ${err.message}`, 'error');
    }
  };

  // On-demand refresh of title details
  const handleRefreshMedia = async (canonicalId) => {
    const res = await refreshMediaDetail(canonicalId);
    if (res.success) {
      setSelectedMedia(res.data);
      setGlobalMediaList((prev) => prev.map((m) => (m.id === canonicalId ? res.data : m)));
      setCatalogMediaList((prev) => prev.map((m) => (m.canonicalId === canonicalId || m.id === canonicalId ? { ...m, ...res.data } : m)));
    }
    return res;
  };

  // Open Media Detail Modal (with fresh detail fetch if needed)
  const handleOpenDetail = async (mediaItem) => {
    setSelectedMedia(mediaItem);
    try {
      const detailRes = await getMediaDetail(mediaItem.id || mediaItem.canonicalId);
      if (detailRes.success && detailRes.data) {
        setSelectedMedia(detailRes.data);
      }
    } catch (e) {
      console.warn('Could not fetch enhanced detail:', e);
    }
  };

  // Watch Trailer
  const handleWatchTrailer = (videoKey, title) => {
    if (!videoKey) {
      showToast('No official trailer video available.', 'info');
      return;
    }
    setTrailerModal({ isOpen: true, videoKey, title });
  };

  // Character selection handlers
  const handleSelectCharacter = useCallback((charName) => {
    if (!charName) {
      setActiveCharacter('');
      return;
    }
    setActiveCharacter(charName);
    if (currentView === 'stats') {
      setCurrentView('global');
    }
    setCurrentPage(1);
    showToast(`Filtering by lead character: "${charName}"`, 'info');
  }, [currentView]);

  const handleClearCharacter = useCallback(() => {
    setActiveCharacter('');
    setCurrentPage(1);
  }, []);

  // Reset Filters
  const handleResetFilters = (targetView) => {
    const v = targetView || currentView;
    setActiveType('All');
    setAnimeSubTab('All');
    setActiveStatus('All');
    setActiveGenre('All');
    setActiveSort(v === 'catalog' ? 'updated_desc' : 'popularity_desc');
    setFavoriteOnly(false);
    setSearchQuery('');
    setActiveCharacter('');
    setSearchMode('all');
    setCurrentPage(1);
  };

  // Filter out any titles that already have a status in My Catalog when in Global view
  const { uncatalogedMedia, hiddenCount } = useMemo(() => {
    if (currentView !== 'global') {
      return { uncatalogedMedia: [], hiddenCount: 0 };
    }

    const uncataloged = [];
    let hidden = 0;

    for (const m of globalMediaList) {
      // Sub-tab filter when Anime is active
      if (activeType === 'Anime' && animeSubTab !== 'All') {
        const isMovie = m.mediaType === 'Movie' || m.format === 'Movie' || m.isMovie;
        const matches = animeSubTab === 'Movie' ? isMovie : !isMovie;
        if (!matches) continue;
      }

      // Genre filter check
      if (activeGenre !== 'All') {
        const gLower = activeGenre.toLowerCase();
        const hasGenre = (Array.isArray(m.genres) && m.genres.some((g) => g.toLowerCase().includes(gLower) || gLower.includes(g.toLowerCase()))) ||
          (m.synopsis && m.synopsis.toLowerCase().includes(gLower));
        if (!hasGenre) continue;
      }

      const normTitle = normalizeTitle(m.title);
      const isAlreadyInCatalog =
        catalogMap.has(m.id) ||
        (m.canonicalId && catalogMap.has(m.canonicalId)) ||
        catalogItems.some((c) => {
          if (c.canonicalId && (c.canonicalId === m.id || c.canonicalId === m.canonicalId)) return true;
          return normalizeTitle(c.title) === normTitle;
        });

      if (isAlreadyInCatalog && hideInCatalog) {
        hidden++;
      } else {
        uncataloged.push(m);
      }
    }

    return { uncatalogedMedia: uncataloged, hiddenCount: hidden };
  }, [currentView, globalMediaList, catalogMap, catalogItems, hideInCatalog, activeType, animeSubTab, activeGenre]);

  // Display items (strictly adheres to view, activeType, animeSubTab, activeGenre, activeSort)
  const displayItems = useMemo(() => {
    let list;
    if (currentView === 'want_to_watch') {
      list = catalogMediaList.filter((item) => {
        const canonicalId = item.canonicalId || item.id;
        const entry = catalogMap.get(canonicalId);
        const status = item.userStatus || entry?.userStatus;
        return status === 'Want to Watch';
      });
    } else if (currentView === 'catalog') {
      list = catalogMediaList.filter((item) => {
        const canonicalId = item.canonicalId || item.id;
        const entry = catalogMap.get(canonicalId);
        const status = item.userStatus || entry?.userStatus;
        return Boolean(status) && status !== 'Want to Watch';
      });
    } else {
      list = uncatalogedMedia;
    }

    // Safeguard: Ensure 100% distinct records per page and eliminate any prior page items
    const priorSeenIds = new Set();
    if (currentPage > 1) {
      for (const [p, ids] of seenPagesRef.current.entries()) {
        if (p < currentPage && Array.isArray(ids)) {
          ids.forEach((id) => priorSeenIds.add(id));
        }
      }
    }

    const seenCurrentPageIds = new Set();
    list = list.filter((m) => {
      const uniqueId = m.id || m.canonicalId;
      if (!uniqueId) return false;
      if (currentPage > 1 && priorSeenIds.has(uniqueId)) return false;
      if (seenCurrentPageIds.has(uniqueId)) return false;
      seenCurrentPageIds.add(uniqueId);
      return true;
    });

    // Client-side filter by type
    if (activeType !== 'All') {
      list = list.filter((m) => {
        if (activeType === 'Anime') {
          return m.mediaType === 'Anime' || m.id?.startsWith('omni_ani_') || m.id?.startsWith('omni_kitsu_');
        }
        return m.mediaType === activeType;
      });
    }

    // Client-side filter by Anime sub-tab
    if (activeType === 'Anime' && animeSubTab !== 'All') {
      list = list.filter((m) => {
        const isMovie = m.mediaType === 'Movie' || m.format === 'Movie' || m.isMovie;
        return animeSubTab === 'Movie' ? isMovie : !isMovie;
      });
    }

    // Client-side filter by Genre
    if (activeGenre !== 'All') {
      const gLower = activeGenre.toLowerCase();
      list = list.filter((m) => {
        if (Array.isArray(m.genres) && m.genres.some((g) => g.toLowerCase().includes(gLower) || gLower.includes(g.toLowerCase()))) {
          return true;
        }
        if (m.synopsis && m.synopsis.toLowerCase().includes(gLower)) return true;
        return false;
      });
    }

    // Client-side filter by lead character or actor if active
    if (activeCharacter) {
      const charLower = activeCharacter.toLowerCase();
      list = list.filter((m) => {
        if (m.matchedPerson && (m.matchedPerson.name || '').toLowerCase().includes(charLower)) return true;
        if (m.matchedCharacter && (m.matchedCharacter.name || '').toLowerCase().includes(charLower)) return true;
        const inMain = Array.isArray(m.mainCharacters) && m.mainCharacters.some((c) =>
          (typeof c === 'string' ? c : (c.name || c.character || c.actor || '')).toLowerCase().includes(charLower)
        );
        if (inMain) return true;
        const inCast = Array.isArray(m.cast) && m.cast.some((c) => {
          const charName = (c.character || c.name || '').toLowerCase();
          const actorName = (c.actor || '').toLowerCase();
          return charName.includes(charLower) || actorName.includes(charLower);
        });
        if (inCast) return true;
        if (m.title && m.title.toLowerCase().includes(charLower)) return true;
        if (m.synopsis && m.synopsis.toLowerCase().includes(charLower)) return true;
        return false;
      });
    }

    // Client-side filter by catalog status if in catalog view
    if (currentView === 'catalog' && activeStatus !== 'All') {
      if (activeStatus === 'Rewatching') {
        list = list.filter((m) => m.userStatus === 'Rewatching' || Boolean(m.isRewatching));
      } else {
        list = list.filter((m) => m.userStatus === activeStatus);
      }
    }

    // Client-side filter by favorites if in catalog view
    if (currentView === 'catalog' && favoriteOnly) {
      list = list.filter((m) => Boolean(m.isFavorite));
    }

    // Client-side deterministic sorting
    const sorted = [...list];
    switch (activeSort) {
      case 'rating_desc':
        sorted.sort((a, b) => {
          const rA = a.userRating ?? a.rating ?? 0;
          const rB = b.userRating ?? b.rating ?? 0;
          return rB - rA;
        });
        break;
      case 'release_desc':
      case 'year_desc':
        sorted.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
        break;
      case 'title_asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'progress_desc':
        sorted.sort((a, b) => (b.currentEpisode || 0) - (a.currentEpisode || 0));
        break;
      case 'updated_desc':
        sorted.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        break;
      case 'popularity_desc':
      default:
        if (currentView === 'catalog') {
          sorted.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        } else {
          sorted.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
        }
        break;
    }

    return sorted;
  }, [currentView, uncatalogedMedia, catalogMediaList, catalogMap, spotlightMedia, debouncedSearch, activeCharacter, currentPage, activeType, animeSubTab, activeGenre, activeStatus, favoriteOnly, activeSort]);

  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    handleResetFilters(nextView);
    try {
      localStorage.setItem('omniwatch_view', nextView);
      const url = new URL(window.location);
      url.searchParams.set('view', nextView);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val && currentView === 'stats') {
      handleViewChange('global');
    }
  };

  const wantToWatchCount = stats?.byStatus?.['Want to Watch'] ?? catalogItems.filter(i => i.userStatus === 'Want to Watch').length;
  const catalogCount = Math.max(0, (stats?.totalItems ?? catalogItems.length) - wantToWatchCount);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      
      {/* Top Universal Navbar */}
      <Navbar
        currentView={currentView}
        onViewChange={handleViewChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        activeCharacter={activeCharacter}
        onClearCharacter={handleClearCharacter}
        catalogCount={catalogCount}
        wantToWatchCount={wantToWatchCount}
        watchingCount={stats?.byStatus?.['Watching'] || 0}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* VIEW 1: INSIGHTS & ANALYTICS */}
        {currentView === 'stats' ? (
          <StatsDashboard
            stats={stats}
            onNavigateToCatalog={(status, type) => {
              if (status === 'Want to Watch') {
                handleViewChange('want_to_watch');
              } else {
                handleViewChange('catalog');
                if (status) setActiveStatus(status);
              }
              setActiveSort('updated_desc');
              if (type) setActiveType(type);
            }}
            onNavigateToGlobal={() => {
              handleViewChange('global');
            }}
          />
        ) : (
          <>
            {/* Filter Bar */}
            <FilterBar
              currentView={currentView}
              activeType={activeType}
              onTypeSelect={(type) => {
                setActiveType(type);
                if (type !== 'Anime') setAnimeSubTab('All');
              }}
              animeSubTab={animeSubTab}
              onAnimeSubTabChange={setAnimeSubTab}
              activeStatus={activeStatus}
              onStatusSelect={setActiveStatus}
              activeGenre={activeGenre}
              onGenreSelect={setActiveGenre}
              activeSort={activeSort}
              onSortSelect={setActiveSort}
              activeCharacter={activeCharacter}
              onCharacterSelect={handleSelectCharacter}
              favoriteOnly={favoriteOnly}
              onToggleFavorite={() => setFavoriteOnly(!favoriteOnly)}
              onResetFilters={handleResetFilters}
              resultCount={currentView === 'global' ? displayItems.length + (spotlightMedia ? 1 : 0) : displayItems.length}
              globalTab={globalTab}
              onGlobalTabChange={setGlobalTab}
              hideInCatalog={hideInCatalog}
              onToggleHideInCatalog={() => setHideInCatalog(!hideInCatalog)}
              hiddenCount={hiddenCount}
              totalSavedCount={catalogItems.length}
            />

            {/* Error Banner */}
            {error && (
              <div className="p-4 mb-6 rounded-2xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs text-center font-medium">
                {error}
              </div>
            )}

            {/* Media Grid / Empty State */}
            {loading ? (
              /* Skeleton Loader */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-2xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden animate-pulse aspect-[2/3.4]"
                  >
                    <div className="aspect-[2/3] bg-zinc-800/50 w-full" />
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-end">
                      <div className="h-3 bg-zinc-800 rounded w-3/4" />
                      <div className="h-2.5 bg-zinc-800/60 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayItems.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                  {displayItems.map((item) => {
                    const canonicalId = item.canonicalId || item.id;
                    const catEntry = catalogMap.get(canonicalId) || (currentView === 'catalog' || currentView === 'want_to_watch' ? item : null);

                    return (
                      <MediaCard
                        key={item.id || canonicalId}
                        media={item}
                        catalogEntry={catEntry}
                        onClick={() => handleOpenDetail(item)}
                        onIncrementProgress={handleIncrementProgress}
                        onToggleFavorite={handleToggleFavorite}
                        onQuickSetStatus={handleQuickSetStatus}
                        onSelectCharacter={handleSelectCharacter}
                      />
                    );
                  })}
                </div>

                {/* Bottom Pagination Control */}
                {displayItems.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    hasMore={hasMore}
                    pageSize={pageSize}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    totalCount={currentView === 'catalog' ? catalogCount : (currentView === 'want_to_watch' ? wantToWatchCount : null)}
                    isLoading={loading}
                  />
                )}
              </>
            ) : (
              /* Empty State */
              <div className="p-12 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800/60 space-y-4 my-8">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500 border border-zinc-800 text-2xl">
                  {activeCharacter ? '👤' : (currentView === 'want_to_watch' ? '🔖' : (currentView === 'catalog' ? '📚' : '🔍'))}
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">
                    {activeCharacter
                      ? `No titles found starring "${activeCharacter}"`
                      : (currentView === 'want_to_watch'
                        ? 'No titles currently in your "Want to Watch" list.'
                        : (currentView === 'catalog'
                          ? 'No titles found in your personal catalog.'
                          : 'No media found matching your search or filters.'))}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                    {activeCharacter
                      ? 'Try searching for another iconic lead character or clear this character filter.'
                      : (currentView === 'want_to_watch'
                        ? 'Browse Global Discovery to bookmark movies, anime, and series you want to watch next!'
                        : (currentView === 'catalog'
                          ? 'Head over to Global discovery to explore trending anime, movies, and series, and add them to your watchlist!'
                          : 'Try broadening your search query or switching category filters.'))}
                  </p>
                </div>

                {activeCharacter && (
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-xs text-zinc-500">Try popular leads & actors:</span>
                    {['Andrew Garfield', 'Spider-Man', 'Walter White', 'Cillian Murphy', 'Luffy'].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleSelectCharacter(c)}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800/80 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-zinc-700/60 hover:border-red-500/40 transition-all"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                  {activeCharacter && (
                    <button
                      onClick={handleClearCharacter}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow-lg shadow-red-950/60"
                    >
                      Clear Character Filter
                    </button>
                  )}
                  {currentPage > 1 && (
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs sm:text-sm border border-zinc-700 transition-all hover:scale-105 active:scale-95"
                    >
                      ← Return to Page 1
                    </button>
                  )}
                  {currentView === 'catalog' ? (
                    <button
                      onClick={() => setCurrentView('global')}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-950/60 transition-all hover:scale-105 active:scale-95"
                    >
                      Explore Global Discovery
                    </button>
                  ) : (
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <p>OmniWatch Hub 2.0 • Personal Entertainment Archive • Legitimate & Official Availability</p>
      </footer>

      {/* Modals */}
      {selectedMedia && (
        <MediaDetailModal
          media={selectedMedia}
          catalogEntry={catalogMap.get(selectedMedia.id) || catalogMap.get(selectedMedia.canonicalId)}
          onClose={() => setSelectedMedia(null)}
          onSaveCatalog={handleSaveCatalog}
          onUpdateCatalog={handleUpdateCatalog}
          onDeleteCatalog={handleDeleteCatalog}
          onToggleEpisode={handleToggleEpisode}
          onBatchSeason={handleBatchSeason}
          onUpdateSeasonsCompleted={handleUpdateSeasonsCompleted}
          onRefreshMedia={handleRefreshMedia}
          onWatchTrailer={handleWatchTrailer}
          onSelectRelated={handleOpenDetail}
          onShowToast={showToast}
          onSelectCharacter={(charName) => {
            setSelectedMedia(null);
            handleSelectCharacter(charName);
          }}
        />
      )}

      {trailerModal.isOpen && (
        <TrailerModal
          isOpen={trailerModal.isOpen}
          videoKey={trailerModal.videoKey}
          title={trailerModal.title}
          onClose={() => setTrailerModal({ isOpen: false, videoKey: '', title: '' })}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          systemStatus={systemStatus}
        />
      )}

      {backupOpen && (
        <BackupModal
          isOpen={backupOpen}
          onClose={() => setBackupOpen(false)}
          onRefreshData={refreshCatalogVault}
          onShowToast={showToast}
        />
      )}

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast toast={toast} onClose={() => setToast(null)} />
      )}

    </div>
  );
}
