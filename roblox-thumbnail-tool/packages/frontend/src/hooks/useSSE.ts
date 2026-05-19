// =============================================================================
// src/hooks/useSSE.ts — Server-Sent Events Hook
// =============================================================================

import { useEffect, useState } from 'react';

interface SSEOptions {
  url: string;
  onMessage?: (data: any) => void;
  enabled?: boolean;
}

export function useSSE({ url, onMessage, enabled = true }: SSEOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    setStatus('connecting');
    // We add a timestamp to prevent caching issues in some browsers
    const sseUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
        if (onMessage) {
          onMessage(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error', error);
      setStatus('disconnected');
      // EventSource auto-reconnects, but we can close it if we want manual control
      // eventSource.close();
    };

    return () => {
      eventSource.close();
      setStatus('disconnected');
    };
  }, [url, enabled]);

  return { status, lastEvent };
}
