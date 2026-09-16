import { Menu, Sparkles } from 'lucide-react';
import { ReferenceCardWizard } from './ReferenceCardWizard';
import { CharacterCard, GalleryItem } from '../../types';

interface CardGeneratorViewProps {
  characters: CharacterCard[];
  onRefreshCharacters: () => void;
  onOpenSidebar: () => void;
  onOpenViewer?: (item: GalleryItem) => void;
  onContinueInChat?: (item: GalleryItem) => void;
  hideHeader?: boolean;
}

export function CardGeneratorView({
  characters,
  onRefreshCharacters,
  onOpenSidebar,
  onOpenViewer,
  onContinueInChat,
  hideHeader = true,
}: CardGeneratorViewProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden bg-background">
      {/* Optional Top Header Bar */}
      {!hideHeader && (
        <header className="h-14 border-b border-border px-4 flex items-center justify-between bg-card shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSidebar}
              className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open Sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Reference Card Studio
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                <Sparkles size={11} />
                <span>3-Step Identity Lock</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="hidden sm:inline">Character Studio</span>
              <span>DNA Lock</span>
            </div>
          </div>
        </header>
      )}

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
