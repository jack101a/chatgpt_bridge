import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Smile,
  User,
  UserCheck,
  Search,
  X,
  Dices,
  ArrowRight,
  Maximize2,
  Trash2,
  Save,
  MessageSquare,
} from 'lucide-react';
import { CharacterCard, ImageResult, GalleryItem, ChatThread } from '../../types';
import { api, copyToClipboard } from '../../lib/api';
import { buildPhysicalIdentityFromCharData, buildCanonicalCharacterLock } from '../../lib/characterLock';
import { hapticImpact } from '../../lib/haptics';

interface ReferenceCardWizardProps {
  characters: CharacterCard[];
  onRefreshCharacters: () => void;
  onOpenViewer?: (item: GalleryItem) => void;
  onContinueInChat?: (item: GalleryItem) => void;
}

// ── Persistent Storage Key ──
const DRAFT_STORAGE_KEY = 'bridge:card_wizard_draft_v2';

// ── Dictionary & Presets (Granular Atomic Tokens) ──
const DICTIONARY_OPTIONS: Record<string, string[]> = {
  character_name: ['Kaya', 'Nia', 'Zia', 'Nastya', 'Priya', 'Anya', 'Elena', 'Mei', 'Zara', 'Amara', 'Leila', 'Sophia'],
  ethnicity_ancestry: [
    'Indian',
    'South Asian',
    'North Indian',
    'Nordic-Irish',
    'Biracial Black-White',
    'Slavic Russian',
    'East Asian',
    'Mediterranean',
    'Latina',
    'Middle Eastern',
  ],
  gender_presentation: ['woman', 'man', 'non-binary person'],
  age_appearance: ['early 20s', 'mid-20s', 'late 20s', 'early 30s', 'mid-30s'],

  // Face Granular Tokens
  face_shape: [
    'soft oval',
    'heart-shaped',
    'delicate round',
    'defined square',
    'radiant oval',
    'delicate Slavic oval',
    'slender oval',
  ],
  cheeks: [
    'fuller cheeks',
    'high cheekbones',
    'soft cheeks',
    'defined cheekbones',
    'refined high cheekbones',
    'gentle contoured cheeks',
  ],
  eye_size: [
    'large expressive',
    'soft almond-shaped',
    'wide-awake expressive',
    'warm almond-shaped',
    'deep-set natural',
    'delicate natural',
  ],
  eye_color: [
    'hazel-brown',
    'sea-glass green',
    'amber-brown',
    'icy blue-gray',
    'deep dark brown',
    'warm honey-brown',
  ],
  brow_shape: [
    'softly arched',
    'natural feathered',
    'soft straight',
    'delicately curved',
    'defined arched',
  ],
  brow_color: [
    'natural dark',
    'light-auburn',
    'ash-blonde',
    'dark feathered',
    'soft dark brown',
    'deep espresso',
  ],
  nose: [
    'small refined',
    'delicate button',
    'small natural freckled',
    'neat straight button',
    'softly sculpted',
    'classical straight',
  ],
  lip_shape: [
    'naturally plush',
    'plush',
    'full pillowy',
    'moderately full',
    'petal-plush',
  ],
  lip_color: [
    'soft pink',
    'rose-tinted',
    'warm caramel-toned',
    'nude petal-pink',
    'natural berry',
    'soft rose',
  ],
  skin_tone: [
    'milky-white',
    'pale porcelain',
    'warm golden olive',
    'warm honey-beige',
    'cool alabaster',
    'medium warm tan',
    'deep rich espresso',
  ],
  skin_undertone: [
    'peach warmth',
    'subtle freckles',
    'luminous clarity',
    'translucent undertones',
    'cool rose undertones',
    'golden undertones',
  ],
  skin_texture: [
    'smooth with visible natural pores',
    'natural human texture with fine pores',
    'dewy with fine pores',
    'soft natural matte grain',
    'fine pore structure with satin sheen',
    'realistic texture with fine pores',
  ],
  hair_length: [
    'long',
    'waist-length',
    'shoulder-length',
    'mid-back',
    'short bob',
  ],
  hair_texture: [
    'thick wavy',
    'soft wavy',
    'sleek silky',
    'voluminous wavy',
    'loose bouncy curls',
  ],
  hair_color: [
    'dark brown-to-black',
    'copper-strawberry auburn',
    'rich chocolate brown',
    'dark espresso brown',
    'natural ash-blonde',
    'jet black',
  ],
  hair_details: [
    'warm caramel highlights',
    'wispy face-framing baby hairs',
    'subtle honey highlights',
    'glossy natural highlights',
    'soft platinum-blonde strands',
  ],
  makeup: [
    'minimal natural makeup',
    'bare-faced clean',
    'dewy natural glow',
    'subtle nude balm',
  ],
  facial_expression: [
    'relaxed neutral',
    'earnest gentle',
    'confident approachable',
    'calm serene',
  ],

  // Body Granular Tokens
  silhouette: [
    'curvy hourglass',
    'voluptuous natural',
    'lean athletic',
    'slender graceful hourglass',
    'soft petite curvy',
  ],
  bust: [
    'prominent natural bust',
    'prominent firm bust',
    'full prominent bust',
    'moderate firm natural bust',
    'proportional soft bust',
  ],
  waist: [
    'narrow defined waist',
    'narrow waist',
    'natural gentle waist',
    'softly tapered waist',
  ],
  hips: [
    'wide rounded hips',
    'rounded hips',
    'shapely wide hips',
    'naturally rounded hips',
  ],
  limbs: [
    'soft feminine limbs',
    'soft natural limbs',
    'toned thighs and arms',
    'long shapely legs and soft arms',
  ],
  abdomen: [
    'natural gentle lower-belly softness',
    'flat toned natural abdomen',
    'natural soft feminine abdomen',
    'smooth flat feminine stomach',
  ],
  physique: [
    'soft, curvy, and naturally proportioned',
    'curvy, feminine, and naturally proportioned',
    'athletic, fit, and naturally feminine',
    'slender, soft, and graceful',
    'plush, curvy, and voluptuous',
  ],
  clothing: [
    'simple neutral two-piece',
    'simple rustic minimal slip',
    'minimal neutral reference attire',
    'minimal neutral athletic two-piece',
    'minimal neutral sports set',
  ],
  posture: [
    'relaxed natural standing posture',
    'confident upright standing posture',
    'graceful natural standing stance',
  ],

  // Expression Granular Tokens
  expression_realism: [
    'authentic micro-expressions',
    'natural eye behavior and subtle facial movement',
    'confident direct gaze and natural catchlights',
    'serene gaze and subtle authentic smile',
  ],
  selfie_vibe: [
    'subtle smartphone selfie realism',
    'intimate candid authentic presence',
    'fresh authentic portrait presence',
    'candid realism with natural ambient lighting',
  ],
};

