import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Heart,
  Sparkles,
  Loader2,
  Menu,
  ArrowUp,
  Calendar,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import {
  GalleryItem,
  Account,
  GalleryTimeFilter,
  GallerySortBy,
  GalleryGroupBy,
  TimelineSection,
} from '../../types';
import { PullToRefresh } from '../common/PullToRefresh';
import { GalleryToolbar, GalleryDensityMode, AspectRatioFilter } from './GalleryToolbar';
import { BatchActionBar } from './BatchActionBar';
import { hapticImpact } from '../../lib/haptics';

interface GalleryViewProps {
  items: GalleryItem[];
  sections: TimelineSection[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: GalleryTimeFilter;
  onFilterChange: (f: GalleryTimeFilter) => void;
  sortBy: GallerySortBy;
  onSortByChange: (s: GallerySortBy) => void;
  groupBy: GalleryGroupBy;
  onGroupByChange: (g: GalleryGroupBy) => void;
  layoutMode?: string;
  onLayoutModeChange?: (m: any) => void;
  accountFilter: string | null;
  onAccountFilterChange: (acc: string | null) => void;
  accounts: Account[];
  onLoadMore: () => void;
  onOpenViewer: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
  onRefresh?: () => Promise<void> | void;
  activeAccount?: Account | null;
  onOpenAccounts?: () => void;
  onOpenSidebar?: () => void;
  onGoHome?: () => void;
  onPromptWithImage?: (item: GalleryItem) => void;
  onToggleChrome?: (visible: boolean) => void;
}

/**
 * Ultra-Clean Edge-to-Edge Darkroom Canvas Feed Item
 * - Zero UI clutter / zero button distractions around the artwork
 * - 100% natural resolution image coverage
 * - Smooth skeleton loading with fade-in
 * - Double-tap quick favorite with glowing red heart pop + tactile haptics
 * - Single-tap launches full dual-mode inspect/focus viewer modal
 * - Cloud Vault indicator when backed up
 * - Batch selection checkbox when batch mode is active
 */
const GalleryFeedCard: React.FC<{
  item: GalleryItem;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpenViewer: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
}> = ({
  item,
  isBatchMode,
  isSelected,
  onToggleSelect,
  onOpenViewer,
  onToggleFavorite,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBatchMode) {
      onToggleSelect(e);
      return;
    }

    const now = Date.now();
    const diff = now - lastTapRef.current;

    if (diff < 280) {
      // Double tap detected -> Quick Favorite with tactile animation
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      hapticImpact('medium');
      onToggleFavorite(item.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 850);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        hapticImpact('light');
        onOpenViewer(item);
        singleTapTimerRef.current = null;
      }, 280);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full bg-white dark:bg-black border-y border-border/50 dark:border-transparent flex items-center justify-center cursor-pointer select-none overflow-hidden my-1.5 sm:my-2.5 group transition-colors shadow-2xs dark:shadow-none"
    >
      {/* Loading Skeleton Shimmer */}
      {!isLoaded && (
        <div className="w-full aspect-[3/4] max-h-[75vh] bg-muted/60 dark:bg-zinc-950/90 animate-pulse flex items-center justify-center">
          <Loader2 size={24} className="text-muted-foreground dark:text-zinc-700 animate-spin" />
        </div>
      )}

