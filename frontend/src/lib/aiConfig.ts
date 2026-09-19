import { AIProviderConfig } from '../types';

export interface ProviderModelItem {
  id: string;
  label: string;
  group: 'custom' | 'discovered' | 'default';
}

export const FALLBACK_PROVIDER_PRESETS: Record<string, { name: string; default_models: string[] }> = {
  gemini: {
    name: 'Google Gemini',
    default_models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ],
  },
  nim: {
    name: 'NVIDIA NIM',
    default_models: [
      'nvidia/nemotron-3-super-120b-a12b',
      'meta/llama-3.3-70b-instruct',
      'mistralai/mistral-large-2-instruct',
    ],
  },
  openai: {
    name: 'OpenAI',
    default_models: [
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o1',
      'o1-mini',
      'gpt-4-turbo',
    ],
  },
  groq: {
    name: 'Groq Cloud',
    default_models: [
      'llama-3.3-70b-versatile',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    default_models: [
      'anthropic/claude-3-7-sonnet',
      'anthropic/claude-3-5-sonnet',
      'anthropic/claude-3-5-haiku',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    default_models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  ollama: {
    name: 'Ollama (Local)',
    default_models: [
      'llama3',
      'llama3.2',
      'mistral',
      'qwen2.5',
    ],
  },
};

/**
 * Returns deduplicated, grouped list of models for a given provider:
 * 1. Custom models added by user
 * 2. Live discovered models from endpoint
 * 3. Default preset models
 */
export function getProviderModelList(
  providerId: string,
  providers: Record<string, AIProviderConfig>,
  defaultProvidersList?: Array<{ id: string; default_models?: string[] }>
): ProviderModelItem[] {
  const p = providers[providerId];
  const discovered = p?.discovered_models || [];
  const custom = p?.custom_models || [];
  const defaults = p?.default_models || [];

  const seen = new Set<string>();
  const models: ProviderModelItem[] = [];

  // 1. User Custom Models
  for (const m of custom) {
    const trimmed = m.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      models.push({ id: trimmed, label: `${trimmed} (Custom)`, group: 'custom' });
    }
  }

  // 2. Discovered Endpoint Models
  for (const m of discovered) {
    const trimmed = m.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      models.push({ id: trimmed, label: trimmed, group: 'discovered' });
    }
  }

  // 3. Defaults from defaultProvidersList or local fallback
  const defEntry = defaultProvidersList?.find((dp) => dp.id === providerId);
  const defModels = defEntry?.default_models || [];
  const fallbackModels = FALLBACK_PROVIDER_PRESETS[providerId]?.default_models || [];

  for (const m of [...defaults, ...defModels, ...fallbackModels]) {
    const trimmed = m.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      models.push({ id: trimmed, label: trimmed, group: 'default' });
    }
  }

  return models;
}
