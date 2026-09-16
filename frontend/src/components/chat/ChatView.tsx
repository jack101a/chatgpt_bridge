import React, { useRef, useEffect } from 'react';
import { Menu, Sparkles, Settings2, Loader2 } from 'lucide-react';
import { GalleryItem, Account, ChatMessage, ImageRequest, CharacterCard } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { PullToRefresh } from '../common/PullToRefresh';

interface ChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  progressStatus: string | null;
  retryCount: number;
  activeAccount: Account | null;
  activeConvId: string | null;
  onSend: (req: ImageRequest) => Promise<any>;
  onClearThread: () => void;
  onOpenViewer: (item: GalleryItem) => void;
  onOpenAccounts: () => void;
  onOpenSidebar: () => void;
  onContinueThread: (convId: string) => void;
  onToggleFavorite?: (id: string) => void;
  referenceImage?: GalleryItem | null;
  onClearReference?: () => void;
  onPromptWithImage?: (item: GalleryItem) => void;
  onRefresh?: () => Promise<void> | void;
  characters?: CharacterCard[];
  activeCharacter?: CharacterCard | null;
  onSelectCharacter?: (character: CharacterCard | null) => void;
  onThreadCreated?: (newConvId: string) => void;
}

const SUGGESTIONS = [
  'Cyberpunk ramen stall in rain with neon signs',
  'Cinematic portrait of a wanderer at sunset',
  'Macro shot of a glowing bioluminescent mushroom',
  'Minimalist architectural poster in muted earth tones',
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isGenerating,
  progressStatus,
  retryCount,
  activeAccount,
  activeConvId,
  onSend,
  onClearThread,
  onOpenViewer,
  onOpenAccounts,
  onOpenSidebar,
  onContinueThread,
  onToggleFavorite,
  referenceImage,
  onClearReference,
  onPromptWithImage,
  onRefresh,
  characters,
  activeCharacter,
  onSelectCharacter,
  onThreadCreated,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isGenerating]);

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full bg-[#ffffff] dark:bg-[#121214] overflow-hidden">
      {/* ── Top Header ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5] dark:border-[#27272a] bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
              Bridge <span className="text-gray-400 font-normal text-xs">· ChatGPT Studio</span>
            </h1>
            <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa] -mt-0.5">
              Self-hosted AI image generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Account status badge (clickable -> opens accounts drawer) */}
          <button
            onClick={onOpenAccounts}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 active:scale-95 transition-all"
            title="Manage Accounts"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono">{activeAccount?.alias || 'Primary'}</span>
            <span className="text-[10px] text-emerald-600/70 font-sans hidden sm:inline">● Live</span>
          </button>

          <button
            onClick={onOpenAccounts}
            className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all"
            aria-label="Settings"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {/* ── Scrollable Chat Thread ── */}
      <PullToRefresh ref={scrollRef} onRefresh={onRefresh} className="px-4 py-4 space-y-2">
        {/* Empty state suggestions */}
        {messages.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-2 animate-fade">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <Sparkles size={24} />
            </div>
            <h2 className="text-lg font-semibold text-[#0d0d0d] dark:text-white mb-1.5">
              What will you create today?
            </h2>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] leading-relaxed mb-6">
              Prompt Bridge to generate high-resolution DALL·E art with account failover, multi-layered refinements, and thread continuity.
            </p>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onSend({ prompt: sug })}
                  className="text-left p-3 rounded-xl bg-[#f7f7f8] dark:bg-[#1c1c1f] hover:bg-gray-100 dark:hover:bg-[#25252a] border border-[#e5e5e5] dark:border-[#2a2a2e] text-xs text-[#0d0d0d] dark:text-[#d4d4d8] leading-snug transition-all active:scale-[0.98]"
                >
                  "{sug}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onOpenViewer={onOpenViewer}
            onContinueThread={onContinueThread}
            onToggleFavorite={onToggleFavorite}
            onPromptWithImage={onPromptWithImage}
          />
        ))}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-start gap-3 mb-6 animate-fade">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
              <Loader2 size={14} className="animate-spin" />
            </div>
            <div className="flex-1 max-w-md">
              <div className="text-xs font-semibold text-[#0d0d0d] dark:text-white mb-1">
                Bridge AI
              </div>
              <div className="p-3 rounded-2xl bg-[#f4f4f5] dark:bg-[#1f1f23] border border-[#e5e5e5] dark:border-[#2e2e34] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#6e6e80] dark:text-[#a1a1aa]">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    {progressStatus || 'Generating image…'}
                  </span>
                  <span className="font-mono text-[11px]">
                    {retryCount > 1 ? `Attempt ${retryCount}` : 'Running'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-2/3 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        )}
      </PullToRefresh>

      {/* ── Fixed Bottom Composer ── */}
      <div className="flex-shrink-0 bg-white dark:bg-[#121214] border-t border-[#f0f0f0] dark:border-[#1e1e22]">
        <Composer
          onSend={onSend}
          isGenerating={isGenerating}
          activeConvId={activeConvId}
          onClearThread={onClearThread}
          referenceImage={referenceImage}
          onClearReference={onClearReference}
          characters={characters}
          activeCharacter={activeCharacter}
          onSelectCharacter={onSelectCharacter}
          onThreadCreated={onThreadCreated}
        />
      </div>
    </div>
  );
};
