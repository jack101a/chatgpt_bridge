import React from 'react';
import {
  Search,
  Moon,
  Sun,
  ShieldCheck,
  Menu,
  Clapperboard,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  Keyboard,
} from 'lucide-react';
import { CharacterCard } from '../../types';

export interface AppHeaderProps {
  currentTab: 'chat' | 'gallery' | 'generator' | 'settings';
  activeCharacter: CharacterCard | null;
  onOpenCharacters: () => void;
  onOpenAccounts: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts?: () => void;
  onOpenSidebarMobile?: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  isConnected: boolean;
  onOpenDirector?: () => void;
  activeAccountName?: string;
  onNavigateTab?: (tab: 'chat' | 'gallery' | 'generator' | 'settings') => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  activeCharacter,
  onOpenCharacters,
  onOpenAccounts,
  onOpenCommandPalette,
  onOpenShortcuts,
  onOpenSidebarMobile,
  onToggleTheme,
  isDarkMode,
  isConnected,
  onOpenDirector,
  activeAccountName,
}) => {
  const getTabLabel = () => {
    switch (currentTab) {
      case 'chat':
        return 'Chat Studio';
      case 'gallery':
        return 'Image Gallery';
      case 'generator':
        return 'Character Studio';
      case 'settings':
        return 'Settings';
      default:
        return 'Studio';
    }
  };

  return (
    <header className="h-14 w-full border-b border-border bg-card/85 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 select-none shrink-0 transition-colors">
      {/* Left: Mobile hamburger + App Title */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
        {onOpenSidebarMobile && (
          <button
            onClick={onOpenSidebarMobile}
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-foreground truncate">
                ChatGPT Bridge
              </span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                v2.0
              </span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:block truncate">
              {getTabLabel()}
            </span>
          </div>
        </div>

        {/* Character Lock Status Pill */}
        <button
          onClick={onOpenCharacters}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all border shrink-0 ${
            activeCharacter
              ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
              : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
          title={
            activeCharacter
              ? `Locked to ${activeCharacter.name}. Click to switch or unlock.`
              : 'No character locked. Click to select a persona.'
          }
        >
          {activeCharacter ? (
            <>
              <Lock className="w-3 h-3 text-primary" />
              <span className="font-semibold truncate max-w-[80px] sm:max-w-[120px]">
                {activeCharacter.name}
              </span>
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3 text-muted-foreground" />
              <span className="hidden sm:inline">Freeform Mode</span>
              <span className="sm:hidden">Free</span>
            </>
          )}
        </button>
      </div>

      {/* Center: Command Palette Trigger Button (sv-agentation style) */}
      <div className="flex-1 max-w-sm mx-2 sm:mx-4 hidden sm:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full h-8 px-3 rounded-lg bg-muted/60 hover:bg-muted border border-border/80 text-muted-foreground hover:text-foreground flex items-center justify-between text-xs transition-colors group"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="truncate">Search commands, characters, actions...</span>
          </div>
          <div className="flex items-center space-x-1 shrink-0 ml-2">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-card border border-border rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right: Actions, Director, Status, Theme */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenCommandPalette}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Search / Command Palette"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Director Launch Button */}
        {onOpenDirector && (
          <button
            onClick={onOpenDirector}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-all shadow-xs"
            title="Launch Director Storyboard generator"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Director</span>
          </button>
        )}

        {/* Shortcuts Cheatsheet Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="hidden md:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}

        {/* Account Status Pill */}
        <button
          onClick={onOpenAccounts}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
          title="Account Status & Quotas"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
            }`}
          />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 hidden sm:block" />
          <span className="hidden lg:inline max-w-[90px] truncate">
            {activeAccountName || 'Daemon'}
          </span>
          <Radio className="w-3 h-3 text-muted-foreground hidden sm:block" />
        </button>

        {/* Dark/Light Mode Switcher */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-600 hover:-rotate-12 transition-transform" />
          )}
        </button>
      </div>
    </header>
  );
};
