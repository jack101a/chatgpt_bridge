import React from 'react';
import { Plus, MessageSquare, Image as ImageIcon, Settings2, Trash2, X, Sparkles, UserCircle2, Layers } from 'lucide-react';
import { ChatThread, Account } from '../../types';

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
  onOpenCharacterStudio?: () => void;
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
  onOpenCharacterStudio,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        />
      )}

      {/* Sidebar Shell */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 lg:w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out select-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header: App Title & New Chat */}
        <div className="p-3 border-b border-border flex items-center justify-between">
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
