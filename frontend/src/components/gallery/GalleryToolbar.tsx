import React from 'react';
import {
  Search,
  X,
  Rows3,
  LayoutGrid,
  Columns,
  Grid3X3,
  Heart,
  ArrowUpDown,
  CheckSquare,
} from 'lucide-react';
import { GalleryTimeFilter, GallerySortBy } from '../../types';
import { hapticImpact } from '../../lib/haptics';

export type GalleryDensityMode = 'feed' | 'grid' | 'masonry' | 'compact';
export type AspectRatioFilter = 'all' | 'square' | 'wide' | 'tall';

export interface GalleryToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  density: GalleryDensityMode;
  onDensityChange: (d: GalleryDensityMode) => void;
  timeFilter: GalleryTimeFilter;
  onTimeFilterChange: (f: GalleryTimeFilter) => void;
  aspectRatio: AspectRatioFilter;
  onAspectRatioChange: (ar: AspectRatioFilter) => void;
  sortBy: GallerySortBy;
  onSortByChange: (s: GallerySortBy) => void;
  isBatchMode: boolean;
  onToggleBatchMode: () => void;
  totalCount: number;
}

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  searchQuery,
  onSearchChange,
  density,
  onDensityChange,
  timeFilter,
  onTimeFilterChange,
  aspectRatio,
  onAspectRatioChange,
  sortBy,
  onSortByChange,
  isBatchMode,
  onToggleBatchMode,
  totalCount,
}) => {
  const timeFilters: { id: GalleryTimeFilter; label: string; icon?: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'favorites', label: 'Saved', icon: Heart },
  ];

  const aspectFilters: { id: AspectRatioFilter; label: string }[] = [
    { id: 'all', label: 'All Ratios' },
    { id: 'square', label: '1:1 Square' },
    { id: 'tall', label: '9:16 Portrait' },
    { id: 'wide', label: '16:9 Landscape' },
  ];

  return (
    <div className="w-full border-b border-border bg-card/60 backdrop-blur-md px-3 sm:px-4 py-2.5 flex flex-col gap-2 shrink-0 select-none">
      {/* Top Row: Search, Density & Batch Selection */}
      <div className="flex items-center justify-between gap-2">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter prompts, accounts, dates..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-8 text-xs bg-muted/50 focus:bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Controls: Density Switcher & Select Mode */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Density Controls (sv-table style) */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            <button
              onClick={() => {
                hapticImpact('selection');
                onDensityChange('feed');
              }}
              className={`p-1.5 rounded-md transition-colors ${
                density === 'feed'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Feed View (Vertical Scrolling Stream)"
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                hapticImpact('selection');
                onDensityChange('grid');
              }}
              className={`p-1.5 rounded-md transition-colors ${
                density === 'grid'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View (Standard)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                hapticImpact('selection');
                onDensityChange('masonry');
              }}
              className={`p-1.5 rounded-md transition-colors ${
                density === 'masonry'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Masonry View (Fluid Aspect Ratio)"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                hapticImpact('selection');
                onDensityChange('compact');
              }}
              className={`p-1.5 rounded-md transition-colors ${
                density === 'compact'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Compact View (Dense Feed)"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              hapticImpact('light');
              onToggleBatchMode();
            }}
            className={`flex items-center space-x-1.5 px-2.5 h-8 rounded-lg text-xs font-medium border transition-colors ${
              isBatchMode
                ? 'bg-primary/15 text-primary border-primary/40 font-semibold'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
            }`}
            title="Toggle batch selection"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          {/* Total Badge */}
          <span className="text-[11px] font-mono text-muted-foreground px-2 py-1 bg-muted/40 rounded-lg border border-border hidden md:inline">
            {totalCount} images
          </span>
        </div>
      </div>

      {/* Bottom Row: Facet Chips & Sort */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5">
        {/* Time Filters */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {timeFilters.map((tf) => {
            const Icon = tf.icon;
            const isActive = timeFilter === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => onTimeFilterChange(tf.id)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {Icon && <Icon size={12} className={isActive ? 'text-rose-500 fill-current' : ''} />}
                <span>{tf.label}</span>
              </button>
            );
          })}
        </div>

        {/* Aspect Ratio Facet Chips */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground hidden lg:inline mr-1">Ratio:</span>
          {aspectFilters.map((af) => {
            const isActive = aspectRatio === af.id;
            return (
              <button
                key={af.id}
                onClick={() => onAspectRatioChange(af.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                    : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted'
                }`}
              >
                {af.label}
              </button>
            );
          })}
        </div>

        {/* Sort selector */}
        <div className="flex items-center space-x-1 shrink-0 ml-auto">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as GallerySortBy)}
            className="bg-transparent text-xs text-muted-foreground hover:text-foreground font-mono focus:outline-none cursor-pointer"
          >
            <option value="newest" className="bg-card text-foreground">Newest</option>
            <option value="oldest" className="bg-card text-foreground">Oldest</option>
            <option value="duration" className="bg-card text-foreground">Fastest</option>
            <option value="size" className="bg-card text-foreground">Size</option>
          </select>
        </div>
      </div>
    </div>
  );
};
