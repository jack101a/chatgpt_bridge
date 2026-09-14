import React, { useState } from 'react';
import {
  Maximize2,
  Download,
  Copy,
  MessageSquareShare,
  Star,
  Check,
  RotateCw,
} from 'lucide-react';
import { ChatMessage, GalleryItem } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenViewer: (item: GalleryItem) => void;
  onContinueThread: (convId: string, promptText: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenViewer,
  onContinueThread,
  onToggleFavorite,
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

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // User Message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-fade-up">
        <div className="max-w-[85%] sm:max-w-md bg-[#f4f4f5] dark:bg-[#2b2b2f] text-[#0d0d0d] dark:text-white px-4 py-2.5 rounded-2xl text-[14.5px] leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant Text Message (Errors, info)
  if (message.type === 'text') {
    return (
      <div className="flex items-start gap-3 mb-5 animate-fade-up">
        <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">
          <RotateCw size={14} />
        </div>
        <div className="flex-1 text-[14px] text-[#0d0d0d] dark:text-[#f4f4f5] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant Image Message
  return (
    <div className="flex items-start gap-3 mb-6 animate-fade-up">
      {/* OpenAI / Bridge Avatar */}
      <div className="w-7 h-7 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1635a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      </div>

      <div className="flex-1 max-w-[500px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white">Bridge AI</span>
          <span className="text-xs text-[#a1a1aa]">Here's your image.</span>
        </div>

        {/* Image Container with Expand Button */}
        <div
          className="group relative rounded-2xl overflow-hidden border border-[#e5e5e5] dark:border-[#2b2b2f] bg-[#f4f4f5] dark:bg-[#18181b] shadow-md cursor-pointer transition-all hover:shadow-xl active:scale-[0.99]"
          onClick={() => onOpenViewer(asGalleryItem)}
        >
          <img
            src={message.imageUrl}
            alt={message.content}
            className="w-full aspect-square object-cover"
            loading="lazy"
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenViewer(asGalleryItem);
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
            title="Inspect fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Metadata Strip in Monospace */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] font-mono text-[#6e6e80] dark:text-[#a1a1aa]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {message.account || 'Primary'}
            </span>
            <span>·</span>
            <span>{message.dur ? `${message.dur.toFixed(1)}s` : '—'}</span>
            <span>·</span>
            <span>{message.retries && message.retries > 1 ? `${message.retries} tries` : '1 try'}</span>
          </div>

          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(message.id)}
              className="hover:text-amber-500 transition-colors"
            >
              <Star
                size={14}
                className={message.fav ? 'text-amber-400 fill-amber-400' : ''}
              />
            </button>
          )}
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-2 mt-2.5">
          {message.conversation_id && (
            <button
              onClick={() => onContinueThread(message.conversation_id!, message.content)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5] dark:bg-[#2b2b2f] hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400 text-xs font-medium text-[#0d0d0d] dark:text-white transition-all active:scale-95"
            >
              <MessageSquareShare size={13} />
              Continue thread
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5] dark:bg-[#2b2b2f] hover:bg-gray-200 dark:hover:bg-[#38383e] text-xs font-medium text-[#6e6e80] dark:text-[#d4d4d8] transition-all active:scale-95"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy prompt'}
          </button>

          <a
            href={message.imageUrl}
            download={`bridge-${message.id}.png`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5] dark:bg-[#2b2b2f] hover:bg-gray-200 dark:hover:bg-[#38383e] text-xs font-medium text-[#6e6e80] dark:text-[#d4d4d8] transition-all active:scale-95"
          >
            <Download size={13} />
            Download
          </a>
        </div>
      </div>
    </div>
  );
};
