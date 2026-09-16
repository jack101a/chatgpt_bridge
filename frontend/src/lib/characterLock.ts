/**
 * Canonical Character Lock & Physical Identity Schema, converters, and error-proof JSON parsers.
 * Synchronizes Card Generator Wizard, Character Studio Drawer, and Turn 0 Handshake contract.
 */

import { CharacterCard } from '../types';

export interface PhysicalIdentityFace {
  shape: string;
  eyes: string;
  brows: string;
  nose: string;
  cheeks: string;
  lips: string;
  distinctive_features: string;
}

export interface PhysicalIdentitySkin {
  tone: string;
  undertone: string;
  texture: string;
  finish: string;
}

export interface PhysicalIdentityHair {
  color: string;
  length: string;
  texture: string;
  distinctive_features: string;
}

export interface PhysicalIdentityBody {
  build: string;
  silhouette: string;
  shoulders: string;
  chest_bust: string;
  waist: string;
  hips: string;
  thighs: string;
  legs: string;
  arms: string;
  abdomen: string;
}

export interface CanonicalPhysicalIdentity {
  face: PhysicalIdentityFace;
  skin: PhysicalIdentitySkin;
  hair: PhysicalIdentityHair;
  body: PhysicalIdentityBody;
}

export interface CanonicalCharacterLock {
  references: {
    image_1: string;
    image_2: string;
    image_3: string;
  };
  physical_identity: CanonicalPhysicalIdentity;
  lock_rule: string;
}

export function createDefaultPhysicalIdentity(): CanonicalPhysicalIdentity {
  return {
    face: {
      shape: '',
      eyes: '',
      brows: '',
      nose: '',
      cheeks: '',
      lips: '',
      distinctive_features: '',
    },
    skin: {
      tone: '',
      undertone: '',
      texture: '',
      finish: '',
    },
    hair: {
      color: '',
      length: '',
      texture: '',
      distinctive_features: '',
    },
    body: {
      build: '',
      silhouette: '',
      shoulders: '',
      chest_bust: '',
      waist: '',
      hips: '',
      thighs: '',
      legs: '',
      arms: '',
      abdomen: '',
    },
  };
}

export function createDefaultLockRule(characterName: string = 'the character'): string {
  const name = characterName.trim() || 'the character';
  return `Preserve ${name} as the same person across generations. Image 1 controls facial identity, Image 2 controls body proportions, and Image 3 controls expression realism. Do not redesign, beautify, age, de-age, or alter these physical characteristics unless explicitly instructed.`;
}

/**
 * Maps generator wizard `charData` tokens directly into CanonicalPhysicalIdentity.
 */
export function buildPhysicalIdentityFromCharData(charData: any): CanonicalPhysicalIdentity {
  if (!charData || typeof charData !== 'object') {
    return createDefaultPhysicalIdentity();
  }

  // Face
  const faceShape = charData.face_structure || '';
  const cheeks =
    charData.cheeks || (faceShape.toLowerCase().includes('cheek') ? 'full soft cheeks' : '');
  const face: PhysicalIdentityFace = {
    shape: faceShape,
    eyes: charData.eyes || '',
    brows: charData.eyebrows || '',
    nose: charData.nose || '',
    cheeks,
    lips: charData.lips || '',
    distinctive_features: charData.distinctive_features || '',
  };

  // Skin
  const skinTone = charData.skin_tone_undertone || '';
  const skinTexture = charData.skin_texture || '';
  const skinFinish =
    charData.finish ||
    (skinTone.toLowerCase().includes('luminous') || skinTexture.toLowerCase().includes('luminous')
      ? 'soft, silky, naturally luminous'
      : '');
  const skin: PhysicalIdentitySkin = {
    tone: skinTone,
    undertone: charData.skin_undertone || '',
    texture: skinTexture,
    finish: skinFinish,
  };

  // Hair
  const hairDesc = charData.hair_description || '';
  let hairColor = charData.hair_color || '';
  if (!hairColor) {
    if (hairDesc.toLowerCase().includes('dark brown')) hairColor = 'dark brown to black';
    else if (hairDesc.toLowerCase().includes('black')) hairColor = 'jet black';
    else if (hairDesc.toLowerCase().includes('ash-blonde') || hairDesc.toLowerCase().includes('blonde'))
      hairColor = 'ash-blonde';
    else if (hairDesc.toLowerCase().includes('auburn') || hairDesc.toLowerCase().includes('copper'))
      hairColor = 'copper-strawberry auburn';
  }
  const hairLength =
    charData.hair_length ||
    (hairDesc.toLowerCase().includes('long')
      ? 'long'
      : hairDesc.toLowerCase().includes('waist')
      ? 'waist-length'
      : hairDesc.toLowerCase().includes('shoulder')
      ? 'shoulder-length'
      : '');
  const hairTexture = charData.hair_texture || hairDesc;
  const hair: PhysicalIdentityHair = {
    color: hairColor,
    length: hairLength,
    texture: hairTexture,
    distinctive_features: charData.hair_details || '',
  };

  // Body
  const proportions = charData.proportions_limbs || '';
  const bust =
    charData.bust ||
    (proportions.toLowerCase().includes('heavy') ||
    proportions.toLowerCase().includes('prominent') ||
    proportions.toLowerCase().includes('ultra')
      ? 'very heavy prominent natural bust'
      : proportions.toLowerCase().includes('moderate')
      ? 'moderate natural firm bust'
      : 'natural firm bust');

  const waist =
    charData.waist ||
    (proportions.toLowerCase().includes('tiny') ||
    proportions.toLowerCase().includes('narrow') ||
    proportions.toLowerCase().includes('defined')
      ? 'narrow and clearly defined'
      : 'naturally defined');

  const hips =
    charData.hips ||
    (proportions.toLowerCase().includes('round') ||
    proportions.toLowerCase().includes('wide') ||
    proportions.toLowerCase().includes('curv')
      ? 'wide and rounded'
      : 'naturally proportioned');

  const thighs =
    charData.thighs ||
    (proportions.toLowerCase().includes('soft') || proportions.toLowerCase().includes('plush')
      ? 'full and soft'
      : 'toned');

  const legs =
    charData.legs ||
    (proportions.toLowerCase().includes('legs')
      ? 'long-looking with natural feminine shape'
      : 'naturally proportioned');

  const arms =
    charData.arms ||
    (proportions.toLowerCase().includes('arms') ? 'soft with natural fullness' : 'naturally proportioned');

  const shoulders = charData.shoulders || 'soft balanced feminine shoulders';
  const abdomen =
    charData.abdomen || 'soft natural lower-belly fullness, no visible abs';

  const body: PhysicalIdentityBody = {
    build: charData.physique || 'soft, dramatic feminine curvy physique',
    silhouette: charData.presence_silhouette || 'pronounced hourglass',
    shoulders,
    chest_bust: bust,
    waist,
    hips,
    thighs,
    legs,
    arms,
    abdomen,
  };

  return { face, skin, hair, body };
}

