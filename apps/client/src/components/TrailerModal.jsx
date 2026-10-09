import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function TrailerModal({ isOpen, videoKey, title, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !videoKey) return null;

  // Extract video ID if full URL passed
  let cleanKey = videoKey;
  if (videoKey.includes('v=')) {
    cleanKey = videoKey.split('v=')[1]?.split('&')[0];
  } else if (videoKey.includes('youtu.be/')) {
    cleanKey = videoKey.split('youtu.be/')[1]?.split('?')[0];
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${cleanKey}?autoplay=1&modestbranding=1&rel=0`;
  const watchUrl = `https://www.youtube.com/watch?v=${cleanKey}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-zinc-950 rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-950 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-md">
              {title ? `${title} - Trailer` : 'Trailer Preview'}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
              title="Open in YouTube"
            >
              <span className="hidden sm:inline">Watch on </span>
              <span>YouTube</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={title || 'Trailer'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
