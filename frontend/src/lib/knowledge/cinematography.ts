/**
 * cinematography.ts
 * Cinematography & photographic physics reference for DALL-E 3.
 * Source: knowledge-base/reference/lighting-camera-composition.md
 */

export interface CineOption {
  id: string;
  label: string;
  promptDescription: string;
  category: 'lighting' | 'lens' | 'shot' | 'angle';
}

export const LIGHTING_PRESETS: CineOption[] = [
  {
    id: 'rembrandt',
    label: 'Rembrandt',
    promptDescription: 'Rembrandt lighting with a soft triangular highlight on the shadowed cheek and gentle shadow falloff',
    category: 'lighting',
  },
  {
    id: 'chiaroscuro',
    label: 'Chiaroscuro',
    promptDescription: 'dramatic chiaroscuro lighting with deep tonal contrast between illuminated features and shadowy background',
    category: 'lighting',
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    promptDescription: 'warm golden hour backlight with soft long shadows, warm amber highlights, and radiant atmospheric glow',
    category: 'lighting',
  },
  {
    id: 'rim',
    label: 'Rim Light',
    promptDescription: 'crisp rim lighting contouring the subject silhouette, separating the figure cleanly from the dark background',
    category: 'lighting',
  },
  {
    id: 'film_noir',
    label: 'Film Noir',
    promptDescription: 'high-contrast noir lighting with moody shadow patterns and deep monochromatic tones',
    category: 'lighting',
  },
  {
    id: 'window_light',
    label: 'Soft Window',
    promptDescription: 'soft directional north-facing window light diffusing gently across the subject with subtle gradation',
    category: 'lighting',
  },
];

export const LENS_PRESETS: CineOption[] = [
  {
    id: '85mm_portrait',
    label: '85mm Portrait',
    promptDescription: 'shot on an 85mm prime portrait lens at f/1.4 for natural facial compression and creamy background bokeh',
    category: 'lens',
  },
  {
    id: '50mm_natural',
    label: '50mm Natural',
    promptDescription: 'shot on a 50mm f/1.8 lens capturing authentic human eye perspective with gentle depth separation',
    category: 'lens',
  },
  {
    id: '35mm_candid',
    label: '35mm Candid',
    promptDescription: 'shot on a 35mm lens with subtle environmental perspective and authentic documentary framing',
    category: 'lens',
  },
];

export const SHOT_PRESETS: CineOption[] = [
  {
    id: 'medium_closeup',
    label: 'Medium Close-up',
    promptDescription: 'a medium close-up bust shot framing chest and shoulders up, focusing on facial emotion and gaze',
    category: 'shot',
  },
  {
    id: 'cowboy_shot',
    label: 'Cowboy Shot',
    promptDescription: 'a dynamic cowboy shot framed from thigh-up, conveying confident posture, athletic presence, and attire',
    category: 'shot',
  },
  {
    id: 'full_body',
    label: 'Full Length',
    promptDescription: 'a full-length portrait capturing head-to-toe stance, body proportions, and draped wardrobe physics',
    category: 'shot',
  },
];

/**
 * The Master Anti-Plastic Realism Anchor.
 * Disrupts synthetic AI smoothing by enforcing authentic 35mm optical depth,
 * natural microtexture, and healthy dewy warmth without artificial airbrushing.
 */
export const ANTI_PLASTIC_REALISM_CLAUSE =
  'Authentic 35mm photograph with healthy radiant skin, natural dewy microtexture, and optical depth, completely free of waxy plastic smoothing or artificial airbrushing.';