/**
 * Builds the canonical 3-pillar character lock schema.
 */
export function buildCanonicalCharacterLock(
  characterName: string,
  physicalIdentity: CanonicalPhysicalIdentity,
  customLockRule?: string
): CanonicalCharacterLock {
  return {
    references: {
      image_1: 'FACE_LOCK — primary facial identity reference.',
      image_2: 'BODY_LOCK — primary body and proportion reference.',
      image_3: 'EXPRESSION_LOCK — primary expression and facial realism reference.',
    },
    physical_identity: physicalIdentity,
    lock_rule: customLockRule || createDefaultLockRule(characterName),
  };
}

/**
 * Safely extracts CanonicalPhysicalIdentity from a CharacterCard regardless of whether
 * it was saved with modern schema, nested wrapper, or legacy charData.
 */
export function extractPhysicalIdentityFromCharacter(
  char: Partial<CharacterCard> | null | undefined
): { identity: CanonicalPhysicalIdentity; lockRule: string } {
  const defaultRule = createDefaultLockRule(char?.name || 'the character');
  if (!char) {
    return { identity: createDefaultPhysicalIdentity(), lockRule: defaultRule };
  }

  const rawLock = char.character_lock;
  if (rawLock && typeof rawLock === 'object') {
    // 1. Nested under character_lock.character_lock.physical_identity
    if (rawLock.character_lock?.physical_identity) {
      return {
        identity: sanitizePhysicalIdentity(rawLock.character_lock.physical_identity),
        lockRule: rawLock.character_lock.lock_rule || defaultRule,
      };
    }
    // 2. Direct physical_identity
    if (rawLock.physical_identity) {
      return {
        identity: sanitizePhysicalIdentity(rawLock.physical_identity),
        lockRule: rawLock.lock_rule || defaultRule,
      };
    }
    // 3. charData wrapper from Wizard
    if (rawLock.charData && typeof rawLock.charData === 'object') {
      return {
        identity: buildPhysicalIdentityFromCharData(rawLock.charData),
        lockRule: defaultRule,
      };
    }
  }

  // 4. Fallback: Parse from visual_dna if present
  if (char.visual_dna) {
    const fallback = createDefaultPhysicalIdentity();
    fallback.face.shape = char.visual_dna;
    fallback.skin.tone = 'natural human tone with realistic micro-texture';
    fallback.body.build = 'natural proportionate build';
    return { identity: fallback, lockRule: defaultRule };
  }

  return { identity: createDefaultPhysicalIdentity(), lockRule: defaultRule };
}

/**
 * Ensures all nested fields are strings and no sub-object is missing or undefined.
 */
