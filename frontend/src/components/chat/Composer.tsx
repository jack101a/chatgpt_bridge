import React, { useState, useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  ArrowUp,
  Sparkles,
  X,
  Image as ImageIcon,
  Clapperboard,
  Loader2,
  Lock,
  User,
  ChevronDown,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  ImageRequest,
  GalleryItem,
  StoryboardShot,
  CharacterCard,
  ConversationContract,
} from '../../types';
import { PromptLibraryTray } from '../director/PromptLibraryTray';
import { StoryboardTray } from '../director/StoryboardTray';
import { api } from '../../lib/api';

interface ComposerProps {
  onSend: (req: ImageRequest) => void;
  isGenerating: boolean;
  activeConvId: string | null;
  onClearThread: () => void;
  referenceImage?: GalleryItem | null;
  onClearReference?: () => void;
  characters?: CharacterCard[];
  activeCharacter?: CharacterCard | null;
  onSelectCharacter?: (character: CharacterCard | null) => void;
  onThreadCreated?: (newConvId: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  isGenerating,
  activeConvId,
  onClearThread,
  referenceImage,
  onClearReference,
  characters = [],
  activeCharacter = null,
  onSelectCharacter,
  onThreadCreated,
}) => {
  const [promptText, setPromptText] = useState('');
  const [aspect, setAspect] = useState<string>('Original');
  const [showLayers, setShowLayers] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [layer1, setLayer1] = useState('');
  const [layer2, setLayer2] = useState('');
  const [isPlanningStoryboard, setIsPlanningStoryboard] = useState(false);
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[]>([]);
  const [isStoryboardOpen, setIsStoryboardOpen] = useState(false);
  const [isExecutingStoryboard, setIsExecutingStoryboard] = useState(false);
  const [storyboardProgress, setStoryboardProgress] = useState<string | null>(null);

  // Character Lock & Consistency State
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);
  const [contract, setContract] = useState<ConversationContract | null>(null);
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [handshakeStatus, setHandshakeStatus] = useState<string | null>(null);

  // Clean Delta Mode State
  const [isDeltaMode, setIsDeltaMode] = useState(false);
  const [deltaScene, setDeltaScene] = useState('');
  const [deltaOutfit, setDeltaOutfit] = useState('');
  const [deltaPose, setDeltaPose] = useState('');
  const [deltaCamera, setDeltaCamera] = useState('');
  const [deltaLighting, setDeltaLighting] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-fetch contract status when thread changes
  useEffect(() => {
    let isMounted = true;
    if (activeConvId) {
      api.getConversationContract(activeConvId)
        .then((c) => {
          if (isMounted) setContract(c);
        })
        .catch(() => {
          if (isMounted) setContract(null);
        });
    } else {
      setContract(null);
    }
    return () => {
      isMounted = false;
    };
  }, [activeConvId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsCharacterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus textarea when referenceImage is attached or a thread is selected
  useEffect(() => {
    if ((referenceImage || activeConvId) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [referenceImage, activeConvId]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [promptText]);

  const handleInsertModifier = (text: string) => {
    if (isDeltaMode) {
      setDeltaCamera((prev) => (prev ? `${prev}, ${text}` : text));
      return;
    }
    setPromptText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      return `${trimmed}, ${text}`;
    });
  };

  const handlePrimeHandshake = async () => {
    if (!activeCharacter || isHandshaking) return;
    setIsHandshaking(true);
    setHandshakeStatus(`Establishing 3-card identity contract for ${activeCharacter.name}...`);
    try {
      const res = await api.handshakeCharacter(activeCharacter.id, activeConvId || 'new');
      if (res?.conversation_id) {
        if (!activeConvId && onThreadCreated) {
          onThreadCreated(res.conversation_id);
        }
        setContract({
          ok: true,
          conversation_id: res.conversation_id,
          character_id: activeCharacter.id,
          character_name: activeCharacter.name,
          primed: true,
          card_count: res.card_count,
        });
      }
      setHandshakeStatus(`Contract primed! Locked to ${activeCharacter.name}`);
      setTimeout(() => setHandshakeStatus(null), 3000);
    } catch (err: any) {
      alert(`Handshake failed: ${err.message}`);
      setHandshakeStatus(null);
    } finally {
      setIsHandshaking(false);
    }
  };

  const handlePlanStoryboard = async () => {
    const intent = isDeltaMode ? deltaScene.trim() : promptText.trim();
    if (!intent || isPlanningStoryboard) return;
    setIsPlanningStoryboard(true);
    try {
      const plan = await api.planStoryboard({
        intent,
        shot_count: 3,
        character_id: activeCharacter?.id,
      });
      if (plan?.shots && plan.shots.length > 0) {
        setStoryboardShots(plan.shots);
        setIsStoryboardOpen(true);
      }
    } catch (err: any) {
      alert(`Director planning error: ${err.message}`);
    } finally {
      setIsPlanningStoryboard(false);
    }
  };

  const handleExecuteStoryboard = async (shots: StoryboardShot[]) => {
    setIsExecutingStoryboard(true);
    setStoryboardProgress('Dispatching shots to ChatGPT...');
    try {
      await api.executeStoryboard(shots);
      setStoryboardProgress('Sequence running turn-by-turn in background!');
      setTimeout(() => {
        setIsExecutingStoryboard(false);
        setIsStoryboardOpen(false);
      }, 2500);
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
      setIsExecutingStoryboard(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;

    if (isDeltaMode && activeCharacter) {
      if (!deltaScene.trim()) return;

      const style = activeCharacter.style_anchor || 'Photorealistic cinematic photography';
      const lines = [`${style} of ${activeCharacter.name}. Maintain locked face and body identity from Turn 0.`];
      if (deltaScene.trim()) lines.push(`[SCENE]: ${deltaScene.trim()}`);
      if (deltaOutfit.trim()) lines.push(`[OUTFIT]: ${deltaOutfit.trim()}`);
      if (deltaPose.trim()) lines.push(`[POSE]: ${deltaPose.trim()}`);
      if (deltaCamera.trim()) lines.push(`[CAMERA]: ${deltaCamera.trim()}`);
      if (deltaLighting.trim()) lines.push(`[LIGHTING]: ${deltaLighting.trim()}`);

      onSend({
        prompt: lines.join('\n'),
        aspect: aspect === 'Original' ? null : aspect,
        tweaked_prompt: layer1.trim() || null,
        tweaked_prompt_2: layer2.trim() || null,
        conversation_id: activeConvId || null,
        reference_image: referenceImage ? referenceImage.id : null,
      });

      setDeltaScene('');
      return;
    }

    if (!promptText.trim()) return;

    onSend({
      prompt: promptText.trim(),
      aspect: aspect === 'Original' ? null : aspect,
      tweaked_prompt: layer1.trim() || null,
      tweaked_prompt_2: layer2.trim() || null,
      conversation_id: activeConvId || null,
      reference_image: referenceImage ? referenceImage.id : null,
    });

    setPromptText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="flex flex-col bg-[#ffffff] dark:bg-[#1c1c1f] rounded-2xl border border-[#e5e5e5] dark:border-[#2e2e32] shadow-lg shadow-black/5 transition-all focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/15 overflow-hidden">
        {/* ── Visual Prompt Library Tray (Collapsible) ── */}
        <PromptLibraryTray
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
          onInsertModifier={handleInsertModifier}
        />

        {/* ── Refinement Layers (Collapsible) ── */}
        {showLayers && (
          <div className="px-3.5 pt-3 pb-2 border-b border-[#f0f0f0] dark:border-[#2a2a2e] space-y-2 bg-[#fbfbfb] dark:bg-[#171719] animate-fade">
            <div className="flex items-center justify-between text-xs text-[#6e6e80] dark:text-[#9e9ea7] font-medium">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-500" />
                Prompt Refinement Layers
              </span>
              <button
                onClick={() => setShowLayers(false)}
                className="hover:text-black dark:hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <input
              type="text"
              value={layer1}
              onChange={(e) => setLayer1(e.target.value)}
              placeholder="Layer 1 — Style nudge / lighting / tone (tweaked_prompt)"
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#232327] border border-[#e5e5e5] dark:border-[#333338] text-xs font-mono placeholder:text-gray-400 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={layer2}
              onChange={(e) => setLayer2(e.target.value)}
              placeholder="Layer 2 — Deep refinement (tweaked_prompt_2)"
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#232327] border border-[#e5e5e5] dark:border-[#333338] text-xs font-mono placeholder:text-gray-400 outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* ── Attached Reference Image Pill ── */}
        {referenceImage && (
          <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/20 animate-fade">
            <img
              src={referenceImage.url}
              alt="Reference"
              className="w-8 h-8 rounded-lg object-cover border border-emerald-500/40 shadow-sm flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                  Image Reference
                </span>
                <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[120px] sm:max-w-[180px]">
                  {referenceImage.id}
                </span>
              </div>
              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                {referenceImage.prompt || 'Attached reference for image-to-image'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearReference}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all flex-shrink-0"
              title="Remove reference image"
              aria-label="Remove reference image"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── Active Character Lock & Turn 0 Handshake Banner ── */}
        {activeCharacter && (
          <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/20 text-xs text-zinc-800 dark:text-zinc-200 animate-fade">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                <Lock size={12} />
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  This chat is locked to {activeCharacter.name}
                </span>
                <span className="text-zinc-400 dark:text-zinc-500 mx-1.5 hidden sm:inline">·</span>
                {contract?.primed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    <CheckCircle2 size={12} />
                    Contract Primed (3 Cards Active)
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                    Turn 0 Unprimed
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!contract?.primed && (
                <button
                  type="button"
                  onClick={handlePrimeHandshake}
                  disabled={isHandshaking}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  title="Initialize Turn 0 3-Card Ground Truth Handshake"
                >
                  {isHandshaking ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Priming…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>Initialize Handshake</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDeltaMode(!isDeltaMode)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  isDeltaMode
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                }`}
                title="Toggle Clean Delta Prompt Mode"
              >
                <Layers size={12} />
                <span>Delta Mode</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Handshake Status Notification ── */}
        {handshakeStatus && (
          <div className="px-3.5 py-1.5 bg-emerald-600 text-white text-[11px] font-medium flex items-center justify-between animate-fade">
            <span>{handshakeStatus}</span>
          </div>
        )}

        {/* ── Clean Delta Structured Inputs ── */}
        {isDeltaMode && activeCharacter && (
          <div className="px-3.5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <Layers size={13} />
                Clean Delta Shot for {activeCharacter.name} (Zero Prompt Bloat)
              </span>
              <button
                type="button"
                onClick={() => setIsDeltaMode(false)}
                className="hover:text-black dark:hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={deltaScene}
                onChange={(e) => setDeltaScene(e.target.value)}
                placeholder="[SCENE]: Location & mood (e.g. Stepping out of cafe in rain on Paris street)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaOutfit}
                onChange={(e) => setDeltaOutfit(e.target.value)}
                placeholder="[OUTFIT]: Specific clothing (e.g. Oversized beige trench coat, black boots)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
            </div>

            {activeCharacter.wardrobes && activeCharacter.wardrobes.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
                <span className="text-zinc-400 flex-shrink-0 text-[10px]">Wardrobes:</span>
                {activeCharacter.wardrobes.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setDeltaOutfit(w.description)}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 text-zinc-600 dark:text-zinc-300 whitespace-nowrap text-[10px]"
                  >
                    ✦ {w.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={deltaPose}
                onChange={(e) => setDeltaPose(e.target.value)}
                placeholder="[POSE]: Stance & action (e.g. Holding umbrella, glancing over shoulder)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaCamera}
                onChange={(e) => setDeltaCamera(e.target.value)}
                placeholder="[CAMERA]: Lens & angle (e.g. 85mm portrait, f/1.8)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaLighting}
                onChange={(e) => setDeltaLighting(e.target.value)}
                placeholder="[LIGHTING]: Lighting mood (e.g. Warm tungsten & cool evening rain)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* ── Top Controls: Character Selector + Aspect Ratios + Continuity Badge ── */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Character Selector Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsCharacterMenuOpen(!isCharacterMenuOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  activeCharacter
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs'
                    : 'bg-[#f4f4f5] dark:bg-[#2b2b2f] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
                title="Select or lock character for this chat"
              >
                {activeCharacter ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Lock size={11} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold max-w-[100px] truncate">{activeCharacter.name}</span>
                  </>
                ) : (
                  <>
                    <User size={11} />
                    <span>Character Lock</span>
                  </>
                )}
                <ChevronDown size={11} className="opacity-60 ml-0.5" />
              </button>

              {isCharacterMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Lock Chat to Character
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCharacter?.(null);
                      setIsCharacterMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${
                      !activeCharacter ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>✦ No Character (Freeform)</span>
                    {!activeCharacter && <CheckCircle2 size={13} className="text-emerald-500" />}
                  </button>

                  {characters?.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCharacter?.(c);
                        setIsCharacterMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${
                        activeCharacter?.id === c.id
                          ? 'font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium truncate">{c.name}</div>
                        {c.tagline && <div className="text-[10px] text-zinc-400 truncate">{c.tagline}</div>}
                      </div>
                      {activeCharacter?.id === c.id && (
                        <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(['Original', '1:1', '9:16', '16:9', '4:5', '3:4'] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspect(ratio)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                  aspect === ratio
                    ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-[#f4f4f5] dark:bg-[#2b2b2f] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                {ratio === 'Original' ? '✦ Original' : ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {activeConvId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono border border-emerald-200/60 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[120px] sm:max-w-[180px]">
                  ↳ Thread: {activeConvId.slice(0, 10)}…
                </span>
                <button
                  onClick={onClearThread}
                  className="hover:text-red-500 ml-0.5"
                  title="Disconnect thread"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Prompt Library Button */}
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className={`p-1.5 rounded-lg text-[#6e6e80] hover:text-black dark:text-[#a1a1aa] dark:hover:text-white transition-all ${
                showLibrary ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : ''
              }`}
              title="Visual Prompt Library (Camera, Lighting, Film)"
            >
              <Sparkles size={15} />
            </button>

            {/* AI Director Storyboard Planner Button */}
            <button
              type="button"
              onClick={handlePlanStoryboard}
              disabled={isPlanningStoryboard || (!promptText.trim() && !deltaScene.trim())}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold ${
                promptText.trim() || deltaScene.trim()
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer'
                  : 'text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed'
              }`}
              title="AI Director: Generate Storyboard Sequence"
            >
              {isPlanningStoryboard ? (
                <Loader2 size={15} className="animate-spin text-emerald-500" />
              ) : (
                <Clapperboard size={15} />
              )}
              <span className="hidden md:inline">Director</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLayers(!showLayers)}
              className={`p-1.5 rounded-lg text-[#6e6e80] hover:text-black dark:text-[#a1a1aa] dark:hover:text-white transition-all ${
                showLayers ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : ''
              }`}
              title="Toggle Prompt Layers"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* ── Main Input Row ── */}
        {!isDeltaMode ? (
          <div className="flex items-end gap-2 px-3 pb-2.5 pt-1">
            <div className="p-1.5 text-gray-400 mb-0.5 hidden sm:block">
              <ImageIcon size={18} />
            </div>

            <textarea
              ref={textareaRef}
              rows={1}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                referenceImage
                  ? 'Describe changes or additions using this reference…'
                  : activeCharacter
                  ? `Prompt for ${activeCharacter.name} (or switch to Delta Mode)…`
                  : 'Describe what you want to create…'
              }
              className="flex-1 max-h-[180px] bg-transparent border-0 outline-none resize-none text-[14px] leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[#0d0d0d] dark:text-white font-sans py-1"
            />

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isGenerating || !promptText.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                promptText.trim() && !isGenerating
                  ? 'bg-[#10a37f] hover:bg-[#0d926e] text-white active:scale-95 shadow-md shadow-emerald-500/20'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send prompt"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3.5 py-2 bg-white dark:bg-[#1c1c1f]">
            <span className="text-[11px] text-zinc-500">
              Clean Delta prompts preserve ground truth with zero token pollution.
            </span>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isGenerating || !deltaScene.trim()}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                deltaScene.trim() && !isGenerating
                  ? 'bg-[#10a37f] hover:bg-[#0d926e] text-white active:scale-95 shadow-md shadow-emerald-500/20'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span>Generate Delta</span>
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-[10.5px] text-[#a1a1aa] dark:text-[#71717a] mt-1.5 tracking-tight">
        Powered by your self-hosted infrastructure. More control. More creativity.
      </p>

      {/* ── AI Storyboard Tray Modal/Drawer ── */}
      <StoryboardTray
        shots={storyboardShots}
        onUpdateShots={setStoryboardShots}
        isOpen={isStoryboardOpen}
        onClose={() => setIsStoryboardOpen(false)}
        onExecute={handleExecuteStoryboard}
        isExecuting={isExecutingStoryboard}
        progressStatus={storyboardProgress}
      />
    </div>
  );
};
