import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Eye,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  StopCircle,
  Search,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Plus,
  Edit3,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { CharacterCard, DirectorState, StoryboardShot } from '../../types';
import { api } from '../../lib/api';
import { DotMatrixLoader } from '../common/DotMatrixLoader';
import {
  GUIDE_ANGLES,
  GUIDE_TABS,
  DEFAULT_PIPELINES,
  GuideAngle,
  GuideTab,
  GuidePipelineItem,
  GuideSavedPipeline,
} from '../../lib/guidePresets';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  characters?: CharacterCard[];
  activeCharacter?: CharacterCard | null;
  activeConvId?: string | null;
  onSelectCharacter?: (char: CharacterCard | null) => void;
  onThreadCreated?: (convId: string) => void;
}

const STORAGE_SAVED_PIPELINES_KEY = 'bridge:saved-guide-pipelines';

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  activeCharacter = null,
  activeConvId = null,
  onThreadCreated,
}) => {
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<GuideTab | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pipeline Queue (The Sequence of Shots to Execute)
  const [pipeline, setPipeline] = useState<GuidePipelineItem[]>([]);
  const [savedPipelines, setSavedPipelines] = useState<GuideSavedPipeline[]>([]);
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  // Execution & Context
  const [targetThread, setTargetThread] = useState<'current' | 'new'>(activeConvId ? 'current' : 'new');
  const [turnZeroPrompt, setTurnZeroPrompt] = useState(initialPrompt || '');
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Execution status polling
  const [isExecuting, setIsExecuting] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorState | null>(null);
  const [executingError, setExecutingError] = useState<string | null>(null);

  const effectiveConvId = targetThread === 'current' ? (activeConvId || undefined) : undefined;
  const isPureDeltaMode = targetThread === 'current' && Boolean(activeConvId);

  // Load saved pipelines from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SAVED_PIPELINES_KEY);
      if (saved) {
        setSavedPipelines(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Sync initial prompt & target thread on open
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt && !turnZeroPrompt) {
        setTurnZeroPrompt(initialPrompt);
      }
      setTargetThread(activeConvId ? 'current' : 'new');
    }
  }, [isOpen, initialPrompt, activeConvId]);

  // Status Polling during execution
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isExecuting) {
      const check = async () => {
        try {
          const st = await api.getDirectorStatus();
          setDirectorStatus(st);
          if (st.conversation_id) onThreadCreated?.(st.conversation_id);
          if (!st.is_running) {
            setIsExecuting(false);
            if (st.conversation_id) onThreadCreated?.(st.conversation_id);
          }
        } catch {}
      };
      timer = setInterval(check, 2000);
      check();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isExecuting, onThreadCreated]);

  // Filtered angles
  const filteredAngles = useMemo(() => {
    return GUIDE_ANGLES.filter((a) => {
      const matchesTab = activeTab === 'all' || a.tab === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.label.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.focalLength.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  if (!isOpen) return null;

  // Pipeline Management
  const addToPipeline = (angle: GuideAngle) => {
    const newItem: GuidePipelineItem = {
      id: `${angle.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      angleId: angle.id,
      label: angle.label,
      emoji: angle.emoji,
      tag: angle.tag,
      previewImage: angle.previewImage,
      tab: angle.tab,
    };
    setPipeline((prev) => [...prev, newItem]);
  };

  const removeFromPipeline = (idx: number) => {
    setPipeline((prev) => prev.filter((_, i) => i !== idx));
    if (editingItemIdx === idx) setEditingItemIdx(null);
  };

  const movePipelineItem = (idx: number, direction: 'left' | 'right') => {
    if (direction === 'left' && idx > 0) {
      setPipeline((prev) => {
        const next = [...prev];
        const temp = next[idx - 1];
        next[idx - 1] = next[idx];
        next[idx] = temp;
        return next;
      });
    } else if (direction === 'right' && idx < pipeline.length - 1) {
      setPipeline((prev) => {
        const next = [...prev];
        const temp = next[idx + 1];
        next[idx + 1] = next[idx];
        next[idx] = temp;
        return next;
      });
    }
  };

  const updatePipelineItemPrompt = (idx: number, customPrompt: string) => {
    setPipeline((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], customPrompt };
      return next;
    });
  };

  const clearPipeline = () => {
    setPipeline([]);
    setEditingItemIdx(null);
    setShowReviewModal(false);
  };

  // Preset loading & saving
  const loadPipelinePreset = (preset: GuideSavedPipeline) => {
    const items: GuidePipelineItem[] = [];
    for (const angleId of preset.itemAngleIds) {
      const angle = GUIDE_ANGLES.find((a) => a.id === angleId);
      if (angle) {
        items.push({
          id: `${angle.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          angleId: angle.id,
          label: angle.label,
          emoji: angle.emoji,
          tag: angle.tag,
          previewImage: angle.previewImage,
          tab: angle.tab,
        });
      }
    }
    setPipeline(items);
  };

  const handleSavePipeline = () => {
    if (!newPipelineName.trim() || pipeline.length === 0) return;
    const newSaved: GuideSavedPipeline = {
      id: `custom_${Date.now()}`,
      name: newPipelineName.trim(),
      itemAngleIds: pipeline.map((p) => p.angleId),
    };
    const updated = [...savedPipelines, newSaved];
    setSavedPipelines(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_PIPELINES_KEY, JSON.stringify(updated));
    } catch {}
    setNewPipelineName('');
    setIsSavingPipeline(false);
  };

  const handleDeleteSavedPipeline = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPipelines.filter((p) => p.id !== id);
    setSavedPipelines(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_PIPELINES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Compile final execution shots (PURE DELTAS, ZERO SUBJECT REPETITION)
  const compileFinalShots = (): StoryboardShot[] => {
    return pipeline.map((item, idx) => {
      const deltaPrompt = item.customPrompt?.trim() || item.tag;

      // In pure delta mode (active chat), NEVER append subject prompt!
      // In new chat mode: Turn 0 sets the subject once with shot 0, then shots 1+ are pure deltas!
      let promptToSend = deltaPrompt;
      if (!isPureDeltaMode && idx === 0 && turnZeroPrompt.trim()) {
        promptToSend = `${turnZeroPrompt.trim()}\n[CAMERA & PERSPECTIVE]: ${deltaPrompt}`;
      }

      return {
        description: `Step ${idx + 1}: ${item.emoji} ${item.label}`,
        camera_pov: item.tag,
        prompt: promptToSend,
      };
    });
  };

  // Launch pipeline
  const executePipeline = async () => {
    if (pipeline.length === 0 || isExecuting) return;
    const shots = compileFinalShots();
    setIsExecuting(true);
    setExecutingError(null);
    setShowReviewModal(false);

    try {
      await api.executeStoryboard({
        shots,
        character_id: activeCharacter ? activeCharacter.id : 'freeform',
        conversation_id: effectiveConvId,
      });
    } catch (err: any) {
      setExecutingError(err.message || 'Failed to dispatch pipeline');
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelDirectorSequence();
    } catch {}
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[100dvh] sm:h-[92vh] bg-white dark:bg-[#121214] border-0 sm:border border-gray-200 dark:border-[#27272a] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-white/10 shrink-0 bg-white/95 dark:bg-[#141416]/95">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0d0d0d] dark:text-white">
                  POV & Cinematography Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full border border-amber-500/30 font-mono">
                  Pure Deltas · Zero LLM
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                Visual angle library with real photographic references · Build & dispatch deterministic shot sequences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Target Thread Pill */}
            {activeConvId && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {targetThread === 'current' ? 'Current Chat' : 'New Chat'}
                </span>
                <button
                  type="button"
                  onClick={() => setTargetThread(targetThread === 'current' ? 'new' : 'current')}
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-mono ml-1 cursor-pointer"
                >
                  (switch)
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Filter Bar: Categories, Search, Preset Selector ── */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-200/80 dark:border-white/10'
              }`}
            >
              All Angles ({GUIDE_ANGLES.length})
            </button>
            {GUIDE_TABS.map((tab) => {
              const count = GUIDE_ANGLES.filter((a) => a.tab === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-white shadow-xs font-bold'
                      : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-200/80 dark:border-white/10'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search + Load Pre-Made Pipelines */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search angles, lenses, POVs..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick-Load Pipeline Dropdown */}
            <div className="relative group">
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 hover:border-amber-500 transition-all cursor-pointer"
                title="Load a pre-configured multi-angle pipeline"
              >
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Presets</span>
              </button>

              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-2xl bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-2xl p-2 z-50 hidden group-hover:block animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider">
                  Default Coverage Pipelines
                </div>
                {DEFAULT_PIPELINES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => loadPipelinePreset(preset)}
                    className="w-full text-left p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/25 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {preset.description}
                    </div>
                  </button>
                ))}

                {savedPipelines.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 font-mono tracking-wider border-t border-gray-100 dark:border-zinc-800 pt-2">
                      ✦ Your Saved Pipelines ({savedPipelines.length})
                    </div>
                    {savedPipelines.map((sp) => (
                      <div
                        key={sp.id}
                        onClick={() => loadPipelinePreset(sp)}
                        className="w-full text-left p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/25 transition-colors cursor-pointer flex items-center justify-between group/item"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {sp.name}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {sp.itemAngleIds.length} shots queued
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedPipeline(sp.id, e)}
                          className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Library Body: Visual Angle Cards Grid ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredAngles.map((angle) => {
              const inPipelineCount = pipeline.filter((p) => p.angleId === angle.id).length;
              return (
                <div
                  key={angle.id}
                  className={`group relative rounded-2xl border overflow-hidden flex flex-col bg-white dark:bg-[#18181b] transition-all hover:shadow-lg ${
                    inPipelineCount > 0
                      ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                      : 'border-gray-200/90 dark:border-white/10 hover:border-amber-500/50'
                  }`}
                >
                  {/* Real Photographic Reference Thumbnail */}
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    <img
                      src={angle.previewImage}
                      alt={angle.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback placeholder if CDN thumbnail has network glitch
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />

                    {/* Lens & Tag Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-mono font-bold text-white border border-white/20">
                        {angle.focalLength}
                      </span>
                    </div>

                    {/* In-Pipeline Badge */}
                    {inPipelineCount > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] shadow-sm flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{inPipelineCount}× in Pipeline</span>
                      </div>
                    )}

                    {/* Title overlay on image */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center gap-1.5 text-white font-bold text-xs drop-shadow-md">
                        <span>{angle.emoji}</span>
                        <span className="truncate">{angle.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Description & Actions */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {angle.desc}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => addToPipeline(angle)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          inPipelineCount > 0
                            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                            : 'bg-gray-100 hover:bg-amber-500 hover:text-white dark:bg-white/10 dark:hover:bg-amber-500 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Shot</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAngles.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No camera angles matched &quot;{searchQuery}&quot;</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
                className="mt-2 text-xs text-amber-500 hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* ── Persistent Pipeline Dock (Bottom Ribbon) ── */}
        <div className="border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#161619]/95 backdrop-blur-md shrink-0 p-3 sm:p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] space-y-3">
          {/* Pipeline Header & Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Active Shot Pipeline
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold">
                {pipeline.length} Shot{pipeline.length !== 1 ? 's' : ''} Queued
              </span>
              {isPureDeltaMode ? (
                <span className="hidden md:inline text-[11px] text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                  ● Pure Delta Mode (No subject prompt sent)
                </span>
              ) : (
                <span className="hidden md:inline text-[11px] text-gray-400 font-medium ml-1">
                  ● New Chat (Turn 0 Subject + Angle Deltas)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pipeline.length > 0 && !isSavingPipeline && (
                <button
                  type="button"
                  onClick={() => setIsSavingPipeline(true)}
                  className="text-[11px] font-semibold text-gray-500 hover:text-amber-500 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save Pipeline</span>
                </button>
              )}
              {pipeline.length > 0 && (
                <button
                  type="button"
                  onClick={clearPipeline}
                  className="text-[11px] font-semibold text-gray-400 hover:text-red-500 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Save Pipeline Dialog */}
          {isSavingPipeline && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Give this custom pipeline a name (e.g. My 4-Angle Model Set)..."
                className="flex-1 px-3 py-1 text-xs bg-white dark:bg-zinc-800 rounded-lg border border-amber-500/40 text-foreground outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSavePipeline}
                disabled={!newPipelineName.trim()}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSavingPipeline(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pipeline Horizontal Scroll Strip */}
          {pipeline.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {pipeline.map((item, idx) => (
                <div
                  key={item.id}
                  className={`relative shrink-0 flex items-center gap-2.5 p-2 rounded-xl border bg-gray-50/80 dark:bg-white/[0.03] transition-all ${
                    editingItemIdx === idx
                      ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-gray-200 dark:border-white/10'
                  }`}
                >
                  {/* Step Number Badge */}
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Thumbnail */}
                  <img
                    src={item.previewImage}
                    alt={item.label}
                    className="w-10 h-10 rounded-lg object-cover border border-black/10 shrink-0"
                  />

                  {/* Info */}
                  <div className="min-w-0 pr-1">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono truncate max-w-[120px]">
                      {item.customPrompt ? '✦ Customized' : 'Pure Delta'}
                    </div>
                  </div>

                  {/* Action Buttons: Move, Edit, Delete */}
                  <div className="flex items-center gap-0.5 pl-1 border-l border-gray-200 dark:border-white/10">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePipelineItem(idx, 'left')}
                      className="p-1 text-gray-400 hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move shot earlier in sequence"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pipeline.length - 1}
                      onClick={() => movePipelineItem(idx, 'right')}
                      className="p-1 text-gray-400 hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move shot later in sequence"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItemIdx(editingItemIdx === idx ? null : idx)}
                      className="p-1 text-gray-400 hover:text-amber-500 cursor-pointer"
                      title="Edit prompt delta"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromPipeline(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                      title="Remove shot from pipeline"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Camera className="w-4 h-4 opacity-40" />
              <span>Click &quot;+ Add Shot&quot; on any angle card above to build your multi-shot execution pipeline.</span>
            </div>
          )}

          {/* Inline Editor for Selected Pipeline Step */}
          {editingItemIdx !== null && pipeline[editingItemIdx] && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Edit Shot {editingItemIdx + 1} Prompt Delta ({pipeline[editingItemIdx].label}):
                </span>
                <button
                  type="button"
                  onClick={() => setEditingItemIdx(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Done
                </button>
              </div>
              <textarea
                rows={2}
                value={pipeline[editingItemIdx].customPrompt ?? pipeline[editingItemIdx].tag}
                onChange={(e) => updatePipelineItemPrompt(editingItemIdx, e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs font-mono text-foreground outline-none resize-none"
              />
            </div>
          )}

          {/* Error Message */}
          {executingError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{executingError}</span>
            </div>
          )}

          {/* Active Live Sequence Progress */}
          {isExecuting && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <DotMatrixLoader size="sm" variant="hex" speed={1.2} />
                <div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    {directorStatus?.status || 'Executing Multi-Angle Pipeline…'}
                  </div>
                  <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    Shot {directorStatus?.current_shot || 0} of {directorStatus?.total_shots || pipeline.length} · Turn-by-Turn Delivery
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Stop Pipeline
              </button>
            </div>
          )}

          {/* Bottom Execution Bar */}
          {!isExecuting && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
                {pipeline.length > 0 ? (
                  <span>
                    Ready to dispatch <strong>{pipeline.length} images</strong> sequentially with zero LLM hallucination.
                  </span>
                ) : (
                  <span>Select at least 1 camera angle to unlock execution.</span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  disabled={pipeline.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review Prompts</span>
                </button>

                <button
                  type="button"
                  onClick={executePipeline}
                  disabled={pipeline.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Execute Pipeline ({pipeline.length} Shots)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Review Modal (Pre-Flight Inspection) ── */}
        {showReviewModal && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Review Pipeline Prompts ({pipeline.length} Shots)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="p-1 text-gray-400 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {compileFinalShots().map((shot, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/80 dark:border-white/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                        Shot {idx + 1} · {pipeline[idx]?.label}
                      </span>
                      <span className="text-[9px] font-mono text-gray-400">
                        {shot.prompt.split(/\s+/).length} words
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200/60 dark:border-white/5 font-mono text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                      {shot.prompt}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:text-foreground"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={executePipeline}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Launch Pipeline Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
