import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ChevronDown,
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
  Eye,
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
const DRAFT_STORAGE_KEY = 'bridge:card_wizard_draft';

// ── Dictionary & Presets ──
const DICTIONARY_OPTIONS = {
  character_name: ['Kaya', 'Priya', 'Anya', 'Elena', 'Mei', 'Zara', 'Amara', 'Leila', 'Sophia'],
  ethnicity_ancestry: [
    'Indian',
    'South Asian',
    'North Indian',
    'Bengali',
    'Punjabi',
    'East Asian',
    'Southeast Asian',
    'Middle Eastern',
    'Mediterranean',
    'Scandinavian / Nordic',
    'Western European',
    'Celtic / Irish',
    'African',
    'West African',
    'Latin American',
    'mixed ancestry',
  ],
  gender_presentation: ['woman', 'man', 'person'],
  age_appearance: ['early 20s', 'mid-20s', 'late 20s', 'early 30s', 'mid-30s'],
  
  // Face specific
  face_structure: [
    'soft feminine face with fuller plush cheeks',
    'defined oval face with high cheekbones and soft jawline',
    'heart-shaped face with delicate chin and sculpted cheeks',
    'sculpted square jaw with defined bone structure',
    'round soft face with youthful apple cheeks',
    'lean aristocratic face with subtle hollow cheeks',
  ],
  eyes: [
    'large expressive hazel-brown to warm light-brown eyes',
    'deep almond dark brown eyes with dense dark lashes',
    'striking amber-brown eyes with bright catchlights',
    'warm deep-set espresso eyes with soft gaze',
    'expressive luminous honey-brown eyes',
    'large doe-like dark eyes with natural moisture',
  ],
  eyebrows: [
    'natural dark expressive eyebrows',
    'softly arched medium-full dark brown brows',
    'straight modern feathered natural brows',
    'delicately arched fine dark eyebrows',
    'bold structured feathered brows',
  ],
  nose: [
    'a small refined natural nose',
    'straight narrow nose with soft rounded tip',
    'delicate button nose with subtle bridge',
    'refined classical straight nose',
    'gentle curved nose with soft natural tip',
  ],
  lips: [
    'soft pink naturally plush lips',
    'full pillowy lips with defined cupid\'s bow',
    'moderately full natural rosy lips',
    'softly defined peach-toned plush lips',
    'naturally full lower lip with soft pink tone',
  ],
  skin_tone_undertone: [
    'bright natural milky-white with subtle peach-pink warmth',
    'warm golden olive with radiant sunlit undertones',
    'warm honey-beige with luminous golden warmth',
    'fair porcelain with delicate rose undertones',
    'medium warm tan with golden undertones',
    'deep rich espresso with warm caramel undertones',
  ],
  skin_texture: [
    'smooth but realistic, with visible natural pores, slight tonal variation, and soft healthy luminosity',
    'ultra-realistic human skin texture with subtle micro-pores and satin sheen',
    'dewy natural texture with delicate radiance and visible pores',
    'natural soft matte texture with authentic skin grain',
  ],
  hair_description: [
    'long, thick, naturally voluminous dark brown-to-black hair',
    'waist-length soft wavy dark chocolate-brown hair',
    'medium-length shoulder-sweeping voluminous silky black hair',
    'long sleek straight jet-black hair',
    'textured wavy rich dark espresso hair with natural volume',
  ],
  hair_details: [
    'warm golden/caramel face-framing strands',
    'subtle honey highlights catching the light',
    'soft baby hairs along the hairline',
    'glossy natural highlights without artificial dye',
    'delicate sun-kissed strands around the face',
  ],
  makeup_expression: [
    'minimal natural makeup and a relaxed neutral expression',
    'bare-faced clean look with soft neutral expression',
    'delicate mascara and tinted balm with gentle calm expression',
    'soft dewy natural makeup with slight pleasant resting expression',
  ],

  // Body specific
  presence_silhouette: [
    'tall-looking feminine presence and dramatic curvy hourglass silhouette',
    'balanced feminine silhouette with graceful tall presence',
    'soft petite curvy silhouette with delicate proportions',
    'slender elegant silhouette with statuesque presence',
    'dramatic feminine silhouette with prominent curves',
  ],
  proportions_limbs: [
    'soft balanced shoulders, a very prominent natural bust, clearly narrow defined waist, wide rounded hips, full soft thighs, long-looking feminine legs, and soft naturally full arms',
    'graceful balanced shoulders, moderate bust, defined waist, naturally curved hips, lean toned legs, and slender arms',
    'soft natural curves, full bust, narrow waist, rounded hips, plush thighs, and soft feminine limbs',
    'classic feminine proportions with narrow waist, wide hips, shapely legs, and soft arms',
  ],
  abdomen: [
    'natural gentle lower-belly softness, without visible abdominal definition or athletic muscularity',
    'flat soft feminine stomach without visible muscle lines',
    'smooth natural abdomen with gentle organic contours and realistic softness',
  ],
  physique: [
    'soft, plush, curvy, feminine, and naturally proportioned, not muscular or bodybuilder-like',
    'fit, natural, feminine, and healthy with soft curves',
    'slender, soft, graceful, and naturally balanced',
    'naturally full-figured, soft, plush, and voluptuous',
  ],
  clothing: [
    'skim , NO clothing',
    'minimal neutral reference sports set',
    'simple close-fitting neutral reference attire',
    'skimpy neutral reference two-piece',
  ],
  posture: [
    'Neutral relaxed standing posture, feet visible, arms naturally positioned',
    'Confident relaxed posture, weight evenly distributed, feet visible',
    'Graceful natural standing posture, shoulders relaxed, arms at sides',
  ],

  // Expression specific
  expression_focus: [
    'natural eye behavior and facial movement: realistic catchlights, active gaze, eyelid movement, lower-lid engagement, eyebrow movement, cheek movement, natural mouth shapes, and believable emotional variation',
    'authentic emotional subtlety, micro-expressions, lively catchlights, relaxed facial muscle tone, and expressive mouth shapes',
    'candid human presence, nuanced smile variations, expressive eyebrow play, and realistic eye engagement',
  ],
  selfie_vibe: [
    'subtle smartphone/selfie realism while keeping the face clearly visible',
    'candid portrait presence with natural focal depth',
    'intimate authentic selfie perspective with clear facial lighting',
  ],
};

