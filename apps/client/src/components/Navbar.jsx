import React, { useRef, useEffect } from 'react';
import {
  Film,
  Compass,
  BookmarkCheck,
  BarChart3,
  Search,
  X,
  Settings,
  Download,
  Sparkles
} from 'lucide-react';

export default function Navbar({
  currentView = 'global', // 'global' | 'catalog' | 'stats'
  onViewChange,
  searchQuery = '',
  onSearchChange,
  catalogCount = 0,
  watchingCount = 0,
  onOpenSettings,
  onOpenBackup
}) {
  const searchInputRef = useRef(null);

  // Keyboard shortcut: "/" to focus search bar, "Escape" to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-zinc-950/85 border-b border-zinc-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        
        {/* Brand Logo & Workspaces */}
        <div className="flex items-center gap-6 shrink-0">
          <div
            onClick={() => onViewChange('global')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-red-800 text-white shadow-lg shadow-red-950/50 group-hover:scale-105 group-hover:shadow-red-600/30 transition-all duration-300">
              <Film className="w-5 h-5 text-white group-hover:rotate-6 transition-transform" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-white">
                  OMNI<span className="text-red-500">WATCH</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
                  Hub
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium hidden md:block">
                Personal Entertainment & Watchlist
              </p>
            </div>
          </div>

          {/* Primary Workspace Nav (GLOBAL vs MY CATALOG vs INSIGHTS) */}
          <nav className="flex items-center gap-1.5 pl-2 sm:pl-4 border-l border-zinc-800/80">
            <button
              onClick={() => onViewChange('global')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentView === 'global'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/60 ring-1 ring-red-400/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Global</span>
            </button>

            <button
              onClick={() => onViewChange('catalog')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
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
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
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

        {/* Universal Search Bar */}
        <div className="flex-1 max-w-md mx-2 sm:mx-4 relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search anime, movies, series... ('/' to focus)"
              className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl bg-zinc-900/90 hover:bg-zinc-900 text-zinc-100 placeholder-zinc-500 border border-zinc-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 p-1 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions: Backup & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenBackup}
            title="Backup / Restore Catalog Data"
            className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden lg:inline">Backup</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Provider Status & Settings"
            className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

      </div>
    </header>
  );
}
