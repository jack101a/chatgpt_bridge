import { useState, useEffect, useCallback, useRef } from 'react';
import { Account, Telemetry, ChatThread, ChatMessage, ImageRequest } from '../types';
import { api } from '../lib/api';

export function useBridge() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Load initial data
  const refreshAccounts = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error('Failed to load accounts', e);
    }
  }, []);

  const refreshTelemetry = useCallback(async () => {
    try {
      const data = await api.getTelemetry();
      setTelemetry(data);
    } catch (e) {
      console.error('Failed to load telemetry', e);
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    try {
      const data = await api.getChats();
      setThreads(data);
    } catch (e) {
      console.error('Failed to load threads', e);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/events`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'generation_progress') {
            setProgressStatus(msg.status || 'Generating…');
            if (msg.retry) setRetryCount(msg.retry);
          } else if (msg.type === 'account_switched') {
            refreshAccounts();
            refreshTelemetry();
          } else if (msg.type === 'generation_done') {
            refreshThreads();
          }
        } catch (err) {
          console.error('WS parse error', err);
        }
      };
    }

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [refreshAccounts, refreshTelemetry, refreshThreads]);

  useEffect(() => {
    refreshAccounts();
    refreshTelemetry();
    refreshThreads();
    const interval = setInterval(refreshTelemetry, 15000);
    return () => clearInterval(interval);
  }, [refreshAccounts, refreshTelemetry, refreshThreads]);

  // Load thread history when activeConvId changes
  const selectThread = useCallback(async (convId: string | null) => {
    setActiveConvId(convId);
    if (!convId) {
      setMessages([]);
      return;
    }
    try {
      const galleryData = await api.getGallery({ conversation_id: convId, limit: 50 });
      const threadMessages: ChatMessage[] = [...galleryData.items].reverse().map((img) => ({
        id: img.id,
        role: 'assistant',
        type: 'image',
        content: img.prompt || '',
        imageUrl: img.url,
        account: img.account_used || undefined,
        dur: img.duration_s || undefined,
        size: img.size_bytes || undefined,
        conversation_id: img.conversation_id || undefined,
        fav: img.favorite,
        tweaked_prompt: img.tweaked_prompt,
        tweaked_prompt_2: img.tweaked_prompt_2,
      }));
      setMessages(threadMessages);
    } catch (e) {
      console.error('Failed to load thread messages', e);
    }
  }, []);

  // Send a generation request
  const generate = useCallback(
    async (req: ImageRequest) => {
      if (isGenerating || !req.prompt.trim()) return;

      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          type: 'text',
          content: req.prompt,
          referenceImage: req.reference_image || undefined,
        },
      ]);

      setIsGenerating(true);
      setProgressStatus('Submitting prompt to engine…');
      setRetryCount(1);

      try {
        const result = await api.generateImage({
          ...req,
          conversation_id: req.conversation_id || activeConvId || undefined,
        });

        const botMsgId = result.image_url?.match(/\/images\/([^/]+)\.\w+$/)?.[1] || `gen-${Date.now()}`;
        const newMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          type: 'image',
          content: req.prompt,
          imageUrl: result.image_url,
          account: result.account_used,
          dur: result.duration_s,
          size: result.size_bytes,
          conversation_id: result.conversation_id,
          retries: result.retries || 1,
          tweaked_prompt: req.tweaked_prompt,
          tweaked_prompt_2: req.tweaked_prompt_2,
        };

        if (result.conversation_id && !activeConvId) {
          setActiveConvId(result.conversation_id);
        }

        setMessages((prev) => [...prev, newMsg]);
        refreshThreads();
        refreshTelemetry();
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            type: 'text',
            content: `Failed: ${err.message || 'Unknown error during generation'}`,
          },
        ]);
      } finally {
        setIsGenerating(false);
        setProgressStatus(null);
      }
    },
    [activeConvId, isGenerating, refreshTelemetry, refreshThreads]
  );

  const refreshChat = useCallback(async () => {
    await Promise.all([
      refreshThreads(),
      refreshAccounts(),
      activeConvId ? selectThread(activeConvId) : Promise.resolve(),
    ]);
  }, [refreshThreads, refreshAccounts, selectThread, activeConvId]);

  const newChat = useCallback(() => {
    selectThread(null);
  }, [selectThread]);

  return {
    accounts,
    telemetry,
    threads,
    activeConvId,
    messages,
    isGenerating,
    progressStatus,
    retryCount,
    wsConnected,
    selectThread,
    newChat,
    generate,
    refreshAccounts,
    refreshTelemetry,
    refreshThreads,
    refreshChat,
  };
}
