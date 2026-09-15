import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Clock,
  Key,
  ShieldCheck,
  Moon,
  Sun,
  MessageSquare,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  Pin,
  UploadCloud,
  DownloadCloud,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  Account,
  Telemetry,
  StorageStatus,
  StorageSyncProgress,
  TelegramTestResult,
  VaultBackupsResponse,
} from '../../types';
import { api } from '../../lib/api';

interface AccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  telemetry: Telemetry | null;
  onRefreshAccounts: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AccountsDrawer: React.FC<AccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  telemetry,
  onRefreshAccounts,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [cookieAccount, setCookieAccount] = useState('');
  const [cookieJson, setCookieJson] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieSuccess, setCookieSuccess] = useState<string | null>(null);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimisticAutoSwitch, setOptimisticAutoSwitch] = useState<boolean | null>(null);
  const [optimisticMaxChats, setOptimisticMaxChats] = useState<number | null>(null);

  // Storage & Telegram Vault states
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChannel, setTgChannel] = useState('');
  const [showTgToken, setShowTgToken] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<TelegramTestResult | null>(null);
  const [tgSaveMsg, setTgSaveMsg] = useState<string | null>(null);
  const [optimisticQuota, setOptimisticQuota] = useState<number | null>(null);
  const [optimisticTgEnabled, setOptimisticTgEnabled] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<StorageSyncProgress | null>(null);
  const [backups, setBackups] = useState<VaultBackupsResponse | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [vaultMsg, setVaultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRegeneratingThumbs, setIsRegeneratingThumbs] = useState(false);
  const [thumbMsg, setThumbMsg] = useState<string | null>(null);

  // Swipe-down-to-close gesture states
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const drawerTouchStartRef = useRef<{ y: number; time: number }>({ y: 0, time: 0 });

  const isAutoSwitchActive =
    optimisticAutoSwitch !== null
      ? optimisticAutoSwitch
      : telemetry?.settings?.auto_switch !== false;

  const currentMaxChats =
    optimisticMaxChats !== null
      ? optimisticMaxChats
      : telemetry?.settings?.max_chats ?? 25;

  const handleTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    drawerTouchStartRef.current = { y: clientY, time: Date.now() };
    setIsDrawerDragging(true);
    if ('setPointerCapture' in e.target && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {}
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (!isDrawerDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    const dy = clientY - drawerTouchStartRef.current.y;
    if (dy > 0) {
      setDrawerDragY(dy);
    } else {
      setDrawerDragY(dy * 0.2); // rubber-banding
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.PointerEvent) => {
    if (!isDrawerDragging) return;
    setIsDrawerDragging(false);
    if ('releasePointerCapture' in e.target && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).releasePointerCapture((e as React.PointerEvent).pointerId);
      } catch {}
    }
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.PointerEvent).clientY;
    const dy = clientY - drawerTouchStartRef.current.y;
    const dt = Math.max(1, Date.now() - drawerTouchStartRef.current.time);
    const velocity = dy / dt;
    if (dy > 50 || (velocity > 0.25 && dy > 15)) {
      onClose();
    }
    setDrawerDragY(0);
  };

  const handleSwitchAccount = async (alias: string) => {
    try {
      await api.switchAccount(alias);
      onRefreshAccounts();
    } catch (err: any) {
      alert(`Failed to switch account: ${err.message}`);
    }
  };

  const handleToggleAutoSwitch = async () => {
    const nextVal = !isAutoSwitchActive;
    setOptimisticAutoSwitch(nextVal);
    try {
      await api.patchSettings({ auto_switch: nextVal });
      onRefreshAccounts();
    } catch (err: any) {
      console.error(err);
      setOptimisticAutoSwitch(!nextVal);
    }
  };

  const handleUpdateMaxChats = async (val: number) => {
    setOptimisticMaxChats(val);
    try {
      await api.patchSettings({ max_chats: val });
      onRefreshAccounts();
    } catch (err: any) {
      console.error(err);
      setOptimisticMaxChats(telemetry?.settings?.max_chats ?? 25);
    }
  };

  const handleImportCookies = async () => {
    if (!cookieAccount || !cookieJson.trim()) {
      setCookieError('Please select an account and paste the cookies JSON.');
      return;
    }
    setIsSubmitting(true);
    setCookieError(null);
    try {
      const res = await api.importCookies(cookieAccount, cookieJson.trim());
      setCookieSuccess(`Imported ${res.cookies_imported} cookies successfully!`);
      setTimeout(() => {
        setShowCookieModal(false);
        setCookieSuccess(null);
        setCookieJson('');
        onRefreshAccounts();
      }, 1500);
    } catch (err: any) {
      setCookieError(err.message || 'Failed to import cookies');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchStorage = useCallback(async () => {
    try {
      setIsLoadingStorage(true);
      const status = await api.getStorageStatus();
      setStorageStatus(status);
      if (status.sync_status) {
        setSyncStatus(status.sync_status);
        setIsSyncing(status.sync_status.running);
      }
    } catch (err) {
      console.error('Failed to load storage status', err);
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const b = await api.getVaultBackups();
      setBackups(b);
    } catch (err) {
      console.error('Failed to load vault backups', err);
    }
  }, []);

  // Fetch settings & storage status when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    fetchStorage();
    fetchBackups();
    api.getSettings().then((s) => {
      if (s.telegram_bot_token) setTgToken(s.telegram_bot_token);
      if (s.telegram_channel_id) setTgChannel(s.telegram_channel_id);
    }).catch(() => {});
  }, [isOpen, fetchStorage, fetchBackups]);

  // Poll sync progress when background sync is active
  useEffect(() => {
    if (!isSyncing) return;
    const interval = setInterval(async () => {
      try {
        const prog = await api.getStorageSyncStatus();
        setSyncStatus(prog);
        if (!prog.running) {
          setIsSyncing(false);
          fetchStorage();
          onRefreshAccounts();
        }
      } catch {
        setIsSyncing(false);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isSyncing, fetchStorage, onRefreshAccounts]);

  // Handle Escape key to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentQuota =
    optimisticQuota !== null
      ? optimisticQuota
      : storageStatus?.cache_limit_mb ?? telemetry?.settings?.storage_quota_mb ?? 512;

  const isTgEnabled =
    optimisticTgEnabled !== null
      ? optimisticTgEnabled
      : storageStatus?.telegram_storage_enabled ?? telemetry?.settings?.telegram_storage_enabled ?? false;

  const handleToggleTelegram = async () => {
    const nextVal = !isTgEnabled;
    setOptimisticTgEnabled(nextVal);
    try {
      await api.patchSettings({ telegram_storage_enabled: nextVal });
      fetchStorage();
      onRefreshAccounts();
    } catch (err: any) {
      alert(`Failed to update Telegram storage: ${err.message}`);
      setOptimisticTgEnabled(!nextVal);
    }
  };

  const handleSaveTelegramCredentials = async () => {
    try {
      setTgSaveMsg(null);
      await api.patchSettings({
        telegram_bot_token: tgToken.trim(),
        telegram_channel_id: tgChannel.trim(),
        telegram_storage_enabled: true,
      });
      setTgSaveMsg('Saved credentials successfully!');
      fetchStorage();
      onRefreshAccounts();
      setTimeout(() => setTgSaveMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save Telegram credentials: ${err.message}`);
    }
  };

  const handleTestTelegramConnection = async () => {
    setIsTestingTg(true);
    setTgTestResult(null);
    try {
      const res = await api.testTelegram({
        bot_token: tgToken.trim() || undefined,
        channel_id: tgChannel.trim() || undefined,
      });
      setTgTestResult(res);
    } catch (err: any) {
      setTgTestResult({ ok: false, error: err.message });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleStartSync = async () => {
    try {
      setIsSyncing(true);
      await api.startStorageSync();
      const prog = await api.getStorageSyncStatus();
      setSyncStatus(prog);
    } catch (err: any) {
      alert(`Failed to start storage sync: ${err.message}`);
      setIsSyncing(false);
    }
  };

  const handleUpdateQuota = async (mb: number) => {
    setOptimisticQuota(mb);
    try {
      await api.patchSettings({ storage_quota_mb: mb });
    } catch (err: any) {
      alert(`Failed to update storage quota: ${err.message}`);
      setOptimisticQuota(null);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setVaultMsg(null);
    try {
      const res = await api.triggerVaultBackup();
      setVaultMsg({
        type: 'success',
        text: `Catalog pinned in Telegram: ${res.total_images} items backed up.`,
      });
      fetchBackups();
      fetchStorage();
    } catch (err: any) {
      setVaultMsg({ type: 'error', text: `Backup failed: ${err.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreNow = async () => {
    if (!confirm('Restore full library catalog from the latest pinned Telegram manifest?')) return;
    setIsRestoring(true);
    setVaultMsg(null);
    try {
      const res = await api.triggerVaultRestore();
      setVaultMsg({
        type: 'success',
        text: `Restored ${res.restored_images} images and ${res.restored_favorites} favorites from Telegram!`,
      });
      fetchStorage();
      fetchBackups();
      onRefreshAccounts();
    } catch (err: any) {
      setVaultMsg({ type: 'error', text: `Restore failed: ${err.message}` });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    setIsRegeneratingThumbs(true);
    setThumbMsg(null);
    try {
      const res = await api.regenerateThumbnails();
      setThumbMsg(`Regenerated ${res.regenerated} crisp 720p thumbnails!`);
      fetchStorage();
      onRefreshAccounts();
      setTimeout(() => setThumbMsg(null), 4000);
    } catch (err: any) {
      setThumbMsg(`Failed to regenerate: ${err.message}`);
    } finally {
      setIsRegeneratingThumbs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-up Bottom Sheet (Mobile) / Center Card (Desktop) */}
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#ffffff] dark:bg-[#18181b] rounded-t-3xl sm:rounded-3xl border border-[#e5e5e5] dark:border-[#2b2b2f] p-5 shadow-2xl z-10 animate-slide-up space-y-5 will-change-transform"
        style={{
          transform: drawerDragY > 0 ? `translate3d(0, ${drawerDragY}px, 0)` : undefined,
          transition: isDrawerDragging ? 'none' : 'transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {/* Grab Handle for Mobile (Drag/Swipe to Close) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handleTouchStart}
          onPointerMove={handleTouchMove}
          onPointerUp={handleTouchEnd}
          className="w-full py-2 -mt-2 cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none sm:hidden"
        >
          <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-700 active:bg-gray-400 dark:active:bg-zinc-500 transition-colors" />
        </div>

        {/* Drawer Header (Draggable to close on mobile) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handleTouchStart}
          onPointerMove={handleTouchMove}
          onPointerUp={handleTouchEnd}
          className="flex items-start justify-between touch-none select-none"
        >
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0d0d0d] dark:text-white">
              Accounts & Engine
            </h2>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
              Manage your ChatGPT accounts and self-hosted engine settings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-black dark:hover:text-white transition-all active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Section: ChatGPT Accounts ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] dark:text-[#a1a1aa]">
              ChatGPT Accounts
            </h3>
            <span className="text-[11px] text-gray-400">Rotates on rate limit</span>
          </div>

          <div className="space-y-2">
            {accounts.map((acc) => {
              const inCooldown =
                acc.rate_limited_until && acc.rate_limited_until > Date.now() / 1000;
              const cooldownMinutes = inCooldown
                ? Math.ceil((acc.rate_limited_until! - Date.now() / 1000) / 60)
                : 0;

              return (
                <div
                  key={acc.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    acc.is_active
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#f7f7f8] dark:bg-[#202024] border-[#e5e5e5] dark:border-[#2c2c30]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xs">
                        {acc.alias.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                            {acc.alias}
                          </p>
                          {acc.is_active && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa] font-mono truncate max-w-[180px]">
                          {acc.email || acc.id}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge & Action */}
                    <div className="flex items-center gap-2">
                      {inCooldown ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono border border-amber-500/20">
                          <Clock size={10} />
                          {cooldownMinutes}m cooldown
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-gray-400">
                          {acc.total_generations} gens
                        </span>
                      )}

                      {!acc.is_active && (
                        <button
                          onClick={() => handleSwitchAccount(acc.alias)}
                          className="px-2.5 py-1 rounded-full bg-white dark:bg-[#2b2b30] hover:bg-gray-100 dark:hover:bg-[#383840] border border-gray-200 dark:border-gray-700 text-xs font-medium text-[#0d0d0d] dark:text-white active:scale-95 transition-all shadow-sm"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section: Engine Settings ── */}
        <div className="space-y-3 pt-2 border-t border-[#e5e5e5] dark:border-[#2a2a2e]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] dark:text-[#a1a1aa]">
            Engine Settings
          </h3>

          {/* Auto-Switch Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30]">
            <div>
              <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">
                Auto-Switch on Rate Limit
              </p>
              <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                Automatically rotates to another standby account
              </p>
            </div>
            <button
              onClick={handleToggleAutoSwitch}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative focus:outline-none ${
                isAutoSwitchActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                  isAutoSwitchActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Rotatable Chats Pool Limit */}
          <div className="p-3 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-500" />
                <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">
                  Rotatable Chats Pool
                </p>
              </div>
              <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {currentMaxChats === 0 ? 'Unlimited' : `${currentMaxChats} chats`}
              </span>
            </div>
            <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
              Max conversations kept before auto-pruning old threads. Set to Unlimited to never auto-delete conversations.
            </p>
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {[
                { label: '10', value: 10 },
                { label: '25 (Default)', value: 25 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
                { label: 'Unlimited', value: 0 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleUpdateMaxChats(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap active:scale-95 ${
                    currentMaxChats === opt.value
                      ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-xs font-semibold'
                      : 'bg-white dark:bg-[#2b2b2f] border border-gray-200 dark:border-zinc-700 text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section: Telegram Cloud Vault & Storage Quota ── */}
          <div className="space-y-3 pt-2 border-t border-[#e5e5e5] dark:border-[#2a2a2e]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cloud size={14} className="text-sky-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] dark:text-[#a1a1aa]">
                  Telegram Cloud Vault & Storage
                </h3>
              </div>
              {isLoadingStorage && <Loader2 size={12} className="animate-spin text-zinc-400" />}
            </div>

            {/* Storage Meter & Quota Bar */}
            <div className="p-3.5 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HardDrive size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">
                    Local Cache Quota
                  </p>
                </div>
                <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {storageStatus?.cache_used_mb ?? 0} MB / {currentQuota === 0 ? 'Unlimited' : `${currentQuota} MB`}
                </span>
              </div>

              {/* Quota Progress Meter */}
              <div className="w-full bg-gray-200 dark:bg-zinc-700/60 rounded-full h-2 overflow-hidden flex">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (storageStatus?.percent_used ?? 0) > 90
                      ? 'bg-rose-500'
                      : (storageStatus?.percent_used ?? 0) > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: currentQuota === 0 ? '5%' : `${Math.min(100, Math.max(2, storageStatus?.percent_used ?? 0))}%`,
                  }}
                />
              </div>

              {/* Storage Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                <div className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#1a1a1e] border border-gray-200/70 dark:border-zinc-800">
                  <div className="text-gray-400 uppercase text-[9px]">Thumbnails</div>
                  <div className="text-zinc-700 dark:text-zinc-300 font-semibold">{storageStatus?.thumbnail_used_mb ?? 0} MB</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#1a1a1e] border border-gray-200/70 dark:border-zinc-800">
                  <div className="text-gray-400 uppercase text-[9px]">Local Full-Res</div>
                  <div className="text-zinc-700 dark:text-zinc-300 font-semibold">{storageStatus?.local_full_count ?? 0} imgs</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#1a1a1e] border border-gray-200/70 dark:border-zinc-800">
                  <div className="text-gray-400 uppercase text-[9px]">Cloud Backed</div>
                  <div className="text-sky-600 dark:text-sky-400 font-semibold">{storageStatus?.cloud_backed_count ?? 0} imgs</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#1a1a1e] border border-gray-200/70 dark:border-zinc-800">
                  <div className="text-gray-400 uppercase text-[9px]">Evicted to Cloud</div>
                  <div className="text-amber-600 dark:text-amber-400 font-semibold">{storageStatus?.evicted_count ?? 0} imgs</div>
                </div>
              </div>

              {/* Quota Selection Pills */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                  Auto-evicts oldest non-favorite images when limit is reached. WebP thumbnails are always kept for instant UI display.
                </p>
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                  {[
                    { label: '256 MB', value: 256 },
                    { label: '512 MB (Default)', value: 512 },
                    { label: '1 GB', value: 1024 },
                    { label: '2 GB', value: 2048 },
                    { label: 'Unlimited', value: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdateQuota(opt.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap active:scale-95 ${
                        currentQuota === opt.value
                          ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-xs font-semibold'
                          : 'bg-white dark:bg-[#2b2b2f] border border-gray-200 dark:border-zinc-700 text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Telegram Cloud Vault Configuration Card */}
            <div className="p-3.5 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
                    <Cloud size={14} className="text-sky-500" />
                    <span>Telegram Backup Vault</span>
                  </p>
                  <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                    Stores uncompressed original PNGs in your private Telegram channel
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTelegram}
                  className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative focus:outline-none ${
                    isTgEnabled ? 'bg-sky-500' : 'bg-gray-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                      isTgEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {isTgEnabled && (
                <div className="space-y-3 pt-2 border-t border-gray-200/80 dark:border-zinc-700/60 animate-in fade-in duration-200">
                  {/* Bot Token Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                      <span>Bot Token</span>
                      <button
                        type="button"
                        onClick={() => setShowTgToken(!showTgToken)}
                        className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        {showTgToken ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{showTgToken ? 'Hide' : 'Show'}</span>
                      </button>
                    </label>
                    <input
                      type={showTgToken ? 'text' : 'password'}
                      value={tgToken}
                      onChange={(e) => setTgToken(e.target.value)}
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#19191c] border border-gray-200 dark:border-zinc-700 font-mono text-xs text-[#0d0d0d] dark:text-white outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>

                  {/* Channel / Chat ID Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                      Channel / Group ID
                    </label>
                    <input
                      type="text"
                      value={tgChannel}
                      onChange={(e) => setTgChannel(e.target.value)}
                      placeholder="@my_vault_channel or -1001234567890"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#19191c] border border-gray-200 dark:border-zinc-700 font-mono text-xs text-[#0d0d0d] dark:text-white outline-none focus:border-sky-500 transition-colors"
                    />
                    <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa]">
                      💡 Create a private channel, add your bot as Admin with "Post Messages" permission.
                    </p>
                  </div>

                  {/* Test Connection & Save Row */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestTelegramConnection}
                      disabled={isTestingTg || !tgToken.trim() || !tgChannel.trim()}
                      className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-[#2b2b30] hover:bg-gray-100 dark:hover:bg-[#383840] border border-gray-200 dark:border-gray-700 text-xs font-medium text-[#0d0d0d] dark:text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isTestingTg ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-sky-500" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} className="text-sky-500" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveTelegramCredentials}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                    >
                      <Check size={13} />
                      <span>Save Credentials</span>
                    </button>
                  </div>

                  {/* Test Result Message */}
                  {tgTestResult && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        tgTestResult.ok
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {tgTestResult.ok ? (
                        <>
                          <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-500" />
                          <span>
                            Verified! Connected to <strong>{tgTestResult.bot_username}</strong> with write access.
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={15} className="flex-shrink-0 text-rose-500" />
                          <span className="truncate">{tgTestResult.error || 'Connection failed'}</span>
                        </>
                      )}
                    </div>
                  )}

                  {tgSaveMsg && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{tgSaveMsg}</p>
                  )}

                  {/* Forum Topics Status Card */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#19191c] border border-gray-200/80 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-sky-500" />
                        <p className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                          Forum Topics Routing
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-medium">
                        Active Supergroup
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-[#0d0d0d] dark:text-white font-medium">
                          <span>📁 Data</span>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">#8</span>
                        </div>
                        <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5 leading-tight">
                          Full-res uncompressed PNG file documents
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-[#0d0d0d] dark:text-white font-medium">
                          <span>🖼️ General</span>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">#1</span>
                        </div>
                        <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5 leading-tight">
                          Pure visual photo viewer at max resolution
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-[#0d0d0d] dark:text-white font-medium">
                          <span>📦 Backup</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">#5</span>
                        </div>
                        <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5 leading-tight">
                          Daily snapshots, 7-day FIFO auto-rotation
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sync Existing Images & Thumbnails Action */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#19191c] border border-gray-200/80 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">
                          Sync & Gallery Rendering
                        </p>
                        <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa]">
                          Uploads unbacked images and upgrades thumbnails to crisp 720p HD
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleRegenerateThumbnails}
                          disabled={isRegeneratingThumbs}
                          className="px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-[#0d0d0d] dark:text-white text-xs font-medium flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                          title="Regenerate crisp 720p HD WebP thumbnails for all gallery images"
                        >
                          {isRegeneratingThumbs ? (
                            <Loader2 size={11} className="animate-spin text-sky-500" />
                          ) : (
                            <Sparkles size={11} className="text-amber-500" />
                          )}
                          <span>{isRegeneratingThumbs ? 'Rendering...' : 'HD 720p Thumbs'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStartSync}
                          disabled={isSyncing}
                          className="px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-medium flex items-center gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/40 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                          <span>{isSyncing ? 'Syncing...' : 'Sync Vault'}</span>
                        </button>
                      </div>
                    </div>

                    {thumbMsg && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{thumbMsg}</p>
                    )}

                    {/* Sync Progress Indicator */}
                    {syncStatus && (syncStatus.running || syncStatus.total > 0) && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 dark:text-gray-400">
                          <span>
                            {syncStatus.running ? `Progress: ${syncStatus.current} / ${syncStatus.total}` : 'Sync Complete!'}
                          </span>
                          <span>
                            Uploaded: {syncStatus.uploaded} · Thumbs: {syncStatus.thumbnails} · Evicted: {syncStatus.evicted}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${syncStatus.total > 0 ? (syncStatus.current / syncStatus.total) * 100 : 100}%`,
                            }}
                          />
                        </div>
                        {syncStatus.error && (
                          <p className="text-[10px] text-rose-500">{syncStatus.error}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Daily Vault Backups & Disaster Recovery Card */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#19191c] border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Pin size={12} className="text-emerald-500" />
                          <p className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                            Daily Manifest & Disaster Recovery
                          </p>
                        </div>
                        <p className="text-[10px] text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
                          Immutable catalog snapshot with triple identifiers (<span className="font-mono text-[9px]">tg_file_id</span>, <span className="font-mono text-[9px]">filename</span>, <span className="font-mono text-[9px]">md5</span>). Backed up daily & auto-rotates the last 7 snapshots.
                        </p>
                      </div>
                    </div>

                    {/* Snapshot Status Banner */}
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="truncate">
                          {backups?.latest
                            ? `Latest: ${backups.latest.date_str} (${backups.latest.total_images} items)`
                            : 'Auto-backup active (runs daily at midnight)'}
                        </span>
                      </div>
                      {backups && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">
                          {backups.total_backups} retained
                        </span>
                      )}
                    </div>

                    {/* Action Buttons: Backup Now & Restore from Vault */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleBackupNow}
                        disabled={isBackingUp || !tgToken.trim()}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs disabled:opacity-50"
                      >
                        {isBackingUp ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Snapshotting...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud size={13} />
                            <span>Backup Now</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleRestoreNow}
                        disabled={isRestoring || !tgToken.trim()}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-white dark:bg-[#26262a] hover:bg-gray-100 dark:hover:bg-[#323236] border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-[#0d0d0d] dark:text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                        title="Restore full gallery catalog from pinned Telegram manifest"
                      >
                        {isRestoring ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-emerald-500" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud size={13} className="text-emerald-500" />
                            <span>Restore Vault</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Feedback message banner */}
                    {vaultMsg && (
                      <div
                        className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                          vaultMsg.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {vaultMsg.type === 'success' ? (
                          <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle size={13} className="flex-shrink-0 text-rose-500" />
                        )}
                        <span className="truncate">{vaultMsg.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30]">
            <div className="flex items-center gap-2">
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
              <div>
                <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">Appearance</p>
                <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                  {isDarkMode ? 'Dark theme active' : 'Light theme active'}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleDarkMode}
              className="px-3 py-1 rounded-full bg-white dark:bg-[#2b2b30] border border-gray-200 dark:border-gray-700 text-xs font-medium text-[#0d0d0d] dark:text-white active:scale-95 transition-all shadow-sm"
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Import Cookies Action */}
          <button
            onClick={() => setShowCookieModal(true)}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-[#0d0d0d] dark:text-white flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Key size={14} />
            Import cookies.json
          </button>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-[11px]">
          <ShieldCheck size={14} className="flex-shrink-0" />
          <span>Your account data is stored securely on this local machine only.</span>
        </div>

        {/* Cookie Import Modal (Child) */}
        {showCookieModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-[#1f1f23] rounded-2xl p-5 border border-gray-200 dark:border-zinc-700 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0d0d0d] dark:text-white">
                  Import Session Cookies
                </h3>
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="text-gray-400 hover:text-black dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Target Account:
                </label>
                <select
                  value={cookieAccount}
                  onChange={(e) => setCookieAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-[#0d0d0d] dark:text-white outline-none"
                >
                  <option value="">Select an account…</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.alias}>
                      {acc.alias} ({acc.email || acc.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Cookies JSON:
                </label>
                <textarea
                  rows={6}
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  placeholder='[{"name": "__Secure-next-auth.session-token", "value": "..."}]'
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 font-mono text-xs text-[#0d0d0d] dark:text-white outline-none"
                />
              </div>

              {cookieError && <p className="text-xs text-red-500">{cookieError}</p>}
              {cookieSuccess && <p className="text-xs text-emerald-500 font-medium">{cookieSuccess}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportCookies}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  {isSubmitting ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