// Preset Archetypes
const ARCHETYPES: Record<string, any> = {
  kaya: {
    character_name: 'Kaya',
    ethnicity_ancestry: 'Indian',
    gender_presentation: 'woman',
    age_appearance: 'mid-20s',
    face_shape: 'soft oval',
    cheeks: 'fuller cheeks',
    eye_size: 'large expressive',
    eye_color: 'hazel-brown',
    brow_shape: 'softly arched',
    brow_color: 'natural dark',
    nose: 'small refined',
    lip_shape: 'naturally plush',
    lip_color: 'soft pink',
    skin_tone: 'milky-white',
    skin_undertone: 'peach warmth',
    skin_texture: 'smooth with visible natural pores',
    hair_length: 'long',
    hair_texture: 'thick wavy',
    hair_color: 'dark brown-to-black',
    hair_details: 'warm caramel highlights',
    makeup: 'minimal natural makeup',
    facial_expression: 'relaxed neutral',
    
    silhouette: 'curvy hourglass',
    bust: 'prominent natural bust',
    waist: 'narrow defined waist',
    hips: 'wide rounded hips',
    limbs: 'soft feminine limbs',
    abdomen: 'natural gentle lower-belly softness',
    physique: 'soft, curvy, and naturally proportioned',
    clothing: 'simple neutral two-piece',
    posture: 'relaxed natural standing posture',

    expression_realism: 'authentic micro-expressions',
    selfie_vibe: 'subtle smartphone selfie realism',

    // Legacy compatibility fields
    face_structure: 'soft feminine face with fuller cheeks',
    eyes: 'large expressive hazel-brown eyes',
    eyebrows: 'natural dark expressive eyebrows',
    lips: 'soft pink naturally plush lips',
    skin_tone_undertone: 'bright milky-white with peach warmth',
    hair_description: 'long thick dark brown-to-black hair',
    makeup_expression: 'minimal natural makeup and relaxed neutral expression',
    presence_silhouette: 'tall feminine presence with curvy hourglass silhouette',
    proportions_limbs: 'balanced shoulders, prominent bust, narrow waist, rounded hips, and soft thighs',
    expression_focus: 'natural eye behavior and subtle facial movement',
  },
  nia: {
    character_name: 'Nia',
    ethnicity_ancestry: 'Nordic-Irish',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    face_shape: 'heart-shaped',
    cheeks: 'high cheekbones',
    eye_size: 'wide-awake expressive',
    eye_color: 'sea-glass green',
    brow_shape: 'softly arched',
    brow_color: 'light-auburn',
    nose: 'small natural freckled',
    lip_shape: 'plush',
    lip_color: 'rose-tinted',
    skin_tone: 'pale porcelain',
    skin_undertone: 'subtle freckles',
    skin_texture: 'natural human texture with fine pores',
    hair_length: 'long',
    hair_texture: 'soft wavy',
    hair_color: 'copper-strawberry auburn',
    hair_details: 'wispy face-framing baby hairs',
    makeup: 'bare-faced clean',
    facial_expression: 'earnest gentle',

    silhouette: 'curvy hourglass',
    bust: 'prominent firm bust',
    waist: 'narrow waist',
    hips: 'rounded hips',
    limbs: 'soft natural limbs',
    abdomen: 'flat toned natural abdomen',
    physique: 'curvy, feminine, and naturally proportioned',
    clothing: 'simple rustic minimal slip',
    posture: 'relaxed natural standing posture',

    expression_realism: 'authentic micro-expressions',
    selfie_vibe: 'intimate candid authentic presence',

    // Legacy compatibility fields
    face_structure: 'heart-shaped Celtic face with high cheekbones',
    eyes: 'sea-glass green eyes with bright catchlights',
    eyebrows: 'softly arched light-auburn brows',
    lips: 'soft rose-tinted plush lips',
    skin_tone_undertone: 'pale porcelain with subtle freckles',
    hair_description: 'wavy copper-strawberry auburn hair',
    makeup_expression: 'bare-faced with earnest gentle expression',
    presence_silhouette: 'curvy hourglass silhouette',
    proportions_limbs: 'prominent bust, narrow waist, rounded hips, and soft limbs',
    expression_focus: 'natural eye behavior and micro-expressions',
  },
  zia: {
    character_name: 'Zia',
    ethnicity_ancestry: 'Biracial Black-White',
    gender_presentation: 'woman',
    age_appearance: 'mid-20s',
    face_shape: 'radiant oval',
    cheeks: 'defined cheekbones',
    eye_size: 'warm almond-shaped',
    eye_color: 'amber-brown',
    brow_shape: 'softly arched',
    brow_color: 'dark feathered',
    nose: 'softly sculpted',
    lip_shape: 'full pillowy',
    lip_color: 'warm caramel-toned',
    skin_tone: 'warm golden olive',
    skin_undertone: 'luminous clarity',
    skin_texture: 'realistic texture with fine pores',
    hair_length: 'waist-length',
    hair_texture: 'voluminous wavy',
    hair_color: 'rich chocolate brown',
    hair_details: 'subtle honey highlights',
    makeup: 'dewy natural glow',
    facial_expression: 'confident approachable',

    silhouette: 'lean athletic',
    bust: 'full prominent bust',
    waist: 'narrow defined waist',
    hips: 'shapely wide hips',
    limbs: 'toned thighs and arms',
    abdomen: 'natural soft feminine abdomen',
    physique: 'athletic, fit, and naturally feminine',
    clothing: 'minimal neutral athletic two-piece',
    posture: 'confident upright standing posture',

    expression_realism: 'dynamic emotional subtlety',
    selfie_vibe: 'fresh authentic portrait presence',

    // Legacy compatibility fields
    face_structure: 'radiant oval face with defined cheekbones',
    eyes: 'warm amber-brown eyes with thick natural lashes',
    eyebrows: 'softly arched dark brows',
    lips: 'full warm caramel-toned plush lips',
    skin_tone_undertone: 'warm sun-kissed golden honey',
    hair_description: 'voluminous shoulder-length bouncy curls',
    makeup_expression: 'bare-faced clean athletic look',
    presence_silhouette: 'lean athletic feminine silhouette',
    proportions_limbs: 'sculpted shoulders, average bust, narrow waist, athletic hips, and toned thighs',
    expression_focus: 'confident direct gaze and natural catchlights',
  },
  nastya: {
    character_name: 'Nastya',
    ethnicity_ancestry: 'Slavic Russian',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    face_shape: 'delicate Slavic oval',
    cheeks: 'refined high cheekbones',
    eye_size: 'large expressive',
    eye_color: 'icy blue-gray',
    brow_shape: 'soft straight',
    brow_color: 'ash-blonde',
    nose: 'neat straight button',
    lip_shape: 'petal-plush',
    lip_color: 'soft rose',
    skin_tone: 'cool alabaster',
    skin_undertone: 'translucent undertones',
    skin_texture: 'fine pore structure with satin sheen',
    hair_length: 'long',
    hair_texture: 'sleek silky',
    hair_color: 'dark espresso brown',
    hair_details: 'soft platinum-blonde strands',
    makeup: 'clean bare-faced',
    facial_expression: 'calm serene',

    silhouette: 'slender graceful hourglass',
    bust: 'moderate firm natural bust',
    waist: 'narrow waist',
    hips: 'naturally rounded hips',
    limbs: 'long shapely legs and soft arms',
    abdomen: 'smooth flat feminine stomach',
    physique: 'slender, soft, and graceful',
    clothing: 'minimal neutral sports set',
    posture: 'graceful natural standing stance',

    expression_realism: 'serene gaze and subtle authentic smile',
    selfie_vibe: 'candid realism with natural ambient lighting',

    // Legacy compatibility fields
    face_structure: 'soft delicate Slavic face structure with refined chin',
    eyes: 'clear icy blue-gray eyes with delicate lash line',
    eyebrows: 'soft straight natural ash-blonde brows',
    lips: 'naturally full plush petal-pink lips',
    skin_tone_undertone: 'fair alabaster with cool rose undertones',
    hair_description: 'long straight-to-wavy natural ash-blonde hair',
    makeup_expression: 'minimal natural makeup and calm serene expression',
    presence_silhouette: 'voluptuous natural silhouette with prominent curves',
    proportions_limbs: 'soft balanced shoulders, big bust, narrow waist, rounded hips, and full thighs',
    expression_focus: 'serene gaze and subtle authentic smile',
  },
};

function getSavedDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse saved draft', e);
  }
  return null;
}

