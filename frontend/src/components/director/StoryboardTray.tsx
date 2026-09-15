import { useState } from 'react';
import { Clapperboard, X, Play, Plus, Trash2, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { StoryboardShot } from '../../types';

interface StoryboardTrayProps {
  shots: StoryboardShot[];
  onUpdateShots: (shots: StoryboardShot[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (shots: StoryboardShot[]) => Promise<void>;
  isExecuting: boolean;
  progressStatus?: string | null;
}

export function StoryboardTray({
  shots,
  onUpdateShots,
  isOpen,
  onClose,
  onExecute,
  isExecuting,
  progressStatus,
}: StoryboardTrayProps) {
  const [autoExecute, setAutoExecute] = useState(false);

  if (!isOpen || shots.length === 0) return null;

  const handlePromptChange = (index: number, newPrompt: string) => {
    const next = [...shots];
    next[index] = { ...next[index], prompt: newPrompt };
    onUpdateShots(next);
  };

  const handleCameraChange = (index: number, newCamera: string) => {
    const next = [...shots];
    next[index] = { ...next[index], camera_pov: newCamera };
    onUpdateShots(next);
  };

  const handleDeleteShot = (index: number) => {
    const next = shots.filter((_, i) => i !== index);
    onUpdateShots(next);
  };

  const handleAddShot = () => {
    const newShot: StoryboardShot = {
      description: 'Additional scene shot',
      camera_pov: 'Medium shot',
      prompt: 'Cinematic shot of the character...',
    };
    onUpdateShots([...shots, newShot]);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] flex flex-col bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Clapperboard size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              AI Storyboard Sequence
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {shots.length} {shots.length === 1 ? 'shot' : 'shots'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500">
              Deterministic Anchor prompts ready to generate turn-by-turn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Execute Toggle */}
          <label className="hidden sm:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
            <span>Auto-Execute</span>
            <input
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
              className="toggle accent-emerald-600 cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Shots Carousel / Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
        {shots.map((shot, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <Camera size={13} className="text-emerald-500" />
                  <input
                    type="text"
                    value={shot.camera_pov}
                    onChange={(e) => handleCameraChange(idx, e.target.value)}
                    className="bg-transparent border-b border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 text-xs font-medium outline-none text-zinc-800 dark:text-zinc-200 px-1"
                    placeholder="Camera POV"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteShot(idx)}
                className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                title="Remove shot"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Editable Prompt */}
            <textarea
              value={shot.prompt}
              onChange={(e) => handlePromptChange(idx, e.target.value)}
              rows={2}
              className="w-full text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-800 dark:text-zinc-200 resize-y leading-relaxed"
              placeholder="Shot prompt..."
            />
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddShot}
          className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 hover:border-emerald-500 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus size={14} /> Add Another Shot
        </button>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          {isExecuting ? (
            <>
              <Loader2 size={14} className="animate-spin text-emerald-500" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {progressStatus || 'Executing sequence on ChatGPT bridge...'}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Shots will execute with conversational continuity across turns.</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExecuting || shots.length === 0}
            onClick={() => onExecute(shots)}
            className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Executing Sequence...
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                Run All {shots.length} Shots
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
