import React, { useState } from 'react';
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
  Tv,
  User,
  Search,
  X,
  Check
} from 'lucide-react';
import {
  MEDIA_TYPES_LIST,
  USER_WATCH_STATUSES_LIST,
  GENRES,
  SORT_OPTIONS,
  GLOBAL_SORT_OPTIONS
} from '@omniwatch/shared';

// Top popular heroes, heroines and lead actors for instant one-click filtering
const POPULAR_LEAD_CAST = [
  { name: 'Andrew Garfield', label: '🕷️ Andrew Garfield' },
  { name: 'Spider-Man', label: '🕸️ Spider-Man' },
  { name: 'Walter White', label: '🧪 Walter White' },
  { name: 'Cillian Murphy', label: '💣 Cillian Murphy' },
  { name: 'Tom Cruise', label: '✈️ Tom Cruise' },
  { name: 'Luffy', label: '🏴‍☠️ Luffy' },
  { name: 'Eren Yeager', label: '⚔️ Eren' },
  { name: 'Frieren', label: '🧙‍♀️ Frieren' },
  { name: 'Gojo', label: '⚡ Gojo' },
  { name: 'Keanu Reeves', label: '🕶️ Keanu Reeves' },
];

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
  activeCharacter = '',
  onCharacterSelect,
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
  const isCatalog = currentView === 'catalog' || currentView === 'want_to_watch';
  const isWantToWatch = currentView === 'want_to_watch';
  const [showCustomCharInput, setShowCustomCharInput] = useState(false);
  const [charSearchInput, setCharSearchInput] = useState('');

  const handleCustomCharSubmit = (e) => {
    e.preventDefault();
    if (charSearchInput.trim() && onCharacterSelect) {
      onCharacterSelect(charSearchInput.trim());
      setShowCustomCharInput(false);
      setCharSearchInput('');
    }
  };

  const hasAnyFilterActive =
    activeType !== 'All' ||
    activeGenre !== 'All' ||
    activeStatus !== 'All' ||
    favoriteOnly ||
    Boolean(activeCharacter) ||
    (activeType === 'Anime' && animeSubTab !== 'All');

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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isActive
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isSubActive
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none flex-nowrap">
            <button
              onClick={() => onGlobalTabChange('trending')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${globalTab === 'trending'
                ? 'bg-red-600/15 text-red-400 border-red-500/40 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
            >
              <Flame className="w-3.5 h-3.5 text-red-500" />
              <span>Trending Now</span>
            </button>
            <button
              onClick={() => onGlobalTabChange('upcoming')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${globalTab === 'upcoming'
                ? 'bg-red-600/15 text-red-400 border-red-500/40 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Upcoming Radar</span>
            </button>
            <button
              onClick={() => onGlobalTabChange('for_you')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${globalTab === 'for_you'
                ? 'bg-gradient-to-r from-red-600/25 to-amber-600/25 text-amber-300 border-amber-500/50 shadow-md shadow-amber-950/30'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-amber-300'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>More Like This (Favorites)</span>
            </button>

            {/* Hide Saved Toggle with Micro Switch */}
            {onToggleHideInCatalog && (
              <button
                onClick={onToggleHideInCatalog}
                className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 shadow-sm ${hideInCatalog
                  ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500/40 hover:bg-emerald-900/40 shadow-emerald-950/20 ring-1 ring-emerald-500/20'
                  : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                title={
                  hideInCatalog
                    ? `Currently hiding all ${totalSavedCount || hiddenCount} saved catalog titles from Global discovery. Click to reveal.`
                    : `Currently showing all titles including your ${totalSavedCount || hiddenCount} saved catalog titles. Click to hide saved.`
                }
              >
                <div className={`p-1 rounded-lg transition-colors ${hideInCatalog ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                  }`}>
                  {hideInCatalog ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </div>
                <span>Hide Saved</span>

                {/* Total Saved Count Badge */}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors ${hideInCatalog
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                  }`}>
                  {totalSavedCount !== undefined ? totalSavedCount : hiddenCount}
                </span>

                {/* Animated Micro Toggle Switch */}
                <div
                  className={`w-7 h-4 rounded-full flex items-center transition-colors p-0.5 ${hideInCatalog ? 'bg-emerald-500 justify-end shadow-sm shadow-emerald-500/50' : 'bg-zinc-800 justify-start border border-zinc-700'
                    }`}
                >
                  <div className={`w-3 h-3 rounded-full transition-transform ${hideInCatalog ? 'bg-white shadow' : 'bg-zinc-400'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${favoriteOnly
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
      {isCatalog && !isWantToWatch && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', ...USER_WATCH_STATUSES_LIST.filter(s => s !== 'Want to Watch')].map((status) => {
            const isSelected = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => onStatusSelect(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${isSelected
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

      {/* Want to Watch Header Badge */}
      {isWantToWatch && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Dedicated Watchlist (Want to Watch)</span>
          </div>
        </div>
      )}

      {/* Main Character Filter Carousel / Pill Strip */}
      <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-inner space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
            <div className="p-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
              <User className="w-3.5 h-3.5" />
            </div>
            <span>Filter by Hero, Heroine or Casting:</span>
            {activeCharacter && (
              <span className="text-[11px] font-normal text-zinc-400">
                (Showing titles starring <strong className="text-white">{activeCharacter}</strong>)
              </span>
            )}
          </div>

          {/* Custom character search popup trigger */}
          <div className="relative">
            {!showCustomCharInput ? (
              <button
                type="button"
                onClick={() => setShowCustomCharInput(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all"
              >
                <Search className="w-3 h-3 text-red-400" />
                <span>Search Actor or Hero...</span>
              </button>
            ) : (
              <form onSubmit={handleCustomCharSubmit} className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                <input
                  type="text"
                  autoFocus
                  value={charSearchInput}
                  onChange={(e) => setCharSearchInput(e.target.value)}
                  placeholder="e.g. Andrew Garfield, Batman, Zendaya..."
                  className="px-2.5 py-1 text-xs rounded-lg bg-zinc-950 border border-red-500/50 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500 w-52"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomCharInput(false)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Character Quick-Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
          {POPULAR_LEAD_CAST.map((char) => {
            const isSelected = activeCharacter.toLowerCase() === char.name.toLowerCase();
            return (
              <button
                key={char.name}
                type="button"
                onClick={() => {
                  if (onCharacterSelect) {
                    onCharacterSelect(isSelected ? '' : char.name);
                  }
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${isSelected
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500 shadow-md shadow-red-950/40 ring-1 ring-red-400/40'
                  : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700'
                  }`}
              >
                <span>{char.label}</span>
                {isSelected && <X className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}

          {/* Active custom character pill if not in presets */}
          {activeCharacter && !POPULAR_LEAD_CAST.some(c => c.name.toLowerCase() === activeCharacter.toLowerCase()) && (
            <button
              type="button"
              onClick={() => onCharacterSelect && onCharacterSelect('')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 text-white border border-red-400 shadow-md shadow-red-950/50 whitespace-nowrap shrink-0"
            >
              <User className="w-3 h-3" />
              <span>{activeCharacter}</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}

          {activeCharacter && (
            <button
              type="button"
              onClick={() => onCharacterSelect && onCharacterSelect('')}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 whitespace-nowrap shrink-0"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Summary Strip (appears when any filter is active) */}
      {hasAnyFilterActive && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mr-1">
            Active Filters:
          </span>

          {activeType !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
              <span>Type: {activeType}</span>
              <button type="button" onClick={() => onTypeSelect('All')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeType === 'Anime' && animeSubTab !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
              <span>Format: {animeSubTab}</span>
              <button type="button" onClick={() => onAnimeSubTabChange && onAnimeSubTabChange('All')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeGenre !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
              <span>Genre: {activeGenre}</span>
              <button type="button" onClick={() => onGenreSelect('All')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeCharacter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-red-950/80 text-red-200 border border-red-500/40 font-bold">
              <User className="w-3 h-3 text-red-400" />
              <span>Lead: {activeCharacter}</span>
              <button type="button" onClick={() => onCharacterSelect && onCharacterSelect('')} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {isCatalog && activeStatus !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-emerald-300 border border-emerald-500/30 font-semibold">
              <span>Status: {activeStatus}</span>
              <button type="button" onClick={() => onStatusSelect('All')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {favoriteOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-950/70 text-rose-300 border border-rose-500/40 font-semibold">
              <Heart className="w-3 h-3 fill-rose-400" />
              <span>Favorites Only</span>
              <button type="button" onClick={onToggleFavorite} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 underline decoration-red-500/40 hover:decoration-red-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
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
        </div>

        {/* Result Counter */}
        <div className="text-zinc-500 text-xs font-medium">
          Showing <span className="font-bold text-zinc-300">{resultCount}</span> titles
        </div>
      </div>
    </div>
  );
}
