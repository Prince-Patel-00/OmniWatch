import React from 'react';
import {
  SlidersHorizontal,
  Flame,
  Calendar,
  Star,
  Heart,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  Film,
  Tv
} from 'lucide-react';
import {
  MEDIA_TYPES_LIST,
  USER_WATCH_STATUSES_LIST,
  GENRES,
  SORT_OPTIONS,
  GLOBAL_SORT_OPTIONS,
  ANIME_SUB_TABS
} from '@omniwatch/shared';

export default function FilterBar({
  currentView = 'global', // 'global' | 'catalog'
  activeType = 'All',
  onTypeSelect,
  animeSubTab = 'All', // 'All' | 'Series' | 'Movie'
  onAnimeSubTabChange,
  activeStatus = 'All',
  onStatusSelect,
  activeGenre = 'All',
  onGenreSelect,
  activeSort = 'popularity_desc',
  onSortSelect,
  favoriteOnly = false,
  onToggleFavorite,
  onResetFilters,
  resultCount = 0,
  globalTab = 'trending', // 'trending' | 'upcoming'
  onGlobalTabChange,
  hideInCatalog = true,
  onToggleHideInCatalog,
  hiddenCount = 0,
  totalSavedCount = 0
}) {
  const isCatalog = currentView === 'catalog';

  return (
    <div className="space-y-4 mb-6">
      {/* Top Filter Row: Media Types, Anime Sub-tabs & Discovery Modes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Media Type Tabs & Anime Sub-tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Media Type Tabs: All, Anime, Movie, Series */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800/80 max-w-fit shadow-inner">
            {['All', ...MEDIA_TYPES_LIST].map((type) => {
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => onTypeSelect(type)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-md shadow-red-950/50'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  {type === 'Movie' ? 'Movies' : type}
                </button>
              );
            })}
          </div>

          {/* Anime Dedicated Sub-tabs: All Anime, Series, Movies */}
          {activeType === 'Anime' && (
            <div className="flex items-center gap-1 p-1 bg-zinc-900/95 rounded-2xl border border-red-500/30 max-w-fit shadow-md shadow-red-950/20 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-[10px] font-black text-red-400 px-2 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-red-400" />
                Anime:
              </span>
              {[
                { id: 'All', label: 'All Anime' },
                { id: 'Series', label: 'Series', icon: Tv },
                { id: 'Movie', label: 'Movies', icon: Film }
              ].map((sub) => {
                const isSubActive = animeSubTab === sub.id;
                const Icon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onAnimeSubTabChange && onAnimeSubTabChange(sub.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSubActive
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Sub-tabs (Trending vs Upcoming) OR Catalog Status Chips */}
        {!isCatalog ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onGlobalTabChange('trending')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                globalTab === 'trending'
                  ? 'bg-red-600/15 text-red-400 border-red-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-red-500" />
              <span>Trending Now</span>
            </button>
            <button
              onClick={() => onGlobalTabChange('upcoming')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                globalTab === 'upcoming'
                  ? 'bg-red-600/15 text-red-400 border-red-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Upcoming Radar</span>
            </button>

            {/* Redesigned Premium Hide Saved Toggle with Micro Switch and accurate catalog count */}
            {onToggleHideInCatalog && (
              <button
                onClick={onToggleHideInCatalog}
                className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 shadow-sm ${
                  hideInCatalog
                    ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500/40 hover:bg-emerald-900/40 shadow-emerald-950/20 ring-1 ring-emerald-500/20'
                    : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
                title={
                  hideInCatalog
                    ? `Currently hiding all ${totalSavedCount || hiddenCount} saved catalog titles from Global discovery. Click to reveal.`
                    : `Currently showing all titles including your ${totalSavedCount || hiddenCount} saved catalog titles. Click to hide saved.`
                }
              >
                <div className={`p-1 rounded-lg transition-colors ${
                  hideInCatalog ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                }`}>
                  {hideInCatalog ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </div>
                <span>Hide Saved</span>

                {/* Total Saved Count Badge */}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors ${
                  hideInCatalog
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                }`}>
                  {totalSavedCount !== undefined ? totalSavedCount : hiddenCount}
                </span>

                {/* Animated Micro Toggle Switch */}
                <div
                  className={`w-7 h-4 rounded-full flex items-center transition-colors p-0.5 ${
                    hideInCatalog ? 'bg-emerald-500 justify-end shadow-sm shadow-emerald-500/50' : 'bg-zinc-800 justify-start border border-zinc-700'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full transition-transform ${
                    hideInCatalog ? 'bg-white shadow' : 'bg-zinc-400'
                  }`} />
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Favorites filter toggle */}
            <button
              onClick={onToggleFavorite}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                favoriteOnly
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md'
                  : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-rose-400'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoriteOnly ? 'fill-rose-400 text-rose-400' : ''}`} />
              <span>Favorites Only</span>
            </button>
          </div>
        )}
      </div>

      {/* Catalog Status Tabs (when in My Catalog) */}
      {isCatalog && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', ...USER_WATCH_STATUSES_LIST].map((status) => {
            const isSelected = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => onStatusSelect(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-zinc-800 text-emerald-400 border-emerald-500/40 shadow-md font-bold'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      )}

      {/* Secondary Controls: Genre, Sort & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/50 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Genre Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Genre:</span>
            <select
              value={activeGenre}
              onChange={(e) => onGenreSelect(e.target.value)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="All">All Genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Sort By:</span>
            <select
              value={activeSort}
              onChange={(e) => onSortSelect(e.target.value)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-red-500 cursor-pointer"
            >
              {(isCatalog ? SORT_OPTIONS : GLOBAL_SORT_OPTIONS).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          {(activeType !== 'All' || activeGenre !== 'All' || activeStatus !== 'All' || favoriteOnly || (activeType === 'Anime' && animeSubTab !== 'All')) && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 underline-offset-2 ml-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Result Counter */}
        <div className="text-zinc-500 text-xs font-medium">
          Showing <span className="font-bold text-zinc-300">{resultCount}</span> titles
        </div>
      </div>
    </div>
  );
}
