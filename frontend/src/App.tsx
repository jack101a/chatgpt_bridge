import { useState, useEffect, useRef, useCallback } from 'react';
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
  // Restore initial active tab: URL hash takes priority, otherwise always default to 'chat' (the Homepage)
  const [currentTab, setCurrentTab] = useState<'chat' | 'gallery' | 'settings'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'chat' || hash === 'gallery' || hash === 'settings') {
      return hash;
    }
    return 'chat';
  });

  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [viewerItem, setViewerItem] = useState<GalleryItem | null>(null);
  const [referenceImage, setReferenceImage] = useState<GalleryItem | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('bridge:theme') === 'dark';
  });
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);

  const bridge = useBridge();
  const gallery = useGallery();
  const isInitialLoad = useRef(true);


  // Ensure initial hash reflects active tab
  useEffect(() => {
    const currentHash = window.location.hash.replace('#', '');
    if (!currentHash || (currentHash !== 'chat' && currentHash !== 'gallery')) {
      window.history.replaceState(null, '', `#${currentTab}`);
    }
    try {
      localStorage.setItem('bridge:tab', currentTab);
    } catch (e) {}
  }, []);

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

  // Default page is always a brand new chat session
  useEffect(() => {
    bridge.newChat();
    isInitialLoad.current = false;
  }, []);

  // Keep live refs for popstate handler
  const viewerItemRef = useRef(viewerItem);
  const isAccountsOpenRef = useRef(isAccountsOpen);
  const isSidebarOpenMobileRef = useRef(isSidebarOpenMobile);
  const currentTabRef = useRef(currentTab);

  useEffect(() => {
    viewerItemRef.current = viewerItem;
  }, [viewerItem]);

  useEffect(() => {
    isAccountsOpenRef.current = isAccountsOpen;
  }, [isAccountsOpen]);

  useEffect(() => {
    isSidebarOpenMobileRef.current = isSidebarOpenMobile;
  }, [isSidebarOpenMobile]);

  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  // Save state to URL hash, localStorage, and /api/state on changes
  useEffect(() => {
    if (isInitialLoad.current) return;

    const state = {
      currentTab,
      activeConvId: bridge.activeConvId,
    };

    try {
      localStorage.setItem('bridge:state', JSON.stringify(state));
      localStorage.setItem('bridge:tab', currentTab);
    } catch (e) {}

    // Persist to backend server endpoint
    api.saveState(state).catch(() => {});
  }, [currentTab, bridge.activeConvId, viewerItem?.id]);

  // Universal browser & hardware back button handling
  useEffect(() => {
    const handlePopState = () => {
      // 1. Close viewer modal if open
      if (viewerItemRef.current) {
        setViewerItem(null);
        return;
      }
      // 2. Close accounts drawer if open
      if (isAccountsOpenRef.current) {
        setIsAccountsOpen(false);
        return;
      }
      // 3. Close mobile sidebar if open
      if (isSidebarOpenMobileRef.current) {
        setIsSidebarOpenMobile(false);
        return;
      }
      // 4. Navigate tabs from URL hash
      const hash = window.location.hash.replace('#', '');
      if (hash === 'gallery') {
        setCurrentTab('gallery');
      } else {
        setCurrentTab('chat');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const activeAccount = bridge.accounts.find((a) => a.is_active) || bridge.accounts[0] || null;

  // Tab navigation with history push
  const handleSelectTab = (tab: 'chat' | 'gallery' | 'settings') => {
    if (tab === 'settings') {
      handleOpenAccounts();
      return;
    }
    setIsMobileNavVisible(true);
    if (tab === currentTab) return;
    setCurrentTab(tab);
    window.history.pushState({ tab }, '', `#${tab}`);
    try {
      localStorage.setItem('bridge:tab', tab);
    } catch (e) {}
  };

  const handleGoBackFromGallery = () => {
    bridge.newChat();
    handleSelectTab('chat');
  };

  const handleFullPageRefresh = async () => {
    // Native mobile app style full-page refresh, preserving active hash URL
    await new Promise((resolve) => setTimeout(resolve, 350));
    window.location.reload();
  };

  // Accounts drawer navigation
  const handleOpenAccounts = () => {
    setIsAccountsOpen(true);
    window.history.pushState({ drawer: 'accounts' }, '', window.location.hash || '#chat');
  };

  const handleCloseAccounts = () => {
    setIsAccountsOpen(false);
    if (window.history.state?.drawer === 'accounts') {
      window.history.back();
    }
  };

  // Mobile sidebar navigation
  const handleOpenSidebarMobile = () => {
    setIsSidebarOpenMobile(true);
    window.history.pushState({ drawer: 'sidebar' }, '', window.location.hash || '#chat');
  };

  const handleCloseSidebarMobile = () => {
    setIsSidebarOpenMobile(false);
    if (window.history.state?.drawer === 'sidebar') {
      window.history.back();
    }
  };

  // Viewer navigation with history push
  const handleOpenViewer = (item: GalleryItem) => {
    setViewerItem(item);
    window.history.pushState({ modal: 'viewer', id: item.id }, '', window.location.hash || '#chat');
  };

  const handleCloseViewer = () => {
    setViewerItem(null);
    if (window.history.state?.modal === 'viewer') {
      window.history.back();
    }
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
    setViewerItem(null);
    handleSelectTab('chat');
  };

  // Remix / Prompt with this Image feature
  const handlePromptWithImage = (item: GalleryItem) => {
    setReferenceImage(item);
    setViewerItem(null);
    handleSelectTab('chat');
  };

  const handleToggleFavorite = useCallback((id: string) => {
    gallery.toggleFavorite(id);
    setViewerItem((prev) => (prev && prev.id === id ? { ...prev, favorite: !prev.favorite } : prev));
  }, [gallery.toggleFavorite]);

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
        onSelectThread={(id, targetAccount) => {
          if (targetAccount && targetAccount !== activeAccount?.alias) {
            const matchedAcc = bridge.accounts.find(
              (a) => a.alias === targetAccount || a.id === targetAccount
            );
            if (matchedAcc) {
              api.switchAccount(matchedAcc.alias || matchedAcc.id).then(() => {
                bridge.refreshAccounts();
              }).catch((e) => console.error('Failed to switch account:', e));
            }
          }
          bridge.selectThread(id);
          handleSelectTab('chat');
          setIsSidebarOpenMobile(false);
        }}
        onNewChat={() => {
          bridge.selectThread(null);
          handleSelectTab('chat');
          setIsSidebarOpenMobile(false);
        }}
        onDeleteThread={handleDeleteThread}
        activeAccount={activeAccount}
        onOpenAccounts={handleOpenAccounts}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={handleCloseSidebarMobile}
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
            onSend={async (req) => {
              setReferenceImage(null);
              return await bridge.generate(req);
            }}
            onClearThread={() => bridge.selectThread(null)}
            onOpenViewer={handleOpenViewer}
            onOpenAccounts={handleOpenAccounts}
            onOpenSidebar={handleOpenSidebarMobile}
            onContinueThread={(convId) => {
              bridge.selectThread(convId);
              handleSelectTab('chat');
            }}
            onToggleFavorite={handleToggleFavorite}
            referenceImage={referenceImage}
            onClearReference={() => setReferenceImage(null)}
            onPromptWithImage={handlePromptWithImage}
            onRefresh={handleFullPageRefresh}
          />
        )}

        {currentTab === 'gallery' && (
          <GalleryView
            items={gallery.items}
            sections={gallery.sections}
            total={gallery.total}
            isLoading={gallery.isLoading}
            hasMore={gallery.hasMore}
            searchQuery={gallery.searchQuery}
            onSearchChange={gallery.setSearchQuery}
            activeFilter={gallery.activeFilter}
            onFilterChange={gallery.setActiveFilter}
            sortBy={gallery.sortBy}
            onSortByChange={gallery.setSortBy}
            groupBy={gallery.groupBy}
            onGroupByChange={gallery.setGroupBy}
            layoutMode={gallery.layoutMode}
            onLayoutModeChange={gallery.setLayoutMode}
            accountFilter={gallery.accountFilter}
            onAccountFilterChange={gallery.setAccountFilter}
            accounts={bridge.accounts}
            onLoadMore={gallery.loadMore}
            onOpenViewer={handleOpenViewer}
            onToggleFavorite={handleToggleFavorite}
            onRefresh={handleFullPageRefresh}
            activeAccount={activeAccount}
            onOpenAccounts={handleOpenAccounts}
            onOpenSidebar={handleOpenSidebarMobile}
            onGoHome={handleGoBackFromGallery}
            onPromptWithImage={handlePromptWithImage}
            onToggleChrome={setIsMobileNavVisible}
          />
        )}

        {/* ── Mobile Bottom Navigation (Visible on < 1024px) ── */}
        <MobileBottomNav
          activeTab={currentTab}
          onSelectTab={handleSelectTab}
          isVisible={currentTab === 'chat' ? true : isMobileNavVisible}
          fixed={currentTab === 'gallery'}
        />
      </main>

      {/* ── Accounts & Settings Drawer ── */}
      <AccountsDrawer
        isOpen={isAccountsOpen}
        onClose={handleCloseAccounts}
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
        onClose={handleCloseViewer}
        onSelectNext={handleViewerNext}
        onSelectPrev={handleViewerPrev}
        onToggleFavorite={handleToggleFavorite}
        onDelete={gallery.deleteItem}
        onContinueInChat={handleContinueInChat}
        onPromptWithImage={handlePromptWithImage}
      />
    </div>
  );
}

export default App;