export function sanitizePhysicalIdentity(raw: any): CanonicalPhysicalIdentity {
  const base = createDefaultPhysicalIdentity();
  if (!raw || typeof raw !== 'object') return base;

  const face = raw.face && typeof raw.face === 'object' ? raw.face : {};
  const skin = raw.skin && typeof raw.skin === 'object' ? raw.skin : {};
  const hair = raw.hair && typeof raw.hair === 'object' ? raw.hair : {};
  const body = raw.body && typeof raw.body === 'object' ? raw.body : {};

  return {
    face: {
      shape: String(face.shape || ''),
      eyes: String(face.eyes || ''),
      brows: String(face.brows || ''),
      nose: String(face.nose || ''),
      cheeks: String(face.cheeks || ''),
      lips: String(face.lips || ''),
      distinctive_features: String(face.distinctive_features || ''),
    },
    skin: {
      tone: String(skin.tone || ''),
      undertone: String(skin.undertone || ''),
      texture: String(skin.texture || ''),
      finish: String(skin.finish || ''),
    },
    hair: {
      color: String(hair.color || ''),
      length: String(hair.length || ''),
      texture: String(hair.texture || ''),
      distinctive_features: String(hair.distinctive_features || ''),
    },
    body: {
      build: String(body.build || ''),
      silhouette: String(body.silhouette || ''),
      shoulders: String(body.shoulders || ''),
      chest_bust: String(body.chest_bust || ''),
      waist: String(body.waist || ''),
      hips: String(body.hips || ''),
      thighs: String(body.thighs || ''),
      legs: String(body.legs || ''),
      arms: String(body.arms || ''),
      abdomen: String(body.abdomen || ''),
    },
  };
}

/**
 * Error-Proof JSON Parser:
 * Strips code fences, repairs trailing commas, fixes single quotes, handles missing keys.
 */
export function parseCharacterLockJsonSafe(
  rawText: string,
  characterName: string = 'the character'
): { ok: true; data: CanonicalCharacterLock } | { ok: false; error: string } {
  let cleaned = rawText.trim();
  if (!cleaned) {
    return { ok: false, error: 'JSON text cannot be empty' };
  }

  // Strip markdown fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Strip trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    // Attempt minor recovery: replace unquoted keys or single quotes
    try {
      const relaxed = cleaned
        .replace(/(\w+)\s*:/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(relaxed);
    } catch {
      return { ok: false, error: `Invalid JSON syntax: ${err.message}` };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Parsed content must be a JSON object' };
  }

  // Check if wrapped in { "character_lock": { ... } }
  let target = parsed;
  if (parsed.character_lock && typeof parsed.character_lock === 'object') {
    target = parsed.character_lock;
  }

  const rawPhysical = target.physical_identity || (target.face || target.body ? target : null);
  if (!rawPhysical) {
    return {
      ok: false,
      error: 'Missing "physical_identity" section (or face/body fields) in JSON',
    };
  }

  const sanitized = sanitizePhysicalIdentity(rawPhysical);
  const lockRule =
    target.lock_rule || parsed.lock_rule || createDefaultLockRule(characterName);

  const canonical: CanonicalCharacterLock = {
    references: {
      image_1: 'FACE_LOCK — primary facial identity reference.',
      image_2: 'BODY_LOCK — primary body and proportion reference.',
      image_3: 'EXPRESSION_LOCK — primary expression and facial realism reference.',
    },
    physical_identity: sanitized,
    lock_rule: lockRule,
  };

  return { ok: true, data: canonical };
}

/**
 * Compiles a recurring character prompt in the canonical format:
 * - Directs ChatGPT to use Image 1 from original identity reference set
 * - Inserts specified scene / outfit / pose / expression / camera / lighting / background
 * - Enforces zero drift on recognizable facial, skin, hair, and body proportions
 */
export function compileRecurringCharacterPrompt(params: {
  scene: string;
  outfit?: string;
  pose?: string;
  expression?: string;
  camera?: string;
  lighting?: string;
  background?: string;
}): string {
  const lines = [
    'Use Image 1 from the original identity reference set as the primary character reference. Preserve the established identity and physical appearance.',
    '',
    'Create a new image:',
    '',
  ];

  if (params.scene.trim()) {
    lines.push(`[SCENE]: ${params.scene.trim()}`);
  }
  if (params.outfit?.trim()) {
    lines.push(`[OUTFIT]: ${params.outfit.trim()}`);
  }
  if (params.pose?.trim()) {
    lines.push(`[POSE]: ${params.pose.trim()}`);
  }
  if (params.expression?.trim()) {
    lines.push(`[EXPRESSION]: ${params.expression.trim()}`);
  }
  if (params.camera?.trim()) {
    lines.push(`[CAMERA]: ${params.camera.trim()}`);
  }
  if (params.lighting?.trim()) {
    lines.push(`[LIGHTING]: ${params.lighting.trim()}`);
  }
  if (params.background?.trim()) {
    lines.push(`[BACKGROUND]: ${params.background.trim()}`);
  }

  lines.push('');
  lines.push(
    "Only change what is specified for this new image. Keep the person's recognizable face, skin, hair, and body proportions consistent with the established reference."
  );

  return lines.join('\n');
}
