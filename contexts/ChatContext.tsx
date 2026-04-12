/**
 * Global chat state provider so the conversation persists across
 * tab switches and navigation to question screens and back.
 *
 * Automatically resets the conversation when the Clerk user changes
 * (login, logout, account deletion) to prevent leaking chat history
 * between different users on the same device.
 */

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useChatbot, UseChatbotResult } from '@/hooks/useChatbot';

const ChatContext = createContext<UseChatbotResult | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChatbot();
  const { userId } = useAuth();
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    // Reset chat when user changes (logout, login as different user, account deletion)
    if (prevUserIdRef.current !== userId) {
      chat.resetConversation();
      prevUserIdRef.current = userId;
    }
  }, [userId]);

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): UseChatbotResult {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return ctx;
}
