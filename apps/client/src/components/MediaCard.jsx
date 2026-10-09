import React from 'react';
import {
  Star,
  Clock,
  Play,
  Check,
  Plus,
  Heart,
  BookmarkCheck,
  Bookmark,
  CheckCircle2,
  RotateCw,
  User,
  Sparkles
} from 'lucide-react';
import { formatTimeUntil, shouldDisplaySeasonCount, isStandaloneSeasonRecord } from '@omniwatch/shared';

export default function MediaCard({
  media,
  catalogEntry = null,
  onClick,
  onIncrementProgress,
  onToggleFavorite,
  onQuickSetStatus,
  onSelectCharacter
}) {
  const isAiring = media.status === 'Airing';
  const timeUntil = media.nextAiringAt ? formatTimeUntil(media.nextAiringAt) : null;
  const isMovie = media.mediaType === 'Movie' || media.format === 'Movie' || media.isMovie;
  const isEpisodic = !isMovie && (media.mediaType === 'Anime' || media.mediaType === 'Series');

  const userStatus = catalogEntry?.userStatus;
  const isFavorite = catalogEntry?.isFavorite;
  const isRewatching = catalogEntry?.isRewatching;
  const currentEp = catalogEntry?.currentEpisode || 0;
  const totalEp = catalogEntry?.totalEpisodes || media.totalEpisodes;
  const seasonsCompleted = catalogEntry?.seasonsCompleted ?? 0;
  const totalSeasons = catalogEntry?.totalSeasons || media.totalSeasons;

  // Use shared helper: strictly false for movies, standalone seasons (AOT S2, etc.), or 1-season shows
  const shouldShowSeasonBadges = shouldDisplaySeasonCount(media);

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-red-950/20 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer"
    >
      {/* Poster Image Container (2/3 aspect ratio) */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
        <img
          src={media.posterUrl || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop'}
          alt={media.title}
          loading="lazy"
          className="w-full h-full object-cover object-center filter brightness-[0.92] group-hover:scale-105 transition-transform duration-500"
        />

        {/* Ambient overlay shadows */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/40 opacity-80" />

        {/* Top Floating Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          {/* Media Type */}
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-md ${media.mediaType === 'Anime' && isMovie ? 'bg-purple-600/90' : 'bg-red-600/90'
            }`}>
            {media.mediaType === 'Anime' ? (isMovie ? 'Anime Movie' : 'Anime') : media.mediaType}
          </span>

          {/* Rating */}
          {media.rating && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-zinc-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-md">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {media.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Bottom Banner inside Poster: Airing Countdown or In-Catalog Status */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1">
          {/* Next Episode Airing Pill */}
          {timeUntil && isAiring && (
            <span className="self-start flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-950/90 text-red-200 border border-red-800/60 backdrop-blur-md shadow-md animate-pulse">
              <Clock className="w-3 h-3 text-red-400" />
              <span>Next {timeUntil}</span>
            </span>
          )}

          {/* Catalog Tracking Status Pill or Default Not Started */}
          {userStatus ? (
            <div className={`flex items-center justify-between gap-1 px-2.5 py-1 rounded-lg backdrop-blur-md text-[11px] font-bold shadow-md border ${
              userStatus === 'Dropped'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
                : userStatus === 'On Hold'
                ? 'bg-blue-950/90 border-blue-500/40 text-blue-300'
                : userStatus === 'Want to Watch'
                ? 'bg-zinc-950/90 border-amber-500/40 text-amber-300'
                : 'bg-zinc-950/90 border-emerald-500/30 text-emerald-400'
            }`}>
              <div className="flex items-center gap-1 truncate">
                <BookmarkCheck className={`w-3.5 h-3.5 shrink-0 ${
                  userStatus === 'Dropped' ? 'text-rose-400' : userStatus === 'On Hold' ? 'text-blue-400' : userStatus === 'Want to Watch' ? 'text-amber-400' : 'text-emerald-400'
                }`} />
                <span className="truncate">
                  {userStatus === 'Dropped' && seasonsCompleted > 0
                    ? `Dropped (after S${seasonsCompleted})`
                    : userStatus === 'On Hold' && seasonsCompleted > 0
                    ? `On Hold (S${seasonsCompleted} Done)`
                    : userStatus === 'Want to Watch' && seasonsCompleted > 0
                    ? `S${seasonsCompleted} Done • Next S${seasonsCompleted + 1}`
                    : userStatus === 'Watching' && seasonsCompleted > 0
                    ? `S${seasonsCompleted} Done • S${seasonsCompleted + 1}`
                    : userStatus}
                </span>
                {isRewatching && (
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-purple-950/90 text-purple-300 border border-purple-700/60 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0" title="Rewatching">
                    <RotateCw className="w-2.5 h-2.5" />
                    <span>Rewatch</span>
                  </span>
                )}
              </div>
              {isEpisodic && (
                <span className="text-[10px] text-zinc-300 font-semibold shrink-0">
                  {shouldShowSeasonBadges && seasonsCompleted > 0 ? (
                    `${seasonsCompleted}/${totalSeasons} Sns`
                  ) : totalEp ? (
                    `${currentEp}/${totalEp}`
                  ) : null}
                </span>
              )}
            </div>
          ) : (
            <div className="self-start flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-md text-zinc-400 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span>Not Started</span>
            </div>
          )}
        </div>

        {/* Hover Quick Action Overlay */}
        {catalogEntry && isEpisodic && onIncrementProgress && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onIncrementProgress(catalogEntry);
            }}
            title={`Mark Ep ${currentEp + 1} watched`}
            className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-xl hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto"
          >
            <div className="flex items-center gap-1 text-[11px] font-black">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>1 Ep</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Info Details */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 font-medium">
            <span>{media.releaseYear || 'TBA'}</span>
            <span className="text-zinc-500">•</span>
            <span className="truncate">{media.studios?.[0] || media.networks?.[0] || media.status}</span>
            {shouldShowSeasonBadges && (
              <>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-300 font-semibold shrink-0">
                  {seasonsCompleted > 0 ? `${seasonsCompleted}/${totalSeasons} Sns Done` : `${totalSeasons} Sns`}
                </span>
              </>
            )}
          </div>

          <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1 mt-1 leading-snug" title={media.title}>
            {media.title}
          </h3>

          {media.originalTitle && media.originalTitle !== media.title && (
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {media.originalTitle}
            </p>
          )}

          {media.sourceTitle && (
            <div className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold truncate">
              <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="truncate">Based on {media.sourceTitle} (★{media.sourceRating || 10})</span>
            </div>
          )}

          {/* Matched Actor / Hero Highlight or Lead Cast Row */}
          {(() => {
            if (media.matchedPerson) {
              const p = media.matchedPerson;
              return (
                <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-zinc-800/50 overflow-hidden">
                  <span className="text-[9.5px] font-bold text-red-400 shrink-0 uppercase tracking-wider flex items-center gap-0.5">
                    <User className="w-2.5 h-2.5 text-red-400" />
                  </span>
                  <span
                    onClick={(e) => {
                      if (onSelectCharacter) {
                        e.stopPropagation();
                        onSelectCharacter(p.name);
                      }
                    }}
                    title={`Filter by actor: ${p.name}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold max-w-[190px] truncate bg-red-950/60 border border-red-500/40 text-red-300 hover:text-white cursor-pointer"
                  >
                    {p.image && <img src={p.image} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />}
                    <span className="truncate">{p.name}</span>
                    {p.character && <span className="text-zinc-400 text-[9px] truncate font-normal">as {p.character}</span>}
                  </span>
                </div>
              );
            }

            const chars = media.mainCharacters || (media.cast || []).filter(c => c.role === 'MAIN');
            const displayList = (chars && chars.length > 0 ? chars : (media.cast || [])).slice(0, 2);
            if (!displayList || displayList.length === 0) return null;
            return (
              <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-zinc-800/50 overflow-hidden">
                <span className="text-[9.5px] font-bold text-zinc-400 shrink-0 uppercase tracking-wider flex items-center gap-0.5" title="Lead cast / character(s)">
                  <User className="w-2.5 h-2.5 text-zinc-400" />
                </span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {displayList.map((c, i) => {
                    const cName = c.name || c.character || c.actor;
                    const cImg = c.image || c.characterImage || c.actorImage;
                    const filterName = c.actor || c.character || cName;
                    if (!cName) return null;
                    return (
                      <span
                        key={i}
                        onClick={(e) => {
                          if (onSelectCharacter) {
                            e.stopPropagation();
                            onSelectCharacter(filterName);
                          }
                        }}
                        title={`Filter by: ${cName}${c.actor ? ` (${c.actor})` : ''}`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium max-w-[125px] truncate transition-colors ${
                          onSelectCharacter 
                            ? 'bg-zinc-800/90 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 border border-zinc-700/60 text-zinc-300 cursor-pointer'
                            : 'bg-zinc-800/70 text-zinc-400 border border-zinc-700/40'
                        }`}
                      >
                        {cImg ? (
                          <img src={cImg} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-zinc-700 text-[8px] flex items-center justify-center font-bold shrink-0">
                            {cName.charAt(0)}
                          </span>
                        )}
                        <span className="truncate">{cName}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Genres & Favorite Heart */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
          <div className="flex items-center gap-1 overflow-hidden text-[10px] text-zinc-400">
            {media.genres?.slice(0, 2).map((g) => (
              <span key={g} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {g}
              </span>
            ))}
          </div>

          {onToggleFavorite && catalogEntry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(catalogEntry);
              }}
              className="p-1 rounded-md text-zinc-500 hover:text-rose-400 transition-colors"
              title={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          )}
        </div>

        {/* Quick Action Buttons: Want to Watch & Completed directly on Card */}
        {onQuickSetStatus && (
          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-zinc-800/60 mt-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickSetStatus(media, 'Want to Watch');
              }}
              className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-xl text-[10.5px] font-bold border transition-all ${userStatus === 'Want to Watch'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-extrabold'
                  : 'bg-zinc-950/70 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border-zinc-800/80 hover:border-amber-500/40'
                }`}
              title="Add / Set status as Want to Watch"
            >
              <Bookmark className={`w-3 h-3 shrink-0 ${userStatus === 'Want to Watch' ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="truncate">Want to Watch</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickSetStatus(media, 'Completed');
              }}
              className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-xl text-[10.5px] font-bold border transition-all ${userStatus === 'Completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm font-extrabold'
                  : 'bg-zinc-950/70 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-300 border-zinc-800/80 hover:border-emerald-500/40'
                }`}
              title="Add / Mark as Completed"
            >
              <CheckCircle2 className={`w-3 h-3 shrink-0 ${userStatus === 'Completed' ? 'text-emerald-400' : ''}`} />
              <span className="truncate">Completed</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
