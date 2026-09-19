import { useState, useEffect, useRef, useCallback } from 'react';
import { useBridge } from './hooks/useBridge';
import { useGallery } from './hooks/useGallery';
import { useCommandPalette } from './hooks/useCommandPalette';
import { ChatView } from './components/chat/ChatView';
import { GalleryView } from './components/gallery/GalleryView';
import { AccountsDrawer } from './components/settings/AccountsDrawer';
import { ImageViewerModal } from './components/viewer/ImageViewerModal';
import { DesktopSidebar } from './components/navigation/DesktopSidebar';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { AppHeader } from './components/navigation/AppHeader';
import { CommandPaletteModal } from './components/common/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';
import { GridPatternBackground } from './components/common/GridPatternBackground';
import { DirectorModal } from './components/director/DirectorModal';
import { CharacterStudioDrawer } from './components/character/CharacterStudioDrawer';
import { CardGeneratorView } from './components/generator/CardGeneratorView';
import { GalleryItem, CharacterCard } from './types';
import { api } from './lib/api';

export function App() {
  // Restore initial active tab: URL hash takes priority, then localStorage, otherwise 'chat'
  const [currentTab, setCurrentTab] = useState<'chat' | 'gallery' | 'generator' | 'settings'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'chat' || hash === 'gallery' || hash === 'generator' || hash === 'settings') {
      return hash;
    }
    try {
      const savedTab = localStorage.getItem('bridge:tab');
      if (savedTab === 'chat' || savedTab === 'gallery' || savedTab === 'generator' || savedTab === 'settings') {
        return savedTab as any;
      }
      const savedState = localStorage.getItem('bridge:state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed?.currentTab) return parsed.currentTab;
      }
    } catch (e) {}
    return 'chat';
  });

  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem('bridge:desktop_sidebar_collapsed') === 'true';
  });

  const handleToggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bridge:desktop_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  }, []);
  const [isCharacterStudioOpen, setIsCharacterStudioOpen] = useState(false);
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard | null>(null);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [viewerItem, setViewerItem] = useState<GalleryItem | null>(null);
  const [referenceImage, setReferenceImage] = useState<GalleryItem | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('bridge:theme') === 'dark';
  });
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);

  // Command palette & shortcuts
  const commandPalette = useCommandPalette();

  // Load characters and active lock on startup
  const fetchCharacters = useCallback(() => {
    api.getCharacters().then((chars) => {
      setCharacters(chars);
      const locked = chars.find((c) => c.is_locked);
      if (locked) setActiveCharacter(locked);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const bridge = useBridge();
  const gallery = useGallery();
  const isInitialLoad = useRef(true);

  // Ensure initial hash reflects active tab
  useEffect(() => {
    const currentHash = window.location.hash.replace('#', '');
    if (!currentHash || (currentHash !== 'chat' && currentHash !== 'gallery' && currentHash !== 'generator')) {
      window.history.replaceState(null, '', `#${currentTab}`);
    }
    try {
      localStorage.setItem('bridge:tab', currentTab);
    } catch (e) {}
    isInitialLoad.current = false;
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
      if (bridge.activeConvId) {
        localStorage.setItem('bridge:active_conv_id', bridge.activeConvId);
      }
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
      } else if (hash === 'generator') {
        setCurrentTab('generator');
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
  const handleSelectTab = (tab: 'chat' | 'gallery' | 'generator' | 'settings') => {
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
    handleSelectTab('chat');
  };

  const handleFullPageRefresh = async () => {
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

  // Desktop sidebar shortcut (⌘\ or Ctrl+\)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        handleToggleDesktopSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleDesktopSidebar]);

  // Mobile edge gestures are handled with 1:1 real-time tracking in DesktopSidebar


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
    } catch (e) {
      console.error('Failed to delete thread', e);
    }
  };

  // Character selection & lock toggle handler
  const handleSelectCharacter = (char: CharacterCard | null) => {
    setActiveCharacter(char);
    if (char) {
      api.lockCharacter(char.id, true).catch(() => {});
      if (bridge.activeConvId) {
        api.setConversationCharacter(bridge.activeConvId, char.id).catch(() => {});
      }
    } else {
      if (activeCharacter) {
        api.lockCharacter(activeCharacter.id, false).catch(() => {});
      }
      if (bridge.activeConvId) {
        api.setConversationCharacter(bridge.activeConvId, null).catch(() => {});
      }
    }
    fetchCharacters();
  };

  // Start a fresh new chat from anywhere (Header logo, sidebar button, shortcuts)
  const handleStartNewChat = useCallback(() => {
    bridge.selectThread(null);
    api.resetConversation().catch(() => {});
    setIsDirectorOpen(false);
    setIsCharacterStudioOpen(false);
    setIsAccountsOpen(false);
    setViewerItem(null);
    handleSelectTab('chat');
    setIsSidebarOpenMobile(false);
  }, [bridge, handleSelectTab]);

  // Command palette triggered actions
  const handleTriggerAction = (actionId: string) => {
    if (actionId === 'new-chat') {
      handleStartNewChat();
    } else if (actionId === 'open-director') {
      setIsDirectorOpen(true);
    } else if (actionId === 'refresh-accounts') {
      bridge.refreshAccounts();
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-background text-foreground relative">
      {/* Subtle Grid Pattern Background (sv-animations & sv-blocks style) */}
      <GridPatternBackground />

      {/* ── Left Sidebar (Desktop Fixed, Mobile Drawer) ── */}
      <DesktopSidebar
        threads={bridge.threads}
        activeConvId={bridge.activeConvId}
        onSelectThread={(convId) => {
          bridge.selectThread(convId);
          if (convId) {
            api.getConversationContract(convId).then((contract) => {
              if (contract?.character_id) {
                const matched = characters.find((c) => c.id === contract.character_id);
                if (matched) setActiveCharacter(matched);
              }
            }).catch(() => {});
          }
          handleSelectTab('chat');
          setIsSidebarOpenMobile(false);
        }}
        onNewChat={handleStartNewChat}
        onDeleteThread={handleDeleteThread}
        activeAccount={activeAccount}
        onOpenAccounts={handleOpenAccounts}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpenMobile={isSidebarOpenMobile}
        onOpenMobile={handleOpenSidebarMobile}
        onCloseMobile={handleCloseSidebarMobile}
        onOpenCharacterStudio={() => setIsCharacterStudioOpen(true)}
        isDesktopCollapsed={isDesktopSidebarCollapsed}
        onToggleDesktopCollapse={handleToggleDesktopSidebar}
        disabledGestures={Boolean(viewerItem || isAccountsOpen || isDirectorOpen || isCharacterStudioOpen)}
      />

      {/* ── Main Content Stage ── */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        {/* Modern App Header (Auto-hides in sync with feed scroll) */}
        <div
          className={`transition-transform duration-300 ease-out z-30 shrink-0 ${
            currentTab === 'gallery' && !isMobileNavVisible
              ? '-translate-y-full pointer-events-none absolute top-0 left-0 right-0'
              : 'relative translate-y-0'
          }`}
        >
          <AppHeader
            currentTab={currentTab}
            activeCharacter={activeCharacter}
            onOpenCharacters={() => setIsCharacterStudioOpen(true)}
            onOpenAccounts={handleOpenAccounts}
            onOpenCommandPalette={commandPalette.openPalette}
            onOpenShortcuts={commandPalette.openShortcuts}
            onOpenSidebarMobile={handleOpenSidebarMobile}
            onToggleDesktopSidebar={handleToggleDesktopSidebar}
            isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            isDarkMode={isDarkMode}
            isConnected={bridge.wsConnected}
            onOpenDirector={() => setIsDirectorOpen(true)}
            activeAccountName={activeAccount?.alias}
            onNavigateTab={handleSelectTab}
            onNewChat={handleStartNewChat}
          />
        </div>

        {/* Tab 1: Chat Studio */}
        <div className={`flex-1 min-h-0 flex flex-col w-full overflow-hidden ${currentTab === 'chat' ? 'flex' : 'hidden'}`}>
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
              api.getConversationContract(convId).then((contract) => {
                if (contract?.character_id) {
                  const matched = characters.find((c) => c.id === contract.character_id);
                  if (matched) setActiveCharacter(matched);
                }
              }).catch(() => {});
              handleSelectTab('chat');
            }}
            onToggleFavorite={handleToggleFavorite}
            referenceImage={referenceImage}
            onClearReference={() => setReferenceImage(null)}
            onPromptWithImage={handlePromptWithImage}
            onRefresh={handleFullPageRefresh}
            characters={characters}
            activeCharacter={activeCharacter}
            onSelectCharacter={handleSelectCharacter}
            onThreadCreated={(newId) => {
              bridge.selectThread(newId);
            }}
            hideHeader={true}
          />
        </div>

        {/* Tab 2: Gallery View */}
        <div className={`flex-1 min-h-0 flex flex-col w-full overflow-hidden ${currentTab === 'gallery' ? 'flex' : 'hidden'}`}>
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
        </div>

        {/* Tab 3: Character / Card Generator */}
        <div className={`flex-1 min-h-0 flex flex-col w-full overflow-hidden ${currentTab === 'generator' ? 'flex' : 'hidden'}`}>
          <CardGeneratorView
            characters={characters}
            onRefreshCharacters={fetchCharacters}
            onOpenSidebar={handleOpenSidebarMobile}
            onOpenViewer={handleOpenViewer}
            onContinueInChat={handleContinueInChat}
            hideHeader={true}
          />
        </div>

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

      {/* ── Character Studio Drawer ── */}
      <CharacterStudioDrawer
        isOpen={isCharacterStudioOpen}
        onClose={() => setIsCharacterStudioOpen(false)}
        activeCharacter={activeCharacter}
        setActiveCharacter={setActiveCharacter}
        onNavigateToGenerator={() => {
          setIsCharacterStudioOpen(false);
          handleSelectTab('generator');
        }}
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

      {/* ── Universal Command Palette Modal (⌘K) ── */}
      <CommandPaletteModal
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.closePalette}
        onNavigateTab={handleSelectTab}
        onTriggerAction={handleTriggerAction}
        characters={characters}
        activeCharacter={activeCharacter}
        onSelectCharacter={handleSelectCharacter}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      {/* ── Keyboard Shortcuts Cheatsheet Modal (?) ── */}
      <KeyboardShortcutsModal
        isOpen={commandPalette.isShortcutsOpen}
        onClose={commandPalette.closeShortcuts}
      />

      {/* ── AI Storyboard Director Modal (Global Trigger) ── */}
      <DirectorModal
        isOpen={isDirectorOpen}
        onClose={() => setIsDirectorOpen(false)}
        initialPrompt=""
        characters={characters}
        activeCharacter={activeCharacter}
        activeConvId={bridge.activeConvId}
        onSelectCharacter={handleSelectCharacter}
        onThreadCreated={(convId) => {
          if (convId && bridge.activeConvId !== convId) {
            bridge.selectThread(convId);
          }
        }}
      />
    </div>
  );
}

export default App;
