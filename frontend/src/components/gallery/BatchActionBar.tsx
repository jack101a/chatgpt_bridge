import React from 'react';
import { Download, Heart, Trash2, X, CheckSquare, Square } from 'lucide-react';

export interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onFavoriteAll: () => void;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onFavoriteAll,
  onDownloadAll,
  onDeleteAll,
  onClose,
}) => {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg animate-fade-in-up">
      <div className="bg-card/95 backdrop-blur-md border border-border text-foreground px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2">
        {/* Left: Selected count & Select All toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={isAllSelected ? onClearSelection : onSelectAll}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-mono"
            title={isAllSelected ? 'Deselect all' : 'Select all'}
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span className="font-semibold text-foreground">{selectedCount}</span>
            <span className="hidden sm:inline text-muted-foreground">selected</span>
          </button>
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={onFavoriteAll}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
            title="Favorite selected"
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={onDownloadAll}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Download selected"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            onClick={onDeleteAll}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-destructive/10 text-destructive transition-colors"
            title="Delete selected"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Right: Dismiss */}
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Exit selection mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
