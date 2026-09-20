import React, { useState } from 'react';
import {
  Maximize2,
  Download,
  Copy,
  MessageSquareShare,
  Check,
  Sparkles,
  Heart,
  Bot,
  Brain,
} from 'lucide-react';
import { ChatMessage, GalleryItem } from '../../types';
import { copyToClipboard } from '../../lib/api';

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenViewer: (item: GalleryItem) => void;
  onContinueThread: (convId: string, promptText: string) => void;
  onToggleFavorite?: (id: string) => void;
  onPromptWithImage?: (item: GalleryItem) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenViewer,
  onContinueThread,
  onToggleFavorite,
  onPromptWithImage,
}) => {
  const [copied, setCopied] = useState(false);

  // Convert ChatMessage to GalleryItem for viewer
  const asGalleryItem: GalleryItem = {
    id: message.id,
    url: message.imageUrl || '',
    prompt: message.content,
    tweaked_prompt: message.tweaked_prompt || null,
    tweaked_prompt_2: message.tweaked_prompt_2 || null,
    conversation_id: message.conversation_id || null,
    account_used: message.account || null,
    created_at: Date.now() / 1000,
    size_bytes: message.size || null,
    md5: null,
    duration_s: message.dur || null,
    favorite: Boolean(message.fav),
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // User Message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-fade-in w-full min-w-0">
        <div className="max-w-[85%] sm:max-w-md bg-muted text-foreground px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed border border-border shadow-xs space-y-1.5 break-words min-w-0">
          {message.referenceImage && (() => {
            const refUrl =
              message.referenceImage.startsWith('http') || message.referenceImage.startsWith('/')
                ? message.referenceImage
                : message.referenceImage.startsWith('upload_') ||
                  message.referenceImage.startsWith('edit_') ||
                  message.referenceImage.startsWith('url_')
                ? `/images/uploads/${message.referenceImage}.png`
                : `/images/${message.referenceImage}.png`;
            return (
              <div className="flex items-center gap-2 text-[11px] font-mono text-primary bg-primary/10 p-1.5 pr-2.5 rounded-xl border border-primary/20 w-fit max-w-full">
                <img
                  src={refUrl}
                  alt="Reference"
                  className="w-8 h-8 rounded-lg object-cover border border-primary/30 shrink-0 bg-background"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="truncate">ref: {message.referenceImage.replace(/^.*[\\/]/, '')}</span>
              </div>
            );
          })()}
          <div className="break-words">{message.content}</div>
        </div>
      </div>
    );
  }

  // Assistant Text Message (Errors, info, Reasoning Chat)
  if (message.type === 'text') {
    return (
      <div className="flex items-start gap-3 mb-5 animate-fade-in w-full min-w-0">
        <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
          {message.thinking ? <Brain size={15} className="text-emerald-500" /> : <Bot size={15} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Bridge AI</span>
            {message.thinking && (
              <span className="flex items-center gap-1 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Brain size={11} />
                Reasoning Mode
              </span>
            )}
            {message.account && (
              <span className="text-[10.5px] font-mono text-muted-foreground">via {message.account}</span>
            )}
          </div>
          <div className="text-[14px] text-foreground leading-relaxed break-words bg-card p-3.5 rounded-2xl border border-border/80 shadow-2xs whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant Image Message
  return (
    <div className="flex items-start gap-3 mb-6 animate-fade-in w-full min-w-0 max-w-full">
      {/* OpenAI / Bridge Avatar */}
      <div className="w-7 h-7 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
        <Sparkles size={14} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0 w-full max-w-full sm:max-w-[520px]">
        <div className="flex items-center gap-2 mb-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">Bridge AI</span>
          <span className="text-[11px] font-mono text-muted-foreground truncate">Synthesized Artwork</span>
        </div>

        {/* Image Container with Expand Button */}
        <div
          className="group relative rounded-2xl overflow-hidden border border-border bg-card shadow-md cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/30 active:scale-[0.99] w-full max-w-full"
          onClick={() => onOpenViewer(asGalleryItem)}
        >
          <img
            src={message.imageUrl}
            alt={message.content}
            className="w-full h-auto max-h-[580px] max-w-full object-contain rounded-2xl block mx-auto group-hover:scale-[1.01] transition-transform duration-300"
            loading="lazy"
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenViewer(asGalleryItem);
            }}
            className="absolute bottom-2.5 right-2.5 min-w-[38px] min-h-[38px] p-2 rounded-xl bg-black/75 hover:bg-black/90 text-white backdrop-blur-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-lg active:scale-95 flex items-center justify-center"
            title="Inspect & View Fullscreen"
            aria-label="Inspect & View Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Metadata Strip in Monospace */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] font-mono text-muted-foreground min-w-0 flex-wrap gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-primary truncate max-w-[120px]">
              {message.account || 'Primary'}
            </span>
            <span>•</span>
            <span>{message.dur ? `${message.dur.toFixed(1)}s` : '—'}</span>
            <span>•</span>
            <span>{message.retries && message.retries > 1 ? `${message.retries} tries` : '1 try'}</span>
          </div>

          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(message.id)}
              className="hover:text-rose-500 active:scale-90 transition-all p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0 rounded-lg hover:bg-muted/60"
              title={message.fav ? 'Favorited' : 'Add to favorites'}
              aria-label={message.fav ? 'Favorited' : 'Add to favorites'}
            >
              <Heart
                size={14}
                className={message.fav ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground hover:text-foreground'}
              />
            </button>
          )}
        </div>

        {/* Prompt Quote Banner */}
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground flex items-center justify-between gap-2 min-w-0 max-w-full">
          <p className="truncate font-sans text-foreground text-[12px] min-w-0 flex-1">{message.content}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1.5 -m-0.5 rounded-lg hover:text-foreground text-muted-foreground transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center active:scale-95"
            title="Copy prompt"
            aria-label="Copy prompt"
          >
            {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap min-w-0">
          {onPromptWithImage && (
            <button
              onClick={() => onPromptWithImage(asGalleryItem)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-all active:scale-95 shadow-2xs min-h-[36px] sm:min-h-[32px]"
              title="Attach this image as reference and prompt for a remix"
            >
              <Sparkles size={13} />
              Remix
            </button>
          )}

          {message.conversation_id && (
            <button
              onClick={() => onContinueThread(message.conversation_id!, message.content)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-all active:scale-95 border border-border min-h-[36px] sm:min-h-[32px]"
            >
              <MessageSquareShare size={13} />
              Continue thread
            </button>
          )}

          <a
            href={message.imageUrl}
            download={`bridge-${message.id}.png`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95 border border-border min-h-[36px] sm:min-h-[32px]"
          >
            <Download size={13} />
            Download
          </a>
        </div>
      </div>
    </div>
  );
};
