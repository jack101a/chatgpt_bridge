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
  Plus,
  Trash2,
  Sliders,
  Globe,
} from 'lucide-react';
import {
  Account,
  Telemetry,
  StorageStatus,
  StorageSyncProgress,
  TelegramTestResult,
  VaultBackupsResponse,
  LLMTestResult,
  AIProviderConfig,
  AIAssignments,
} from '../../types';
import { api } from '../../lib/api';

interface LLMProviderPreset {
  id: string;
  name: string;
  badge?: string;
  isPopular?: boolean;
  base_url: string;
  defaultModel: string;
  defaultEnhancerModel?: string;
  models: { id: string; label: string }[];
  keyPlaceholder?: string;
  hint?: string;
}

const LLM_PROVIDER_PRESETS: LLMProviderPreset[] = [
  {
    id: 'gemini',
    name: '✦ Google Gemini (Free API)',
    isPopular: true,
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.5-flash',
    defaultEnhancerModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Fast & Smart - Recommended)' },
      { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Deep Directorial Reasoning)' },
      { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
      { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (Ultra Fast Enhancer)' },
      { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
      { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
      { id: 'gemini-1.0-pro', label: 'gemini-1.0-pro' },
    ],
    keyPlaceholder: 'AIzaSy... (Free key from aistudio.google.com)',
    hint: 'Google AI Studio provides free API keys with generous free-tier limits. All Gemini models supported.',
  },
  {
    id: 'nim',
    name: '✦ NVIDIA NIM (120B)',
    isPopular: true,
    base_url: 'http://nim.ajaxhs.home/v1',
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b',
    defaultEnhancerModel: 'meta/llama-3.1-70b-instruct',
    models: [
      { id: 'nvidia/nemotron-3-super-120b-a12b', label: 'nvidia/nemotron-3-super-120b-a12b' },
      { id: 'meta/llama-3.1-70b-instruct', label: 'meta/llama-3.1-70b-instruct' },
      { id: 'mistralai/mixtral-8x22b-instruct-v0.1', label: 'mistralai/mixtral-8x22b-instruct-v0.1' },
    ],
    keyPlaceholder: 'nim-... (or leave blank if on LAN)',
    hint: 'Local / LAN high-throughput Nemotron-3 120B cluster.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    defaultEnhancerModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o', label: 'gpt-4o (Omni Flagship)' },
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini (Fast & Efficient)' },
      { id: 'o3-mini', label: 'o3-mini (High-Speed Reasoning)' },
      { id: 'o1', label: 'o1 (Deep Reasoning)' },
      { id: 'o1-mini', label: 'o1-mini' },
      { id: 'gpt-4-turbo', label: 'gpt-4-turbo' },
      { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
    ],
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3-5-sonnet',
    defaultEnhancerModel: 'google/gemini-2.5-flash',
    models: [
      { id: 'anthropic/claude-3-5-sonnet', label: 'anthropic/claude-3-5-sonnet' },
      { id: 'anthropic/claude-3-5-haiku', label: 'anthropic/claude-3-5-haiku' },
      { id: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash' },
      { id: 'google/gemini-2.5-pro', label: 'google/gemini-2.5-pro' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'meta-llama/llama-3.3-70b-instruct' },
      { id: 'deepseek/deepseek-chat', label: 'deepseek/deepseek-chat' },
      { id: 'openai/gpt-4o', label: 'openai/gpt-4o' },
      { id: 'openai/gpt-4o-mini', label: 'openai/gpt-4o-mini' },
    ],
    keyPlaceholder: 'sk-or-...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultEnhancerModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'deepseek-chat (V3)' },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner (R1)' },
    ],
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'groq',
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultEnhancerModel: 'llama3-8b-8192',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
      { id: 'llama3-70b-8192', label: 'llama3-70b-8192' },
      { id: 'llama3-8b-8192', label: 'llama3-8b-8192 (Ultra Fast)' },
      { id: 'mixtral-8x7b-32768', label: 'mixtral-8x7b-32768' },
    ],
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    base_url: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    defaultEnhancerModel: 'llama3.2',
    models: [
      { id: 'llama3', label: 'llama3' },
      { id: 'llama3.2', label: 'llama3.2' },
      { id: 'mistral', label: 'mistral' },
      { id: 'qwen2.5', label: 'qwen2.5' },
      { id: 'phi3', label: 'phi3' },
    ],
    keyPlaceholder: 'ollama (optional)',
  },
];

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

  // AI Multi-Provider & Role Assignments States
  const [aiProviders, setAiProviders] = useState<Record<string, AIProviderConfig>>({});
  const [aiAssignments, setAiAssignments] = useState<AIAssignments>({
    director: { provider_id: 'gemini', model: 'gemini-2.5-pro' },
    enhancer: { provider_id: 'gemini', model: 'gemini-2.5-flash' },
  });
  const [defaultProvidersList, setDefaultProvidersList] = useState<any[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>('gemini');
  const [showActiveProviderKey, setShowActiveProviderKey] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [assignmentSaveMsg, setAssignmentSaveMsg] = useState<string | null>(null);
  const [providerSaveMsg, setProviderSaveMsg] = useState<string | null>(null);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<LLMTestResult | null>(null);
  const [isAddingProviderModel, setIsAddingProviderModel] = useState(false);
  const [newProviderModelInput, setNewProviderModelInput] = useState('');
  const [isCustomDirectorModel, setIsCustomDirectorModel] = useState(false);
  const [isCustomEnhancerModel, setIsCustomEnhancerModel] = useState(false);
  const [customDirectorInput, setCustomDirectorInput] = useState('');
  const [customEnhancerInput, setCustomEnhancerInput] = useState('');
  const [showAddCustomProvider, setShowAddCustomProvider] = useState(false);
  const [customProviderIdInput, setCustomProviderIdInput] = useState('');
  const [customProviderNameInput, setCustomProviderNameInput] = useState('');
  const [customProviderBaseUrlInput, setCustomProviderBaseUrlInput] = useState('');
  const [customProviderApiKeyInput, setCustomProviderApiKeyInput] = useState('');

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

  const notifyAIConfigUpdated = useCallback((assignments?: AIAssignments) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bridge:ai-config-updated', { detail: { assignments } }));
    }
  }, []);

  const handleClose = useCallback(() => {
    notifyAIConfigUpdated();
    onClose();
  }, [notifyAIConfigUpdated, onClose]);

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
      handleClose();
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

  // Fetch settings, storage status, and AI multi-provider config when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    fetchStorage();
    fetchBackups();
    api.getSettings().then((s) => {
      if (s.telegram_bot_token) setTgToken(s.telegram_bot_token);
      if (s.telegram_channel_id) setTgChannel(s.telegram_channel_id);
    }).catch(() => {});
    
    api.getAIConfig().then((cfg) => {
      if (cfg && cfg.ok) {
        if (cfg.providers) {
          setAiProviders(cfg.providers);
          const pids = Object.keys(cfg.providers);
          if (pids.length > 0) {
            setActiveProviderId((prev) => (pids.includes(prev) ? prev : pids[0]));
          }
        }
        if (cfg.assignments) {
          setAiAssignments(cfg.assignments);
          setCustomDirectorInput(cfg.assignments.director?.model || '');
          setCustomEnhancerInput(cfg.assignments.enhancer?.model || '');
        }
        if (cfg.default_providers) {
          setDefaultProvidersList(cfg.default_providers);
        }
      }
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
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

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

  const getProviderModelList = useCallback(
    (providerId: string) => {
      const p = aiProviders[providerId];
      if (!p) return [];
      const discovered = p.discovered_models || [];
      const custom = p.custom_models || [];
      const defaults = p.default_models || [];
      const preset = LLM_PROVIDER_PRESETS.find((pr) => pr.id === providerId);
      const presetModels = preset?.models.map((m) => m.id) || [];

      const seen = new Set<string>();
      const models: { id: string; label: string; group: 'custom' | 'discovered' | 'default' }[] = [];

      const defEntry = defaultProvidersList.find((dp) => dp.id === providerId);
      const defModels = defEntry?.default_models || [];

      for (const m of custom) {
        if (!seen.has(m)) {
          seen.add(m);
          models.push({ id: m, label: `${m} (Custom)`, group: 'custom' });
        }
      }
      for (const m of discovered) {
        if (!seen.has(m)) {
          seen.add(m);
          models.push({ id: m, label: m, group: 'discovered' });
        }
      }
      for (const m of [...defaults, ...defModels, ...presetModels]) {
        if (!seen.has(m)) {
          seen.add(m);
          models.push({ id: m, label: m, group: 'default' });
        }
      }
      return models;
    },
    [aiProviders, defaultProvidersList]
  );

  const handleUpdateAssignment = async (
    role: 'director' | 'enhancer',
    providerId: string,
    model: string
  ) => {
    const next: AIAssignments = {
      ...aiAssignments,
      [role]: { provider_id: providerId, model: model.trim() },
    };
    setAiAssignments(next);
    try {
      setAssignmentSaveMsg(null);
      await api.saveAIAssignments(next);
      notifyAIConfigUpdated(next);
      setAssignmentSaveMsg(`Updated ${role === 'director' ? 'Director Mode' : 'Enhancer'} to ${model}!`);
      setTimeout(() => setAssignmentSaveMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save assignment: ${err.message}`);
    }
  };

  const handleSaveAllAssignments = async () => {
    setIsSavingAssignments(true);
    try {
      setAssignmentSaveMsg(null);
      await api.saveAIAssignments(aiAssignments);
      notifyAIConfigUpdated(aiAssignments);
      setAssignmentSaveMsg('AI work assignments saved successfully!');
      setTimeout(() => setAssignmentSaveMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save assignments: ${err.message}`);
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setIsTestingProvider(true);
    setProviderTestResult(null);
    try {
      const p = aiProviders[providerId];
      const res = await api.testAIProvider(providerId, {
        base_url: p?.base_url,
        api_key: p?.api_key,
      });
      setProviderTestResult(res);
      if (res.ok && res.models && res.models.length > 0) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            discovered_models: res.models,
          },
        }));
        notifyAIConfigUpdated();
      }
    } catch (err: any) {
      setProviderTestResult({ ok: false, message: err.message });
    } finally {
      setIsTestingProvider(false);
    }
  };

  const handleSaveProviderConfig = async (providerId: string) => {
    const p = aiProviders[providerId];
    if (!p) return;
    try {
      setProviderSaveMsg(null);
      const res = await api.saveAIProvider(providerId, {
        name: p.name,
        base_url: p.base_url,
        api_key: p.api_key,
        enabled: p.enabled ?? true,
        custom_models: p.custom_models || [],
      });
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: res.provider,
        }));
        notifyAIConfigUpdated();
        setProviderSaveMsg(`Saved ${p.name} settings!`);
        setTimeout(() => setProviderSaveMsg(null), 3000);
      }
    } catch (err: any) {
      alert(`Failed to save provider: ${err.message}`);
    }
  };

  const handleAddCustomModelToProvider = async (providerId: string) => {
    const target = newProviderModelInput.trim();
    if (!target) return;
    setIsAddingProviderModel(true);
    try {
      const res = await api.addAIProviderModel(providerId, target);
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            custom_models: res.custom_models,
          },
        }));
        notifyAIConfigUpdated();
        setNewProviderModelInput('');
      }
    } catch (err: any) {
      alert(`Failed to add custom model: ${err.message}`);
    } finally {
      setIsAddingProviderModel(false);
    }
  };

  const handleDeleteCustomModelFromProvider = async (providerId: string, model: string) => {
    try {
      const res = await api.deleteAIProviderModel(providerId, model);
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            custom_models: res.custom_models,
          },
        }));
        notifyAIConfigUpdated();
      }
    } catch (err: any) {
      alert(`Failed to delete custom model: ${err.message}`);
    }
  };

  const handleAddCustomProvider = async () => {
    const name = customProviderNameInput.trim();
    const baseUrl = customProviderBaseUrlInput.trim();
    if (!name || !baseUrl) {
      alert('Please enter provider name and base URL');
      return;
    }
    const pid =
      customProviderIdInput.trim() ||
      name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    try {
      const res = await api.saveAIProvider(pid, {
        name,
        base_url: baseUrl,
        api_key: customProviderApiKeyInput.trim(),
        enabled: true,
        custom_models: [],
        discovered_models: [],
      });
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [pid]: res.provider,
        }));
        notifyAIConfigUpdated();
        setActiveProviderId(pid);
        setShowAddCustomProvider(false);
        setCustomProviderNameInput('');
        setCustomProviderBaseUrlInput('');
        setCustomProviderApiKeyInput('');
        setCustomProviderIdInput('');
      }
    } catch (err: any) {
      alert(`Failed to add provider: ${err.message}`);
    }
  };

  const handleDeleteCustomProvider = async (providerId: string) => {
    if (!confirm(`Are you sure you want to remove ${aiProviders[providerId]?.name || providerId}?`)) return;
    try {
      const res = await api.deleteAIProvider(providerId);
      if (res.ok) {
        setAiProviders((prev) => {
          const next = { ...prev };
          delete next[providerId];
          return next;
        });
        setActiveProviderId('gemini');
      }
    } catch (err: any) {
      alert(`Failed to delete provider: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Slide-up Bottom Sheet (Mobile) / Center Card (Desktop) */}
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-card text-card-foreground rounded-t-3xl sm:rounded-3xl border border-border p-5 shadow-2xl z-10 animate-slide-up space-y-5 will-change-transform"
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
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 active:bg-muted-foreground/50 transition-colors" />
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
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Accounts & Engine
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your ChatGPT accounts and self-hosted engine settings.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Section: ChatGPT Accounts ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ChatGPT Accounts
            </h3>
            <span className="text-[11px] text-muted-foreground/70">Rotates on rate limit</span>
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
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-muted/40 border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
                        {acc.alias.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-foreground">
                            {acc.alias}
                          </p>
                          {acc.is_active && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">
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
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {acc.total_generations} gens
                        </span>
                      )}

                      {!acc.is_active && (
                        <button
                          onClick={() => handleSwitchAccount(acc.alias)}
                          className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-xs font-medium text-foreground active:scale-95 transition-all shadow-xs"
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
        <div className="space-y-3 pt-2 border-t border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Engine Settings
          </h3>

          {/* Auto-Switch Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
            <div>
              <p className="text-xs font-medium text-foreground">
                Auto-Switch on Rate Limit
              </p>
              <p className="text-[11px] text-muted-foreground">
                Automatically rotates to another standby account
              </p>
            </div>
            <button
              onClick={handleToggleAutoSwitch}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative focus:outline-none ${
                isAutoSwitchActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
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
          <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-500" />
                <p className="text-xs font-medium text-foreground">
                  Rotatable Chats Pool
                </p>
              </div>
              <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {currentMaxChats === 0 ? 'Unlimited' : `${currentMaxChats} chats`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
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
                      ? 'bg-foreground text-background shadow-xs font-semibold'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section: Telegram Cloud Vault & Storage Quota ── */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cloud size={14} className="text-sky-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Telegram Cloud Vault & Storage
                </h3>
              </div>
              {isLoadingStorage && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            </div>

            {/* Storage Meter & Quota Bar */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HardDrive size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-foreground">
                    Local Cache Quota
                  </p>
                </div>
                <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {storageStatus?.cache_used_mb ?? 0} MB / {currentQuota === 0 ? 'Unlimited' : `${currentQuota} MB`}
                </span>
              </div>

              {/* Quota Progress Meter */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex border border-border/40">
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
                <div className="px-2 py-1.5 rounded-lg bg-card border border-border">
                  <div className="text-muted-foreground uppercase text-[9px]">Thumbnails</div>
                  <div className="text-foreground font-semibold">{storageStatus?.thumbnail_used_mb ?? 0} MB</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-card border border-border">
                  <div className="text-muted-foreground uppercase text-[9px]">Local Full-Res</div>
                  <div className="text-foreground font-semibold">{storageStatus?.local_full_count ?? 0} imgs</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-card border border-border">
                  <div className="text-muted-foreground uppercase text-[9px]">Cloud Backed</div>
                  <div className="text-sky-600 dark:text-sky-400 font-semibold">{storageStatus?.cloud_backed_count ?? 0} imgs</div>
                </div>
                <div className="px-2 py-1.5 rounded-lg bg-card border border-border">
                  <div className="text-muted-foreground uppercase text-[9px]">Evicted to Cloud</div>
                  <div className="text-amber-600 dark:text-amber-400 font-semibold">{storageStatus?.evicted_count ?? 0} imgs</div>
                </div>
              </div>

              {/* Quota Selection Pills */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-muted-foreground">
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
                          ? 'bg-foreground text-background shadow-xs font-semibold'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Telegram Cloud Vault Configuration Card */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Cloud size={14} className="text-sky-500" />
                    <span>Telegram Backup Vault</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Stores uncompressed original PNGs in your private Telegram channel
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTelegram}
                  className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative focus:outline-none ${
                    isTgEnabled ? 'bg-sky-500' : 'bg-muted-foreground/30'
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
                <div className="space-y-3 pt-2 border-t border-border animate-in fade-in duration-200">
                  {/* Bot Token Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground flex items-center justify-between">
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
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border font-mono text-xs text-foreground outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>

                  {/* Channel / Chat ID Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">
                      Channel / Group ID
                    </label>
                    <input
                      type="text"
                      value={tgChannel}
                      onChange={(e) => setTgChannel(e.target.value)}
                      placeholder="@my_vault_channel or -1001234567890"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border font-mono text-xs text-foreground outline-none focus:border-sky-500 transition-colors"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      💡 Create a private channel, add your bot as Admin with "Post Messages" permission.
                    </p>
                  </div>

                  {/* Test Connection & Save Row */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestTelegramConnection}
                      disabled={isTestingTg || !tgToken.trim() || !tgChannel.trim()}
                      className="flex-1 py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
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
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
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
                  <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-sky-500" />
                        <p className="text-xs font-semibold text-foreground">
                          Forum Topics Routing
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium border border-sky-500/20">
                        Active Supergroup
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-foreground font-medium">
                          <span>📁 Data</span>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">#8</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          Full-res uncompressed PNG file documents
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-foreground font-medium">
                          <span>🖼️ General</span>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">#1</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          Pure visual photo viewer at max resolution
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center justify-between text-foreground font-medium">
                          <span>📦 Backup</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">#5</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          Daily snapshots, 7-day FIFO auto-rotation
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sync Existing Images & Thumbnails Action */}
                  <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          Sync & Gallery Rendering
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Uploads unbacked images and upgrades thumbnails to crisp 720p HD
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleRegenerateThumbnails}
                          disabled={isRegeneratingThumbs}
                          className="px-2.5 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground text-xs font-medium flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50 border border-border"
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
                          className="px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-medium flex items-center gap-1.5 hover:bg-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
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
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                          <span>
                            {syncStatus.running ? `Progress: ${syncStatus.current} / ${syncStatus.total}` : 'Sync Complete!'}
                          </span>
                          <span>
                            Uploaded: {syncStatus.uploaded} · Thumbs: {syncStatus.thumbnails} · Evicted: {syncStatus.evicted}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/30">
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
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Pin size={12} className="text-emerald-500" />
                          <p className="text-xs font-semibold text-foreground">
                            Daily Manifest & Disaster Recovery
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Immutable catalog snapshot with triple identifiers (<span className="font-mono text-[9px]">tg_file_id</span>, <span className="font-mono text-[9px]">filename</span>, <span className="font-mono text-[9px]">md5</span>). Backed up daily & auto-rotates the last 7 snapshots.
                        </p>
                      </div>
                    </div>

                    {/* Snapshot Status Banner */}
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] flex items-center justify-between text-emerald-800 dark:text-emerald-300">
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
                        className="flex-1 py-1.5 px-3 rounded-lg bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
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
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
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

          {/* ── Section: AI Model Assignments & Providers ── */}
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Model Assignments & Providers
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 truncate max-w-[120px]" title={`Director: ${aiAssignments.director?.model || 'gpt-4o'}`}>
                  🎬 {(aiAssignments.director?.model || 'gpt-4o').split('/').pop()}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 truncate max-w-[120px]" title={`Enhancer: ${aiAssignments.enhancer?.model || 'gemini-2.5-flash'}`}>
                  ✨ {(aiAssignments.enhancer?.model || 'gemini-2.5-flash').split('/').pop()}
                </span>
              </div>
            </div>

            {/* 🎯 Card 1: Work Assignment (Director Mode & Chatbox Enhancer) */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sliders size={13} className="text-emerald-500" />
                    <span>🎯 Active Work Assignments</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Assign any model under any provider independently to Director Mode or Chatbox Enhancer.
                  </p>
                </div>
              </div>

              {/* Grid of Assignments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 🎬 Director Mode Assignment */}
                <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <span>🎬 Director Mode</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomDirectorModel(!isCustomDirectorModel)}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {isCustomDirectorModel ? 'Select list' : 'Custom'}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Drives storyboards, shot pacing, and Turn 0/1 contracts.
                  </p>

                  {/* Provider Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Provider</label>
                    <select
                      value={aiAssignments.director?.provider_id || 'gemini'}
                      onChange={(e) => {
                        const newPid = e.target.value;
                        const models = getProviderModelList(newPid);
                        const fallbackModel = models[0]?.id || 'gemini-2.5-pro';
                        handleUpdateAssignment('director', newPid, fallbackModel);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-emerald-500 transition-colors"
                    >
                      {Object.entries(aiProviders).map(([pid, p]) => (
                        <option key={`dir-prov-${pid}`} value={pid}>
                          {p.name} {p.has_key ? '●' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Assigned Model</label>
                    {isCustomDirectorModel ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customDirectorInput}
                          onChange={(e) => setCustomDirectorInput(e.target.value)}
                          onBlur={() => {
                            if (customDirectorInput.trim()) {
                              handleUpdateAssignment('director', aiAssignments.director?.provider_id || 'gemini', customDirectorInput.trim());
                            }
                          }}
                          placeholder="e.g. gemini-2.5-pro or gpt-4o"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <select
                        value={aiAssignments.director?.model || ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomDirectorModel(true);
                          } else {
                            handleUpdateAssignment('director', aiAssignments.director?.provider_id || 'gemini', e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {getProviderModelList(aiAssignments.director?.provider_id || 'gemini').map((m) => (
                          <option key={`dir-m-${m.id}`} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                        {getProviderModelList(aiAssignments.director?.provider_id || 'gemini').length === 0 && (
                          <option value={aiAssignments.director?.model}>{aiAssignments.director?.model}</option>
                        )}
                        <option value="__custom__">✏️ Custom / Type manually...</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* ✨ Chatbox Enhancer Assignment */}
                <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <span>✨ Chatbox Enhancer</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomEnhancerModel(!isCustomEnhancerModel)}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {isCustomEnhancerModel ? 'Select list' : 'Custom'}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    1-Click prompt polish, spicy euphemisms & visual DNA.
                  </p>

                  {/* Provider Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Provider</label>
                    <select
                      value={aiAssignments.enhancer?.provider_id || 'gemini'}
                      onChange={(e) => {
                        const newPid = e.target.value;
                        const models = getProviderModelList(newPid);
                        const fallbackModel = models[0]?.id || 'gemini-2.5-flash';
                        handleUpdateAssignment('enhancer', newPid, fallbackModel);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-emerald-500 transition-colors"
                    >
                      {Object.entries(aiProviders).map(([pid, p]) => (
                        <option key={`enh-prov-${pid}`} value={pid}>
                          {p.name} {p.has_key ? '●' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Assigned Model</label>
                    {isCustomEnhancerModel ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customEnhancerInput}
                          onChange={(e) => setCustomEnhancerInput(e.target.value)}
                          onBlur={() => {
                            if (customEnhancerInput.trim()) {
                              handleUpdateAssignment('enhancer', aiAssignments.enhancer?.provider_id || 'gemini', customEnhancerInput.trim());
                            }
                          }}
                          placeholder="e.g. gemini-2.5-flash or llama3-8b"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <select
                        value={aiAssignments.enhancer?.model || ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomEnhancerModel(true);
                          } else {
                            handleUpdateAssignment('enhancer', aiAssignments.enhancer?.provider_id || 'gemini', e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {getProviderModelList(aiAssignments.enhancer?.provider_id || 'gemini').map((m) => (
                          <option key={`enh-m-${m.id}`} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                        {getProviderModelList(aiAssignments.enhancer?.provider_id || 'gemini').length === 0 && (
                          <option value={aiAssignments.enhancer?.model}>{aiAssignments.enhancer?.model}</option>
                        )}
                        <option value="__custom__">✏️ Custom / Type manually...</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignment Feedback */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSaveAllAssignments}
                  disabled={isSavingAssignments}
                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs disabled:opacity-50"
                >
                  <Check size={12} />
                  <span>{isSavingAssignments ? 'Saving...' : 'Save Role Assignments'}</span>
                </button>
                {assignmentSaveMsg && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {assignmentSaveMsg}
                  </span>
                )}
              </div>
            </div>

            {/* 🔌 Card 2: Multi-Provider BYOK & Model Management */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Globe size={13} className="text-emerald-500" />
                    <span>🔌 Configured Providers (BYOK)</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Configure independent credentials, test endpoints, and add models per provider.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomProvider(!showAddCustomProvider)}
                  className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 transition-all active:scale-95"
                >
                  <Plus size={11} />
                  <span>Custom Provider</span>
                </button>
              </div>

              {/* Add Custom Provider Dialog */}
              {showAddCustomProvider && (
                <div className="p-3 rounded-xl bg-card border border-emerald-500/30 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Add Custom Endpoint</span>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomProvider(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customProviderNameInput}
                      onChange={(e) => setCustomProviderNameInput(e.target.value)}
                      placeholder="Provider Name (e.g. Local LM Studio)"
                      className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      value={customProviderBaseUrlInput}
                      onChange={(e) => setCustomProviderBaseUrlInput(e.target.value)}
                      placeholder="Base URL (e.g. http://localhost:1234/v1)"
                      className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={customProviderApiKeyInput}
                      onChange={(e) => setCustomProviderApiKeyInput(e.target.value)}
                      placeholder="API Key (optional if local)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomProvider}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold active:scale-95 transition-all"
                    >
                      Save Provider
                    </button>
                  </div>
                </div>
              )}

              {/* Provider Selection Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(aiProviders).map(([pid, p]) => {
                  const isSelected = activeProviderId === pid;
                  return (
                    <button
                      key={`tab-prov-${pid}`}
                      type="button"
                      onClick={() => {
                        setActiveProviderId(pid);
                        setProviderTestResult(null);
                        setProviderSaveMsg(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-semibold shadow-xs ring-2 ring-emerald-500/30'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.has_key ? (isSelected ? 'bg-emerald-200' : 'bg-emerald-500') : 'bg-muted-foreground/40'
                        }`}
                        title={p.has_key ? 'API Key configured' : 'No API Key set'}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Active Provider Details Card */}
              {aiProviders[activeProviderId] && (() => {
                const currentProv = aiProviders[activeProviderId];
                const isCustom = !['gemini', 'openai', 'groq', 'openrouter', 'deepseek', 'ollama'].includes(activeProviderId);
                const models = getProviderModelList(activeProviderId);
                const customModels = currentProv.custom_models || [];
                const discovered = currentProv.discovered_models || [];

                return (
                  <div className="p-3 rounded-xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{currentProv.name}</span>
                        {currentProv.has_key && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                            ● Key Saved
                          </span>
                        )}
                      </div>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomProvider(activeProviderId)}
                          className="text-[10px] text-red-500 hover:underline flex items-center gap-1"
                        >
                          <Trash2 size={11} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Base URL */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Endpoint Base URL</label>
                      <input
                        type="text"
                        value={currentProv.base_url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAiProviders((prev) => ({
                            ...prev,
                            [activeProviderId]: { ...prev[activeProviderId], base_url: val },
                          }));
                        }}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    {/* API Key */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                        <span>API Key</span>
                        <button
                          type="button"
                          onClick={() => setShowActiveProviderKey(!showActiveProviderKey)}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          {showActiveProviderKey ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showActiveProviderKey ? 'Hide' : 'Show'}</span>
                        </button>
                      </label>
                      <input
                        type={showActiveProviderKey ? 'text' : 'password'}
                        value={currentProv.api_key || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAiProviders((prev) => ({
                            ...prev,
                            [activeProviderId]: { ...prev[activeProviderId], api_key: val },
                          }));
                        }}
                        placeholder={currentProv.api_key_placeholder || 'Enter API Key...'}
                        className="w-full px-3 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    {/* Provider Hint */}
                    {currentProv.hint && (
                      <p className="text-[10.5px] text-muted-foreground leading-normal">
                        {currentProv.hint}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleTestProvider(activeProviderId)}
                        disabled={isTestingProvider || !currentProv.base_url}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-muted hover:bg-muted/80 border border-border text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isTestingProvider ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-emerald-500" />
                            <span>Testing & Fetching...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw size={12} className="text-emerald-500" />
                            <span>Fetch All Endpoint Models</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveProviderConfig(activeProviderId)}
                        className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                      >
                        <Check size={12} />
                        <span>Save Provider</span>
                      </button>
                    </div>

                    {/* Test Banner */}
                    {providerTestResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex flex-col gap-1 ${
                          providerTestResult.ok
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {providerTestResult.ok ? (
                            <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
                          ) : (
                            <AlertCircle size={14} className="flex-shrink-0 text-rose-500" />
                          )}
                          <span className="truncate">
                            {providerTestResult.message || (providerTestResult.ok ? 'Connected successfully!' : 'Connection failed')}
                          </span>
                        </div>
                        {providerTestResult.ok && (providerTestResult.models?.length || 0) > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-5">
                            ✦ {providerTestResult.models?.length} live models discovered on endpoint!
                          </p>
                        )}
                      </div>
                    )}

                    {providerSaveMsg && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {providerSaveMsg}
                      </p>
                    )}

                    {/* Models Area for this Provider */}
                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">
                          Models for {currentProv.name} ({models.length})
                        </span>
                        {discovered.length > 0 && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            {discovered.length} live from endpoint
                          </span>
                        )}
                      </div>

                      {/* Add Custom Model to this provider */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newProviderModelInput}
                          onChange={(e) => setNewProviderModelInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomModelToProvider(activeProviderId);
                            }
                          }}
                          placeholder={`Add specific model ID to ${currentProv.name}...`}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomModelToProvider(activeProviderId)}
                          disabled={!newProviderModelInput.trim() || isAddingProviderModel}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition-all active:scale-95 shrink-0"
                        >
                          <Plus size={12} />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Custom Models Chips */}
                      {customModels.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-medium">Custom User Models:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {customModels.map((m) => (
                              <div
                                key={`chip-${activeProviderId}-${m}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px] font-mono border border-border"
                              >
                                <span className="truncate max-w-[160px]">{m}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomModelFromProvider(activeProviderId, m)}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                  title={`Remove ${m}`}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Discovered Models Snippet */}
                      {discovered.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-medium">
                            Discovered Models ({discovered.length}):
                          </p>
                          <div className="max-h-24 overflow-y-auto p-1.5 rounded-lg bg-muted/30 border border-border/50 flex flex-wrap gap-1">
                            {discovered.map((m) => (
                              <span
                                key={`disc-${m}`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-card border border-border text-foreground truncate max-w-[180px]"
                                title={m}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2">
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
              <div>
                <p className="text-xs font-medium text-foreground">Appearance</p>
                <p className="text-[11px] text-muted-foreground">
                  {isDarkMode ? 'Dark theme active' : 'Light theme active'}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleDarkMode}
              className="px-3 py-1 rounded-full bg-card border border-border text-xs font-medium text-foreground active:scale-95 transition-all shadow-xs hover:bg-muted"
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Import Cookies Action */}
          <button
            onClick={() => setShowCookieModal(true)}
            className="w-full py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-xs font-medium text-foreground flex items-center justify-center gap-2 transition-all active:scale-98 border border-border/50"
          >
            <Key size={14} />
            Import cookies.json
          </button>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[11px]">
          <ShieldCheck size={14} className="flex-shrink-0" />
          <span>Your account data is stored securely on this local machine only.</span>
        </div>

        {/* Cookie Import Modal (Child) */}
        {showCookieModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl p-5 border border-border space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Import Session Cookies
                </h3>
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Target Account:
                </label>
                <select
                  value={cookieAccount}
                  onChange={(e) => setCookieAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:border-primary"
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
                <label className="text-xs font-medium text-foreground">
                  Cookies JSON:
                </label>
                <textarea
                  rows={6}
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  placeholder='[{"name": "__Secure-next-auth.session-token", "value": "..."}]'
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {cookieError && <p className="text-xs text-destructive">{cookieError}</p>}
              {cookieSuccess && <p className="text-xs text-emerald-500 font-medium">{cookieSuccess}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
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
