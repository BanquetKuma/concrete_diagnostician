/**
 * Global chat state provider so the conversation persists across
 * tab switches and navigation to question screens and back.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useChatbot, UseChatbotResult } from '@/hooks/useChatbot';

const ChatContext = createContext<UseChatbotResult | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChatbot();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): UseChatbotResult {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return ctx;
}
