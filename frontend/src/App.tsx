import { useState, useEffect } from 'react';
import { useBridge } from './hooks/useBridge';
import { useGallery } from './hooks/useGallery';
import { ChatView } from './components/chat/ChatView';
import { GalleryView } from './components/gallery/GalleryView';
import { AccountsDrawer } from './components/settings/AccountsDrawer';
import { ImageViewerModal } from './components/viewer/ImageViewerModal';
import { DesktopSidebar } from './components/navigation/DesktopSidebar';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { GalleryItem } from './types';
import { api } from './lib/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<'chat' | 'gallery' | 'settings'>('chat');
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [viewerItem, setViewerItem] = useState<GalleryItem | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('bridge:theme') === 'dark';
  });

  const bridge = useBridge();
  const gallery = useGallery();

  // Handle dark mode class on <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bridge:theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bridge:theme', 'light');
    }
  }, [isDarkMode]);

  const activeAccount = bridge.accounts.find((a) => a.is_active) || bridge.accounts[0] || null;

  // Viewer navigation
  const handleOpenViewer = (item: GalleryItem) => {
    setViewerItem(item);
  };

  const handleViewerNext = () => {
    if (!viewerItem) return;
    const list = gallery.items.length > 0 ? gallery.items : [viewerItem];
    const idx = list.findIndex((i) => i.id === viewerItem.id);
    if (idx !== -1 && idx < list.length - 1) {
      setViewerItem(list[idx + 1]);
    } else if (list.length > 0) {
      setViewerItem(list[0]);
    }
  };

  const handleViewerPrev = () => {
    if (!viewerItem) return;
    const list = gallery.items.length > 0 ? gallery.items : [viewerItem];
    const idx = list.findIndex((i) => i.id === viewerItem.id);
    if (idx > 0) {
      setViewerItem(list[idx - 1]);
    } else if (list.length > 0) {
      setViewerItem(list[list.length - 1]);
    }
  };

  const handleContinueInChat = (item: GalleryItem) => {
    if (item.conversation_id) {
      bridge.selectThread(item.conversation_id);
    }
    setCurrentTab('chat');
  };

  const handleDeleteThread = async (convId: string) => {
    try {
      await api.deleteChat(convId);
      bridge.refreshThreads();
      if (bridge.activeConvId === convId) {
        bridge.selectThread(null);
      }
    } catch (err: any) {
      alert(`Failed to delete thread: ${err.message}`);
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-white dark:bg-[#121214] text-[#0d0d0d] dark:text-white">
      {/* ── Desktop Sidebar ── */}
      <DesktopSidebar
        threads={bridge.threads}
        activeConvId={bridge.activeConvId}
        onSelectThread={bridge.selectThread}
        onNewChat={() => bridge.selectThread(null)}
        onDeleteThread={handleDeleteThread}
        activeAccount={activeAccount}
        onOpenAccounts={() => setIsAccountsOpen(true)}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      {/* ── Main Content Stage ── */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {currentTab === 'chat' && (
          <ChatView
            messages={bridge.messages}
            isGenerating={bridge.isGenerating}
            progressStatus={bridge.progressStatus}
            retryCount={bridge.retryCount}
            activeAccount={activeAccount}
            activeConvId={bridge.activeConvId}
            onSend={bridge.generate}
            onClearThread={() => bridge.selectThread(null)}
            onOpenViewer={handleOpenViewer}
            onOpenAccounts={() => setIsAccountsOpen(true)}
            onOpenSidebar={() => setIsSidebarOpenMobile(true)}
            onContinueThread={(convId) => {
              bridge.selectThread(convId);
              setCurrentTab('chat');
            }}
            onToggleFavorite={gallery.toggleFavorite}
          />
        )}

        {currentTab === 'gallery' && (
          <GalleryView
            items={gallery.items}
            total={gallery.total}
            isLoading={gallery.isLoading}
            hasMore={gallery.hasMore}
            searchQuery={gallery.searchQuery}
            onSearchChange={gallery.setSearchQuery}
            activeFilter="all"
            onFilterChange={() => {}}
            accountFilter={gallery.accountFilter}
            onAccountFilterChange={gallery.setAccountFilter}
            accounts={bridge.accounts}
            onLoadMore={gallery.loadMore}
            onOpenViewer={handleOpenViewer}
            onToggleFavorite={gallery.toggleFavorite}
          />
        )}

        {/* ── Mobile Bottom Navigation (Visible on < 1024px) ── */}
        <MobileBottomNav
          activeTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'settings') {
              setIsAccountsOpen(true);
            } else {
              setCurrentTab(tab);
            }
          }}
        />
      </main>

      {/* ── Accounts & Settings Drawer ── */}
      <AccountsDrawer
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={bridge.accounts}
        telemetry={bridge.telemetry}
        onRefreshAccounts={bridge.refreshAccounts}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* ── Dual-Mode Fullscreen Image Viewer ── */}
      <ImageViewerModal
        item={viewerItem}
        items={gallery.items.length > 0 ? gallery.items : viewerItem ? [viewerItem] : []}
        isOpen={Boolean(viewerItem)}
        onClose={() => setViewerItem(null)}
        onSelectNext={handleViewerNext}
        onSelectPrev={handleViewerPrev}
        onToggleFavorite={gallery.toggleFavorite}
        onDelete={gallery.deleteItem}
        onContinueInChat={handleContinueInChat}
      />
    </div>
  );
}

export default App;
