import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  MessageSquareShare,
  Trash2,
  Star,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { GalleryItem } from '../../types';

interface ImageViewerModalProps {
  item: GalleryItem | null;
  items: GalleryItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onContinueInChat: (item: GalleryItem) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  item,
  items,
  isOpen,
  onClose,
  onSelectNext,
  onSelectPrev,
  onToggleFavorite,
  onDelete,
  onContinueInChat,
}) => {
  // Viewer modes: 'inspect' (cards & tools visible) vs 'focus' (zero chrome, edge-to-edge art)
  const [mode, setMode] = useState<'inspect' | 'focus'>('inspect');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);

  // Touch gesture state
  const touchStartRef = useRef<{ x: number; y: number; time: number; dist?: number }>({
    x: 0,
    y: 0,
    time: 0,
  });
  const isDraggingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Reset zoom & pan when item changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setMode('inspect');
  }, [item?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onSelectNext();
      if (e.key === 'ArrowLeft') onSelectPrev();
      if (e.key === 'f') setMode((m) => (m === 'focus' ? 'inspect' : 'focus'));
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(8, z * 1.3));
      if (e.key === '-') setZoom((z) => Math.max(1, z / 1.3));
      if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectNext, onSelectPrev]);

  // Copy prompt helper
  const handleCopyPrompt = () => {
    if (!item?.prompt) return;
    navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Toggle mode on click/tap
  const handleStageClick = () => {
    // Only toggle if we didn't perform a significant drag
    if (!isDraggingRef.current) {
      setMode((prev) => (prev === 'inspect' ? 'focus' : 'inspect'));
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.2 : 0.83;
    setZoom((prev) => {
      const next = Math.min(8, Math.max(1, prev * delta));
      if (next > 1 && mode === 'inspect') {
        // Automatically enter focus mode when zooming in
        setMode('focus');
      }
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Touch handlers for pinch-to-zoom & pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { x: 0, y: 0, time: Date.now(), dist };
    } else if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      panStartRef.current = { ...pan };
      isDraggingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current.dist) {
      // Pinch to zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDist / touchStartRef.current.dist;
      setZoom((z) => Math.min(8, Math.max(1, z * scale)));
      touchStartRef.current.dist = currentDist;
      if (mode === 'inspect') setMode('focus');
    } else if (e.touches.length === 1 && zoom > 1) {
      // Panning when zoomed
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        isDraggingRef.current = true;
      }
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1 && zoom === 1) {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;

      // Horizontal swipe navigation (when not zoomed)
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
        if (dx < 0) onSelectNext();
        else onSelectPrev();
      }
      // Swipe down to dismiss (only if swipe is downward and fast)
      else if (dy > 120 && Math.abs(dy) > Math.abs(dx) * 2 && dt < 400) {
        onClose();
      }
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col select-none overflow-hidden touch-none">
      {/* ── TOP BAR (Fades away in Pure Focus Mode) ── */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 transition-opacity duration-200 pointer-events-none ${
          mode === 'focus' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <button
          onClick={onClose}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all"
          aria-label="Close viewer"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center pointer-events-auto">
          <span className="text-xs font-semibold text-white/90 tracking-wide">
            Bridge · ChatGPT Studio
          </span>
          {item.conversation_id && (
            <span className="text-[11px] font-mono text-white/40 truncate max-w-[180px]">
              {item.conversation_id}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center backdrop-blur-md transition-all ${
              item.favorite ? 'text-amber-400' : 'text-white/80'
            }`}
            aria-label="Favorite"
          >
            <Star size={18} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setMode((m) => (m === 'focus' ? 'inspect' : 'focus'))}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all"
            title={mode === 'focus' ? 'Exit pure focus' : 'Enter pure focus'}
          >
            {mode === 'focus' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* ── THE ARTWORK CANVAS (100% UNVEILED) ── */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={handleStageClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={item.url}
          alt={item.prompt || 'Generated art'}
          draggable={false}
          className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 ease-out select-none will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
          }}
        />

        {/* Zoom Level Indicator (when zoomed) */}
        {zoom > 1 && (
          <div className="absolute top-20 right-4 px-2.5 py-1 rounded-full bg-black/60 text-white/80 font-mono text-xs backdrop-blur-md pointer-events-none animate-fade">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Pure Focus Mode Tap Hint (momentary) */}
        {mode === 'focus' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white/50 text-[11px] font-sans tracking-wide backdrop-blur-md pointer-events-none transition-opacity duration-1000">
            Tap anywhere to show controls
          </div>
        )}
      </div>

      {/* ── PREV / NEXT ARROWS (Desktop & Large Touch Targets) ── */}
      {mode === 'inspect' && items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectPrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* ── INSPECTOR CARD & THUMB TOOLBAR (Fades away in Pure Focus Mode) ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 transition-opacity duration-200 pointer-events-none gap-3 ${
          mode === 'focus' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Bridge Specs Card */}
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl bg-[#141416]/90 border border-white/10 backdrop-blur-xl p-3.5 shadow-2xl space-y-2 text-left">
          {item.prompt && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Prompt</p>
              <p className="text-[13px] text-white/90 leading-snug line-clamp-2 mt-0.5">{item.prompt}</p>
            </div>
          )}

          {item.tweaked_prompt && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-400/70 font-medium">
                Refinement Layer 1
              </p>
              <p className="text-xs text-white/70 font-mono mt-0.5">{item.tweaked_prompt}</p>
            </div>
          )}

          {/* Technical Metadata Strip in Monospace */}
          <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/50">
            <span className="text-emerald-400 font-semibold">{item.account_used || 'Primary'}</span>
            <span>{item.duration_s ? `${item.duration_s.toFixed(1)}s` : '—'}</span>
            <span>{item.size_bytes ? `${(item.size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</span>
            {item.md5 && <span className="truncate max-w-[90px]">MD5: {item.md5.slice(0, 8)}…</span>}
          </div>
        </div>

        {/* Floating Glass Pill Toolbar (Thumb-Accessible) */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 px-3 py-2 rounded-full bg-[#18181b]/90 border border-white/15 backdrop-blur-2xl shadow-2xl">
          <button
            onClick={() => onSelectPrev()}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Reset Zoom"
          >
            <ZoomOut size={18} />
          </button>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <button
            onClick={() => {
              onContinueInChat(item);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium active:scale-95 transition-all"
            title="Continue thread in Chat"
          >
            <MessageSquareShare size={15} />
            <span className="hidden sm:inline">Continue</span>
          </button>

          <button
            onClick={handleCopyPrompt}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title={copied ? 'Copied!' : 'Copy prompt'}
          >
            <Copy size={18} className={copied ? 'text-emerald-400' : ''} />
          </button>

          <a
            href={item.url}
            download={`bridge-${item.id}.png`}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Download PNG"
          >
            <Download size={18} />
          </a>

          <button
            onClick={() => {
              if (confirm('Delete this image permanently?')) {
                onDelete(item.id);
                onClose();
              }
            }}
            className="p-2 rounded-full hover:bg-red-500/20 active:scale-95 text-red-400 hover:text-red-300 transition-all"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={() => onSelectNext()}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all"
            title="Next"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
