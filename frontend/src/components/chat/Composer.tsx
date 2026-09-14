import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, ArrowUp, Sparkles, X, Image as ImageIcon } from 'lucide-react';
import { ImageRequest } from '../../types';

interface ComposerProps {
  onSend: (req: ImageRequest) => void;
  isGenerating: boolean;
  activeConvId: string | null;
  onClearThread: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  isGenerating,
  activeConvId,
  onClearThread,
}) => {
  const [promptText, setPromptText] = useState('');
  const [aspect, setAspect] = useState<'1:1' | '3:4' | '16:9'>('1:1');
  const [showLayers, setShowLayers] = useState(false);
  const [layer1, setLayer1] = useState('');
  const [layer2, setLayer2] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [promptText]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating || !promptText.trim()) return;

    onSend({
      prompt: promptText.trim(),
      aspect,
      tweaked_prompt: layer1.trim() || null,
      tweaked_prompt_2: layer2.trim() || null,
      conversation_id: activeConvId || null,
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

        {/* ── Top Controls: Aspect Ratios + Continuity Badge ── */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {(['1:1', '3:4', '16:9'] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspect(ratio)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  aspect === ratio
                    ? 'bg-[#0d0d0d] text-white dark:bg-white dark:text-black'
                    : 'bg-[#f4f4f5] dark:bg-[#2b2b2f] text-[#6e6e80] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white'
                }`}
              >
                {ratio}
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
            placeholder="Describe what you want to create…"
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
      </div>

      <p className="text-center text-[10.5px] text-[#a1a1aa] dark:text-[#71717a] mt-1.5 tracking-tight">
        Powered by your self-hosted infrastructure. More control. More creativity.
      </p>
    </div>
  );
};
