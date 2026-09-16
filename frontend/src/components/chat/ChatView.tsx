import React, { useRef, useEffect } from 'react';
import { Menu, Sparkles, Settings2 } from 'lucide-react';
import { GalleryItem, Account, ChatMessage, ImageRequest, CharacterCard } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { PullToRefresh } from '../common/PullToRefresh';
import { DotMatrixLoader } from '../common/DotMatrixLoader';

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
  hideHeader?: boolean;
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
  hideHeader = true,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isGenerating]);

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full bg-background overflow-hidden relative">
      {/* Optional Top Header if not handled by AppHeader */}
      {!hideHeader && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSidebar}
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                Bridge <span className="text-muted-foreground font-normal text-xs">· ChatGPT Studio</span>
              </h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">
                Self-hosted AI image generation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAccounts}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary active:scale-95 transition-all"
              title="Manage Accounts"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono">{activeAccount?.alias || 'Primary'}</span>
            </button>

            <button
              onClick={onOpenAccounts}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
              aria-label="Settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
      )}

      {/* ── Scrollable Chat Thread ── */}
      <PullToRefresh ref={scrollRef} onRefresh={onRefresh} className="px-4 py-4 space-y-2 flex-1 overflow-y-auto no-scrollbar">
        {/* Empty state suggestions */}
        {messages.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-2 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4 shadow-sm">
              <Sparkles size={22} />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              What do you want to imagine?
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              Prompt directly in natural language or tap a suggestion below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onSend({ prompt: sug })}
                  className="text-left p-3 rounded-xl bg-card hover:bg-muted border border-border text-xs text-foreground leading-snug transition-all active:scale-[0.98]"
                >
                  &ldquo;{sug}&rdquo;
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

        {/* ── High-Tech Matrix Generating Indicator (sv-matrix style) ── */}
        {isGenerating && (
          <div className="flex items-start gap-3 mb-6 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div className="flex-1 max-w-md">
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <DotMatrixLoader size="sm" variant="hex" speed={1.2} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {progressStatus || 'Synthesizing artwork with DALL-E…'}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="text-primary font-medium">
                        {activeAccount?.alias || 'Primary Account'}
                      </span>
                      <span>•</span>
                      <span>{retryCount > 1 ? `Attempt ${retryCount}` : 'Running'}</span>
                    </div>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-3/4 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        )}
      </PullToRefresh>

      {/* ── Fixed Bottom Composer ── */}
      <div className="shrink-0 bg-card border-t border-border">
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
