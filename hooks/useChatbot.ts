/**
 * Session-only chat state management with SSE streaming support.
 * History is kept in memory and cleared when the screen unmounts
 * or the user resets the conversation.
 */

import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ChatMessage, ChatUsage } from '@/lib/types';
import { useUserContext } from '@/contexts/UserContext';

export interface UseChatbotResult {
  messages: ChatMessage[];
  usage: ChatUsage | null;
  isSending: boolean;
  error: string | null;
  rateLimited: boolean;
  sendMessage: (text: string, questionContext?: string) => void;
  resetConversation: () => void;
}

export function useChatbot(): UseChatbotResult {
  const { user } = useUserContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const streamRef = useRef<{ close: () => void } | null>(null);

  const sendMessage = useCallback(
    (text: string, questionContext?: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (!user?.id) {
        setError('ユーザー情報を取得できませんでした');
        return;
      }

      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
      const historyBefore = messages;

      // Add user message + empty assistant placeholder
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsSending(true);
      setError(null);

      const stream = apiClient.postChatStream(
        user.id,
        trimmed,
        historyBefore,
        questionContext,
        {
          onChunk: (chunk: string) => {
            // Append chunk to the last (assistant) message
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              }
              return updated;
            });
          },
          onDone: (newUsage: ChatUsage) => {
            setUsage(newUsage);
            setRateLimited(false);
            setIsSending(false);
            streamRef.current = null;
          },
          onError: (message: string) => {
            const isRateLimit = message.includes('上限');
            if (isRateLimit) {
              setRateLimited(true);
            }
            setError(message);
            // Remove the empty assistant placeholder on error
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last.content === '') {
                return prev.slice(0, -1);
              }
              return prev;
            });
            setIsSending(false);
            streamRef.current = null;
          },
        }
      );

      streamRef.current = stream;
    },
    [isSending, messages, user?.id]
  );

  const resetConversation = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setMessages([]);
    setError(null);
    setRateLimited(false);
    setIsSending(false);
  }, []);

  return {
    messages,
    usage,
    isSending,
    error,
    rateLimited,
    sendMessage,
    resetConversation,
  };
}
