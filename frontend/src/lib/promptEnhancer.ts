/**
 * promptEnhancer.ts
 * Real-time prompt safety analysis and 1-click enhancer engine for Composer.tsx
 * following the ChatGPT Images 2.5 / GPT-Image-2.5 architecture.
 * Source: knowledge-base/ & DESIGN.md
 */

import { EUPHEMISM_RULES, BUZZWORD_CLEANUP_RULES } from './knowledge/filterLexicon';
import { UNIVERSAL_INVERSIONS } from './knowledge/positiveInverter';

export interface PromptSafetyAnalysis {
  level: 'safe' | 'warning' | 'danger';
  triggers: string[];
  reason: string;
}

/**
 * Analyzes prompt text in memory (< 3ms).
 * - 'danger': Contains hard-banned words likely to cause immediate content policy rejection.
 * - 'warning': Contains soft-banned words or toxic buzzwords.
 * - 'safe': Clean prompt.
 */
export function analyzePromptSafety(text: string): PromptSafetyAnalysis {
  const trimmed = text.trim();
  if (!trimmed) {
    return { level: 'safe', triggers: [], reason: 'Empty prompt' };
  }

  const dangerTriggers: string[] = [];
  const warningTriggers: string[] = [];

  // Check euphemism rules
  for (const rule of EUPHEMISM_RULES) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(trimmed);
    if (match) {
      if (rule.severity === 'hard') {
        dangerTriggers.push(match[0]);
      } else {
        warningTriggers.push(match[0]);
      }
    }
  }

  // Check negative phrasing
  for (const inv of UNIVERSAL_INVERSIONS) {
    inv.pattern.lastIndex = 0;
    const match = inv.pattern.exec(trimmed);
    if (match) {
      warningTriggers.push(match[0]);
    }
  }

  // Check buzzwords
  for (const buzz of BUZZWORD_CLEANUP_RULES) {
    buzz.pattern.lastIndex = 0;
    const match = buzz.pattern.exec(trimmed);
    if (match) {
      warningTriggers.push(match[0]);
    }
  }

  if (dangerTriggers.length > 0) {
    return {
      level: 'danger',
      triggers: dangerTriggers,
      reason: `Filter Risk: "${dangerTriggers.slice(0, 3).join('", "')}" may trigger content policy refusal.`,
    };
  }

  if (warningTriggers.length > 0) {
    return {
      level: 'warning',
      triggers: warningTriggers,
      reason: `Notice: "${warningTriggers.slice(0, 3).join('", "')}" could be improved for better fidelity.`,
    };
  }

  return {
    level: 'safe',
    triggers: [],
    reason: 'Prompt looks clean and adheres to ChatGPT Images 2.5 best practices.',
  };
}

/**
 * 1-Click "Enhance / Make Safe" transformation (ChatGPT Images 2.5 Standard).
 * 1. Swaps hard & soft filter triggers with high-fashion/fine-art euphemisms.
 * 2. Inverts negative words ("no X") into positive scene assertions.
 * 3. Strips toxic buzzwords ("photorealistic", "8k", "ultra-detailed").
 * 4. Shapes bare prompts into a concise 2–3 sentence structure (~50–80 words)
 *    covering Subject/Action, Optical Framing, Lighting, and Radiant Realism.
 */
export function enhancePrompt(text: string): string {
  let result = text.trim();
  if (!result) return result;

  // 1. Swap euphemisms
  for (const rule of EUPHEMISM_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // 2. Invert negatives into positive assertions
  for (const inv of UNIVERSAL_INVERSIONS) {
    result = result.replace(inv.pattern, inv.positiveAssertion);
  }

  // 3. Strip toxic buzzwords
  for (const buzz of BUZZWORD_CLEANUP_RULES) {
    result = result.replace(buzz.pattern, buzz.fix);
  }

const REALISM_VARIANTS = [
  'Natural unretouched skin texture with delicate fine pores, authentic warmth, and lifelike photographic depth.',
  'Authentic optical clarity, realistic eye catchlights, and natural skin microtexture with gentle highlight rolloff.',
  'Lifelike human realism with natural facial pores and authentic physical presence, free of artificial airbrushing.',
  'Photographic depth of field, natural directional lighting, and realistic tactile textures across subject and wardrobe.',
];

  const lower = result.toLowerCase();
  const words = result.split(/\s+/).filter(Boolean);
  const isPerson = /\b(woman|man|girl|boy|person|portrait|face|skin|model|protagonist|character)\b/i.test(lower);
  const hasLens = /\b(\d+mm|lens|f\/\d|bokeh|close-up|portrait|angle|shot|framing|perspective|selfie|macro)\b/i.test(lower);
  const hasLighting = /\b(lighting|light|sunlight|golden hour|chiaroscuro|rembrandt|shadows|flash|daylight|illumination)\b/i.test(lower);

  // 4. Enrich short / bare concepts (< 25 words) dynamically into detailed natural language
  if (words.length < 25) {
    const base = result.replace(/[.,\s]+$/, '');
    if (isPerson) {
      const cameraPart = hasLens ? '' : 'natural eye-level framing';
      const lightPart = hasLighting ? '' : 'soft directional ambient daylight';
      const additions = [cameraPart, lightPart].filter(Boolean).join(' with ');
      const opticClause = additions ? `, ${additions}` : '';
      const realismVariant = REALISM_VARIANTS[words.length % REALISM_VARIANTS.length];
      result = `${base}${opticClause}. ${realismVariant}`;
    } else {
      const cameraPart = hasLens ? '' : 'clear photographic composition';
      const lightPart = hasLighting ? '' : 'balanced environmental lighting';
      const additions = [cameraPart, lightPart].filter(Boolean).join(' with ');
      result = `${base}${additions ? `, ${additions}` : ''}. Crisp optical depth, tactile textures, and authentic atmospheric realism.`;
    }
  }

  // Clean double spaces and punctuation
  result = result.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();
  return result;
}
