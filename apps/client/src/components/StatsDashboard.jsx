import React from 'react';
import {
  Film,
  Tv,
  Sparkles,
  Clock,
  CheckCircle,
  Eye,
  Bookmark,
  Heart,
  BarChart3,
  Flame,
  ArrowRight
} from 'lucide-react';

export default function StatsDashboard({ stats, onNavigateToCatalog, onNavigateToGlobal }) {
  if (!stats) return null;

  const total = stats.totalTitles || 0;
  const watching = stats.byStatus?.['Watching'] || 0;
  const completed = stats.byStatus?.['Completed'] || 0;
  const wantToWatch = stats.byStatus?.['Want to Watch'] || 0;
  const onHold = stats.byStatus?.['On Hold'] || 0;
  const dropped = stats.byStatus?.['Dropped'] || 0;
  const rewatching = stats.byStatus?.['Rewatching'] || 0;

  const animeCount = stats.byType?.['Anime'] || 0;
  const movieCount = stats.byType?.['Movie'] || 0;
  const seriesCount = stats.byType?.['Series'] || 0;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">
              Personal Entertainment Vault
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Watch Archive & Activity Insights
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Real-time analytics across your lifetime anime, movie, and series collection.
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Titles */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Tracked Titles
            </span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{total}</div>
          <p className="text-[11px] text-zinc-500">Across all categories</p>
        </div>

        {/* KPI 2: Hours Watched */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Watch Time
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">~{stats.estimatedHoursWatched || 0} hrs</div>
          <p className="text-[11px] text-zinc-500">Calculated from logged runtime</p>
        </div>

        {/* KPI 3: Watched Episodes */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Episodes Checked
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{stats.watchedEpisodesCount || 0}</div>
          <p className="text-[11px] text-zinc-500">Checked off in episode guide</p>
        </div>

        {/* KPI 4: Completion Rate */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{completionRate}%</div>
          <p className="text-[11px] text-zinc-500">{completed} completed of {total}</p>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
            Catalog Status Distribution
          </h3>

          <div className="space-y-3">
            {[
              { label: 'Watching', count: watching, color: 'bg-emerald-500', text: 'text-emerald-400' },
              { label: 'Want to Watch', count: wantToWatch, color: 'bg-sky-500', text: 'text-sky-400' },
              { label: 'Completed', count: completed, color: 'bg-purple-500', text: 'text-purple-400' },
              { label: 'On Hold', count: onHold, color: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Dropped', count: dropped, color: 'bg-zinc-600', text: 'text-zinc-400' },
              { label: 'Rewatching', count: rewatching, color: 'bg-rose-500', text: 'text-rose-400' }
            ].map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div
                  key={item.label}
                  onClick={() => onNavigateToCatalog(item.label)}
                  className="space-y-1.5 cursor-pointer p-2 rounded-xl hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${item.text}`}>{item.label}</span>
                    <span className="text-zinc-400 font-semibold">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Media Type Breakdown */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
            Media Format Breakdown
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div
              onClick={() => onNavigateToCatalog('All', 'Anime')}
              className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-red-500/40 cursor-pointer text-center space-y-1 transition-all"
            >
              <span className="text-xs text-zinc-400 font-semibold">Anime</span>
              <div className="text-2xl font-black text-red-400">{animeCount}</div>
              <span className="text-[10px] text-zinc-500">
                {total > 0 ? Math.round((animeCount / total) * 100) : 0}%
              </span>
            </div>

            <div
              onClick={() => onNavigateToCatalog('All', 'Movie')}
              className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-500/40 cursor-pointer text-center space-y-1 transition-all"
            >
              <span className="text-xs text-zinc-400 font-semibold">Movies</span>
              <div className="text-2xl font-black text-amber-400">{movieCount}</div>
              <span className="text-[10px] text-zinc-500">
                {total > 0 ? Math.round((movieCount / total) * 100) : 0}%
              </span>
            </div>

            <div
              onClick={() => onNavigateToCatalog('All', 'Series')}
              className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-purple-500/40 cursor-pointer text-center space-y-1 transition-all"
            >
              <span className="text-xs text-zinc-400 font-semibold">Series</span>
              <div className="text-2xl font-black text-purple-400">{seriesCount}</div>
              <span className="text-[10px] text-zinc-500">
                {total > 0 ? Math.round((seriesCount / total) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
            <button
              onClick={() => onNavigateToGlobal()}
              className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300"
            >
              <span>Discover more in Global</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToCatalog('Watching')}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
            >
              <span>View Currently Watching ({watching})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
