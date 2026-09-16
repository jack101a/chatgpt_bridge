import React, { useState, useEffect } from 'react';
import {
  Clapperboard,
  X,
  Play,
  Plus,
  Trash2,
  Camera,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Film,
  StopCircle,
  User,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { StoryboardShot, CharacterCard, DirectorState } from '../../types';
import { api } from '../../lib/api';

interface DirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  characters?: CharacterCard[];
  activeCharacter?: CharacterCard | null;
  activeConvId?: string | null;
  onSelectCharacter?: (char: CharacterCard | null) => void;
}

const SHOT_COUNT_PRESETS = [3, 5, 8, 10];

const GUIDANCE_CHIPS = [
  'Wide establishing to intimate portrait progression',
  'Candid authentic photography, realistic angles',
  'Warm golden hour lighting with rich backlight',
  'Cinematic 35mm film aesthetic with natural grain',
  'Over-the-shoulder POV & conversational angles',
  'High-contrast moody lighting with deep shadows',
];

export const DirectorModal: React.FC<DirectorModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  characters = [],
  activeCharacter = null,
  activeConvId = null,
  onSelectCharacter,
}) => {
  // Setup inputs
  const [intent, setIntent] = useState('');
  const [shotCount, setShotCount] = useState<number>(5);
  const [creativeGuidance, setCreativeGuidance] = useState('');
  const [selectedChar, setSelectedChar] = useState<CharacterCard | null>(activeCharacter);

  // Character selection dropdown inside modal
  const [isCharDropdownOpen, setIsCharDropdownOpen] = useState(false);

  // Planning state
  const [isPlanning, setIsPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [shots, setShots] = useState<StoryboardShot[]>([]);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorState | null>(null);
  const [executingError, setExecutingError] = useState<string | null>(null);

  // Sync initial prompt and character on modal open
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt && !intent) {
        setIntent(initialPrompt);
      }
      setSelectedChar(activeCharacter);
    }
  }, [isOpen, initialPrompt, activeCharacter]);

  // Poll director execution status when active
  useEffect(() => {
    let timer: any = null;
    if (isExecuting) {
      const checkStatus = async () => {
        try {
          const st = await api.getDirectorStatus();
          setDirectorStatus(st);
          if (!st.is_running) {
            setIsExecuting(false);
          }
        } catch {
          // ignore transient poll error
        }
      };
      checkStatus();
      timer = setInterval(checkStatus, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isExecuting]);

  if (!isOpen) return null;

  const handlePlan = async () => {
    if (!intent.trim()) return;
    setIsPlanning(true);
    setPlanError(null);
    try {
      const plan = await api.planStoryboard({
        intent: intent.trim(),
        character_id: selectedChar?.id,
        shot_count: shotCount,
        creative_guidance: creativeGuidance.trim() || undefined,
      });
      if (plan?.shots && plan.shots.length > 0) {
        setShots(plan.shots);
      } else {
        setPlanError('No shots returned from Director AI. Please try again.');
      }
    } catch (err: any) {
      setPlanError(err.message || 'Failed to generate storyboard plan');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecuteSequence = async () => {
    if (shots.length === 0 || isExecuting) return;
    setIsExecuting(true);
    setExecutingError(null);
    try {
      await api.executeStoryboard({
        shots,
        character_id: selectedChar?.id,
        conversation_id: activeConvId || undefined,
      });
    } catch (err: any) {
      setExecutingError(err.message || 'Failed to dispatch automated sequence');
      setIsExecuting(false);
    }
  };

  const handleCancelSequence = async () => {
    try {
      await api.cancelDirectorSequence();
    } catch {
      // ignore
    }
  };

  const handleUpdateShotPrompt = (index: number, newPrompt: string) => {
    const updated = [...shots];
    updated[index] = { ...updated[index], prompt: newPrompt };
    setShots(updated);
  };

  const handleUpdateShotPov = (index: number, newPov: string) => {
    const updated = [...shots];
    updated[index] = { ...updated[index], camera_pov: newPov };
    setShots(updated);
  };

  const handleDeleteShot = (index: number) => {
    setShots(shots.filter((_, i) => i !== index));
  };

  const handleAddShot = () => {
    const charName = selectedChar?.name || 'the subject';
    const newShot: StoryboardShot = {
      description: `${charName} in the scene, dynamic narrative moment`,
      camera_pov: 'Cinematic medium shot with natural depth',
      prompt: selectedChar
        ? `Cinematic photography of ${charName}. Maintain locked face and body identity from Turn 0.\n[SCENE]: ${intent}\n[CAMERA & FRAMING]: Cinematic medium shot with natural depth\n[ACTION & LIGHTING]: Authentic candid posture with soft atmospheric light`
        : `Cinematic photography of the scene.\n[SCENE]: ${intent}\n[CAMERA & FRAMING]: Cinematic medium shot`,
    };
    setShots([...shots, newShot]);
  };

  const appendGuidanceChip = (chipText: string) => {
    setCreativeGuidance((prev) => (prev ? `${prev}; ${chipText}` : chipText));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#141416] border border-gray-200 dark:border-[#27272a] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0d0d0d] dark:text-white">
                  AI Storyboard Director
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-500/30">
                  Full Automation
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Direct automated multi-image visual stories with character consistency & scene continuity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Character Lock Selector for Director */}
          <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Character Identity Binding
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {selectedChar
                  ? `Automated sequence will preserve ${selectedChar.name}'s locked face and body identity.`
                  : 'No character locked. Storyboard will focus on general scenes & environments.'}
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCharDropdownOpen(!isCharDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedChar
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {selectedChar?.avatar_image_id ? (
                  <img
                    src={`/images/${selectedChar.avatar_image_id}`}
                    alt={selectedChar.name}
                    className="w-5 h-5 rounded-full object-cover border border-emerald-500/40"
                  />
                ) : (
                  <User className="w-4 h-4 text-emerald-600" />
                )}
                <span>{selectedChar ? selectedChar.name : '✦ No Character'}</span>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </button>

              {isCharDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChar(null);
                      onSelectCharacter?.(null);
                      setIsCharDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                      !selectedChar ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>✦ No Character (General Story)</span>
                    {!selectedChar && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedChar(c);
                        onSelectCharacter?.(c);
                        setIsCharDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                        selectedChar?.id === c.id
                          ? 'font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {c.avatar_image_id ? (
                          <img
                            src={`/images/${c.avatar_image_id}`}
                            alt={c.name}
                            className="w-5 h-5 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-700 text-[9px] font-bold flex items-center justify-center">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{c.name}</span>
                      </div>
                      {selectedChar?.id === c.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Step 1: Director Story & Plot Setup ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0d0d0d] dark:text-white mb-1.5 flex items-center justify-between">
                <span>Story Narrative, Scene Arc or Plot *</span>
                <span className="text-[10px] text-gray-400 font-normal">What happens in the sequence</span>
              </label>
              <textarea
                rows={3}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder={
                  selectedChar
                    ? `Describe what ${selectedChar.name} is doing through this story sequence (e.g. 'A day in Himachal Pradesh: arriving at a cozy pine forest cottage in the morning mist, drinking hot chai on the wooden balcony, hiking along a stone mountain path, and admiring the sunset over snow-capped peaks')...`
                    : 'Describe the story, roleplay scene, or sequence narrative (e.g. A solitary explorer discovering a bioluminescent alien jungle at twilight)...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/10 text-xs sm:text-sm text-[#0d0d0d] dark:text-white placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed resize-none"
              />
            </div>

            {/* Number of Shots Selector */}
            <div>
              <label className="block text-xs font-bold text-[#0d0d0d] dark:text-white mb-1.5 flex items-center justify-between">
                <span>Number of Images ({shotCount} Shots)</span>
                <span className="text-[10px] text-gray-400 font-normal">Story length</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {SHOT_COUNT_PRESETS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setShotCount(count)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      shotCount === count
                        ? 'bg-[#10a37f] text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {count} Images {count === 5 ? '★' : ''}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[11px] text-gray-500 font-medium">Custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={shotCount}
                    onChange={(e) => setShotCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
                    className="w-14 px-2 py-1 text-xs text-center rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Cinematography & POVs Guidance */}
            <div>
              <label className="block text-xs font-bold text-[#0d0d0d] dark:text-white mb-1.5 flex items-center justify-between">
                <span>Directing Guidance & Camera POVs (Optional)</span>
                <span className="text-[10px] text-gray-400 font-normal">Angles, lenses, lighting, vibe</span>
              </label>
              <textarea
                rows={2}
                value={creativeGuidance}
                onChange={(e) => setCreativeGuidance(e.target.value)}
                placeholder="e.g. Vary angles from wide environmental establishing shots to intimate 85mm portrait close-ups; candid handheld realism; golden hour lighting..."
                className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/10 text-xs text-[#0d0d0d] dark:text-white placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed resize-none"
              />
              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                {GUIDANCE_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => appendGuidanceChip(chip)}
                    className="px-2 py-0.5 rounded-lg text-[10px] bg-gray-100 hover:bg-emerald-50 dark:bg-white/5 dark:hover:bg-emerald-950/30 text-gray-600 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-gray-200/60 dark:border-white/5 transition-all"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {planError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{planError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handlePlan}
              disabled={isPlanning || !intent.trim()}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                intent.trim() && !isPlanning
                  ? 'bg-[#10a37f] hover:bg-[#0d926e] text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isPlanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Director is Crafting {shotCount}-Shot Narrative Plan…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{shots.length > 0 ? 'Re-Plan Storyboard Sequence' : 'Plan Storyboard Sequence'}</span>
                </>
              )}
            </button>
          </div>

          {/* ── Step 2: Planned Storyboard Review ── */}
          {shots.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-[#0d0d0d] dark:text-white">
                    Planned Storyboard Shots ({shots.length} Images)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddShot}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Shot</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {shots.map((shot, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#18181b] border border-gray-200 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                          Shot {idx + 1} of {shots.length}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          <Camera className="w-3 h-3 text-emerald-500" />
                          <input
                            type="text"
                            value={shot.camera_pov}
                            onChange={(e) => handleUpdateShotPov(idx, e.target.value)}
                            className="bg-transparent border-0 outline-none text-[11px] font-medium text-gray-600 dark:text-gray-400 focus:text-black dark:focus:text-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteShot(idx)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                        title="Delete Shot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {shot.description}
                    </p>

                    <div className="pt-1">
                      <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-0.5">
                        Compiled Generation Prompt:
                      </label>
                      <textarea
                        rows={2}
                        value={shot.prompt}
                        onChange={(e) => handleUpdateShotPrompt(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#202024] border border-gray-200/80 dark:border-white/10 text-[11px] font-mono text-gray-700 dark:text-gray-300 outline-none focus:border-emerald-500 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Execution Error Notice */}
              {executingError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{executingError}</span>
                </div>
              )}

              {/* ── Live Execution Progress View ── */}
              {isExecuting && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {directorStatus?.status || 'Automated Storyboard Sequence Running…'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelSequence}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Stop Sequence</span>
                    </button>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          ((directorStatus?.current_shot || 0) / (directorStatus?.total_shots || shots.length)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>
                      Shot {directorStatus?.current_shot || 0} of {directorStatus?.total_shots || shots.length}
                    </span>
                    <span>Turn-by-turn ChatGPT automation</span>
                  </div>
                </div>
              )}

              {/* Automated Execution Button */}
              {!isExecuting && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 space-y-3">
                  <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                    ✦ <strong>Full Automated Process:</strong> Will prime Turn 0 Character Lock for{' '}
                    <strong>{selectedChar?.name || 'the scene'}</strong> if needed, and generate all{' '}
                    <strong>{shots.length} images</strong> sequentially in the same thread with automatic rate-limit backoff.
                  </div>
                  <button
                    type="button"
                    onClick={handleExecuteSequence}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run Automated Story Sequence ({shots.length} Images)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {shots.length > 0 ? `${shots.length} shots ready` : 'Define plot & shots above'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
