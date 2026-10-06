import React from 'react';

/**
 * Modern Dark-Themed Pagination Component for OmniWatch
 * Handles multi-page browsing across Global discovery & My Catalog
 */
export default function Pagination({
  currentPage = 1,
  hasMore = false,
  pageSize = 24,
  onPageChange,
  onPageSizeChange,
  totalCount = null,
  isLoading = false
}) {
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoNext = totalPages ? currentPage < totalPages : hasMore;

  // Generate intelligent page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;

    let start = Math.max(1, currentPage - 2);
    let end = start + maxButtons - 1;

    if (totalPages) {
      end = Math.min(end, totalPages);
      if (end - start + 1 < maxButtons) {
        start = Math.max(1, end - maxButtons + 1);
      }
    } else if (!hasMore && end > currentPage) {
      end = currentPage;
    }

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageClick = (page) => {
    if (page === currentPage || page < 1 || isLoading) return;
    onPageChange(page);
    // Smooth scroll to top of media container
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8 px-4 sm:px-6 my-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md">
      
      {/* Page Info & Size Selector */}
      <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-400 order-2 sm:order-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Page <strong className="text-white font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60">{currentPage}</strong>
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-800 text-xs text-zinc-400">
            <span>Titles per page:</span>
            {[24, 48].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                  pageSize === size
                    ? 'bg-zinc-700 text-white font-bold'
                    : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous Page"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-900 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden xs:inline">Prev</span>
        </button>

        {/* First Page Link if scrolled far */}
        {currentPage > 3 && (
          <>
            <button
              type="button"
              onClick={() => handlePageClick(1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-all bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white active:scale-95"
            >
              1
            </button>
            {currentPage > 4 && <span className="px-1 text-zinc-600 text-xs">•••</span>}
          </>
        )}

        {/* Numbered Page Buttons */}
        {pageNumbers.map((page) => {
          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              onClick={() => handlePageClick(page)}
              disabled={isLoading}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/60 scale-105 border border-red-500/40'
                  : 'bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white active:scale-95'
              }`}
            >
              {page}
            </button>
          );
        })}

        {/* More pages indicator */}
        {canGoNext && (
          <span className="px-1 text-zinc-600 text-xs">•••</span>
        )}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={!canGoNext || isLoading}
          aria-label="Next Page"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-900 active:scale-95"
        >
          <span className="hidden xs:inline">Next</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  );
}
