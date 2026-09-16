import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ArrowUp,
  Heart,
  Cloud,
  CheckCircle2,
  Calendar,
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
import { api } from '../../lib/api';

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
  const [density, setDensity] = useState<GalleryDensityMode>('grid');
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
