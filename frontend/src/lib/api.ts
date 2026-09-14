import {
  ImageRequest,
  ImageResult,
  GalleryResponse,
  Account,
  Telemetry,
  ChatThread,
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
    throw new Error(errorBody.detail || errorBody.message || res.statusText);
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
    filter?: 'all' | 'today' | 'favorites';
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

  // Chats
  getChats: (): Promise<ChatThread[]> => fetchJson<ChatThread[]>('/api/chats'),

  deleteChat: (conversation_id: string): Promise<{ success: boolean }> =>
    fetchJson(`/conversations/${conversation_id}`, { method: 'DELETE' }),
};
