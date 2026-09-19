/**
 * filterLexicon.ts
 * Curated dictionary of DALL-E 3 filter triggers, safe-spicy euphemisms,
 * and safe artist reference rules.
 * Source: knowledge-base/terminology/ & reference/artistic-styles.md
 */

export interface EuphemismRule {
  pattern: RegExp;
  category: 'anatomy' | 'clothing' | 'descriptor' | 'action';
  severity: 'hard' | 'soft';
  replacement: string;
  alternatives: string[];
}

export interface ArtistSubstitution {
  pattern: RegExp;
  targetArtist: string;
  replacement: string;
}

// ── 1. High-Risk Triggers & Safe-Spicy Euphemisms ─────────────────────────────
export const EUPHEMISM_RULES: EuphemismRule[] = [
  // Anatomy
  {
    pattern: /\b(big\s+breasts?|big\s+boobs?|large\s+breasts?|large\s+boobs?)\b/gi,
    category: 'anatomy',
    severity: 'hard',
    replacement: 'ample bust',
    alternatives: ['full bust', 'sculpted décolletage', 'classical feminine form', 'graceful upper silhouette'],
  },
  {
    pattern: /\b(breasts?|boobs?|tits?)\b/gi,
    category: 'anatomy',
    severity: 'hard',
    replacement: 'ample bust',
    alternatives: ['full bust', 'sculpted décolletage', 'classical feminine form', 'graceful upper silhouette'],
  },
  {
    pattern: /\b(cleavage)\b/gi,
    category: 'anatomy',
    severity: 'soft',
    replacement: 'plunging neckline, tasteful décolletage',
    alternatives: ['open collar', 'graceful scoop neckline', 'tasteful décolleté'],
  },
  {
    pattern: /\b(nipples?|areolas?)\b/gi,
    category: 'anatomy',
    severity: 'hard',
    replacement: 'draped fabric contour',
    alternatives: ['translucent fold', 'subtle shadow play'],
  },
  {
    pattern: /\b(butt|buttocks|ass)\b/gi,
    category: 'anatomy',
    severity: 'hard',
    replacement: 'curvaceous lower silhouette',
    alternatives: ['posterior curves', 'derrière', 'hourglass lower curves'],
  },
  {
    pattern: /\b(sexy\s+figure|hourglass\s+body|curvy\s+body|voluptuous)\b/gi,
    category: 'anatomy',
    severity: 'soft',
    replacement: 'statuesque hourglass silhouette with generous curves',
    alternatives: ['curvaceous feminine proportions', 'classical rubenesque form'],
  },

  // Clothing / State of Undress
  {
    pattern: /\b(nude|naked|in\s+the\s+buff)\b/gi,
    category: 'clothing',
    severity: 'hard',
    replacement: 'classical unclothed figure study',
    alternatives: ['artistic figure study', 'au naturel in fine art tradition', 'draped in diaphanous fabric'],
  },
  {
    pattern: /\b(topless)\b/gi,
    category: 'clothing',
    severity: 'hard',
    replacement: 'bare shoulders with draped silk',
    alternatives: ['unbuttoned linen lounge blouse', 'off-the-shoulder wrap'],
  },
  {
    pattern: /\b(lingerie|underwear|panties|thong|g-string)\b/gi,
    category: 'clothing',
    severity: 'hard',
    replacement: 'delicate silk boudoir attire',
    alternatives: ['intimate silk nightwear', 'flowing satin robe', 'vintage lace-trimmed slip dress'],
  },
  {
    pattern: /\b(see-through|transparent\s+clothes)\b/gi,
    category: 'clothing',
    severity: 'hard',
    replacement: 'diaphanous semi-opaque chiffon wrap',
    alternatives: ['gossamer layered fabric', 'translucent organza draping'],
  },
  {
    pattern: /\b(ripped\s+clothes|torn\s+clothes|clothes\s+get\s+ripped|clothes\s+ripped)\b/gi,
    category: 'clothing',
    severity: 'soft',
    replacement: 'dramatically tattered, shredded fabric draped across her form',
    alternatives: ['distressed boudoir attire', 'weathered, torn linen chemise'],
  },

  // Descriptors
  {
    pattern: /\b(sexy|hot|seductive|provocative)\b/gi,
    category: 'descriptor',
    severity: 'soft',
    replacement: 'alluring and captivating',
    alternatives: ['mesmerizing presence', 'statuesque elegance', 'magnetic gaze', 'enchanting allure'],
  },
  {
    pattern: /\b(erotic|lustful|horny|aroused|nsfw|xxx)\b/gi,
    category: 'descriptor',
    severity: 'hard',
    replacement: 'fine art classical intimacy',
    alternatives: ['evocative emotional depth', 'poetic fine-art aesthetic'],
  },

  // Combat & Action
  {
    pattern: /\b(blood|bloody|bleeding)\b/gi,
    category: 'action',
    severity: 'hard',
    replacement: 'crimson combat patina',
    alternatives: ['atmospheric red dust', 'weathered battle grime'],
  },
  {
    pattern: /\b(gore|gory|mutilated)\b/gi,
    category: 'action',
    severity: 'hard',
    replacement: 'splintered debris and atmospheric haze',
    alternatives: ['shattered stone and smoke'],
  },
  {
    pattern: /\b(kill|murder|slay|slaying)(\s+(the\s+)?(monster|adversary|beast))?\b/gi,
    category: 'action',
    severity: 'soft',
    replacement: 'vanquish the towering beast with decisive triumph',
    alternatives: ['overcome the adversary in a climactic duel', 'triumphantly neutralize the monster'],
  },
];

