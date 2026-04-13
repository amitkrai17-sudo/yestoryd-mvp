'use client';

// ============================================================
// FILE: lib/hooks/useChatStream.ts
// ============================================================
// Shared chat streaming hook for rAI clients.
// Owns: messages state, statusMessage, isSending, send().
// Wraps: fetch /api/chat + readChatSSE + onChunk/onResponse/onDone/onError.
//
// Used by:
//   - app/parent/rai/page.tsx (inline WhatsApp-style chat)
//   - components/chat/ChatWidget.tsx (floating popup)
//
// Each caller renders its own bubbles/UI; this hook only manages state.
// ============================================================

import { useState } from 'react';
import { readChatSSE } from '@/lib/rai/sse-client';

export interface ChatStreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface UseChatStreamOptions {
  userRole: 'parent' | 'coach' | 'admin';
  userEmail: string;
  childId?: string;
  /** Called when SSE emits a `children` event (needs-child-selection flow). */
  onChildren?: (children: Array<{ id: string; name: string }>) => void;
  /** Called on successful send, after the full response has been assembled. */
  onMessageSent?: (fullText: string) => void;
  /** Called on any send failure (SSE error, thrown fetch, non-OK). Receives the user's input. */
  onSendError?: (failedContent: string) => void;
}

export interface UseChatStreamResult {
  messages: ChatStreamMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatStreamMessage[]>>;
  statusMessage: string | null;
  isSending: boolean;
  /** Send a message. Optional childIdOverride wins over options.childId. */
  send: (content: string, childIdOverride?: string) => Promise<void>;
}

export function useChatStream(options: UseChatStreamOptions): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatStreamMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const send = async (content: string, childIdOverride?: string): Promise<void> => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setStatusMessage(null);

    const userMsg: ChatStreamMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = `a_${Date.now() + 1}`;
    let hasStartedStreaming = false;
    let fullText = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          childId: childIdOverride ?? options.childId,
          userRole: options.userRole,
          userEmail: options.userEmail,
          // Intentionally use the pre-userMsg snapshot — server doesn't want the just-sent message in history.
          chatHistory: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      fullText = await readChatSSE(res, {
        onStatus: (msg) => setStatusMessage(msg),

        onChunk: (chunk) => {
          if (!hasStartedStreaming) {
            hasStartedStreaming = true;
            setStatusMessage(null);
            setMessages(prev => [...prev, {
              id: assistantId,
              role: 'assistant',
              content: chunk,
              timestamp: new Date(),
              isStreaming: true,
            }]);
          } else {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ));
          }
        },

        onResponse: (responseContent) => {
          hasStartedStreaming = true;
          setStatusMessage(null);
          setMessages(prev => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date(),
          }]);
        },

        onChildren: (children) => {
          options.onChildren?.(children);
        },

        onDone: () => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          ));
          setStatusMessage(null);
        },

        onError: (errorMsg) => {
          setStatusMessage(null);
          if (!hasStartedStreaming) {
            setMessages(prev => [...prev, {
              id: assistantId,
              role: 'assistant',
              content: errorMsg,
              timestamp: new Date(),
              isError: true,
            }]);
          }
          options.onSendError?.(trimmed);
        },
      });

      if (fullText) {
        options.onMessageSent?.(fullText);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      setStatusMessage(null);
      if (!hasStartedStreaming) {
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
          isError: true,
        }]);
      }
      options.onSendError?.(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  return { messages, setMessages, statusMessage, isSending, send };
}
