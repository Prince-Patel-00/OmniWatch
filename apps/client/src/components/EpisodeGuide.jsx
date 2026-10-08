import React, { useState } from 'react';
import {
  CheckCircle,
  Calendar,
  Clock,
  CheckCheck,
  Tv,
  Play,
  ExternalLink,
  Download,
  Check
} from 'lucide-react';

export default function EpisodeGuide({
  seasons = [],
  watchedEpisodes = [], // Array of { seasonNumber, episodeNumber }
  onToggleWatched,
  onBatchSeasonWatched,
  isCatalogItem = false,
  seasonsCompleted = 0,
  onSetSeasonsCompleted = null
}) {
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);

  if (!seasons || seasons.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center text-zinc-400 text-sm">
        <Tv className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        No season or episode guide data available for this title.
      </div>
    );
  }

  const currentSeason = seasons[selectedSeasonIdx] || seasons[0];
  const seasonNum = currentSeason.seasonNumber || (selectedSeasonIdx + 1);

  // Check if an episode is watched
  const isEpWatched = (epNum) => {
    return watchedEpisodes.some(
      (w) => w.seasonNumber === seasonNum && w.episodeNumber === epNum
    );
  };

  const episodes = currentSeason.episodes || [];
  const totalInSeason = episodes.length || currentSeason.episodeCount || 0;
  const watchedInSeason = episodes.filter((e) => isEpWatched(e.episodeNumber)).length;
  const progressPercent = totalInSeason > 0 ? Math.round((watchedInSeason / totalInSeason) * 100) : 0;
  const isCurrentSeasonDone = seasonNum <= seasonsCompleted || (totalInSeason > 0 && watchedInSeason >= totalInSeason);

  return (
    <div className="space-y-4">
      {/* Season Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {seasons.map((s, idx) => {
            const isSelected = idx === selectedSeasonIdx;
            const sEpisodes = s.episodes || [];
            const sWatched = sEpisodes.filter((e) =>
              watchedEpisodes.some(
                (w) => w.seasonNumber === (s.seasonNumber || idx + 1) && w.episodeNumber === e.episodeNumber
              )
            ).length;
            const sNum = s.seasonNumber || idx + 1;
            const isSeasonDone = sNum <= seasonsCompleted || (sEpisodes.length > 0 && sWatched >= sEpisodes.length);

            return (
              <button
                key={s.seasonNumber || idx}
                onClick={() => setSelectedSeasonIdx(idx)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span>Season {sNum}</span>
                {s.episodeCount ? (
                  <span className="text-[11px] opacity-75 font-normal">
                    ({s.episodeCount} eps)
                  </span>
                ) : null}
                {isSeasonDone ? (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : sWatched > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Season Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {onSetSeasonsCompleted && (
            <button
              onClick={() => onSetSeasonsCompleted(isCurrentSeasonDone ? seasonNum - 1 : seasonNum)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 transition-colors"
              title={`Mark all up to Season ${seasonNum} as completed`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isCurrentSeasonDone ? `Unmark S${seasonNum}` : `Mark S${seasonNum} Done`}</span>
            </button>
          )}

          {/* Batch Season Mark All Episodes Action */}
          {isCatalogItem && episodes.length > 0 && onBatchSeasonWatched && (
            <button
              onClick={() => onBatchSeasonWatched(seasonNum, episodes.length, watchedInSeason < totalInSeason)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{watchedInSeason === totalInSeason ? 'Unmark Episodes' : 'All Episodes Watched'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Season Completion Ribbon */}
      {isCurrentSeasonDone && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Season {seasonNum} Completed! (All episodes recorded as watched)</span>
          </div>
          {onSetSeasonsCompleted && (
            <button
              onClick={() => onSetSeasonsCompleted(Math.max(0, seasonNum - 1))}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline font-normal cursor-pointer"
            >
              Reset to S{seasonNum - 1}
            </button>
          )}
        </div>
      )}

      {/* Season Progress Bar */}
      {isCatalogItem && totalInSeason > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs">
          <span className="text-zinc-400 font-medium">Season Progress:</span>
          <div className="flex-1 bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-bold text-emerald-400">
            {watchedInSeason} / {totalInSeason} ({progressPercent}%)
          </span>
        </div>
      )}

      {/* Episode Cards List */}
      <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
        {episodes.length > 0 ? (
          episodes.map((ep) => {
            const watched = isEpWatched(ep.episodeNumber);

            return (
              <div
                key={ep.episodeNumber}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-2xl border transition-all ${
                  watched
                    ? 'bg-zinc-950/40 border-zinc-800/40 opacity-80'
                    : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700/80 shadow-sm'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  {/* Episode Watched Toggle Checkmark */}
                  {isCatalogItem && onToggleWatched ? (
                    <button
                      onClick={() => onToggleWatched(seasonNum, ep.episodeNumber, !watched)}
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all ${
                        watched
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                          : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-700'
                      }`}
                      title={watched ? 'Mark as unwatched' : 'Mark as watched'}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs font-bold border border-zinc-800">
                      {ep.episodeNumber}
                    </span>
                  )}

                  {/* Episode Thumbnail (if available) */}
                  {ep.stillUrl && (
                    <div className="hidden sm:block w-20 aspect-video shrink-0 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                      <img
                        src={ep.stillUrl}
                        alt={ep.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title & Overview */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-red-400">
                        EP {ep.episodeNumber}
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {ep.title || `Episode ${ep.episodeNumber}`}
                      </h4>
                    </div>

                    {ep.overview && (
                      <p className="text-xs text-zinc-400 line-clamp-2 max-w-xl">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </div>

                {/* Metadata Pills (Runtime, Air Date) & Direct Episode Watch Links */}
                <div className="flex flex-wrap items-center gap-2.5 mt-2 sm:mt-0 pl-10 sm:pl-0 text-xs">
                  {ep.airDate && (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      {ep.airDate}
                    </span>
                  )}
                  {ep.runtimeMinutes && (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      {ep.runtimeMinutes}m
                    </span>
                  )}

                  {/* Direct Episode Streaming Mirrors */}
                  {Array.isArray(ep.links) && ep.links.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <a
                        href={ep.links[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all hover:scale-105"
                        title="Stream episode directly"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Stream Ep</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                      {ep.links[1] && (
                        <a
                          href={ep.links[1]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                          title="Download episode mirror"
                        >
                          <Download className="w-3 h-3" />
                          <span>DL</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-zinc-500 text-xs">
            Episode details for this season are being synchronized.
          </div>
        )}
      </div>
    </div>
  );
}
