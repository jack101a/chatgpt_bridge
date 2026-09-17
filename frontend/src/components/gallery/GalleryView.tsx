import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Heart,
  Sparkles,
  Loader2,
  User,
  Menu,
  Home,
  Settings2,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  Calendar,
  Check,
  Zap,
  HardDrive,
  Clock,
  Layers,
  LayoutGrid,
  Rows3,
  Cloud,
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

const SORT_OPTIONS: { id: GallerySortBy; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'newest', label: 'Newest First', icon: Clock },
  { id: 'oldest', label: 'Oldest First', icon: Clock },
  { id: 'duration', label: 'Fastest Speed', icon: Zap },
  { id: 'size', label: 'Largest File Size', icon: HardDrive },
  { id: 'retries', label: 'Most Refined', icon: Layers },
];

const GROUP_OPTIONS: { id: GalleryGroupBy; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'Days' },
  { id: 'week', label: 'Weeks' },
  { id: 'month', label: 'Months' },
  { id: 'year', label: 'Years' },
];

const TIME_FILTERS: { id: GalleryTimeFilter; label: string; icon?: React.FC<{ size?: number; className?: string; fill?: string }> }[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'favorites', label: 'Saved', icon: Heart },
];

/**
 * Ultra-Clean Edge-to-Edge Darkroom Canvas Feed Item
 * - Zero UI clutter / zero button distractions
 * - 100% natural resolution image coverage
 * - Smooth skeleton loading with fade-in
 * - Double-tap quick favorite with glowing red heart pop + tactile haptics
 * - Single-tap launches full Photo Viewer with all tools & details
 */
