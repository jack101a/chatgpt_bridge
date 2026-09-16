import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Sparkles,
  X,
  Image as ImageIcon,
  Clapperboard,
  Lock,
  User,
  ChevronDown,
  CheckCircle2,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  ImageRequest,
  GalleryItem,
  CharacterCard,
  ConversationContract,
} from '../../types';
import { PromptLibraryTray } from '../director/PromptLibraryTray';
import { DirectorModal } from '../director/DirectorModal';
import { api } from '../../lib/api';
import { compileRecurringCharacterPrompt } from '../../lib/characterLock';

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
  const [showLibrary, setShowLibrary] = useState(false);
  const [isDirectorModalOpen, setIsDirectorModalOpen] = useState(false);

  // Character Lock & Consistency State
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);
  const [contract, setContract] = useState<ConversationContract | null>(null);
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [, setHandshakeStatus] = useState<string | null>(null);

  // Clean Delta Mode State
  const [isDeltaMode, setIsDeltaMode] = useState(false);
  const [deltaScene, setDeltaScene] = useState('');
  const [deltaOutfit, setDeltaOutfit] = useState('');
  const [deltaPose, setDeltaPose] = useState('');
  const [deltaExpression, setDeltaExpression] = useState('');
  const [deltaCamera, setDeltaCamera] = useState('');
  const [deltaLighting, setDeltaLighting] = useState('');
  const [deltaBackground, setDeltaBackground] = useState('');

  // Identity Drift Re-Anchor State (Image 1 = Face, Image 2 = Body, Image 3 = Expression)
  const [driftCards, setDriftCards] = useState<('face' | 'body' | 'expression')[]>([]);

  const handleToggleDriftCard = (cardType: 'face' | 'body' | 'expression') => {
    setDriftCards((prev) =>
      prev.includes(cardType) ? prev.filter((c) => c !== cardType) : [...prev, cardType]
    );
  };

  const handleSelectAllDrift = () => {
    if (driftCards.length === 3) {
      setDriftCards([]);
    } else {
      setDriftCards(['face', 'body', 'expression']);
    }
  };

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;

    // Resolve any selected Drift Re-Anchor card image IDs
    const resolvedDriftImages: string[] = [];
    if (activeCharacter) {
      if (driftCards.includes('face') && activeCharacter.face_lock_image_id) {
        resolvedDriftImages.push(activeCharacter.face_lock_image_id);
      }
      if (driftCards.includes('body') && activeCharacter.body_lock_image_id) {
        resolvedDriftImages.push(activeCharacter.body_lock_image_id);
      }
      if (driftCards.includes('expression') && activeCharacter.expression_lock_image_id) {
        resolvedDriftImages.push(activeCharacter.expression_lock_image_id);
      }
    }

    if (isDeltaMode && activeCharacter) {
      if (!deltaScene.trim()) return;

      const compiledPrompt = compileRecurringCharacterPrompt({
        scene: deltaScene,
        outfit: deltaOutfit,
        pose: deltaPose,
        expression: deltaExpression,
        camera: deltaCamera,
        lighting: deltaLighting,
        background: deltaBackground,
      });

      onSend({
        prompt: compiledPrompt,
        conversation_id: activeConvId || null,
        reference_image: referenceImage ? referenceImage.id : null,
        reference_images: resolvedDriftImages.length > 0 ? resolvedDriftImages : undefined,
      });

      setDeltaScene('');
      setDriftCards([]);
      return;
    }

    if (!promptText.trim()) return;

    const finalPrompt =
      activeCharacter &&
      !promptText.includes('Use Image 1') &&
      !promptText.trim().startsWith('{')
        ? compileRecurringCharacterPrompt({ scene: promptText.trim() })
        : promptText.trim();

    onSend({
      prompt: finalPrompt,
      conversation_id: activeConvId || null,
      reference_image: referenceImage ? referenceImage.id : null,
      reference_images: resolvedDriftImages.length > 0 ? resolvedDriftImages : undefined,
    });

    setPromptText('');
    setDriftCards([]);
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
      <div className="flex flex-col bg-[#ffffff] dark:bg-[#1c1c1f] rounded-2xl border border-[#e5e5e5] dark:border-[#2e2e32] shadow-lg shadow-black/5 transition-all focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/15 relative">
        {/* ── Visual Prompt Library Tray (Collapsible) ── */}
        <PromptLibraryTray
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
          onInsertModifier={handleInsertModifier}
        />

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

        {/* ── Drift Re-Anchor Strategy Toolstrip (Face, Body, Expression) ── */}
        {activeCharacter && contract?.primed && (
          <div className="px-3.5 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200/60 dark:border-zinc-800/70 flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] text-zinc-500 font-medium mr-1 flex items-center gap-1">
              <span>Drift Re-Anchor:</span>
            </span>

            <button
              type="button"
              onClick={() => handleToggleDriftCard('face')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                driftCards.includes('face')
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500/50'
              }`}
            >
              Face Card {driftCards.includes('face') ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDriftCard('body')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                driftCards.includes('body')
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500/50'
              }`}
            >
              Body Card {driftCards.includes('body') ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={() => handleToggleDriftCard('expression')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                driftCards.includes('expression')
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500/50'
              }`}
            >
              Expression Card {driftCards.includes('expression') ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={handleSelectAllDrift}
              className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
            >
              {driftCards.length === 3 ? 'Clear Re-Anchor' : 'All 3 Cards'}
            </button>
          </div>
        )}

        {/* ── Clean Delta Prompt Inputs (When Delta Mode is Active) ── */}
        {isDeltaMode && activeCharacter && (
          <div className="p-3 bg-zinc-50/90 dark:bg-[#18181b]/90 border-b border-zinc-200/80 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Layers size={13} className="text-emerald-500" />
                Clean Delta Mode — {activeCharacter.name}
              </span>
              <button
                type="button"
                onClick={() => setIsDeltaMode(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <textarea
                rows={2}
                value={deltaScene}
                onChange={(e) => setDeltaScene(e.target.value)}
                placeholder="[SCENE]: What is happening? (e.g. Walking into a sunlit library holding an open book)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs text-[#0d0d0d] dark:text-white placeholder:text-zinc-400 outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={deltaOutfit}
                onChange={(e) => setDeltaOutfit(e.target.value)}
                placeholder="[OUTFIT]: Specific clothing or style (optional)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaPose}
                onChange={(e) => setDeltaPose(e.target.value)}
                placeholder="[POSE / ACTION]: Specific body posture (optional)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaExpression}
                onChange={(e) => setDeltaExpression(e.target.value)}
                placeholder="[EXPRESSION]: Facial expression and eye gaze (optional)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaCamera}
                onChange={(e) => setDeltaCamera(e.target.value)}
                placeholder="[CAMERA]: Angle & lens (e.g. 50mm eye-level medium shot)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaLighting}
                onChange={(e) => setDeltaLighting(e.target.value)}
                placeholder="[LIGHTING]: Atmosphere (e.g. Warm natural daylight)"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={deltaBackground}
                onChange={(e) => setDeltaBackground(e.target.value)}
                placeholder="[BACKGROUND]: Environment details"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 text-xs placeholder:text-zinc-400 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* ── Top Clean Toolbar: Character Selector + AI Director + Thread Indicator ── */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2 flex-wrap">
          {/* Left: Prominent Character Card Selector */}
          <div className="flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCharacterMenuOpen(!isCharacterMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  activeCharacter
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-xs hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60'
                    : 'bg-[#f4f4f5] dark:bg-[#2b2b2f] text-[#0d0d0d] dark:text-white border-transparent hover:bg-gray-200/80 dark:hover:bg-[#34343a]'
                }`}
                title="Select or change character for this chat"
              >
                {activeCharacter ? (
                  <>
                    {activeCharacter.avatar_image_id ? (
                      <img
                        src={`/images/${activeCharacter.avatar_image_id}`}
                        alt={activeCharacter.name}
                        className="w-5 h-5 rounded-full object-cover border border-emerald-500/50"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {activeCharacter.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate max-w-[120px]">{activeCharacter.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-600 text-white font-mono">
                      Locked
                    </span>
                  </>
                ) : (
                  <>
                    <User size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Select Character</span>
                  </>
                )}
                <ChevronDown size={12} className="opacity-60 ml-0.5" />
              </button>

              {isCharacterMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>Select Character for Chat</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {characters.length} saved
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectCharacter?.(null);
                      setIsCharacterMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${
                      !activeCharacter ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium">✦ No Character</div>
                      <div className="text-[10px] text-zinc-400">Freeform DALL·E generation</div>
                    </div>
                    {!activeCharacter && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                  </button>

                  <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/40">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCharacter?.(c);
                          setIsCharacterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${
                          activeCharacter?.id === c.id
                            ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          {c.avatar_image_id ? (
                            <img
                              src={`/images/${c.avatar_image_id}`}
                              alt={c.name}
                              className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{c.name}</div>
                            {c.tagline && <div className="text-[10px] text-zinc-400 truncate">{c.tagline}</div>}
                          </div>
                        </div>
                        {activeCharacter?.id === c.id && (
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Director Button + Prompt Library + Thread Badge */}
          <div className="flex items-center gap-2 ml-auto">
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

            {/* AI Director Modal Button */}
            <button
              type="button"
              onClick={() => setIsDirectorModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="AI Director: Story, Plot & Automated Multi-Image Generation"
            >
              <Clapperboard size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>AI Director</span>
            </button>

            {/* Prompt Library Button */}
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className={`p-2 rounded-xl text-[#6e6e80] hover:text-black dark:text-[#a1a1aa] dark:hover:text-white transition-all cursor-pointer ${
                showLibrary ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
              title="Visual Prompt Library (Camera, Lighting, Film)"
            >
              <Sparkles size={15} />
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

      {/* ── AI Storyboard Director Modal ── */}
      <DirectorModal
        isOpen={isDirectorModalOpen}
        onClose={() => setIsDirectorModalOpen(false)}
        initialPrompt={promptText || deltaScene}
        characters={characters}
        activeCharacter={activeCharacter}
        activeConvId={activeConvId}
        onSelectCharacter={onSelectCharacter}
      />
    </div>
  );
};
