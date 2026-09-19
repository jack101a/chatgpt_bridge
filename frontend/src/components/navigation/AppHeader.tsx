import React from 'react';
import {
  Search,
  Moon,
  Sun,
  ShieldCheck,
  Menu,
  Clapperboard,
  Sparkles,
  Radio,
  Keyboard,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { CharacterCard } from '../../types';
import { hapticImpact } from '../../lib/haptics';

export interface AppHeaderProps {
  currentTab: 'chat' | 'gallery' | 'generator' | 'settings';
  activeCharacter?: CharacterCard | null;
  onOpenCharacters?: () => void;
  onOpenAccounts: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts?: () => void;
  onOpenSidebarMobile?: () => void;
  onToggleDesktopSidebar?: () => void;
  isDesktopSidebarCollapsed?: boolean;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  isConnected: boolean;
  onOpenDirector?: () => void;
  activeAccountName?: string;
  onNavigateTab?: (tab: 'chat' | 'gallery' | 'generator' | 'settings') => void;
  onNewChat?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onOpenAccounts,
  onOpenCommandPalette,
  onOpenShortcuts,
  onOpenSidebarMobile,
  onToggleDesktopSidebar,
  isDesktopSidebarCollapsed,
  onToggleTheme,
  isDarkMode,
  isConnected,
  onOpenDirector,
  activeAccountName,
  onNewChat,
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
    <header className="h-14 border-b border-border bg-card/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Mobile Drawer Trigger / Brand */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <button
          onClick={() => {
            hapticImpact('light');
            onOpenSidebarMobile?.();
          }}
          className="lg:hidden flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
          title="Open threads sidebar"
          aria-label="Open threads sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop collapse sidebar toggle */}
        {!isDesktopSidebarCollapsed && onToggleDesktopSidebar && (
          <button
            onClick={() => {
              hapticImpact('light');
              onToggleDesktopSidebar();
            }}
            className="hidden lg:flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
            title="Collapse sidebar (⌘\)"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}

        {/* Desktop expand sidebar toggle when collapsed */}
        {isDesktopSidebarCollapsed && onToggleDesktopSidebar && (
          <button
            onClick={() => {
              hapticImpact('light');
              onToggleDesktopSidebar();
            }}
            className="hidden lg:flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
            title="Expand sidebar (⌘\)"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        {/* ChatGPT Bridge Brand Title - Clicking starts a new chat from anywhere */}
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            onNewChat?.();
          }}
          className="flex items-center space-x-2 min-w-0 text-left rounded-xl p-1 -m-1 hover:bg-muted/60 active:scale-[0.98] transition-all group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          title="Start new chat"
          aria-label="ChatGPT Bridge - Start New Chat"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-2xs group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
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
          onClick={() => {
            hapticImpact('light');
            onOpenCommandPalette();
          }}
          className="sm:hidden min-w-[40px] min-h-[40px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all flex items-center justify-center"
          title="Search / Command Palette"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Director Launch Button */}
        {onOpenDirector && (
          <button
            onClick={() => {
              hapticImpact('light');
              onOpenDirector();
            }}
            className="flex items-center space-x-1.5 min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-medium text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-all active:scale-95 shadow-2xs"
            title="Launch Director Storyboard generator"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Director</span>
          </button>
        )}

        {/* Shortcuts Cheatsheet Button */}
        {onOpenShortcuts && (
          <button
            onClick={() => {
              hapticImpact('light');
              onOpenShortcuts();
            }}
            className="hidden md:flex min-w-[36px] min-h-[36px] p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all items-center justify-center"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}

        {/* Account Status Pill */}
        <button
          onClick={() => {
            hapticImpact('light');
            onOpenAccounts();
          }}
          className="flex items-center space-x-1.5 min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-border active:scale-95 transition-all"
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
          onClick={() => {
            hapticImpact('light');
            onToggleTheme();
          }}
          className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all flex items-center justify-center"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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
