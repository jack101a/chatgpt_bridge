import React from 'react';
import { MessageSquare, Image as ImageIcon, Layers, Settings } from 'lucide-react';
import { hapticImpact } from '../../lib/haptics';

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

  const handleTabClick = (tabId: 'chat' | 'gallery' | 'generator' | 'settings') => {
    if (tabId !== activeTab) {
      hapticImpact('selection');
    }
    onSelectTab(tabId);
  };

  return (
    <nav
      className={`lg:hidden flex items-center justify-around border-t border-border/80 bg-card/95 dark:bg-[#0e0e11]/95 backdrop-blur-2xl saturate-150 px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] z-40 select-none shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] ${
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
            onClick={() => handleTabClick(tab.id)}
            className={`min-h-[44px] min-w-[58px] flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all duration-150 ease-out active:scale-[0.92] ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label={tab.label}
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-primary/15 scale-105 shadow-2xs' : 'bg-transparent'
              }`}
            >
              <Icon size={19} className={isActive ? 'text-primary' : 'currentColor'} strokeWidth={isActive ? 2.3 : 1.8} />
            </div>
            <span className="text-[10.5px] tracking-tight leading-none font-sans font-medium flex items-center gap-1">
              {tab.label}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-primary inline-block" />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

