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
    <div className="border-b border-gray-200 dark:border-white/10 bg-gray-50/95 dark:bg-[#18181b]/95 backdrop-blur-md p-3 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Header with Categories and Close */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1 shrink-0 mr-1">
              <Sparkles size={12} className="text-emerald-500" />
              Library:
            </span>
            {Object.keys(categoryLabels).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  activeCategory === cat
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0"
            title="Close Library"
          >
            <X size={14} />
          </button>
        </div>

        {/* Chips List */}
        <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto pr-1">
          {activeCategory !== 'custom' &&
            data?.standard?.[activeCategory]?.map((modifier) => (
              <button
                key={modifier}
                type="button"
                onClick={() => onInsertModifier(modifier)}
                className="px-2.5 py-1 rounded-full text-xs font-mono bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-xs active:scale-95"
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
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer shadow-xs transition-colors"
                >
                  <span>+ {chip.text}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(chip.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-0.5 rounded transition-opacity"
                    title="Delete preset"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {isAdding ? (
                <form onSubmit={handleAddCustom} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newChipText}
                    onChange={(e) => setNewChipText(e.target.value)}
                    placeholder="E.g. anamorphic lens, 8k"
                    className="px-2.5 py-0.5 rounded-full text-xs bg-white dark:bg-zinc-900 border border-emerald-500 outline-none w-44"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-zinc-400 hover:text-zinc-600 p-1"
                  >
                    <X size={12} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 transition-colors"
                >
                  <Plus size={12} /> Add Custom
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
