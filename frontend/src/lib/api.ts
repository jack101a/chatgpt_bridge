import {
  ImageRequest,
  ImageResult,
  GalleryResponse,
  GalleryTimeFilter,
  Account,
  Telemetry,
  ChatThread,
  StorageStatus,
  StorageSyncProgress,
  TelegramTestResult,
  VaultBackupsResponse,
  VaultBackupResult,
  VaultRestoreResult,
} from '../types';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = errorBody.error?.message || errorBody.detail || errorBody.message || res.statusText;
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Generations
  generateImage: (req: ImageRequest): Promise<ImageResult> =>
    fetchJson<ImageResult>('/image', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const res = await fetchJson<{ accounts?: Account[] } | Account[]>('/accounts');
    return Array.isArray(res) ? res : res.accounts || [];
  },

  switchAccount: (account: string): Promise<{ success: boolean; active_account: string }> =>
    fetchJson('/accounts/switch', {
      method: 'POST',
      body: JSON.stringify({ account }),
    }),

  importCookies: (account: string, cookies_json: string): Promise<{ success: boolean; cookies_imported: number }> =>
    fetchJson('/api/accounts/cookies', {
      method: 'POST',
      body: JSON.stringify({ account, cookies_json }),
    }),

  // Gallery
  getGallery: (params: {
    filter?: GalleryTimeFilter | string;
    limit?: number;
    cursor?: string | null;
    conversation_id?: string | null;
  }): Promise<GalleryResponse> => {
    const q = new URLSearchParams();
    if (params.filter) q.set('filter', params.filter);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.conversation_id) q.set('conversation_id', params.conversation_id);
    return fetchJson<GalleryResponse>(`/api/gallery?${q.toString()}`);
  },

  toggleFavorite: (id: string): Promise<{ favorite: boolean }> =>
    fetchJson(`/api/gallery/${id}/favorite`, { method: 'POST' }),

  deleteImage: (id: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/gallery/${id}`, { method: 'DELETE' }),

  // Telemetry & Settings
  getTelemetry: (): Promise<Telemetry> => fetchJson<Telemetry>('/api/telemetry'),

  getSettings: (): Promise<Record<string, any>> => fetchJson('/api/settings'),

  patchSettings: (settings: Record<string, any>): Promise<Record<string, any>> =>
    fetchJson('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),

  // State Persistence
  getState: (): Promise<Record<string, any>> => fetchJson('/api/state'),

  saveState: (state: Record<string, any>): Promise<Record<string, any>> =>
    fetchJson('/api/state', {
      method: 'POST',
      body: JSON.stringify(state),
    }),

  // Chats
  getChats: (): Promise<ChatThread[]> => fetchJson<ChatThread[]>('/api/chats'),

  deleteChat: (conversation_id: string): Promise<{ success: boolean }> =>
    fetchJson(`/conversations/${conversation_id}`, { method: 'DELETE' }),

  // Storage & Telegram Cloud Vault
  getStorageStatus: (): Promise<StorageStatus> => fetchJson<StorageStatus>('/api/storage/status'),

  testTelegram: (data?: { bot_token?: string; channel_id?: string }): Promise<TelegramTestResult> =>
    fetchJson<TelegramTestResult>('/api/storage/test', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  startStorageSync: (): Promise<{ ok: boolean; message: string }> =>
    fetchJson<{ ok: boolean; message: string }>('/api/storage/sync', { method: 'POST' }),

  getStorageSyncStatus: (): Promise<StorageSyncProgress> =>
    fetchJson<StorageSyncProgress>('/api/storage/sync/status'),

  getVaultBackups: (): Promise<VaultBackupsResponse> =>
    fetchJson<VaultBackupsResponse>('/api/storage/backups'),

  triggerVaultBackup: (): Promise<VaultBackupResult> =>
    fetchJson<VaultBackupResult>('/api/storage/backup', { method: 'POST' }),

  triggerVaultRestore: (): Promise<VaultRestoreResult> =>
    fetchJson<VaultRestoreResult>('/api/storage/restore', { method: 'POST' }),

  getStorageTopics: (): Promise<{ ok: boolean; topics: { data: number; general: number; backup: number } }> =>
    fetchJson('/api/storage/topics'),

  regenerateThumbnails: (): Promise<{ ok: boolean; regenerated: number; message: string }> =>
    fetchJson('/api/storage/thumbnails/regenerate', { method: 'POST' }),
};

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // fallback below
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