export function ReferenceCardWizard({
  characters,
  onRefreshCharacters,
  onOpenViewer,
  onContinueInChat: _onContinueInChat,
}: ReferenceCardWizardProps) {
  const initialDraft = useMemo(() => getSavedDraft(), []);

  // Wizard active step
  const [currentStep, setCurrentStep] = useState<'face' | 'body' | 'expression' | 'completed'>(
    () => initialDraft?.currentStep || 'face'
  );

  // Mobile Sub-Tab ('prompt' or 'preview')
  const [mobileTab, setMobileTab] = useState<'prompt' | 'preview'>(
    () => initialDraft?.mobileTab || 'prompt'
  );

  // ChatGPT Chat Mode: 'new' (spawns clean slate) or 'existing' (attaches to selected thread)
  const [chatMode, setChatMode] = useState<'new' | 'existing'>(
    () => initialDraft?.chatMode || 'new'
  );
  const [targetExistingChatId, setTargetExistingChatId] = useState<string>(
    () => initialDraft?.targetExistingChatId || ''
  );
  const [availableChats, setAvailableChats] = useState<ChatThread[]>([]);

  // Temporary Session Conversation ID (only lives during this wizard flow until saved/discarded)
  const [sessionConversationId, setSessionConversationId] = useState<string | null>(
    () => initialDraft?.sessionConversationId || null
  );

  // Character Data State (cascades across steps)
  const [charData, setCharData] = useState<typeof ARCHETYPES.kaya>(
    () => initialDraft?.charData || ARCHETYPES.kaya
  );

  // Step Results
  const [faceResult, setFaceResult] = useState<ImageResult | null>(
    () => initialDraft?.faceResult || null
  );
  const [bodyResult, setBodyResult] = useState<ImageResult | null>(
    () => initialDraft?.bodyResult || null
  );
  const [expressionResult, setExpressionResult] = useState<ImageResult | null>(
    () => initialDraft?.expressionResult || null
  );

  // Step Confirmation locks
  const [isFaceConfirmed, setIsFaceConfirmed] = useState<boolean>(
    () => initialDraft?.isFaceConfirmed || false
  );
  const [isBodyConfirmed, setIsBodyConfirmed] = useState<boolean>(
    () => initialDraft?.isBodyConfirmed || false
  );
  const [isExpressionConfirmed, setIsExpressionConfirmed] = useState<boolean>(
    () => initialDraft?.isExpressionConfirmed || false
  );

  // Editor mode: 'tokens' or 'raw'
  const [editorMode, setEditorMode] = useState<'tokens' | 'raw'>(
    () => initialDraft?.editorMode || 'tokens'
  );
  const [customRawPrompt, setCustomRawPrompt] = useState<string | null>(
    () => initialDraft?.customRawPrompt || null
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [targetCharId, setTargetCharId] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Token Popover / Picker State
  const [activePickerField, setActivePickerField] = useState<keyof typeof charData | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Fetch recent chats to populate existing chat dropdown
  useEffect(() => {
    api.getChats().then((chats) => {
      if (Array.isArray(chats)) {
        setAvailableChats(chats);
      }
    }).catch(() => {});
  }, []);

  // ── Sync Active State to LocalStorage Draft ──
  useEffect(() => {
    const draftData = {
      currentStep,
      mobileTab,
      chatMode,
      targetExistingChatId,
      sessionConversationId,
      charData,
      faceResult,
      bodyResult,
      expressionResult,
      isFaceConfirmed,
      isBodyConfirmed,
      isExpressionConfirmed,
      editorMode,
      customRawPrompt,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (e) {
      console.warn('Failed to save wizard draft to localStorage', e);
    }
  }, [
    currentStep,
    mobileTab,
    chatMode,
    targetExistingChatId,
    sessionConversationId,
    charData,
    faceResult,
    bodyResult,
    expressionResult,
    isFaceConfirmed,
    isBodyConfirmed,
    isExpressionConfirmed,
    editorMode,
    customRawPrompt,
  ]);

  // ── Compiling Dynamic Prompts ──

  const compiledFacePrompt = useMemo(() => {
    const pronoun = charData.gender_presentation === 'man' ? 'his' : 'her';
    const faceShape = charData.face_shape || charData.face_structure || 'soft oval';
    const cheeks = charData.cheeks || 'fuller cheeks';
    const eyeSize = charData.eye_size || 'large expressive';
    const eyeColor = charData.eye_color || 'hazel-brown';
    const browShape = charData.brow_shape || 'softly arched';
    const browColor = charData.brow_color || 'natural dark';
    const nose = charData.nose || 'small refined';
    const lipShape = charData.lip_shape || 'naturally plush';
    const lipColor = charData.lip_color || 'soft pink';
    const skinTone = charData.skin_tone || 'milky-white';
    const skinUndertone = charData.skin_undertone || 'peach warmth';
    const skinTexture = charData.skin_texture || 'smooth with visible natural pores';
    const hairLength = charData.hair_length || 'long';
    const hairTexture = charData.hair_texture || 'thick wavy';
    const hairColor = charData.hair_color || 'dark brown-to-black';
    const hairDetails = charData.hair_details || 'warm caramel highlights';
    const makeup = charData.makeup || 'minimal natural makeup';
    const facialExpr = charData.facial_expression || 'relaxed neutral';

    return `Create a 4:3 high-resolution photorealistic face identity reference card for ${charData.character_name}, a fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show the same ${charData.gender_presentation} in three consistent facial views on one clean reference sheet:

1. straight-on front view
2. left 3/4 view
3. right 3/4 view

${charData.character_name} has a ${faceShape} face structure with ${cheeks}. She has ${eyeSize} ${eyeColor} eyes, framed by ${browShape} ${browColor} eyebrows, a ${nose} nose, and ${lipShape} ${lipColor} lips.
Her skin tone is ${skinTone} with ${skinUndertone}, featuring a ${skinTexture} texture. Never chalky, waxy, plastic, or overly airbrushed.
Her hair is ${hairLength}, ${hairTexture}, and ${hairColor}, styled with ${hairDetails}.
Use ${makeup} and a ${facialExpr} so her actual facial identity is clearly visible.
Plain neutral background, consistent soft natural lighting, realistic human anatomy, realistic skin texture, no beauty filter, no facial reshaping, no stylization, no excessive retouching.
All three views must depict exactly the same ${charData.gender_presentation} with identical facial structure and physical identity.
No text except label of side and title
Purpose: FACE LOCK — this image is the primary reference for ${charData.character_name}'s facial identity, skin, eyes, hair, and recognizable features.`.trim();
  }, [charData]);

  const compiledBodyPrompt = useMemo(() => {
    const pronoun = charData.gender_presentation === 'man' ? 'his' : 'her';
    const silhouette = charData.silhouette || charData.presence_silhouette || 'curvy hourglass';
    const bust = charData.bust || 'prominent natural bust';
    const waist = charData.waist || 'narrow defined waist';
    const hips = charData.hips || 'wide rounded hips';
    const limbs = charData.limbs || 'soft feminine limbs';
    const abdomen = charData.abdomen || 'natural gentle lower-belly softness';
    const physique = charData.physique || 'soft, curvy, and naturally proportioned';
    const clothing = charData.clothing || 'simple neutral two-piece';
    const posture = charData.posture || 'relaxed natural standing posture';
    const skinTone = charData.skin_tone || 'milky-white';
    const skinUndertone = charData.skin_undertone || 'peach warmth';
    const skinTexture = charData.skin_texture || 'smooth with visible natural pores';

    return `Create a 4:3 high-resolution photorealistic body identity reference card for ${charData.character_name}, the same fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show the same woman in four consistent full-body views on one clean reference sheet:

1. front view
2. left side view
3. right side view
4. back view

${charData.character_name} has a ${silhouette} with a ${bust}, ${waist}, and ${hips}, balanced by ${limbs}.
Her abdomen has ${abdomen}, with an overall ${physique} physique.
She is dressed in a ${clothing} that clearly shows her natural proportions without being revealing, standing in a ${posture}.
Preserve her ${skinTone} skin with ${skinUndertone} and ${skinTexture}.
Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions.
No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization.
All four views must depict exactly the same woman with identical body proportions.
No text except label of side and title
Purpose: BODY LOCK — this image is the primary reference for ${charData.character_name}'s body proportions, silhouette, and physical structure.`.trim();
  }, [charData]);

  const compiledExpressionPrompt = useMemo(() => {
    const pronoun = charData.gender_presentation === 'man' ? 'his' : 'her';
    const faceShape = charData.face_shape || charData.face_structure || 'soft oval';
    const cheeks = charData.cheeks || 'fuller cheeks';
    const eyeSize = charData.eye_size || 'large expressive';
    const eyeColor = charData.eye_color || 'hazel-brown';
    const browShape = charData.brow_shape || 'softly arched';
    const nose = charData.nose || 'small refined';
    const lipShape = charData.lip_shape || 'naturally plush';
    const lipColor = charData.lip_color || 'soft pink';
    const skinTone = charData.skin_tone || 'milky-white';
    const skinUndertone = charData.skin_undertone || 'peach warmth';
    const hairLength = charData.hair_length || 'long';
    const hairTexture = charData.hair_texture || 'thick wavy';
    const hairColor = charData.hair_color || 'dark brown-to-black';
    const exprRealism = charData.expression_realism || charData.expression_focus || 'authentic micro-expressions';
    const selfieVibe = charData.selfie_vibe || 'subtle smartphone selfie realism';

    return `Create a high-resolution photorealistic expression and selfie-realism reference card for ${charData.character_name}, the same fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show six expressions of the exact same woman in a clean 2×3 grid:

1. relaxed neutral
2. soft genuine smile
3. playful smirk
4. subtle laugh
5. confident direct gaze
6. soft thoughtful expression

Keep ${charData.character_name}'s exact established facial identity in every panel: ${faceShape} with ${cheeks}, ${eyeSize} ${eyeColor} eyes, ${browShape} eyebrows, ${nose} nose, ${lipShape} ${lipColor} lips, ${skinTone} skin with ${skinUndertone}, and ${hairLength} ${hairTexture} ${hairColor} hair.
Focus on ${exprRealism} and authentic emotion.
Expressions should feel like a real person rather than exaggerated model poses. Include ${selfieVibe}.
Consistent natural lighting, simple neutral background, realistic skin texture, photorealistic rendering, high resolution.
No face redesign, beautification, excessive retouching, plastic skin, exaggerated expressions, or stylization.

No text except label of side and title
Purpose: EXPRESSION LOCK — this image establishes ${charData.character_name}'s natural facial animation, eye behavior, expression range, and realistic selfie presence.`.trim();
  }, [charData]);

  // Current effective prompt based on active step and raw/tokens mode
  const currentCompiledPrompt = useMemo(() => {
    if (currentStep === 'face') return compiledFacePrompt;
    if (currentStep === 'body') return compiledBodyPrompt;
    return compiledExpressionPrompt;
  }, [currentStep, compiledFacePrompt, compiledBodyPrompt, compiledExpressionPrompt]);

  const effectivePrompt = customRawPrompt !== null ? customRawPrompt : currentCompiledPrompt;

  // Reset custom raw prompt whenever changing steps
  const handleStepChange = (step: 'face' | 'body' | 'expression' | 'completed') => {
    hapticImpact('selection');
    setCurrentStep(step);
    setCustomRawPrompt(null);
  };

  // Reset all state (Discard Session)
  const handleDiscardSession = () => {
    hapticImpact('light');
    if (confirm('Discard current reference card session? This will release thread continuity and reset in-progress cards.')) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
      setSessionConversationId(null);
      setChatMode('new');
      setTargetExistingChatId('');
      api.resetConversation().catch(() => {});
      setFaceResult(null);
      setBodyResult(null);
      setExpressionResult(null);
      setIsFaceConfirmed(false);
      setIsBodyConfirmed(false);
      setIsExpressionConfirmed(false);
      setCurrentStep('face');
      setCustomRawPrompt(null);
      setCharData(ARCHETYPES.kaya);
      setMobileTab('prompt');
    }
  };

  // Archetype Select
  const handleSelectArchetype = (key: string) => {
    hapticImpact('selection');
    if (ARCHETYPES[key]) {
      setCharData({ ...ARCHETYPES[key] });
      setCustomRawPrompt(null);
    }
  };

  // Randomize current step's tokens
  const handleRandomize = () => {
    hapticImpact('medium');
    const keys = Object.keys(ARCHETYPES);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const base = ARCHETYPES[randomKey];
    
    // Pick stochastic variations from dictionary
    const newValues: any = { ...base };
    for (const [fKey, opts] of Object.entries(DICTIONARY_OPTIONS)) {
      if (Math.random() > 0.4 && opts.length > 0) {
        newValues[fKey] = opts[Math.floor(Math.random() * opts.length)];
      }
    }
    setCharData(newValues);
    setCustomRawPrompt(null);
  };

  // Update a single token field
  const handleUpdateToken = (key: keyof typeof ARCHETYPES.kaya, value: string) => {
    hapticImpact('selection');
    setCharData((prev: typeof ARCHETYPES.kaya) => ({ ...prev, [key]: value }));
    setCustomRawPrompt(null);
    setActivePickerField(null);
    setPickerSearch('');
  };

  // Copy Prompt
  const handleCopyPrompt = async () => {
    hapticImpact('selection');
    const ok = await copyToClipboard(effectivePrompt);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  // ── Generation Handlers ──

  const handleGenerateCurrentStep = async () => {
    if (isGenerating) return;
    hapticImpact('medium');
    setIsGenerating(true);
    setGenerationProgress(`Submitting ${currentStep.toUpperCase()} Card to engine…`);
    // On mobile screens, automatically show the preview pane where generation is happening
    setMobileTab('preview');

    try {
      let res: any;
      // Determine conversation ID:
      // If locked, use sessionConversationId.
      // If not yet locked, check chatMode: if 'existing' and chosen, attach; otherwise 'new' for a clean new chat.
      let convIdToUse: string | undefined;
      if (sessionConversationId) {
        convIdToUse = sessionConversationId;
      } else if (chatMode === 'existing' && targetExistingChatId) {
        convIdToUse = targetExistingChatId;
      } else {
        convIdToUse = 'new';
        try {
          await api.resetConversation();
        } catch (e) {
          console.warn('Failed to reset conversation before generation:', e);
        }
      }

      if (currentStep === 'face') {
        res = await api.generateFaceCard(charData, convIdToUse, effectivePrompt);
        if (res.ok && res.result) {
          setFaceResult(res.result);
          // Store thread session conversation ID for body & expression steps!
          if (res.result.conversation_id) {
            setSessionConversationId(res.result.conversation_id);
          }
        } else {
          throw new Error('Face Card generation did not return a valid result');
        }
      } else if (currentStep === 'body') {
        res = await api.generateBodyCard(charData, convIdToUse, effectivePrompt);
        if (res.ok && res.result) {
          setBodyResult(res.result);
          if (res.result.conversation_id && !sessionConversationId) {
            setSessionConversationId(res.result.conversation_id);
          }
        } else {
          throw new Error('Body Card generation did not return a valid result');
        }
      } else if (currentStep === 'expression') {
        res = await api.generateExpressionCard(charData, convIdToUse, effectivePrompt);
        if (res.ok && res.result) {
          setExpressionResult(res.result);
          if (res.result.conversation_id && !sessionConversationId) {
            setSessionConversationId(res.result.conversation_id);
          }
        } else {
          throw new Error('Expression Card generation did not return a valid result');
        }
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // Pass Face and Move to Body Lock
  const handleConfirmFace = () => {
    if (!faceResult) return;
    hapticImpact('medium');
    setIsFaceConfirmed(true);
    handleStepChange('body');
    setMobileTab('prompt');
  };

  // Pass Body and Move to Expression Lock
  const handleConfirmBody = () => {
    if (!bodyResult) return;
    hapticImpact('medium');
    setIsBodyConfirmed(true);
    handleStepChange('expression');
    setMobileTab('prompt');
  };

  // Pass Expression and Finalize
  const handleConfirmExpression = () => {
    if (!expressionResult) return;
    hapticImpact('medium');
    setIsExpressionConfirmed(true);
    setCurrentStep('completed');
    setIsSaveModalOpen(true);
  };

  // Save Character to Studio Drawer
  const handleSaveCharacter = async () => {
    hapticImpact('medium');
    setIsSaving(true);
    try {
      const faceId = faceResult?.image_url.split('/').pop() || null;
      const bodyId = bodyResult?.image_url.split('/').pop() || null;
      const expressionId = expressionResult?.image_url.split('/').pop() || null;

      const charName = charData.character_name || 'Kaya';
      const physicalIdentity = buildPhysicalIdentityFromCharData(charData);
      const canonicalLock = buildCanonicalCharacterLock(charName, physicalIdentity);

      const structuredLock = {
        ...canonicalLock,
        archetype: charName,
        charData: { ...charData },
        cards: {
          face: faceId,
          body: bodyId,
          expression: expressionId,
        },
        saved_at: Date.now() / 1000,
      };

      const faceStr = `${charData.face_shape || ''} with ${charData.cheeks || ''}, ${charData.eye_size || ''} ${charData.eye_color || ''} eyes, ${charData.brow_shape || ''} brows, ${charData.nose || ''} nose, ${charData.lip_shape || ''} ${charData.lip_color || ''} lips`.replace(/\s+/g, ' ').trim();
      const skinStr = `${charData.skin_tone || ''} skin (${charData.skin_undertone || ''}), ${charData.skin_texture || ''}`.replace(/\s+/g, ' ').trim();
      const hairStr = `${charData.hair_length || ''} ${charData.hair_texture || ''} ${charData.hair_color || ''} hair with ${charData.hair_details || ''}`.replace(/\s+/g, ' ').trim();
      const bodyStr = `${charData.silhouette || ''} with ${charData.bust || ''}, ${charData.waist || ''}, ${charData.hips || ''}, and ${charData.limbs || ''}. ${charData.physique || ''}`.replace(/\s+/g, ' ').trim();
      const visualDna = `${faceStr}. Skin: ${skinStr}. Hair: ${hairStr}. Body: ${bodyStr}.`.replace(/\s+/g, ' ');

      const tagline = `${charData.ethnicity_ancestry || 'Fictional'} ${charData.gender_presentation || 'woman'}, ${charData.age_appearance || 'mid-20s'}`;

      const roleplayInstructions = `Use locked Image 1 (Face Lock), Image 2 (Body Lock), and Image 3 (Expression Lock) as the ground-truth identity reference set for ${charName}. Maintain identical facial structure (${faceStr}), skin texture (${skinStr}), hair (${hairStr}), and body proportions (${bodyStr}) across all generations.`;

      if (saveMode === 'new') {
        await api.saveCharacter({
          name: charName,
          tagline,
          visual_dna: visualDna,
          persona: 'Friendly, naturally expressive, candid human presence.',
          roleplay_instructions: roleplayInstructions,
          avatar_image_id: faceId || undefined,
          face_lock_image_id: faceId || undefined,
          body_lock_image_id: bodyId || undefined,
          expression_lock_image_id: expressionId || undefined,
          character_lock: structuredLock,
        });
      } else if (saveMode === 'existing' && targetCharId) {
        await api.saveCharacter({
          id: targetCharId,
          tagline,
          visual_dna: visualDna,
          roleplay_instructions: roleplayInstructions,
          avatar_image_id: faceId || undefined,
          face_lock_image_id: faceId || undefined,
          body_lock_image_id: bodyId || undefined,
          expression_lock_image_id: expressionId || undefined,
          character_lock: structuredLock,
        });
      }

      setSaveSuccess('Character cards & prompt merged successfully into Character Studio!');
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
      onRefreshCharacters();
      setTimeout(() => {
        setIsSaveModalOpen(false);
        setSaveSuccess(null);
      }, 1500);
    } catch (e: any) {
      alert('Save failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render Dynamic Interactive Token Highlight ──
  const renderInlineToken = (field: keyof typeof ARCHETYPES.kaya) => {
    const val = charData[field] || '';
    return (
      <span
        onClick={() => {
          hapticImpact('selection');
          setActivePickerField(field);
          setPickerSearch('');
        }}
        className="inline cursor-pointer px-1 py-0.5 rounded-sm bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-medium border-b border-emerald-500/50 hover:border-emerald-500 transition-all select-none"
        title={`Click to choose or edit ${String(field).replace(/_/g, ' ')}`}
      >
        {val}
      </span>
    );
  };

  // ── Document In-Card Generate Action Bar ──
  const renderPromptCardBottomBar = () => {
    const activeResult =
      currentStep === 'face'
        ? faceResult
        : currentStep === 'body'
        ? bodyResult
        : expressionResult;

    return (
      <div className="mt-5 pt-4 border-t border-border/60 hidden lg:flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles size={14} className="text-primary shrink-0" />
          <span className="font-medium">
            {currentStep === 'face'
              ? 'Step 1/3: 3-Angle Face Lock'
              : currentStep === 'body'
              ? 'Step 2/3: 4-View Body Lock'
              : 'Step 3/3: 2×3 Expression Sheet'}
          </span>
          {activeResult && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold">
              Ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {activeResult && (
            <button
              onClick={handleGenerateCurrentStep}
              disabled={isGenerating}
              className="min-h-[36px] flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 active:scale-95 disabled:opacity-50"
              title="Regenerate this step's reference card"
            >
              <RotateCcw size={12} />
              <span>Regen</span>
            </button>
          )}

          <button
            onClick={handleGenerateCurrentStep}
            disabled={isGenerating}
            className="min-h-[36px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-2xs active:scale-95 disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{generationProgress || 'Generating...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>
                  {activeResult ? 'Re-Generate' : 'Generate'}{' '}
                  {currentStep === 'face'
                    ? 'Face Card (4:3)'
                    : currentStep === 'body'
                    ? 'Body Card (4:3)'
                    : 'Expression Card (2×3)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── Step 1 Face Document View ──
  const renderFaceDocument = () => {
    return (
      <div className="text-xs sm:text-sm font-sans leading-relaxed text-foreground space-y-3">
        <p>
          Create a 4:3 high-resolution photorealistic face identity reference card for{' '}
          {renderInlineToken('character_name')}, a fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}. Show the same woman in three consistent facial views on one clean reference sheet: straight-on front view, left 3/4 view, and right 3/4 view.
        </p>

        <p>
          {charData.character_name} has a {renderInlineToken('face_shape')} face structure with {renderInlineToken('cheeks')}. She has {renderInlineToken('eye_size')} {renderInlineToken('eye_color')} eyes, framed by {renderInlineToken('brow_shape')} {renderInlineToken('brow_color')} eyebrows, a {renderInlineToken('nose')} nose, and {renderInlineToken('lip_shape')} {renderInlineToken('lip_color')} lips.
        </p>

        <p>
          Her skin tone is {renderInlineToken('skin_tone')} with {renderInlineToken('skin_undertone')}, featuring a {renderInlineToken('skin_texture')} texture.
        </p>

        <p>
          Her hair is {renderInlineToken('hair_length')}, {renderInlineToken('hair_texture')}, and {renderInlineToken('hair_color')}, styled with {renderInlineToken('hair_details')}.
        </p>

        <p>
          She wears {renderInlineToken('makeup')} and a {renderInlineToken('facial_expression')} so her actual facial identity is clearly visible. Plain neutral background, consistent soft natural lighting, realistic human anatomy and skin texture, no beauty filter, no facial reshaping, no stylization, and no excessive retouching. All three views depict exactly the same woman with identical facial structure and physical identity.
        </p>

        {renderPromptCardBottomBar()}
      </div>
    );
  };

  // ── Step 2 Body Document View ──
  const renderBodyDocument = () => {
    return (
      <div className="text-xs sm:text-sm font-sans leading-relaxed text-foreground space-y-3">
        <p>
          Create a 4:3 high-resolution photorealistic body identity reference card for{' '}
          {renderInlineToken('character_name')}, the same fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}. Show the same woman in four consistent full-body views on one clean reference sheet: straight-on front view, left side view, right side view, and back view.
        </p>

        <p>
          {charData.character_name} has a {renderInlineToken('silhouette')} with a {renderInlineToken('bust')}, {renderInlineToken('waist')}, and {renderInlineToken('hips')}, balanced by {renderInlineToken('limbs')}. Her abdomen has {renderInlineToken('abdomen')}, with an overall {renderInlineToken('physique')} physique.
        </p>

        <p>
          She is dressed in a {renderInlineToken('clothing')} that clearly shows her natural proportions without being revealing, standing in a {renderInlineToken('posture')}.
        </p>

        <p>
          Preserve her {renderInlineToken('skin_tone')} skin with {renderInlineToken('skin_undertone')} and {renderInlineToken('skin_texture')}. Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions. No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization. All four views depict exactly the same woman with identical body proportions.
        </p>

        {renderPromptCardBottomBar()}
      </div>
    );
  };

  // ── Step 3 Expression Document View ──
  const renderExpressionDocument = () => {
    return (
      <div className="text-xs sm:text-sm font-sans leading-relaxed text-foreground space-y-3">
        <p>
          Create a high-resolution photorealistic expression and selfie-realism reference card for{' '}
          {renderInlineToken('character_name')}, the same fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}. Show six expressions of the exact same woman in a clean 2×3 grid: relaxed neutral, soft genuine smile, playful smirk, subtle laugh, confident direct gaze, and soft thoughtful expression.
        </p>

        <p>
          Keep {charData.character_name}'s exact established facial identity in every panel: {renderInlineToken('face_shape')} with {renderInlineToken('cheeks')}, {renderInlineToken('eye_size')} {renderInlineToken('eye_color')} eyes, {renderInlineToken('brow_shape')} eyebrows, {renderInlineToken('nose')} nose, {renderInlineToken('lip_shape')} {renderInlineToken('lip_color')} lips, {renderInlineToken('skin_tone')} skin with {renderInlineToken('skin_undertone')}, and {renderInlineToken('hair_length')} {renderInlineToken('hair_texture')} {renderInlineToken('hair_color')} hair.
        </p>

        <p>
          Focus on {renderInlineToken('expression_realism')} and authentic emotion. Expressions should feel like a real person rather than exaggerated model poses, capturing {renderInlineToken('selfie_vibe')}.
        </p>

        <p>
          Consistent natural lighting, simple neutral background, realistic skin texture, photorealistic rendering, high resolution. No face redesign, beautification, excessive retouching, plastic skin, exaggerated expressions, or stylization. All six panels depict exactly the same woman with consistent identity.
        </p>

        {renderPromptCardBottomBar()}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden bg-background">
      {/* ── TOP STEPPER & STATUS HEADER ── */}
      {/* ── TOP STEPPER & STATUS HEADER ── */}
      <div className="border-b border-border bg-card px-2.5 sm:px-4 py-2 shrink-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
          {/* 3-Step Wizard Stepper */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
            {/* Step 1: Face */}
            <button
              onClick={() => handleStepChange('face')}
              className={`min-h-[36px] sm:min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'face'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isFaceConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isFaceConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'face'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isFaceConfirmed ? <Check size={11} strokeWidth={3} /> : '1'}
              </div>
              <span className="font-semibold text-xs">Face<span className="hidden sm:inline"> Lock</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden md:inline">4:3</span>
            </button>

            <span className="text-muted-foreground/40 font-mono text-[11px]">→</span>

            {/* Step 2: Body */}
            <button
              onClick={() => handleStepChange('body')}
              className={`min-h-[36px] sm:min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'body'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isBodyConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isBodyConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'body'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isBodyConfirmed ? <Check size={11} strokeWidth={3} /> : '2'}
              </div>
              <span className="font-semibold text-xs">Body<span className="hidden sm:inline"> Lock</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden md:inline">4:3</span>
            </button>

            <span className="text-muted-foreground/40 font-mono text-[11px]">→</span>

            {/* Step 3: Expression */}
            <button
              onClick={() => handleStepChange('expression')}
              className={`min-h-[36px] sm:min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'expression'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isExpressionConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isExpressionConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'expression'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isExpressionConfirmed ? <Check size={11} strokeWidth={3} /> : '3'}
              </div>
              <span className="font-semibold text-xs">Expr<span className="hidden sm:inline">ession</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden md:inline">2×3</span>
            </button>
          </div>

          {/* Right side: Mobile Prompt/Card segmented toggle + session actions */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            {/* Embedded Mobile View Switcher */}
            <div className="flex lg:hidden items-center p-0.5 bg-muted rounded-xl text-xs">
              <button
                onClick={() => {
                  hapticImpact('selection');
                  setMobileTab('prompt');
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 ${
                  mobileTab === 'prompt'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Prompt
              </button>
              <button
                onClick={() => {
                  hapticImpact('selection');
                  setMobileTab('preview');
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 active:scale-95 ${
                  mobileTab === 'preview'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Card</span>
                {(() => {
                  const activeResult =
                    currentStep === 'face'
                      ? faceResult
                      : currentStep === 'body'
                      ? bodyResult
                      : expressionResult;
                  return activeResult ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  ) : null;
                })()}
              </button>
            </div>

            {sessionConversationId ? (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>Thread Locked (#{sessionConversationId.slice(-6)})</span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground hidden md:inline font-mono">
                New Character Session
              </span>
            )}

            <button
              onClick={handleDiscardSession}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
              title="Reset current session and discard generated cards"
              aria-label="Discard session"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── THREAD CONTEXT CONFIRMATION BANNER (Desktop full, Mobile ultra-slim chip) ── */}
      {!sessionConversationId ? (
        <>
          {/* Desktop Banner */}
          <div className="hidden lg:flex bg-card border-b border-border px-3 sm:px-4 py-2 text-xs items-center justify-between gap-2.5 shrink-0 z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <MessageSquare size={14} className="text-primary" />
                <span>ChatGPT Thread:</span>
              </span>

              <div className="flex items-center p-1 bg-muted rounded-xl text-[11px]">
                <button
                  onClick={() => {
                    hapticImpact('selection');
                    setChatMode('new');
                    setTargetExistingChatId('');
                    api.resetConversation().catch(() => {});
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 active:scale-95 ${
                    chatMode === 'new'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles size={12} className="text-primary" />
                  <span>New Chat (Clean Slate)</span>
                </button>

                <button
                  onClick={() => {
                    hapticImpact('selection');
                    setChatMode('existing');
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 active:scale-95 ${
                    chatMode === 'existing'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>Attach to Existing Chat</span>
                </button>
              </div>

              {chatMode === 'existing' && (
                <select
                  value={targetExistingChatId}
                  onChange={(e) => setTargetExistingChatId(e.target.value)}
                  className="text-[11px] py-1 px-2 rounded-xl border border-border bg-card text-foreground max-w-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Choose Existing Thread --</option>
                  {availableChats.map((c) => {
                    const label = (c.title || c.last_prompt || 'Untitled Chat').slice(0, 30);
                    const cidSuffix = c.conversation_id ? ` · #${c.conversation_id.slice(-6)}` : '';
                    return (
                      <option key={c.conversation_id} value={c.conversation_id}>
                        {label} ({c.turns || 0} turns{cidSuffix})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div className="text-[11px] flex items-center gap-1.5 font-medium">
              {chatMode === 'new' ? (
                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-lg flex items-center gap-1.5 border border-primary/20">
                  <CheckCircle2 size={13} />
                  <span>Clean-slate session for {charData.character_name}</span>
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1.5 border border-amber-500/20">
                  <CheckCircle2 size={13} />
                  <span>Will attach to #{targetExistingChatId ? targetExistingChatId.slice(-6) : 'selected'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Mobile Slim Chip hidden to preserve vertical screen estate */}
        </>
      ) : (
        <div className="bg-primary/5 border-b border-primary/20 px-3 py-1.5 text-xs flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 text-primary font-mono text-[10px] sm:text-[11px] font-semibold border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>Thread Locked: #{sessionConversationId.slice(-8)}</span>
            </div>
            <span className="text-foreground/80 text-[10px] sm:text-[11px] hidden sm:inline">
              Identity Continuity Active
            </span>
          </div>

          <button
            onClick={handleDiscardSession}
            className="min-h-[28px] text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1 font-medium active:scale-95"
            title="Release conversation and reset wizard"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE: 2-COLUMN LAYOUT ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
        {/* ── LEFT COLUMN: Interactive Prompt Document ── */}
        <div className={`w-full lg:w-[54%] border-r border-border flex-col bg-card overflow-hidden ${
          mobileTab === 'prompt' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Sub-header Toolbar */}
          <div className="py-1.5 px-2.5 sm:p-3 sm:px-4 border-b border-border bg-muted/30 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground hidden sm:flex items-center gap-1.5">
                <Pencil size={13} className="text-primary" />
                <span>
                  {currentStep === 'face'
                    ? 'Face Reference Prompt'
                    : currentStep === 'body'
                    ? 'Body Reference Prompt'
                    : currentStep === 'expression'
                    ? 'Expression Reference Prompt'
                    : 'Character Summary'}
                </span>
              </span>

              {/* Archetype Quick-Bar */}
              <div className="flex items-center gap-1 text-[11px] overflow-x-auto scrollbar-none shrink-0">
                <span className="text-muted-foreground text-[10px] hidden md:inline font-mono">Preset:</span>
                {['nia', 'kaya', 'zia', 'nastya'].map((k) => (
                  <button
                    key={k}
                    onClick={() => handleSelectArchetype(k)}
                    className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 py-0.5 rounded-lg capitalize font-medium transition-all text-xs shrink-0 select-none active:scale-95 ${
                      charData.character_name.toLowerCase() === k
                        ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Quick Generate Button In Toolbar */}
              <button
                onClick={handleGenerateCurrentStep}
                disabled={isGenerating}
                className="min-h-[30px] sm:min-h-[34px] flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-2xs active:scale-95 disabled:opacity-60 shrink-0"
                title="Generate current step reference card"
              >
                {isGenerating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>Generate</span>
              </button>

              {/* Randomize Button */}
              <button
                onClick={handleRandomize}
                className="min-h-[30px] sm:min-h-[34px] flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs bg-muted hover:bg-muted/80 text-foreground transition-all shadow-2xs active:scale-95 border border-border"
                title="Randomize dynamic tokens with realistic harmonized values"
              >
                <Dices size={13} className="text-primary" />
                <span className="hidden sm:inline">Randomize</span>
              </button>

              {/* Toggle Interactive vs Raw */}
              <button
                onClick={() => {
                  hapticImpact('selection');
                  if (editorMode === 'tokens') {
                    setEditorMode('raw');
                    setCustomRawPrompt(effectivePrompt);
                  } else {
                    setEditorMode('tokens');
                  }
                }}
                className={`min-h-[30px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                  editorMode === 'raw'
                    ? 'bg-foreground text-background border-transparent'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle raw text editing"
              >
                {editorMode === 'raw' ? '✦ Tokens' : '✎ Raw'}
              </button>

              {/* Copy prompt */}
              <button
                onClick={handleCopyPrompt}
                className="min-w-[30px] sm:min-w-[40px] min-h-[30px] sm:min-h-[34px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                title="Copy prompt text"
              >
                {copiedPrompt ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Document Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-6">
            {editorMode === 'raw' ? (
              <div className="h-full flex flex-col space-y-2">
                <textarea
                  value={effectivePrompt}
                  onChange={(e) => setCustomRawPrompt(e.target.value)}
                  rows={20}
                  className="w-full flex-1 text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed bg-muted/20 p-3 sm:p-4 rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none shadow-inner"
                  placeholder="Raw prompt editor..."
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>💡 Direct text edits are active.</span>
                  {customRawPrompt !== null && (
                    <button
                      onClick={() => setCustomRawPrompt(null)}
                      className="text-amber-600 dark:text-amber-400 font-medium hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={11} />
                      <span>Revert</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-card p-3.5 sm:p-7 rounded-xl sm:rounded-2xl border border-border/80 shadow-xs">
                {currentStep === 'face' && renderFaceDocument()}
                {currentStep === 'body' && renderBodyDocument()}
                {currentStep === 'expression' && renderExpressionDocument()}
                {currentStep === 'completed' && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mx-auto">
                      <CheckCircle2 size={36} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        All 3 Reference Cards Locked!
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Face Turnaround (Image 1), Body Turnaround (Image 2), and Expression Grid (Image 3) have been generated in the same thread.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        hapticImpact('medium');
                        setIsSaveModalOpen(true);
                      }}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95"
                    >
                      Save to Character Card
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Left-Column Action Bar */}
          <div className="hidden lg:flex p-3 px-4 border-t border-border bg-card items-center justify-between gap-3 shrink-0">
            {(() => {
              const activeResult =
                currentStep === 'face'
                  ? faceResult
                  : currentStep === 'body'
                  ? bodyResult
                  : expressionResult;

              if (activeResult) {
                return (
                  <div className="w-full flex items-center justify-between gap-2">
                    <button
                      onClick={handleGenerateCurrentStep}
                      disabled={isGenerating}
                      className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      <span>Regenerate Card</span>
                    </button>

                    {currentStep === 'face' && (
                      <button
                        onClick={handleConfirmFace}
                        className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm active:scale-95"
                      >
                        <span>Pass & Proceed to Body Lock</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {currentStep === 'body' && (
                      <button
                        onClick={handleConfirmBody}
                        className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm active:scale-95"
                      >
                        <span>Pass & Proceed to Expression Lock</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {currentStep === 'expression' && (
                      <button
                        onClick={handleConfirmExpression}
                        className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm active:scale-95"
                      >
                        <span>Pass & Finalize Character</span>
                        <Check size={14} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <button
                  onClick={handleGenerateCurrentStep}
                  disabled={isGenerating}
                  className="w-full min-h-[48px] h-12 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm active:scale-95 disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{generationProgress || 'Generating Card in ChatGPT...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>
                        Generate{' '}
                        {currentStep === 'face'
                          ? 'Face Card (4:3)'
                          : currentStep === 'body'
                          ? 'Body Card (4:3)'
                          : 'Expression Card (2×3)'}
                      </span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Reference Card Review & Pass Gate ── */}
        <div className={`w-full lg:w-[46%] flex-col bg-muted/20 overflow-y-auto p-4 sm:p-6 space-y-5 ${
          mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Card Result or Ready Card */}
          {(() => {
            const activeResult =
              currentStep === 'face'
                ? faceResult
                : currentStep === 'body'
                ? bodyResult
                : expressionResult;

            if (activeResult) {
              return (
                <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden shadow-md animate-fade flex flex-col">
                  {/* Header */}
                  <div className="p-3 px-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-primary" />
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          {currentStep === 'face'
                            ? 'Face Reference Card (Image 1)'
                            : currentStep === 'body'
                            ? 'Body Reference Card (Image 2)'
                            : 'Expression Reference Card (Image 3)'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Review sheet below. Pass to lock or Regenerate.
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-muted-foreground text-right shrink-0">
                      {activeResult.duration_s ? `${activeResult.duration_s.toFixed(1)}s` : ''} · {activeResult.account_used || 'Primary'}
                    </div>
                  </div>

                  {/* Image Display */}
                  <div className="relative aspect-[4/3] w-full bg-black/50 flex items-center justify-center overflow-hidden group">
                    <img
                      src={activeResult.image_url}
                      alt="Generated Reference Sheet"
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() =>
                        onOpenViewer &&
                        onOpenViewer({
                          id: activeResult.image_url.split('/').pop() || 'card',
                          url: activeResult.image_url,
                          prompt: effectivePrompt,
                          favorite: false,
                          conversation_id: activeResult.conversation_id,
                          created_at: Date.now() / 1000,
                          duration_s: activeResult.duration_s,
                          account_used: activeResult.account_used,
                          size_bytes: activeResult.size_bytes || null,
                          md5: null,
                          tweaked_prompt: null,
                          tweaked_prompt_2: null,
                        })
                      }
                    />

                    <button
                      onClick={() =>
                        onOpenViewer &&
                        onOpenViewer({
                          id: activeResult.image_url.split('/').pop() || 'card',
                          url: activeResult.image_url,
                          prompt: effectivePrompt,
                          favorite: false,
                          conversation_id: activeResult.conversation_id,
                          created_at: Date.now() / 1000,
                          duration_s: activeResult.duration_s,
                          account_used: activeResult.account_used,
                          size_bytes: activeResult.size_bytes || null,
                          md5: null,
                          tweaked_prompt: null,
                          tweaked_prompt_2: null,
                        })
                      }
                      className="absolute top-3 right-3 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs hover:bg-black/80"
                      title="Inspect full screen"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>

                  {/* Step Confirmation & Next Action Bar (Desktop only, mobile uses sticky footer) */}
                  <div className="hidden lg:flex p-3.5 bg-card border-t border-border flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <button
                      onClick={handleGenerateCurrentStep}
                      disabled={isGenerating}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 border border-border transition-colors active:scale-95 disabled:opacity-50"
                      title="Regenerate this step's reference card"
                    >
                      <RotateCcw size={13} />
                      <span>Regenerate</span>
                    </button>

                    {currentStep === 'face' && (
                      <button
                        onClick={handleConfirmFace}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                      >
                        <span>✓ Pass & Proceed to Body Lock</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {currentStep === 'body' && (
                      <button
                        onClick={handleConfirmBody}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                      >
                        <span>✓ Pass & Proceed to Expression Lock</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {currentStep === 'expression' && (
                      <button
                        onClick={handleConfirmExpression}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                      >
                        <span>✓ Pass & Finalize Character</span>
                        <Check size={14} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Before Generation Card
            return (
              <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8 bg-card flex flex-col items-center justify-center text-center space-y-4 shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  {currentStep === 'face' ? (
                    <User size={28} />
                  ) : currentStep === 'body' ? (
                    <UserCheck size={28} />
                  ) : (
                    <Smile size={28} />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {currentStep === 'face'
                      ? 'Ready to Generate Face Lock Card'
                      : currentStep === 'body'
                      ? 'Ready to Generate Body Lock Card'
                      : 'Ready to Generate Expression Lock Card'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {currentStep === 'face'
                      ? `Renders a 4:3 high-res sheet with 3 consistent views to lock ${charData.character_name}'s facial features, skin, eyes, and hair.`
                      : currentStep === 'body'
                      ? `Generates 4 full-body panels (Front, Left, Right, Back) in the exact same thread to match ${charData.character_name}'s face and skin perfectly.`
                      : `Generates a clean 2×3 grid with 6 expressions in the same thread to capture natural animation and selfie realism.`}
                  </p>
                </div>

                <button
                  onClick={handleGenerateCurrentStep}
                  disabled={isGenerating}
                  className="w-full max-w-xs min-h-[48px] h-12 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{generationProgress || 'Generating Card...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>
                        Generate{' '}
                        {currentStep === 'face'
                          ? 'Face Card (4:3)'
                          : currentStep === 'body'
                          ? 'Body Card (4:3)'
                          : 'Expression Card (2×3)'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Locked Cards Showcase */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground block">
              Character Reference Locks
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Slot 1: Face */}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <span>1. Face Lock</span>
                  {isFaceConfirmed && <Check size={11} className="text-primary" strokeWidth={3} />}
                </span>
                <div
                  onClick={() => handleStepChange('face')}
                  className={`aspect-[4/3] rounded-xl border overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
                    currentStep === 'face'
                      ? 'ring-2 ring-primary border-primary'
                      : 'border-border hover:border-border/80'
                  } bg-card`}
                >
                  {faceResult ? (
                    <img src={faceResult.image_url} alt="Face Lock" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-muted-foreground/40" />
                  )}
                </div>
              </div>

              {/* Slot 2: Body */}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <span>2. Body Lock</span>
                  {isBodyConfirmed && <Check size={11} className="text-primary" strokeWidth={3} />}
                </span>
                <div
                  onClick={() => isFaceConfirmed && handleStepChange('body')}
                  className={`aspect-[4/3] rounded-xl border overflow-hidden flex items-center justify-center transition-all ${
                    !isFaceConfirmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    currentStep === 'body'
                      ? 'ring-2 ring-primary border-primary'
                      : 'border-border hover:border-border/80'
                  } bg-card`}
                >
                  {bodyResult ? (
                    <img src={bodyResult.image_url} alt="Body Lock" className="w-full h-full object-cover" />
                  ) : (
                    <UserCheck size={20} className="text-muted-foreground/40" />
                  )}
                </div>
              </div>

              {/* Slot 3: Expression */}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <span>3. Expression Lock</span>
                  {isExpressionConfirmed && <Check size={11} className="text-primary" strokeWidth={3} />}
                </span>
                <div
                  onClick={() => isBodyConfirmed && handleStepChange('expression')}
                  className={`aspect-[4/3] rounded-xl border overflow-hidden flex items-center justify-center transition-all ${
                    !isBodyConfirmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    currentStep === 'expression'
                      ? 'ring-2 ring-primary border-primary'
                      : 'border-border hover:border-border/80'
                  } bg-card`}
                >
                  {expressionResult ? (
                    <img src={expressionResult.image_url} alt="Expression Lock" className="w-full h-full object-cover" />
                  ) : (
                    <Smile size={20} className="text-muted-foreground/40" />
                  )}
                </div>
              </div>
            </div>

            {/* Quick action to save once ready */}
            {(faceResult || bodyResult || expressionResult) && (
              <button
                onClick={() => {
                  hapticImpact('medium');
                  setIsSaveModalOpen(true);
                }}
                className="w-full min-h-[44px] mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-muted bg-card text-foreground transition-colors shadow-2xs active:scale-95"
              >
                <Save size={14} className="text-primary" />
                <span>Save Progress to Character Card</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE STICKY ACTION FOOTER (< lg only) ── */}
      <div className="lg:hidden px-3 py-2 border-t border-border bg-card/95 backdrop-blur-md shrink-0 z-30">
        {(() => {
          const activeResult =
            currentStep === 'face'
              ? faceResult
              : currentStep === 'body'
              ? bodyResult
              : expressionResult;

          if (isGenerating) {
            return (
              <div className="w-full min-h-[40px] h-10 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary shadow-xs">
                <Loader2 size={15} className="animate-spin" />
                <span className="truncate">{generationProgress || 'Generating Card in ChatGPT…'}</span>
              </div>
            );
          }

          if (activeResult) {
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateCurrentStep}
                  className="min-h-[40px] h-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 active:scale-95 shrink-0"
                  title="Regenerate this step's reference card"
                >
                  <RotateCcw size={13} />
                  <span>Regen</span>
                </button>

                {currentStep === 'face' && (
                  <button
                    onClick={handleConfirmFace}
                    className="flex-1 min-h-[40px] h-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-xs active:scale-95"
                  >
                    <span>✓ Pass & Next to Body</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {currentStep === 'body' && (
                  <button
                    onClick={handleConfirmBody}
                    className="flex-1 min-h-[40px] h-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-xs active:scale-95"
                  >
                    <span>✓ Pass & Next to Expr</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {currentStep === 'expression' && (
                  <button
                    onClick={handleConfirmExpression}
                    className="flex-1 min-h-[40px] h-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-xs active:scale-95"
                  >
                    <span>✓ Finalize Character</span>
                    <Check size={13} strokeWidth={3} />
                  </button>
                )}
              </div>
            );
          }

          // Before generation on this step
          return (
            <button
              onClick={handleGenerateCurrentStep}
              className="w-full min-h-[40px] h-10 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-xs active:scale-95"
            >
              <Sparkles size={15} />
              <span>
                Generate{' '}
                {currentStep === 'face'
                  ? 'Face Card (4:3)'
                  : currentStep === 'body'
                  ? 'Body Card (4:3)'
                  : 'Expression Card (2×3)'}
              </span>
            </button>
          );
        })()}
      </div>

      {/* ── INLINE TOKEN PICKER POPOVER / MODAL ── */}
      {activePickerField && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-2xs animate-fade"
          onClick={() => setActivePickerField(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-slide-up sm:animate-fade"
          >
            {/* Header */}
            <div className="p-3.5 px-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div>
                <span className="text-xs font-semibold text-foreground capitalize">
                  Edit {String(activePickerField).replace(/_/g, ' ')}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Search presets or enter any custom trait
                </p>
              </div>

              <button
                onClick={() => setActivePickerField(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search / Custom write-in input */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pickerSearch.trim()) {
                      handleUpdateToken(activePickerField, pickerSearch.trim());
                    }
                  }}
                  placeholder={`Search or type custom ${String(activePickerField).replace(/_/g, ' ')}...`}
                  className="w-full min-h-[40px] pl-9 pr-4 py-2 text-xs rounded-xl bg-muted/40 border border-border focus:border-primary focus:bg-card text-foreground focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-64">
              {/* Custom Value Option if query is non-empty */}
              {pickerSearch.trim() && (
                <button
                  onClick={() => handleUpdateToken(activePickerField, pickerSearch.trim())}
                  className="w-full min-h-[40px] text-left p-2.5 px-3 rounded-xl text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium flex items-center justify-between border border-primary/30 transition-colors"
                >
                  <span className="truncate">✨ Use custom: "{pickerSearch.trim()}"</span>
                  <span className="text-[10px] opacity-75 font-mono">Press ↵</span>
                </button>
              )}

              {/* Dictionary Options Filtered */}
              {((DICTIONARY_OPTIONS as any)[activePickerField] || [])
                .filter((opt: string) => opt.toLowerCase().includes(pickerSearch.toLowerCase()))
                .map((opt: string) => {
                  const isCurrent = charData[activePickerField] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleUpdateToken(activePickerField, opt)}
                      className={`w-full min-h-[40px] text-left p-2.5 px-3 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="capitalize">{opt}</span>
                      {isCurrent && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE CHARACTER MODAL ── */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Save size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Save Reference Sheet Character
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Preserve Face, Body, and Expression cards in Studio
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {saveSuccess ? (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              ) : (
                <>
                  <div className="flex rounded-xl bg-muted p-1 gap-1">
                    <button
                      onClick={() => {
                        hapticImpact('selection');
                        setSaveMode('new');
                      }}
                      className={`flex-1 min-h-[36px] py-1.5 rounded-lg text-xs font-medium transition-all ${
                        saveMode === 'new'
                          ? 'bg-card text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      New Character
                    </button>
                    <button
                      onClick={() => {
                        hapticImpact('selection');
                        setSaveMode('existing');
                      }}
                      className={`flex-1 min-h-[36px] py-1.5 rounded-lg text-xs font-medium transition-all ${
                        saveMode === 'existing'
                          ? 'bg-card text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Update Existing
                    </button>
                  </div>

                  {saveMode === 'new' ? (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Character Name
                      </label>
                      <input
                        type="text"
                        value={charData.character_name}
                        onChange={(e) => setCharData({ ...charData, character_name: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-border bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. Kaya"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Select Character to Update
                      </label>
                      <select
                        value={targetCharId}
                        onChange={(e) => setTargetCharId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-border bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Choose Character --</option>
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="bg-muted/40 p-3 rounded-xl border border-border text-[11px] text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Face Lock:</span>
                      <span className="font-medium text-foreground">{faceResult ? 'Ready ✓' : 'None'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Body Lock:</span>
                      <span className="font-medium text-foreground">{bodyResult ? 'Ready ✓' : 'None'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Expression Lock:</span>
                      <span className="font-medium text-foreground">{expressionResult ? 'Ready ✓' : 'None'}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCharacter}
                    disabled={isSaving || (saveMode === 'existing' && !targetCharId)}
                    className="w-full min-h-[48px] h-12 py-2.5 rounded-xl font-semibold text-sm text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Confirm & Save Character</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
