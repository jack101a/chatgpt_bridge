import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ArrowUp,
  Heart,
  Cloud,
  CheckCircle2,
  Calendar,
  Copy,
  Check,
  Loader2,
  Maximize2,
} from 'lucide-react';
import {
  GalleryItem,
  Account,
  GalleryTimeFilter,
  GallerySortBy,
  GalleryGroupBy,
  GalleryLayoutMode,
  TimelineSection,
} from '../../types';
import { PullToRefresh } from '../common/PullToRefresh';
import { GalleryToolbar, GalleryDensityMode, AspectRatioFilter } from './GalleryToolbar';
import { BatchActionBar } from './BatchActionBar';
import { DotMatrixLoader } from '../common/DotMatrixLoader';
import { api, copyToClipboard } from '../../lib/api';
import { hapticImpact } from '../../lib/haptics';

interface GalleryFeedCardProps {
  item: GalleryItem;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpenViewer: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
}

const GalleryFeedCard: React.FC<GalleryFeedCardProps> = ({
  item,
  isBatchMode,
  isSelected,
  onToggleSelect,
  onOpenViewer,
  onToggleFavorite,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isBatchMode) {
      onToggleSelect(e);
      return;
    }

    const now = Date.now();
    const diff = now - lastTapRef.current;

    if (diff < 300) {
      // Double tap detected -> tactile favorite burst
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      hapticImpact('medium');
      onToggleFavorite(item.id);
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        onOpenViewer(item);
        singleTapTimerRef.current = null;
      }, 300);
    }
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.prompt) return;
    hapticImpact('selection');
    await copyToClipboard(item.prompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticImpact('light');
    onToggleFavorite(item.id);
  };

  return (
    <article
      className={`w-full max-w-2xl bg-card border rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 shadow-xs hover:shadow-md select-none group ${
        isSelected
          ? 'ring-2 ring-primary border-primary shadow-md'
          : 'border-border hover:border-border/80'
      }`}
    >
      {/* Header bar of the card */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/60 bg-muted/20">
        <div className="flex items-center space-x-2">
          {isBatchMode && (
            <button
              onClick={onToggleSelect}
              className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-90"
              title={isSelected ? 'Deselect' : 'Select'}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border border-border text-transparent'
                }`}
              >
                {isSelected && <CheckCircle2 className="w-4 h-4" />}
              </div>
            </button>
          )}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium border border-border/40">
            {item.account_used || 'Primary'}
          </span>
          {item.tg_file_id && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono font-medium border border-primary/20"
              title="Secured in Telegram Cloud Vault"
            >
              <Cloud className="w-3 h-3 text-primary" />
              <span>Vault</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleCopyPrompt}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
            title="Copy prompt"
            aria-label="Copy prompt"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleHeartClick}
            className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl active:scale-90 transition-all ${
              item.favorite
                ? 'text-rose-500 bg-rose-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
            title={item.favorite ? 'Unfavorite' : 'Favorite'}
            aria-label="Favorite"
          >
            <Heart
              className="w-4 h-4"
              fill={item.favorite ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticImpact('light');
              onOpenViewer(item);
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
            title="Inspect full screen"
            aria-label="Open full screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Stage Container */}
      <div
        onClick={handleCardClick}
        className="relative w-full bg-black flex items-center justify-center cursor-pointer select-none overflow-hidden min-h-[280px] sm:min-h-[360px]"
      >
        {/* Loading Spinner Placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}

        <img
          src={item.thumbnail_url || item.url}
          alt={item.prompt || 'Generated art'}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-auto max-h-[84vh] object-contain mx-auto transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Double-tap Heart Pop Animation */}
        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in duration-200">
            <div className="p-4 sm:p-5 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-2xl scale-125 animate-bounce">
              <Heart
                className="w-10 h-10 sm:w-12 sm:h-12 text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.9)]"
                fill="#f43f5e"
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Prompt details & click to expand */}
      {item.prompt && (
        <div
          onClick={() => setIsExpanded((prev) => !prev)}
          className="px-4 py-3 bg-card border-t border-border/60 cursor-pointer hover:bg-muted/10 transition-colors"
        >
          <p
            className={`text-xs sm:text-sm text-foreground/90 font-sans leading-relaxed ${
              isExpanded ? '' : 'line-clamp-2'
            }`}
          >
            {item.prompt}
          </p>
          {item.prompt.length > 120 && (
            <span className="text-[10px] font-semibold text-primary mt-1 inline-block">
              {isExpanded ? 'Show less' : 'Read more'}
            </span>
          )}
        </div>
      )}
    </article>
  );
};

export interface GalleryViewProps {
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
  layoutMode: GalleryLayoutMode;
  onLayoutModeChange: (m: GalleryLayoutMode) => void;
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

export const GalleryView: React.FC<GalleryViewProps> = ({
  items: _items,
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
  onLoadMore,
  onOpenViewer,
  onToggleFavorite,
  onRefresh,
}) => {
  const [density, setDensity] = useState<GalleryDensityMode>('feed');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioFilter>('all');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Aspect ratio filter logic
  const matchesAspectRatio = useCallback(
    (item: GalleryItem, ratio: AspectRatioFilter) => {
      if (ratio === 'all') return true;
      const p = (item.prompt || '').toLowerCase();
      const isWide =
        p.includes('16:9') ||
        p.includes('wide') ||
        p.includes('landscape') ||
        p.includes('1792x1024') ||
        p.includes('1792:1024');
      const isTall =
        p.includes('9:16') ||
        p.includes('portrait') ||
        p.includes('vertical') ||
        p.includes('1024x1792') ||
        p.includes('1024:1792');

      if (ratio === 'wide') return isWide;
      if (ratio === 'tall') return isTall;
      if (ratio === 'square') return !isWide && !isTall;
      return true;
    },
    []
  );

  // Filter sections by aspect ratio
  const filteredSections = useMemo(() => {
    if (aspectRatio === 'all') return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => matchesAspectRatio(item, aspectRatio)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, aspectRatio, matchesAspectRatio]);

  // Flattened filtered items
  const visibleItems = useMemo(() => {
    return filteredSections.flatMap((s) => s.items);
  }, [filteredSections]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  // Scroll listener for "Scroll to Top"
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setShowScrollTop(scrollContainerRef.current.scrollTop > 450);
  }, []);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Batch actions
  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(visibleItems.map((i) => i.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleFavoriteAllSelected = () => {
    selectedIds.forEach((id) => {
      const item = visibleItems.find((i) => i.id === id);
      if (item && !item.favorite) {
        onToggleFavorite(id);
      }
    });
    handleClearSelection();
  };

  const handleDownloadAllSelected = () => {
    selectedIds.forEach((id) => {
      const item = visibleItems.find((i) => i.id === id);
      if (item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `bridge-${item.id.slice(0, 8)}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const handleDeleteAllSelected = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected image(s)?`)) {
      return;
    }
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await api.deleteImage(id);
      } catch (err) {
        console.error('Failed to delete image', id, err);
      }
    }
    handleClearSelection();
    onRefresh?.();
  };

  // Helper to determine aspect ratio container class in masonry mode
  const getAspectClass = (item: GalleryItem) => {
    const p = (item.prompt || '').toLowerCase();
    if (p.includes('16:9') || p.includes('wide') || p.includes('landscape')) return 'aspect-video';
    if (p.includes('9:16') || p.includes('portrait') || p.includes('vertical')) return 'aspect-[9/16]';
    return 'aspect-square';
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative select-none">
      {/* ── Modern Gallery Toolbar with Faceted Filtering & Density (sv-table style) ── */}
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

      {/* ── Scrollable Gallery Viewport ── */}
      <PullToRefresh
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onRefresh={onRefresh}
        className="flex-1 p-3 sm:p-4 overflow-y-auto no-scrollbar"
      >
        {/* Empty State */}
        {visibleItems.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-4 text-muted-foreground">
            <Sparkles className="w-10 h-10 mb-3 text-muted-foreground/40 animate-pulse" />
            <p className="text-sm font-semibold text-foreground mb-1">No generations found</p>
            <p className="text-xs text-muted-foreground max-w-xs font-mono">
              {searchQuery || aspectRatio !== 'all'
                ? 'Try adjusting your search query, time, or aspect ratio filters.'
                : 'Generated artworks will appear here automatically.'}
            </p>
          </div>
        )}

        {/* Timeline Sections */}
        {filteredSections.map((section) => (
          <div key={section.key} className="mb-6 last:mb-2">
            {/* Section Header */}
            {groupBy !== 'all' && (
              <div className="sticky top-0 z-10 py-1.5 px-3 mb-2.5 rounded-xl bg-card/85 backdrop-blur-md border border-border shadow-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground tracking-tight">
                    {section.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {section.items.length} {section.items.length === 1 ? 'photo' : 'photos'}
                </span>
              </div>
            )}

            {/* Layout Density Views */}
            {density === 'feed' && (
              <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-4">
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

            {density === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else onOpenViewer(item);
                      }}
                      className={`group relative rounded-xl overflow-hidden bg-card border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary shadow-md scale-[0.98]'
                          : 'border-border hover:border-border/80 hover:shadow-md'
                      }`}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.prompt || 'Artwork'}
                        loading="lazy"
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Selection Overlay or Checkbox */}
                      {isBatchMode && (
                        <div
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="absolute top-2 left-2 z-10"
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center backdrop-blur-md border transition-all ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-black/50 text-white/50 border-white/30 hover:border-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </div>
                      )}

                      {/* Meta Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center space-x-1 max-w-[75%]">
                          <span className="px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-mono backdrop-blur-md truncate">
                            {item.account_used || 'Primary'}
                          </span>
                          {item.tg_file_id && (
                            <span className="px-1.5 py-0.5 rounded-full bg-black/70 text-sky-400 text-[9px] font-mono backdrop-blur-md">
                              <Cloud className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>

                        {!isBatchMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(item.id);
                            }}
                            className={`pointer-events-auto p-1.5 rounded-full bg-black/70 backdrop-blur-md transition-all active:scale-90 ${
                              item.favorite ? 'text-rose-500' : 'text-white/70 hover:text-white'
                            }`}
                          >
                            <Heart
                              className="w-3 h-3"
                              fill={item.favorite ? 'currentColor' : 'none'}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {density === 'masonry' && (
              <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else onOpenViewer(item);
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

            {density === 'compact' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 sm:gap-2">
                {section.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) toggleSelectItem(item.id);
                        else onOpenViewer(item);
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

        {/* Bottom Sentinel for Infinite Scrolling */}
        <div ref={sentinelRef} className="h-8 w-full pointer-events-none" />

        {/* Loading Matrix Animation */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <DotMatrixLoader variant="prism" size="sm" label="Loading images..." />
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

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-5 z-30 p-2.5 rounded-full bg-card/90 border border-border text-foreground backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
