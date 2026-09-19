import React, { useState } from 'react';
import { Sparkles, Wand2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { CuratedPrompt } from '../../types';

interface PromptCardProps {
  prompt: CuratedPrompt;
  onSelect: (prompt: CuratedPrompt) => void;
  onUse: (prompt: CuratedPrompt, enhance?: boolean) => void;
  onTagClick?: (tag: string, type: 'category' | 'style' | 'scene') => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onSelect,
  onUse,
  onTagClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleUse = (e: React.MouseEvent, enhance: boolean = false) => {
    e.stopPropagation();
    onUse(prompt, enhance);
  };

  return (
    <div
      onClick={() => onSelect(prompt)}
      className="group relative flex flex-col rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-200 overflow-hidden cursor-pointer shadow-xs hover:shadow-md text-left select-none"
    >
      {/* Thumbnail Aspect Box */}
      <div className="relative w-full aspect-4/3 bg-muted/50 overflow-hidden">
        {!imageError ? (
          <img
            src={prompt.thumbnail}
            alt={prompt.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-muted-foreground bg-gradient-to-br from-muted to-muted/80">
            <ImageIcon size={22} className="opacity-40 mb-1" />
            <span className="text-[10px] font-mono text-center line-clamp-2 px-1 opacity-70">
              {prompt.category}
            </span>
          </div>
        )}

        {/* Source Badge & Category Pill */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
          <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-semibold bg-black/60 text-white backdrop-blur-xs shadow-xs truncate max-w-[120px]">
            {prompt.category}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-wider font-bold backdrop-blur-xs shadow-xs ${
              prompt.source === 'freestylefly'
                ? 'bg-emerald-600/80 text-white'
                : 'bg-blue-600/80 text-white'
            }`}
          >
            {prompt.source === 'freestylefly' ? '32k★' : '17k★'}
          </span>
        </div>

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 backdrop-blur-2xs">
          <button
            type="button"
            onClick={(e) => handleUse(e, false)}
            className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-emerald-600 text-primary-foreground text-xs font-semibold shadow-md flex items-center gap-1 active:scale-95 transition-transform min-h-[32px]"
            title="Use this verbatim prompt in composer"
          >
            <Sparkles size={13} />
            <span>Use</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleUse(e, true)}
            className="px-2 py-1.5 rounded-lg bg-card/90 hover:bg-card text-foreground text-xs font-semibold shadow-md flex items-center gap-1 active:scale-95 transition-transform min-h-[32px]"
            title="Use and enhance with AI wand"
          >
            <Wand2 size={13} className="text-primary" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-card/90 hover:bg-card text-foreground shadow-md active:scale-95 transition-transform min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Copy prompt text"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5 bg-card">
        <div>
          <h4 className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {prompt.title}
          </h4>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed font-sans">
            {prompt.prompt}
          </p>
        </div>

        {/* Tags Row */}
        <div className="flex items-center gap-1 overflow-hidden pt-1 flex-wrap">
          {prompt.styles?.slice(0, 2).map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(s, 'style');
              }}
              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              #{s}
            </button>
          ))}
          {prompt.scenes?.slice(0, 1).map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(sc, 'scene');
              }}
              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              @{sc}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
