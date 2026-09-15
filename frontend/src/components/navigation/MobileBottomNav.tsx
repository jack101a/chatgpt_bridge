import React from 'react';
import { Home, Image as ImageIcon, Settings } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'chat' | 'gallery' | 'settings';
  onSelectTab: (tab: 'chat' | 'gallery' | 'settings') => void;
  isVisible?: boolean;
  fixed?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  isVisible = true,
  fixed = false,
}) => {
  return (
    <nav className={`lg:hidden flex items-center justify-around border-t border-[#e5e5e5] dark:border-[#27272a] bg-white/95 dark:bg-[#121214]/95 backdrop-blur-lg px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 ${
      fixed
        ? `fixed bottom-0 left-0 right-0 transition-transform duration-300 ease-out ${
            isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
          }`
        : 'flex-shrink-0 w-full'
    }`}>
      <button
        onClick={() => onSelectTab('chat')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
          activeTab === 'chat'
            ? 'text-[#10a37f]'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Home size={20} />
        <span className="text-[10px] font-medium tracking-tight">Home</span>
      </button>

      <button
        onClick={() => onSelectTab('gallery')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
          activeTab === 'gallery'
            ? 'text-[#10a37f]'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <ImageIcon size={20} />
        <span className="text-[10px] font-medium tracking-tight">Gallery</span>
      </button>

      <button
        onClick={() => onSelectTab('settings')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
          activeTab === 'settings'
            ? 'text-[#10a37f]'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Settings size={20} />
        <span className="text-[10px] font-medium tracking-tight">Settings</span>
      </button>
    </nav>
  );
};
