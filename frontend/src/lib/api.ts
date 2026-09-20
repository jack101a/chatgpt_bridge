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
  LLMConfig,
  LLMTestResult,
  AIProviderConfig,
  AIAssignments,
  AIConfigResponse,
  CharacterCard,
  StoryboardShot,
  StoryboardPlan,
  DirectorState,
  PromptLibraryData,
  PromptGalleryResponse,
  PromptTaxonomy,
  SlashCommand,
  FaceCardDictionaryResponse,
  BodyCardDictionaryResponse,
  CompilePromptResponse,
  RandomizeFaceResponse,
  RandomizeBodyResponse,
  FaceCardGenerateResponse,
  BodyCardGenerateResponse,
  DeltaPromptRequest,
  DeltaPromptResponse,
  ConversationContract,
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

  resetConversation: (): Promise<{ ok: boolean; message: string }> =>
    fetchJson('/conversations/new', { method: 'POST' }),

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

  // LLM Config
  getLLMConfig: (): Promise<LLMConfig> => fetchJson<LLMConfig>('/api/llm/config'),

  saveLLMConfig: (config: LLMConfig): Promise<{ ok: boolean }> =>
    fetchJson<{ ok: boolean }>('/api/llm/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getLLMModels: (params?: { base_url?: string; api_key?: string }): Promise<{ ok: boolean; models: string[]; custom_models?: string[]; message?: string }> => {
    const q = new URLSearchParams();
    if (params?.base_url) q.set('base_url', params.base_url);
    if (params?.api_key) q.set('api_key', params.api_key);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ ok: boolean; models: string[]; custom_models?: string[]; message?: string }>(`/api/llm/models${qs}`);
  },

  addCustomModel: (model: string): Promise<{ ok: boolean; custom_models: string[]; added: string }> =>
    fetchJson('/api/llm/custom-models', {
      method: 'POST',
      body: JSON.stringify({ model }),
    }),

  deleteCustomModel: (model: string): Promise<{ ok: boolean; custom_models: string[]; removed: string }> =>
    fetchJson(`/api/llm/custom-models/${encodeURIComponent(model)}`, {
      method: 'DELETE',
    }),

  testLLMConnection: (config?: LLMConfig): Promise<LLMTestResult> =>
    fetchJson<LLMTestResult>('/api/llm/test', {
      method: 'POST',
      body: JSON.stringify(config || {}),
    }),

  enhancePrompt: (payload: { prompt: string; model?: string; provider_id?: string }): Promise<{ ok: boolean; enhanced_prompt?: string; model_used?: string; provider_used?: string; error?: string }> =>
    fetchJson('/api/prompt/enhance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI Multi-Provider & Role Assignments
  getAIConfig: (): Promise<AIConfigResponse> => fetchJson<AIConfigResponse>('/api/ai/config'),

  saveAIProvider: (
    providerId: string,
    payload: Partial<AIProviderConfig>
  ): Promise<{ ok: boolean; provider: AIProviderConfig; providers: Record<string, AIProviderConfig> }> =>
    fetchJson(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAIProvider: (providerId: string): Promise<{ ok: boolean; removed: string }> =>
    fetchJson(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
      method: 'DELETE',
    }),

  testAIProvider: (
    providerId: string,
    payload?: Partial<AIProviderConfig>
  ): Promise<LLMTestResult & { models?: string[]; provider_id?: string }> =>
    fetchJson(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    }),

  addAIProviderModel: (
    providerId: string,
    model: string
  ): Promise<{ ok: boolean; provider_id: string; custom_models: string[]; added: string }> =>
    fetchJson(`/api/ai/providers/${encodeURIComponent(providerId)}/models`, {
      method: 'POST',
      body: JSON.stringify({ model }),
    }),

  deleteAIProviderModel: (
    providerId: string,
    model: string
  ): Promise<{ ok: boolean; provider_id: string; custom_models: string[]; removed: string }> =>
    fetchJson(`/api/ai/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(model)}`, {
      method: 'DELETE',
    }),

  saveAIAssignments: (
    assignments: AIAssignments
  ): Promise<{ ok: boolean; assignments: AIAssignments }> =>
    fetchJson('/api/ai/assignments', {
      method: 'POST',
      body: JSON.stringify(assignments),
    }),

  // Characters
  getCharacters: async (): Promise<CharacterCard[]> => {
    const res = await fetchJson<any>('/api/characters');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.characters)) {
      return res.characters.map((c: any) => ({
        ...c,
        is_locked: c.id === res.active_character_id || Boolean(c.is_locked),
      }));
    }
    return [];
  },
  
  saveCharacter: (char: Partial<CharacterCard>): Promise<CharacterCard> => {
    if (char.id) {
      return fetchJson<CharacterCard>(`/api/characters/${char.id}`, {
        method: 'PUT',
        body: JSON.stringify(char),
      });
    }
    return fetchJson<CharacterCard>('/api/characters', {
      method: 'POST',
      body: JSON.stringify(char),
    });
  },

  deleteCharacter: (id: string): Promise<{ ok: boolean; id: string }> =>
    fetchJson(`/api/characters/${id}`, {
      method: 'DELETE',
    }),
    
  lockCharacter: (id: string, locked?: boolean): Promise<{ ok: boolean; locked: boolean; character?: CharacterCard }> =>
    fetchJson(`/api/characters/${id}/lock`, {
      method: 'POST',
      body: locked !== undefined ? JSON.stringify({ locked }) : undefined,
    }),

  // Prompt Library & Curated Gallery
  getPromptLibrary: (): Promise<PromptLibraryData> => fetchJson<PromptLibraryData>('/api/prompt-library'),

  getPromptGallery: (params?: {
    category?: string;
    style?: string;
    scene?: string;
    source?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<PromptGalleryResponse> => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.style) qs.set('style', params.style);
    if (params?.scene) qs.set('scene', params.scene);
    if (params?.source) qs.set('source', params.source);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const query = qs.toString();
    return fetchJson<PromptGalleryResponse>(query ? `/api/prompt-gallery?${query}` : '/api/prompt-gallery');
  },

  getPromptTaxonomy: (): Promise<PromptTaxonomy> =>
    fetchJson<PromptTaxonomy>('/api/prompt-gallery/taxonomy'),

  getPromptSlashCommands: (): Promise<SlashCommand[]> =>
    fetchJson<SlashCommand[]>('/api/prompt-gallery/slash-commands'),

  addCustomChip: (text: string): Promise<{ id: string }> =>
    fetchJson<{ id: string }>('/api/prompt-library/custom', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  deleteCustomChip: (id: string): Promise<{ success: boolean }> =>
    fetchJson<{ success: boolean }>(`/api/prompt-library/custom/${id}`, {
      method: 'DELETE',
    }),

  // AI Director & Storyboard
  planStoryboard: (data: {
    intent: string;
    character_id?: string;
    shot_count: number;
    creative_guidance?: string;
    style_override?: string;
    model?: string;
    provider_id?: string;
  }): Promise<StoryboardPlan> =>
    fetchJson<StoryboardPlan>('/api/director/plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  executeStoryboard: (
    data:
      | {
          shots: StoryboardShot[];
          character_id?: string;
          conversation_id?: string;
          screenplay_handshake?: string;
        }
      | StoryboardShot[]
  ): Promise<{ ok: boolean; message: string }> => {
    const body = Array.isArray(data) ? { shots: data } : data;
    return fetchJson<{ ok: boolean; message: string }>('/api/director/execute', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  cancelDirectorSequence: (): Promise<{ ok: boolean; message: string }> =>
    fetchJson<{ ok: boolean; message: string }>('/api/director/cancel', {
      method: 'POST',
    }),

  getDirectorStatus: (): Promise<DirectorState> =>
    fetchJson<DirectorState>('/api/director/status'),

  updateCharacter: (id: string, updates: Partial<CharacterCard>): Promise<CharacterCard> =>
    fetchJson<CharacterCard>(`/api/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Reference Card Generator
  getFaceCardDictionary: (): Promise<FaceCardDictionaryResponse> =>
    fetchJson<FaceCardDictionaryResponse>('/api/cards/face/dictionary'),

  compileFaceCardPrompt: (data: Record<string, any>): Promise<CompilePromptResponse> =>
    fetchJson<CompilePromptResponse>('/api/cards/face/compile-prompt', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  randomizeFaceCard: (archetype?: string): Promise<RandomizeFaceResponse> =>
    fetchJson<RandomizeFaceResponse>('/api/cards/face/randomize', {
      method: 'POST',
      body: JSON.stringify({ archetype }),
    }),

  generateFaceCard: (data: Record<string, any>, conversation_id?: string, prompt?: string): Promise<FaceCardGenerateResponse> =>
    fetchJson<FaceCardGenerateResponse>('/api/cards/face/generate', {
      method: 'POST',
      body: JSON.stringify({ data, conversation_id, prompt }),
    }),

  // Body Identity Reference Card
  getBodyCardDictionary: (): Promise<BodyCardDictionaryResponse> =>
    fetchJson<BodyCardDictionaryResponse>('/api/cards/body/dictionary'),

  compileBodyCardPrompt: (data: Record<string, any>): Promise<CompilePromptResponse> =>
    fetchJson<CompilePromptResponse>('/api/cards/body/compile-prompt', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  randomizeBodyCard: (archetype?: string): Promise<RandomizeBodyResponse> =>
    fetchJson<RandomizeBodyResponse>('/api/cards/body/randomize', {
      method: 'POST',
      body: JSON.stringify({ archetype }),
    }),

  generateBodyCard: (data: Record<string, any>, conversation_id?: string, prompt?: string): Promise<BodyCardGenerateResponse> =>
    fetchJson<BodyCardGenerateResponse>('/api/cards/body/generate', {
      method: 'POST',
      body: JSON.stringify({ data, conversation_id, prompt }),
    }),

  generateExpressionCard: (data: Record<string, any>, conversation_id?: string, prompt?: string): Promise<any> =>
    fetchJson('/api/cards/expression/generate', {
      method: 'POST',
      body: JSON.stringify({ data, conversation_id, prompt }),
    }),

  // ── 3-Pillar Character Consistency & Delta Engine ──
  handshakeCharacter: (characterId: string, conversationId?: string): Promise<any> =>
    fetchJson(`/api/characters/${characterId}/handshake`, {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId || null }),
    }),

  compileDeltaPrompt: (payload: DeltaPromptRequest): Promise<DeltaPromptResponse> =>
    fetchJson<DeltaPromptResponse>('/api/characters/compile-delta', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getConversationContract: (conversationId: string): Promise<ConversationContract> =>
    fetchJson<ConversationContract>(`/api/conversations/${conversationId}/contract`),

  setConversationCharacter: (conversationId: string, characterId: string | null): Promise<any> =>
    fetchJson(`/api/conversations/${conversationId}/character`, {
      method: 'POST',
      body: JSON.stringify({ character_id: characterId }),
    }),

  getAllConversationContracts: (): Promise<{ ok: boolean; contracts: Record<string, any> }> =>
    fetchJson('/api/conversations/contracts'),
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
