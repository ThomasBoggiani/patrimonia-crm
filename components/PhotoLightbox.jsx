'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

export default function PhotoLightbox({ photos = [], initialIndex = 0, mandatNom, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Normalise : accepte tableau de strings OU d'objets {url}
  const photoUrls = (Array.isArray(photos) ? photos : [])
    .map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') return p.url || p.src || null;
      return null;
    })
    .filter(Boolean);

  const total = photoUrls.length;

  // Navigation par clavier (← → Esc)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIdx, total]);

  function prev() {
    setCurrentIdx(i => (i - 1 + total) % total);
  }
  function next() {
    setCurrentIdx(i => (i + 1) % total);
  }
  function toggleFullscreen() {
    setIsFullscreen(f => !f);
  }

  if (total === 0) return null;

  const currentUrl = photoUrls[currentIdx];

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-6 py-4 text-white" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="font-display text-lg font-medium">{mandatNom || 'Galerie photos'}</div>
            <div className="text-sm text-white/60">
              {currentIdx + 1} / {total}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullscreen} title="Plein \u00e9cran (F)" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
              <Maximize2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} title="Fermer (Echap)" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center px-4 relative" onClick={(e) => e.stopPropagation()}>
        <img
          src={currentUrl}
          alt={`Photo ${currentIdx + 1}`}
          className={`max-w-full max-h-full object-contain ${isFullscreen ? 'cursor-zoom-out' : ''}`}
          onClick={toggleFullscreen}
        />

        {/* Fl\u00e8che gauche */}
        {total > 1 && (
          <button
            onClick={prev}
            title="Pr\u00e9c\u00e9dente (\u2190)"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        {/* Fl\u00e8che droite */}
        {total > 1 && (
          <button
            onClick={next}
            title="Suivante (\u2192)"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}

        {/* Bouton sortir fullscreen */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            title="Quitter plein \u00e9cran (F)"
            className="absolute top-4 right-4 p-2 rounded-lg bg-black/40 hover:bg-black/60 text-white/80 hover:text-white"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Thumbnails strip */}
      {!isFullscreen && total > 1 && (
        <div className="px-6 py-3 bg-black/60 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 justify-center">
            {photoUrls.map((url, idx) => (
              <button
                key={url + idx}
                onClick={() => setCurrentIdx(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${idx === currentIdx ? 'border-white opacity-100 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      {!isFullscreen && (
        <div className="text-center text-xs text-white/40 py-2">
          &larr; &rarr; pour naviguer &middot; F pour plein &eacute;cran &middot; Echap pour fermer
        </div>
      )}
    </div>
  );
}
