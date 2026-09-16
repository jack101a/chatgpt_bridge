import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Sparkles,
  X,
  Clapperboard,
  Lock,
  User,
  ChevronDown,
  CheckCircle2,
  Layers,
  Square,
  Smartphone,
  Tv,
} from 'lucide-react';
import {
  ImageRequest,
  GalleryItem,
  CharacterCard,
} from '../../types';
import { PromptLibraryTray } from '../director/PromptLibraryTray';
import { DirectorModal } from '../director/DirectorModal';
import { compileRecurringCharacterPrompt } from '../../lib/characterLock';
import { hapticImpact } from '../../lib/haptics';

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
}) => {
  const [promptText, setPromptText] = useState('');
  const [selectedAspect, setSelectedAspect] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [showLibrary, setShowLibrary] = useState(false);
  const [isDirectorModalOpen, setIsDirectorModalOpen] = useState(false);

  // Character Lock & Consistency State
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);

  // Clean Delta Mode State
  const [isDeltaMode, setIsDeltaMode] = useState(false);
  const [deltaScene, setDeltaScene] = useState('');
  const [deltaOutfit, setDeltaOutfit] = useState('');
  const [deltaPose, setDeltaPose] = useState('');
  const [deltaExpression, setDeltaExpression] = useState('');
  const [deltaCamera, setDeltaCamera] = useState('');
  const [deltaLighting, setDeltaLighting] = useState('');
  const [deltaBackground, setDeltaBackground] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss character menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsCharacterMenuOpen(false);
      }
    };
    if (isCharacterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCharacterMenuOpen]);

  // Dynamic textarea height calculation
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [promptText]);

  const handleSelectAspect = (aspect: '1:1' | '9:16' | '16:9') => {
    if (aspect !== selectedAspect) {
      hapticImpact('selection');
    }
    setSelectedAspect(aspect);
  };

  const handleSubmit = () => {
    if (isGenerating) return;

    if (isDeltaMode) {
      if (!deltaScene.trim()) return;
      hapticImpact('medium');

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
        aspect: selectedAspect,
        reference_image: referenceImage ? referenceImage.id : null,
      });

      setDeltaScene('');
      return;
    }

    if (!promptText.trim()) return;
    hapticImpact('medium');

    const finalPrompt =
      activeCharacter &&
      !promptText.includes('original identity reference set') &&
      !promptText.includes('Use locked Image') &&
      !promptText.includes('Use Image 1') &&
      !promptText.trim().startsWith('{')
        ? compileRecurringCharacterPrompt({ scene: promptText.trim() })
        : promptText.trim();

    onSend({
      prompt: finalPrompt,
      conversation_id: activeConvId || null,
      aspect: selectedAspect,
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
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-3 space-y-2 select-none">
      {/* ── Visual Prompt Library Tray ── */}
      {showLibrary && (
        <PromptLibraryTray
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
          onInsertModifier={(text: string) => {
            setPromptText((prev) => (prev ? `${prev}, ${text}` : text));
            setShowLibrary(false);
            textareaRef.current?.focus();
          }}
        />
      )}

      {/* ── Main Floating Capsule Stage ── */}
      <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden transition-all duration-200">
        {/* ── Active Reference Preview Banner ── */}
        {referenceImage && (
          <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={referenceImage.thumbnail_url || referenceImage.url}
                alt="Reference"
                className="w-7 h-7 rounded-lg object-cover border border-primary/40 shrink-0"
              />
              <div className="min-w-0">
                <span className="font-semibold text-primary block leading-tight">
                  Remix Reference Attached
                </span>
                <span className="text-[11px] text-muted-foreground truncate block">
                  {referenceImage.prompt || referenceImage.id}
                </span>
              </div>
            </div>
            <button
              onClick={onClearReference}
              className="p-1 rounded-lg hover:bg-primary/20 text-primary transition-colors shrink-0"
              title="Remove reference"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Top Bar: Character Pill, Aspect Ratio & Tools ── */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2 flex-wrap border-b border-border/50 bg-muted/20">
          {/* Left: Character Lock Pill & Selector */}
          <div className="flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCharacterMenuOpen(!isCharacterMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  activeCharacter
                    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 shadow-xs'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground'
                }`}
                title="Select character anchor"
              >
                {activeCharacter ? (
                  <>
                    <Lock size={12} className="text-primary" />
                    <span className="truncate max-w-[120px]">{activeCharacter.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary text-primary-foreground font-mono">
                      Locked
                    </span>
                  </>
                ) : (
                  <>
                    <User size={13} className="text-muted-foreground" />
                    <span>Freeform Mode</span>
                  </>
                )}
                <ChevronDown size={11} className="opacity-60 ml-0.5" />
              </button>

              {isCharacterMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-card border border-border shadow-2xl py-1.5 z-50 animate-fade-in">
                  <div className="px-3.5 py-2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Active Persona</span>
                    <span className="font-mono text-primary">{characters.length} cards</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectCharacter?.(null);
                      setIsCharacterMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                      !activeCharacter ? 'font-bold text-primary bg-primary/10' : 'text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-medium">✦ Freeform (No Character)</div>
                      <div className="text-[10px] text-muted-foreground">Direct DALL·E generation</div>
                    </div>
                    {!activeCharacter && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                  </button>

                  <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCharacter?.(c);
                          setIsCharacterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                          activeCharacter?.id === c.id
                            ? 'font-bold text-primary bg-primary/10'
                            : 'text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{c.name}</div>
                            {c.tagline && <div className="text-[10px] text-muted-foreground truncate">{c.tagline}</div>}
                          </div>
                        </div>
                        {activeCharacter?.id === c.id && (
                          <CheckCircle2 size={14} className="text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Delta Mode Switcher */}
            {activeCharacter && (
              <button
                type="button"
                onClick={() => setIsDeltaMode(!isDeltaMode)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                  isDeltaMode
                    ? 'bg-foreground text-background font-semibold border-foreground shadow-xs'
                    : 'bg-muted text-muted-foreground hover:text-foreground border-border'
                }`}
                title="Toggle Clean Delta structured parameters"
              >
                <Layers size={12} />
                <span>Delta</span>
              </button>
            )}

            {/* Active Thread Pill */}
            {activeConvId && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10.5px] font-mono border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="truncate max-w-[120px]">
                  ↳ {activeConvId.slice(0, 8)}…
                </span>
                <button
                  onClick={onClearThread}
                  className="hover:text-destructive ml-0.5"
                  title="Disconnect thread"
                >
                  <X size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Center/Right: Aspect Ratio Selector Pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleSelectAspect('1:1')}
              className={`min-h-[32px] sm:min-h-[26px] px-2.5 py-1 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-mono transition-all active:scale-95 ${
                selectedAspect === '1:1'
                  ? 'bg-card text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="1:1 Square"
            >
              <Square size={11} />
              <span>1:1</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectAspect('9:16')}
              className={`min-h-[32px] sm:min-h-[26px] px-2.5 py-1 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-mono transition-all active:scale-95 ${
                selectedAspect === '9:16'
                  ? 'bg-card text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="9:16 Mobile Wallpaper"
            >
              <Smartphone size={11} />
              <span>9:16</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectAspect('16:9')}
              className={`min-h-[32px] sm:min-h-[26px] px-2.5 py-1 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-mono transition-all active:scale-95 ${
                selectedAspect === '16:9'
                  ? 'bg-card text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="16:9 Cinema Wide"
            >
              <Tv size={11} />
              <span>16:9</span>
            </button>
          </div>

          {/* Right: AI Director Button & Prompt Library */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setIsDirectorModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 text-xs font-semibold border border-rose-500/25 transition-all active:scale-95 shadow-2xs min-h-[32px]"
              title="AI Director: Cinematic Storyboard Generator"
            >
              <Clapperboard size={13} />
              <span className="hidden sm:inline">Director</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setShowLibrary(!showLibrary);
              }}
              className={`p-2 rounded-xl transition-all min-h-[32px] min-w-[32px] flex items-center justify-center ${
                showLibrary
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Visual Prompt Library"
            >
              <Sparkles size={14} />
            </button>
          </div>
        </div>

        {/* ── Main Textarea Row ── */}
        {!isDeltaMode ? (
          <div className="flex items-end gap-2 px-3.5 py-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                referenceImage
                  ? 'Describe modifications using this reference…'
                  : activeCharacter
                  ? `Describe a scene for ${activeCharacter.name}…`
                  : 'Describe what you want to imagine…'
              }
              className="flex-1 max-h-[180px] bg-transparent border-0 outline-none resize-none text-[14px] leading-relaxed placeholder:text-muted-foreground text-foreground font-sans py-1.5"
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isGenerating || !promptText.trim()}
              className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center shrink-0 transition-all ${
                promptText.trim() && !isGenerating
                  ? 'bg-primary hover:bg-emerald-600 text-primary-foreground active:scale-90 shadow-md shadow-emerald-500/25'
                  : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
              }`}
              aria-label="Send prompt"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={deltaScene}
                onChange={(e) => setDeltaScene(e.target.value)}
                placeholder="[SCENE]: Location & action (required)"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaOutfit}
                onChange={(e) => setDeltaOutfit(e.target.value)}
                placeholder="[OUTFIT]: Specific clothing"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaPose}
                onChange={(e) => setDeltaPose(e.target.value)}
                placeholder="[POSE]: Posture or gesture"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaExpression}
                onChange={(e) => setDeltaExpression(e.target.value)}
                placeholder="[EXPRESSION]: Facial expression and gaze"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaCamera}
                onChange={(e) => setDeltaCamera(e.target.value)}
                placeholder="[CAMERA]: Lens & POV (e.g. 50mm candid)"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaLighting}
                onChange={(e) => setDeltaLighting(e.target.value)}
                placeholder="[LIGHTING]: Atmosphere & light"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaBackground}
                onChange={(e) => setDeltaBackground(e.target.value)}
                placeholder="[BACKGROUND]: Environment details"
                className="w-full px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans sm:col-span-2"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground font-mono">
                Clean Delta preserves character DNA without token drift.
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isGenerating || !deltaScene.trim()}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  deltaScene.trim() && !isGenerating
                    ? 'bg-primary hover:bg-emerald-600 text-primary-foreground active:scale-95 shadow-md shadow-emerald-500/25'
                    : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                <span>Generate Delta</span>
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Micro-Telemetry & Keyboard Hint Footer ── */}
      <div className="flex items-center justify-between px-2 text-[10.5px] font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>↵ Send</span>
          <span>•</span>
          <span>⇧↵ Newline</span>
          <span>•</span>
          <span>⌘K Commands</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>DALL·E 3 Multi-Account</span>
        </div>
      </div>

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
