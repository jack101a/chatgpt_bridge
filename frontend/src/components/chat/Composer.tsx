import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Wand2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  RefreshCw,
  Plus,
} from 'lucide-react';
import {
  ImageRequest,
  GalleryItem,
  CharacterCard,
  AIProviderConfig,
} from '../../types';
import { PromptLibraryTray } from '../director/PromptLibraryTray';
import { DirectorModal } from '../director/DirectorModal';
import { compileRecurringCharacterPrompt } from '../../lib/characterLock';
import { hapticImpact } from '../../lib/haptics';
import { analyzePromptSafety, enhancePrompt } from '../../lib/promptEnhancer';
import { api } from '../../lib/api';
import { getProviderModelList } from '../../lib/aiConfig';

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

  // Real-time prompt safety analysis
  const safety = useMemo(() => analyzePromptSafety(promptText), [promptText]);

  // AI Prompt Enhancer state (Multi-provider BYOK architecture)
  const [enhancerProviderId, setEnhancerProviderId] = useState<string>('gemini');
  const [enhancerModel, setEnhancerModel] = useState<string>('gemini-2.5-flash');
  const [aiProviders, setAiProviders] = useState<Record<string, AIProviderConfig>>({});
  const [defaultProvidersList, setDefaultProvidersList] = useState<Array<{ id: string; default_models?: string[] }>>([]);
  const [activePickerProviderId, setActivePickerProviderId] = useState<string>('gemini');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelMsg, setFetchModelMsg] = useState<string | null>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Load AI configuration & assignments on mount
  const refreshAIConfig = useCallback(async () => {
    try {
      const cfg = await api.getAIConfig();
      if (cfg && cfg.ok) {
        if (cfg.providers) {
          setAiProviders(cfg.providers);
        }
        if (cfg.assignments?.enhancer) {
          const pid = cfg.assignments.enhancer.provider_id || 'gemini';
          const mdl = cfg.assignments.enhancer.model || 'gemini-2.5-flash';
          setEnhancerProviderId(pid);
          setEnhancerModel(mdl);
          setActivePickerProviderId(pid);
        }
        if (cfg.default_providers) {
          setDefaultProvidersList(cfg.default_providers);
        }
      }
    } catch {
      try {
        const c = await api.getLLMConfig();
        if (c) {
          setEnhancerModel(c.enhancer_model || c.director_model || c.model || 'gemini-2.5-flash');
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    refreshAIConfig();

    const handleConfigUpdated = (e?: Event) => {
      const customEvent = e as CustomEvent<{ assignments?: { enhancer?: { provider_id: string; model: string } } }>;
      if (customEvent?.detail?.assignments?.enhancer) {
        const pid = customEvent.detail.assignments.enhancer.provider_id || 'gemini';
        const mdl = customEvent.detail.assignments.enhancer.model || 'gemini-2.5-flash';
        setEnhancerProviderId(pid);
        setEnhancerModel(mdl);
        setActivePickerProviderId(pid);
      }
      refreshAIConfig();
    };

    window.addEventListener('bridge:ai-config-updated', handleConfigUpdated);
    window.addEventListener('focus', handleConfigUpdated);
    return () => {
      window.removeEventListener('bridge:ai-config-updated', handleConfigUpdated);
      window.removeEventListener('focus', handleConfigUpdated);
    };
  }, [refreshAIConfig]);

  // Click outside to dismiss model picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    if (isModelPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isModelPickerOpen]);

  const handleSelectProviderAndModel = async (providerId: string, modelName: string) => {
    const trimmed = modelName.trim();
    if (!trimmed) return;
    setEnhancerProviderId(providerId);
    setEnhancerModel(trimmed);
    setIsModelPickerOpen(false);
    setIsCustomMode(false);
    setModelSearchQuery('');

    try {
      await api.saveAIAssignments({
        enhancer: { provider_id: providerId, model: trimmed },
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('bridge:ai-config-updated', {
            detail: { assignments: { enhancer: { provider_id: providerId, model: trimmed } } },
          })
        );
      }
    } catch {
      // non-blocking
    }
  };

  const handleAddCustomModelToProvider = async (providerId: string, modelName: string) => {
    const trimmed = modelName.trim();
    if (!trimmed) return;
    try {
      const res = await api.addAIProviderModel(providerId, trimmed);
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            custom_models: res.custom_models,
          },
        }));
        setCustomModelInput('');
        setIsCustomMode(false);
        await handleSelectProviderAndModel(providerId, trimmed);
      }
    } catch (err: any) {
      alert(`Failed to add custom model: ${err.message}`);
    }
  };

  const handleDeleteCustomModel = async (providerId: string, modelToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.deleteAIProviderModel(providerId, modelToDelete);
      if (res.ok) {
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            custom_models: res.custom_models,
          },
        }));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bridge:ai-config-updated'));
        }
      }
    } catch {}
  };

  const handleFetchEndpointModels = async (providerId: string) => {
    setIsFetchingModels(true);
    setFetchModelMsg(null);
    try {
      const res = await api.testAIProvider(providerId);
      if (res.ok) {
        setFetchModelMsg(`Discovered ${res.models?.length || 0} models!`);
        setAiProviders((prev) => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            discovered_models: res.models || [],
          },
        }));
      } else {
        setFetchModelMsg(res.message || 'Connection failed');
      }
    } catch (err: any) {
      setFetchModelMsg(err.message || 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
      setTimeout(() => setFetchModelMsg(null), 3500);
    }
  };

  // 1-Click "Enhance / Make Safe" transformation
  const handleEnhance = async () => {
    if (!promptText.trim() || isGenerating || isEnhancing) return;
    hapticImpact('selection');
    setIsEnhancing(true);

    try {
      const res = await api.enhancePrompt({
        prompt: promptText.trim(),
        provider_id: enhancerProviderId,
        model: enhancerModel,
      });
      if (res.ok && res.enhanced_prompt) {
        setPromptText(res.enhanced_prompt);
      } else {
        // Fall back gracefully to local rule-based ChatGPT 2.5 prompt enhancer
        const fallback = enhancePrompt(promptText);
        setPromptText(fallback);
      }
    } catch {
      // Fall back gracefully to local rule-based ChatGPT 2.5 prompt enhancer
      const fallback = enhancePrompt(promptText);
      setPromptText(fallback);
    } finally {
      setIsEnhancing(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
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
        aspect: '1:1',
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
      aspect: '1:1',
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
      <div className="relative rounded-2xl border border-border bg-card shadow-lg transition-all duration-200">
        {/* ── Active Reference Preview Banner ── */}
        {referenceImage && (
          <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20 text-xs rounded-t-2xl">
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

        {/* ── Top Bar: Character Pill, Delta Mode & Tools ── */}
        <div className={`flex items-center justify-between px-2.5 sm:px-3 pt-2 pb-1.5 gap-1.5 sm:gap-2 border-b border-border/50 bg-muted/20 ${!referenceImage ? 'rounded-t-2xl' : ''}`}>
          {/* Left: Character Lock Pill & Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCharacterMenuOpen(!isCharacterMenuOpen)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border min-h-[34px] ${
                  activeCharacter
                    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 shadow-xs'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground'
                }`}
                title="Select character anchor"
              >
                {activeCharacter ? (
                  <>
                    <Lock size={12} className="text-primary shrink-0" />
                    <span className="truncate max-w-[75px] sm:max-w-[120px]">{activeCharacter.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary text-primary-foreground font-mono shrink-0 hidden xs:inline">
                      Locked
                    </span>
                  </>
                ) : (
                  <>
                    <User size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[65px] sm:max-w-none">Freeform</span>
                  </>
                )}
                <ChevronDown size={11} className="opacity-60 ml-0.5 shrink-0" />
              </button>

              {isCharacterMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-card border border-border shadow-2xl py-1.5 z-50 animate-fade-in">
                  <div className="px-3.5 py-2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Active Persona</span>
                    <span className="font-mono text-primary">{characters.length} cards</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('selection');
                      onSelectCharacter?.(null);
                      setIsCharacterMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                      !activeCharacter ? 'font-bold text-primary bg-primary/10' : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        <Sparkles size={12} className="text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">✦ Freeform (No Character)</div>
                        <div className="text-[10px] text-muted-foreground">Direct DALL·E generation</div>
                      </div>
                    </div>
                    {!activeCharacter && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                  </button>

                  <div className="max-h-60 overflow-y-auto divide-y divide-border/60">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          hapticImpact('selection');
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

          {/* Right: Enhancer Model Picker, AI Director Button, Safety Shield & Prompt Library */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
            {/* Real-time Safety Shield Indicator */}
            {promptText.trim() && (
              <div
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-mono border transition-all shrink-0 ${
                  safety.level === 'safe'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : safety.level === 'warning'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 animate-pulse'
                }`}
                title={safety.reason}
              >
                {safety.level === 'safe' ? (
                  <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert size={12} className={safety.level === 'warning' ? 'text-amber-500 shrink-0' : 'text-red-500 shrink-0'} />
                )}
                <span className="hidden md:inline font-medium capitalize">
                  {safety.level === 'safe' ? 'Safe' : safety.level === 'warning' ? 'Notice' : 'Filter Risk'}
                </span>
              </div>
            )}

            {/* Enhancer Model Quick Switcher */}
            <div className="relative" ref={modelPickerRef}>
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setIsModelPickerOpen(!isModelPickerOpen);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-muted/70 hover:bg-muted text-foreground text-xs font-mono border border-border transition-all active:scale-95 shadow-2xs min-h-[34px] sm:min-h-[30px] max-w-[105px] sm:max-w-[220px]"
                title={`Enhancer: ${aiProviders[enhancerProviderId]?.name || enhancerProviderId} → ${enhancerModel}. Click to switch provider or model.`}
              >
                <Wand2 size={12} className="text-emerald-500 shrink-0" />
                <span className="truncate text-[11px]">
                  <span className="hidden sm:inline font-semibold text-muted-foreground mr-1">
                    {aiProviders[enhancerProviderId]?.name?.replace(/\(.*?\)/g, '').trim() || enhancerProviderId}:
                  </span>
                  {enhancerModel.split('/').pop()?.replace(/^gemini-/, '')}
                </span>
                <ChevronDown size={11} className="text-muted-foreground shrink-0 opacity-60 ml-auto" />
              </button>

              {/* Quick Multi-Provider Selector Popover (Responsive Mobile-Friendly) */}
              {isModelPickerOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div
                    className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
                    onClick={() => setIsModelPickerOpen(false)}
                  />
                  <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:right-0 sm:bottom-full sm:mb-2 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-card border border-border shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Wand2 size={13} className="text-emerald-500" />
                        <span className="text-xs font-bold text-foreground">Chatbox Enhancer Assignment</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Active: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">{aiProviders[enhancerProviderId]?.name?.replace(/\(.*?\)/g, '').trim() || enhancerProviderId}</span> / <span className="font-mono text-foreground">{enhancerModel}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModelPickerOpen(false)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Provider Tabs (Horizontal Scroll) */}
                  <div className="mb-2.5">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 tracking-wider flex items-center justify-between">
                      <span>Select Provider</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400">● has API key</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {Object.entries(aiProviders).map(([pid, p]) => (
                        <button
                          key={`prov-tab-${pid}`}
                          type="button"
                          onClick={() => {
                            setActivePickerProviderId(pid);
                            setModelSearchQuery('');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                            activePickerProviderId === pid
                              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                              : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'
                          }`}
                        >
                          <span>{p.name.replace(/\(.*?\)/g, '').trim()}</span>
                          {p.has_key && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                activePickerProviderId === pid ? 'bg-white' : 'bg-emerald-500'
                              }`}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Provider Info & Fetch Action */}
                  {aiProviders[activePickerProviderId] && (
                    <div className="p-2 rounded-xl bg-muted/40 border border-border/50 mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {aiProviders[activePickerProviderId].base_url}
                        </div>
                        {fetchModelMsg && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            {fetchModelMsg}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFetchEndpointModels(activePickerProviderId)}
                        disabled={isFetchingModels}
                        className="px-2 py-1 rounded-lg bg-background hover:bg-muted border border-border text-[11px] font-medium text-foreground flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow-2xs"
                        title="Fetch all available models from this endpoint"
                      >
                        <RefreshCw size={11} className={isFetchingModels ? 'animate-spin text-emerald-500' : ''} />
                        <span>{isFetchingModels ? 'Fetching…' : 'Fetch All'}</span>
                      </button>
                    </div>
                  )}

                  {/* Search & Custom Model Toggle */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="relative flex-1">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="Search models..."
                        className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500 font-mono"
                      />
                      {modelSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModelSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(!isCustomMode)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-all ${
                        isCustomMode
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                      }`}
                      title="Add a custom model identifier"
                    >
                      <Plus size={11} />
                      <span>Custom</span>
                    </button>
                  </div>

                  {/* Inline Add Custom Model Input */}
                  {isCustomMode && (
                    <div className="flex items-center gap-1.5 mb-2 p-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        placeholder={`Custom model for ${aiProviders[activePickerProviderId]?.name || activePickerProviderId}...`}
                        className="flex-1 px-2.5 py-1 rounded-lg bg-background border border-border text-xs font-mono text-foreground outline-none focus:border-emerald-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customModelInput.trim()) {
                            handleAddCustomModelToProvider(activePickerProviderId, customModelInput.trim());
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!customModelInput.trim()}
                        onClick={() => handleAddCustomModelToProvider(activePickerProviderId, customModelInput.trim())}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Model List */}
                  {(() => {
                    const providerModels = getProviderModelList(activePickerProviderId, aiProviders, defaultProvidersList);
                    const filtered = modelSearchQuery.trim()
                      ? providerModels.filter((m) => m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                      : providerModels;

                    const customList = filtered.filter((m) => m.group === 'custom');
                    const discoveredList = filtered.filter((m) => m.group === 'discovered');
                    const defaultList = filtered.filter((m) => m.group === 'default');

                    return (
                      <div className="max-h-60 overflow-y-auto space-y-0.5 text-xs font-mono pr-1 scrollbar-thin">
                        {/* Custom Models */}
                        {customList.length > 0 && (
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                            ✦ Custom Models ({customList.length})
                          </div>
                        )}
                        {customList.map((m) => (
                          <div
                            key={`cust-${activePickerProviderId}-${m.id}`}
                            onClick={() => handleSelectProviderAndModel(activePickerProviderId, m.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                              enhancerProviderId === activePickerProviderId && enhancerModel === m.id
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="truncate pr-2">{m.id}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {enhancerProviderId === activePickerProviderId && enhancerModel === m.id && (
                                <CheckCircle2 size={13} className="text-emerald-500" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomModel(activePickerProviderId, m.id, e)}
                                className="text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors"
                                title={`Delete ${m.id}`}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Discovered Models */}
                        {discoveredList.length > 0 && (
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold font-sans pt-1">
                            🌐 Endpoint Models ({discoveredList.length})
                          </div>
                        )}
                        {discoveredList.map((m) => (
                          <button
                            key={`disc-${activePickerProviderId}-${m.id}`}
                            type="button"
                            onClick={() => handleSelectProviderAndModel(activePickerProviderId, m.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                              enhancerProviderId === activePickerProviderId && enhancerModel === m.id
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="truncate pr-2">{m.id}</span>
                            {enhancerProviderId === activePickerProviderId && enhancerModel === m.id && (
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            )}
                          </button>
                        ))}

                        {/* Preset / Default Models */}
                        {defaultList.length > 0 && (
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold font-sans pt-1">
                            Preset Defaults ({defaultList.length})
                          </div>
                        )}
                        {defaultList.map((m) => (
                          <button
                            key={`def-${activePickerProviderId}-${m.id}`}
                            type="button"
                            onClick={() => handleSelectProviderAndModel(activePickerProviderId, m.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                              enhancerProviderId === activePickerProviderId && enhancerModel === m.id
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="truncate pr-2">{m.id}</span>
                            {enhancerProviderId === activePickerProviderId && enhancerModel === m.id && (
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            )}
                          </button>
                        ))}

                        {filtered.length === 0 && (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground font-sans">
                            No models matched &quot;{modelSearchQuery}&quot;. Click &quot;Custom&quot; above to add it.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setIsDirectorModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 text-xs font-semibold border border-rose-500/25 transition-all active:scale-95 shadow-2xs min-h-[34px] sm:min-h-[32px]"
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
              className={`p-2 rounded-xl transition-all min-h-[34px] min-w-[34px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center ${
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
        {/* ── Main Textarea Row ── */}
        {!isDeltaMode ? (
          <div className="flex items-end gap-2 px-3 sm:px-3.5 py-2">
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
              className="flex-1 max-h-[180px] bg-transparent border-0 outline-none resize-none text-[16px] sm:text-[14px] leading-relaxed placeholder:text-muted-foreground text-foreground font-sans py-2 sm:py-1.5"
            />

            {/* 1-Click Enhance / Make Safe Button */}
            <button
              type="button"
              onClick={handleEnhance}
              disabled={isGenerating || isEnhancing || !promptText.trim()}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] rounded-xl flex items-center justify-center shrink-0 transition-all border ${
                safety.level === 'danger'
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border-amber-500/30 active:scale-90 shadow-sm'
                  : promptText.trim()
                  ? 'bg-muted hover:bg-muted/80 text-foreground border-border active:scale-90 shadow-2xs'
                  : 'bg-muted text-muted-foreground/40 border-border/50 cursor-not-allowed'
              }`}
              title={
                safety.level === 'danger'
                  ? `🛡️ Make Safe: Swap filter triggers with safe-spicy euphemisms (${enhancerModel})`
                  : `✨ Enhance: Polish into ChatGPT 2.5 photo prompt using ${enhancerModel}`
              }
              aria-label="Enhance prompt"
            >
              {isEnhancing ? (
                <Loader2 size={17} className="animate-spin text-emerald-500" />
              ) : (
                <Wand2 size={17} className={safety.level === 'danger' ? 'text-amber-500' : 'text-primary'} />
              )}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isGenerating || !promptText.trim()}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] rounded-xl flex items-center justify-center shrink-0 transition-all ${
                promptText.trim() && !isGenerating
                  ? 'bg-primary hover:bg-emerald-600 text-primary-foreground active:scale-90 shadow-md shadow-emerald-500/25'
                  : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
              }`}
              aria-label="Send prompt"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
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
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaOutfit}
                onChange={(e) => setDeltaOutfit(e.target.value)}
                placeholder="[OUTFIT]: Specific clothing"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaPose}
                onChange={(e) => setDeltaPose(e.target.value)}
                placeholder="[POSE]: Posture or gesture"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaExpression}
                onChange={(e) => setDeltaExpression(e.target.value)}
                placeholder="[EXPRESSION]: Facial expression and gaze"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaCamera}
                onChange={(e) => setDeltaCamera(e.target.value)}
                placeholder="[CAMERA]: Lens & POV (e.g. 50mm candid)"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaLighting}
                onChange={(e) => setDeltaLighting(e.target.value)}
                placeholder="[LIGHTING]: Atmosphere & light"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              />
              <input
                type="text"
                value={deltaBackground}
                onChange={(e) => setDeltaBackground(e.target.value)}
                placeholder="[BACKGROUND]: Environment details"
                className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-muted/60 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans sm:col-span-2"
              />
            </div>
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <span className="text-[11px] text-muted-foreground font-mono">
                Clean Delta preserves character DNA without token drift.
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isGenerating || !deltaScene.trim()}
                className={`flex items-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[38px] sm:min-h-[32px] ${
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
        <div className="hidden sm:flex items-center gap-2">
          <span>↵ Send</span>
          <span>•</span>
          <span>⇧↵ Newline</span>
          <span>•</span>
          <span>⌘K Commands</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>ChatGPT Bridge Studio</span>
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
        onThreadCreated={onThreadCreated}
      />
    </div>
  );
};
