import { Menu, Sparkles } from 'lucide-react';
import { ReferenceCardWizard } from './ReferenceCardWizard';
import { CharacterCard, GalleryItem } from '../../types';

interface CardGeneratorViewProps {
  characters: CharacterCard[];
  onRefreshCharacters: () => void;
  onOpenSidebar: () => void;
  onOpenViewer?: (item: GalleryItem) => void;
  onContinueInChat?: (item: GalleryItem) => void;
}

export function CardGeneratorView({
  characters,
  onRefreshCharacters,
  onOpenSidebar,
  onOpenViewer,
  onContinueInChat,
}: CardGeneratorViewProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden bg-white dark:bg-[#121214]">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#e5e5e5] dark:border-[#27272a] px-4 flex items-center justify-between bg-white dark:bg-[#18181b] shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
            aria-label="Open Sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[#0d0d0d] dark:text-white">
              Reference Card Studio
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              <Sparkles size={11} />
              <span>3-Step Identity Lock</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-[#6e6e80] dark:text-[#a1a1aa] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Character Studio</span>
            <span>DNA Lock</span>
          </div>
        </div>
      </header>

      {/* Main 3-Step Wizard Stage */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <ReferenceCardWizard
          characters={characters}
          onRefreshCharacters={onRefreshCharacters}
          onOpenViewer={onOpenViewer}
          onContinueInChat={onContinueInChat}
        />
      </div>
    </div>
  );
}
