import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Clapperboard,
  UserCheck,
  UserX,
  PlusCircle,
  RefreshCw,
  CornerDownLeft,
  Command,
} from 'lucide-react';
import { CharacterCard } from '../../types';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Character Lock' | 'Quick Actions' | 'System';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'chat' | 'gallery' | 'generator' | 'settings') => void;
  onTriggerAction: (actionId: string) => void;
  characters: CharacterCard[];
  activeCharacter: CharacterCard | null;
  onSelectCharacter: (char: CharacterCard | null) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onTriggerAction,
  characters,
  activeCharacter,
  onSelectCharacter,
  isDarkMode,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build command list
  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: 'nav-chat',
        category: 'Navigation',
        title: 'Go to Chat Studio',
        subtitle: 'Interactive generation canvas',
        icon: <MessageSquare className="w-4 h-4 text-emerald-500" />,
        shortcut: '⌘1',
        keywords: ['chat', 'dalle', 'prompt', 'generate'],
        action: () => {
          onNavigateTab('chat');
          onClose();
        },
      },
      {
        id: 'nav-gallery',
        category: 'Navigation',
        title: 'Go to Image Gallery',
        subtitle: 'Browse generated artworks & metadata',
        icon: <ImageIcon className="w-4 h-4 text-blue-500" />,
        shortcut: '⌘2',
        keywords: ['gallery', 'images', 'photos', 'history', 'saved'],
        action: () => {
          onNavigateTab('gallery');
          onClose();
        },
      },
      {
        id: 'nav-generator',
        category: 'Navigation',
        title: 'Go to Character Studio / Cards',
        subtitle: 'Consistent identity prompt generator',
        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
        shortcut: '⌘3',
        keywords: ['cards', 'generator', 'studio', 'character', 'persona'],
        action: () => {
          onNavigateTab('generator');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Open Accounts & Telemetry',
        subtitle: 'Manage cookies, rotation, & quota',
        icon: <Settings className="w-4 h-4 text-amber-500" />,
        shortcut: '⌘4',
        keywords: ['settings', 'accounts', 'tokens', 'telemetry', 'quota'],
        action: () => {
          onNavigateTab('settings');
          onClose();
        },
      },
      // Quick Actions
      {
        id: 'action-new-chat',
        category: 'Quick Actions',
        title: 'Start New Chat Thread',
        subtitle: 'Clean state for a new prompt sequence',
        icon: <PlusCircle className="w-4 h-4 text-emerald-500" />,
        shortcut: '⌘N',
        keywords: ['new', 'chat', 'thread', 'fresh', 'reset'],
        action: () => {
          onTriggerAction('new-chat');
          onClose();
        },
      },
      {
        id: 'action-director',
        category: 'Quick Actions',
        title: 'Launch Director Storyboard',
        subtitle: 'Multi-shot cinematic story generator',
        icon: <Clapperboard className="w-4 h-4 text-rose-500" />,
        shortcut: '⌘D',
        keywords: ['director', 'storyboard', 'cinematic', 'shots', 'movie'],
        action: () => {
          onTriggerAction('open-director');
          onClose();
        },
      },
      {
        id: 'action-theme',
        category: 'Quick Actions',
        title: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: isDarkMode ? 'Bright, high-clarity canvas' : 'OLED deep dark surface',
        icon: isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-400" />,
        shortcut: '⌘T',
        keywords: ['theme', 'dark', 'light', 'mode', 'color'],
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'action-refresh-accounts',
        category: 'Quick Actions',
        title: 'Refresh Account Pool & Quotas',
        subtitle: 'Sync cookies and rate limits from daemon',
        icon: <RefreshCw className="w-4 h-4 text-cyan-500" />,
        keywords: ['refresh', 'sync', 'quota', 'accounts'],
        action: () => {
          onTriggerAction('refresh-accounts');
          onClose();
        },
      },
    ];

    // Character Lock Options
    if (activeCharacter) {
      list.push({
        id: 'char-unlock',
        category: 'Character Lock',
        title: `Unlock Character (${activeCharacter.name})`,
        subtitle: 'Revert to freeform prompt mode without character lock',
        icon: <UserX className="w-4 h-4 text-zinc-400" />,
        keywords: ['unlock', 'clear', 'character', 'freeform'],
        action: () => {
          onSelectCharacter(null);
          onClose();
        },
      });
    }

    characters.forEach((char) => {
      const isLocked = activeCharacter?.id === char.id;
      list.push({
        id: `char-lock-${char.id}`,
        category: 'Character Lock',
        title: isLocked ? `Currently Locked: ${char.name}` : `Lock Character: ${char.name}`,
        subtitle: `${char.name} • ${char.tagline || char.persona || 'Consistent character anchor'}`,
        icon: <UserCheck className={`w-4 h-4 ${isLocked ? 'text-emerald-500' : 'text-zinc-400'}`} />,
        keywords: ['character', 'lock', char.name.toLowerCase(), char.tagline?.toLowerCase() || ''],
        action: () => {
          onSelectCharacter(char);
          onClose();
        },
      });
    });

    return list;
  }, [characters, activeCharacter, isDarkMode, onNavigateTab, onTriggerAction, onToggleTheme, onSelectCharacter, onClose]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.subtitle?.toLowerCase().includes(q)) return true;
      if (cmd.category.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.includes(q))) return true;
      return false;
    });
  }, [commands, query]);

  // Handle arrow key and enter navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-muted/30">
          <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search (e.g. 'gallery', 'lock', 'theme')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-foreground placeholder-muted-foreground focus:outline-none text-sm sm:text-base font-sans"
          />
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-muted border border-border rounded">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No commands matching &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    isSelected
                      ? 'bg-primary/10 text-foreground border border-primary/30'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${
                        isSelected ? 'bg-primary/20' : 'bg-muted'
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-foreground truncate">{cmd.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground uppercase">
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">{cmd.subtitle}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-primary opacity-80" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to dismiss</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>sv-agentation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
