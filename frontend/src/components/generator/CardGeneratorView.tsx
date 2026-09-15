import { useState } from 'react';
import { Menu, Sparkles, User, UserCheck, Smile } from 'lucide-react';
import { FaceCardGenerator } from './FaceCardGenerator';
import { BodyCardGenerator } from './BodyCardGenerator';
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
  const [activeCardType, setActiveCardType] = useState<'face' | 'body' | 'expression'>('face');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#121214]">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#e5e5e5] dark:border-[#27272a] px-4 flex items-center justify-between bg-white dark:bg-[#18181b] shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
            aria-label="Open Sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[#0d0d0d] dark:text-white hidden sm:inline">
              Reference Cards
            </span>
          </div>

          {/* Sub-Tabs: Face (Active) / Body / Expression */}
          <div className="flex items-center p-1 bg-[#f4f4f5] dark:bg-[#202023] rounded-xl text-xs font-medium ml-1 sm:ml-3">
            <button
              onClick={() => setActiveCardType('face')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                activeCardType === 'face'
                  ? 'bg-white dark:bg-[#18181b] text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <User size={13} />
              <span>Face Card</span>
            </button>

            <button
              onClick={() => setActiveCardType('body')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                activeCardType === 'body'
                  ? 'bg-white dark:bg-[#18181b] text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Body Card</span>
            </button>

            <button
              onClick={() => setActiveCardType('expression')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                activeCardType === 'expression'
                  ? 'bg-white dark:bg-[#18181b] text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Smile size={13} />
              <span>Expression Card</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-normal">
                Next
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-[#6e6e80] dark:text-[#a1a1aa] hidden md:flex items-center gap-1">
            <Sparkles size={13} className="text-emerald-500" />
            <span>Identity Turnaround Sheet</span>
          </div>
        </div>
      </header>

      {/* Main Sub-tab Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeCardType === 'face' && (
          <FaceCardGenerator
            characters={characters}
            onRefreshCharacters={onRefreshCharacters}
            onOpenViewer={onOpenViewer}
            onContinueInChat={onContinueInChat}
          />
        )}

        {activeCardType === 'body' && (
          <BodyCardGenerator
            characters={characters}
            onRefreshCharacters={onRefreshCharacters}
            onOpenViewer={onOpenViewer}
            onContinueInChat={onContinueInChat}
          />
        )}

        {activeCardType === 'expression' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#fafafa] dark:bg-[#141416]">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <Smile size={28} />
            </div>
            <h3 className="font-semibold text-base text-[#0d0d0d] dark:text-white mb-1">
              Expression Lock Card Generator
            </h3>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] max-w-sm mb-4">
              The Expression Reference Card generator (Image 3 — natural emotional range, eye expressions, and realism) will follow right after!
            </p>
            <button
              onClick={() => setActiveCardType('face')}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
            >
              Switch to Face Identity Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
