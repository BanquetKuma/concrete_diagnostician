/**
 * Hook for checking AI chat access.
 * Only Premium members (entitlement = 'premium') can use the chatbot.
 */

import { useRevenueCat } from './useRevenueCat';

export function useChatAccess() {
  const { isPremiumMember, isLoading } = useRevenueCat();

  return {
    canAccessChat: isPremiumMember,
    isPremiumMember,
    isLoading,
  };
}
