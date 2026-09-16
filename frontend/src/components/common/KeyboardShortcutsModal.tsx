import React from 'react';
import { X, Keyboard } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keyCombo: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections: ShortcutSection[] = [
    {
      title: 'Global Navigation',
      shortcuts: [
        { keyCombo: ['⌘', 'K'], description: 'Open Universal Command Palette' },
        { keyCombo: ['?'], description: 'Open Keyboard Shortcuts Cheatsheet' },
        { keyCombo: ['⌘', '1'], description: 'Switch to Chat Studio' },
        { keyCombo: ['⌘', '2'], description: 'Switch to Image Gallery' },
        { keyCombo: ['⌘', '3'], description: 'Switch to Character Studio' },
        { keyCombo: ['⌘', '4'], description: 'Open Accounts & Telemetry' },
        { keyCombo: ['Esc'], description: 'Close modal, drawer, or dialog' },
      ],
    },
    {
      title: 'Chat & Generation',
      shortcuts: [
        { keyCombo: ['Enter'], description: 'Send image generation prompt' },
        { keyCombo: ['Shift', 'Enter'], description: 'Add newline in composer' },
        { keyCombo: ['⌘', 'N'], description: 'Start new chat thread' },
        { keyCombo: ['⌘', 'D'], description: 'Launch Director Storyboard generator' },
        { keyCombo: ['⌘', 'T'], description: 'Toggle Dark / Light theme' },
      ],
    },
    {
      title: 'Image Viewer & Gallery',
      shortcuts: [
        { keyCombo: ['←'], description: 'Previous image in gallery viewer' },
        { keyCombo: ['→'], description: 'Next image in gallery viewer' },
        { keyCombo: ['Space'], description: 'Toggle between Inspect and Pure Focus mode' },
        { keyCombo: ['F'], description: 'Toggle favorite on active image' },
        { keyCombo: ['Esc'], description: 'Exit image viewer modal' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
              <p className="text-xs text-muted-foreground font-mono">Navigate and generate at lightning speed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-2.5">
              <h3 className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
                {sec.title}
              </h3>
              <div className="bg-muted/30 border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
                {sec.shortcuts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-foreground text-xs sm:text-sm">{sc.description}</span>
                    <div className="flex items-center space-x-1 shrink-0 ml-3">
                      {sc.keyCombo.map((k, kidx) => (
                        <kbd
                          key={kidx}
                          className="min-w-[24px] px-2 py-1 text-[11px] font-mono font-semibold text-foreground bg-card border border-border shadow-xs rounded inline-flex items-center justify-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between font-mono">
          <span>Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">?</kbd> anywhere to view</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
};
