import { useState, useEffect } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import { PromptLibraryData } from '../../types';
import { api } from '../../lib/api';

interface PromptLibraryTrayProps {
  onInsertModifier: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function PromptLibraryTray({ onInsertModifier, isOpen, onClose }: PromptLibraryTrayProps) {
  const [data, setData] = useState<PromptLibraryData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('camera_angles');
  const [newChipText, setNewChipText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const res = await api.getPromptLibrary();
      setData(res);
    } catch (e) {
      console.error('Failed to load prompt library:', e);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChipText.trim()) return;
    try {
      await api.addCustomChip(newChipText.trim());
      setNewChipText('');
      setIsAdding(false);
      await loadData();
    } catch (e) {
      console.error('Failed to add custom chip:', e);
    }
  };

  const handleDeleteCustom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteCustomChip(id);
      await loadData();
    } catch (e) {
      console.error('Failed to delete custom chip:', e);
    }
  };

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    camera_angles: 'Camera Angles',
    lighting: 'Lighting & Atmosphere',
    film_styles: 'Film Styles & Mediums',
    custom: 'My Presets',
  };

  return (
    <div className="border-b border-border bg-card/95 backdrop-blur-md p-3 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Header with Categories and Close */}
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar scrollbar-none py-0.5 pr-2">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-1 shrink-0 mr-1">
              <Sparkles size={12} className="text-primary" />
              Library:
            </span>
            {Object.keys(categoryLabels).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[30px] flex items-center ${
                  activeCategory === cat
                    ? 'bg-foreground text-background shadow-xs font-semibold'
                    : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors active:scale-95 ml-1"
            title="Close Library"
            aria-label="Close Library"
          >
            <X size={15} />
          </button>
        </div>

        {/* Chips List */}
        <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto pr-1">
          {activeCategory !== 'custom' &&
            data?.standard?.[activeCategory]?.map((modifier) => (
              <button
                key={modifier}
                type="button"
                onClick={() => onInsertModifier(modifier)}
                className="px-3 py-1.5 rounded-full text-xs font-mono bg-muted/60 hover:bg-muted border border-border text-foreground hover:border-primary/50 hover:text-primary transition-colors shadow-2xs active:scale-95 min-h-[32px] flex items-center"
              >
                + {modifier}
              </button>
            ))}

          {activeCategory === 'custom' && (
            <>
              {data?.custom?.map((chip) => (
                <div
                  key={chip.id}
                  onClick={() => onInsertModifier(chip.text)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-muted/60 hover:bg-muted border border-border text-foreground hover:border-primary/50 cursor-pointer shadow-2xs transition-colors min-h-[32px]"
                >
                  <span>+ {chip.text}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(chip.id, e)}
                    className="opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 p-0.5 rounded transition-opacity"
                    title="Delete preset"
                    aria-label="Delete preset"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {isAdding ? (
                <form onSubmit={handleAddCustom} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newChipText}
                    onChange={(e) => setNewChipText(e.target.value)}
                    placeholder="E.g. anamorphic lens, 8k"
                    className="px-3 py-1.5 rounded-full text-[16px] sm:text-xs bg-muted border border-primary text-foreground outline-none w-48 min-h-[32px]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-emerald-600 transition-colors min-h-[32px] active:scale-95"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-muted-foreground hover:text-foreground p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                    aria-label="Cancel"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors min-h-[32px] active:scale-95"
                >
                  <Plus size={13} /> Add Custom
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
