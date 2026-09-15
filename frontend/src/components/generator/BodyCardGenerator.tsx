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
  Activity,
  Maximize2,
  ExternalLink,
  PlusCircle,
  Link as LinkIcon,
  CheckCircle2,
  Info,
  Loader2,
  Shield,
  Shirt,
  Sparkle,
} from 'lucide-react';
import { CharacterCard, ImageResult, GalleryItem } from '../../types';
import { api, copyToClipboard } from '../../lib/api';

interface BodyCardGeneratorProps {
  characters: CharacterCard[];
  onRefreshCharacters: () => void;
  onOpenViewer?: (item: GalleryItem) => void;
  onContinueInChat?: (item: GalleryItem) => void;
}

export function BodyCardGenerator({
  characters,
  onRefreshCharacters,
  onOpenViewer,
  onContinueInChat,
}: BodyCardGeneratorProps) {
  // Archetypes state loaded from backend
  const [archetypes, setArchetypes] = useState<Record<string, any>>({});
  const [selectedArchetype, setSelectedArchetype] = useState<string>('kaya_soft_hourglass');
  const [isRolling, setIsRolling] = useState(false);

  // Form Data State
  const [formData, setFormData] = useState<Record<string, any>>({
    character_name: 'Kaya',
    gender_presentation: 'woman',
    age_appearance: 'early 20s',
    ethnicity_ancestry: ['North Indian / South Asian'],
    height_impression: 'average',
    overall_body_type: 'hourglass',
    body_presence: 'soft feminine',
    posture: 'relaxed natural',
    shoulders: 'soft balanced',
    chest_bust: 'full',
    arms: 'slender',
    waist: 'defined',
    abdomen: 'gentle lower-belly fullness',
    hips_pelvis: 'rounded',
    lower_body: 'rounded',
    thighs: 'soft',
    legs: 'balanced',
    tone: 'medium',
    undertone: 'golden',
    texture: 'realistic visible pores',
    distinctive_features: 'beauty marks',
    length: 'long',
    density: 'thick',
    texture_hair: 'wavy',
    color: 'black',
    distinctive_details: 'pulled back neatly into a low ponytail keeping shoulders and neckline clear',
    style: 'simple fitted tank and shorts',
  });

  // Collapsible Accordion sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true,
    silhouette: true,
    upper: false,
    midsection: false,
    lower: false,
    skin: false,
    hair: false,
    attire: false,
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
    let mounted = true;
    api.getBodyCardDictionary()
      .then((res) => {
        if (mounted && res.ok && res.archetypes) {
          setArchetypes(res.archetypes);
        }
      })
      .catch((err) => console.error('Failed to load body dictionary:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Live compiled prompt generated on the fly
  const compiledPrompt = useMemo(() => {
    const name = formData.character_name || 'Kaya';
    const gender = formData.gender_presentation || 'woman';
    const age = formData.age_appearance || 'early 20s';
    const ethList = Array.isArray(formData.ethnicity_ancestry)
      ? formData.ethnicity_ancestry.join(', ')
      : formData.ethnicity_ancestry || 'North Indian / South Asian';

    const heightImp = formData.height_impression || 'average';
    const bodyType = formData.overall_body_type || 'hourglass';
    const presence = formData.body_presence || 'soft feminine';
    const posture = formData.posture || 'relaxed natural';

    const shoulders = formData.shoulders || 'soft balanced';
    const chestBust = formData.chest_bust || 'full';
    const arms = formData.arms || 'slender';

    const waist = formData.waist || 'defined';
    const abdomen = formData.abdomen || 'gentle lower-belly fullness';

    const hips = formData.hips_pelvis || 'rounded';
    const glute = formData.lower_body || 'rounded';
    const thighs = formData.thighs || 'soft';
    const legs = formData.legs || 'balanced';

    const skinTone = formData.tone || 'medium';
    const skinUnder = formData.undertone || 'golden';
    const skinTex = formData.texture || 'realistic visible pores';
    const distinctSkin = formData.distinctive_features || '';

    const hairLen = formData.length || 'long';
    const hairDens = formData.density || 'thick';
    const hairTex = formData.texture_hair || 'wavy';
    const hairCol = formData.color || 'black';
    const hairArr = formData.distinctive_details || 'pulled back neatly into a low ponytail keeping shoulders and neckline clear';

    const attire = formData.style || 'simple fitted tank and shorts';

    const skinDistinctLine = distinctSkin && distinctSkin.toLowerCase() !== 'none'
      ? `Distinctive skin characteristics: ${distinctSkin}.`
      : '';

    return `Create a high-resolution photorealistic **BODY IDENTITY REFERENCE CARD** for
${name}, a fictional adult ${ethList} ${gender}
in their ${age}.

Use a **4:3 landscape image composition** designed specifically as a full-body reference sheet.

At the top center, place only the title:

**BODY IDENTITY REFERENCE CARD**

Below the title, show the SAME person in four consistent full-body views arranged horizontally in four clearly separated panels:

1. front view — label below: **"Front side"**
2. left side profile — label below: **"Left side"**
3. back view — label below: **"Back side"**
4. right side profile — label below: **"Right side"**

Each view must occupy its own **clean rectangular panel with a thin, subtle border**, with equal panel width and consistent spacing. Use a **pure white overall background** and clean white space between the panels.

Keep all four figures at the same body scale, camera distance, vertical alignment, lighting, and rendering quality. Make the complete body clearly visible from head to feet in every view.

Use **minimal, neutral, close-fitting reference attire** (${attire}) that keeps the body's natural silhouette and proportions clearly visible. Avoid bulky, oversized, loose, layered, or distracting clothing that obscures the torso, waist, hips, limbs, or overall body shape.

Height impression is ${heightImp} height impression with balanced skeletal frame.
Overall body type is ${bodyType} silhouette with natural human proportions.
Shoulders are ${shoulders} with clean anatomical definition.
Chest and bust are ${chestBust} with natural shape and proportion.
Waist is ${waist} with a smooth natural indent.
Hips and pelvis are ${hips} providing a balanced pelvic contour.
Thighs are ${thighs} with realistic muscular and soft tissue transition.
Legs are ${legs} in proportion to the torso, extending down to neutral bare feet or minimal flat soles.
Arms are ${arms} resting naturally at sides.
Stomach and abdomen have ${abdomen} without unnatural exaggeration.
Glutes and lower body have ${glute} fullness visible in side and back profiles.
Posture and body presence are ${posture} posture with a ${presence} body presence.

Their skin is ${skinTone} with ${skinUnder} undertones, ${skinTex}.
${skinDistinctLine}

Their hair is ${hairLen}, ${hairDens} density, ${hairTex}, ${hairCol}, with ${hairArr}.

Keep facial styling minimal and consistent so the reference remains primarily focused on physical identity.

Use consistent soft natural lighting, realistic human anatomy, realistic skin texture, natural body detail, accurate proportions, and photorealistic rendering.

Do not slim, enlarge, or otherwise reshape the body beyond the specified physical description. Do not exaggerate body volume or make the character generally heavier or thinner than intended. Preserve the same natural proportions consistently across all four views.

No artificial symmetry, excessive retouching, plastic skin, stylization, perspective distortion, wide-angle distortion, or unrealistic proportions.

No text anywhere on the image except:

* **"BODY IDENTITY REFERENCE CARD"**
* **"Front side"**
* **"Left side"**
* **"Back side"**
* **"Right side"**

Place each view label neatly below its corresponding panel.

All four views must depict **EXACTLY THE SAME PERSON** with identical body structure, proportions, skin characteristics, height impression, and recognizable physical features.

The side and back views should naturally reveal body depth, shoulder width, torso shape, waist definition, hip structure, limb proportions, and overall silhouette while remaining clearly consistent with the front view.`.trim();
  }, [formData]);

  // Toggle Accordion section
  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Field change handler
  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Multi-select toggle helper
  const toggleMultiSelect = (key: string, option: string) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (current.includes(option)) {
        return { ...prev, [key]: current.filter((x: string) => x !== option) };
      } else {
        return { ...prev, [key]: [...current, option] };
      }
    });
  };

  // Randomize button
  const handleRandomize = async (archetypeKey?: string) => {
    if (isRolling) return;
    setIsRolling(true);
    try {
      const res = await api.randomizeBodyCard(archetypeKey);
      if (res.ok && res.data) {
        setFormData(res.data);
        if (archetypeKey) setSelectedArchetype(archetypeKey);
      }
    } catch (e) {
      console.error('Randomize body error:', e);
    } finally {
      setTimeout(() => setIsRolling(false), 400);
    }
  };

  // Archetype change
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
    setGenerationProgress('Submitting full-body turnaround to engine…');
    setGeneratedResult(null);

    try {
      const res = await api.generateBodyCard(formData);
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
          visual_dna: generatedVisualDna || `${formData.character_name}: Full-body identity reference locked.`,
          body_lock_image_id: imageStem,
          character_lock: {
            references: {
              image_2: `BODY_LOCK — ${imageStem} (4:3 full-body turnaround sheet)`,
            },
            body: {
              height_impression: formData.height_impression,
              overall_body_type: formData.overall_body_type,
              shoulders: formData.shoulders,
              chest_bust: formData.chest_bust,
              waist: formData.waist,
              hips_pelvis: formData.hips_pelvis,
              thighs: formData.thighs,
              legs: formData.legs,
              arms: formData.arms,
              abdomen: formData.abdomen,
              lower_body: formData.lower_body,
              posture: formData.posture,
            },
          },
        };
        const saved = await api.saveCharacter(newCharPayload);
        setAssignSuccess(`Created new character "${saved.name}" with locked Body Card!`);
        onRefreshCharacters();
      } else {
        const existing = characters.find((c) => c.id === targetCharId);
        if (!existing) throw new Error('Selected character not found');

        const updatedLock = {
          ...(existing.character_lock || {}),
          references: {
            ...((existing.character_lock && existing.character_lock.references) || {}),
            image_2: `BODY_LOCK — ${imageStem} (4:3 full-body turnaround sheet)`,
          },
          body: {
            height_impression: formData.height_impression,
            overall_body_type: formData.overall_body_type,
            shoulders: formData.shoulders,
            chest_bust: formData.chest_bust,
            waist: formData.waist,
            hips_pelvis: formData.hips_pelvis,
            thighs: formData.thighs,
            legs: formData.legs,
            arms: formData.arms,
            abdomen: formData.abdomen,
            lower_body: formData.lower_body,
            posture: formData.posture,
          },
        };

        const updatedChar: CharacterCard = {
          ...existing,
          body_lock_image_id: imageStem,
          character_lock: updatedLock,
        };

        await api.saveCharacter(updatedChar);
        setAssignSuccess(`Assigned Body Reference Card to "${existing.name}"!`);
        onRefreshCharacters();
      }
    } catch (err: any) {
      alert(`Assignment failed: ${err.message || err}`);
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
                <Shield size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-sm leading-tight text-[#0d0d0d] dark:text-white">
                  Body Card Studio
                </h2>
                <span className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                  4:3 Full-Body 4-View Turnaround Sheet
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRandomize()}
                disabled={isRolling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#0d0d0d] dark:text-white bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-2xs active:scale-95 ${
                  isRolling ? 'opacity-70 animate-pulse' : ''
                }`}
                title="Randomize entire body with anatomical harmony"
              >
                <Dices size={14} className={isRolling ? 'animate-spin text-emerald-500' : 'text-emerald-500'} />
                <span>🎲 Randomize</span>
              </button>

              <button
                onClick={() => handleSelectArchetype('kaya_soft_hourglass')}
                className="p-1.5 rounded-lg text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={15} />
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95 ${
                  isGenerating ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                title="Generate 4:3 Body Identity Reference Card"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{isGenerating ? 'Generating…' : 'Generate Card'}</span>
              </button>
            </div>
          </div>

          {/* Archetype Quick Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] shrink-0">Preset Archetype:</span>
            <select
              value={selectedArchetype}
              onChange={(e) => handleSelectArchetype(e.target.value)}
              className="flex-1 text-xs py-1.5 px-2.5 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] text-[#0d0d0d] dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="kaya_soft_hourglass">Kaya (Soft Hourglass · South Asian Grace)</option>
              <option value="freya_athletic_fit">Freya (Athletic Runner · Nordic Power)</option>
              <option value="meiling_petite_curve">Meiling (Petite Grace · East Asian Delicate)</option>
              <option value="amina_statuesque_elegance">Amina (Tall Statuesque · West African Poise)</option>
              <option value="camila_curvy_radiance">Camila (Curvy Voluptuous · Latin Glow)</option>
              <option value="astrid_slender_minimalist">Astrid (Slender Minimalist · Tall Lean)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Categories Form */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {/* 1. Character Basics */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('basics')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <User size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">1. Character Basics</span>
              </div>
              {openSections.basics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.basics && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={formData.character_name || ''}
                    onChange={(e) => handleFieldChange('character_name', e.target.value)}
                    placeholder="e.g., Kaya, Freya, Elena"
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="woman">woman</option>
                      <option value="man">man</option>
                      <option value="feminine person">feminine person</option>
                      <option value="masculine person">masculine person</option>
                      <option value="androgynous person">androgynous person</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Age Appearance
                    </label>
                    <select
                      value={formData.age_appearance || 'early 20s'}
                      onChange={(e) => handleFieldChange('age_appearance', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="18–20">18–20</option>
                      <option value="early 20s">early 20s</option>
                      <option value="mid-20s">mid-20s</option>
                      <option value="late 20s">late 20s</option>
                      <option value="early 30s">early 30s</option>
                      <option value="mid-30s">mid-30s</option>
                      <option value="40s">40s</option>
                      <option value="50s+">50s+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Ethnicity / Ancestry
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'North Indian / South Asian',
                      'South Asian',
                      'East Asian',
                      'Southeast Asian',
                      'Central Asian',
                      'Middle Eastern',
                      'Mediterranean',
                      'Scandinavian / Nordic',
                      'Western European',
                      'Celtic / Irish',
                      'African',
                      'West African',
                      'Latin American',
                      'mixed ancestry',
                    ].map((eth) => {
                      const isSelected = Array.isArray(formData.ethnicity_ancestry)
                        ? formData.ethnicity_ancestry.includes(eth)
                        : formData.ethnicity_ancestry === eth;
                      return (
                        <button
                          key={eth}
                          type="button"
                          onClick={() => toggleMultiSelect('ethnicity_ancestry', eth)}
                          className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-medium shadow-xs'
                              : 'bg-gray-100 dark:bg-zinc-800 text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white'
                          }`}
                        >
                          {eth}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Height & Overall Silhouette */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('silhouette')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">2. Height &amp; Overall Silhouette</span>
              </div>
              {openSections.silhouette ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.silhouette && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Height Impression
                    </label>
                    <select
                      value={formData.height_impression || 'average'}
                      onChange={(e) => handleFieldChange('height_impression', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="petite">petite (compact frame)</option>
                      <option value="short">short (balanced compact)</option>
                      <option value="average">average (balanced frame)</option>
                      <option value="tall">tall (elongated frame)</option>
                      <option value="very tall">very tall (statuesque)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Overall Body Type
                    </label>
                    <select
                      value={formData.overall_body_type || 'hourglass'}
                      onChange={(e) => handleFieldChange('overall_body_type', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="hourglass">hourglass (balanced bust/hips, defined waist)</option>
                      <option value="curvy">curvy (voluptuous curves)</option>
                      <option value="pear">pear (narrower shoulders, wider hips)</option>
                      <option value="athletic">athletic (toned, low body fat)</option>
                      <option value="muscular">muscular (pronounced muscularity)</option>
                      <option value="lean">lean (slender athletic)</option>
                      <option value="slim">slim (straight elegant silhouette)</option>
                      <option value="soft">soft (gentle everyday softness)</option>
                      <option value="rectangle">rectangle (balanced shoulder/hip)</option>
                      <option value="inverted triangle">inverted triangle (broad shoulders)</option>
                      <option value="plus-size">plus-size (full rounded contours)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Body Presence
                    </label>
                    <select
                      value={formData.body_presence || 'soft feminine'}
                      onChange={(e) => handleFieldChange('body_presence', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft feminine">soft feminine</option>
                      <option value="delicate">delicate</option>
                      <option value="curvy feminine">curvy feminine</option>
                      <option value="natural">natural</option>
                      <option value="athletic">athletic</option>
                      <option value="statuesque">statuesque</option>
                      <option value="strong">strong</option>
                      <option value="grounded powerful">grounded powerful</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Posture
                    </label>
                    <select
                      value={formData.posture || 'relaxed natural'}
                      onChange={(e) => handleFieldChange('posture', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="relaxed natural">relaxed natural</option>
                      <option value="upright">upright</option>
                      <option value="confident">confident</option>
                      <option value="elegant">elegant</option>
                      <option value="casual">casual</option>
                      <option value="athletic">athletic</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Upper Body & Torso */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('upper')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">3. Upper Body &amp; Torso</span>
              </div>
              {openSections.upper ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.upper && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Shoulders
                    </label>
                    <select
                      value={formData.shoulders || 'soft balanced'}
                      onChange={(e) => handleFieldChange('shoulders', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft balanced">soft balanced</option>
                      <option value="narrow">narrow</option>
                      <option value="average">average</option>
                      <option value="broad">broad</option>
                      <option value="strong athletic">strong athletic</option>
                      <option value="delicate sloping">delicate sloping</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Chest / Bust
                    </label>
                    <select
                      value={formData.chest_bust || 'moderate'}
                      onChange={(e) => handleFieldChange('chest_bust', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="small">small</option>
                      <option value="moderate">moderate</option>
                      <option value="full">full</option>
                      <option value="very full">very full</option>
                      <option value="prominent">prominent</option>
                      <option value="toned athletic pectorals">toned athletic</option>
                      <option value="broad muscular chest">broad muscular</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Arms
                  </label>
                  <select
                    value={formData.arms || 'slender'}
                    onChange={(e) => handleFieldChange('arms', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="slender">slender</option>
                    <option value="soft">soft natural</option>
                    <option value="average">average</option>
                    <option value="full">full</option>
                    <option value="toned">toned athletic</option>
                    <option value="muscular">muscular</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 4. Waist & Abdomen */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('midsection')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">4. Waist &amp; Abdomen</span>
              </div>
              {openSections.midsection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.midsection && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Waist Definition
                    </label>
                    <select
                      value={formData.waist || 'defined'}
                      onChange={(e) => handleFieldChange('waist', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="defined">defined</option>
                      <option value="narrow">narrow</option>
                      <option value="very narrow">very narrow</option>
                      <option value="softly defined">softly defined</option>
                      <option value="straight">straight</option>
                      <option value="tapered athletic">tapered athletic</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Stomach / Abdomen
                    </label>
                    <select
                      value={formData.abdomen || 'gentle lower-belly fullness'}
                      onChange={(e) => handleFieldChange('abdomen', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="gentle lower-belly fullness">gentle lower-belly fullness</option>
                      <option value="flat natural">flat natural</option>
                      <option value="soft">soft</option>
                      <option value="moderately full">moderately full</option>
                      <option value="rounded">rounded</option>
                      <option value="defined athletic">defined athletic</option>
                      <option value="subtle vertical midline (linea alba)">subtle midline (linea alba)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Hips, Lower Body & Legs */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('lower')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">5. Hips, Lower Body &amp; Legs</span>
              </div>
              {openSections.lower ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.lower && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Hips &amp; Pelvis
                    </label>
                    <select
                      value={formData.hips_pelvis || 'rounded'}
                      onChange={(e) => handleFieldChange('hips_pelvis', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="rounded">rounded</option>
                      <option value="moderate">moderate</option>
                      <option value="narrow">narrow</option>
                      <option value="wide">wide</option>
                      <option value="very wide">very wide</option>
                      <option value="high-shelf feminine curve">high-shelf feminine curve</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Glute / Lower-Body
                    </label>
                    <select
                      value={formData.lower_body || 'rounded'}
                      onChange={(e) => handleFieldChange('lower_body', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="rounded">rounded</option>
                      <option value="subtle">subtle</option>
                      <option value="full">full</option>
                      <option value="prominent">prominent</option>
                      <option value="athletic">athletic</option>
                      <option value="generous natural fullness">generous fullness</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Thighs
                    </label>
                    <select
                      value={formData.thighs || 'soft'}
                      onChange={(e) => handleFieldChange('thighs', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft">soft</option>
                      <option value="slender">slender</option>
                      <option value="moderate">moderate</option>
                      <option value="full">full</option>
                      <option value="strong muscular">strong muscular</option>
                      <option value="athletic quad sweep">athletic quad sweep</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Legs &amp; Proportions
                    </label>
                    <select
                      value={formData.legs || 'balanced'}
                      onChange={(e) => handleFieldChange('legs', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="balanced">balanced</option>
                      <option value="long-looking">long-looking</option>
                      <option value="very long-looking">very long-looking</option>
                      <option value="slender">slender</option>
                      <option value="athletic">athletic</option>
                      <option value="short-looking">short-looking</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Skin & Complexion */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('skin')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">6. Skin &amp; Complexion</span>
              </div>
              {openSections.skin ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.skin && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Skin Tone
                    </label>
                    <select
                      value={formData.tone || 'medium'}
                      onChange={(e) => handleFieldChange('tone', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="very fair">very fair</option>
                      <option value="fair">fair</option>
                      <option value="light">light</option>
                      <option value="light-medium">light-medium</option>
                      <option value="medium">medium</option>
                      <option value="tan">tan</option>
                      <option value="deep">deep</option>
                      <option value="very deep">very deep</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Undertone
                    </label>
                    <select
                      value={formData.undertone || 'golden'}
                      onChange={(e) => handleFieldChange('undertone', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="golden">golden</option>
                      <option value="warm">warm</option>
                      <option value="neutral">neutral</option>
                      <option value="cool">cool</option>
                      <option value="peach">peach</option>
                      <option value="olive">olive</option>
                      <option value="pink">pink</option>
                      <option value="red">red</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Texture
                    </label>
                    <select
                      value={formData.texture || 'realistic visible pores'}
                      onChange={(e) => handleFieldChange('texture', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="realistic visible pores">realistic visible pores</option>
                      <option value="smooth natural">smooth natural</option>
                      <option value="soft">soft</option>
                      <option value="slightly textured">slightly textured</option>
                      <option value="freckled">freckled</option>
                      <option value="subtly luminous natural hydration">subtly luminous</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Distinctive Features
                    </label>
                    <select
                      value={formData.distinctive_features || 'beauty marks'}
                      onChange={(e) => handleFieldChange('distinctive_features', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="none">none</option>
                      <option value="beauty marks">beauty marks</option>
                      <option value="freckles across shoulders">freckles across shoulders</option>
                      <option value="moles">small moles</option>
                      <option value="birthmark">birthmark</option>
                      <option value="small scars">small scars</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 7. Hair Styling (Unobstructed Reference) */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('hair')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">7. Hair Styling (Unobstructed Reference)</span>
              </div>
              {openSections.hair ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.hair && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Hair Length
                    </label>
                    <select
                      value={formData.length || 'long'}
                      onChange={(e) => handleFieldChange('length', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="very short">very short</option>
                      <option value="short">short</option>
                      <option value="shoulder length">shoulder length</option>
                      <option value="long">long</option>
                      <option value="very long">very long</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Hair Color
                    </label>
                    <select
                      value={formData.color || 'black'}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="black">black</option>
                      <option value="dark brown">dark brown</option>
                      <option value="medium brown">medium brown</option>
                      <option value="light brown">light brown</option>
                      <option value="blonde">blonde</option>
                      <option value="red">red</option>
                      <option value="auburn">auburn</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Hair Arrangement (Keep Silhouettes Clear)
                  </label>
                  <select
                    value={formData.distinctive_details || 'pulled back neatly into a low ponytail keeping shoulders and neckline clear'}
                    onChange={(e) => handleFieldChange('distinctive_details', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="pulled back neatly into a low ponytail keeping shoulders and neckline clear">
                      low ponytail (shoulders and neckline clear)
                    </option>
                    <option value="gathered in a high clean bun keeping torso silhouette fully visible">
                      high clean bun (torso silhouette fully clear)
                    </option>
                    <option value="neatly pinned behind shoulders and back">
                      neatly pinned behind shoulders and back
                    </option>
                    <option value="short crop fully exposing neck and shoulder contour">
                      short crop (fully exposes neck and shoulders)
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 8. Reference Attire */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('attire')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shirt size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">8. Reference Attire</span>
              </div>
              {openSections.attire ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.attire && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Minimal Fitted Style
                  </label>
                  <select
                    value={formData.style || 'simple fitted tank and shorts'}
                    onChange={(e) => handleFieldChange('style', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="simple fitted tank and shorts">simple fitted tank and shorts</option>
                    <option value="minimal neutral fitted clothing">minimal neutral fitted clothing</option>
                    <option value="simple fitted top and leggings">simple fitted top and leggings</option>
                    <option value="neutral fitted bodysuit">neutral fitted bodysuit</option>
                    <option value="matte neutral athletic sports top and bike shorts">matte sports top &amp; bike shorts</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Keep clothing minimal, neutral, close-fitting, and non-distracting so the complete body silhouette and proportions remain clearly visible.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Action Bar (always pinned at the bottom of the left column) */}
        <div className="p-3 border-t border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] flex items-center justify-between gap-2 shrink-0 shadow-xs z-10">
          <button
            onClick={() => handleRandomize()}
            disabled={isRolling}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#0d0d0d] dark:text-white bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-2xs active:scale-95 disabled:opacity-60 shrink-0"
            title="Randomize entire body with anatomical harmony"
          >
            <Dices size={14} className={isRolling ? 'animate-spin text-emerald-500' : 'text-emerald-500'} />
            <span>🎲 Randomize</span>
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 ${
              isGenerating ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            title="Generate 4:3 Body Identity Reference Card"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{generationProgress || 'Rendering Body Card...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generate Body Card (4:3)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Live Compiled Prompt & Result Deck ── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 lg:p-6 bg-white dark:bg-[#121214] space-y-5">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 rounded-2xl border border-emerald-500/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                4:3 Full-Body Reference Sheet
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono">
                Image 2 Body Lock
              </span>
            </div>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
              Generates 4 separated panels (Front side · Left side · Back side · Right side) with clean borders on pure white background.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 ${
              isGenerating ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{generationProgress || 'Rendering Body Card...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generate Body Card</span>
              </>
            )}
          </button>
        </div>

        {/* Prominent CTA when no result has been generated yet */}
        {!generatedResult && (
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#0d0d0d] dark:text-white">
                  Ready to Render Body Reference Card
                </h3>
                <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
                  4:3 photorealistic 4-view full-body sheet with Front, Left, Back, and Right side views.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>{generationProgress || 'Rendering Body Card...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Generate Body Card (4:3)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Generated Image Result Card */}
        {generatedResult && (
          <div className="rounded-2xl border border-emerald-500/30 bg-[#fafafa] dark:bg-[#18181b] overflow-hidden shadow-lg animate-fade">
            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Body Reference Card Generated
                </span>
                <span className="text-[10px] font-mono text-[#6e6e80] dark:text-[#a1a1aa]">
                  ({((generatedResult.duration_s ?? 0)).toFixed(1)}s · {generatedResult.account_used || 'Primary'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <PlusCircle size={13} />
                  <span>Assign to Character</span>
                </button>
              </div>
            </div>

            {/* 4:3 Image Preview Container */}
            <div className="relative aspect-[4/3] w-full bg-black/5 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
              <img
                src={generatedResult.image_url}
                alt="Generated Body Identity Reference Card"
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
                    className="p-2 rounded-xl bg-black/70 hover:bg-black text-white shadow-lg backdrop-blur-xs transition-all"
                    title="Fullscreen Viewer"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Card Result Footer Controls */}
            <div className="p-3 bg-white dark:bg-[#141416] border-t border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between">
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
        <div className="flex-1 flex flex-col rounded-2xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
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
              <span>Standard 4:3 Landscape · 4 Distinct Panels (Front, Left, Back, Right) with Subtle Borders</span>
            </div>
            <span className="font-mono">OpenAI ChatGPT 4o / DALL-E</span>
          </div>
        </div>
      </div>

      {/* ── ASSIGNMENT MODAL ── */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-fade">
          <div className="w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl border border-[#e5e5e5] dark:border-[#27272a] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="text-emerald-500" size={18} />
                <h3 className="font-semibold text-sm">Assign Body Reference Card</h3>
              </div>
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssignSuccess(null);
                }}
                className="text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {assignSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={16} />
                    <span>Success</span>
                  </div>
                  <p>{assignSuccess}</p>
                  <button
                    onClick={() => {
                      setIsAssignModalOpen(false);
                      setAssignSuccess(null);
                    }}
                    className="mt-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-center self-end"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setAssignMode('new')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        assignMode === 'new'
                          ? 'bg-white dark:bg-[#18181b] text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                          : 'text-[#6e6e80] dark:text-[#a1a1aa]'
                      }`}
                    >
                      Create as New Character
                    </button>
                    <button
                      onClick={() => setAssignMode('existing')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        assignMode === 'existing'
                          ? 'bg-white dark:bg-[#18181b] text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                          : 'text-[#6e6e80] dark:text-[#a1a1aa]'
                      }`}
                    >
                      Assign to Existing Character
                    </button>
                  </div>

                  {assignMode === 'new' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                          Character Name
                        </label>
                        <input
                          type="text"
                          value={formData.character_name || ''}
                          onChange={(e) => handleFieldChange('character_name', e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                        This will create a new character profile with this 4:3 Body Turnaround Card saved as Image 2 (Body Lock) and attach the anatomical details.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                          Select Character
                        </label>
                        <select
                          value={targetCharId}
                          onChange={(e) => setTargetCharId(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">-- Choose Character --</option>
                          {characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.body_lock_image_id ? '(Has Body Lock)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                        Attaches this generated card as Image 2 (Body Lock) to the selected character profile.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsAssignModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#6e6e80] hover:text-[#0d0d0d] dark:text-[#a1a1aa] dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmAssignment}
                      disabled={isAssigning || (assignMode === 'existing' && !targetCharId)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs disabled:opacity-50"
                    >
                      {isAssigning ? 'Saving…' : 'Confirm & Save'}
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