      {/* Fast WebP Thumbnail / High-Resolution Image */}
      <img
        src={item.thumbnail_url || item.url}
        alt={item.prompt || 'Generated art'}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-auto max-h-[88vh] object-contain mx-auto transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0 h-0'
        }`}
      />

      {/* Batch Mode Selection Checkbox (Top Left) */}
      {isBatchMode && (
        <div
          onClick={onToggleSelect}
          className="absolute top-3.5 left-3.5 z-20"
        >
          <div
            className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center backdrop-blur-md border transition-all ${
              isSelected
                ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                : 'bg-black/60 text-white/60 border-white/30 hover:border-white'
            }`}
          >
            {isSelected && <CheckCircle2 className="w-5 h-5" />}
          </div>
        </div>
      )}

      {/* Cloud Vault Backed Indicator (Top Right) */}
      {item.tg_file_id && (
        <div className="absolute top-3.5 right-3.5 z-10 pointer-events-none">
          <span
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 text-sky-300 text-[10px] font-mono backdrop-blur-md border border-white/10 shadow-sm"
            title="Backed up to Telegram Cloud Vault"
          >
            <Cloud size={11} className="text-sky-400" />
            <span>Vault</span>
          </span>
        </div>
      )}

      {/* Instagram-style Glowing Red Heart Pop on Double-Tap */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-fade">
          <div className="p-5 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-2xl scale-125 animate-bounce">
            <Heart
              size={48}
              fill="#f43f5e"
              className="text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.9)]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const GalleryView: React.FC<GalleryViewProps> = ({
  items,
  sections,
  total,
  isLoading,
  hasMore,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange: _onGroupByChange,
  onLoadMore,
  onOpenViewer,
  onToggleFavorite,
  onRefresh,
  onToggleChrome,
}) => {
  // Density mode: 'feed' is default (vertical scrolling stream as requested)
  const [density, setDensity] = useState<GalleryDensityMode>('feed');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioFilter>('all');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(true);

  const lastScrollTopRef = useRef<number>(0);
  const accumulatedUpScrollRef = useRef<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Restore chrome when switching away from feed mode
  useEffect(() => {
    if (density !== 'feed') {
      setIsChromeVisible(true);
      onToggleChrome?.(true);
    }
  }, [density, onToggleChrome]);

  // Infinite Scroll IntersectionObserver with container root
  useEffect(() => {
    if (!hasMore || isLoading) return;

    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: root || undefined,
        rootMargin: '400px', // Trigger before reaching bottom for seamless scroll
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  // Track scroll position for auto-hiding chrome & infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollTop(scrollTop > 400);

    // Auto-hide chrome on scroll down, reveal on deliberate scroll up in feed mode
    if (density === 'feed') {
      const diff = scrollTop - lastScrollTopRef.current;
      if (diff > 0) {
        // Any downward scroll immediately wipes out accumulated upward scroll
        accumulatedUpScrollRef.current = 0;
        if (diff > 10 && scrollTop > 70 && isChromeVisible) {
          setIsChromeVisible(false);
          onToggleChrome?.(false);
        }
      } else if (diff < -8) {
        accumulatedUpScrollRef.current += Math.abs(diff);
        // Reveal chrome on deliberate upward scroll of 200px (natural thumb swipe), or right near the top
        if ((accumulatedUpScrollRef.current > 200 || scrollTop < 30) && !isChromeVisible) {
          setIsChromeVisible(true);
          onToggleChrome?.(true);
        }
      }
    }
    lastScrollTopRef.current = scrollTop;

    // Seamless infinite scroll trigger when approaching bottom
    if (hasMore && !isLoading && scrollHeight - scrollTop - clientHeight < 500) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore, density, isChromeVisible, onToggleChrome]);

  const scrollToTop = () => {
    hapticImpact('light');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Batch selection handlers
  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    hapticImpact('selection');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    hapticImpact('medium');
    setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const handleClearSelection = () => {
    hapticImpact('light');
    setSelectedIds(new Set());
  };

  const handleFavoriteAllSelected = () => {
    hapticImpact('medium');
    selectedIds.forEach((id) => onToggleFavorite(id));
    handleClearSelection();
    setIsBatchMode(false);
  };

  const handleDownloadAllSelected = () => {
    hapticImpact('light');
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.id === id);
      if (item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `bridge-art-${item.id.slice(0, 8)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const handleDeleteAllSelected = () => {
    hapticImpact('heavy');
    // Reserved for future batch deletion API
    handleClearSelection();
    setIsBatchMode(false);
  };

  // Filter items by aspect ratio
  const filterByAspect = (item: GalleryItem) => {
    if (aspectRatio === 'all') return true;
    const p = (item.prompt || '').toLowerCase();
    if (aspectRatio === 'square') {
      return !p.includes('16:9') && !p.includes('wide') && !p.includes('9:16') && !p.includes('tall');
    }
    if (aspectRatio === 'wide') {
      return p.includes('16:9') || p.includes('wide') || p.includes('landscape') || p.includes('4:3');
    }
    if (aspectRatio === 'tall') {
      return p.includes('9:16') || p.includes('tall') || p.includes('portrait') || p.includes('3:4');
    }
    return true;
  };

  // Filter sections by aspect ratio
  const filteredSections = useMemo(() => {
    if (aspectRatio === 'all') return sections;
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(filterByAspect),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, aspectRatio]);

  const visibleItems = useMemo(() => {
    return items.filter(filterByAspect);
  }, [items, aspectRatio]);

  // Helper for masonry aspect ratio classes
  const getAspectClass = (item: GalleryItem) => {
    const p = (item.prompt || '').toLowerCase();
    if (p.includes('16:9') || p.includes('wide') || p.includes('landscape')) return 'aspect-video';
    if (p.includes('9:16') || p.includes('portrait') || p.includes('vertical')) return 'aspect-[9/16]';
    return 'aspect-square';
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative select-none">
      {/* ── Modern Gallery Toolbar (Auto-Hides on Scroll Down in Feed Mode) ── */}
      <div
        className={`z-30 transition-transform duration-300 ease-out shrink-0 ${
          density === 'feed'
            ? `fixed top-[calc(3.5rem+env(safe-area-inset-top,0px))] left-0 right-0 ${
                isChromeVisible ? 'translate-y-0 shadow-md' : '-translate-y-[calc(100%+3.5rem)] pointer-events-none'
              }`
            : 'sticky top-0'
        }`}
      >
        <GalleryToolbar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          density={density}
          onDensityChange={setDensity}
          timeFilter={activeFilter}
          onTimeFilterChange={onFilterChange}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          isBatchMode={isBatchMode}
          onToggleBatchMode={() => {
            setIsBatchMode((prev) => !prev);
            if (isBatchMode) handleClearSelection();
          }}
          totalCount={total}
        />
      </div>

      {/* Floating Sleek Menu Restore Pill in Feed Mode when chrome is hidden */}
      {density === 'feed' && !isChromeVisible && (
        <button
          onClick={() => {
            hapticImpact('light');
            setIsChromeVisible(true);
            onToggleChrome?.(true);
          }}
          className="fixed top-4 right-4 z-40 min-h-[44px] px-4 py-2 rounded-full bg-card/90 dark:bg-black/85 hover:bg-card dark:hover:bg-black border border-border/80 dark:border-white/20 backdrop-blur-xl text-xs font-semibold text-foreground dark:text-white/95 shadow-2xl flex items-center gap-1.5 active:scale-95 transition-all animate-fade"
          aria-label="Show Menu"
        >
          <Menu size={14} className="text-primary" />
          <span>Menu</span>
        </button>
      )}

      {/* ── Scrollable Timeline Viewport ── */}
      <PullToRefresh
        id="gallery-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onRefresh={onRefresh}
        className={`min-h-full no-scrollbar ${
          density === 'feed'
            ? 'bg-[#f7f7f8] dark:bg-black px-0 pt-36 pb-28 space-y-3'
            : 'p-3 sm:p-4 pb-28'
        }`}
      >
        {/* Empty State */}
        {visibleItems.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-4 text-muted-foreground">
            <Sparkles size={36} className="mb-3 text-muted-foreground/40 animate-pulse" />
            <p className="text-sm font-semibold text-foreground mb-1">
              No generations found
            </p>
            <p className="text-xs text-muted-foreground max-w-xs font-mono">
              {searchQuery || aspectRatio !== 'all'
                ? 'Try clearing your search query or aspect ratio filters.'
                : 'Generated images from your ChatGPT conversations will appear in this timeline.'}
            </p>
          </div>
        )}

        {/* Timeline Sections */}
        {filteredSections.map((section) => (
          <div key={section.key} className={density === 'feed' ? 'mb-1.5' : 'mb-6 last:mb-2'}>
            {/* Sticky Timeline Section Header (Grid & Masonry Modes only to keep Feed Mode pure) */}
            {groupBy !== 'all' && density !== 'feed' && (
              <div className="sticky top-0 z-10 py-1.5 px-3 mb-2.5 rounded-xl bg-card/85 backdrop-blur-md border border-border shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-primary" />
                  <span className="text-xs font-bold text-foreground tracking-tight">
                    {section.label}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/40">
                  {section.items.length} {section.items.length === 1 ? 'photo' : 'photos'}
                </span>
              </div>
            )}

            {/* Mode 1: Edge-to-Edge Pure Darkroom Feed (DEFAULT) */}
            {density === 'feed' && (
              <div className="flex flex-col items-center w-full">
                {section.items.map((item) => (
                  <GalleryFeedCard
                    key={item.id}
                    item={item}
                    isBatchMode={isBatchMode}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={(e) => toggleSelectItem(item.id, e)}
                    onOpenViewer={onOpenViewer}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )}

            {/* Mode 2: Gallery Grid */}
            {density === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else {
                          hapticImpact('light');
                          onOpenViewer(item);
                        }
                      }}
                      className={`group relative rounded-2xl overflow-hidden bg-card border transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary shadow-md'
                          : 'border-border hover:border-border/80 shadow-2xs hover:shadow-md'
                      }`}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.prompt || 'Generated art'}
                        loading="lazy"
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Selection Checkbox */}
                      {isBatchMode && (
                        <div
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="absolute top-2 left-2 z-10"
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center backdrop-blur-md border ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-black/50 text-white/50 border-white/30 hover:border-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </div>
                      )}

                      {/* Minimal Info Badges */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-1 max-w-[75%]">
                          <span className="px-2 py-0.5 rounded-full bg-black/65 text-white/90 text-[10px] font-mono backdrop-blur-md truncate">
                            {item.account_used || 'Primary'}
                          </span>
                          {item.tg_file_id && (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-black/65 text-sky-300 text-[9px] font-mono backdrop-blur-md flex items-center gap-0.5"
                              title="Telegram Cloud Backed"
                            >
                              <Cloud size={9} className="text-sky-400" />
                            </span>
                          )}
                          {item.duration_s != null && (
                            <span className="hidden sm:inline px-1.5 py-0.5 rounded-full bg-black/65 text-emerald-300 text-[9px] font-mono backdrop-blur-md">
                              {item.duration_s.toFixed(1)}s
                            </span>
                          )}
                        </div>

                        {!isBatchMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              hapticImpact('light');
                              onToggleFavorite(item.id);
                            }}
                            className={`pointer-events-auto p-1.5 rounded-full bg-black/65 backdrop-blur-md transition-all active:scale-90 ${
                              item.favorite ? 'text-rose-500' : 'text-white/70 hover:text-white'
                            }`}
                            aria-label="Save"
                          >
                            <Heart
                              size={12}
                              fill={item.favorite ? '#f43f5e' : 'none'}
                              className={
                                item.favorite
                                  ? 'text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                                  : ''
                              }
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mode 3: Masonry Stream */}
            {density === 'masonry' && (
              <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else {
                          hapticImpact('light');
                          onOpenViewer(item);
                        }
                      }}
                      className={`break-inside-avoid relative rounded-xl overflow-hidden bg-card border transition-all cursor-pointer group ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary shadow-md'
                          : 'border-border hover:border-border/80 hover:shadow-md'
                      }`}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.prompt || 'Artwork'}
                        loading="lazy"
                        className={`w-full object-cover group-hover:scale-105 transition-transform duration-300 ${getAspectClass(
                          item
                        )}`}
                      />
                      {isBatchMode && (
                        <div
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="absolute top-2 left-2 z-10"
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center backdrop-blur-md border ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-black/50 text-white/50 border-white/30'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mode 4: Compact Grid */}
            {density === 'compact' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 sm:gap-2">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else {
                          hapticImpact('light');
                          onOpenViewer(item);
                        }
                      }}
                      className={`relative rounded-lg overflow-hidden bg-card border transition-all cursor-pointer aspect-square ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.prompt || 'Artwork'}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {isBatchMode && (
                        <div className="absolute top-1 left-1">
                          <div
                            className={`w-4 h-4 rounded text-[10px] flex items-center justify-center ${
                              isSelected ? 'bg-primary text-white' : 'bg-black/40 border border-white/40'
                            }`}
                          >
                            {isSelected && '✓'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Infinite Scroll Bottom Sentinel */}
        <div ref={sentinelRef} className="h-6 w-full pointer-events-none" />

        {/* Loading Indicator for Next Infinite Page */}
        {isLoading && (
          <div className="flex justify-center items-center py-6 gap-2 text-muted-foreground text-xs font-mono">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span>Loading more images…</span>
          </div>
        )}

        {/* End of Timeline Card */}
        {!hasMore && items.length > 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <div className="w-8 h-px bg-border mb-2" />
            <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
              ✦ You've reached the beginning
            </p>
            <p className="text-[10px] text-muted-foreground/80 font-mono">
              {items.length} {items.length === 1 ? 'image' : 'images'} in timeline
            </p>
          </div>
        )}
      </PullToRefresh>

      {/* Floating Batch Operations Action Bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        totalCount={visibleItems.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onFavoriteAll={handleFavoriteAllSelected}
        onDownloadAll={handleDownloadAllSelected}
        onDeleteAll={handleDeleteAllSelected}
        onClose={() => {
          setIsBatchMode(false);
          handleClearSelection();
        }}
      />

      {/* Floating "Back to Top" Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-5 sm:bottom-8 sm:right-8 z-30 min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-full bg-black/80 dark:bg-white/90 text-white dark:text-black backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 animate-in fade-in"
          title="Scroll to Top"
          aria-label="Scroll to Top"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
};
