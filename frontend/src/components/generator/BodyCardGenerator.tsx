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
  Pencil,
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
    age_appearance: 'mid-20s',
    ethnicity_ancestry: ['Indian'],
    height_impression: 'tall-looking',
    overall_body_type: 'dramatic curvy hourglass',
    body_presence: 'feminine presence',
    posture: 'Neutral relaxed standing posture',
    shoulders: 'soft balanced shoulders',
    chest_bust: 'a very prominent natural bust',
    arms: 'soft naturally full arms',
    waist: 'clearly narrow defined waist',
    abdomen: 'natural gentle lower-belly softness',
    abdomen_exclusions: 'without visible abdominal definition or athletic muscularity',
    hips_pelvis: 'wide rounded hips',
    lower_body: 'rounded',
    thighs: 'full soft thighs',
    legs: 'long-looking feminine legs',
    physique_descriptors: 'soft, plush, curvy, feminine, and naturally proportioned',
    physique_exclusions: 'not muscular or bodybuilder-like',
    tone: 'bright natural milky-white',
    undertone: 'subtle peach-pink warmth',
    texture: 'realistic human skin texture',
    distinctive_features: 'none',
    style: 'skim or NO clothing',
  });

  // Collapsible Accordion sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true,
    silhouette: true,
    upper: false,
    midsection: false,
    lower: false,
    physique: false,
    skin: false,
    attire: false,
  });

  // Custom prompt override state (null = auto-sync with form, string = user manual edits)
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);

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
    const age = formData.age_appearance || 'mid-20s';
    const ethList = Array.isArray(formData.ethnicity_ancestry)
      ? formData.ethnicity_ancestry.join(', ')
      : formData.ethnicity_ancestry || 'Indian';

    const genderLower = gender.toLowerCase();
    const pronounPoss = genderLower.includes('woman') || genderLower.includes('feminine')
      ? 'her'
      : genderLower.includes('man') || genderLower.includes('masculine')
      ? 'his'
      : 'their';
    const pronounPossCap = pronounPoss.charAt(0).toUpperCase() + pronounPoss.slice(1);
    const samePersonTerm = genderLower.includes('woman') || genderLower.includes('feminine')
      ? 'same woman'
      : genderLower.includes('man') || genderLower.includes('masculine')
      ? 'same man'
      : 'same person';

    const heightImp = formData.height_impression || 'tall-looking';
    const bodyPres = formData.body_presence || 'feminine presence';
    const silhouette = formData.overall_body_type || 'dramatic curvy hourglass';

    const presParts = [];
    if (heightImp) presParts.push(heightImp);
    if (bodyPres && !bodyPres.includes(heightImp)) presParts.push(bodyPres);
    const presStr = presParts.join(' ');
    const silStr = silhouette.toLowerCase().includes('silhouette') ? silhouette : `${silhouette} silhouette`;
    const presenceSilhouette = `${presStr} and ${silStr}`.trim();

    const shoulders = formData.shoulders || 'soft balanced shoulders';
    const chestBust = formData.chest_bust || 'a very prominent natural bust';
    const waist = formData.waist || 'clearly narrow defined waist';
    const hips = formData.hips_pelvis || 'wide rounded hips';
    const thighs = formData.thighs || 'full soft thighs';
    const legs = formData.legs || 'long-looking feminine legs';
    const arms = formData.arms || 'soft naturally full arms';

    const abdomen = formData.abdomen || 'natural gentle lower-belly softness';
    const abdomenExcl = formData.abdomen_exclusions || 'without visible abdominal definition or athletic muscularity';

    const physique = formData.physique_descriptors || 'soft, plush, curvy, feminine, and naturally proportioned';
    const physiqueExcl = formData.physique_exclusions || 'not muscular or bodybuilder-like';

    const attire = formData.style || 'skim or NO clothing';
    const posture = formData.posture || 'Neutral relaxed standing posture';

    let skinTone = formData.tone || 'bright natural milky-white';
    if (!skinTone.toLowerCase().includes('skin')) skinTone = `${skinTone} skin`;
    const skinUnder = formData.undertone || 'subtle peach-pink warmth';
    const skinTex = formData.texture || 'realistic human skin texture';
    const distinctSkin = formData.distinctive_features || '';

    const skinDistinctLine = distinctSkin && distinctSkin.toLowerCase() !== 'none'
      ? ` Distinctive skin characteristics: ${distinctSkin}.`
      : '';

    return `Create a 4:3 high-resolution photorealistic **BODY IDENTITY REFERENCE CARD** for ${name}, the same fictional adult ${ethList} ${gender} in ${pronounPoss} ${age}.
Show the **${samePersonTerm}** in three consistent full-body views on one clean reference sheet:

1. front view
2. left side view
3. Right side view
4. back view

${name} has a **${presenceSilhouette}** with ${shoulders}, ${chestBust}, ${waist}, ${hips}, ${thighs}, ${legs}, and ${arms}.
${pronounPossCap} abdomen has **${abdomen}**, ${abdomenExcl}.
${pronounPossCap} overall physique is **${physique}**, ${physiqueExcl}.
Use ${attire} that clearly shows ${pronounPoss} natural proportions without being revealing. ${posture}, feet visible, arms naturally positioned.
Preserve ${pronounPoss} ${skinTone} with ${skinUnder} and ${skinTex}.${skinDistinctLine}
Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions.
No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization.
All three views must depict **exactly the same ${gender} with identical body proportions**.
No text except label of side and title
Purpose: **BODY LOCK — this image is the primary reference for ${name}'s body proportions, silhouette, and physical structure.**`.trim();
  }, [formData]);

  // Effective prompt is custom if edited, else compiled
  const effectivePrompt = customPrompt !== null ? customPrompt : compiledPrompt;

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
        setCustomPrompt(null); // re-sync with freshly randomized data
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
      setCustomPrompt(null);
    }
  };

  // Copy prompt
  const handleCopyPrompt = async () => {
    const ok = await copyToClipboard(effectivePrompt);
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
      const promptToUse = customPrompt !== null && customPrompt.trim() ? customPrompt.trim() : compiledPrompt;
      const res = await api.generateBodyCard(formData, undefined, promptToUse);
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
              physique_descriptors: formData.physique_descriptors,
              physique_exclusions: formData.physique_exclusions,
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
            physique_descriptors: formData.physique_descriptors,
            physique_exclusions: formData.physique_exclusions,
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
                  4:3 Full-Body Reference Turnaround Sheet
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
              <option value="kaya_soft_hourglass">Kaya (Dramatic Curvy Hourglass · Indian Grace)</option>
              <option value="freya_athletic_fit">Freya (Athletic Runner · Nordic Power)</option>
              <option value="meiling_petite_curve">Meiling (Petite Grace · East Asian Delicate)</option>
              <option value="amina_statuesque_elegance">Amina (Tall Statuesque · West African Poise)</option>
              <option value="camila_curvy_radiance">Camila (Curvy Radiance · Latin Glow)</option>
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
                      value={formData.age_appearance || 'mid-20s'}
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
                      'Indian',
                      'South Asian',
                      'North Indian',
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
                      value={formData.height_impression || 'tall-looking'}
                      onChange={(e) => handleFieldChange('height_impression', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="tall-looking">tall-looking</option>
                      <option value="petite">petite</option>
                      <option value="short">short</option>
                      <option value="average">average</option>
                      <option value="tall">tall</option>
                      <option value="very tall">very tall</option>
                      <option value="statuesque">statuesque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Overall Body Silhouette
                    </label>
                    <select
                      value={formData.overall_body_type || 'dramatic curvy hourglass'}
                      onChange={(e) => handleFieldChange('overall_body_type', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="dramatic curvy hourglass">dramatic curvy hourglass</option>
                      <option value="hourglass">hourglass</option>
                      <option value="soft curvy">soft curvy</option>
                      <option value="pear">pear</option>
                      <option value="athletic">athletic</option>
                      <option value="lean">lean</option>
                      <option value="slim">slim</option>
                      <option value="plus-size">plus-size</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Presence Impression
                    </label>
                    <select
                      value={formData.body_presence || 'feminine presence'}
                      onChange={(e) => handleFieldChange('body_presence', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="feminine presence">feminine presence</option>
                      <option value="soft feminine">soft feminine</option>
                      <option value="curvy feminine">curvy feminine</option>
                      <option value="natural presence">natural presence</option>
                      <option value="athletic presence">athletic presence</option>
                      <option value="statuesque presence">statuesque presence</option>
                      <option value="strong presence">strong presence</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Standing Posture
                    </label>
                    <select
                      value={formData.posture || 'Neutral relaxed standing posture'}
                      onChange={(e) => handleFieldChange('posture', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Neutral relaxed standing posture">Neutral relaxed standing posture</option>
                      <option value="relaxed natural">relaxed natural</option>
                      <option value="upright confident">upright confident</option>
                      <option value="poised elegant">poised elegant</option>
                      <option value="casual everyday">casual everyday</option>
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
                      value={formData.shoulders || 'soft balanced shoulders'}
                      onChange={(e) => handleFieldChange('shoulders', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="soft balanced shoulders">soft balanced shoulders</option>
                      <option value="narrow soft shoulders">narrow soft shoulders</option>
                      <option value="average natural shoulders">average natural shoulders</option>
                      <option value="broad shoulders">broad shoulders</option>
                      <option value="strong athletic shoulders">strong athletic shoulders</option>
                      <option value="delicate sloping shoulders">delicate sloping shoulders</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Chest / Bust
                    </label>
                    <select
                      value={formData.chest_bust || 'a very prominent natural bust'}
                      onChange={(e) => handleFieldChange('chest_bust', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="a very prominent natural bust">a very prominent natural bust</option>
                      <option value="a full natural bust">a full natural bust</option>
                      <option value="a moderate natural bust">a moderate natural bust</option>
                      <option value="a small delicate bust">a small delicate bust</option>
                      <option value="prominent rounded bust">prominent rounded bust</option>
                      <option value="toned athletic pectorals">toned athletic pectorals</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Arms
                  </label>
                  <select
                    value={formData.arms || 'soft naturally full arms'}
                    onChange={(e) => handleFieldChange('arms', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="soft naturally full arms">soft naturally full arms</option>
                    <option value="slender feminine arms">slender feminine arms</option>
                    <option value="soft natural arms">soft natural arms</option>
                    <option value="average toned arms">average toned arms</option>
                    <option value="lean defined athletic arms">lean defined athletic arms</option>
                    <option value="muscular arms">muscular arms</option>
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
                      value={formData.waist || 'clearly narrow defined waist'}
                      onChange={(e) => handleFieldChange('waist', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="clearly narrow defined waist">clearly narrow defined waist</option>
                      <option value="narrow defined waist">narrow defined waist</option>
                      <option value="softly defined waist">softly defined waist</option>
                      <option value="straight waist">straight waist</option>
                      <option value="very narrow cinched waist">very narrow cinched waist</option>
                      <option value="tapered athletic waist">tapered athletic waist</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Abdomen Softness
                    </label>
                    <select
                      value={formData.abdomen || 'natural gentle lower-belly softness'}
                      onChange={(e) => handleFieldChange('abdomen', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="natural gentle lower-belly softness">natural gentle lower-belly softness</option>
                      <option value="flat natural stomach">flat natural stomach</option>
                      <option value="gentle lower-belly fullness">gentle lower-belly fullness</option>
                      <option value="soft rounded abdomen">soft rounded abdomen</option>
                      <option value="moderately full natural abdomen">moderately full natural abdomen</option>
                      <option value="defined athletic core">defined athletic core</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Abdomen Muscularity Rule
                  </label>
                  <select
                    value={formData.abdomen_exclusions || 'without visible abdominal definition or athletic muscularity'}
                    onChange={(e) => handleFieldChange('abdomen_exclusions', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="without visible abdominal definition or athletic muscularity">
                      without visible abdominal definition or athletic muscularity
                    </option>
                    <option value="without muscular definition">without muscular definition</option>
                    <option value="with subtle vertical core line (linea alba)">with subtle vertical core line (linea alba)</option>
                    <option value="with defined six-pack abdominals">with defined six-pack abdominals</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 5. Hips, Thighs & Legs */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('lower')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">5. Hips, Thighs &amp; Legs</span>
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
                      value={formData.hips_pelvis || 'wide rounded hips'}
                      onChange={(e) => handleFieldChange('hips_pelvis', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="wide rounded hips">wide rounded hips</option>
                      <option value="rounded feminine hips">rounded feminine hips</option>
                      <option value="moderate natural hips">moderate natural hips</option>
                      <option value="narrow compact hips">narrow compact hips</option>
                      <option value="very wide voluptuous hips">very wide voluptuous hips</option>
                      <option value="high-shelf feminine curve">high-shelf feminine curve</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Thighs
                    </label>
                    <select
                      value={formData.thighs || 'full soft thighs'}
                      onChange={(e) => handleFieldChange('thighs', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="full soft thighs">full soft thighs</option>
                      <option value="soft natural thighs">soft natural thighs</option>
                      <option value="slender thighs">slender thighs</option>
                      <option value="moderate balanced thighs">moderate balanced thighs</option>
                      <option value="strong muscular thighs">strong muscular thighs</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Legs &amp; Proportions
                    </label>
                    <select
                      value={formData.legs || 'long-looking feminine legs'}
                      onChange={(e) => handleFieldChange('legs', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="long-looking feminine legs">long-looking feminine legs</option>
                      <option value="balanced natural legs">balanced natural legs</option>
                      <option value="long slender legs">long slender legs</option>
                      <option value="very long statuesque legs">very long statuesque legs</option>
                      <option value="compact grounded legs">compact grounded legs</option>
                      <option value="athletic shapely legs">athletic shapely legs</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Glute Profile
                    </label>
                    <select
                      value={formData.lower_body || 'rounded'}
                      onChange={(e) => handleFieldChange('lower_body', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="rounded">rounded</option>
                      <option value="subtle">subtle</option>
                      <option value="full prominent">full prominent</option>
                      <option value="athletic lifted">athletic lifted</option>
                      <option value="generous natural fullness">generous natural fullness</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Overall Physique & Build */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('physique')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">6. Overall Physique &amp; Build</span>
              </div>
              {openSections.physique ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSections.physique && (
              <div className="p-3.5 pt-0 border-t border-[#f0f0f0] dark:border-[#222225] space-y-3 mt-2">
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Physique Character
                  </label>
                  <select
                    value={formData.physique_descriptors || 'soft, plush, curvy, feminine, and naturally proportioned'}
                    onChange={(e) => handleFieldChange('physique_descriptors', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="soft, plush, curvy, feminine, and naturally proportioned">
                      soft, plush, curvy, feminine, and naturally proportioned
                    </option>
                    <option value="toned, athletic, lean, and balanced">toned, athletic, lean, and balanced</option>
                    <option value="slender, delicate, fine-boned, and graceful">slender, delicate, fine-boned, and graceful</option>
                    <option value="voluptuous, full-figured, and generous">voluptuous, full-figured, and generous</option>
                    <option value="muscular, athletic, and powerful">muscular, athletic, and powerful</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                    Physique Negative Exclusions
                  </label>
                  <select
                    value={formData.physique_exclusions || 'not muscular or bodybuilder-like'}
                    onChange={(e) => handleFieldChange('physique_exclusions', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="not muscular or bodybuilder-like">not muscular or bodybuilder-like</option>
                    <option value="without excessive leanness or visible veins">without excessive leanness or visible veins</option>
                    <option value="without artificial bodybuilder hypertrophy">without artificial bodybuilder hypertrophy</option>
                    <option value="without exaggerated proportions">without exaggerated proportions</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 7. Skin & Complexion */}
          <div className="border border-[#e5e5e5] dark:border-[#27272a] rounded-xl bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
            <button
              onClick={() => toggleSection('skin')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-emerald-500" />
                <span className="text-xs font-semibold">7. Skin &amp; Complexion</span>
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
                      value={formData.tone || 'bright natural milky-white'}
                      onChange={(e) => handleFieldChange('tone', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="bright natural milky-white">bright natural milky-white</option>
                      <option value="fair">fair</option>
                      <option value="porcelain">porcelain</option>
                      <option value="light ivory">light ivory</option>
                      <option value="light-medium">light-medium</option>
                      <option value="medium warm honey">medium warm honey</option>
                      <option value="golden olive">golden olive</option>
                      <option value="tan">tan</option>
                      <option value="deep espresso">deep espresso</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Undertone
                    </label>
                    <select
                      value={formData.undertone || 'subtle peach-pink warmth'}
                      onChange={(e) => handleFieldChange('undertone', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="subtle peach-pink warmth">subtle peach-pink warmth</option>
                      <option value="warm golden">warm golden</option>
                      <option value="cool pink">cool pink</option>
                      <option value="neutral">neutral</option>
                      <option value="peach">peach</option>
                      <option value="olive">olive</option>
                      <option value="golden bronze">golden bronze</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Texture
                    </label>
                    <select
                      value={formData.texture || 'realistic human skin texture'}
                      onChange={(e) => handleFieldChange('texture', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="realistic human skin texture">realistic human skin texture</option>
                      <option value="realistic visible pores and soft skin grain">realistic visible pores</option>
                      <option value="smooth natural skin">smooth natural skin</option>
                      <option value="subtly luminous natural hydration">subtly luminous hydration</option>
                      <option value="slightly textured">slightly textured</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6e6e80] dark:text-[#a1a1aa] block mb-1">
                      Distinctive Characteristics
                    </label>
                    <select
                      value={formData.distinctive_features || 'none'}
                      onChange={(e) => handleFieldChange('distinctive_features', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="none">none</option>
                      <option value="beauty marks">beauty marks</option>
                      <option value="freckles across shoulders">freckles across shoulders</option>
                      <option value="small moles">small moles</option>
                      <option value="birthmark">birthmark</option>
                    </select>
                  </div>
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
                    Attire Style
                  </label>
                  <select
                    value={formData.style || 'skim or NO clothing'}
                    onChange={(e) => handleFieldChange('style', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121214] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="skim or NO clothing">skim or NO clothing</option>
                    <option value="minimal neutral fitted reference clothing">minimal neutral fitted reference clothing</option>
                    <option value="simple fitted tank and shorts">simple fitted tank and shorts</option>
                    <option value="simple fitted top and leggings">simple fitted top and leggings</option>
                    <option value="neutral fitted bodysuit">neutral fitted bodysuit</option>
                    <option value="matte neutral athletic sports top and bike shorts">matte sports top &amp; bike shorts</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>
                    clearly shows her natural proportions without being revealing. Neutral relaxed standing posture, feet visible, arms naturally positioned.
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
              Generates consistent full-body views (Front, Left side, Right side, Back) on clean reference sheet with exact anatomical lock.
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
                  4:3 photorealistic 4-view full-body sheet with Front, Left, Right, and Back side views.
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
                        prompt: effectivePrompt,
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
                      prompt: effectivePrompt,
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

        {/* Live Prompt Preview / Editor Box */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[#e5e5e5] dark:border-[#27272a] bg-white dark:bg-[#18181b] overflow-hidden shadow-2xs">
          <div className="p-3 px-4 border-b border-[#e5e5e5] dark:border-[#27272a] flex items-center justify-between bg-[#fafafa] dark:bg-[#151518]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                Body Reference Prompt
              </span>
              {customPrompt !== null ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                  <Pencil size={10} />
                  <span>Custom Edited</span>
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>Auto-Synced</span>
                </span>
              )}
              <span className="text-[10px] font-mono text-[#6e6e80] dark:text-[#a1a1aa]">
                ({effectivePrompt.length} chars)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {customPrompt !== null && (
                <button
                  onClick={() => setCustomPrompt(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  title="Revert back to automatically generated prompt from form controls"
                >
                  <RotateCcw size={12} />
                  <span>Revert to Form</span>
                </button>
              )}

              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-[#6e6e80] dark:text-[#a1a1aa] hover:text-[#0d0d0d] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {copiedPrompt ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 flex-1 flex flex-col">
            <textarea
              value={effectivePrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={14}
              placeholder="Live prompt preview or type custom edits directly..."
              className="w-full flex-1 text-xs font-mono whitespace-pre-wrap text-[#4b4b59] dark:text-[#d4d4d8] leading-relaxed bg-[#f9f9fa] dark:bg-[#111113] p-3.5 rounded-xl border border-[#eeeeee] dark:border-[#222226] resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[320px]"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
              <span>💡 You can edit text directly in the box above or tweak options in the form on the left.</span>
              {customPrompt !== null && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Manual edits active (engine will use this exact text)</span>
              )}
            </div>
          </div>

          <div className="p-3 border-t border-[#e5e5e5] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#151518] flex items-center justify-between text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
            <div className="flex items-center gap-1">
              <Info size={13} />
              <span>4:3 Landscape · 4 Views (Front, Left, Right, Back) · Body Lock Reference</span>
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
