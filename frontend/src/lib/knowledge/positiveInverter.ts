/**
 * positiveInverter.ts
 * Converts negative constraints ("no X", "without Y") into positive optical assertions.
 * DALL-E 3 has no negative prompt slot; negative words trigger unwanted concepts.
 * Source: knowledge-base/techniques/negative-prompts.md
 */

export interface InversionRule {
  pattern: RegExp;
  positiveAssertion: string;
  category: 'focus' | 'style' | 'skin' | 'hands' | 'lighting' | 'wardrobe' | 'environment';
}

export const UNIVERSAL_INVERSIONS: InversionRule[] = [
  {
    pattern: /\b(no|without|avoid)\s+(blur|blurry|out\s+of\s+focus)\b/gi,
    positiveAssertion: 'crystal-clear tack-sharp focus across the subject, razor-sharp edge definition, crisp optical clarity',
    category: 'focus',
  },
  {
    pattern: /\b(not|no|without)\s+(a\s+)?(cartoon|anime|3d\s+render|cgi|illustration)\b/gi,
    positiveAssertion: 'authentic 35mm editorial photograph, candid documentary photojournalism, realistic human skin with organic flaws',
    category: 'style',
  },
  {
    pattern: /\b(no|without)\s+(tattoos?|ink|body\s+art)\b/gi,
    positiveAssertion: 'pristine, completely clear unadorned skin, porcelain smooth and unblemished skin surface',
    category: 'skin',
  },
  {
    pattern: /\b(no|without)\s+(bad\s+hands|extra\s+fingers|deformed\s+hands|mutated\s+hands)\b/gi,
    positiveAssertion: 'graceful hands resting naturally, exactly five clearly articulated slender fingers visible on each hand',
    category: 'hands',
  },
  {
    pattern: /\b(no|without)\s+(plastic\s+skin|wax\s+skin|airbrushing|waxy\s+sheen)\b/gi,
    positiveAssertion: 'natural unretouched skin texture, visible microscopic pores, delicate fine facial peach fuzz, matte skin finish',
    category: 'skin',
  },
  {
    pattern: /\b(no|without)\s+(glasses|spectacles|eyewear)\b/gi,
    positiveAssertion: 'open unadorned face, natural open gaze without accessories',
    category: 'wardrobe',
  },
  {
    pattern: /\b(no|without)\s+(jewelry|accessories)\b/gi,
    positiveAssertion: 'clean minimalist styling, unadorned neck and wrists',
    category: 'wardrobe',
  },
  {
    pattern: /\b(no|without)\s+(extra\s+clothes|heavy\s+jackets|heavy\s+clothing)\b/gi,
    positiveAssertion: 'minimalist lightweight breathable linen chemise with delicate thin straps, exposed shoulders',
    category: 'wardrobe',
  },
  {
    pattern: /\b(no|without)\s+(harsh\s+flash|flash\s+photography|harsh\s+shadows)\b/gi,
    positiveAssertion: 'diffused soft ambient window light, gentle wrap-around directional light with delicate shadow falloff',
    category: 'lighting',
  },
  {
    pattern: /\b(no|without)\s+(clutter|busy\s+background|distractions)\b/gi,
    positiveAssertion: 'smooth shallow depth of field with creamy background bokeh, isolated subject against clean architectural negative space',
    category: 'environment',
  },
  {
    pattern: /\b(no|without)\s+(watermarks?|signatures?|text|logos?)\b/gi,
    positiveAssertion: 'clean, pristine edge-to-edge photographic framing, uncluttered fine-art composition',
    category: 'environment',
  },
  {
    pattern: /\b(no|without)\s+(stiff\s+pose|mannequin\s+pose|ragdoll)\b/gi,
    positiveAssertion: 'fluid candid body language, organic physical weight distribution with realistic anatomical gravity',
    category: 'style',
  },
];

export function invertNegatives(text: string): { text: string; invertedCount: number } {
  let result = text;
  let count = 0;

  for (const rule of UNIVERSAL_INVERSIONS) {
    if (rule.pattern.test(result)) {
      result = result.replace(rule.pattern, rule.positiveAssertion);
      count++;
    }
  }

  return { text: result, invertedCount: count };
}