const GalleryFeedCard: React.FC<{
  item: GalleryItem;
  onOpenViewer: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
}> = ({ item, onOpenViewer, onToggleFavorite }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className="relative w-full bg-black flex items-center justify-center cursor-pointer select-none overflow-hidden my-1.5 sm:my-2.5"
    >
      {/* Loading Skeleton Shimmer */}
      {!isLoaded && (
        <div className="w-full aspect-[3/4] max-h-[75vh] bg-zinc-950/90 animate-pulse flex items-center justify-center">
          <Loader2 size={24} className="text-zinc-700 animate-spin" />
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

      {/* Cloud Vault Backed Indicator */}
      {item.tg_file_id && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
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
          <div className="p-5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl scale-125 animate-bounce">
            <Heart
              size={48}
              fill="#f43f5e"
              className="text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]"
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
  onGroupByChange,
  layoutMode,
  onLayoutModeChange,
  accountFilter,
  onAccountFilterChange,
  accounts,
  onLoadMore,
  onOpenViewer,
  onToggleFavorite,
  onRefresh,
  activeAccount,
  onOpenAccounts,
  onOpenSidebar,
  onGoHome,
  onPromptWithImage: _onPromptWithImage,
  onToggleChrome,
}) => {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const lastScrollTopRef = useRef<number>(0);
  const accumulatedUpScrollRef = useRef<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Restore chrome when switching back to grid mode
  useEffect(() => {
    if (layoutMode === 'grid') {
      setIsChromeVisible(true);
      onToggleChrome?.(true);
    }
  }, [layoutMode, onToggleChrome]);

  // Close sort menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    if (isSortMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSortMenuOpen]);

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
    if (layoutMode === 'feed') {
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
        // 8x threshold: reveal chrome only after continuous deliberate upward scroll of 720px, or right at the top
        if ((accumulatedUpScrollRef.current > 720 || scrollTop < 30) && !isChromeVisible) {
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
  }, [hasMore, isLoading, onLoadMore, layoutMode, isChromeVisible, onToggleChrome]);

  const scrollToTop = () => {
    hapticImpact('light');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === sortBy)?.label || 'Sort';

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative select-none">
      {/* ── Top Header with Controls (Auto-Hides on Scroll Down in Feed Mode) ── */}
      <header
        className={`px-3.5 sm:px-4 pt-3 pb-2.5 border-b border-border bg-card/95 dark:bg-[#121214]/95 backdrop-blur-xl flex-shrink-0 space-y-2.5 z-30 transition-transform duration-300 ease-out shadow-xs ${
          layoutMode === 'feed'
            ? `fixed top-0 left-0 right-0 ${
                isChromeVisible ? 'translate-y-0 shadow-md' : '-translate-y-full pointer-events-none'
              }`
            : 'sticky top-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onOpenSidebar && (
              <button
                onClick={() => {
                  hapticImpact('light');
                  onOpenSidebar();
                }}
                className="lg:hidden min-w-[44px] min-h-[44px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center active:scale-95 transition-all"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            )}

            {onGoHome && (
              <button
                onClick={() => {
                  hapticImpact('light');
                  onGoHome();
                }}
                className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-all active:scale-95 border border-border/40"
                title="New Chat"
                aria-label="New Chat"
              >
                <ArrowLeft size={14} className="text-primary" />
                <span>New Chat</span>
              </button>
            )}

            {onGoHome && (
              <button
                onClick={() => {
                  hapticImpact('light');
                  onGoHome();
                }}
                className="hidden sm:flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-all active:scale-95 border border-border/40"
                title="Go to Homepage"
              >
                <Home size={14} className="text-primary" />
                <span>Home</span>
              </button>
            )}

            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-foreground leading-tight">
                Gallery Timeline
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none">
                {total} {total === 1 ? 'generation' : 'generations'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Account status badge */}
            {onOpenAccounts && (
              <button
                onClick={() => {
                  hapticImpact('light');
                  onOpenAccounts();
                }}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[11px] font-medium text-primary active:scale-95 transition-all shadow-2xs"
                title="Manage Accounts"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-mono font-semibold">{activeAccount?.alias || 'Primary'}</span>
                <span className="text-[10px] text-primary/70 font-sans hidden sm:inline">● Live</span>
              </button>
            )}

            {onOpenAccounts && (
              <button
                onClick={() => {
                  hapticImpact('light');
                  onOpenAccounts();
                }}
                className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-all active:scale-95"
                aria-label="Settings"
              >
                <Settings2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search prompts, styles, or IDs…"
            className="w-full min-h-[40px] pl-9 pr-4 py-2 rounded-xl bg-muted/60 border border-border/80 focus:border-primary focus:bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
          />
        </div>

        {/* Row 1: Time Range Filters & Account Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {TIME_FILTERS.map((tf) => {
            const Icon = tf.icon;
            const isSelected = activeFilter === tf.id && !accountFilter;
            return (
              <button
                key={tf.id}
                onClick={() => {
                  hapticImpact('selection');
                  onFilterChange(tf.id);
                  onAccountFilterChange(null);
                }}
                className={`min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-foreground text-background shadow-xs font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/40'
                }`}
              >
                {Icon && <Icon size={12} fill="currentColor" className="text-amber-400" />}
                {tf.label}
              </button>
            );
          })}

          <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

          {/* Account Filter Chips */}
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => {
                hapticImpact('selection');
                onAccountFilterChange(accountFilter === acc.alias ? null : acc.alias);
              }}
              className={`min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                accountFilter === acc.alias
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/40'
              }`}
            >
              <User size={11} />
              {acc.alias}
            </button>
          ))}
        </div>

        {/* Row 2: Timeline View Mode (Segmented), Layout Mode Switcher & Sort Dropdown */}
        <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/60">
          {/* Group By (Timeline Granularity) Segmented Control */}
          <div className="flex items-center p-0.5 rounded-xl bg-muted border border-border/60">
            {GROUP_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  hapticImpact('selection');
                  onGroupByChange(g.id);
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                  groupBy === g.id
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Layout Mode Switcher (Grid vs Full-Size Feed) */}
            <div className="flex items-center p-0.5 rounded-xl bg-muted border border-border/60">
              <button
                onClick={() => {
                  hapticImpact('selection');
                  onLayoutModeChange('grid');
                }}
                className={`min-w-[36px] min-h-[34px] flex items-center justify-center p-1.5 rounded-lg transition-all active:scale-95 ${
                  layoutMode === 'grid'
                    ? 'bg-card text-primary shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Gallery Grid Mode"
                aria-label="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => {
                  hapticImpact('selection');
                  onLayoutModeChange('feed');
                }}
                className={`min-w-[36px] min-h-[34px] flex items-center justify-center p-1.5 rounded-lg transition-all active:scale-95 ${
                  layoutMode === 'feed'
                    ? 'bg-card text-primary shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Full-Size Vertical Feed Mode"
                aria-label="Feed View"
              >
                <Rows3 size={14} />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => {
                  hapticImpact('light');
                  setIsSortMenuOpen((prev) => !prev);
                }}
                className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-[11px] font-semibold text-foreground transition-all active:scale-95 border border-border/60 shadow-2xs"
                aria-label="Sort options"
              >
                <ArrowUpDown size={12} className="text-primary" />
                <span>{currentSortLabel}</span>
              </button>

              {isSortMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-card border border-border shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-border/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sort Gallery
                    </span>
                  </div>
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          hapticImpact('selection');
                          onSortByChange(opt.id);
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Floating Sleek Menu Restore Pill in Feed Mode when chrome is hidden */}
      {layoutMode === 'feed' && !isChromeVisible && (
        <button
          onClick={() => {
            hapticImpact('light');
            setIsChromeVisible(true);
            onToggleChrome?.(true);
          }}
          className="fixed top-4 right-4 z-40 min-h-[44px] px-4 py-2 rounded-full bg-black/80 hover:bg-black/95 border border-white/20 backdrop-blur-xl text-xs font-semibold text-white/95 shadow-2xl flex items-center gap-1.5 active:scale-95 transition-all animate-fade"
          aria-label="Show Menu"
        >
          <Menu size={14} className="text-primary" />
          <span>Menu</span>
        </button>
      )}

      {/* ── Scrollable Timeline Content ── */}
      <PullToRefresh
        id="gallery-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onRefresh={onRefresh}
        className={`min-h-full no-scrollbar ${
          layoutMode === 'feed'
            ? 'bg-black px-0 pt-40 pb-28 space-y-2.5'
            : 'p-3 sm:p-4 pb-28'
        }`}
      >
        {/* Empty State */}
        {items.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-4 text-muted-foreground">
            <Sparkles size={36} className="mb-3 text-muted-foreground/40 animate-pulse" />
            <p className="text-sm font-semibold text-foreground mb-1">
              No generations found
            </p>
            <p className="text-xs text-muted-foreground max-w-xs font-mono">
              {searchQuery
                ? 'Try clearing your search query or switching date filters.'
                : 'Generated images from your ChatGPT conversations will appear in this timeline.'}
            </p>
          </div>
        )}

        {/* Timeline Sections */}
        {sections.map((section) => (
          <div key={section.key} className={layoutMode === 'feed' ? 'mb-2' : 'mb-6 last:mb-2'}>
            {/* Sticky Timeline Section Header (Grid Mode only to keep Feed Mode pure) */}
            {groupBy !== 'all' && layoutMode === 'grid' && (
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

            {/* Mode 1: Gallery Grid */}
            {layoutMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      hapticImpact('light');
                      onOpenViewer(item);
                    }}
                    className="group relative rounded-2xl overflow-hidden bg-card border border-border shadow-2xs hover:shadow-md cursor-pointer transition-all duration-150 active:scale-[0.98]"
                  >
                    <img
                      src={item.thumbnail_url || item.url}
                      alt={item.prompt || 'Generated art'}
                      loading="lazy"
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                    />

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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Mode 2: Ultra-Clean Edge-to-Edge Darkroom Feed */
              <div className="flex flex-col items-center w-full">
                {section.items.map((item) => (
                  <GalleryFeedCard
                    key={item.id}
                    item={item}
                    onOpenViewer={onOpenViewer}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
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
