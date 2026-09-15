import { useState, useEffect, useMemo } from 'react';
import {
  Dices,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  User,
  Eye,
  Smile,
  Scissors,
  Palette,
  ExternalLink,
  PlusCircle,
  Link as LinkIcon,
  CheckCircle2,
  Maximize2,
  Info,
  Loader2,
  Sparkle,
} from 'lucide-react';
import { CharacterCard, ImageResult, GalleryItem } from '../../types';
import { api, copyToClipboard } from '../../lib/api';

interface FaceCardGeneratorProps {
  characters: CharacterCard[];
  onRefreshCharacters: () => void;
  onOpenViewer?: (item: GalleryItem) => void;
  onContinueInChat?: (item: GalleryItem) => void;
}

export function FaceCardGenerator({
  characters,
  onRefreshCharacters,
  onOpenViewer,
  onContinueInChat,
}: FaceCardGeneratorProps) {
  // Archetype state loaded from backend
  const [archetypes, setArchetypes] = useState<Record<string, any>>({});
  const [selectedArchetype, setSelectedArchetype] = useState<string>('south_asian_classic');
  const [isRolling, setIsRolling] = useState(false);

  // Form Data State
  const [formData, setFormData] = useState<Record<string, any>>({
    character_name: 'Kaya',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    ethnicity_ancestry: ['South Asian', 'North Indian'],
    face_shape: 'oval',
    face_fullness: 'lean',
    forehead: 'medium straight',
    jaw: 'defined',
    chin: 'softly rounded',
    cheeks: 'high cheekbones',
    eye_shape: 'almond',
    eye_size: 'large',
    eye_spacing: 'balanced',
    eye_color: 'dark brown',
    eye_character: 'warm and expressive',
    eye_details: ['long lashes', 'visible lower-lid', 'strong catchlights'],
    brow_shape: 'softly arched',
    brow_density: 'moderately full',
    brow_character: 'natural defined',
    nose_size: 'small',
    nose_bridge: 'straight narrow',
    nose_tip: 'refined softly defined',
    nose_overall: 'delicate refined',
    lip_fullness: 'moderately full',
    lip_shape: "defined cupid's bow",
    lip_ratio: 'slightly fuller lower',
    natural_lip_color: 'rosy pink',
    skin_depth: 'medium',
    skin_undertone: 'warm golden',
    skin_texture: 'soft realistic with visible pores',
    skin_finish: 'natural satin',
    skin_variation: ['subtle tonal variation'],
    distinctive_skin_features: ['none'],
    hair_length: 'long',
    hair_density: 'thick',
    hair_texture: 'softly wavy',
    hair_color: 'jet black',
    hair_details: ['curtain bangs', 'face-framing strands'],
    makeup_level: 'natural',
    makeup_style: ['natural skin', 'subtle blush', 'lip tint'],
    distinctive_features: ['none'],
    identity_notes: '',
  });

  // Collapsible Accordion sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true,
    structure: false,
    eyes: false,
    eyebrows: false,
    nose: false,
    lips: false,
    skin: false,
    hair: false,
    makeup: false,
    distinctive: false,
  });

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedResult, setGeneratedResult] = useState<ImageResult | null>(null);
  const [generatedVisualDna, setGeneratedVisualDna] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Assignment Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'new' | 'existing'>('new');
  const [targetCharId, setTargetCharId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Load Archetypes from backend on mount
  useEffect(() => {
    api.getFaceCardDictionary().then((res) => {
      if (res.ok && res.archetypes) {
        setArchetypes(res.archetypes);
      }
    }).catch((err) => {
      console.error('Failed to load dictionary from server:', err);
    });
  }, []);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCustomToggle = (key: string) => {
    const customKey = `${key}_custom`;
    if (formData[customKey] !== undefined) {
      // already has custom key
      const next = { ...formData };
      delete next[customKey];
      setFormData(next);
    } else {
      setFormData((prev) => ({ ...prev, [customKey]: '' }));
    }
  };

  const handleMultiSelectToggle = (fieldKey: string, optionVal: string) => {
    const current: string[] = Array.isArray(formData[fieldKey]) ? [...formData[fieldKey]] : [];
    if (optionVal.toLowerCase() === 'none') {
      setFormData((prev) => ({ ...prev, [fieldKey]: ['none'] }));
      return;
    }
    const filteredCurrent = current.filter((x) => x.toLowerCase() !== 'none');
    const idx = filteredCurrent.indexOf(optionVal);
    if (idx >= 0) {
      filteredCurrent.splice(idx, 1);
    } else {
      filteredCurrent.push(optionVal);
    }
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: filteredCurrent.length > 0 ? filteredCurrent : ['none'],
    }));
  };

  // Compile prompt locally for instant 0ms latency live preview
  const compiledPrompt = useMemo(() => {
    const resolve = (key: string, def = ''): string => {
      const customKey = `${key}_custom`;
      if (formData[customKey] && String(formData[customKey]).trim()) {
        return String(formData[customKey]).trim();
      }
      const v = formData[key];
      if (v === undefined || v === null) return def;
      if (Array.isArray(v)) {
        const cleaned = v.filter((x) => String(x).toLowerCase() !== 'none' && String(x).trim() !== '');
        return cleaned.join(', ');
      }
      const s = String(v).trim();
      if (s.toLowerCase() === 'custom') {
        return String(formData[customKey] || '').trim() || def;
      }
      return s || def;
    };

    const name = resolve('character_name', 'Kaya') || 'Kaya';
    const gender = resolve('gender_presentation', 'woman');
    const age = resolve('age_appearance', 'early 20s');
    let ethnicity = resolve('ethnicity_ancestry', 'South Asian');
    if (!ethnicity) ethnicity = 'diverse ancestry';

    const face_shape = resolve('face_shape', 'oval');
    const face_fullness = resolve('face_fullness', 'lean');
    const forehead = resolve('forehead', 'medium straight');
    const structure_sentence = `Balanced ${face_shape} face shape with ${face_fullness} facial fullness and a ${forehead} forehead`;

    const cheeks = resolve('cheeks', 'high cheekbones');
    const jaw = resolve('jaw', 'defined');
    const chin = resolve('chin', 'softly rounded');
    const cheek_jaw_chin_sentence = `${cheeks.charAt(0).toUpperCase() + cheeks.slice(1)}, paired with a ${jaw} jawline and a ${chin} chin`;

    const eye_shape = resolve('eye_shape', 'almond');
    const eye_size = resolve('eye_size', 'large');
    const eye_spacing = resolve('eye_spacing', 'balanced');
    const eye_color = resolve('eye_color', 'dark brown');
    const eye_character = resolve('eye_character', 'warm and expressive');
    const eye_details = resolve('eye_details', 'long lashes, visible lower-lid, strong catchlights');
    let eye_sentence = `${eye_size.charAt(0).toUpperCase() + eye_size.slice(1)} ${eye_shape} ${eye_color} eyes with ${eye_spacing} spacing, a ${eye_character} gaze`;
    if (eye_details) eye_sentence += `, featuring ${eye_details}`;

    const brow_shape = resolve('brow_shape', 'softly arched');
    const brow_density = resolve('brow_density', 'medium');
    const brow_character = resolve('brow_character', 'natural defined');
    const brow_sentence = `${brow_density.charAt(0).toUpperCase() + brow_density.slice(1)} ${brow_shape} eyebrows with a ${brow_character} finish`;

    const nose_size = resolve('nose_size', 'small');
    const nose_bridge = resolve('nose_bridge', 'straight narrow');
    const nose_tip = resolve('nose_tip', 'refined softly defined');
    const nose_overall = resolve('nose_overall', 'delicate refined');
    const nose_sentence = `${nose_overall.charAt(0).toUpperCase() + nose_overall.slice(1)} ${nose_size} nose with a ${nose_bridge} bridge and ${nose_tip} tip`;

    const lip_fullness = resolve('lip_fullness', 'moderately full');
    const lip_shape = resolve('lip_shape', "defined cupid's bow");
    const lip_ratio = resolve('lip_ratio', 'slightly fuller lower');
    const natural_lip_color = resolve('natural_lip_color', 'rosy pink');
    const lip_sentence = `${lip_fullness.charAt(0).toUpperCase() + lip_fullness.slice(1)} lips with a ${lip_shape}, ${lip_ratio} fullness, and natural ${natural_lip_color} color`;

    const skin_depth = resolve('skin_depth', 'medium');
    const skin_undertone = resolve('skin_undertone', 'warm golden');
    const skin_texture = resolve('skin_texture', 'soft realistic with visible pores');
    const skin_finish = resolve('skin_finish', 'natural satin');
    const skin_variation = resolve('skin_variation', '');
    const skin_distinctive = resolve('distinctive_skin_features', '');

    let texture_desc = `${skin_texture}, finished with a ${skin_finish} sheen`;
    if (skin_variation && skin_variation.toLowerCase() !== 'none') {
      texture_desc += ` and ${skin_variation}`;
    }

    let skin_features_line = 'Clean, healthy complexion with authentic natural skin micro-texture.';
    if (skin_distinctive && skin_distinctive.toLowerCase() !== 'none') {
      skin_features_line = `Distinctive skin characteristics: ${skin_distinctive}.`;
    }

    const hair_length = resolve('hair_length', 'long');
    const hair_density = resolve('hair_density', 'thick');
    const hair_texture = resolve('hair_texture', 'softly wavy');
    const hair_color = resolve('hair_color', 'jet black');
    const hair_details = resolve('hair_details', 'curtain bangs, face-framing strands') || 'natural part and clean styling';

    const makeup_level = resolve('makeup_level', 'natural');
    const makeup_style = resolve('makeup_style', 'natural skin, subtle blush, lip tint');
    const makeup_desc = makeup_style ? `${makeup_level} makeup (${makeup_style})` : `${makeup_level} makeup`;

    const distinctive_features = resolve('distinctive_features', '');
    const identity_notes = resolve('identity_notes', '');
    const extras: string[] = [];
    if (distinctive_features && distinctive_features.toLowerCase() !== 'none') {
      extras.push(`Distinctive accessories/features: ${distinctive_features}`);
    }
    if (identity_notes) {
      extras.push(`Visual identity note: ${identity_notes}`);
    }
    const extra_block = extras.length > 0 ? `\n${extras.join('. ')}.` : '';

    return `Create a high-resolution photorealistic **FACE IDENTITY REFERENCE CARD** for
${name}, a fictional adult ${ethnicity} ${gender}
in their ${age}.

Use a **16:9 landscape image composition** designed specifically as a facial reference sheet.

At the top center of the image, place the title:

**FACE IDENTITY REFERENCE CARD**

Show the SAME person in three consistent facial views on one clean reference sheet, arranged horizontally:

1. left 3/4 view — label below: **"Left side"**
2. straight-on front view — label below: **"Front side"**
3. right 3/4 view — label below: **"Right side"**

The **front view should be centered**, with the left and right 3/4 views evenly positioned on either side.

Make all three facial views large enough to clearly evaluate the character's features while fitting comfortably within the landscape frame. Keep a **natural, clearly visible border and gap between each view** so the faces are visually separated without looking cramped, overlapping, boxed, or artificially divided.

Keep all three views at a consistent head size, scale, camera distance, vertical alignment, lighting, and rendering quality.

Both ears should be naturally visible whenever possible, especially in the 3/4 views, while maintaining realistic anatomy and the character's exact facial identity.

${structure_sentence}.
${cheek_jaw_chin_sentence}.
${eye_sentence}.
${brow_sentence}.
${nose_sentence}.
${lip_sentence}.

Their skin is ${skin_depth} with ${skin_undertone} undertones, ${texture_desc}.
${skin_features_line}

Their hair is ${hair_length}, ${hair_density} density, ${hair_texture}, ${hair_color}, with ${hair_details}.

Use ${makeup_desc} so the underlying facial identity remains clearly visible.${extra_block}

Use a plain white background and consistent soft natural lighting across all three views. Maintain realistic human anatomy, realistic skin texture, natural facial detail, and photorealistic rendering.

No beauty filter, no facial reshaping, no excessive retouching, no plastic or artificial skin, and no stylization.

No text anywhere on the image except:

* the top title **"FACE IDENTITY REFERENCE CARD"**
* the three view labels **"Left side"**, **"Front side"**, and **"Right side"**

Place each view label naturally below its corresponding face.

All three views must depict **EXACTLY THE SAME PERSON** with identical facial structure, proportions, skin characteristics, hair identity, and recognizable features.

The 3/4 views should naturally reveal facial depth and profile characteristics while remaining clearly consistent with the front view.`.trim();
  }, [formData]);

  // Dice roll / Randomize
  const handleRandomize = async (archetypeKey?: string) => {
    setIsRolling(true);
    try {
      const res = await api.randomizeFaceCard(archetypeKey);
      if (res.ok && res.data) {
        setFormData(res.data);
        if (archetypeKey) setSelectedArchetype(archetypeKey);
      }
    } catch (e) {
      console.error('Randomize error:', e);
    } finally {
      setTimeout(() => setIsRolling(false), 400);
    }
  };

  // Archetype selection change
  const handleSelectArchetype = (key: string) => {
    setSelectedArchetype(key);
    if (archetypes[key]) {
      setFormData(archetypes[key]);
    }
  };

  // Copy prompt
  const handleCopyPrompt = async () => {
    const ok = await copyToClipboard(compiledPrompt);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  // Generate Image
  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Submitting to engine…');
    setGeneratedResult(null);

    try {
      const res = await api.generateFaceCard(formData);
      if (res.ok && res.result) {
        setGeneratedResult(res.result);
        setGeneratedVisualDna(res.visual_dna || '');
        setAssignSuccess(null);
      } else {
        throw new Error('Generation did not return a valid result');
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // Save / Assign Card to Character
  const handleConfirmAssignment = async () => {
    if (!generatedResult) return;
    setIsAssigning(true);

    const imageStem = generatedResult.image_url.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';

    try {
      if (assignMode === 'new') {
        const newCharPayload: Partial<CharacterCard> = {
          name: formData.character_name || 'New Character',
          tagline: `${formData.age_appearance || 'Adult'} ${formData.gender_presentation || 'person'} · Face Locked`,
          visual_dna: generatedVisualDna || `${formData.character_name}: Standard facial identity`,
          avatar_image_id: imageStem,
          face_lock_image_id: imageStem,
          character_lock: {
            references: {
              image_1: 'FACE_LOCK — primary facial identity reference.',
            },
            face_card_data: formData,
          },
        };

        const created = await api.saveCharacter(newCharPayload);
        // Automatically lock this new character
        await api.lockCharacter(created.id, true);
        onRefreshCharacters();
        setAssignSuccess(`Created & locked new character "${created.name}"!`);
        setTimeout(() => {
          setIsAssignModalOpen(false);
          setAssignSuccess(null);
        }, 1800);
      } else {
        if (!targetCharId) {
          alert('Please select an existing character to assign to.');
          setIsAssigning(false);
          return;
        }

        const targetChar = characters.find((c) => c.id === targetCharId);
        const updatedDna = targetChar?.visual_dna
          ? `${targetChar.visual_dna} | Face Lock: ${generatedVisualDna}`
          : generatedVisualDna;

        await api.updateCharacter(targetCharId, {
          avatar_image_id: targetChar?.avatar_image_id || imageStem,
          face_lock_image_id: imageStem,
          visual_dna: updatedDna,
        });

        onRefreshCharacters();
        setAssignSuccess(`Assigned Face Lock to "${targetChar?.name || 'character'}"!`);
        setTimeout(() => {
          setIsAssignModalOpen(false);
          setAssignSuccess(null);
        }, 1800);
      }
    } catch (err: any) {
      alert(`Failed to assign face lock: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-white dark:bg-[#121214] text-[#0d0d0d] dark:text-white">
      {/* ── LEFT COLUMN: Interactive Dynamic Controls ── */}
      <div className="w-full lg:w-[520px] xl:w-[580px] h-full flex flex-col border-r border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#141416]">
        {/* Top Sticky Toolbar */}
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-sm leading-tight text-[#0d0d0d] dark:text-white">
                  Face Card Studio
                </h2>
                <span className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                  Dynamic Photorealistic 16:9 Turnaround
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRandomize()}
                disabled={isRolling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm active:scale-95 ${
                  isRolling ? 'opacity-70 animate-pulse' : ''
                }`}
                title="Randomize entire face with phenotypic realism"
              >
                <Dices size={14} className={isRolling ? 'animate-spin' : ''} />
                <span>🎲 Randomize</span>
              </button>

              <button
                onClick={() => handleSelectArchetype('south_asian_classic')}
                className="p-1.5 rounded-lg text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Archetype Quick Selector */}
          <div className="flex items-center gap-2 bg-[#f4f4f5] dark:bg-[#202023] p-1.5 rounded-lg">
            <span className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] px-1 whitespace-nowrap">
              Preset Archetype:
            </span>
            <select
              value={selectedArchetype}
              onChange={(e) => handleSelectArchetype(e.target.value)}
              className="flex-1 bg-white dark:bg-[#18181b] text-xs py-1 px-2 rounded-md border border-[#e5e5e5] dark:border-[#27272a] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="south_asian_classic">South Asian Grace (Kaya)</option>
              <option value="east_asian_modern">East Asian Minimalist (Hana)</option>
              <option value="mediterranean_warmth">Mediterranean Warmth (Sofia)</option>
              <option value="west_african_radiance">West African Elegance (Amina)</option>
              <option value="nordic_crisp">Nordic Crisp (Astrid)</option>
              <option value="latin_american_radiance">Latin American Radiance (Camila)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Form Categories */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Category 1: Character Basics */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('basics')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <User size={15} className="text-emerald-500" />
                <span>1. Character Basics</span>
              </div>
              {openSections.basics ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.basics && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={formData.character_name || ''}
                    onChange={(e) => handleFieldChange('character_name', e.target.value)}
                    placeholder="e.g., Kaya"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] text-[#0d0d0d] dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Gender Presentation
                    </label>
                    <select
                      value={formData.gender_presentation || 'woman'}
                      onChange={(e) => handleFieldChange('gender_presentation', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="woman">woman</option>
                      <option value="man">man</option>
                      <option value="feminine person">feminine person</option>
                      <option value="masculine person">masculine person</option>
                      <option value="androgynous person">androgynous person</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Age Appearance
                    </label>
                    <select
                      value={formData.age_appearance || 'early 20s'}
                      onChange={(e) => handleFieldChange('age_appearance', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="18–20">18–20</option>
                      <option value="early 20s">early 20s</option>
                      <option value="mid-20s">mid-20s</option>
                      <option value="late 20s">late 20s</option>
                      <option value="early 30s">early 30s</option>
                      <option value="mid-30s">mid-30s</option>
                      <option value="40s">40s</option>
                      <option value="50s+">50s+</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa]">
                      Ethnicity / Ancestry (Multi-select)
                    </label>
                    <button
                      onClick={() => handleCustomToggle('ethnicity_ancestry')}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {formData.ethnicity_ancestry_custom !== undefined ? 'Use Presets' : '+ Custom Text'}
                    </button>
                  </div>

                  {formData.ethnicity_ancestry_custom !== undefined ? (
                    <input
                      type="text"
                      value={formData.ethnicity_ancestry_custom || ''}
                      onChange={(e) => handleFieldChange('ethnicity_ancestry_custom', e.target.value)}
                      placeholder="e.g., South Asian (Kashmiri & Punjabi mixed)"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-emerald-500 bg-[#fafafa] dark:bg-[#121214] focus:outline-none"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]">
                      {[
                        'South Asian',
                        'North Indian',
                        'South Indian',
                        'Bengali',
                        'Punjabi',
                        'Nepali',
                        'East Asian',
                        'Southeast Asian',
                        'Central Asian',
                        'Middle Eastern',
                        'Mediterranean',
                        'Scandinavian / Nordic',
                        'Western European',
                        'African',
                        'West African',
                        'Latin American',
                        'Mixed / multi-ethnic',
                      ].map((eth) => {
                        const isSelected =
                          Array.isArray(formData.ethnicity_ancestry) &&
                          formData.ethnicity_ancestry.includes(eth);
                        return (
                          <button
                            key={eth}
                            type="button"
                            onClick={() => handleMultiSelectToggle('ethnicity_ancestry', eth)}
                            className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white font-medium shadow-xs'
                                : 'bg-white dark:bg-zinc-800 text-[#6e6e80] dark:text-[#a1a1aa] border border-gray-200 dark:border-zinc-700 hover:border-emerald-500'
                            }`}
                          >
                            {eth}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category 2: Face Structure */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('structure')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smile size={15} className="text-emerald-500" />
                <span>2. Face Structure & Bone Geometry</span>
              </div>
              {openSections.structure ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.structure && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Face Shape
                    </label>
                    <select
                      value={formData.face_shape || 'oval'}
                      onChange={(e) => handleFieldChange('face_shape', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="oval">oval</option>
                      <option value="round">round</option>
                      <option value="heart">heart</option>
                      <option value="square">square</option>
                      <option value="oblong">oblong</option>
                      <option value="diamond">diamond</option>
                      <option value="rectangular">rectangular</option>
                      <option value="tapered">tapered</option>
                      <option value="angular">angular</option>
                      <option value="soft-full">soft-full</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Face Fullness
                    </label>
                    <select
                      value={formData.face_fullness || 'lean'}
                      onChange={(e) => handleFieldChange('face_fullness', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="slender">slender</option>
                      <option value="lean">lean</option>
                      <option value="balanced">balanced</option>
                      <option value="softly full">softly full</option>
                      <option value="full">full</option>
                      <option value="sculpted / chiseled">sculpted / chiseled</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Jawline
                    </label>
                    <select
                      value={formData.jaw || 'defined'}
                      onChange={(e) => handleFieldChange('jaw', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft">soft</option>
                      <option value="rounded">rounded</option>
                      <option value="tapered">tapered</option>
                      <option value="defined">defined</option>
                      <option value="chiseled angular">chiseled angular</option>
                      <option value="broad square">broad square</option>
                      <option value="V-line">V-line</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Chin
                    </label>
                    <select
                      value={formData.chin || 'softly rounded'}
                      onChange={(e) => handleFieldChange('chin', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="small">small</option>
                      <option value="rounded">rounded</option>
                      <option value="softly rounded">softly rounded</option>
                      <option value="pointed">pointed</option>
                      <option value="defined">defined</option>
                      <option value="broad">broad</option>
                      <option value="cleft chin">cleft chin</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Cheeks & Cheekbones
                    </label>
                    <select
                      value={formData.cheeks || 'high cheekbones'}
                      onChange={(e) => handleFieldChange('cheeks', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="subtle">subtle</option>
                      <option value="soft">soft</option>
                      <option value="full">full</option>
                      <option value="plush">plush</option>
                      <option value="defined cheekbones">defined cheekbones</option>
                      <option value="high cheekbones">high cheekbones</option>
                      <option value="prominent sculpted cheeks">prominent sculpted cheeks</option>
                      <option value="hollowed cheeks">hollowed cheeks</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Forehead
                    </label>
                    <select
                      value={formData.forehead || 'medium straight'}
                      onChange={(e) => handleFieldChange('forehead', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="small">small</option>
                      <option value="medium">medium</option>
                      <option value="medium straight">medium straight</option>
                      <option value="broad">broad</option>
                      <option value="tall rounded">tall rounded</option>
                      <option value="straight">straight</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 3: Eyes & Gaze */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('eyes')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-emerald-500" />
                <span>3. Eyes & Gaze</span>
              </div>
              {openSections.eyes ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.eyes && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Eye Shape
                    </label>
                    <select
                      value={formData.eye_shape || 'almond'}
                      onChange={(e) => handleFieldChange('eye_shape', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="almond">almond</option>
                      <option value="round">round</option>
                      <option value="large round">large round</option>
                      <option value="narrow">narrow</option>
                      <option value="hooded">hooded</option>
                      <option value="deep-set">deep-set</option>
                      <option value="monolid">monolid</option>
                      <option value="prominent double-eyelid">double-eyelid</option>
                      <option value="upturned">upturned</option>
                      <option value="downturned">downturned</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Eye Color
                    </label>
                    <select
                      value={formData.eye_color || 'dark brown'}
                      onChange={(e) => handleFieldChange('eye_color', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="jet black">jet black</option>
                      <option value="very dark brown">very dark brown</option>
                      <option value="dark brown">dark brown</option>
                      <option value="warm chestnut brown">warm chestnut brown</option>
                      <option value="light brown">light brown</option>
                      <option value="hazel">hazel</option>
                      <option value="amber">amber</option>
                      <option value="moss green">moss green</option>
                      <option value="emerald green">emerald green</option>
                      <option value="deep blue">deep blue</option>
                      <option value="ice blue">ice blue</option>
                      <option value="gray">gray</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Eye Size & Spacing
                    </label>
                    <select
                      value={formData.eye_size || 'large'}
                      onChange={(e) => handleFieldChange('eye_size', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="small">small</option>
                      <option value="medium">medium</option>
                      <option value="large">large</option>
                      <option value="very large">very large</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Eye Character / Gaze
                    </label>
                    <select
                      value={formData.eye_character || 'warm and expressive'}
                      onChange={(e) => handleFieldChange('eye_character', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft">soft</option>
                      <option value="warm">warm</option>
                      <option value="warm and expressive">warm and expressive</option>
                      <option value="bright">bright</option>
                      <option value="gentle">gentle</option>
                      <option value="intense">intense</option>
                      <option value="deep">deep</option>
                      <option value="dreamy">dreamy</option>
                      <option value="expressive">expressive</option>
                      <option value="sharp and piercing">sharp and piercing</option>
                      <option value="calm and deep">calm and deep</option>
                      <option value="mysterious">mysterious</option>
                      <option value="custom">custom...</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Eye Details (Multi-select)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'strong catchlights',
                      'visible lower-lid',
                      'long lashes',
                      'naturally defined lashes',
                      'subtle eyelid crease',
                      'subtle epicanthic fold',
                      'deep eye sockets',
                    ].map((detail) => {
                      const isSelected =
                        Array.isArray(formData.eye_details) && formData.eye_details.includes(detail);
                      return (
                        <button
                          key={detail}
                          type="button"
                          onClick={() => handleMultiSelectToggle('eye_details', detail)}
                          className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-medium'
                              : 'bg-white dark:bg-zinc-800 text-[#6e6e80] dark:text-[#a1a1aa] border border-gray-200 dark:border-zinc-700'
                          }`}
                        >
                          {detail}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 4: Eyebrows & Nose */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('nose')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-emerald-500" />
                <span>4. Eyebrows & Nose Geometry</span>
              </div>
              {openSections.nose ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.nose && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Brow Shape
                    </label>
                    <select
                      value={formData.brow_shape || 'softly arched'}
                      onChange={(e) => handleFieldChange('brow_shape', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="straight">straight</option>
                      <option value="softly arched">softly arched</option>
                      <option value="rounded">rounded</option>
                      <option value="high arch">high arch</option>
                      <option value="angled">angled</option>
                      <option value="feathered">feathered</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Brow Density
                    </label>
                    <select
                      value={formData.brow_density || 'medium'}
                      onChange={(e) => handleFieldChange('brow_density', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="fine">fine</option>
                      <option value="light">light</option>
                      <option value="medium">medium</option>
                      <option value="moderately full">moderately full</option>
                      <option value="thick">thick</option>
                      <option value="bushy / textured">bushy</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Brow Finish
                    </label>
                    <select
                      value={formData.brow_character || 'natural defined'}
                      onChange={(e) => handleFieldChange('brow_character', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="soft">soft</option>
                      <option value="natural">natural</option>
                      <option value="natural defined">natural defined</option>
                      <option value="clean groomed">clean groomed</option>
                      <option value="bold">bold</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Nose Size
                    </label>
                    <select
                      value={formData.nose_size || 'small'}
                      onChange={(e) => handleFieldChange('nose_size', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="very small">very small</option>
                      <option value="small">small</option>
                      <option value="medium">medium</option>
                      <option value="prominent">prominent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Nose Bridge
                    </label>
                    <select
                      value={formData.nose_bridge || 'straight narrow'}
                      onChange={(e) => handleFieldChange('nose_bridge', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="narrow">narrow</option>
                      <option value="straight">straight</option>
                      <option value="straight narrow">straight narrow</option>
                      <option value="broad">broad</option>
                      <option value="high bridge">high bridge</option>
                      <option value="button / snub">button / snub</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Nose Tip
                    </label>
                    <select
                      value={formData.nose_tip || 'refined softly defined'}
                      onChange={(e) => handleFieldChange('nose_tip', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="rounded">rounded</option>
                      <option value="refined">refined</option>
                      <option value="refined softly defined">refined soft</option>
                      <option value="button tip">button tip</option>
                      <option value="defined">defined</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 5: Lips & Mouth */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('lips')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smile size={15} className="text-emerald-500" />
                <span>5. Lips & Mouth</span>
              </div>
              {openSections.lips ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.lips && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Lip Fullness
                    </label>
                    <select
                      value={formData.lip_fullness || 'moderately full'}
                      onChange={(e) => handleFieldChange('lip_fullness', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="thin">thin</option>
                      <option value="delicate">delicate</option>
                      <option value="medium">medium</option>
                      <option value="moderately full">moderately full</option>
                      <option value="full">full</option>
                      <option value="pillowy plush">pillowy plush</option>
                      <option value="very full">very full</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Lip Shape
                    </label>
                    <select
                      value={formData.lip_shape || "defined cupid's bow"}
                      onChange={(e) => handleFieldChange('lip_shape', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="soft">soft</option>
                      <option value="rounded">rounded</option>
                      <option value="defined cupid's bow">defined cupid's bow</option>
                      <option value="heart-shaped">heart-shaped</option>
                      <option value="wide">wide</option>
                      <option value="narrow">narrow</option>
                      <option value="balanced">balanced</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Lip Ratio
                    </label>
                    <select
                      value={formData.lip_ratio || 'slightly fuller lower'}
                      onChange={(e) => handleFieldChange('lip_ratio', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="balanced">balanced</option>
                      <option value="slightly fuller lower">slightly fuller lower</option>
                      <option value="clearly fuller lower">clearly fuller lower</option>
                      <option value="slightly fuller upper">slightly fuller upper</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Natural Lip Color
                    </label>
                    <select
                      value={formData.natural_lip_color || 'rosy pink'}
                      onChange={(e) => handleFieldChange('natural_lip_color', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="pale pink">pale pink</option>
                      <option value="rosy pink">rosy pink</option>
                      <option value="peach-pink">peach-pink</option>
                      <option value="mauve">mauve</option>
                      <option value="pink-brown">pink-brown</option>
                      <option value="warm nude">warm nude</option>
                      <option value="deep berry">deep berry</option>
                      <option value="natural neutral">natural neutral</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 6: Skin & Complexion */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('skin')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-emerald-500" />
                <span>6. Skin & Complexion</span>
              </div>
              {openSections.skin ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.skin && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Skin Depth
                    </label>
                    <select
                      value={formData.skin_depth || 'medium'}
                      onChange={(e) => handleFieldChange('skin_depth', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="porcelain">porcelain</option>
                      <option value="very fair">very fair</option>
                      <option value="fair">fair</option>
                      <option value="light">light</option>
                      <option value="light-medium">light-medium</option>
                      <option value="medium">medium</option>
                      <option value="tan">tan</option>
                      <option value="olive-tan">olive-tan</option>
                      <option value="deep tan">deep tan</option>
                      <option value="deep">deep</option>
                      <option value="very deep">very deep</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Skin Undertone
                    </label>
                    <select
                      value={formData.skin_undertone || 'warm golden'}
                      onChange={(e) => handleFieldChange('skin_undertone', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="cool">cool</option>
                      <option value="cool pink">cool pink</option>
                      <option value="neutral">neutral</option>
                      <option value="warm">warm</option>
                      <option value="warm golden">warm golden</option>
                      <option value="golden">golden</option>
                      <option value="peach">peach</option>
                      <option value="olive">olive</option>
                      <option value="red/warm">red/warm</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Texture
                    </label>
                    <select
                      value={formData.skin_texture || 'soft realistic with visible pores'}
                      onChange={(e) => handleFieldChange('skin_texture', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="naturally smooth">naturally smooth</option>
                      <option value="soft realistic">soft realistic</option>
                      <option value="soft realistic with visible pores">soft realistic with visible pores</option>
                      <option value="detailed realistic">detailed realistic</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Finish
                    </label>
                    <select
                      value={formData.skin_finish || 'natural satin'}
                      onChange={(e) => handleFieldChange('skin_finish', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="natural matte">natural matte</option>
                      <option value="natural satin">natural satin</option>
                      <option value="soft luminous">soft luminous</option>
                      <option value="dewy healthy glow">dewy healthy glow</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Distinctive Marks / Freckles
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'none',
                      'delicate freckles',
                      'freckles across bridge of nose',
                      'beauty mark below eye',
                      'beauty mark on cheek',
                      'cheek dimples',
                      'chin dimple',
                      'faint smile lines',
                    ].map((mark) => {
                      const isSelected =
                        Array.isArray(formData.distinctive_skin_features) &&
                        formData.distinctive_skin_features.includes(mark);
                      return (
                        <button
                          key={mark}
                          type="button"
                          onClick={() => handleMultiSelectToggle('distinctive_skin_features', mark)}
                          className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-medium'
                              : 'bg-white dark:bg-zinc-800 text-[#6e6e80] dark:text-[#a1a1aa] border border-gray-200 dark:border-zinc-700'
                          }`}
                        >
                          {mark}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 7: Hair & Hairstyle */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('hair')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Scissors size={15} className="text-emerald-500" />
                <span>7. Hair & Hairstyle</span>
              </div>
              {openSections.hair ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.hair && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Length
                    </label>
                    <select
                      value={formData.hair_length || 'long'}
                      onChange={(e) => handleFieldChange('hair_length', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="buzz/very short">buzz / very short</option>
                      <option value="pixie">pixie</option>
                      <option value="chin-length bob">chin-length bob</option>
                      <option value="shoulder-length">shoulder-length</option>
                      <option value="medium">medium</option>
                      <option value="long">long</option>
                      <option value="very long">very long</option>
                      <option value="waist-length">waist-length</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Texture
                    </label>
                    <select
                      value={formData.hair_texture || 'softly wavy'}
                      onChange={(e) => handleFieldChange('hair_texture', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="pin straight">pin straight</option>
                      <option value="silky straight">silky straight</option>
                      <option value="softly wavy">softly wavy</option>
                      <option value="wavy">wavy</option>
                      <option value="loose curls">loose curls</option>
                      <option value="curly">curly</option>
                      <option value="tightly coiled 4C">tightly coiled 4C</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Color
                    </label>
                    <select
                      value={formData.hair_color || 'jet black'}
                      onChange={(e) => handleFieldChange('hair_color', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="jet black">jet black</option>
                      <option value="soft black">soft black</option>
                      <option value="espresso brown">espresso brown</option>
                      <option value="chocolate brown">chocolate brown</option>
                      <option value="chestnut brown">chestnut brown</option>
                      <option value="auburn">auburn</option>
                      <option value="copper">copper</option>
                      <option value="honey blonde">honey blonde</option>
                      <option value="platinum blonde">platinum blonde</option>
                      <option value="silver gray">silver gray</option>
                      <option value="salt and pepper">salt and pepper</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Density
                    </label>
                    <select
                      value={formData.hair_density || 'thick'}
                      onChange={(e) => handleFieldChange('hair_density', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="fine">fine</option>
                      <option value="medium">medium</option>
                      <option value="thick">thick</option>
                      <option value="voluminous">voluminous</option>
                      <option value="very thick">very thick</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Details & Parting (Multi-select)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'clean middle part',
                      'side part',
                      'curtain bangs',
                      'wispy fringe',
                      'face-framing strands',
                      'soft layers',
                      'tucked behind ears',
                      'highlights',
                    ].map((detail) => {
                      const isSelected =
                        Array.isArray(formData.hair_details) && formData.hair_details.includes(detail);
                      return (
                        <button
                          key={detail}
                          type="button"
                          onClick={() => handleMultiSelectToggle('hair_details', detail)}
                          className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-medium'
                              : 'bg-white dark:bg-zinc-800 text-[#6e6e80] dark:text-[#a1a1aa] border border-gray-200 dark:border-zinc-700'
                          }`}
                        >
                          {detail}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category 8: Makeup & Accessories */}
          <div className="rounded-xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
            <button
              onClick={() => toggleSection('makeup')}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#0d0d0d] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-emerald-500" />
                <span>8. Makeup & Distinctive Accessories</span>
              </div>
              {openSections.makeup ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {openSections.makeup && (
              <div className="p-4 pt-1 space-y-3 border-t border-[#f0f0f0] dark:border-[#27272a]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Makeup Level
                    </label>
                    <select
                      value={formData.makeup_level || 'natural'}
                      onChange={(e) => handleFieldChange('makeup_level', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="none">none (completely bare skin)</option>
                      <option value="minimal no-makeup look">minimal no-makeup look</option>
                      <option value="natural">natural</option>
                      <option value="soft glam">soft glam</option>
                      <option value="polished glam">polished glam</option>
                      <option value="editorial">editorial</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Distinctive Piercing / Glasses
                    </label>
                    <select
                      value={
                        Array.isArray(formData.distinctive_features) && formData.distinctive_features[0]
                          ? formData.distinctive_features[0]
                          : 'none'
                      }
                      onChange={(e) => handleFieldChange('distinctive_features', [e.target.value])}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                    >
                      <option value="none">none</option>
                      <option value="small gold nose stud">small gold nose stud</option>
                      <option value="small silver nose ring">small silver nose ring</option>
                      <option value="thin wire-frame glasses">thin wire-frame glasses</option>
                      <option value="multiple ear piercings">multiple ear piercings</option>
                      <option value="cartilage hoop">cartilage hoop</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Free Text Identity Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formData.identity_notes || ''}
                    onChange={(e) => handleFieldChange('identity_notes', e.target.value)}
                    placeholder="e.g., Slightly asymmetrical charming smile, expressive dark irises"
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Live Compiled Prompt & Result Deck ── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 lg:p-6 bg-white dark:bg-[#121214] space-y-5">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 rounded-2xl border border-emerald-500/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                16:9 Facial Turnaround Sheet
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono">
                Image 1 Face Lock
              </span>
            </div>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
              Generates 3 consistent views horizontally (Left 3/4 · Centered Front · Right 3/4) with clean labels on pure white background.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 ${
              isGenerating ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{generationProgress || 'Rendering Face Card...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generate Face Card</span>
              </>
            )}
          </button>
        </div>

        {/* Generated Image Result Card */}
        {generatedResult && (
          <div className="rounded-2xl border border-emerald-500/30 bg-[#fafafa] dark:bg-[#18181b] overflow-hidden shadow-lg animate-fade">
            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Face Reference Card Generated
                </span>
                <span className="text-[10px] font-mono text-[#6e6e80] dark:text-[#a1a1aa]">
                  ({generatedResult.duration_s.toFixed(1)}s · {generatedResult.account_used})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <PlusCircle size={13} />
                  <span>Assign to Character</span>
                </button>
              </div>
            </div>

            {/* 16:9 Image Preview Container */}
            <div className="relative aspect-[16/9] w-full bg-black/5 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
              <img
                src={generatedResult.image_url}
                alt="Generated Face Identity Reference Card"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                {onOpenViewer && (
                  <button
                    onClick={() =>
                      onOpenViewer({
                        id: generatedResult.image_url.split('/').pop() || 'gen',
                        url: generatedResult.image_url,
                        prompt: compiledPrompt,
                        favorite: false,
                        conversation_id: generatedResult.conversation_id,
                        created_at: Date.now() / 1000,
                        duration_s: generatedResult.duration_s,
                        account_used: generatedResult.account_used,
                        size_bytes: generatedResult.size_bytes || null,
                        md5: null,
                        tweaked_prompt: null,
                        tweaked_prompt_2: null,
                      })
                    }
                    className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-colors"
                    title="Fullscreen Inspect"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="p-3 border-t border-[#e5e5e5] dark:border-[#27272a] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAssignMode('new');
                    setIsAssignModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                >
                  <PlusCircle size={14} />
                  <span>Save as New Character</span>
                </button>

                <button
                  onClick={() => {
                    setAssignMode('existing');
                    setIsAssignModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <LinkIcon size={14} />
                  <span>Assign to Existing</span>
                </button>
              </div>

              {onContinueInChat && (
                <button
                  onClick={() =>
                    onContinueInChat({
                      id: generatedResult.image_url.split('/').pop() || 'gen',
                      url: generatedResult.image_url,
                      prompt: compiledPrompt,
                      favorite: false,
                      conversation_id: generatedResult.conversation_id,
                      created_at: Date.now() / 1000,
                      duration_s: generatedResult.duration_s,
                      account_used: generatedResult.account_used,
                      size_bytes: generatedResult.size_bytes || null,
                      md5: null,
                      tweaked_prompt: null,
                      tweaked_prompt_2: null,
                    })
                  }
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white"
                >
                  <ExternalLink size={13} />
                  <span>Continue in Chat</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Prompt Preview Box */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
          <div className="p-3 px-4 border-b border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between bg-[#fafafa] dark:bg-[#151518]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                Live Compiled Template Prompt
              </span>
              <span className="text-[10px] font-mono text-[#6e6e80] dark:text-[#a1a1aa]">
                ({compiledPrompt.length} chars)
              </span>
            </div>

            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copiedPrompt ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
            </button>
          </div>

          <div className="p-4 flex-1">
            <pre className="text-xs font-mono whitespace-pre-wrap text-[#4b4b59] dark:text-[#d4d4d8] leading-relaxed bg-[#f9f9fa] dark:bg-[#111113] p-3.5 rounded-xl border border-[#eeeeee] dark:border-[#222226] max-h-[380px] overflow-y-auto">
              {compiledPrompt}
            </pre>
          </div>

          <div className="p-3 border-t border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#151518] flex items-center justify-between text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
            <div className="flex items-center gap-1">
              <Info size={13} />
              <span>Standard 16:9 Landscape · Centered Front View with Left & Right 3/4 Turnarounds</span>
            </div>
            <span className="font-mono">OpenAI ChatGPT 4o / DALL-E</span>
          </div>
        </div>
      </div>

      {/* ── ASSIGNMENT MODAL ── */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade">
          <div className="w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl border border-[#e5e5e5] dark:border-[#27272a] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0d0d0d] dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                <span>Assign Face Lock Card</span>
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-xs text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="p-5 space-y-4">
              {assignSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {assignSuccess}
                </div>
              ) : (
                <>
                  {/* Mode Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-[#f4f4f5] dark:bg-[#202023] rounded-lg text-xs font-medium">
                    <button
                      onClick={() => setAssignMode('new')}
                      className={`py-1.5 rounded-md transition-all ${
                        assignMode === 'new'
                          ? 'bg-white dark:bg-[#18181b] text-[#0d0d0d] dark:text-white shadow-xs'
                          : 'text-[#6e6e80] dark:text-[#a1a1aa]'
                      }`}
                    >
                      + Create New Character
                    </button>
                    <button
                      onClick={() => setAssignMode('existing')}
                      className={`py-1.5 rounded-md transition-all ${
                        assignMode === 'existing'
                          ? 'bg-white dark:bg-[#18181b] text-[#0d0d0d] dark:text-white shadow-xs'
                          : 'text-[#6e6e80] dark:text-[#a1a1aa]'
                      }`}
                    >
                      🔗 Existing Character
                    </button>
                  </div>

                  {assignMode === 'new' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                          Character Name
                        </label>
                        <input
                          type="text"
                          value={formData.character_name || ''}
                          onChange={(e) => handleFieldChange('character_name', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                          Compiled Visual DNA
                        </label>
                        <textarea
                          rows={3}
                          value={generatedVisualDna}
                          onChange={(e) => setGeneratedVisualDna(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                        />
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                        This face turnaround sheet will be assigned as <b>Image 1 (Face Lock)</b> and the character will be immediately locked as active!
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                          Select Character to Update
                        </label>
                        {characters.length === 0 ? (
                          <div className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] p-3 text-center border border-dashed rounded-lg">
                            No characters saved yet. Switch to "Create New Character" above.
                          </div>
                        ) : (
                          <select
                            value={targetCharId}
                            onChange={(e) => setTargetCharId(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214]"
                          >
                            <option value="">-- Choose Character --</option>
                            {characters.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.is_locked ? '(Active Locked)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#f4f4f5] dark:bg-[#202023] text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                        Will set this 16:9 turnaround card as the character's primary <b>Face Lock Reference (Image 1)</b>.
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e5e5] dark:border-[#27272a]">
                    <button
                      onClick={() => setIsAssignModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmAssignment}
                      disabled={isAssigning || (assignMode === 'existing' && !targetCharId)}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                    >
                      {isAssigning ? 'Saving…' : 'Save & Assign Lock'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
