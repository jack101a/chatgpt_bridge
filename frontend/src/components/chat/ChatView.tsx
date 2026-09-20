import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Menu, Sparkles, Settings2, Shuffle, Compass, CornerDownLeft } from 'lucide-react';
import {
  GalleryItem,
  Account,
  ChatMessage,
  ImageRequest,
  CharacterCard,
  CuratedPrompt,
} from '../../types';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { PullToRefresh } from '../common/PullToRefresh';
import { DotMatrixLoader } from '../common/DotMatrixLoader';
import { api } from '../../lib/api';
import { hapticImpact } from '../../lib/haptics';

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

const FALLBACK_SUGGESTIONS: CuratedPrompt[] = [
  {
    id: 1,
    title: 'Cyberpunk Ramen Stall',
    category: 'Cinematic',
    styles: ['Cyberpunk', 'Cinematic'],
    scenes: ['Urban', 'Night'],
    source: 'preset',
    thumbnail: '',
    prompt: 'A bustling cyberpunk ramen stall in rain with neon signs, steaming bowls, reflective wet pavement, 8k resolution, cinematic lighting',
    promptPreview: 'A bustling cyberpunk ramen stall in rain with neon signs, steaming bowls...',
  },
  {
    id: 2,
    title: 'Wanderer at Sunset',
    category: 'Portrait',
    styles: ['Portrait', 'Cinematic'],
    scenes: ['Outdoor', 'Sunset'],
    source: 'preset',
    thumbnail: '',
    prompt: 'Cinematic portrait of a lone wanderer at golden hour sunset, rim lighting, 35mm photography, shallow depth of field, atmospheric haze',
    promptPreview: 'Cinematic portrait of a lone wanderer at golden hour sunset, rim lighting...',
  },
  {
    id: 3,
    title: 'Bioluminescent Mushroom',
    category: 'Macro',
    styles: ['Macro', 'Nature'],
    scenes: ['Forest', 'Night'],
    source: 'preset',
    thumbnail: '',
    prompt: 'Macro shot of a glowing bioluminescent mushroom in an enchanted misty forest, ethereal blue and green spore particles, detailed texture',
    promptPreview: 'Macro shot of a glowing bioluminescent mushroom in an enchanted misty forest...',
  },
  {
    id: 4,
    title: 'Minimalist Architecture',
    category: 'Architecture',
    styles: ['Minimalist', 'Poster'],
    scenes: ['Architectural', 'Studio'],
    source: 'preset',
    thumbnail: '',
    prompt: 'Minimalist architectural poster in muted earth tones, geometric brutalist shadows, soft natural sunlight, Scandinavian aesthetic',
    promptPreview: 'Minimalist architectural poster in muted earth tones, geometric brutalist shadows...',
  },
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
  const [injectedPrompt, setInjectedPrompt] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CuratedPrompt[]>(FALLBACK_SUGGESTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const fetchDynamicSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      // Pick a random page from 1 to 25 to fetch diverse inspiration
      const randomPage = Math.floor(Math.random() * 25) + 1;
      const res = await api.getPromptGallery({ per_page: 12, page: randomPage });
      if (res && res.prompts && res.prompts.length > 0) {
        // Shuffle and pick 4
        const shuffled = [...res.prompts].sort(() => 0.5 - Math.random()).slice(0, 4);
        setSuggestions(shuffled);
      }
    } catch (err) {
      console.warn('Failed to load dynamic suggestions, using cached:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchDynamicSuggestions();
  }, [fetchDynamicSuggestions]);

  const handleSelectSuggestion = (prompt: string) => {
    hapticImpact('selection');
    setInjectedPrompt(prompt);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bridge:insert-prompt', { detail: { prompt, focus: true } })
      );
    }
  };

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
      <PullToRefresh ref={scrollRef} onRefresh={onRefresh} className="px-3 sm:px-4 py-3 sm:py-4 pb-8 sm:pb-6 space-y-3 sm:space-y-2 flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* Empty state suggestions */}
        {messages.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 px-2 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3 shadow-sm">
              <Sparkles size={22} />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              What do you want to imagine?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Tap any prompt below to populate the chatbox, or type your own concept.
            </p>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Compass size={13} className="text-primary" />
                  <span>Prompt Library Inspiration</span>
                </div>
                <button
                  type="button"
                  onClick={fetchDynamicSuggestions}
                  disabled={isLoadingSuggestions}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-muted active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Shuffle suggestions from Prompt Library"
                >
                  <Shuffle size={12} className={isLoadingSuggestions ? 'animate-spin' : ''} />
                  <span>Shuffle</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug.prompt)}
                    className="flex items-start gap-2.5 text-left p-3 rounded-2xl bg-card hover:bg-muted/80 border border-border hover:border-primary/40 text-foreground transition-all active:scale-[0.98] group min-h-[64px] shadow-2xs relative overflow-hidden cursor-pointer"
                    title="Click to insert into chatbox"
                  >
                    {sug.thumbnail ? (
                      <img
                        src={sug.thumbnail}
                        alt={sug.title || 'Prompt thumbnail'}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border/50 bg-muted"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {sug.category && (
                          <span className="text-[9px] font-medium font-mono uppercase px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 shrink-0">
                            {sug.category}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {sug.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight font-sans">
                        {sug.promptPreview || sug.prompt}
                      </p>
                    </div>

                    <div className="self-center p-1 rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                      <CornerDownLeft size={13} />
                    </div>
                  </button>
                ))}
              </div>
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
          <div className="flex items-start gap-3 mb-6 animate-fade-in w-full min-w-0 max-w-full">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 max-w-full sm:max-w-md">
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-lg min-w-0">
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
      <div className="shrink-0 bg-card/95 backdrop-blur-xl border-t border-border/80 w-full min-w-0 max-w-full shadow-lg sm:shadow-none">
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
          injectedPrompt={injectedPrompt}
          onPromptConsumed={() => setInjectedPrompt(null)}
        />
      </div>
    </div>
  );
};
