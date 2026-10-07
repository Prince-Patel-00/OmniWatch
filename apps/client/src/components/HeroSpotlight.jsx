import React from 'react';
import {
  Play,
  Plus,
  Star,
  Clock,
  Sparkles,
  BookmarkCheck,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Tv,
  User
} from 'lucide-react';
import { formatTimeUntil } from '@omniwatch/shared';

export default function HeroSpotlight({
  media,
  catalogEntry = null,
  onOpenDetail,
  onWatchTrailer,
  onAddOrUpdateCatalog,
  onQuickSetStatus,
  onSelectCharacter
}) {
  if (!media) return null;

  const timeUntilAiring = media.nextAiringAt ? formatTimeUntil(media.nextAiringAt) : null;
  const hasTrailer = (media.trailers && media.trailers.length > 0) || Boolean(media.trailerUrl);
  const primaryTrailerKey = media.trailers?.[0]?.videoKey;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-2xl mb-8 group">
      {/* Background Backdrop with Gradient Fades */}
      <div className="relative w-full h-[360px] sm:h-[420px] md:h-[480px] overflow-hidden">
        <img
          src={media.backdropUrl || media.bannerUrl || media.posterUrl}
          alt={media.title}
          className="w-full h-full object-cover object-center filter brightness-[0.55] transition-transform duration-700 group-hover:scale-105"
        />
        {/* Layered gradients for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent w-full md:w-3/4" />
      </div>

      {/* Floating Content Layer */}
      <div className="absolute inset-0 p-6 sm:p-8 md:p-12 flex flex-col justify-end">
        <div className="max-w-3xl space-y-4">

          {/* Badges Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-md shadow-red-950/50">
              <Sparkles className="w-3.5 h-3.5" />
              Spotlight • {media.mediaType}
            </span>

            {media.rating && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {media.rating.toFixed(1)}
              </span>
            )}

            {media.releaseYear && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900/90 text-zinc-300 border border-zinc-800">
                {media.releaseYear}
              </span>
            )}

            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${media.status === 'Airing'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
              }`}>
              {media.status}
            </span>

            {/* Live countdown pill */}
            {timeUntilAiring && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-950/70 text-red-300 border border-red-800/60 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                Next Ep {timeUntilAiring}
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-md">
              {media.title}
            </h1>
            {media.originalTitle && media.originalTitle !== media.title && (
              <p className="text-sm sm:text-base text-zinc-400 font-medium mt-1">
                {media.originalTitle}
              </p>
            )}
          </div>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {media.genres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-900/80 text-zinc-300 border border-zinc-800/80"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis preview */}
          {media.synopsis && (
            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 sm:line-clamp-3 max-w-2xl leading-relaxed">
              {media.synopsis}
            </p>
          )}

          {/* Lead / Main Characters Showcase */}
          {(() => {
            const chars = media.mainCharacters || (media.cast || []).filter(c => c.role === 'MAIN');
            const displayList = (chars && chars.length > 0 ? chars : (media.cast || [])).slice(0, 3);
            if (!displayList || displayList.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <User className="w-3.5 h-3.5 text-red-400" />
                  Lead Characters:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {displayList.map((c, i) => {
                    const cName = c.name || c.character;
                    const cImg = c.image || c.characterImage || c.actorImage;
                    if (!cName) return null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCharacter) onSelectCharacter(cName);
                        }}
                        title={`Filter all titles featuring ${cName}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          onSelectCharacter 
                            ? 'bg-zinc-900/85 hover:bg-red-950/60 text-zinc-200 hover:text-white border-zinc-700/70 hover:border-red-500/50 cursor-pointer shadow-sm hover:scale-105 active:scale-95'
                            : 'bg-zinc-900/60 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        {cImg ? (
                          <img src={cImg} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/20" />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {cName.charAt(0)}
                          </span>
                        )}
                        <span>{cName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Open Detail */}
            <button
              onClick={() => onOpenDetail(media)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs sm:text-sm shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span>Explore Title</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Play Trailer */}
            {hasTrailer && (
              <button
                onClick={() => onWatchTrailer(primaryTrailerKey, media.title)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs sm:text-sm border border-red-500/40 shadow-lg shadow-red-950/60 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Trailer</span>
              </button>
            )}

            {/* Direct Quick Action Buttons for Want to Watch and Completed */}
            {onQuickSetStatus && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onQuickSetStatus(media, 'Want to Watch')}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
                    catalogEntry?.userStatus === 'Want to Watch'
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-md font-black'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border-zinc-700/80 hover:border-amber-500/40'
                  }`}
                  title="Add / Mark as Want to Watch"
                >
                  <Bookmark className={`w-4 h-4 ${catalogEntry?.userStatus === 'Want to Watch' ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>Want to Watch</span>
                </button>

                <button
                  onClick={() => onQuickSetStatus(media, 'Completed')}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
                    catalogEntry?.userStatus === 'Completed'
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-md font-black'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-300 border-zinc-700/80 hover:border-emerald-500/40'
                  }`}
                  title="Add / Mark as Completed"
                >
                  <CheckCircle2 className={`w-4 h-4 ${catalogEntry?.userStatus === 'Completed' ? 'text-emerald-400' : ''}`} />
                  <span>Completed</span>
                </button>
              </div>
            )}

            {/* Catalog Status pill if title has any other status (e.g., Watching, On Hold) */}
            {catalogEntry && !['Want to Watch', 'Completed'].includes(catalogEntry.userStatus) && (
              <div
                onClick={() => onOpenDetail(media)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-emerald-400 font-bold text-xs sm:text-sm border border-emerald-500/30 cursor-pointer transition-all"
              >
                <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                <span>In Catalog: {catalogEntry.userStatus}</span>
                {catalogEntry.currentEpisode > 0 && (
                  <span className="text-xs text-zinc-400 font-normal">
                    (Ep {catalogEntry.currentEpisode})
                  </span>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
