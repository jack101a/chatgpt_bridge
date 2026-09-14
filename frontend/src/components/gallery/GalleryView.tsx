import React from 'react';
import { Search, Star, Sparkles, Loader2, User } from 'lucide-react';
import { GalleryItem, Account } from '../../types';

interface GalleryViewProps {
  items: GalleryItem[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: 'all' | 'today' | 'favorites';
  onFilterChange: (f: 'all' | 'today' | 'favorites') => void;
  accountFilter: string | null;
  onAccountFilterChange: (acc: string | null) => void;
  accounts: Account[];
  onLoadMore: () => void;
  onOpenViewer: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  items,
  total,
  isLoading,
  hasMore,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  accountFilter,
  onAccountFilterChange,
  accounts,
  onLoadMore,
  onOpenViewer,
  onToggleFavorite,
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-[#ffffff] dark:bg-[#121214] overflow-hidden">
      {/* ── Top Header ── */}
      <header className="px-4 pt-4 pb-2 border-b border-[#e5e5e5] dark:border-[#27272a] bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0d0d0d] dark:text-white">
              Bridge Gallery
            </h1>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa]">
              {total} {total === 1 ? 'generation' : 'generations'} indexed
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search prompts or thread IDs…"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f4f4f5] dark:bg-[#1c1c1f] border border-transparent focus:border-emerald-500 text-xs text-[#0d0d0d] dark:text-white placeholder:text-gray-400 outline-none transition-all"
          />
        </div>

        {/* Filter Pills Row (Horizontal Scroll on Mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => {
              onFilterChange('all');
              onAccountFilterChange(null);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === 'all' && !accountFilter
                ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-sm'
                : 'bg-[#f4f4f5] dark:bg-[#202024] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
            }`}
          >
            All ({total})
          </button>

          <button
            onClick={() => {
              onFilterChange('today');
              onAccountFilterChange(null);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === 'today'
                ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-sm'
                : 'bg-[#f4f4f5] dark:bg-[#202024] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => {
              onFilterChange('favorites');
              onAccountFilterChange(null);
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === 'favorites'
                ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-sm'
                : 'bg-[#f4f4f5] dark:bg-[#202024] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
            }`}
          >
            <Star size={12} fill="currentColor" className="text-amber-400" />
            Saved
          </button>

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
      </header>

      {/* ── Masonry Grid Feed (2 columns on mobile, 3-4 on desktop) ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {items.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 text-gray-400">
            <Sparkles size={32} className="mb-2 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-[#0d0d0d] dark:text-white mb-1">
              No generations found
            </p>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa]">
              {searchQuery ? 'Try clearing your search query' : 'Generated images will appear here'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onOpenViewer(item)}
              className="group relative rounded-2xl overflow-hidden bg-[#f4f4f5] dark:bg-[#1c1c1f] border border-[#e5e5e5] dark:border-[#27272a] shadow-sm hover:shadow-md cursor-pointer transition-all duration-150 active:scale-[0.98]"
            >
              <img
                src={item.url}
                alt={item.prompt || 'Generated art'}
                loading="lazy"
                className="w-full aspect-square object-cover"
              />

              {/* Minimal Bottom Info Badge */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded-full bg-black/60 text-white/90 text-[10px] font-mono backdrop-blur-md truncate max-w-[70%]">
                  {item.account_used || 'Primary'}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  className={`pointer-events-auto p-1.5 rounded-full bg-black/60 backdrop-blur-md transition-all active:scale-90 ${
                    item.favorite ? 'text-amber-400' : 'text-white/70 hover:text-white'
                  }`}
                  aria-label="Save"
                >
                  <Star size={12} fill={item.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Pagination */}
        {hasMore && (
          <div className="flex justify-center py-6">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="px-5 py-2 rounded-full bg-[#f4f4f5] dark:bg-[#202024] hover:bg-gray-200 dark:hover:bg-[#2a2a30] text-xs font-medium text-[#0d0d0d] dark:text-white transition-all active:scale-95 flex items-center gap-2"
            >
              {isLoading && <Loader2 size={14} className="animate-spin text-emerald-500" />}
              {isLoading ? 'Loading…' : 'Load more images'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
