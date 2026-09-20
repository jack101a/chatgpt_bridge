import React, { useEffect, useRef } from 'react';
import { SlashCommand } from '../../types';
import { Terminal, Sparkles, CornerDownLeft } from 'lucide-react';

interface SlashCommandPopoverProps {
  isOpen: boolean;
  query: string;
  commands: SlashCommand[];
  selectedIndex: number;
  userConcept?: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export const SlashCommandPopover: React.FC<SlashCommandPopoverProps> = ({
  isOpen,
  query,
  commands,
  selectedIndex,
  userConcept,
  onSelect,
  onClose,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.command.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen || filteredCommands.length === 0) return null;

  return (
    <div
      className="absolute left-2 right-2 sm:left-3 sm:right-3 bottom-full mb-2 z-50 rounded-2xl border border-border bg-card dark:bg-[#141416] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{ maxHeight: '340px' }}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/40 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Terminal size={13} className="text-emerald-500" />
          <span>Curated Slash Techniques</span>
          <span className="text-[10px] text-muted-foreground font-mono ml-1">
            ({filteredCommands.length} available)
          </span>
        </div>
        {userConcept ? (
          <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[200px] flex items-center gap-1">
            <Sparkles size={11} />
            <span>Fusing with &quot;{userConcept}&quot;</span>
          </div>
        ) : (
          <div className="text-[10.5px] text-muted-foreground font-mono hidden sm:block">
            Type an idea or pick style
          </div>
        )}
      </div>

      {/* Commands List */}
      <div ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-border/40 p-1">
        {filteredCommands.map((cmd, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`slash-cmd-${cmd.command}`}
              type="button"
              onClick={() => onSelect(cmd)}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-start justify-between gap-2.5 transition-all text-xs cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/25 shadow-2xs'
                  : 'text-foreground hover:bg-muted/70'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-base shrink-0 select-none mt-0.5" role="img" aria-label={cmd.title}>
                  {cmd.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-primary">/{cmd.command}</span>
                    <span className="font-semibold text-foreground truncate">{cmd.title}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-muted text-muted-foreground">
                      {cmd.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {cmd.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1 pt-1 opacity-60">
                {isSelected && (
                  <span className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    <CornerDownLeft size={10} />
                    <span>Apply</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Popover Footer Shortcuts */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50 bg-muted/20 text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>↑↓ Navigate</span>
          <span>•</span>
          <span>↵ Apply</span>
          <span>•</span>
          <span>Esc Dismiss</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hover:text-foreground hover:underline cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
