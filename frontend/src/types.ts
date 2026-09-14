export interface ImageRequest {
  prompt: string;
  tweaked_prompt?: string | null;
  tweaked_prompt_2?: string | null;
  conversation_id?: string | null;
  aspect?: '1:1' | '3:4' | '16:9' | string | null;
  timeout_s?: number;
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
}

export interface GalleryResponse {
  items: GalleryItem[];
  next_cursor: string | null;
  total: number;
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
  };
}

export interface ChatThread {
  conversation_id: string;
  last_prompt: string;
  last_active: number;
  turns: number;
  title?: string;
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
}
