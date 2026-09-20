export interface ImageRequest {
  prompt: string;
  tweaked_prompt?: string | null;
  tweaked_prompt_2?: string | null;
  conversation_id?: string | null;
  aspect?: '1:1' | '3:4' | '16:9' | string | null;
  timeout_s?: number;
  reference_image?: string | null;
  reference_images?: string[] | null;
  thinking?: boolean;
  mode?: 'image' | 'chat';
}

export interface AskRequest {
  prompt: string;
  model?: string | null;
  conversation_id?: string | null;
  thinking?: boolean;
}

export interface AskResponse {
  text: string;
  conversation_id: string;
  account_used: string;
  thinking?: boolean;
  switched_from?: string;
}

export interface AccountQuota {
  account_id: string;
  alias: string;
  email: string;
  plan_type: string;
  allowed: boolean;
  limit_reached: boolean;
  used_percent: number;
  left_percent: number;
  reset_after_seconds: number;
  reset_at: number | null;
  reset_at_str: string;
  limit_window_seconds: number;
  secondary_used_percent?: number | null;
  secondary_left_percent?: number | null;
  secondary_reset_at_str?: string | null;
  credits_balance?: string | number | null;
  has_credits: boolean;
  reset_credits_count: number;
  fetched_at: number;
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
  quota?: AccountQuota | null;
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
  thinking?: boolean;
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
  director_model?: string;
  enhancer_model?: string;
  custom_models?: string[];
  has_key?: boolean;
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
  llm_director_model?: string;
  llm_enhancer_model?: string;
}

export interface LLMTestResult {
  ok: boolean;
  message?: string;
  models?: string[];
  custom_models?: string[];
  error?: string;
  provider_id?: string;
  base_url?: string;
}

export interface AIProviderConfig {
  id?: string;
  name: string;
  base_url: string;
  api_key?: string;
  enabled?: boolean;
  has_key?: boolean;
  custom_models?: string[];
  discovered_models?: string[];
  default_models?: string[];
  hint?: string;
  is_popular?: boolean;
  api_key_placeholder?: string;
}

export interface AIAssignmentItem {
  provider_id: string;
  model: string;
}

export interface AIAssignments {
  director?: AIAssignmentItem;
  enhancer?: AIAssignmentItem;
}

export interface AIConfigResponse {
  ok: boolean;
  providers: Record<string, AIProviderConfig>;
  assignments: AIAssignments;
  default_providers: Array<{
    id: string;
    name: string;
    base_url: string;
    api_key_placeholder: string;
    default_model: string;
    is_popular: boolean;
    hint: string;
    default_models: string[];
  }>;
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
  style_anchor?: string;
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

export interface DeltaPromptRequest {
  character_id: string;
  scene: string;
  outfit?: string;
  pose?: string;
  expression?: string;
  camera?: string;
  lighting?: string;
  background?: string;
  style_override?: string;
}

export interface DeltaPromptResponse {
  character_id: string;
  character_name: string;
  compiled_prompt: string;
}

export interface ConversationContract {
  ok: boolean;
  conversation_id: string;
  character_id?: string | null;
  character_name?: string | null;
  primed: boolean;
  primed_at?: number;
  card_count?: number;
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
  screenplay_handshake?: string;
  shots: StoryboardShot[];
}

export interface PromptLibraryData {
  standard: Record<string, string[]>;
  custom: Array<{ id: string; text: string }>;
}

export interface PromptVariable {
  key: string;
  label: string;
  default: string;
}

export interface CuratedPrompt {
  id: number;
  title: string;
  imageAlt?: string;
  prompt: string;
  promptPreview: string;
  category: string;
  styles: string[];
  scenes: string[];
  source: 'freestylefly' | 'evolinkai' | string;
  sourceLabel?: string;
  sourceUrl?: string;
  thumbnail: string;
  full_image?: string;
  featured?: boolean;
  variables?: PromptVariable[];
}

export interface SlashCommand {
  command: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  default_subject: string;
  sample_prompt: string;
}

export interface PromptGalleryResponse {
  prompts: CuratedPrompt[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface TaxonomyCategory {
  id: string;
  value: string;
  title: string;
  title_zh?: string;
  icon: string;
  count: number;
  description?: string;
}

export interface TaxonomyTag {
  id: string;
  value: string;
  title: string;
  title_zh?: string;
  count: number;
  keywords?: string[];
}

export interface PromptTaxonomy {
  version: number;
  total_prompts: number;
  sources: Array<{ id: string; name: string; stars: number; count: number; url: string }>;
  categories: TaxonomyCategory[];
  styles: TaxonomyTag[];
  scenes: TaxonomyTag[];
  templates?: Array<{ id: string; name?: string; category?: string; tags?: string[] }>;
}

export interface DirectorState {
  is_running: boolean;
  cancel_requested: boolean;
  current_shot: number;
  total_shots: number;
  status: string;
  last_error?: string | null;
  conversation_id?: string | null;
}
