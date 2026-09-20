import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Menu, Sparkles, Settings2, Shuffle, Compass, ArrowUpRight } from 'lucide-react';
import {
  GalleryItem,
  Account,
  ChatMessage,
  ImageRequest,
  CharacterCard,
} from '../../types';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { PullToRefresh } from '../common/PullToRefresh';
import { DotMatrixLoader } from '../common/DotMatrixLoader';
import { hapticImpact } from '../../lib/haptics';
import { api } from '../../lib/api';

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

export interface VisualInspiration {
  id: number;
  title: string;
  category: string;
  preview: string;
  prompt: string;
  thumbnail: string;
}

const CURATED_VISUAL_INSPIRATIONS: VisualInspiration[] = [
  {
    id: 540,
    title: 'Surreal Futuristic City',
    category: 'Editorial Art',
    preview: 'Editorial art poster of a dreamlike futuristic world with sculptural buildings and geometric shadows.',
    prompt:
      'Create a visually unforgettable editorial art poster of a dreamlike futuristic world where familiar everyday life meets surreal architecture. Grand sculptural buildings, winding roads, oversized plants, tiny people, unexpected floating elements, dramatic perspective, cinematic atmosphere, and one iconic focal point. Blend vintage travel-poster design with modern luxury editorial aesthetics, sophisticated muted colors, soft natural light, subtle film grain, tactile paper texture, clean geometric shapes, minimal composition, nostalgic yet futuristic, whimsical but premium, highly detailed, instantly recognizable silhouette, collectible art print, no clutter, no photorealism, vertical 4:5.',
    thumbnail: '/api/prompt-gallery/thumbnails/540',
  },
  {
    id: 543,
    title: 'Travel Enamel Pin Badge',
    category: 'Product Design',
    preview: 'Travel souvenir enamel pin badge composed as a landscape scene with polished gold divider outlines.',
    prompt:
      'Turn the reference photo into a travel souvenir enamel pin badge. Compose it as a SCENE, not a single isolated object. Subject hierarchy: the defining landscape forms the main body of the badge. Styling: thin polished gold outline around silhouette and internal dividers, glossy enamel color fill, gentle even lighting with soft sheen on gold lines, subtle drop shadow. Flat dark navy coarse linen texture background. Badge centered, filling 60% of the frame.',
    thumbnail: '/api/prompt-gallery/thumbnails/543',
  },
  {
    id: 542,
    title: 'High-Contrast Ink Portrait',
    category: 'Typography',
    preview: 'High-contrast black and white typographic portrait poster with bold silhouette blocks and rough ink edges.',
    prompt:
      'High-contrast black and white typographic portrait poster of HUMAN, shown in side profile with FEATURE. Build the portrait with bold black silhouette blocks, sharp negative space, rough ink edges, fragmented stencil shapes, tiny editorial microtext, vertical typographic accents and expressive hand-drawn calligraphic marks. Minimal off-white paper background, asymmetrical layout, cropped vertical composition, experimental editorial poster design, raw ink print texture, aspect ratio 4:5.',
    thumbnail: '/api/prompt-gallery/thumbnails/542',
  },
  {
    id: 489,
    title: 'Tilt-Shift Diorama Courtyard',
    category: 'Architecture',
    preview: 'Cinematic miniature tilt-shift diorama of an architectural courtyard at twilight with volumetric glow.',
    prompt:
      'Create a highly detailed cinematic miniature tilt-shift diorama of an architectural courtyard at twilight. Dramatic volumetric lighting, warm interior glow spilling through large glass windows, tiny meticulously detailed trees, miniature streetlights with gentle lens flare, shallow depth of field, tilt-shift lens effect, 8k resolution, photorealistic textures.',
    thumbnail: '/api/prompt-gallery/thumbnails/489',
  },
  {
    id: 529,
    title: 'Golden Hour Fashion Portrait',
    category: 'Photography',
    preview: 'Dreamy ultra-photorealistic outdoor fashion portrait in warm golden hour sunlight with shallow bokeh.',
    prompt:
      'Create a dreamy ultra-photorealistic outdoor fashion portrait in golden hour sunlight. Natural wind blowing through hair, cinematic shallow depth of field, 85mm f/1.4 lens bokeh, warm amber backlight highlights, realistic skin texture, subtle film grain, soft color grading.',
    thumbnail: '/api/prompt-gallery/thumbnails/529',
  },
  {
    id: 541,
    title: '50/50 Mixed-Media Memory Card',
    category: 'Mixed Media',
    preview: 'Vertical memory card with 50/50 split between original photo and minimalist wax-crayon sketch.',
    prompt:
      "Transform the uploaded photo into a vertical mixed-media memory card with a strict 50/50 split. Keep the original photo unchanged in the top half. In the bottom half, use textured off-white handmade paper and add a muted, irregular color patch matching the photo's tones. Redraw the main subjects as a simple dark wax-crayon sketch with loose, imperfect lines and minimal details. Quiet, nostalgic Morandi-style aesthetic.",
    thumbnail: '/api/prompt-gallery/thumbnails/541',
  },
  {
    id: 516,
    title: 'Stylized 3D Character Art',
    category: '3D Render',
    preview: 'Ultra-detailed 3D render in soft studio lighting with delicate clay textures and rim illumination.',
    prompt:
      'Create an ultra-detailed hyper-realistic 3D render of a stylized character in soft studio lighting. Subsurface scattering on skin, delicate clay and matte vinyl textures, gentle rim lighting, clean solid pastel background, isometric camera angle, octane render quality.',
    thumbnail: '/api/prompt-gallery/thumbnails/516',
  },
  {
    id: 544,
    title: 'Visual Learning Card',
    category: 'Infographic',
    preview: 'Clean preschool vocabulary poster featuring realistic organic fruit with playful cross-section slice.',
    prompt:
      'Create a clean, child-friendly educational vocabulary poster for preschool/kindergarten children, inspired by a simple visual learning card. Feature fresh organic fruit with water droplets as the main large realistic object on the left, and show a PART / SLICE of the same fruit on the right with a playful dotted curved arrow. Soft white and light pastel-blue background, rounded image panels, clean spacing, realistic photography, simple typography.',
    thumbnail: '/api/prompt-gallery/thumbnails/544',
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
  const [suggestions, setSuggestions] = useState<VisualInspiration[]>(() =>
    CURATED_VISUAL_INSPIRATIONS.slice(0, 4)
  );
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Dynamic shuffle with English filtering, falling back to curated pool
  const shuffleSuggestions = useCallback(async () => {
    hapticImpact('selection');
    setIsLoadingSuggestions(true);
    try {
      const randomPage = Math.floor(Math.random() * 20) + 1;
      const res = await api.getPromptGallery({ lang: 'en', per_page: 8, page: randomPage });
      if (res && res.prompts && res.prompts.length > 0) {
        const mapped: VisualInspiration[] = res.prompts
          .filter((p) => p.thumbnail && !p.prompt.startsWith('[中文]'))
          .map((p) => {
            const firstLine = p.prompt.split('\n')[0].split('.')[0].trim();
            const fallbackTitle = p.category ? `${p.category}` : 'Prompt Concept';
            const cleanTitle =
              p.title && !/[\u4e00-\u9fff]/.test(p.title)
                ? p.title.replace(/\(.*?\)/g, '').trim() || fallbackTitle
                : fallbackTitle;
            return {
              id: p.id,
              title: cleanTitle,
              category: p.category || 'Creative',
              preview: firstLine.length > 95 ? firstLine.slice(0, 92) + '…' : firstLine,
              prompt: p.prompt,
              thumbnail: p.thumbnail,
            };
          });
        if (mapped.length >= 2) {
          const shuffled = mapped.sort(() => 0.5 - Math.random()).slice(0, 4);
          setSuggestions(shuffled);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic English suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }

    // Fallback: shuffle curated visual prompts
    const shuffled = [...CURATED_VISUAL_INSPIRATIONS].sort(() => 0.5 - Math.random()).slice(0, 4);
    setSuggestions(shuffled);
  }, []);

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
          <div className="min-h-full flex flex-col items-center justify-start sm:justify-center text-center max-w-lg mx-auto pt-2 pb-3 sm:py-6 px-1 sm:px-2 animate-fade-in">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1.5 sm:mb-2 shadow-2xs">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-sm sm:text-lg font-semibold tracking-tight text-foreground mb-0.5 font-heading">
              What do you want to imagine?
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-2.5 sm:mb-3.5 max-w-[280px] sm:max-w-sm leading-normal">
              Tap any prompt below to populate the chatbox, or type your own concept.
            </p>

            <div className="w-full space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10.5px] font-semibold uppercase font-mono tracking-wider text-muted-foreground">
                  <Compass size={11} className="text-primary" />
                  <span>Prompt Inspiration</span>
                </div>
                <button
                  type="button"
                  onClick={shuffleSuggestions}
                  disabled={isLoadingSuggestions}
                  className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5 px-1.5 rounded-lg hover:bg-muted active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Shuffle prompts"
                >
                  <Shuffle size={11} className={isLoadingSuggestions ? 'animate-spin' : ''} />
                  <span>Shuffle</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item.prompt)}
                    className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-card hover:bg-muted/80 border border-border hover:border-primary/40 text-foreground transition-all active:scale-[0.98] group min-h-[58px] sm:min-h-[62px] shadow-2xs text-left cursor-pointer"
                    title="Tap to insert into chatbox"
                  >
                    {/* Real Thumbnail Image */}
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover border border-border/60 bg-muted shrink-0 shadow-2xs"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />

                    <div className="flex-1 min-w-0 pr-0.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                          {item.category}
                        </span>
                        <span className="text-[11.5px] sm:text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[10.5px] sm:text-[11px] text-muted-foreground line-clamp-2 leading-tight font-sans">
                        {item.preview}
                      </p>
                    </div>

                    <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 p-1">
                      <ArrowUpRight size={13} className="opacity-60 group-hover:opacity-100" />
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
