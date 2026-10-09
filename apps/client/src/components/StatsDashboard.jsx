import React, { useState, useEffect } from 'react';
import {
  Film,
  Tv,
  Sparkles,
  Star,
  CheckCircle,
  Clock,
  Heart,
  BarChart3,
  Flame,
  ArrowRight,
  TrendingUp,
  Compass,
  Award,
  Zap,
  Bookmark,
  ChevronRight,
  Layers
} from 'lucide-react';
import { getCatalogRecommendations } from '../services/api.js';

export default function StatsDashboard({ stats, onNavigateToCatalog, onNavigateToGlobal, onSelectMedia }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchRecs() {
      try {
        setLoadingRecs(true);
        const res = await getCatalogRecommendations();
        if (isMounted && res.success) {
          setRecommendations(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load taste recommendations:', err);
      } finally {
        if (isMounted) setLoadingRecs(false);
      }
    }
    fetchRecs();
    return () => { isMounted = false; };
  }, []);

  if (!stats) return null;

  const total = stats.totalTitles || 0;
  const watching = stats.byStatus?.['Watching'] || 0;
  const completed = stats.byStatus?.['Completed'] || 0;
  const wantToWatch = stats.byStatus?.['Want to Watch'] || 0;
  const onHold = stats.byStatus?.['On Hold'] || 0;
  const dropped = stats.byStatus?.['Dropped'] || 0;

  const animeCount = stats.byType?.['Anime'] || 0;
  const movieCount = stats.byType?.['Movie'] || 0;
  const seriesCount = stats.byType?.['Series'] || 0;

  const ratingSpread = stats.ratingSpread || {
    averageRating: 0,
    totalRated: 0,
    unrated: 0,
    tier10: 0,
    tier9: 0,
    tier8: 0,
    tier7: 0,
    tierBelow7: 0,
    distribution: []
  };

  const genreDistribution = stats.genreDistribution || [];
  const topGenre = genreDistribution[0] || { genre: 'Varied', percentage: 0 };

  const completionVelocity = stats.completionVelocity || {
    completionRate: 0,
    velocityRating: 'Steady Pacing',
    completedCount: completed
  };

  const topRatedHighlights = stats.topRatedHighlights || [];

  // Determine Persona
  let tastePersona = 'Discerning Connoisseur';
  let personaDesc = 'Curates balanced selections with selective high marks.';
  if (ratingSpread.averageRating >= 9.2) {
    tastePersona = 'Elite Purist';
    personaDesc = 'Uncompromising standards — only true masterpieces earn top marks.';
  } else if (ratingSpread.averageRating >= 8.5) {
    tastePersona = 'Masterpiece Hunter';
    personaDesc = 'Laser-focused on stellar narratives, legendary cinematography, and top-tier worldbuilding.';
  } else if (ratingSpread.totalRated === 0) {
    tastePersona = 'Curating Collector';
    personaDesc = 'Building an expansive library awaiting calibrated rating reviews.';
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* 1. Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                <BarChart3 className="w-4 h-4" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-red-400">
                Taste & Entertainment Intelligence
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Personal Taste Calibration & Insights
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Replacing arbitrary counters with qualitative taste curves, genre affinities, and recommendations calibrated to your highest rated titles.
            </p>
          </div>

          {/* Taste Persona Badge */}
          <div className="flex flex-col items-start md:items-end justify-center p-4 rounded-2xl bg-zinc-900/80 border border-zinc-700/60 shadow-lg w-full sm:w-auto sm:min-w-[220px]">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Award className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Taste Persona</span>
            </div>
            <div className="text-lg font-black text-white">{tastePersona}</div>
            <div className="text-[11px] text-zinc-400 text-left md:text-right max-w-xs">{personaDesc}</div>
          </div>
        </div>
      </div>

      {/* 2. Primary 4-Pillar Taste Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Average Taste Rating */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Calibrated Rating
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {ratingSpread.averageRating > 0 ? ratingSpread.averageRating : '—'}
            </span>
            {ratingSpread.averageRating > 0 && <span className="text-xs font-bold text-zinc-500">/ 10</span>}
          </div>
          <p className="text-[11px] text-zinc-500">
            {ratingSpread.totalRated} rated titles • {ratingSpread.tier10} Masterpieces (10★)
          </p>
        </div>

        {/* Pillar 2: Dominant Genre Affinity */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 relative overflow-hidden group hover:border-red-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Dominant Genre
            </span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white truncate">
            {topGenre.genre}
          </div>
          <p className="text-[11px] text-zinc-500">
            {topGenre.percentage}% of catalog • {topGenre.count || 0} titles
          </p>
        </div>

        {/* Pillar 3: Completion Velocity */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Follow-Through
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {completionVelocity.completionRate}%
            </span>
            <span className="text-xs font-bold text-emerald-400 truncate max-w-[120px]">
              {completionVelocity.velocityRating}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {completionVelocity.completedCount} completed of {total} total titles
          </p>
        </div>

        {/* Pillar 4: Catalog Composition */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Library
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{total}</div>
          <p className="text-[11px] text-zinc-500">
            {animeCount} Anime • {movieCount} Movies • {seriesCount} Shows
          </p>
        </div>
      </div>

      {/* 3. Mid Section: Rating Calibration Curve & Genre Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Rating Spread & Calibration Curve */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Taste Calibration Curve (1-10★)
              </h3>
              <p className="text-xs text-zinc-500">
                Distribution of your subjective rating criteria.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {ratingSpread.totalRated} Rated Titles
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {ratingSpread.distribution?.map((tier) => (
              <div key={tier.score} className="space-y-1.5 p-2 rounded-xl hover:bg-zinc-900/60 transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300">{tier.score}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black">{tier.count}</span>
                    <span className="text-zinc-500 text-[11px] w-10 text-right">({tier.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800/50">
                  <div
                    className={`${tier.color} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(tier.percentage, tier.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            ))}

            {ratingSpread.unrated > 0 && (
              <div className="pt-2 text-right">
                <span className="text-[11px] text-zinc-500">
                  {ratingSpread.unrated} titles pending user score calibration
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Genre Affinity Distribution */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-red-400" />
                Genre Identity & Distribution
              </h3>
              <p className="text-xs text-zinc-500">
                Dominant story archetypes. Click any genre to view in catalog.
              </p>
            </div>
            <span className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer" onClick={() => onNavigateToCatalog && onNavigateToCatalog()}>
              View All →
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {genreDistribution.map((item) => (
              <div
                key={item.genre}
                onClick={() => onNavigateToCatalog && onNavigateToCatalog('All', 'All', item.genre)}
                className="group space-y-1.5 p-2 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-all"
                title={`Filter catalog by ${item.genre}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-300 group-hover:text-red-400 transition-colors">
                      {item.genre}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 transition-opacity">
                      Click to filter
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black">{item.count}</span>
                    <span className="text-zinc-500 text-[11px] w-10 text-right">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800/50">
                  <div
                    className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                    style={{ width: `${Math.max(item.percentage, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Top-Rated Franchise Highlights (Rated 9 or 10★) */}
      {topRatedHighlights.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </span>
                <h3 className="text-base font-black text-white">
                  Top-Rated Vault Highlights (Rated 9★ & 10★)
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Your highest-rated personal masterpieces driving your recommendation profile.
              </p>
            </div>
            <button
              onClick={() => onNavigateToCatalog && onNavigateToCatalog('Completed')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View Completed Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {topRatedHighlights.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectMedia && onSelectMedia(item)}
                className="group relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 hover:border-amber-500/60 cursor-pointer transition-all duration-300 hover:scale-[1.03] shadow-lg flex flex-col"
              >
                {/* Poster */}
                <div className="aspect-[2/3] w-full bg-zinc-900 relative overflow-hidden">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  {/* Rating Tag */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-zinc-950/90 border border-amber-500/50 text-amber-400 text-xs font-black shadow-md flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{item.userRating ? `${item.userRating}★` : 'Fav'}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                  <div className="font-bold text-xs text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{item.mediaType}</span>
                    <span className="text-zinc-400">{item.genres?.[0] || 'Media'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. "More Like This based on your Favorites" Recommendations Showcase */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-zinc-900/70 via-zinc-950 to-zinc-900/70 border border-red-500/30 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-red-500/20 text-red-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base font-black text-white">
                More Like This (Curated from 9-10★ Favorites)
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              Personalized recommendations sharing related cast, directors, and narrative themes with your top-tier rated titles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateToGlobal && onNavigateToGlobal('for_you')}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-red-950/50"
            >
              <span>Explore in Radar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loadingRecs ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-zinc-500">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Analyzing favorites and synthesizing recommendations...</span>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recommendations.slice(0, 8).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onSelectMedia && onSelectMedia(rec)}
                className="group p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-red-500/50 cursor-pointer transition-all duration-300 flex gap-3 shadow-md hover:shadow-red-950/20 hover:scale-[1.01]"
              >
                {/* Poster Thumbnail */}
                <div className="w-20 aspect-[2/3] rounded-xl bg-zinc-900 overflow-hidden flex-shrink-0 relative">
                  {rec.posterUrl ? (
                    <img
                      src={rec.posterUrl}
                      alt={rec.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Film className="w-5 h-5" />
                    </div>
                  )}
                  {rec.rating && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-zinc-950/90 text-amber-400 text-[9px] font-black">
                      ★ {rec.rating}
                    </div>
                  )}
                </div>

                {/* Recommendation Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white truncate group-hover:text-red-400 transition-colors">
                      {rec.title}
                    </h4>

                    {/* Source Trigger Badge */}
                    <div className="text-[10px] font-bold text-amber-400/90 truncate flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">Based on {rec.sourceTitle} (★{rec.sourceRating})</span>
                    </div>

                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {rec.matchReason}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                    {rec.genres?.slice(0, 2).map((g) => (
                      <span key={g} className="px-1.5 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[9px] font-semibold">
                        {g}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold text-red-400 ml-auto flex items-center gap-0.5">
                      View <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-400 space-y-2">
            <p className="text-xs font-bold text-zinc-300">
              No recommendations generated yet.
            </p>
            <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
              Rate your favorite titles with a 9★ or 10★ in your catalog to unlock tailored recommendations!
            </p>
          </div>
        )}
      </div>

      {/* 6. Pipeline & Status Breakdown */}
      <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          Catalog Status Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Watching', count: watching, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
            { label: 'Want to Watch', count: wantToWatch, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
            { label: 'Completed', count: completed, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
            { label: 'On Hold', count: onHold, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
            { label: 'Dropped', count: dropped, color: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700/50' },
            { label: 'Total Tracked', count: total, color: 'text-white', bg: 'bg-zinc-950 border-zinc-800' }
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => onNavigateToCatalog && onNavigateToCatalog(item.label === 'Total Tracked' ? 'All' : item.label)}
              className={`p-3.5 rounded-2xl border ${item.bg} cursor-pointer hover:scale-[1.02] transition-all text-center space-y-1`}
            >
              <div className="text-[11px] font-bold text-zinc-400 truncate">{item.label}</div>
              <div className={`text-xl font-black ${item.color}`}>{item.count}</div>
              <div className="text-[10px] text-zinc-500">
                {total > 0 ? Math.round((item.count / total) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
