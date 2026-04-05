/**
 * Session-only chat state management. History is kept in memory and
 * cleared when the screen unmounts or the user resets the conversation.
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ChatMessage, ChatUsage } from '@/lib/types';
import { useUserContext } from '@/contexts/UserContext';

export interface UseChatbotResult {
  messages: ChatMessage[];
  usage: ChatUsage | null;
  isSending: boolean;
  error: string | null;
  rateLimited: boolean;
  sendMessage: (text: string, questionContext?: string) => Promise<void>;
  resetConversation: () => void;
}

export function useChatbot(): UseChatbotResult {
  const { user } = useUserContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const sendMessage = useCallback(
    async (text: string, questionContext?: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (!user?.id) {
        setError('ユーザー情報を取得できませんでした');
        return;
      }

      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      const historyBefore = messages;
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      try {
        const res = await apiClient.postChat(
          user.id,
          trimmed,
          historyBefore,
          questionContext
        );
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.reply },
        ]);
        setUsage(res.usage);
        setRateLimited(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '送信に失敗しました';
        // Detect rate limit by status code in the error
        const isRateLimit =
          err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          (err as { statusCode?: number }).statusCode === 429;
        if (isRateLimit) {
          setRateLimited(true);
          setError('送信上限に達しました。しばらく時間を置いてお試しください。');
        } else {
          setError(message);
        }
        // Roll back the optimistic user message
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages, user?.id]
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setRateLimited(false);
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
