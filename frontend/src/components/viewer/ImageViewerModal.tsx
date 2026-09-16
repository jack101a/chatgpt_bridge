import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  MessageSquareShare,
  Trash2,
  Heart,
  Sparkles,
  Check,
  Info,
  X,
  Cloud,
} from 'lucide-react';
import { GalleryItem } from '../../types';
import { copyToClipboard } from '../../lib/api';
import { hapticImpact } from '../../lib/haptics';

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
  onPromptWithImage?: (item: GalleryItem) => void;
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
  onPromptWithImage,
}) => {
  // Viewer modes: 'inspect' (options showing) vs 'focus' (full view, pure artwork)
  const [mode, setMode] = useState<'inspect' | 'focus'>('inspect');

  // Plan A: On-demand Info Sheet Drawer
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const drawerTouchStartRef = useRef<{ y: number; time: number }>({ y: 0, time: 0 });

  const handleDrawerTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    drawerTouchStartRef.current = { y: clientY, time: Date.now() };
    setIsDrawerDragging(true);
    if ('setPointerCapture' in e.target && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {}
    }
  };

  const handleDrawerTouchMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (!isDrawerDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    const dy = clientY - drawerTouchStartRef.current.y;
    if (dy > 0) {
      setDrawerDragY(dy);
    } else {
      setDrawerDragY(dy * 0.2);
    }
  };

  const handleDrawerTouchEnd = (e: React.TouchEvent | React.PointerEvent) => {
    if (!isDrawerDragging) return;
    setIsDrawerDragging(false);
    if ('releasePointerCapture' in e.target && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).releasePointerCapture((e as React.PointerEvent).pointerId);
      } catch {}
    }
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.PointerEvent).clientY;
    const dy = clientY - drawerTouchStartRef.current.y;
    const dt = Math.max(1, Date.now() - drawerTouchStartRef.current.time);
    const velocity = dy / dt;
    if (dy > 50 || (velocity > 0.25 && dy > 15)) {
      hapticImpact('light');
      setIsInfoDrawerOpen(false);
    }
    setDrawerDragY(0);
  };

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Touch & gesture interaction state
  const [isInteracting, setIsInteracting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [dismissDragY, setDismissDragY] = useState(0);
  const [showHeartPop, setShowHeartPop] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number }>({
    x: 0,
    y: 0,
    time: 0,
  });
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    pan: { x: number; y: number };
    center: { x: number; y: number };
  }>({
    dist: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
  });
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isSwipingRef = useRef(false);
  const isDismissDraggingRef = useRef(false);
  const didDragOrPinchRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const isDoubleTapRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);
  const mouseStartRef = useRef({ x: 0, y: 0 });

  // Option B: 3-Panel adjacent item indices
  const currentIndex = items.findIndex((i) => i.id === item?.id);
  const prevItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex !== -1 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  // Preload adjacent images for instant transition
  useEffect(() => {
    if (prevItem?.url) {
      const img = new Image();
      img.src = prevItem.url;
    }
    if (nextItem?.url) {
      const img = new Image();
      img.src = nextItem.url;
    }
  }, [prevItem?.url, nextItem?.url]);

  // Reset zoom & pan when image item changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSwipeX(0);
    setDismissDragY(0);
    setIsTransitioning(false);
    setRotation(0);
    setCopied(false);
    setIsInfoDrawerOpen(false);
    setDimensions(
      imgRef.current?.complete && imgRef.current.naturalWidth
        ? { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight }
        : null
    );
    setMode('inspect');
  }, [item?.id]);

  // Option B: Tactile Slide Animation Triggers
  const triggerHeartPop = () => {
    hapticImpact('medium');
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 700);
  };

  const triggerNext = () => {
    if (!nextItem || isAnimatingRef.current) return;
    hapticImpact('selection');
    isAnimatingRef.current = true;
    setIsInteracting(false);
    setIsTransitioning(true);
    setSwipeX(-(window.innerWidth + 24));
    setTimeout(() => {
      setIsTransitioning(false);
      onSelectNext();
      setSwipeX(0);
      requestAnimationFrame(() => {
        isAnimatingRef.current = false;
      });
    }, 240);
  };

  const triggerPrev = () => {
    if (!prevItem || isAnimatingRef.current) return;
    hapticImpact('selection');
    isAnimatingRef.current = true;
    setIsInteracting(false);
    setIsTransitioning(true);
    setSwipeX(window.innerWidth + 24);
    setTimeout(() => {
      setIsTransitioning(false);
      onSelectPrev();
      setSwipeX(0);
      requestAnimationFrame(() => {
        isAnimatingRef.current = false;
      });
    }, 240);
  };

  // User-driven mode toggle (triggered by click/tap anywhere on image)
  const toggleMode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMode((prev) => (prev === 'inspect' ? 'focus' : 'inspect'));
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') triggerNext();
      if (e.key === 'ArrowLeft') triggerPrev();
      if (e.key === 'f') toggleMode();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(8, z * 1.3));
      if (e.key === '-') {
        setZoom((z) => {
          const next = Math.max(1, z / 1.3);
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
      if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, nextItem, prevItem]);

  // Robust clipboard copy
  const handleCopyPrompt = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!item?.prompt) return;
    const ok = await copyToClipboard(item.prompt);
    if (ok) {
      hapticImpact('light');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Clamp pan coordinates within viewport bounds based on zoom
  const clampPan = (newX: number, newY: number, currentZoom: number) => {
    if (currentZoom <= 1) return { x: 0, y: 0 };
    const maxBoundX = Math.max(0, (window.innerWidth * (currentZoom - 1)) / 1.8);
    const maxBoundY = Math.max(0, (window.innerHeight * (currentZoom - 1)) / 1.8);
    return {
      x: Math.max(-maxBoundX, Math.min(maxBoundX, newX)),
      y: Math.max(-maxBoundY, Math.min(maxBoundY, newY)),
    };
  };

  // Toggle zoom between 1x and 2.5x
  const toggleZoom = (clientX?: number, clientY?: number) => {
    hapticImpact('light');
    if (zoom > 1.05) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      const targetZoom = 2.5;
      if (clientX !== undefined && clientY !== undefined) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const offsetX = (centerX - clientX) * 0.6;
        const offsetY = (centerY - clientY) * 0.6;
        const clamped = clampPan(offsetX, offsetY, targetZoom);
        setPan(clamped);
      } else {
        setPan({ x: 0, y: 0 });
      }
      setZoom(targetZoom);
    }
  };

  // Single click/tap anywhere on image toggles between full view (all chrome hidden) and options view
  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current || isDoubleTapRef.current || ignoreClickRef.current) return;
    toggleMode();
  };

  // Desktop mouse drag: panning when zoomed, or smooth swipe when at 1x
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isAnimatingRef.current) return;
    setIsInteracting(true);
    isMouseDownRef.current = true;
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    isDraggingRef.current = false;
    isSwipingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || isAnimatingRef.current) return;
    const dx = e.clientX - mouseStartRef.current.x;
    const dy = e.clientY - mouseStartRef.current.y;
    if (Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true;
      didDragOrPinchRef.current = true;
    }

    if (zoom > 1.05) {
      const rawX = panStartRef.current.x + dx;
      const rawY = panStartRef.current.y + dy;
      setPan(clampPan(rawX, rawY, zoom));
    } else {
      if (Math.abs(dx) > 5 || isSwipingRef.current) {
        isSwipingRef.current = true;
        const isAtLeftEdge = !prevItem && dx > 0;
        const isAtRightEdge = !nextItem && dx < 0;
        const effectiveDx = isAtLeftEdge || isAtRightEdge ? dx * 0.25 : dx;
        setSwipeX(effectiveDx);
      }
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    setIsInteracting(false);

    if (isSwipingRef.current && zoom <= 1.05) {
      if (swipeX < -60 && nextItem) {
        triggerNext();
      } else if (swipeX > 60 && prevItem) {
        triggerPrev();
      } else {
        setIsTransitioning(true);
        setSwipeX(0);
        setTimeout(() => setIsTransitioning(false), 240);
      }
      isSwipingRef.current = false;
    }

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  // Double click for desktop
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDoubleTapRef.current = true;
    setTimeout(() => {
      isDoubleTapRef.current = false;
    }, 250);
    toggleZoom(e.clientX, e.clientY);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.25 : 0.8;
    setZoom((prev) => {
      const next = Math.min(8, Math.max(1, prev * delta));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan((currentPan) => clampPan(currentPan.x, currentPan.y, next));
      }
      return next;
    });
  };

  // Touch handlers: Butter-smooth direct manipulation pinch, swipe, and pan
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsInteracting(true);
    didDragOrPinchRef.current = false;

    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      pinchStartRef.current = { dist, zoom, pan: { ...pan }, center };
      isDraggingRef.current = true;
      didDragOrPinchRef.current = true;
    } else if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      panStartRef.current = { ...pan };
      isDraggingRef.current = false;
      isSwipingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current.dist > 0) {
      didDragOrPinchRef.current = true;
      isDraggingRef.current = true;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const scale = currentDist / pinchStartRef.current.dist;
      const targetZoom = Math.min(8, Math.max(0.75, pinchStartRef.current.zoom * scale));

      const currentCenter = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      const dx = currentCenter.x - pinchStartRef.current.center.x;
      const dy = currentCenter.y - pinchStartRef.current.center.y;

      setZoom(targetZoom);
      setPan(clampPan(pinchStartRef.current.pan.x + dx, pinchStartRef.current.pan.y + dy, targetZoom));
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const distMoved = Math.hypot(dx, dy);

      if (distMoved > 6) {
        isDraggingRef.current = true;
        didDragOrPinchRef.current = true;
      }

      if (zoom > 1.05) {
        // Direct pan when zoomed
        const rawX = panStartRef.current.x + dx;
        const rawY = panStartRef.current.y + dy;
        setPan(clampPan(rawX, rawY, zoom));
      } else {
        // Direct vertical swipe-down-to-dismiss (iOS Photos style)
        if (
          isDismissDraggingRef.current ||
          (dy > 12 && Math.abs(dy) > Math.abs(dx) * 1.25 && !isSwipingRef.current)
        ) {
          isDismissDraggingRef.current = true;
          setDismissDragY(Math.max(0, dy));
        } else if (Math.abs(dx) > Math.abs(dy) * 0.8 || isSwipingRef.current) {
          // Direct horizontal swipe with Option B peeking carousel
          isSwipingRef.current = true;
          // Apply gentle rubberband resistance at edges
          const isAtLeftEdge = !prevItem && dx > 0;
          const isAtRightEdge = !nextItem && dx < 0;
          const effectiveDx = isAtLeftEdge || isAtRightEdge ? dx * 0.25 : dx;
          setSwipeX(effectiveDx);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsInteracting(false);

    if (didDragOrPinchRef.current) {
      ignoreClickRef.current = true;
      setTimeout(() => {
        ignoreClickRef.current = false;
      }, 300);
    }

    // Spring back zoom if pinched below 1x
    if (zoom < 1.02) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }

    if (e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Math.max(1, Date.now() - touchStartRef.current.time);
    const distMoved = Math.hypot(dx, dy);

    // iOS Photos-style pull-down dismiss completion
    if (isDismissDraggingRef.current && zoom <= 1.05) {
      const velocity = dismissDragY / dt;
      if (dismissDragY > 100 || (velocity > 0.35 && dismissDragY > 30)) {
        hapticImpact('light');
        onClose();
      } else {
        setIsTransitioning(true);
        setDismissDragY(0);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 240);
      }
      isDismissDraggingRef.current = false;
      return;
    }
    setDismissDragY(0);

    // Option B: Complete horizontal swipe with velocity & distance threshold
    if (isSwipingRef.current && zoom <= 1.05) {
      const velocity = Math.abs(swipeX) / dt;
      const isFlick = velocity > 0.32 && Math.abs(swipeX) > 20;
      const isPastThreshold = Math.abs(swipeX) > 60;

      if ((isPastThreshold || isFlick) && swipeX < 0 && nextItem) {
        triggerNext();
      } else if ((isPastThreshold || isFlick) && swipeX > 0 && prevItem) {
        triggerPrev();
      } else {
        setIsTransitioning(true);
        setSwipeX(0);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 240);
      }
      isSwipingRef.current = false;
      return;
    }
    setSwipeX(0);

    // Double-tap detection
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current.time;
    const distFromLastTap = Math.hypot(
      touch.clientX - lastTapRef.current.x,
      touch.clientY - lastTapRef.current.y
    );

    if (distMoved < 10 && timeSinceLastTap < 300 && distFromLastTap < 40) {
      isDoubleTapRef.current = true;
      ignoreClickRef.current = true;
      setTimeout(() => {
        isDoubleTapRef.current = false;
        ignoreClickRef.current = false;
      }, 350);
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      toggleZoom(touch.clientX, touch.clientY);
      return;
    }

    lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
  };

  if (!isOpen || !item) return null;

  const transitionStyle = isInteracting || !isTransitioning
    ? 'none'
    : 'transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1)';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden touch-none transition-colors duration-150"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${Math.max(0.2, 1 - dismissDragY / 450)})`,
      }}
    >
      {/* ── TOP CONTROLS (Fades away in Full View Mode) ── */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 transition-opacity duration-200 pointer-events-none ${
          mode === 'focus' ? 'opacity-0 pointer-events-none invisible' : 'opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="pointer-events-auto w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-black/60 hover:bg-black/80 border border-white/10 active:scale-90 text-white/90 flex items-center justify-center backdrop-blur-md transition-all shadow-lg"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Counter Pill & Conversation ID */}
        <div className="flex flex-col items-center pointer-events-auto">
          <div className="px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white/90 text-xs font-mono backdrop-blur-md shadow-lg flex items-center gap-1.5">
            <span className="font-semibold text-emerald-400">{currentIndex + 1}</span>
            <span className="text-white/40">/</span>
            <span className="text-white/70">{items.length}</span>
          </div>
          {item.conversation_id && (
            <span className="text-[10px] font-mono text-white/40 truncate max-w-[180px] mt-0.5">
              {item.conversation_id}
            </span>
          )}
        </div>

        {/* Top Right Heart Favorite Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => {
              onToggleFavorite(item.id);
              if (!item.favorite) {
                triggerHeartPop();
              }
            }}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-black/60 hover:bg-black/80 border active:scale-90 flex items-center justify-center backdrop-blur-md transition-all shadow-lg ${
              item.favorite
                ? 'text-rose-500 bg-rose-500/10 border-rose-500/40'
                : 'text-white/80 border-white/10 hover:text-white'
            }`}
            aria-label="Favorite"
            title={item.favorite ? 'Favorited' : 'Add to favorites'}
          >
            <Heart
              size={18}
              className={`transition-transform duration-150 ${
                item.favorite ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white/80'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── THE 3-PANEL PEEKING CAROUSEL (OPTION B) ── */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onClick={handleStageClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Image Panel (Peeking from left) */}
        {prevItem && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{
              transform: `translate3d(calc(-100% - 24px + ${swipeX}px), 0, 0)`,
              transition: transitionStyle,
              willChange: 'transform',
            }}
          >
            <img
              src={prevItem.url}
              alt={prevItem.prompt || 'Previous artwork'}
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none select-none opacity-100"
              loading="eager"
            />
          </div>
        )}

        {/* Current Image Panel (Center) */}
        <div
          className="absolute inset-0 flex items-center justify-center select-none"
          style={{
            transform: `translate3d(${zoom > 1 ? pan.x : swipeX}px, ${zoom > 1 ? pan.y : dismissDragY}px, 0) rotate(${rotation}deg) scale(${zoom > 1 ? zoom : Math.max(0.72, 1 - dismissDragY / 1000)})`,
            transformOrigin: 'center center',
            transition: transitionStyle,
            willChange: 'transform',
          }}
        >
          <img
            ref={imgRef}
            src={item.url}
            alt={item.prompt || 'Generated art'}
            draggable={false}
            decoding="async"
            loading="eager"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
            className="max-w-full max-h-full object-contain pointer-events-none select-none"
          />
        </div>

        {/* Next Image Panel (Peeking from right) */}
        {nextItem && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{
              transform: `translate3d(calc(100% + 24px + ${swipeX}px), 0, 0)`,
              transition: transitionStyle,
              willChange: 'transform',
            }}
          >
            <img
              src={nextItem.url}
              alt={nextItem.prompt || 'Next artwork'}
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none select-none opacity-100"
              loading="eager"
            />
          </div>
        )}

        {/* Instagram-style Glowing Red Heart Pop on Favorite */}
        {showHeartPop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-fade">
            <div className="p-5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 shadow-2xl scale-125 animate-bounce">
              <Heart size={52} fill="#f43f5e" className="text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.9)]" />
            </div>
          </div>
        )}

        {/* Zoom Level Indicator (when zoomed) */}
        {zoom > 1 && (
          <div className="absolute top-20 right-4 px-2.5 py-1 rounded-full bg-black/70 text-white/90 font-mono text-xs backdrop-blur-md pointer-events-none animate-fade border border-white/10">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      {/* ── PREV / NEXT ARROWS (Desktop & Large Touch Targets) ── */}
      {mode === 'inspect' && items.length > 1 && (
        <>
          {prevItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all shadow-lg border border-white/10"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {nextItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-md transition-all shadow-lg border border-white/10"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </>
      )}

      {/* ── INSPECTOR CARD & THUMB TOOLBAR (Fades away in Pure Focus Mode) ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 transition-opacity duration-200 pointer-events-none gap-3 ${
          mode === 'focus' ? 'opacity-0 pointer-events-none invisible' : 'opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── FLOATING RESOLUTION & INFO BADGE (Plan A) ── */}
        {dimensions && (
          <div
            data-testid="plan-a-badge"
            onClick={(e) => {
              e.stopPropagation();
              hapticImpact('light');
              setIsInfoDrawerOpen(true);
            }}
            className="pointer-events-auto cursor-pointer min-h-[40px] px-4 py-1.5 rounded-full bg-black/80 hover:bg-black/95 border border-white/15 text-[11px] font-mono text-emerald-400 backdrop-blur-xl shadow-xl flex items-center gap-2.5 transition-all duration-150 active:scale-95"
            title="Click to view details and prompt"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{dimensions.w} × {dimensions.h} px · Original</span>
            <span className="text-white/30 text-[10px]">|</span>
            <span className="text-white/70 text-[11px] font-sans flex items-center gap-1 hover:text-white">
              <Info size={13} className="text-emerald-400" />
              <span>Info</span>
            </span>
          </div>
        )}

        {/* Floating Glass Pill Toolbar (Thumb-Accessible, 44px HIG targets) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-full bg-[#141416]/90 border border-white/15 backdrop-blur-2xl shadow-2xl max-w-full overflow-x-auto no-scrollbar"
        >
          <button
            onClick={() => triggerPrev()}
            disabled={!prevItem}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full active:scale-90 transition-all ${
              prevItem ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'opacity-30 cursor-not-allowed text-white/40'
            }`}
            title="Previous image"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-white/10 active:scale-90 text-white/80 hover:text-white transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-white/10 active:scale-90 text-white/80 hover:text-white transition-all"
            title="Reset Zoom"
          >
            <ZoomOut size={18} />
          </button>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-white/10 active:scale-90 text-white/80 hover:text-white transition-all"
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>

          <div className="w-px h-5 bg-white/20 mx-0.5 flex-shrink-0" />

          {/* Dedicated Info Drawer Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticImpact('light');
              setIsInfoDrawerOpen(true);
            }}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs font-medium active:scale-90 transition-all flex-shrink-0"
            title="View Details & Prompt"
          >
            <Info size={15} className="text-emerald-400" />
            <span>Info</span>
          </button>

          {/* New Feature: Remix / Prompt with Image */}
          {onPromptWithImage && (
            <button
              onClick={() => {
                hapticImpact('medium');
                onPromptWithImage(item);
              }}
              className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold active:scale-90 transition-all shadow-md shadow-emerald-500/30 flex-shrink-0"
              title="Attach this image as reference and prompt for new image generation"
            >
              <Sparkles size={14} />
              <span>Remix</span>
            </button>
          )}

          <button
            onClick={() => {
              hapticImpact('medium');
              onContinueInChat(item);
            }}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs font-medium active:scale-90 transition-all flex-shrink-0"
            title="Continue thread in Chat"
          >
            <MessageSquareShare size={15} />
            <span className="hidden sm:inline">Thread</span>
          </button>

          <button
            onClick={handleCopyPrompt}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-white/10 active:scale-90 text-white/80 hover:text-white transition-all"
            title={copied ? 'Copied!' : 'Copy prompt'}
          >
            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          </button>

          <a
            href={item.url}
            download={`bridge-${item.id}.png`}
            onClick={() => hapticImpact('light')}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-white/10 active:scale-90 text-white/80 hover:text-white transition-all"
            title="Download PNG"
          >
            <Download size={18} />
          </a>

          <button
            onClick={() => {
              if (confirm('Delete this image permanently?')) {
                hapticImpact('heavy');
                onDelete(item.id);
                onClose();
              }
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full hover:bg-red-500/20 active:scale-90 text-red-400 hover:text-red-300 transition-all"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={() => triggerNext()}
            disabled={!nextItem}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full active:scale-90 transition-all ${
              nextItem ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'opacity-30 cursor-not-allowed text-white/40'
            }`}
            title="Next image"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── INFO SHEET DRAWER (PLAN A) ── */}
      {isInfoDrawerOpen && (
        <div
          onClick={() => setIsInfoDrawerOpen(false)}
          className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141416] border-t border-x border-white/15 p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 will-change-transform"
            style={{
              transform: `translate3d(0, ${Math.max(0, drawerDragY)}px, 0)`,
              transition: isDrawerDragging ? 'none' : 'transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
            }}
          >
            {/* Grab Handle (Touch/Pointer Draggable to Swipe Close) */}
            <div
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              onPointerDown={handleDrawerTouchStart}
              onPointerMove={handleDrawerTouchMove}
              onPointerUp={handleDrawerTouchEnd}
              className="w-full py-2 -mt-2 cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none"
            >
              <div className="w-12 h-1.5 rounded-full bg-white/25 active:bg-white/40 transition-colors" />
            </div>

            {/* Header (Also draggable) */}
            <div
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              onPointerDown={handleDrawerTouchStart}
              onPointerMove={handleDrawerTouchMove}
              onPointerUp={handleDrawerTouchEnd}
              className="flex items-center justify-between pb-3 border-b border-white/10 touch-none select-none"
            >
              <div className="flex items-center gap-2">
                <Info size={18} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide">Image Details & Prompt</h3>
              </div>
              <button
                onClick={() => setIsInfoDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all active:scale-95"
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>

            {/* Prompt */}
            {item.prompt && (
              <div className="space-y-1.5 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Generation Prompt</span>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-all font-medium active:scale-95"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
                  </button>
                </div>
                <p className="text-sm text-white/95 leading-relaxed selection:bg-emerald-500/30 whitespace-pre-wrap">{item.prompt}</p>
              </div>
            )}

            {/* Refinement */}
            {item.tweaked_prompt && (
              <div className="space-y-1 bg-emerald-950/20 rounded-xl p-3 border border-emerald-500/20">
                <span className="text-[11px] uppercase tracking-wider text-emerald-400/80 font-medium">Refinement Layer 1</span>
                <p className="text-xs text-emerald-200/90 font-mono leading-relaxed">{item.tweaked_prompt}</p>
              </div>
            )}

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Account</div>
                <div className="text-emerald-400 font-semibold mt-0.5 truncate">{item.account_used || 'Primary'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Dimensions</div>
                <div className="text-white/90 font-medium mt-0.5">
                  {dimensions ? `${dimensions.w} × ${dimensions.h} px` : 'Original'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">File Size</div>
                <div className="text-white/80 mt-0.5">
                  {item.size_bytes ? `${(item.size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Latency</div>
                <div className="text-white/80 mt-0.5">{item.duration_s ? `${item.duration_s.toFixed(1)}s` : '—'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 col-span-2">
                <div className="text-[10px] text-white/40 uppercase">Storage Location</div>
                <div className="text-white/90 text-xs mt-0.5 flex items-center gap-1.5 font-medium">
                  {item.tg_file_id ? (
                    <>
                      <Cloud size={13} className="text-sky-400" />
                      <span className="text-sky-300">Telegram Cloud Vault</span>
                      <span className="text-[10px] text-white/50">({item.is_local !== false ? 'Cached Locally' : 'Streamed on demand'})</span>
                    </>
                  ) : (
                    <span className="text-white/70">Local Server Disk</span>
                  )}
                </div>
              </div>
            </div>

            {/* Fast Actions */}
            <div className="flex items-center gap-2 pt-1">
              {onPromptWithImage && (
                <button
                  onClick={() => {
                    onPromptWithImage(item);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Sparkles size={15} />
                  <span>Remix in Chat</span>
                </button>
              )}
              <a
                href={item.url}
                download={`bridge-${item.id}.png`}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <Download size={15} />
                <span>Save PNG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
