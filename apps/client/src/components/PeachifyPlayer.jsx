import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  ExternalLink,
  Zap,
  Tv,
  Film,
  Sparkles,
  Maximize2,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Radio
} from 'lucide-react';
import {
  resolvePeachifyId,
  isPeachifySupported,
  buildPeachifyUrl,
  PEACHIFY_DEFAULT_ACCENT
} from '@omniwatch/shared';

export default function PeachifyPlayer({
  media,
  activeSeason = 1,
  activeEpisode = 1,
  onSeasonChange,
  onEpisodeChange,
  onEpisodeCompleted,
  className = ''
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(activeSeason || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(activeEpisode || 1);
  const [preferredAudio, setPreferredAudio] = useState(media?.mediaType === 'Anime' ? 'sub' : 'dub');
  const [watchProgress, setWatchProgress] = useState(null);

  // Sync with prop changes if parent selects an episode
  useEffect(() => {
    if (activeSeason) setSelectedSeason(activeSeason);
  }, [activeSeason]);

  useEffect(() => {
    if (activeEpisode) setSelectedEpisode(activeEpisode);
  }, [activeEpisode]);

  const resolved = useMemo(() => resolvePeachifyId(media), [media]);
  const isSupported = Boolean(resolved);

  const isMovie = Boolean(
    media?.mediaType === 'Movie' ||
    media?.format === 'Movie' ||
    media?.isMovie ||
    (typeof media?.id === 'string' && media.id.includes('_m_'))
  );

  // Compute available seasons and episodes from media metadata
  const seasonsList = useMemo(() => {
    if (isMovie) return [];
    if (Array.isArray(media?.seasons) && media.seasons.length > 0) {
      return media.seasons.filter((s) => (s.seasonNumber || 0) > 0);
    }
    const count = media?.totalSeasons || 1;
    return Array.from({ length: count }, (_, i) => ({
      seasonNumber: i + 1,
      episodeCount: media?.totalEpisodes ? Math.ceil(media.totalEpisodes / count) : 12
    }));
  }, [media, isMovie]);

  const currentSeasonMeta = seasonsList.find((s) => s.seasonNumber === selectedSeason) || seasonsList[0];
  const episodeCount = currentSeasonMeta?.episodeCount || currentSeasonMeta?.episodes?.length || 24;

  // Build the live iframe stream URL
  const streamUrl = useMemo(() => {
    if (!isSupported) return null;
    return buildPeachifyUrl(media, {
      season: selectedSeason,
      episode: selectedEpisode,
      accent: PEACHIFY_DEFAULT_ACCENT,
      autoPlay: isPlaying,
      autoNext: 30,
      dub: preferredAudio === 'dub' ? 'English' : undefined,
      sub: preferredAudio === 'sub' ? 'English' : undefined
    });
  }, [media, isSupported, selectedSeason, selectedEpisode, isPlaying, preferredAudio]);

  // Direct external launch URL (autoPlay enabled for quick watch in new tab)
  const launchExternalUrl = useMemo(() => {
    if (!isSupported) return null;
    return buildPeachifyUrl(media, {
      season: selectedSeason,
      episode: selectedEpisode,
      accent: PEACHIFY_DEFAULT_ACCENT,
      autoPlay: true,
      autoNext: 30
    });
  }, [media, isSupported, selectedSeason, selectedEpisode]);

  // Listen for Peachify postMessage playback events
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate origin from official Peachify player
      if (event.origin !== 'https://peachify.top') return;

      if (event.data?.type === 'MEDIA_DATA') {
        const peachifyProgress = event.data.data;
        try {
          localStorage.setItem('peachifyProgress', JSON.stringify(peachifyProgress));
        } catch (e) {
          console.error('[Peachify] Could not write to localStorage:', e);
        }
      }

      if (event.data?.type === 'PLAYER_EVENT') {
        const { event: evt, currentTime, duration, season, episode } = event.data.data || {};
        if (currentTime && duration) {
          const pct = Math.round((currentTime / duration) * 100);
          setWatchProgress({ currentTime, duration, percentage: pct });

          if (pct >= 85 || evt === 'ended') {
            if (typeof onEpisodeCompleted === 'function') {
              onEpisodeCompleted(season || selectedSeason, episode || selectedEpisode);
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedSeason, selectedEpisode, onEpisodeCompleted]);

  if (!isSupported) {
    return null; // Suppress section if no TMDB/IMDb mapping exists
  }

  const handleSeasonSelect = (sNum) => {
    const num = parseInt(sNum, 10);
    setSelectedSeason(num);
    setSelectedEpisode(1);
    if (onSeasonChange) onSeasonChange(num);
  };

  const handleEpisodeSelect = (eNum) => {
    const num = parseInt(eNum, 10);
    setSelectedEpisode(num);
    if (onEpisodeChange) onEpisodeChange(num);
  };

  return (
    <div
      className={`rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/25 via-zinc-950/90 to-zinc-950 p-4 sm:p-5 shadow-xl shadow-emerald-950/20 space-y-4 transition-all ${className}`}
    >
      {/* Top Banner & Identification Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Zap className="w-5 h-5 fill-emerald-400/30 text-emerald-400 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-2">
                <span>Peachify Direct Stream</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ⚡ 1080p HD
                </span>
              </h3>
            </div>
            <p className="text-xs text-emerald-300/80 font-medium flex items-center gap-1.5 mt-0.5">
              <span>Fast CDN Embed</span>
              <span>•</span>
              <span>Direct TMDB/IMDb Pipe</span>
              <span>•</span>
              <span className="text-zinc-400">Green Theme</span>
            </p>
          </div>
        </div>

        {/* Action Controls: Launch Tab or Toggle Inline Player */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 ${
              isPlaying
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 hover:shadow-emerald-900/40'
            }`}
            title={isPlaying ? 'Collapse inline stream player' : 'Play directly inside OmniWatch'}
          >
            {isPlaying ? (
              <>
                <ChevronDown className="w-4 h-4 text-zinc-300" />
                <span>Hide Player</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Stream In-App</span>
              </>
            )}
          </button>

          {launchExternalUrl && (
            <a
              href={launchExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95"
              title="Open full stream in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Tab</span>
            </a>
          )}
        </div>
      </div>

      {/* Episode / Season Selector Strip (For Episodic Media) */}
      {!isMovie && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-950/60 p-3 rounded-xl border border-emerald-500/15">
          <div className="flex flex-wrap items-center gap-3">
            {/* Season Selector */}
            {seasonsList.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-semibold">Season:</span>
                <select
                  value={selectedSeason}
                  onChange={(e) => handleSeasonSelect(e.target.value)}
                  className="bg-zinc-900 border border-emerald-500/30 text-emerald-300 font-bold rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                >
                  {seasonsList.map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber} className="bg-zinc-950 text-white">
                      Season {s.seasonNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Episode Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-semibold">Episode:</span>
              <select
                value={selectedEpisode}
                onChange={(e) => handleEpisodeSelect(e.target.value)}
                className="bg-zinc-900 border border-emerald-500/30 text-emerald-300 font-bold rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
              >
                {Array.from({ length: Math.max(1, episodeCount) }, (_, idx) => idx + 1).map((epNum) => (
                  <option key={epNum} value={epNum} className="bg-zinc-950 text-white">
                    Ep {epNum}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Track toggle if Anime */}
            {media?.mediaType === 'Anime' && (
              <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-emerald-500/20">
                <button
                  type="button"
                  onClick={() => setPreferredAudio('sub')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    preferredAudio === 'sub'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sub
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredAudio('dub')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    preferredAudio === 'dub'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Dub
                </button>
              </div>
            )}
          </div>

          {/* Active target badge */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
              S{selectedSeason}:E{selectedEpisode}
            </span>
            {watchProgress?.percentage > 0 && (
              <span className="text-[11px] font-bold text-zinc-300">
                {watchProgress.percentage}% watched
              </span>
            )}
          </div>
        </div>
      )}

      {/* Embedded Iframe Player Section */}
      {isPlaying && streamUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-black shadow-2xl animate-fade-in aspect-video w-full">
          <iframe
            src={streamUrl}
            title={`Peachify - ${media?.title || 'Stream'}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        </div>
      )}

      {/* Bottom Information Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 pt-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            Connected to <strong>{resolved.type.toUpperCase()} #{resolved.id}</strong>
          </span>
          <span>•</span>
          <span>Auto-Next & Resume Enabled</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-400/90 font-medium">Source: Peachify CDN</span>
        </div>
      </div>
    </div>
  );
}
