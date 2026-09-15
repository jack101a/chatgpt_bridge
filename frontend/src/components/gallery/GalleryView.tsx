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
 * - Double-tap quick favorite with emerald star flash
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
      onToggleFavorite(item.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 850);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
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
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-sky-300 text-[10px] font-mono backdrop-blur-md border border-white/10 shadow-sm" title="Backed up to Telegram Cloud Vault">
            <Cloud size={11} className="text-sky-400" />
            <span>Vault</span>
          </span>
        </div>
      )}

      {/* Instagram-style Glowing Red Heart Pop on Double-Tap */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-fade">
          <div className="p-5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl scale-125 animate-bounce">
            <Heart size={48} fill="#f43f5e" className="text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]" />
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
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === sortBy)?.label || 'Sort';

  return (
    <div className="flex flex-col h-full w-full bg-[#ffffff] dark:bg-[#121214] overflow-hidden relative">
      {/* ── Top Header with Controls (Auto-Hides on Scroll Down in Feed Mode) ── */}
      <header
        className={`px-4 pt-3 pb-2.5 border-b border-[#e5e5e5] dark:border-[#27272a] bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md flex-shrink-0 space-y-2.5 z-30 transition-transform duration-300 ease-out ${
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
                onClick={onOpenSidebar}
                className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            )}

            {onGoHome && (
              <button
                onClick={onGoHome}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all active:scale-95"
                title="New Chat"
                aria-label="New Chat"
              >
                <ArrowLeft size={14} className="text-emerald-500" />
                <span>New Chat</span>
              </button>
            )}

            {onGoHome && (
              <button
                onClick={onGoHome}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all active:scale-95"
                title="Go to Homepage"
              >
                <Home size={14} className="text-emerald-500" />
                <span>Home</span>
              </button>
            )}

            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-[#0d0d0d] dark:text-white leading-tight">
                Gallery Timeline
              </h1>
              <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] leading-none">
                {total} {total === 1 ? 'generation' : 'generations'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Account status badge */}
            {onOpenAccounts && (
              <button
                onClick={onOpenAccounts}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 active:scale-95 transition-all"
                title="Manage Accounts"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-mono">{activeAccount?.alias || 'Primary'}</span>
                <span className="text-[10px] text-emerald-600/70 font-sans hidden sm:inline">● Live</span>
              </button>
            )}

            {onOpenAccounts && (
              <button
                onClick={onOpenAccounts}
                className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all"
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
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search prompts, styles, or IDs…"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f4f4f5] dark:bg-[#1c1c1f] border border-transparent focus:border-emerald-500 text-xs text-[#0d0d0d] dark:text-white placeholder:text-gray-400 outline-none transition-all"
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
                  onFilterChange(tf.id);
                  onAccountFilterChange(null);
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-sm'
                    : 'bg-[#f4f4f5] dark:bg-[#202024] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                {Icon && <Icon size={12} fill="currentColor" className="text-amber-400" />}
                {tf.label}
              </button>
            );
          })}

          <div className="w-px h-3.5 bg-gray-200 dark:bg-zinc-800 mx-1 flex-shrink-0" />

          {/* Account Filter Chips */}
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => onAccountFilterChange(accountFilter === acc.alias ? null : acc.alias)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                accountFilter === acc.alias
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[#f4f4f5] dark:bg-[#202024] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
              }`}
            >
              <User size={11} />
              {acc.alias}
            </button>
          ))}
        </div>

        {/* Row 2: Timeline View Mode (Segmented), Layout Mode Switcher & Sort Dropdown */}
        <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-gray-100 dark:border-zinc-800/80">
          {/* Group By (Timeline Granularity) Segmented Control */}
          <div className="flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-zinc-900 border border-gray-200/60 dark:border-zinc-800">
            {GROUP_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => onGroupByChange(g.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  groupBy === g.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Layout Mode Switcher (Grid vs Full-Size Feed) */}
            <div className="flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-zinc-900 border border-gray-200/60 dark:border-zinc-800">
              <button
                onClick={() => onLayoutModeChange('grid')}
                className={`p-1 rounded-lg transition-all ${
                  layoutMode === 'grid'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
                title="Gallery Grid Mode (Default)"
                aria-label="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => onLayoutModeChange('feed')}
                className={`p-1 rounded-lg transition-all ${
                  layoutMode === 'feed'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
                title="Full-Size Feed Mode (Instagram Style)"
                aria-label="Feed View"
              >
                <Rows3 size={14} />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setIsSortMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 transition-all active:scale-95 border border-gray-200/60 dark:border-zinc-700/60"
                aria-label="Sort options"
              >
                <ArrowUpDown size={12} className="text-emerald-500" />
                <span>{currentSortLabel}</span>
              </button>

              {isSortMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-zinc-800/80">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
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
                          onSortByChange(opt.id);
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={isSelected ? 'text-emerald-500' : 'text-gray-400'} />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-emerald-500" />}
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
            setIsChromeVisible(true);
            onToggleChrome?.(true);
          }}
          className="fixed top-4 right-4 z-40 px-3.5 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-white/15 backdrop-blur-xl text-xs font-semibold text-white/90 shadow-2xl flex items-center gap-1.5 active:scale-95 transition-all animate-fade"
          aria-label="Show Menu"
        >
          <Menu size={13} className="text-emerald-400" />
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
            ? 'bg-black px-0 pt-36 pb-24 space-y-2'
            : 'p-3 sm:p-4'
        }`}
      >
        {/* Empty State */}
        {items.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 text-gray-400">
            <Sparkles size={36} className="mb-3 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-[#0d0d0d] dark:text-white mb-1">
              No generations found
            </p>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] max-w-xs">
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
              <div className="sticky top-0 z-10 py-1.5 px-3 mb-2.5 rounded-xl bg-white/85 dark:bg-[#121214]/85 backdrop-blur-md border border-gray-200/50 dark:border-zinc-800/60 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-emerald-500" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {section.label}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {section.items.length} {section.items.length === 1 ? 'photo' : 'photos'}
                </span>
              </div>
            )}

            {/* Mode 1: Gallery Grid (Default) */}
            {layoutMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onOpenViewer(item)}
                    className="group relative rounded-2xl overflow-hidden bg-[#f4f4f5] dark:bg-[#1c1c1f] border border-[#e5e5e5] dark:border-[#27272a] shadow-sm hover:shadow-md cursor-pointer transition-all duration-150 active:scale-[0.98]"
                  >
                    <img
                      src={item.thumbnail_url || item.url}
                      alt={item.prompt || 'Generated art'}
                      loading="lazy"
                      className="w-full aspect-square object-cover"
                    />

                    {/* Minimal Info Badges */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-1 max-w-[75%]">
                        <span className="px-2 py-0.5 rounded-full bg-black/65 text-white/90 text-[10px] font-mono backdrop-blur-md truncate">
                          {item.account_used || 'Primary'}
                        </span>
                        {item.tg_file_id && (
                          <span className="px-1.5 py-0.5 rounded-full bg-black/65 text-sky-300 text-[9px] font-mono backdrop-blur-md flex items-center gap-0.5" title="Telegram Cloud Backed">
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
                          onToggleFavorite(item.id);
                        }}
                        className={`pointer-events-auto p-1.5 rounded-full bg-black/65 backdrop-blur-md transition-all active:scale-90 ${
                          item.favorite ? 'text-rose-500' : 'text-white/70 hover:text-white'
                        }`}
                        aria-label="Save"
                      >
                        <Heart size={12} fill={item.favorite ? '#f43f5e' : 'none'} className={item.favorite ? 'text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]' : ''} />
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
          <div className="flex justify-center items-center py-6 gap-2 text-zinc-500 text-xs">
            <Loader2 size={16} className="animate-spin text-emerald-500" />
            <span>Loading more images…</span>
          </div>
        )}

        {/* End of Timeline Card */}
        {!hasMore && items.length > 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 dark:text-zinc-600">
            <div className="w-8 h-px bg-gray-200 dark:bg-zinc-800 mb-2" />
            <p className="text-[11px] font-medium tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
              ✦ You've reached the beginning
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {items.length} {items.length === 1 ? 'image' : 'images'} in timeline
            </p>
          </div>
        )}
      </PullToRefresh>

      {/* Floating "Back to Top" Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-5 sm:bottom-8 sm:right-8 z-30 p-2.5 rounded-full bg-black/80 dark:bg-white/90 text-white dark:text-black backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 animate-in fade-in"
          title="Scroll to Top"
          aria-label="Scroll to Top"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
};