// Preset Archetypes
const ARCHETYPES: Record<string, any> = {
  nia: {
    character_name: 'Nia',
    ethnicity_ancestry: 'Nordic-Irish',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    face_structure: 'delicate heart-shaped Celtic face with high cheekbones and soft natural jawline',
    eyes: 'striking sea-glass green eyes with bright natural catchlights',
    eyebrows: 'softly arched natural light-auburn brows',
    nose: 'small natural freckled nose',
    lips: 'soft rose-tinted natural plush lips',
    skin_tone_undertone: 'pale porcelain skin with subtle warm freckles across bridge and cheeks',
    skin_texture: 'authentic natural human skin texture with delicate pores and subtle tone variations',
    hair_description: 'tousled wavy copper-strawberry auburn hair with windblown natural volume',
    hair_details: 'wispy face-framing strands and delicate baby hairs',
    makeup_expression: 'completely bare-faced natural look with earnest gentle expression',

    presence_silhouette: 'dramatic ultra curvy hourglass silhouette with zero excess body fat',
    proportions_limbs: 'prominent ultra natural bust, clearly narrow tiny defined waist, wide rounded curvy hips, soft feminine thighs, and soft naturally full arms',
    abdomen: 'tight, flat, toned natural abdomen with zero fat, smooth feminine waist contour without athletic bulk',
    physique: 'ultra voluptuous, curvy, feminine, and naturally proportioned with zero fat, tiny waist and wide hips',
    clothing: 'simple unadorned rustic minimal slip that clearly shows her natural proportions without being revealing',
    posture: 'Neutral relaxed standing posture, feet visible, arms naturally positioned',

    expression_focus: 'natural eye behavior, earnest gaze, delicate micro-expressions, authentic catchlights',
    selfie_vibe: 'intimate candid authentic presence with natural focal depth',
  },
  kaya: {
    character_name: 'Kaya',
    ethnicity_ancestry: 'Indian',
    gender_presentation: 'woman',
    age_appearance: 'mid-20s',
    face_structure: 'soft feminine face with fuller plush cheeks',
    eyes: 'large expressive hazel-brown to warm light-brown eyes',
    eyebrows: 'natural dark expressive eyebrows',
    nose: 'a small refined natural nose',
    lips: 'soft pink naturally plush lips',
    skin_tone_undertone: 'bright natural milky-white with subtle peach-pink warmth',
    skin_texture: 'smooth but realistic, with visible natural pores, slight tonal variation, and soft healthy luminosity',
    hair_description: 'long, thick, naturally voluminous dark brown-to-black hair',
    hair_details: 'warm golden/caramel face-framing strands',
    makeup_expression: 'minimal natural makeup and a relaxed neutral expression',
    
    presence_silhouette: 'tall-looking feminine presence and dramatic curvy hourglass silhouette',
    proportions_limbs: 'soft balanced shoulders, a very prominent natural bust, clearly narrow defined waist, wide rounded hips and prominent curved rear, full soft thighs, long-looking feminine legs, and soft naturally full arms',
    abdomen: 'natural gentle lower-belly softness, without visible abdominal definition or athletic muscularity',
    physique: 'soft, plush, curvy, feminine, and naturally proportioned with prominent natural curves, not muscular or bodybuilder-like',
    clothing: 'minimal neutral reference attire that clearly shows her natural proportions without being revealing',
    posture: 'Neutral relaxed standing posture, feet visible, arms naturally positioned',

    expression_focus: 'natural eye behavior and facial movement: realistic catchlights, active gaze, eyelid movement, lower-lid engagement, eyebrow movement, cheek movement, natural mouth shapes, and believable emotional variation',
    selfie_vibe: 'subtle smartphone/selfie realism while keeping the face clearly visible',
  },
  zia: {
    character_name: 'Zia',
    ethnicity_ancestry: 'Biracial Black-White American',
    gender_presentation: 'woman',
    age_appearance: 'mid-20s',
    face_structure: 'radiant oval face with defined cheekbones and warm soft jawline',
    eyes: 'warm amber-brown eyes with thick natural lashes and lively catchlights',
    eyebrows: 'naturally defined softly arched dark brows',
    nose: 'softly sculpted natural nose with balanced bridge',
    lips: 'full warm caramel-toned plush lips',
    skin_tone_undertone: 'warm sun-kissed golden honey-caramel with luminous radiant undertones',
    skin_texture: 'smooth healthy skin with satin finish, visible pores, and athletic glow',
    hair_description: 'voluminous shoulder-length bouncy textured dark spiral curls',
    hair_details: 'naturally defined coil texture with sunlit highlights',
    makeup_expression: 'bare-faced clean athletic look with confident calm gaze',

    presence_silhouette: 'lean athletic feminine silhouette with balanced proportions and graceful posture',
    proportions_limbs: 'sculpted shoulders, average natural firm bust, defined narrow waist, naturally proportioned athletic hips, toned thighs, and sleek sculpted legs',
    abdomen: 'lean, flat, softly defined athletic stomach without excessive bodybuilder definition',
    physique: 'athletic, fit, toned, and naturally feminine with healthy lean proportions',
    clothing: 'minimal neutral athletic reference two-piece that clearly shows her natural proportions without being revealing',
    posture: 'Confident upright athletic standing posture, shoulders relaxed, feet visible, arms at sides',

    expression_focus: 'confident direct gaze, natural catchlights, relaxed facial muscle tone, expressive warmth',
    selfie_vibe: 'fresh authentic portrait presence with natural ambient light',
  },
  nastya: {
    character_name: 'Nastya',
    ethnicity_ancestry: 'Slavic Russian',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    face_structure: 'soft delicate Slavic facial structure with soft cheek contour and refined chin',
    eyes: 'clear icy blue-gray eyes with delicate lash line',
    eyebrows: 'soft straight natural ash-blonde brows',
    nose: 'small neat straight button nose',
    lips: 'naturally full plush petal-pink lips',
    skin_tone_undertone: 'fair alabaster with cool rose-peach undertones and natural soft luminosity',
    skin_texture: 'delicate dewy skin texture with natural micro-pores and satin softness',
    hair_description: 'long straight-to-softly-wavy natural ash-blonde hair falling to mid-back',
    hair_details: 'soft platinum-blonde strands catching the light around temples',
    makeup_expression: 'minimal natural makeup, soft pink lip balm, calm serene expression',

    presence_silhouette: 'voluptuous natural soft silhouette with prominent curves and tall elegant posture',
    proportions_limbs: 'soft balanced shoulders, big natural bust, clearly narrow defined waist, wide rounded hips and prominent rear curve, soft full thighs, graceful legs',
    abdomen: 'smooth flat feminine stomach with no belly fat and natural organic softness',
    physique: 'natural soft, plush, curvy, feminine, and voluptuous, with big bust and curved hips, no belly fat',
    clothing: 'simple close-fitting neutral reference attire that clearly shows her natural proportions without being revealing',
    posture: 'Neutral relaxed standing posture, feet visible, arms naturally positioned',

    expression_focus: 'serene gaze, subtle authentic smile, lively natural catchlights, relaxed eyelid engagement',
    selfie_vibe: 'natural ambient lighting with soft candid realism',
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
    return `Create a 4:3 high-resolution photorealistic **FACE IDENTITY REFERENCE CARD** for ${charData.character_name}, a fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show the **same ${charData.gender_presentation}** in three consistent facial views on one clean reference sheet:

1. straight-on front view
2. left 3/4 view
3. right 3/4 view

${charData.character_name} has a ${charData.face_structure}, ${charData.eyes}, ${charData.eyebrows}, ${charData.nose}, and ${charData.lips}.
Her skin is **${charData.skin_tone_undertone}**, ${charData.skin_texture}. Never chalky, waxy, plastic, or overly airbrushed.
Her hair is **${charData.hair_description}**, with distinctive **${charData.hair_details}**.
Use ${charData.makeup_expression} so her actual facial identity is clearly visible.
Plain neutral background, consistent soft natural lighting, realistic human anatomy, realistic skin texture, no beauty filter, no facial reshaping, no stylization, no excessive retouching.
All three views must depict **exactly the same ${charData.gender_presentation}** with identical facial structure and physical identity.
No text except label of side and title
Purpose: **FACE LOCK — this image is the primary reference for ${charData.character_name}'s facial identity, skin, eyes, hair, and recognizable features.**`.trim();
  }, [charData]);

  const compiledBodyPrompt = useMemo(() => {
    const pronoun = charData.gender_presentation === 'man' ? 'his' : 'her';
    return `Create a 4:3 high-resolution photorealistic **BODY IDENTITY REFERENCE CARD** for ${charData.character_name}, the same fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show the **same woman** in three consistent full-body views on one clean reference sheet:

1. front view
2. left side view
3. Right side view
4. back view

${charData.character_name} has a **${charData.presence_silhouette}** with ${charData.proportions_limbs}.
Her abdomen has **${charData.abdomen}**.
Her overall physique is **${charData.physique}**.
Use ${charData.clothing} that clearly shows her natural proportions without being revealing. ${charData.posture}.
Preserve her ${charData.skin_tone_undertone} and realistic human skin texture.
Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions.
No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization.
All three views must depict **exactly the same woman with identical body proportions**.
No text except label of side and title
Purpose: **BODY LOCK — this image is the primary reference for ${charData.character_name}'s body proportions, silhouette, and physical structure.**`.trim();
  }, [charData]);

  const compiledExpressionPrompt = useMemo(() => {
    const pronoun = charData.gender_presentation === 'man' ? 'his' : 'her';
    return `Create a high-resolution photorealistic **EXPRESSION AND SELFIE-REALISM REFERENCE CARD** for ${charData.character_name}, the same fictional adult ${charData.ethnicity_ancestry} ${charData.gender_presentation} in ${pronoun} ${charData.age_appearance}.
Show **six expressions of the exact same woman** in a clean 2×3 grid:

1. relaxed neutral
2. soft genuine smile
3. playful smirk
4. subtle laugh
5. confident direct gaze
6. soft thoughtful expression

Keep ${charData.character_name}'s exact established facial identity in every panel: ${charData.face_structure}, ${charData.eyes}, ${charData.eyebrows}, ${charData.nose}, ${charData.lips}, ${charData.skin_tone_undertone}, and ${charData.hair_description} with ${charData.hair_details}.
Focus on **${charData.expression_focus}**.
Expressions should feel like a real person rather than exaggerated model poses. Include ${charData.selfie_vibe}.
Consistent natural lighting, simple neutral background, realistic skin texture, photorealistic rendering, high resolution.
No face redesign, beautification, excessive retouching, plastic skin, exaggerated expressions, or stylization.

No text except label of side and title
Purpose: **EXPRESSION LOCK — this image establishes ${charData.character_name}'s natural facial animation, eye behavior, expression range, and realistic selfie presence.**`.trim();
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

      if (saveMode === 'new') {
        await api.saveCharacter({
          name: charData.character_name || 'Kaya',
          tagline: `${charData.ethnicity_ancestry} ${charData.gender_presentation}, ${charData.age_appearance}`,
          visual_dna: `${charData.face_structure}, ${charData.eyes}, ${charData.skin_tone_undertone}, ${charData.hair_description}. Body: ${charData.presence_silhouette}, ${charData.physique}.`,
          persona: 'Friendly, naturally expressive, candid human presence.',
          roleplay_instructions: 'Photorealistic reference sheet, natural soft daylight, clean neutral studio background, 4:3 aspect ratio.',
          avatar_image_id: faceId || undefined,
          face_lock_image_id: faceId || undefined,
          body_lock_image_id: bodyId || undefined,
          expression_lock_image_id: expressionId || undefined,
          character_lock: structuredLock,
        });
      } else if (saveMode === 'existing' && targetCharId) {
        await api.saveCharacter({
          id: targetCharId,
          face_lock_image_id: faceId || undefined,
          body_lock_image_id: bodyId || undefined,
          expression_lock_image_id: expressionId || undefined,
          character_lock: structuredLock,
        });
      }

      setSaveSuccess('Character cards saved successfully!');
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

  // ── Render Dynamic Interactive Token Pill ──
  const renderInlineToken = (field: keyof typeof ARCHETYPES.kaya) => {
    const val = charData[field] || '';
    return (
      <span
        onClick={() => {
          hapticImpact('selection');
          setActivePickerField(field);
          setPickerSearch('');
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 my-0.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500 cursor-pointer transition-all shadow-2xs group select-none active:scale-95"
        title={`Click to choose or edit ${String(field).replace(/_/g, ' ')}`}
      >
        <span>{val}</span>
        <ChevronDown size={11} className="text-emerald-600 dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
      </span>
    );
  };

  // ── Step 1 Face Document View ──
  const renderFaceDocument = () => {
    return (
      <div className="space-y-4 text-xs font-serif leading-relaxed text-foreground">
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
          <span>Face Turnaround Reference Sheet · 4:3 Landscape</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">Step 1 of 3</span>
        </p>

        <p>
          Create a 4:3 high-resolution photorealistic <strong className="font-sans font-semibold">FACE IDENTITY REFERENCE CARD</strong> for{' '}
          {renderInlineToken('character_name')}, a fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}.
        </p>

        <div className="bg-muted/50 p-3 rounded-xl border border-border font-mono text-[11px] space-y-1">
          <div className="text-muted-foreground font-semibold">
            Show the <strong className="text-foreground">same woman</strong> in three consistent facial views on one clean reference sheet:
          </div>
          <div className="pl-2 space-y-0.5 text-muted-foreground">
            <div>1. straight-on front view</div>
            <div>2. left 3/4 view</div>
            <div>3. right 3/4 view</div>
          </div>
        </div>

        <p>
          {charData.character_name} has a {renderInlineToken('face_structure')}, {renderInlineToken('eyes')},{' '}
          {renderInlineToken('eyebrows')}, {renderInlineToken('nose')}, and {renderInlineToken('lips')}.
        </p>

        <p>
          Her skin is <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('skin_tone_undertone')}</strong>,{' '}
          {renderInlineToken('skin_texture')}. Never chalky, waxy, plastic, or overly airbrushed.
        </p>

        <p>
          Her hair is <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('hair_description')}</strong>, with
          distinctive <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('hair_details')}</strong>.
        </p>

        <p>
          Use {renderInlineToken('makeup_expression')} so her actual facial identity is clearly visible.
        </p>

        <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2.5 rounded-lg border border-dashed border-border">
          Plain neutral background, consistent soft natural lighting, realistic human anatomy, realistic skin texture, no beauty filter, no facial reshaping, no stylization, no excessive retouching.
          All three views must depict <strong>exactly the same woman</strong> with identical facial structure and physical identity.
          No text except label of side and title.
        </p>

        <div className="pt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
          Purpose: **FACE LOCK — this image is the primary reference for {charData.character_name}'s facial identity, skin, eyes, hair, and recognizable features.**
        </div>
      </div>
    );
  };

  // ── Step 2 Body Document View ──
  const renderBodyDocument = () => {
    return (
      <div className="space-y-4 text-xs font-serif leading-relaxed text-foreground">
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
          <span>Full-Body Reference Sheet · 4:3 Landscape</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] flex items-center gap-1">
            <CheckCircle2 size={11} />
            <span>Face DNA Inherited</span>
          </span>
        </p>

        <p>
          Create a 4:3 high-resolution photorealistic <strong className="font-sans font-semibold">BODY IDENTITY REFERENCE CARD</strong> for{' '}
          {renderInlineToken('character_name')}, the same fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}.
        </p>

        <div className="bg-muted/50 p-3 rounded-xl border border-border font-mono text-[11px] space-y-1">
          <div className="text-muted-foreground font-semibold">
            Show the <strong className="text-foreground">same woman</strong> in three consistent full-body views on one clean reference sheet:
          </div>
          <div className="pl-2 space-y-0.5 text-muted-foreground">
            <div>1. front view</div>
            <div>2. left side view</div>
            <div>3. Right side view</div>
            <div>4. back view</div>
          </div>
        </div>

        <p>
          {charData.character_name} has a <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('presence_silhouette')}</strong>{' '}
          with {renderInlineToken('proportions_limbs')}.
        </p>

        <p>
          Her abdomen has <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('abdomen')}</strong>.
        </p>

        <p>
          Her overall physique is <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('physique')}</strong>.
        </p>

        <p>
          Use {renderInlineToken('clothing')} that clearly shows her natural proportions without being revealing.{' '}
          {renderInlineToken('posture')}.
        </p>

        <p>
          Preserve her {renderInlineToken('skin_tone_undertone')} and realistic human skin texture.
        </p>

        <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2.5 rounded-lg border border-dashed border-border">
          Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions.
          No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization.
          All three views must depict <strong>exactly the same woman with identical body proportions</strong>.
          No text except label of side and title.
        </p>

        <div className="pt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
          Purpose: **BODY LOCK — this image is the primary reference for {charData.character_name}'s body proportions, silhouette, and physical structure.**
        </div>
      </div>
    );
  };

  // ── Step 3 Expression Document View ──
  const renderExpressionDocument = () => {
    return (
      <div className="space-y-4 text-xs font-serif leading-relaxed text-foreground">
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
          <span>Expression & Selfie Realism · 2×3 Grid</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] flex items-center gap-1">
            <CheckCircle2 size={11} />
            <span>Face & Body DNA Locked</span>
          </span>
        </p>

        <p>
          Create a high-resolution photorealistic <strong className="font-sans font-semibold">EXPRESSION AND SELFIE-REALISM REFERENCE CARD</strong> for{' '}
          {renderInlineToken('character_name')}, the same fictional adult {renderInlineToken('ethnicity_ancestry')}{' '}
          {renderInlineToken('gender_presentation')} in her {renderInlineToken('age_appearance')}.
        </p>

        <div className="bg-muted/50 p-3 rounded-xl border border-border font-mono text-[11px] space-y-1">
          <div className="text-muted-foreground font-semibold">
            Show <strong className="text-foreground">six expressions of the exact same woman</strong> in a clean 2×3 grid:
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-2 text-muted-foreground">
            <div>1. relaxed neutral</div>
            <div>2. soft genuine smile</div>
            <div>3. playful smirk</div>
            <div>4. subtle laugh</div>
            <div>5. confident direct gaze</div>
            <div>6. soft thoughtful expression</div>
          </div>
        </div>

        <p>
          Keep {charData.character_name}'s exact established facial identity in every panel: {charData.face_structure}, {charData.eyes}, {charData.eyebrows}, {charData.nose}, {charData.lips}, {charData.skin_tone_undertone}, and {charData.hair_description} with {charData.hair_details}.
        </p>

        <p>
          Focus on <strong className="text-emerald-700 dark:text-emerald-300">{renderInlineToken('expression_focus')}</strong>.
        </p>

        <p>
          Expressions should feel like a real person rather than exaggerated model poses. Include {renderInlineToken('selfie_vibe')}.
        </p>

        <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2.5 rounded-lg border border-dashed border-border">
          Consistent natural lighting, simple neutral background, realistic skin texture, photorealistic rendering, high resolution.
          No face redesign, beautification, excessive retouching, plastic skin, exaggerated expressions, or stylization.
          No text except label of side and title.
        </p>

        <div className="pt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
          Purpose: **EXPRESSION LOCK — this image establishes {charData.character_name}'s natural facial animation, eye behavior, expression range, and realistic selfie presence.**
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden bg-background">
      {/* ── TOP STEPPER & STATUS HEADER ── */}
      <div className="border-b border-border bg-card px-3 sm:px-4 py-2.5 shrink-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* 3-Step Wizard Stepper */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
            {/* Step 1: Face */}
            <button
              onClick={() => handleStepChange('face')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'face'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isFaceConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isFaceConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'face'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isFaceConfirmed ? <Check size={12} strokeWidth={3} /> : '1'}
              </div>
              <span className="font-semibold">Face<span className="hidden sm:inline"> Lock</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden xs:inline">4:3</span>
            </button>

            <span className="text-muted-foreground/40 font-mono text-xs">→</span>

            {/* Step 2: Body */}
            <button
              onClick={() => handleStepChange('body')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'body'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isBodyConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isBodyConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'body'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isBodyConfirmed ? <Check size={12} strokeWidth={3} /> : '2'}
              </div>
              <span className="font-semibold">Body<span className="hidden sm:inline"> Lock</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden xs:inline">4:3</span>
            </button>

            <span className="text-muted-foreground/40 font-mono text-xs">→</span>

            {/* Step 3: Expression */}
            <button
              onClick={() => handleStepChange('expression')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 select-none active:scale-95 ${
                currentStep === 'expression'
                  ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-2xs'
                  : isExpressionConfirmed
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isExpressionConfirmed
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === 'expression'
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isExpressionConfirmed ? <Check size={12} strokeWidth={3} /> : '3'}
              </div>
              <span className="font-semibold">Expr<span className="hidden sm:inline">ession</span></span>
              <span className="text-[10px] opacity-70 font-mono hidden xs:inline">2×3</span>
            </button>
          </div>

          {/* Thread / Session Status & Discard Action */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {sessionConversationId ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="hidden sm:inline">Thread Locked</span>
                <span>(#{sessionConversationId.slice(-6)})</span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground hidden md:inline font-mono">
                New Character Session
              </span>
            )}

            <button
              onClick={handleDiscardSession}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
              title="Reset current session and discard generated cards"
              aria-label="Discard session"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── THREAD CONTEXT CONFIRMATION BANNER ── */}
      {!sessionConversationId ? (
        <div className="bg-card border-b border-border px-3 sm:px-4 py-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0 z-10">
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
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 active:scale-95 ${
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
                className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 active:scale-95 ${
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
                className="text-[11px] py-1.5 px-2.5 rounded-xl border border-border bg-card text-foreground max-w-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
              <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-primary/20">
                <CheckCircle2 size={13} />
                <span>Clean-slate session for {charData.character_name}</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-amber-500/20">
                <CheckCircle2 size={13} />
                <span>Will attach to #{targetExistingChatId ? targetExistingChatId.slice(-6) : 'selected'}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-primary/5 border-b border-primary/20 px-3 sm:px-4 py-2.5 text-xs flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/15 text-primary font-mono text-[11px] font-semibold border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Thread Locked: #{sessionConversationId.slice(-8)}</span>
            </div>
            <span className="text-foreground/80 text-[11px]">
              Identity Continuity Active · Face, Body & Expression share this conversation context across turns.
            </span>
          </div>

          <button
            onClick={handleDiscardSession}
            className="min-h-[36px] text-[11px] px-3 py-1 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 font-medium active:scale-95 border border-transparent hover:border-destructive/20"
            title="Release conversation and reset wizard"
          >
            <RotateCcw size={12} />
            <span>Discard & Release</span>
          </button>
        </div>
      )}

      {/* ── MOBILE VIEW SWITCHER (< lg only) ── */}
      <div className="flex lg:hidden items-center justify-between border-b border-border bg-card px-3 py-2 shrink-0 z-10">
        <div className="flex items-center p-1 bg-muted rounded-xl text-xs w-full gap-1">
          <button
            onClick={() => {
              hapticImpact('selection');
              setMobileTab('prompt');
            }}
            className={`flex-1 min-h-[44px] py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              mobileTab === 'prompt'
                ? 'bg-card text-foreground shadow-2xs font-semibold border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pencil size={13} className="text-primary" />
            <span>Edit Prompt</span>
          </button>
          <button
            onClick={() => {
              hapticImpact('selection');
              setMobileTab('preview');
            }}
            className={`flex-1 min-h-[44px] py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              mobileTab === 'preview'
                ? 'bg-card text-foreground shadow-2xs font-semibold border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye size={14} className="text-primary" />
            <span>Card Preview</span>
            {(() => {
              const activeResult =
                currentStep === 'face'
                  ? faceResult
                  : currentStep === 'body'
                  ? bodyResult
                  : expressionResult;
              return activeResult ? (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse ml-0.5" />
              ) : null;
            })()}
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: 2-COLUMN LAYOUT ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
        {/* ── LEFT COLUMN: Interactive Prompt Document ── */}
        <div className={`w-full lg:w-[54%] border-r border-border flex-col bg-card overflow-hidden ${
          mobileTab === 'prompt' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Sub-header Toolbar */}
          <div className="p-3 px-4 border-b border-border bg-muted/30 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
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

              {/* Mode indicator */}
              {editorMode === 'raw' && customRawPrompt !== null ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                  Custom Edited
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-medium">
                  Interactive Tokens
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Archetype Quick-Bar */}
              <div className="flex items-center gap-1 text-[11px] overflow-x-auto scrollbar-none py-0.5 shrink-0">
                <span className="text-muted-foreground text-[10px] hidden md:inline font-mono">Preset:</span>
                {['nia', 'kaya', 'zia', 'nastya'].map((k) => (
                  <button
                    key={k}
                    onClick={() => handleSelectArchetype(k)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg capitalize font-medium transition-all text-xs shrink-0 select-none active:scale-95 ${
                      charData.character_name.toLowerCase() === k
                        ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Randomize Button */}
              <button
                onClick={handleRandomize}
                className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-muted hover:bg-muted/80 text-foreground transition-all shadow-2xs active:scale-95 border border-border"
                title="Randomize dynamic tokens with realistic harmonized values"
              >
                <Dices size={14} className="text-primary" />
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
                className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                  editorMode === 'raw'
                    ? 'bg-foreground text-background border-transparent'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle raw text editing"
              >
                {editorMode === 'raw' ? '✦ Tokens View' : '✎ Raw Text'}
              </button>

              {/* Copy prompt */}
              <button
                onClick={handleCopyPrompt}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                title="Copy prompt text"
              >
                {copiedPrompt ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Document Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {editorMode === 'raw' ? (
              <div className="h-full flex flex-col space-y-2">
                <textarea
                  value={effectivePrompt}
                  onChange={(e) => setCustomRawPrompt(e.target.value)}
                  rows={20}
                  className="w-full flex-1 text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed bg-muted/20 p-4 rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none shadow-inner"
                  placeholder="Raw prompt editor..."
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>💡 Direct text edits are active and will be used for generation.</span>
                  {customRawPrompt !== null && (
                    <button
                      onClick={() => setCustomRawPrompt(null)}
                      className="text-amber-600 dark:text-amber-400 font-medium hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={11} />
                      <span>Revert to Form Tokens</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-card p-5 sm:p-7 rounded-2xl border border-border shadow-sm">
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
      <div className="lg:hidden p-3 border-t border-border bg-card/95 backdrop-blur-md shadow-lg shrink-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {(() => {
          const activeResult =
            currentStep === 'face'
              ? faceResult
              : currentStep === 'body'
              ? bodyResult
              : expressionResult;

          if (isGenerating) {
            return (
              <div className="w-full min-h-[48px] h-12 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-xs text-primary-foreground bg-primary shadow-md">
                <Loader2 size={16} className="animate-spin" />
                <span>{generationProgress || 'Generating Card in ChatGPT…'}</span>
              </div>
            );
          }

          if (activeResult) {
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateCurrentStep}
                  className="min-h-[48px] h-12 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 active:scale-95 shrink-0"
                  title="Regenerate this step's reference card"
                >
                  <RotateCcw size={13} />
                  <span>Regenerate</span>
                </button>

                {currentStep === 'face' && (
                  <button
                    onClick={handleConfirmFace}
                    className="flex-1 min-h-[48px] h-12 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-md active:scale-95"
                  >
                    <span>✓ Pass & Proceed to Body Lock</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {currentStep === 'body' && (
                  <button
                    onClick={handleConfirmBody}
                    className="flex-1 min-h-[48px] h-12 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-md active:scale-95"
                  >
                    <span>✓ Pass & Proceed to Expression Lock</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {currentStep === 'expression' && (
                  <button
                    onClick={handleConfirmExpression}
                    className="flex-1 min-h-[48px] h-12 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-md active:scale-95"
                  >
                    <span>✓ Pass & Finalize Character</span>
                    <Check size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
            );
          }

          // Before generation on this step
          return (
            <button
              onClick={handleGenerateCurrentStep}
              className="w-full min-h-[48px] h-12 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-primary-foreground bg-primary hover:bg-primary/90 shadow-md active:scale-95"
            >
              <Sparkles size={16} />
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
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
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
                  autoFocus
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
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
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
