import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Star,
  Calendar,
  Clock,
  Plus,
  Minus,
  Check,
  Heart,
  ExternalLink,
  RotateCw,
  Tv,
  Film,
  Sparkles,
  BookmarkCheck,
  Trash2,
  Globe,
  Tag,
  ChevronRight,
  Copy,
  Download,
  ShieldCheck,
  Radio,
  User
} from 'lucide-react';
import EpisodeGuide from './EpisodeGuide.jsx';
import {
  USER_WATCH_STATUSES_LIST,
  POPULAR_REGIONS,
  formatTimeUntil,
  getPlatformLogo,
  generateDefaultMirrors,
  DEFAULT_MIRROR_REGISTRY,
  QUALITIES,
  SOURCE_TYPES,
  shouldDisplaySeasonCount,
  isStandaloneSeasonRecord
} from '@omniwatch/shared';
import { addMediaSource, deleteMediaSource, checkMirrorsHealth, getMediaDetail } from '../services/api.js';

// Safe YouTube video key regex
const YOUTUBE_KEY_REGEX = /^[a-zA-Z0-9_-]{6,15}$/;

export default function MediaDetailModal({
  media,
  catalogEntry = null,
  onClose,
  onSaveCatalog,
  onUpdateCatalog,
  onDeleteCatalog,
  onToggleEpisode,
  onBatchSeason,
  onUpdateSeasonsCompleted,
  onRefreshMedia,
  onWatchTrailer,
  onSelectRelated,
  onShowToast,
  onSelectCharacter
}) {
  // Default to 'sources' tab so streaming mirrors appear immediately as requested
  const [activeTab, setActiveTab] = useState('sources'); // 'sources' | 'episodes' | 'overview' | 'watch' | 'trailers'
  const [selectedRegion, setSelectedRegion] = useState('US');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingDomains, setIsCheckingDomains] = useState(false);
  const [notesInput, setNotesInput] = useState(catalogEntry?.notes || '');
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [syncEpisodesWithSeasons, setSyncEpisodesWithSeasons] = useState(true);

  // Helper to merge fresh verified default mirrors with any saved custom mirrors
  const getMergedSources = (m) => {
    if (!m || !m.title) return [];
    // If backend already resolved sources using the dynamic SQLite registry, use them!
    const backendSources = (m.sources || []).filter(s => s && s.url);
    if (backendSources.length > 0) return backendSources;

    const defaults = generateDefaultMirrors(m);
    const existing = m.sources || [];
    const customSources = existing.filter((s) => s && s.id && !s.id.startsWith('mirror_'));
    return [...defaults, ...customSources];
  };

  // Dynamic Mirror Registry State
  const [mirrorRegistry, setMirrorRegistry] = useState(DEFAULT_MIRROR_REGISTRY);

  // Streaming & Download Mirrors State
  const [sourceFilter, setSourceFilter] = useState('All'); // 'All' | 'Stream' | 'Download'
  const [sourcesList, setSourcesList] = useState(() => getMergedSources(media));
  const [copiedSourceId, setCopiedSourceId] = useState(null);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceForm, setNewSourceForm] = useState({
    sourceName: '',
    url: '',
    type: 'Stream',
    quality: '1080p WebRip',
    audio: media?.mediaType === 'Anime' ? 'Japanese (Multi-Sub)' : 'English 5.1'
  });

  // Handler to live verify all mirror domains on demand
  const handleLiveCheckDomains = async () => {
    setIsCheckingDomains(true);
    try {
      const res = await checkMirrorsHealth();
      if (res && res.data) {
        setMirrorRegistry(res.data);
        if (typeof onRefreshMedia === 'function') {
          await onRefreshMedia();
        } else if (media?.id) {
          try {
            const freshMedia = await getMediaDetail(media.id);
            if (freshMedia && freshMedia.media) {
              setSourcesList(getMergedSources(freshMedia.media));
            }
          } catch (e) {
            const updated = generateDefaultMirrors(media, res.data);
            const customSources = (sourcesList || []).filter(s => s && s.id && !s.id.startsWith('mirror_'));
            setSourcesList([...updated, ...customSources]);
          }
        }
        if (onShowToast) {
          const sum = res.summary || {};
          const msg = `⚡ Verified domains! ${sum.working || res.data.length} working${sum.migrated ? `, ${sum.migrated} auto-migrated` : ''}${sum.offline ? `, ${sum.offline} offline` : ''}`;
          onShowToast(msg);
        }
      }
    } catch (err) {
      if (onShowToast) onShowToast(`Failed to check domains: ${err.message}`, 'error');
    } finally {
      setIsCheckingDomains(false);
    }
  };

  // Sync sources when media prop changes
  useEffect(() => {
    if (media) {
      setSourcesList(getMergedSources(media));
    }
  }, [media]);

  // Sync notes when catalogEntry changes
  useEffect(() => {
    if (catalogEntry?.notes !== undefined) {
      setNotesInput(catalogEntry.notes || '');
    }
  }, [catalogEntry]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  const isMovie = media.mediaType === 'Movie' || media.format === 'Movie' || media.isMovie;
  const isEpisodic = !isMovie && (media.mediaType === 'Anime' || media.mediaType === 'Series');
  const isStandaloneSeason = isStandaloneSeasonRecord(media);
  const shouldShowSeasonHub = shouldDisplaySeasonCount(media);
  const timeUntilAiring = media.nextAiringAt ? formatTimeUntil(media.nextAiringAt) : null;
  const isAiring = media.status === 'Airing';

  // Franchise relations for anime / series installments
  const franchisePrequels = (media.relatedMedia || []).filter((r) => r.relationType === 'PREQUEL');
  const franchiseSequels = (media.relatedMedia || []).filter((r) => r.relationType === 'SEQUEL');
  const hasFranchiseSeasons = franchisePrequels.length > 0 || franchiseSequels.length > 0;

  // Filter watch providers by selected region (or Global)
  const availableProviders = (media.watchProviders || []).filter(
    (wp) => wp.region === selectedRegion || wp.region === 'Global' || wp.region === 'US'
  );

  const flatrateProviders = availableProviders.filter((wp) => wp.type === 'FLATRATE');
  const rentProviders = availableProviders.filter((wp) => wp.type === 'RENT');
  const buyProviders = availableProviders.filter((wp) => wp.type === 'BUY');
  const freeProviders = availableProviders.filter((wp) => wp.type === 'FREE');

  // Handle watch status change (with Not Started default / unsaved handling)
  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Not Started') {
      if (catalogEntry && onDeleteCatalog) {
        await onDeleteCatalog(catalogEntry.id);
        onShowToast?.(`Removed "${media.title}" from catalog (Status: Not Started)`, 'info');
      }
      return;
    }

    if (!catalogEntry) {
      await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        format: media.format || (media.isMovie ? 'Movie' : 'Series'),
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        releaseYear: media.releaseYear,
        userStatus: newStatus,
        isRewatching: newStatus === 'Rewatching',
        totalEpisodes: media.totalEpisodes
      });
      onShowToast?.(`Added "${media.title}" to catalog as "${newStatus}"`, 'success');
    } else {
      const updatePayload = { userStatus: newStatus };
      if (newStatus === 'Rewatching') {
        updatePayload.isRewatching = true;
      }
      await onUpdateCatalog(catalogEntry.id, updatePayload);
      onShowToast?.(`Watch status updated to "${newStatus}"`, 'success');
    }
  };

  // Handle rewatching extra toggle (usable on top of Completed or any other status)
  const handleToggleRewatching = async () => {
    if (catalogEntry) {
      const nextRewatching = !catalogEntry.isRewatching;
      await onUpdateCatalog(catalogEntry.id, { isRewatching: nextRewatching });
      onShowToast?.(nextRewatching ? 'Marked as Rewatching' : 'Removed Rewatching status', 'info');
    } else {
      await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        format: media.format || (media.isMovie ? 'Movie' : 'Series'),
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        releaseYear: media.releaseYear,
        userStatus: 'Rewatching',
        isRewatching: true,
        totalEpisodes: media.totalEpisodes
      });
      onShowToast?.(`Added "${media.title}" to catalog as Rewatching`, 'success');
    }
  };

  // Handle rating change
  const handleRatingChange = async (ratingVal) => {
    const finalRating = catalogEntry?.userRating === ratingVal ? null : ratingVal;
    if (catalogEntry) {
      await onUpdateCatalog(catalogEntry.id, { userRating: finalRating });
      onShowToast?.(`Rated ${finalRating ? `${finalRating}/10` : 'cleared'}`, 'success');
    } else {
      await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        userRating: finalRating,
        userStatus: 'Want to Watch',
        totalEpisodes: media.totalEpisodes
      });
      onShowToast?.(`Saved & rated ${finalRating}/10`, 'success');
    }
  };

  // Handle favorite toggle
  const handleToggleFavorite = async () => {
    if (catalogEntry) {
      const nextFav = !catalogEntry.isFavorite;
      await onUpdateCatalog(catalogEntry.id, { isFavorite: nextFav });
      onShowToast?.(nextFav ? 'Added to favorites' : 'Removed from favorites', 'info');
    } else {
      await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        isFavorite: true,
        userStatus: 'Want to Watch',
        totalEpisodes: media.totalEpisodes
      });
      onShowToast?.('Added to catalog & favorites', 'success');
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (catalogEntry) {
      await onUpdateCatalog(catalogEntry.id, { notes: notesInput });
      setShowNotesEditor(false);
      onShowToast?.('Personal notes saved', 'success');
    }
  };

  // Frictionless Episode checkmark: if title not yet in catalog, add as Watching and check off
  const handleEpisodeToggleFrictionless = async (sNum, epNum, watched) => {
    if (catalogEntry) {
      await onToggleEpisode(catalogEntry.id, { seasonNumber: sNum, episodeNumber: epNum, isWatched: watched });
      onShowToast?.(`Episode ${epNum} ${watched ? 'marked watched' : 'unmarked'}`, 'success');
    } else {
      // Auto-add to catalog as Watching
      const res = await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        releaseYear: media.releaseYear,
        userStatus: 'Watching',
        currentSeason: sNum,
        currentEpisode: epNum,
        totalEpisodes: media.totalEpisodes
      });
      onShowToast?.(`Added "${media.title}" to Watching and logged Ep ${epNum}`, 'success');
    }
  };

  // Season Completion & Granular Status Handler
  const totalSeasonsCount = Math.max(
    1,
    media?.totalSeasons || media?.seasons?.length || catalogEntry?.totalSeasons || 1
  );
  const seasonsCompleted = catalogEntry?.seasonsCompleted ?? 0;

  const handleUpdateSeasons = async (newCompletedCount, targetStatus = null) => {
    const clampedCount = Math.max(0, Math.min(totalSeasonsCount, newCompletedCount));
    let finalStatus = targetStatus;

    if (!finalStatus) {
      if (clampedCount >= totalSeasonsCount) {
        finalStatus = 'Completed';
      } else if (clampedCount > 0) {
        finalStatus = catalogEntry?.userStatus || 'Watching';
      } else {
        finalStatus = catalogEntry?.userStatus || 'Want to Watch';
      }
    }

    const nextSeasonNum = clampedCount < totalSeasonsCount ? clampedCount + 1 : totalSeasonsCount;

    if (catalogEntry) {
      if (typeof onUpdateSeasonsCompleted === 'function') {
        await onUpdateSeasonsCompleted(catalogEntry.id, {
          seasonsCompleted: clampedCount,
          userStatus: finalStatus,
          syncEpisodes: syncEpisodesWithSeasons,
          currentSeason: nextSeasonNum,
          totalSeasons: totalSeasonsCount
        });
      } else {
        await onUpdateCatalog(catalogEntry.id, {
          seasonsCompleted: clampedCount,
          userStatus: finalStatus,
          currentSeason: nextSeasonNum,
          totalSeasons: totalSeasonsCount,
          syncEpisodes: syncEpisodesWithSeasons
        });
      }
    } else {
      // Auto-add to catalog directly
      await onSaveCatalog({
        canonicalId: media.id,
        title: media.title,
        mediaType: media.mediaType,
        format: media.format || (media.isMovie ? 'Movie' : 'Series'),
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        releaseYear: media.releaseYear,
        userStatus: finalStatus,
        seasonsCompleted: clampedCount,
        totalSeasons: totalSeasonsCount,
        currentSeason: nextSeasonNum,
        totalEpisodes: media.totalEpisodes,
        syncEpisodes: syncEpisodesWithSeasons
      });
    }

    const toastMsg = clampedCount >= totalSeasonsCount
      ? `Completed all ${totalSeasonsCount} seasons! 🎉`
      : finalStatus === 'Dropped'
      ? `Dropped after Season ${clampedCount}`
      : finalStatus === 'On Hold'
      ? `On Hold after Season ${clampedCount}`
      : finalStatus === 'Want to Watch'
      ? `Completed ${clampedCount} seasons • Want to Watch Season ${nextSeasonNum}`
      : `Completed ${clampedCount} seasons • Watching Season ${nextSeasonNum}`;

    onShowToast?.(toastMsg, 'success');
  };

  // On-demand refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefreshMedia(media.id);
      onShowToast?.('Live title information refreshed', 'success');
    } catch (e) {
      onShowToast?.('Failed to refresh title info', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mirror link handlers
  const handleCopyUrl = async (sourceId, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSourceId(sourceId);
      onShowToast?.('Mirror link copied to clipboard!', 'success');
      setTimeout(() => setCopiedSourceId(null), 2500);
    } catch (e) {
      onShowToast?.('Failed to copy link', 'error');
    }
  };

  const handleDeleteSource = async (sourceId) => {
    const updated = sourcesList.filter(s => s.id !== sourceId);
    setSourcesList(updated);
    try {
      await deleteMediaSource(media.id, sourceId);
      onShowToast?.('Mirror link removed', 'info');
    } catch (e) {
      // Handled locally
    }
  };

  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newSourceForm.url?.trim()) {
      onShowToast?.('Please enter a valid mirror link URL', 'error');
      return;
    }
    const newEntry = {
      id: `custom_${Date.now()}`,
      sourceName: newSourceForm.sourceName?.trim() || 'Custom Mirror',
      url: newSourceForm.url.trim(),
      type: newSourceForm.type || 'Stream',
      quality: newSourceForm.quality || '1080p WebRip',
      audio: newSourceForm.audio || 'Multi-Audio',
      isSafe: true,
      verified: true
    };
    const updated = [newEntry, ...sourcesList];
    setSourcesList(updated);
    setShowAddSourceModal(false);
    setNewSourceForm({
      sourceName: '',
      url: '',
      type: 'Stream',
      quality: '1080p WebRip',
      audio: media.mediaType === 'Anime' ? 'Japanese (Multi-Sub)' : 'English 5.1'
    });
    try {
      await addMediaSource(media.id, newEntry);
      onShowToast?.('New mirror link added successfully!', 'success');
    } catch (err) {
      onShowToast?.('Added mirror link locally', 'success');
    }
  };

  const filteredSources = sourcesList.filter(s => {
    if (sourceFilter === 'Working') return s.isWorking !== false;
    if (sourceFilter === 'Stream') return s.type === 'Stream' || s.type === 'Both';
    if (sourceFilter === 'Download') return s.type === 'Download' || s.type === 'Both';
    return true;
  });

  // Prioritize active & working mirrors at the top and deduplicate against official streaming providers
  const officialProviderNames = new Set(
    (availableProviders || []).map((p) => (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  );

  const sortedSources = [...filteredSources]
    .filter((s) => {
      // Deduplicate: If official streaming platform is active, suppress duplicate mirror block
      const nameNorm = (s.sourceName || s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return !officialProviderNames.has(nameNorm);
    })
    .sort((a, b) => {
      const aWork = a.isWorking !== false ? 1 : 0;
      const bWork = b.isWorking !== false ? 1 : 0;
      return bWork - aWork;
    });

  const primaryTrailer = media.trailers?.find(t => YOUTUBE_KEY_REGEX.test(t.videoKey)) || media.trailers?.[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl my-auto bg-zinc-950 rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl max-h-[96vh] sm:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1">

          {/* Header Banner & Hero Section */}
          <div className="relative w-full h-72 sm:h-84 md:h-96 bg-zinc-950 overflow-hidden">
            <img
              src={media.backdropUrl || media.bannerUrl || media.posterUrl}
              alt={media.title}
              className="w-full h-full object-cover object-center filter brightness-[0.6]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-transparent to-zinc-950/40" />

            {/* Poster & Title Layer */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5">

              {/* Poster Thumbnail (Visible on both mobile & desktop) */}
              <div className="w-24 sm:w-32 md:w-44 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl bg-zinc-900">
                <img
                  src={media.posterUrl}
                  alt={media.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Metadata Strip */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-md">
                    {media.mediaType}
                  </span>

                  {media.rating && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {media.rating.toFixed(1)}
                    </span>
                  )}

                  {media.releaseYear && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {media.releaseYear}
                    </span>
                  )}

                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${isAiring
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}>
                    {media.status}
                  </span>

                  {timeUntilAiring && isAiring && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-950/80 text-red-300 border border-red-800/60 animate-pulse">
                      <Clock className="w-3.5 h-3.5 text-red-400" />
                      Next Ep {timeUntilAiring}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white leading-tight">
                  {media.title}
                </h1>

                {media.originalTitle && media.originalTitle !== media.title && (
                  <p className="text-xs sm:text-base text-zinc-400 font-medium">
                    {media.originalTitle}
                  </p>
                )}

                {/* Quick Trailer & Refresh Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {primaryTrailer && (
                    <button
                      onClick={() => onWatchTrailer(primaryTrailer.videoKey, media.title)}
                      className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-950/60 transition-all hover:scale-105 active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Watch Trailer</span>
                    </button>
                  )}

                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Re-synchronize fresh metadata from upstream providers"
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition-all"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-400' : ''}`} />
                    <span>{isRefreshing ? 'Syncing...' : 'Sync Fresh Data'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Personal Catalog Control Strip */}
          <div className="px-4 sm:px-6 py-4 bg-zinc-900/90 border-y border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">

            <div className="flex flex-wrap items-center gap-4">
              {/* Watch Status Selector with Not Started option */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                  <BookmarkCheck className={`w-4 h-4 ${catalogEntry ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  Watch Status:
                </span>
                <select
                  value={catalogEntry?.userStatus || 'Not Started'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`bg-zinc-950 border px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer ${catalogEntry
                      ? 'text-emerald-400 border-emerald-500/40'
                      : 'text-zinc-400 border-zinc-700'
                    }`}
                >
                  <option value="Not Started" className="bg-zinc-950 text-zinc-400 font-semibold">
                    Not Started (Unsaved)
                  </option>
                  {USER_WATCH_STATUSES_LIST.map((ws) => (
                    <option key={ws} value={ws} className="bg-zinc-950 text-white font-semibold">
                      {ws}
                    </option>
                  ))}
                </select>
              </div>

              {/* Granular Star Rating (1 to 10) */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400 font-semibold mr-1 hidden sm:inline">My Rating:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starVal) => {
                    const isFilled = (catalogEntry?.userRating || 0) >= starVal;
                    return (
                      <button
                        key={starVal}
                        onClick={() => handleRatingChange(starVal)}
                        title={`Rate ${starVal} / 10`}
                        className="p-1 hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${isFilled
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-zinc-600 hover:text-amber-300'
                            }`}
                        />
                      </button>
                    );
                  })}
                </div>
                {catalogEntry?.userRating && (
                  <span className="text-xs font-black text-amber-400 ml-1">
                    {catalogEntry.userRating}/10
                  </span>
                )}
              </div>

              {/* Extra Rewatching Toggle */}
              <button
                onClick={handleToggleRewatching}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${catalogEntry?.isRewatching
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-sm ring-1 ring-purple-500/30'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-purple-300 hover:border-purple-500/40'
                  }`}
                title={catalogEntry?.isRewatching ? 'Currently marked as Rewatching. Click to toggle.' : 'Mark as being rewatched (usable alongside Completed or any status)'}
              >
                <RotateCw className={`w-3.5 h-3.5 ${catalogEntry?.isRewatching ? 'text-purple-400' : ''}`} />
                <span>Rewatching</span>
              </button>

              {/* Favorite Heart Toggle */}
              <button
                onClick={handleToggleFavorite}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${catalogEntry?.isFavorite
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-rose-400'
                  }`}
              >
                <Heart className={`w-3.5 h-3.5 ${catalogEntry?.isFavorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                <span>Favorite</span>
              </button>
            </div>

            {/* Remove from Catalog Action */}
            {catalogEntry && onDeleteCatalog && (
              <button
                onClick={() => {
                  if (confirm(`Remove "${media.title}" from your personal catalog?`)) {
                    onDeleteCatalog(catalogEntry.id);
                    onShowToast?.('Removed from catalog', 'info');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 transition-colors"
                title="Remove from Catalog"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}

          </div>

          {/* Season Completion & Granular Status Hub (For Multi-Season Series & Anime) */}
          {shouldShowSeasonHub && (
            <div className="mx-4 sm:mx-6 my-4 p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
              {/* Hub Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-600/15 border border-red-500/30 text-red-400">
                    <Tv className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                      <span>Season Completion & Progress</span>
                      {seasonsCompleted > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {seasonsCompleted}/{totalSeasonsCount} Seasons Done
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Track seasons watched, drop points, or queue upcoming seasons (e.g. S3 completed, waiting for S4)
                    </p>
                  </div>
                </div>

                {/* Stepper Controls */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => handleUpdateSeasons(seasonsCompleted - 1)}
                    disabled={seasonsCompleted <= 0}
                    className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-zinc-200 flex items-center justify-center font-bold text-sm transition-all"
                    title="Decrease completed seasons"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="px-3.5 py-1 rounded-xl bg-zinc-950 border border-zinc-700/80 text-center min-w-[100px]">
                    <span className="text-sm font-black text-white">
                      {seasonsCompleted}
                    </span>
                    <span className="text-xs text-zinc-400 font-semibold"> / {totalSeasonsCount} Sns</span>
                  </div>

                  <button
                    onClick={() => handleUpdateSeasons(seasonsCompleted + 1)}
                    disabled={seasonsCompleted >= totalSeasonsCount}
                    className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center font-bold text-sm transition-all shadow-md shadow-red-950/40"
                    title="Increase completed seasons"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visual Season Pills Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {Array.from({ length: totalSeasonsCount }, (_, idx) => {
                  const sNum = idx + 1;
                  const isDone = sNum <= seasonsCompleted;
                  const isCurrent = sNum === seasonsCompleted + 1;

                  return (
                    <button
                      key={sNum}
                      onClick={() => handleUpdateSeasons(isDone && sNum === seasonsCompleted ? sNum - 1 : sNum)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : isCurrent
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20'
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                      title={`Click to mark Season ${sNum} as ${isDone ? 'incomplete' : 'completed'}`}
                    >
                      {isDone ? (
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                      ) : isCurrent ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      ) : null}
                      <span>Season {sNum}</span>
                      {isDone ? (
                        <span className="text-[10px] text-emerald-400 font-normal">Done</span>
                      ) : isCurrent ? (
                        <span className="text-[10px] text-amber-400 font-normal">Next</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Contextual Status Presets Based on User Scenarios */}
              <div className="pt-2 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400 font-semibold">Status for this progress:</span>

                  {seasonsCompleted < totalSeasonsCount ? (
                    <>
                      {/* Scenario: FROM - Watched 3 seasons, waiting/want to watch Season 4 */}
                      <button
                        onClick={() => handleUpdateSeasons(seasonsCompleted, 'Want to Watch')}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          catalogEntry?.userStatus === 'Want to Watch'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-amber-300 hover:border-amber-500/30'
                        }`}
                        title={`I completed ${seasonsCompleted} seasons and want to watch Season ${seasonsCompleted + 1} next`}
                      >
                        ⏳ Want to Watch (Next S{seasonsCompleted + 1})
                      </button>

                      {/* Scenario: Watching Season 4 */}
                      <button
                        onClick={() => handleUpdateSeasons(seasonsCompleted, 'Watching')}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          catalogEntry?.userStatus === 'Watching'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-emerald-300 hover:border-emerald-500/30'
                        }`}
                        title={`I am currently watching Season ${seasonsCompleted + 1}`}
                      >
                        ▶️ Watching (S{seasonsCompleted + 1})
                      </button>

                      {/* Scenario: Vampire Diaries - Watched 3 seasons and dropped */}
                      <button
                        onClick={() => handleUpdateSeasons(seasonsCompleted, 'Dropped')}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          catalogEntry?.userStatus === 'Dropped'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-rose-300 hover:border-rose-500/30'
                        }`}
                        title={`I finished Season ${seasonsCompleted} and decided to drop the series`}
                      >
                        🛑 Dropped (after S{seasonsCompleted})
                      </button>

                      {/* Scenario: On Hold after Season X */}
                      <button
                        onClick={() => handleUpdateSeasons(seasonsCompleted, 'On Hold')}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          catalogEntry?.userStatus === 'On Hold'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-blue-300 hover:border-blue-500/30'
                        }`}
                        title={`I finished Season ${seasonsCompleted} and paused on hold`}
                      >
                        ⏸️ On Hold (after S{seasonsCompleted})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUpdateSeasons(totalSeasonsCount, 'Completed')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        catalogEntry?.userStatus === 'Completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-emerald-300'
                      }`}
                    >
                      🏆 Completed (All {totalSeasonsCount} Seasons)
                    </button>
                  )}
                </div>

                {/* Auto episode sync checkmark */}
                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={syncEpisodesWithSeasons}
                    onChange={(e) => setSyncEpisodesWithSeasons(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-red-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px]">Auto-sync episode checkmarks</span>
                </label>
              </div>
            </div>
          )}

          {/* Franchise Seasons Chronology Navigator */}
          {hasFranchiseSeasons && (
            <div className="px-4 sm:px-6 py-2.5 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-2 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span className="text-xs font-black text-red-400 uppercase tracking-wider">
                  Franchise Timeline:
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {franchisePrequels.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectRelated && onSelectRelated(p)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-500/50 text-xs font-semibold text-zinc-300 hover:text-white transition-all shrink-0"
                    title={`Switch to prequel installment: ${p.title}`}
                  >
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold uppercase">Prequel</span>
                    <span className="max-w-[120px] truncate">{p.title}</span>
                  </button>
                ))}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-black shrink-0 shadow-sm">
                  <span className="text-[9px] px-1 py-0.2 rounded bg-black/30 text-white font-bold uppercase">Current</span>
                  <span className="max-w-[130px] truncate">{media.title}</span>
                </div>
                {franchiseSequels.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectRelated && onSelectRelated(s)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 text-xs font-semibold text-zinc-300 hover:text-white transition-all shrink-0"
                    title={`Switch to next season: ${s.title}`}
                  >
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold uppercase">Next Season</span>
                    <span className="max-w-[120px] truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Official Streaming Availability Banner (Consolidated & Non-duplicated) */}
          {availableProviders.length > 0 && (
            <div className="px-4 sm:px-6 pt-3 pb-2 bg-zinc-950/70 border-b border-zinc-800/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-black text-red-500 uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
                  <span>Official Streaming Availability</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-bold rounded-lg px-2 py-0.5 outline-none focus:border-red-500 cursor-pointer"
                  >
                    {POPULAR_REGIONS.map((r) => (
                      <option key={r.code} value={r.code} className="bg-zinc-950 text-white">
                        {r.label} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                {availableProviders.map((wp, idx) => (
                  <a
                    key={idx}
                    href={wp.webUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all shrink-0 group shadow-sm"
                  >
                    {wp.logoUrl ? (
                      <img src={wp.logoUrl} alt={wp.name} className="w-5 h-5 rounded-md object-contain bg-zinc-950 p-0.5 border border-zinc-800" />
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                        {wp.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                        {wp.name}
                      </p>
                      <span className="text-[10px] text-zinc-400">
                        {wp.type || wp.region || 'Stream'}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Tabs Strip with + Add Mirror Link */}
          <div className="px-4 sm:px-6 pt-3 border-b border-zinc-800 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => setActiveTab('sources')}
                className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'sources'
                    ? 'text-red-500 border-red-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                  }`}
              >
                Streaming & Download Mirrors ({sortedSources.length})
              </button>

              <button
                onClick={() => setActiveTab('episodes')}
                className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'episodes'
                    ? 'text-red-500 border-red-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                  }`}
              >
                {isEpisodic ? (!isStandaloneSeason && (media.seasons?.length > 1 || totalSeasonsCount > 1) ? `Season & Episode Guide (${media.seasons?.length || totalSeasonsCount})` : 'Episode Guide') : 'Episodes'}
              </button>

              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'overview'
                    ? 'text-white border-red-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                  }`}
              >
                Overview & Cast
              </button>

              {/* Suppress duplicate Where to Watch tab if official providers are already shown in banner above */}
              {availableProviders.length === 0 && (
                <button
                  onClick={() => setActiveTab('watch')}
                  className={`pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'watch'
                      ? 'text-white border-red-500'
                      : 'text-zinc-400 border-transparent hover:text-zinc-200'
                    }`}
                >
                  Where to Watch (0)
                </button>
              )}

              <button
                onClick={() => setActiveTab('trailers')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'trailers'
                    ? 'text-white border-red-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                  }`}
              >
                Trailers ({media.trailers?.length || 0})
              </button>
            </div>

            {/* + Add Mirror Link Button */}
            <button
              onClick={() => setShowAddSourceModal(true)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-red-400 hover:text-red-300 border border-red-900/60 bg-red-950/20 hover:bg-red-900/30 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-red-500" />
              <span>Add Mirror Link</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="p-4 sm:p-6 md:p-8 space-y-6">

            {/* TAB 0: STREAMING & DOWNLOAD MIRRORS */}
            {activeTab === 'sources' && (
              <div className="space-y-6 animate-fade-in">
                {/* Filter Pills Bar & Live Check Button */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: 'All', label: `All Verified Mirrors (${sourcesList.length})` },
                      { key: 'Stream', label: `Watch Online (${sourcesList.filter(s => s.type === 'Stream' || s.type === 'Both').length})` },
                      { key: 'Download', label: `Direct Download (${sourcesList.filter(s => s.type === 'Download' || s.type === 'Both').length})` }
                    ].map(({ key: f, label }) => {
                      const isSel = sourceFilter === f;
                      return (
                        <button
                          key={f}
                          onClick={() => setSourceFilter(f)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isSel
                              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-600'
                              : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleLiveCheckDomains}
                    disabled={isCheckingDomains}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 hover:text-amber-200 border border-amber-800/60 bg-amber-950/30 hover:bg-amber-900/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                    title="Live ping all mirror domains and auto-migrate down domains"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isCheckingDomains ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                    <span>{isCheckingDomains ? 'Verifying Domains...' : '⚡ Live Check Domains'}</span>
                  </button>
                </div>

                {/* 2-Column Responsive Grid of Mirror Cards */}
                {sortedSources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedSources.map((source) => {
                      const hostDomain = source.domain || (() => {
                        try { return new URL(source.url).hostname; } catch (e) { return ''; }
                      })();

                      return (
                      <div
                        key={source.id}
                        className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3 shadow-lg group/card ${
                          source.isWorking !== false
                            ? 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80'
                            : 'bg-zinc-950/90 border-rose-950/40 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {/* Card Header & Status Badges */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm sm:text-base font-bold text-white group-hover/card:text-red-400 transition-colors">
                                {source.sourceName}
                              </h4>

                              {/* Working vs Offline / Blocked Live Status Badge */}
                              {source.isWorking !== false ? (
                                <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Working</span>
                                </span>
                              ) : (
                                <span
                                  className="flex items-center gap-1.5 text-[10.5px] font-bold text-rose-400 bg-rose-950/70 border border-rose-500/40 px-2.5 py-0.5 rounded-full shadow-sm"
                                  title={source.statusNote || 'Domain reported offline or blocked'}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>{source.status === 'Region Blocked' ? 'VPN Needed' : 'Not Working / Down'}</span>
                                </span>
                              )}

                              {/* Active Domain Chip */}
                              {hostDomain && (
                                <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-md">
                                  <Globe className="w-3 h-3 text-zinc-400" />
                                  <span>{hostDomain}</span>
                                </span>
                              )}

                              {/* Live Ping Latency Badge */}
                              {source.latencyMs > 0 && (
                                <span className="flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-950/50 border border-amber-800/40 px-2 py-0.5 rounded-full">
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  <span>{source.latencyMs}ms</span>
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteSource(source.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                              title="Delete Mirror"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Domain status note if available */}
                          {source.statusNote && (
                            <p className={`text-[11px] mt-1 ${source.isWorking !== false ? 'text-zinc-400' : 'text-rose-400/80'} italic`}>
                              {source.statusNote}
                            </p>
                          )}
                        </div>

                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="bg-amber-400 text-zinc-950 font-black px-2.5 py-0.5 rounded-md text-xs">
                            {source.quality || '1080p HD'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            source.type === 'Download'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                              : source.type === 'Both'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          }`}>
                            {source.type || 'Stream'}
                          </span>
                          <span className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-md text-xs">
                            {source.audio || 'Multi-Audio'}
                          </span>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-bold py-2.5 px-5 rounded-xl flex-1 flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all text-xs sm:text-sm ${
                              source.isWorking !== false
                                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                            }`}
                            title={source.isWorking === false ? (source.statusNote || 'Domain reported offline or blocked') : 'Open Mirror'}
                          >
                            {source.type === 'Download' ? (
                              <Download className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                            <span>{source.type === 'Download' ? 'Download Now' : 'Stream Now'}</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          </a>

                          <button
                            onClick={() => handleCopyUrl(source.id, source.url)}
                            className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all text-xs"
                            title="Copy Direct Link URL"
                          >
                            {copiedSourceId === source.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-xs">
                    No mirror links match the selected filter. Click "+ Add Mirror Link" to add your own.
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Left 2 Cols: Synopsis, Genres, Cast */}
                  <div className="md:col-span-2 space-y-6">
                    {/* Genres */}
                    <div className="flex flex-wrap gap-2">
                      {media.genres?.map((g) => (
                        <span
                          key={g}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800"
                        >
                          {g}
                        </span>
                      ))}
                    </div>

                    {/* Synopsis */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400">
                        Synopsis
                      </h3>
                      <p className="text-xs sm:text-sm md:text-base text-zinc-200 leading-relaxed">
                        {media.synopsis || 'No synopsis provided for this title.'}
                      </p>
                    </div>

                    {/* Cast & Characters */}
                    {media.cast && media.cast.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <User className="w-4 h-4 text-red-400" />
                            <span>Top Cast & Characters</span>
                          </h3>
                          <span className="text-[11px] text-zinc-500 font-medium">Click actor or character to explore titles</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {media.cast.slice(0, 9).map((c, i) => {
                            const isLead = c.role === 'MAIN';
                            const charName = c.character || c.actor;
                            const filterTarget = c.actor || c.character || charName;
                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  if (onSelectCharacter && filterTarget) {
                                    onSelectCharacter(filterTarget);
                                    onClose();
                                  }
                                }}
                                title={filterTarget ? `Click to filter all titles starring "${filterTarget}"` : ''}
                                className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                  onSelectCharacter && filterTarget 
                                    ? 'bg-zinc-900/70 hover:bg-zinc-800/90 border-zinc-800/80 hover:border-red-500/50 cursor-pointer shadow-sm hover:shadow-red-950/20 hover:scale-[1.02]' 
                                    : 'bg-zinc-900/60 border-zinc-800/80'
                                }`}
                              >
                                {c.characterImage || c.actorImage ? (
                                  <img
                                    src={c.characterImage || c.actorImage}
                                    alt={charName}
                                    className="w-11 h-11 rounded-lg object-cover bg-zinc-800 shrink-0 ring-1 ring-zinc-700/60 group-hover:ring-red-500/40 transition-all"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 text-xs shrink-0">
                                    {(charName || '?').charAt(0)}
                                  </div>
                                )}
                                <div className="overflow-hidden flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <p className="text-xs font-bold text-white truncate group-hover:text-red-300 transition-colors">
                                      {charName}
                                    </p>
                                    {isLead && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-950/80 text-red-300 border border-red-800/60 shrink-0">
                                        Lead
                                      </span>
                                    )}
                                  </div>
                                  {c.actor && c.character && (
                                    <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                                      {c.actor}
                                    </p>
                                  )}
                                  {onSelectCharacter && filterTarget && (
                                    <span className="text-[9.5px] font-semibold text-red-400/90 group-hover:text-red-400 flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span>Find titles</span>
                                      <ChevronRight className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right 1 Col: Production Metadata & Personal Notes */}
                  <div className="space-y-6">
                    {/* Production Specs Box */}
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3 text-xs">
                      <h3 className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">
                        Title Information
                      </h3>

                      {media.studios && media.studios.length > 0 && (
                        <div>
                          <span className="text-zinc-500">Studios / Network:</span>
                          <p className="font-semibold text-zinc-200 mt-0.5">
                            {media.studios.join(', ')}
                          </p>
                        </div>
                      )}

                      {media.countryOfOrigin && (
                        <div>
                          <span className="text-zinc-500">Country of Origin:</span>
                          <p className="font-semibold text-zinc-200 mt-0.5">
                            {media.countryOfOrigin}
                          </p>
                        </div>
                      )}

                      {media.runtimeMinutes && (
                        <div>
                          <span className="text-zinc-500">Runtime:</span>
                          <p className="font-semibold text-zinc-200 mt-0.5">
                            ~{media.runtimeMinutes} min
                          </p>
                        </div>
                      )}

                      {media.totalEpisodes && (
                        <div>
                          <span className="text-zinc-500">Total Episodes:</span>
                          <p className="font-semibold text-zinc-200 mt-0.5">
                            {media.totalEpisodes} episodes
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Personal Notes Box */}
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                          Personal Notes
                        </span>
                        {catalogEntry && !showNotesEditor && (
                          <button
                            onClick={() => setShowNotesEditor(true)}
                            className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
                          >
                            {catalogEntry.notes ? 'Edit' : '+ Add Note'}
                          </button>
                        )}
                      </div>

                      {showNotesEditor ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesInput}
                            onChange={(e) => setNotesInput(e.target.value)}
                            placeholder="Add private review, favorite arcs, or thoughts..."
                            className="w-full p-2.5 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none h-24"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setShowNotesEditor(false)}
                              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveNotes}
                              className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">
                          {catalogEntry?.notes || (
                            catalogEntry
                              ? 'No private notes added yet.'
                              : 'Add to catalog to save personal notes.'
                          )}
                        </p>
                      )}
                    </div>

                  </div>
                </div>

                {/* Related & Recommended Section */}
                {media.relatedMedia && media.relatedMedia.length > 0 && (
                  <div className="pt-6 border-t border-zinc-800/80 space-y-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-500" />
                      <span>Related & Recommended Titles</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {media.relatedMedia.map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => onSelectRelated && onSelectRelated(rel)}
                          className="group/rel p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-950">
                            {rel.posterUrl ? (
                              <img
                                src={rel.posterUrl}
                                alt={rel.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover/rel:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-bold">
                                No Art
                              </div>
                            )}
                          </div>
                          <div>
                            <h5 className="text-[11px] font-bold text-white group-hover/rel:text-red-400 line-clamp-1">
                              {rel.title}
                            </h5>
                            <span className="text-[10px] text-zinc-500">
                              {rel.relationType || rel.mediaType}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SEASONS & EPISODES */}
            {activeTab === 'episodes' && (
              <EpisodeGuide
                media={media}
                mirrorRegistry={mirrorRegistry}
                seasons={media.seasons || []}
                watchedEpisodes={catalogEntry?.watchedEpisodes || []}
                seasonsCompleted={seasonsCompleted}
                onSetSeasonsCompleted={handleUpdateSeasons}
                onToggleWatched={handleEpisodeToggleFrictionless}
                onBatchSeasonWatched={(sNum, count, watched) => {
                  if (catalogEntry) {
                    onBatchSeason(catalogEntry.id, { seasonNumber: sNum, episodeCount: count, isWatched: watched });
                  } else {
                    handleEpisodeToggleFrictionless(sNum, count, watched);
                  }
                }}
                isCatalogItem={Boolean(catalogEntry)}
                relatedMedia={media.relatedMedia || []}
                onSelectRelated={onSelectRelated}
              />
            )}

            {/* TAB 3: WHERE TO WATCH (OFFICIAL STREAMING AVAILABILITY) */}
            {activeTab === 'watch' && (
              <div className="space-y-6">
                {/* Region Selector Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-zinc-300">
                      Official Streaming Availability for:
                    </span>
                  </div>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {POPULAR_REGIONS.map((r) => (
                      <option key={r.code} value={r.code} className="bg-zinc-950 text-white">
                        {r.label} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Platform Groups */}
                {availableProviders.length > 0 ? (
                  <div className="space-y-6">
                    {/* Subscription (Flatrate) */}
                    {flatrateProviders.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Subscription Streaming Platforms
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {flatrateProviders.map((wp, idx) => (
                            <a
                              key={idx}
                              href={wp.webUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all group shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                {wp.logoUrl ? (
                                  <img
                                    src={wp.logoUrl}
                                    alt={wp.name}
                                    className="w-8 h-8 rounded-lg object-contain bg-zinc-950 p-1 border border-zinc-800"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                                    {wp.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <h5 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                                    {wp.name}
                                  </h5>
                                  <span className="text-[10px] text-zinc-400 font-medium">
                                    Stream Now
                                  </span>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rent / Buy */}
                    {(rentProviders.length > 0 || buyProviders.length > 0) && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                          Digital Rental / Purchase
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {[...rentProviders, ...buyProviders].map((wp, idx) => (
                            <a
                              key={idx}
                              href={wp.webUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 transition-all group text-xs font-semibold text-zinc-300"
                            >
                              <div className="flex items-center gap-2.5">
                                {wp.logoUrl && (
                                  <img
                                    src={wp.logoUrl}
                                    alt={wp.name}
                                    className="w-6 h-6 rounded object-contain bg-zinc-950 p-0.5"
                                  />
                                )}
                                <span>{wp.name} ({wp.type})</span>
                              </div>
                              <ExternalLink className="w-3 h-3 text-zinc-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center space-y-2 text-zinc-400">
                    <p className="text-sm font-semibold">
                      No official streaming availability verified for {selectedRegion} yet.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Try selecting "United States" or syncing with a TMDB API key in settings for global JustWatch coverage.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: TRAILERS */}
            {activeTab === 'trailers' && (
              <div className="space-y-4">
                {media.trailers && media.trailers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {media.trailers
                      .filter(tr => YOUTUBE_KEY_REGEX.test(tr.videoKey))
                      .map((tr, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3"
                        >
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800">
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${tr.videoKey}`}
                              title={tr.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate max-w-xs">
                              {tr.title}
                            </span>
                            <a
                              href={`https://www.youtube.com/watch?v=${tr.videoKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-semibold"
                            >
                              <span>YouTube</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-zinc-400 text-sm">
                    No official video trailers attached to this title yet.
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Add Mirror Link Modal Dialog */}
        {showAddSourceModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-red-500" />
                  Add Streaming or Download Mirror
                </h3>
                <button
                  onClick={() => setShowAddSourceModal(false)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSource} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Source Name</label>
                  <input
                    type="text"
                    required
                    value={newSourceForm.sourceName}
                    onChange={(e) => setNewSourceForm({ ...newSourceForm, sourceName: e.target.value })}
                    placeholder="e.g. SubsPlease 1080p, HiAnime, 7Reels"
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Mirror URL</label>
                  <input
                    type="url"
                    required
                    value={newSourceForm.url}
                    onChange={(e) => setNewSourceForm({ ...newSourceForm, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 font-semibold mb-1">Link Type</label>
                    <select
                      value={newSourceForm.type}
                      onChange={(e) => setNewSourceForm({ ...newSourceForm, type: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="Stream">Stream (Watch Online)</option>
                      <option value="Download">Download (Direct DL)</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-semibold mb-1">Quality</label>
                    <select
                      value={newSourceForm.quality}
                      onChange={(e) => setNewSourceForm({ ...newSourceForm, quality: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="1080p HD">1080p HD</option>
                      <option value="1080p WebRip">1080p WebRip</option>
                      <option value="4K UHD">4K UHD</option>
                      <option value="720p HD">720p HD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Audio / Subtitle</label>
                  <input
                    type="text"
                    value={newSourceForm.audio}
                    onChange={(e) => setNewSourceForm({ ...newSourceForm, audio: e.target.value })}
                    placeholder="e.g. Japanese (Multi-Sub), Dual Audio, English 5.1"
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSourceModal(false)}
                    className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/50"
                  >
                    Add Mirror Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
