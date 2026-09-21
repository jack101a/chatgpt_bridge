import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Eye,
  Trash2,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  StopCircle,
  User,
  Lock,
  ChevronDown,
  Crosshair,
  RotateCcw,
} from 'lucide-react';
import { CharacterCard, DirectorState, StoryboardShot } from '../../types';
import { api } from '../../lib/api';
import { DotMatrixLoader } from '../common/DotMatrixLoader';
import { GUIDE_ANGLES, GUIDE_TABS, GuideTab } from '../../lib/guidePresets';

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

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  characters = [],
  activeCharacter = null,
  activeConvId = null,
  onSelectCharacter,
  onThreadCreated,
}) => {
  const [anchor, setAnchor] = useState('');
  const [activeTab, setActiveTab] = useState<GuideTab>('camera');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharacterCard | null>(activeCharacter);
  const [isCharDropdownOpen, setIsCharDropdownOpen] = useState(false);
  const [targetThread, setTargetThread] = useState<'current' | 'new'>(activeConvId ? 'current' : 'new');

  // Execution
  const [compiledShots, setCompiledShots] = useState<StoryboardShot[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorState | null>(null);
  const [executingError, setExecutingError] = useState<string | null>(null);

  const effectiveConvId = targetThread === 'current' ? (activeConvId || undefined) : undefined;

  // Sync on open
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt && initialPrompt !== anchor) setAnchor(initialPrompt);
      setSelectedChar(activeCharacter);
    }
  }, [isOpen, initialPrompt, activeCharacter]);

  useEffect(() => {
    setTargetThread(activeConvId ? 'current' : 'new');
  }, [activeConvId]);

  // Poll execution status
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
        } catch {
          // ignore poll errors
        }
      };
      timer = setInterval(check, 2000);
      check();
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isExecuting, onThreadCreated]);

  if (!isOpen) return null;

  const toggleAngle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Compile shots locally — zero LLM
  const compileShots = (): StoryboardShot[] => {
    const base = anchor.trim();
    return selectedIds.map((id) => {
      const angle = GUIDE_ANGLES.find((a) => a.id === id)!;
      const charPrefix = selectedChar
        ? `Photorealistic photography of ${selectedChar.name}. Maintain locked face and body identity from Turn 0.\n`
        : '';
      return {
        description: `${angle.emoji} ${angle.label}`,
        camera_pov: angle.tag,
        prompt: `${charPrefix}${base}\n${angle.tag}`,
      };
    });
  };

  const handleReview = () => {
    if (!anchor.trim() || selectedIds.length === 0) return;
    const shots = compileShots();
    setCompiledShots(shots);
    setShowReview(true);
    setExecutingError(null);
  };

  const handleAutoLaunch = async () => {
    if (!anchor.trim() || selectedIds.length === 0) return;
    const shots = compileShots();
    setCompiledShots(shots);
    setShowReview(false);
    setExecutingError(null);
    setIsExecuting(true);
    try {
      await api.executeStoryboard({
        shots,
        character_id: selectedChar ? selectedChar.id : 'freeform',
        conversation_id: effectiveConvId,
      });
    } catch (err: any) {
      setExecutingError(err.message || 'Failed to launch sequence');
      setIsExecuting(false);
    }
  };

  const handleRunFromReview = async () => {
    if (compiledShots.length === 0 || isExecuting) return;
    setIsExecuting(true);
    setExecutingError(null);
    setShowReview(false);
    try {
      await api.executeStoryboard({
        shots: compiledShots,
        character_id: selectedChar ? selectedChar.id : 'freeform',
        conversation_id: effectiveConvId,
      });
    } catch (err: any) {
      setExecutingError(err.message || 'Failed to dispatch sequence');
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    try { await api.cancelDirectorSequence(); } catch { /* ignore */ }
  };

  const handleUpdateShot = (idx: number, val: string) => {
    const updated = [...compiledShots];
    updated[idx] = { ...updated[idx], prompt: val };
    setCompiledShots(updated);
  };

  const handleDeleteShot = (idx: number) => {
    const updated = compiledShots.filter((_, i) => i !== idx);
    setCompiledShots(updated);
    if (updated.length === 0) setShowReview(false);
  };

  const clearAll = () => {
    setSelectedIds([]);
    setCompiledShots([]);
    setShowReview(false);
    setExecutingError(null);
  };

  const tabAngles = GUIDE_ANGLES.filter((a) => a.tab === activeTab);
  const canRun = anchor.trim().length > 0 && selectedIds.length > 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex sm:items-center sm:justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-[#141416] border-0 sm:border border-gray-200 dark:border-[#27272a] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-[#0d0d0d] dark:text-white">
                  POV Guide
                </h2>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full border border-amber-500/30">
                  Zero LLM
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Fixed angles · Deterministic · No AI censorship
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-24 sm:pb-6">

          {/* Thread target */}
          {activeConvId && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50/90 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/10 text-xs">
              <span className="font-semibold text-[#0d0d0d] dark:text-white">Target Chat:</span>
              <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-white/10 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTargetThread('current')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    targetThread === 'current'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >Current Chat</button>
                <button
                  type="button"
                  onClick={() => setTargetThread('new')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    targetThread === 'new'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >✦ New Chat</button>
              </div>
            </div>
          )}

          {/* Character Lock */}
          <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10">
            <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white flex items-center gap-1.5 mb-2">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              Character Lock
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCharDropdownOpen(!isCharDropdownOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  selectedChar
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedChar?.avatar_image_id ? (
                    <img
                      src={`/images/${selectedChar.avatar_image_id}`}
                      alt={selectedChar.name}
                      className="w-5 h-5 rounded-full object-cover border border-amber-500/40 shrink-0"
                    />
                  ) : (
                    <User className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{selectedChar ? selectedChar.name : '✦ No Character (Freeform)'}</span>
                </div>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>

              {isCharDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setSelectedChar(null); onSelectCharacter?.(null); setIsCharDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                      !selectedChar ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>✦ No Character (Freeform)</span>
                    {!selectedChar && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                  </button>
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedChar(c); onSelectCharacter?.(c); setIsCharDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                        selectedChar?.id === c.id
                          ? 'font-semibold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {c.avatar_image_id ? (
                          <img src={`/images/${c.avatar_image_id}`} alt={c.name} className="w-5 h-5 rounded-full object-cover border shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{c.name}</span>
                      </div>
                      {selectedChar?.id === c.id && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Anchor Prompt */}
          <div>
            <label className="block text-xs font-bold text-[#0d0d0d] dark:text-white mb-1.5 flex items-center justify-between">
              <span>Anchor Prompt *</span>
              <span className="text-[10px] text-gray-400 font-normal">Base character + scene description</span>
            </label>
            <textarea
              rows={3}
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
              placeholder={
                selectedChar
                  ? `Describe ${selectedChar.name}'s appearance, outfit, and scene setting. Angles will be appended automatically.`
                  : 'Describe your subject, outfit, and scene. Each selected angle will be appended as a separate image.'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/10 text-xs sm:text-sm text-[#0d0d0d] dark:text-white placeholder:text-gray-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 leading-relaxed resize-none"
            />
          </div>

          {/* Angle Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#0d0d0d] dark:text-white">
                Select Angles
                {selectedIds.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                    {selectedIds.length} shot{selectedIds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3 p-0.5 bg-gray-100/80 dark:bg-white/5 rounded-xl">
              {GUIDE_TABS.map((tab) => {
                const count = selectedIds.filter((id) =>
                  GUIDE_ANGLES.find((a) => a.id === id)?.tab === tab.id
                ).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-zinc-800 text-[#0d0d0d] dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span className="hidden xs:inline">{tab.label}</span>
                    {count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Angle Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tabAngles.map((angle) => {
                const isSelected = selectedIds.includes(angle.id);
                const order = selectedIds.indexOf(angle.id) + 1;
                return (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => toggleAngle(angle.id)}
                    className={`relative text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 shadow-xs'
                        : 'bg-gray-50/60 dark:bg-white/[0.02] border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {order}
                      </span>
                    )}
                    <div className="text-base mb-0.5">{angle.emoji}</div>
                    <div className={`text-[11px] font-bold ${isSelected ? 'text-amber-800 dark:text-amber-200' : 'text-[#0d0d0d] dark:text-gray-200'}`}>
                      {angle.label}
                    </div>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2 leading-tight font-mono">
                      {angle.tag.split(',')[0]}…
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {executingError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{executingError}</span>
            </div>
          )}

          {/* Execution Progress */}
          {isExecuting && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DotMatrixLoader size="sm" variant="hex" speed={1.2} />
                  <div>
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      {directorStatus?.status || 'POV Sequence Running…'}
                    </div>
                    <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                      Shot {directorStatus?.current_shot || 0} of {directorStatus?.total_shots || compiledShots.length}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop
                </button>
              </div>
              <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(((directorStatus?.current_shot || 0) / (directorStatus?.total_shots || compiledShots.length)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Shot Review */}
          {showReview && compiledShots.length > 0 && !isExecuting && (
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-[#0d0d0d] dark:text-white">
                    Review Compiled Shots ({compiledShots.length})
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">Edit before launching</span>
              </div>

              <div className="space-y-2">
                {compiledShots.map((shot, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-gray-50 dark:bg-[#18181b] border border-gray-200 dark:border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 font-mono">
                        Shot {idx + 1} · {shot.description}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteShot(idx)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={shot.prompt}
                      onChange={(e) => handleUpdateShot(idx, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#202024] border border-gray-200/80 dark:border-white/10 text-[11px] font-mono text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 resize-none leading-relaxed"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRunFromReview}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Run {compiledShots.length} Shot{compiledShots.length !== 1 ? 's' : ''} — Zero LLM
              </button>
            </div>
          )}

          {/* Launch Controls */}
          {!showReview && !isExecuting && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleAutoLaunch}
                disabled={!canRun}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                  canRun
                    ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Auto-Launch ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={!canRun}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                  canRun
                    ? 'bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-white/10 cursor-pointer active:scale-[0.99]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-transparent cursor-not-allowed'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Review & Edit
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-gray-100 dark:border-white/10 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer"
          >
            Close
          </button>
          <div className="text-[10px] text-gray-400 font-mono">
            {selectedIds.length > 0
              ? `${selectedIds.length} angle${selectedIds.length !== 1 ? 's' : ''} selected · no LLM`
              : 'Pick angles to generate shots'}
          </div>
          {isExecuting ? (
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <StopCircle className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : showReview && compiledShots.length > 0 ? (
            <button
              type="button"
              onClick={handleRunFromReview}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Run {compiledShots.length}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAutoLaunch}
              disabled={!canRun}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                canRun
                  ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-95'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Launch
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
