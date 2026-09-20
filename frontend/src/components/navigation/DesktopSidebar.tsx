import React, { useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Image as ImageIcon,
  Settings2,
  Trash2,
  X,
  Sparkles,
  UserCircle2,
  Layers,
  PanelLeftClose,
  Code2,
} from 'lucide-react';
import { ChatThread, Account } from '../../types';
import { hapticImpact } from '../../lib/haptics';

interface DesktopSidebarProps {
  threads: ChatThread[];
  activeConvId: string | null;
  onSelectThread: (convId: string | null, targetAccount?: string | null) => void;
  onNewChat: () => void;
  onDeleteThread: (convId: string) => void;
  activeAccount: Account | null;
  onOpenAccounts: () => void;
  currentTab: 'chat' | 'gallery' | 'generator' | 'settings';
  onSelectTab: (tab: 'chat' | 'gallery' | 'generator' | 'settings') => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMobile?: () => void;
  onOpenCharacterStudio?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  disabledGestures?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  threads,
  activeConvId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  activeAccount,
  onOpenAccounts,
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenMobile,
  onOpenCharacterStudio,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse,
  disabledGestures = false,
}) => {
  const asideRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpenMobileRef = useRef(isOpenMobile);
  const disabledGesturesRef = useRef(disabledGestures);
  const onOpenMobileRef = useRef(onOpenMobile);
  const onCloseMobileRef = useRef(onCloseMobile);

  useEffect(() => {
    isOpenMobileRef.current = isOpenMobile;
  }, [isOpenMobile]);

  useEffect(() => {
    disabledGesturesRef.current = disabledGestures;
  }, [disabledGestures]);

  useEffect(() => {
    onOpenMobileRef.current = onOpenMobile;
  }, [onOpenMobile]);

  useEffect(() => {
    onCloseMobileRef.current = onCloseMobile;
  }, [onCloseMobile]);

  // High-precision 1:1 real-time interactive gesture engine
  useEffect(() => {
    const touchState = {
      startX: 0,
      startY: 0,
      startTime: 0,
      phase: 'idle' as 'idle' | 'potential' | 'dragging' | 'canceled',
      wasOpen: false,
      drawerWidth: 288,
    };

    const handleTouchStart = (e: TouchEvent) => {
      // 1. Single touch only
      if (e.touches.length !== 1) return;
      // 2. Mobile screen width only (< 1024px)
      if (window.innerWidth >= 1024) return;
      // 3. Modals open or gestures explicitly disabled
      if (disabledGesturesRef.current) return;

      const touch = e.touches[0];
      const isOpen = isOpenMobileRef.current;
      const aside = asideRef.current;
      const drawerWidth = aside?.offsetWidth || 288;

      if (!isOpen) {
        // Edge swipe to OPEN:
        // Must start within comfortable 75px zone from left edge
        if (touch.clientX > 75) return;
        // Don't intercept form inputs/textareas
        const target = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
        if (target && typeof target.closest === 'function' && target.closest('input, textarea, select, [data-no-swipe]')) return;
      }

      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }

      touchState.startX = touch.clientX;
      touchState.startY = touch.clientY;
      touchState.startTime = performance.now();
      touchState.phase = 'potential';
      touchState.wasOpen = isOpen;
      touchState.drawerWidth = drawerWidth;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchState.phase === 'idle' || touchState.phase === 'canceled') return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchState.startX;
      const dy = touch.clientY - touchState.startY;

      // Disambiguate horizontal swipe vs vertical scroll during first ~8px of movement
      if (touchState.phase === 'potential') {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < 8 && absY < 8) return;

        // Vertical movement exceeds horizontal: cancel gesture to allow native scroll
        if (absY > absX) {
          touchState.phase = 'canceled';
          return;
        }

        // Swiping left while closed or swiping right while open: cancel
        if (!touchState.wasOpen && dx <= 0) {
          touchState.phase = 'canceled';
          return;
        }
        if (touchState.wasOpen && dx >= 0) {
          touchState.phase = 'canceled';
          return;
        }

        // Horizontal gesture intent locked!
        touchState.phase = 'dragging';
      }

      if (touchState.phase === 'dragging') {
        if (e.cancelable) {
          e.preventDefault();
        }

        const aside = asideRef.current;
        const backdrop = backdropRef.current;
        if (!aside) return;

        let currentOffset = 0;
        if (!touchState.wasOpen) {
          // Opening: starts at -drawerWidth, moves towards 0
          const rawOffset = -touchState.drawerWidth + dx;
          if (rawOffset > 0) {
            // Subtle elastic rubber-banding past 0
            currentOffset = Math.pow(rawOffset, 0.75);
          } else {
            currentOffset = rawOffset;
          }
        } else {
          // Closing: starts at 0, moves towards -drawerWidth
          const rawOffset = dx;
          if (rawOffset < -touchState.drawerWidth) {
            // Elastic rubber-banding past closed
            currentOffset = -touchState.drawerWidth - Math.pow(-touchState.drawerWidth - rawOffset, 0.75);
          } else {
            currentOffset = Math.min(0, rawOffset);
          }
        }

        const progress = Math.max(
          0,
          Math.min(1, (touchState.drawerWidth + Math.min(0, currentOffset)) / touchState.drawerWidth)
        );

        aside.style.transition = 'none';
        aside.style.transform = `translate3d(${currentOffset}px, 0, 0)`;

        if (backdrop) {
          backdrop.style.transition = 'none';
          backdrop.style.opacity = `${progress}`;
          backdrop.style.pointerEvents = 'auto';
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchState.phase !== 'dragging') {
        touchState.phase = 'idle';
        return;
      }
      touchState.phase = 'idle';

      const touch = e.changedTouches[0];
      const dx = touch ? touch.clientX - touchState.startX : 0;
      const elapsed = Math.max(1, performance.now() - touchState.startTime);
      const velocity = dx / elapsed; // px/ms (+ = right, - = left)

      const aside = asideRef.current;
      const backdrop = backdropRef.current;

      // Smart Snapping Decisions:
      // Velocity flick (>0.35 px/ms) or distance threshold (>35% of width)
      let shouldBeOpen = false;
      if (!touchState.wasOpen) {
        // Was closed: open if flicked right or pulled past 35%
        shouldBeOpen = velocity > 0.35 || dx > touchState.drawerWidth * 0.35;
      } else {
        // Was open: close if flicked left or pushed past 35%
        shouldBeOpen = !(velocity < -0.35 || dx < -touchState.drawerWidth * 0.35);
      }

      if (aside) {
        aside.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        aside.style.transform = shouldBeOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)';
      }

      if (backdrop) {
        backdrop.style.transition = 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        backdrop.style.opacity = shouldBeOpen ? '1' : '0';
        backdrop.style.pointerEvents = shouldBeOpen ? 'auto' : 'none';
      }

      if (shouldBeOpen !== touchState.wasOpen) {
        hapticImpact('light');
        if (shouldBeOpen) {
          onOpenMobileRef.current?.();
        } else {
          onCloseMobileRef.current();
        }
      }

      // Settle cleanup: restore pure CSS classes
      snapTimeoutRef.current = setTimeout(() => {
        if (asideRef.current) {
          asideRef.current.style.transform = '';
          asideRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.opacity = '';
          backdropRef.current.style.transition = '';
          backdropRef.current.style.pointerEvents = '';
        }
        snapTimeoutRef.current = null;
      }, 300);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        ref={backdropRef}
        onClick={onCloseMobile}
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out ${
          isOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ willChange: 'opacity' }}
      />

      {/* Sidebar Shell */}
      <aside
        ref={asideRef}
        style={{ willChange: 'transform' }}
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out select-none ${
          isOpenMobile
            ? 'w-72 translate-x-0'
            : isDesktopCollapsed
            ? 'w-72 -translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0 lg:opacity-0 pointer-events-none lg:pointer-events-none overflow-hidden'
            : 'w-72 -translate-x-full lg:translate-x-0 lg:w-64 lg:opacity-100'
        }`}
      >
        {/* Header: App Title & New Chat */}
        <div className="p-3 border-b border-border flex items-center justify-between min-w-[16rem]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm leading-tight text-foreground truncate">
                Bridge Studio
              </h1>
              <span className="text-[10px] font-mono text-muted-foreground block leading-none truncate">
                DALL-E Multi-Account
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                onNewChat();
                onSelectTab('chat');
                onCloseMobile();
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
              title="New Chat (⌘N)"
            >
              <Plus size={17} />
            </button>
            {onToggleDesktopCollapse && (
              <button
                onClick={onToggleDesktopCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
                title="Collapse sidebar (⌘\)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={17} />
              </button>
            )}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="p-2 space-y-1 border-b border-border">
          <button
            onClick={() => {
              onSelectTab('chat');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'chat'
                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs font-semibold'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare size={16} />
              <span>Chat Studio</span>
            </div>
            <kbd className="text-[9px] font-mono opacity-50">⌘1</kbd>
          </button>

          <button
            onClick={() => {
              onSelectTab('gallery');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'gallery'
                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs font-semibold'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ImageIcon size={16} />
              <span>Image Gallery</span>
            </div>
            <kbd className="text-[9px] font-mono opacity-50">⌘2</kbd>
          </button>

          <button
            onClick={() => {
              onSelectTab('generator');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'generator'
                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs font-semibold'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers size={16} />
              <span>Reference Cards</span>
            </div>
            <kbd className="text-[9px] font-mono opacity-50">⌘3</kbd>
          </button>

          <button
            onClick={() => {
              onOpenCharacterStudio?.();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            <div className="flex items-center gap-2.5">
              <UserCircle2 size={16} />
              <span>Character Studio</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
              Lock
            </span>
          </button>

          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            <div className="flex items-center gap-2.5">
              <Code2 size={16} />
              <span>API Reference</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
              v1
            </span>
          </a>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Threads
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {threads.length}
            </span>
          </div>

          {threads.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center font-mono">No threads yet</p>
          ) : (
            threads.map((t) => {
              const isActive = activeConvId === t.conversation_id;
              return (
                <div
                  key={t.conversation_id}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-muted text-foreground border border-border/80 shadow-xs font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                  }`}
                  onClick={() => {
                    onSelectThread(t.conversation_id, t.account_used);
                    onSelectTab('chat');
                    onCloseMobile();
                  }}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate flex-1">
                        {t.title || t.last_prompt || 'Untitled thread'}
                      </span>
                      {t.account_used && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0 ${
                            t.account_used === activeAccount?.alias
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {t.account_used}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this conversation?')) {
                        onDeleteThread(t.conversation_id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive rounded transition-opacity"
                    title="Delete thread"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Active Account Pill */}
        <div className="p-3 border-t border-border bg-card/60">
          <button
            onClick={() => {
              onOpenAccounts();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted transition-all text-left border border-transparent hover:border-border"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {activeAccount?.alias?.slice(0, 1) || 'P'}
              </div>
              <div className="truncate min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {activeAccount?.alias || 'Primary'}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {activeAccount?.total_generations || 0} gens
                </p>
              </div>
            </div>
            <Settings2 size={15} className="text-muted-foreground shrink-0 ml-2" />
          </button>
        </div>
      </aside>
    </>
  );
};
