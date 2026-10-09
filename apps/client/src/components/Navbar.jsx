import React, { useRef, useEffect, useState } from 'react';
import {
  Film,
  Compass,
  BookmarkCheck,
  Bookmark,
  BarChart3,
  Search,
  X,
  Settings,
  Download,
  Sparkles,
  User,
  SlidersHorizontal,
  LogIn,
  LogOut
} from 'lucide-react';

export default function Navbar({
  currentView = 'global', // 'global' | 'want_to_watch' | 'catalog' | 'stats'
  onViewChange,
  searchQuery = '',
  onSearchChange,
  searchMode = 'all', // 'all' | 'title' | 'character'
  onSearchModeChange,
  activeCharacter = '',
  onClearCharacter,
  catalogCount = 0,
  wantToWatchCount = 0,
  watchingCount = 0,
  onOpenSettings,
  onOpenBackup,
  currentUser = null,
  onOpenAuth,
  onLogout
}) {
  const searchInputRef = useRef(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Keyboard shortcut: "/" to focus search bar, "Escape" to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        setShowModeMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPlaceholder = () => {
    if (activeCharacter) return `Filtering by "${activeCharacter}"...`;
    if (searchMode === 'character') return "Search hero, heroine, actor or cast (e.g. Andrew Garfield, Spider-Man)...";
    if (searchMode === 'title') return "Search by title name... ('/' to focus)";
    return "Search movies, series, anime, actors or hero casting... ('/' to focus)";
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-zinc-950/90 border-b border-zinc-800/80 shadow-md shadow-black/40 transition-colors">
      <div className="max-w-[1720px] w-full mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        
        {/* Brand Logo & Workspaces */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <div
            onClick={() => onViewChange('global')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none"
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-red-800 text-white shadow-lg shadow-red-950/60 group-hover:scale-105 group-hover:shadow-red-600/40 transition-all duration-300">
              <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:rotate-6 transition-transform" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/25" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-sm">
                  OMNI<span className="text-red-500 bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">WATCH</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30">
                  2.0
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium hidden md:block">
                Entertainment & Casting Explorer
              </p>
            </div>
          </div>

          {/* Primary Workspace Nav (GLOBAL vs MY CATALOG vs INSIGHTS) - Desktop/Tablet */}
          <nav className="hidden md:flex items-center gap-1.5 pl-2 sm:pl-4 border-l border-zinc-800/80">
            <button
              onClick={() => onViewChange('global')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentView === 'global'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/60 ring-1 ring-red-400/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Global</span>
            </button>

            <button
              onClick={() => onViewChange('want_to_watch')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
                currentView === 'want_to_watch'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-950/60 ring-1 ring-amber-400/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
              }`}
            >
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span>Want to Watch</span>
              {wantToWatchCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {wantToWatchCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onViewChange('catalog')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
                currentView === 'catalog'
                  ? 'bg-zinc-800 text-white shadow-md shadow-zinc-900/60 ring-1 ring-zinc-700'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
              }`}
            >
              <BookmarkCheck className="w-4 h-4 text-emerald-400" />
              <span>My Catalog</span>
              {catalogCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-zinc-700/80 text-zinc-200">
                  {catalogCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onViewChange('stats')}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                currentView === 'stats'
                  ? 'bg-zinc-800 text-white shadow-md ring-1 ring-zinc-700'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Insights</span>
            </button>
          </nav>
        </div>

        {/* Universal Search Bar with Expanded Width & Screen Space Optimization */}
        <div className="flex-1 max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl min-w-0 mx-1 sm:mx-3 relative">
          <div className={`relative flex items-center rounded-xl bg-zinc-900/90 border transition-all shadow-inner ${
            searchMode === 'character' || activeCharacter
              ? 'border-red-500/50 ring-1 ring-red-500/20'
              : 'border-zinc-800 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500/50'
          }`}>
            
            {/* Search Mode Trigger Button */}
            {onSearchModeChange && (
              <div className="relative pl-1.5">
                <button
                  type="button"
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  title={`Current search mode: ${searchMode.toUpperCase()}. Click to change.`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    searchMode === 'character'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : searchMode === 'title'
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  {searchMode === 'character' ? (
                    <User className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className="hidden sm:inline">
                    {searchMode === 'character' ? 'Hero / Cast' : (searchMode === 'title' ? 'Title' : 'All')}
                  </span>
                </button>

                {/* Mode Selector Popover */}
                {showModeMenu && (
                  <div className="absolute top-full left-0 mt-1.5 w-40 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Search Scope
                    </div>
                    {[
                      { id: 'all', label: 'All Sources', icon: Sparkles },
                      { id: 'character', label: 'Hero / Cast', icon: User },
                      { id: 'title', label: 'Title Only', icon: Film }
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = searchMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            onSearchModeChange(mode.id);
                            setShowModeMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left font-semibold transition-colors ${
                            isSelected
                              ? 'bg-red-600/20 text-red-300'
                              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-red-400' : 'text-zinc-500'}`} />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Active Character Filter Pill inside Search */}
            {activeCharacter && (
              <div className="flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold animate-in fade-in duration-200 shrink-0 max-w-[140px] truncate">
                <User className="w-3 h-3 text-red-400 shrink-0" />
                <span className="truncate">{activeCharacter}</span>
                {onClearCharacter && (
                  <button
                    type="button"
                    onClick={onClearCharacter}
                    className="p-0.5 hover:text-white transition-colors"
                    title="Clear character filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm bg-transparent text-zinc-100 placeholder-zinc-500 outline-none transition-all"
            />

            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mr-2 p-1 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions: Backup, Settings & Auth */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenBackup}
            title="Backup / Restore Catalog Data"
            className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden lg:inline">Backup</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Provider Status & Settings"
            className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* User Profile / Sign In */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all shadow-sm"
                title={`Logged in as ${currentUser.email}`}
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-[10px] font-black text-white shadow-inner">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
                <span className="text-xs font-bold max-w-[100px] truncate hidden md:inline">
                  {currentUser.displayName || currentUser.email.split('@')[0]}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                    <p className="text-xs font-bold text-white truncate">{currentUser.displayName || 'OmniWatch User'}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              title="Sign in to isolated personal catalog"
              className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-bold rounded-xl bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 transition-all shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
