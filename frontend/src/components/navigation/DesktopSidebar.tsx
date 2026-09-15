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
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade"
        />
      )}

      {/* Sidebar Shell */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 lg:w-64 bg-[#f9f9f9] dark:bg-[#18181b] border-r border-[#e5e5e5] dark:border-[#27272a] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header: App Title & New Chat */}
        <div className="p-3 border-b border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight text-[#0d0d0d] dark:text-white">
                Bridge
              </h1>
              <span className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] block leading-none">
                ChatGPT Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onNewChat();
                onSelectTab('chat');
                onCloseMobile();
              }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-zinc-800/50 transition-colors"
              title="New Chat"
            >
              <Plus size={17} />
            </button>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="p-2 space-y-1 border-b border-[#e5e5e5] dark:border-[#27272a]">
          <button
            onClick={() => {
              onSelectTab('chat');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'chat'
                ? 'bg-white dark:bg-[#27272a] text-[#0d0d0d] dark:text-white shadow-sm'
                : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:bg-gray-200/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <MessageSquare size={16} />
            Chat & Studio
          </button>

          <button
            onClick={() => {
              onSelectTab('gallery');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'gallery'
                ? 'bg-white dark:bg-[#27272a] text-[#0d0d0d] dark:text-white shadow-sm'
                : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:bg-gray-200/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <ImageIcon size={16} />
            Gallery
          </button>

          <button
            onClick={() => {
              onSelectTab('generator');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentTab === 'generator'
                ? 'bg-white dark:bg-[#27272a] text-[#0d0d0d] dark:text-white shadow-sm'
                : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:bg-gray-200/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <Layers size={16} />
            Reference Cards
          </button>

          <button
            onClick={() => {
              onOpenCharacterStudio?.();
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-[#6e6e80] dark:text-[#a1a1aa] hover:bg-gray-200/50 dark:hover:bg-zinc-800/50`}
          >
            <UserCircle2 size={16} />
            Characters
          </button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 pt-2 pb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#a1a1aa] dark:text-[#71717a]">
              Recent Threads
            </span>
          </div>

          {threads.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">No threads yet</p>
          ) : (
            threads.map((t) => {
              const isActive = activeConvId === t.conversation_id;
              return (
                <div
                  key={t.conversation_id}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#242428] text-[#0d0d0d] dark:text-white shadow-sm font-medium'
                      : 'text-[#6e6e80] dark:text-[#a1a1aa] hover:bg-gray-200/60 dark:hover:bg-zinc-800/50'
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
                          className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0 ${
                            t.account_used === activeAccount?.alias
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
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
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded transition-opacity"
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
        <div className="p-3 border-t border-[#e5e5e5] dark:border-[#27272a] bg-[#f7f7f8] dark:bg-[#18181b]">
          <button
            onClick={() => {
              onOpenAccounts();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                {activeAccount?.alias?.slice(0, 1) || 'P'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-[#0d0d0d] dark:text-white truncate">
                  {activeAccount?.alias || 'Primary'}
                </p>
                <p className="text-[10px] text-gray-400 font-mono">
                  {activeAccount?.total_generations || 0} gens
                </p>
              </div>
            </div>
            <Settings2 size={15} className="text-gray-400" />
          </button>
        </div>
      </aside>
    </>
  );
};