// ── 2. Pre-1912 Safe Masters (100% Permitted by OpenAI) ──────────────────────
export const PRE_1912_SAFE_MASTERS = [
  'Rembrandt',
  'Caravaggio',
  'Titian',
  'Peter Paul Rubens',
  'Johannes Vermeer',
  'Alphonse Mucha',
  'John William Waterhouse',
  'Claude Monet',
  'Edgar Degas',
  'Pierre-Auguste Renoir',
  'Francisco Goya',
  'J.M.W. Turner',
  'Vincent van Gogh',
  'Katsushika Hokusai',
  'Paul Cézanne',
  'Leonardo da Vinci',
  'Michelangelo',
] as const;

// ── 3. Post-1912 3-Adjective Movement Substitutions ──────────────────────────
export const ARTIST_SUBSTITUTIONS: ArtistSubstitution[] = [
  {
    pattern: /\b(greg\s+rutkowski)\b/gi,
    targetArtist: 'Greg Rutkowski',
    replacement: 'epic digital fantasy oil painting, dramatic volumetric chiaroscuro lighting, sweeping textured brushwork',
  },
  {
    pattern: /\b(edward\s+hopper)\b/gi,
    targetArtist: 'Edward Hopper',
    replacement: 'mid-century American realism, stark geometric sunlight, flat architectural shadows, solitary contemplative mood',
  },
  {
    pattern: /\b(moebius|jean\s+giraud)\b/gi,
    targetArtist: 'Moebius',
    replacement: 'ligne-claire sci-fi illustration, clean uniform ink contour lines, flat pastel palette, vast surreal architecture',
  },
  {
    pattern: /\b(syd\s+mead)\b/gi,
    targetArtist: 'Syd Mead',
    replacement: 'retro-futuristic industrial concept design, reflective chromatic gouache rendering, sharp aerodynamic perspective',
  },
  {
    pattern: /\b(frank\s+frazetta)\b/gi,
    targetArtist: 'Frank Frazetta',
    replacement: 'pulp fantasy oil painting, high-contrast dynamic rim lighting, thick energetic impasto brushstrokes, powerful anatomy',
  },
  {
    pattern: /\b(h\.?\s*r\.?\s*giger)\b/gi,
    targetArtist: 'H.R. Giger',
    replacement: 'biomechanical surrealist art, monochromatic obsidian and bone palette, ribbed skeletal organic textures',
  },
];

// ── 4. Banned DALL-E 3 Quality Buzzwords ─────────────────────────────────────
export const BUZZWORD_CLEANUP_RULES: Array<{ pattern: RegExp; fix: string }> = [
  { pattern: /\b(photorealistic|hyperrealistic|ultra-detailed)\b/gi, fix: '35mm photograph, natural optical depth' },
  { pattern: /\b(8k\s*uhd|8k\s*resolution|4k\s*resolution|octane\s*render)\b/gi, fix: 'high optical clarity' },
  { pattern: /\b(trending\s+on\s+artstation|masterpiece)\b/gi, fix: 'careful fine art composition' },
];
