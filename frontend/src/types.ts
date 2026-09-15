export interface ImageRequest {
  prompt: string;
  tweaked_prompt?: string | null;
  tweaked_prompt_2?: string | null;
  conversation_id?: string | null;
  aspect?: '1:1' | '3:4' | '16:9' | string | null;
  timeout_s?: number;
  reference_image?: string | null;
}

export interface ClientState {
  currentTab: 'chat' | 'gallery' | 'generator' | 'settings';
  activeConvId?: string | null;
  viewerImageId?: string | null;
  lastUpdated?: number;
}

export interface ImageResult {
  path?: string;
  image_url: string;
  account_used: string;
  duration_s: number;
  size_bytes?: number;
  conversation_id: string;
  retries?: number;
}

export interface GalleryItem {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  prompt: string | null;
  tweaked_prompt: string | null;
  tweaked_prompt_2: string | null;
  conversation_id: string | null;
  account_used: string | null;
  created_at: number;
  size_bytes: number | null;
  md5: string | null;
  duration_s: number | null;
  favorite: boolean;
  tg_file_id?: string | null;
  tg_message_id?: number | null;
  is_local?: boolean;
}

export interface GalleryResponse {
  items: GalleryItem[];
  next_cursor: string | null;
  total: number;
}

export type GalleryTimeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'favorites';

export type GallerySortBy = 'newest' | 'oldest' | 'duration' | 'size' | 'retries';

export type GalleryGroupBy = 'all' | 'day' | 'week' | 'month' | 'year';

export type GalleryLayoutMode = 'grid' | 'feed';

export interface TimelineSection {
  key: string;
  label: string;
  items: GalleryItem[];
}

export interface Account {
  id: string;
  alias: string;
  email: string;
  is_active: boolean;
  is_authenticated: boolean;
  total_generations: number;
  consecutive_rate_limits: number;
  is_rate_limited: boolean;
  rate_limited_until: number | null;
  rate_limit_resets_at_str: string;
}

export interface Telemetry {
  status: string;
  uptime_s: number;
  total_images: number;
  active_account: string;
  browser_busy: boolean;
  settings?: {
    auto_switch: boolean;
    max_retries: number;
    max_chats?: number;
    telegram_storage_enabled?: boolean;
    telegram_bot_token?: string;
    telegram_channel_id?: string;
    storage_quota_mb?: number;
  };
}

export interface StorageSyncProgress {
  running: boolean;
  total: number;
  current: number;
  uploaded: number;
  thumbnails: number;
  evicted: number;
  error: string | null;
}

export interface StorageStatus {
  cache_used_bytes: number;
  cache_used_mb: number;
  thumbnail_used_bytes: number;
  thumbnail_used_mb: number;
  cache_limit_bytes: number;
  cache_limit_mb: number;
  percent_used: number;
  total_images: number;
  cloud_backed_count: number;
  local_full_count: number;
  evicted_count: number;
  is_unlimited: boolean;
  telegram_storage_enabled: boolean;
  telegram_channel_id: string;
  telegram_topic_data?: number;
  telegram_topic_general?: number;
  telegram_topic_backup?: number;
  has_credentials: boolean;
  sync_status: StorageSyncProgress;
}

export interface TelegramTestResult {
  ok: boolean;
  bot_username?: string;
  bot_id?: number;
  can_write?: boolean;
  error?: string | null;
}

export interface ChatThread {
  conversation_id: string;
  last_prompt: string;
  last_active: number;
  turns: number;
  title?: string;
  account_used?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'image';
  content: string;
  imageUrl?: string;
  account?: string;
  dur?: number;
  size?: number;
  conversation_id?: string;
  fav?: boolean;
  tweaked_prompt?: string | null;
  tweaked_prompt_2?: string | null;
  retries?: number;
  referenceImage?: string | null;
}

export interface VaultBackupItem {
  message_id: number;
  filename: string;
  date_str: string;
  total_images: number;
  timestamp: number;
}

export interface VaultBackupsResponse {
  total_backups: number;
  latest: VaultBackupItem | null;
  history: VaultBackupItem[];
}

export interface VaultBackupResult {
  ok: boolean;
  message_id: number;
  filename: string;
  date_str: string;
  total_images: number;
  favorites: number;
  pinned: boolean;
}

export interface VaultRestoreResult {
  ok: boolean;
  filename: string;
  restored_images: number;
  restored_favorites: number;
}

export interface LLMConfig {
  base_url: string;
  api_key: string;
  model: string;
}

export interface LLMTestResult {
  ok: boolean;
  message?: string;
}


export interface WardrobeItem {
  id: string;
  name: string;
  description: string;
}

export interface CharacterCard {
  id: string;
  name: string;
  tagline?: string;
  visual_dna: string;
  persona?: string;
  roleplay_instructions?: string;
  wardrobes?: WardrobeItem[];
  active_wardrobe_id?: string;
  avatar_image_id?: string;
  face_lock_image_id?: string;
  body_lock_image_id?: string;
  expression_lock_image_id?: string;
  character_lock?: Record<string, any>;
  is_locked?: boolean;
}

export interface DictionaryField {
  label: string;
  type: 'text' | 'single_select' | 'multi_select' | 'text_readonly';
  default: any;
  placeholder?: string;
  options?: string[];
}

export interface DictionaryCategory {
  title: string;
  fields: Record<string, DictionaryField>;
}

export interface FaceCardDictionaryResponse {
  ok: boolean;
  dictionary: Record<string, DictionaryCategory>;
  archetypes: Record<string, Record<string, any> & { label?: string }>;
}

export interface BodyCardDictionaryResponse {
  ok: boolean;
  dictionary: Record<string, DictionaryCategory>;
  archetypes: Record<string, Record<string, any> & { label?: string }>;
}

export interface CompilePromptResponse {
  ok: boolean;
  prompt: string;
  visual_dna: string;
}

export interface RandomizeFaceResponse {
  ok: boolean;
  data: Record<string, any>;
  prompt: string;
  visual_dna: string;
}

export interface RandomizeBodyResponse {
  ok: boolean;
  data: Record<string, any>;
  prompt: string;
  visual_dna: string;
}

export interface FaceCardGenerateResponse {
  ok: boolean;
  result: ImageResult;
  prompt: string;
  visual_dna: string;
  face_data: Record<string, any>;
}

export interface BodyCardGenerateResponse {
  ok: boolean;
  result: ImageResult;
  prompt: string;
  visual_dna: string;
  body_data: Record<string, any>;
}

export interface StoryboardShot {
  description: string;
  camera_pov: string;
  prompt: string;
}

export interface StoryboardPlan {
  shots: StoryboardShot[];
}

export interface PromptLibraryData {
  standard: Record<string, string[]>;
  custom: Array<{ id: string; text: string }>;
}
