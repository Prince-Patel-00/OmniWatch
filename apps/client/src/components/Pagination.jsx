import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Modern Dark-Themed Pagination Component for OmniWatch 2.5
 * Features: First, Prev, Dynamic Page Numbers with Ellipses, Next, and Last controls.
 */
export default function Pagination({
  currentPage = 1,
  hasMore = false,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  totalCount = null,
  isLoading = false
}) {
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoPrev = currentPage > 1;
  const canGoNext = totalPages ? currentPage < totalPages : hasMore;

  // Generate smart page numbers around current page
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
    if (totalPages && page > totalPages) return;
    onPageChange(page);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-3.5 sm:py-5 px-2.5 sm:px-6 my-4 sm:my-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md shadow-xl w-full min-w-0 overflow-hidden">
      
      {/* Left: Page & Total Items Info */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 order-2 sm:order-1 w-full sm:w-auto">
        <span className="flex items-center gap-1.5 sm:gap-2 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50" />
          <span>Page</span>
          <strong className="text-white font-black px-1.5 sm:px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700/80 shadow-inner">
            {currentPage}
          </strong>
          {totalPages && (
            <span>
              of <strong className="text-zinc-200">{totalPages}</strong>
            </span>
          )}
        </span>

        {totalCount !== null && (
          <span className="hidden md:inline text-xs text-zinc-500 pl-2 border-l border-zinc-800">
            ({totalCount} total items)
          </span>
        )}

        {onPageSizeChange && (
          <div className="flex items-center gap-1 sm:gap-1.5 pl-2 sm:pl-3 border-l border-zinc-800 text-xs text-zinc-400">
            <span className="hidden sm:inline">Per page:</span>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition-all ${
                  pageSize === size
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: First, Prev, Numbers, Next, Last Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 order-1 sm:order-2 flex-wrap justify-center min-w-0">
        {/* First Page Button - desktop only */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={!canGoPrev || isLoading}
          title="First Page"
          className="hidden sm:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition-all bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={!canGoPrev || isLoading}
          title="Previous Page"
          className="flex items-center gap-1 px-2 sm:px-3 h-7 sm:h-9 rounded-xl text-xs font-bold transition-all bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Prev</span>
        </button>

        {/* Ellipsis before page window */}
        {pageNumbers.length > 0 && pageNumbers[0] > 1 && (
          <span className="px-0.5 sm:px-1 text-zinc-600 text-xs font-bold select-none">•••</span>
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
              className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-xs sm:text-sm font-black transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/60 scale-105 border border-red-400/50 ring-1 ring-red-400/30'
                  : 'bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white active:scale-95'
              }`}
            >
              {page}
            </button>
          );
        })}

        {/* Ellipsis after page window */}
        {totalPages && pageNumbers.length > 0 && pageNumbers[pageNumbers.length - 1] < totalPages && (
          <span className="px-0.5 sm:px-1 text-zinc-600 text-xs font-bold select-none">•••</span>
        )}
        {!totalPages && canGoNext && (
          <span className="px-0.5 sm:px-1 text-zinc-600 text-xs font-bold select-none">•••</span>
        )}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={!canGoNext || isLoading}
          title="Next Page"
          className="flex items-center gap-1 px-2 sm:px-3 h-7 sm:h-9 rounded-xl text-xs font-bold transition-all bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Last Page Button - desktop only */}
        {totalPages && (
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            title={`Last Page (${totalPages})`}
            className="hidden sm:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition-all bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>

    </div>
  );
}
