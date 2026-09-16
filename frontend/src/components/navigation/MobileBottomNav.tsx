import React from 'react';
import { MessageSquare, Image as ImageIcon, Layers, Settings } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'chat' | 'gallery' | 'generator' | 'settings';
  onSelectTab: (tab: 'chat' | 'gallery' | 'generator' | 'settings') => void;
  isVisible?: boolean;
  fixed?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  isVisible = true,
  fixed = false,
}) => {
  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'generator', label: 'Cards', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav
      className={`lg:hidden flex items-center justify-around border-t border-border bg-card/90 backdrop-blur-lg px-2 pt-1.5 pb-safe z-40 select-none ${
        fixed
          ? `fixed bottom-0 left-0 right-0 transition-transform duration-300 ease-out ${
              isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
            }`
          : 'shrink-0 w-full'
      }`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all active:scale-90 ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label={tab.label}
          >
            <div
              className={`p-1 rounded-lg transition-colors ${
                isActive ? 'bg-primary/15' : 'bg-transparent'
              }`}
            >
              <Icon size={19} className={isActive ? 'text-primary' : 'currentColor'} />
            </div>
            <span className="text-[10.5px] tracking-tight leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
