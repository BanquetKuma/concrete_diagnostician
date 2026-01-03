/**
 * Hook for checking question access based on subscription status
 * Free users can access the first 40% of questions in each category
 * Pro members can access all questions
 */

import { useCallback } from 'react';
import { useRevenueCat } from './useRevenueCat';
import { isQuestionLocked, getFreeQuestionLimit } from '@/constants/Categories';

export function useQuestionAccess() {
  const { isProMember, isLoading } = useRevenueCat();

  /**
   * Check if user can access a specific question
   * @param category - The category of the question
   * @param questionNumber - The question number within the category
   * @returns true if the question is accessible
   */
  const canAccessQuestion = useCallback(
    (category: string, questionNumber: number): boolean => {
      // Pro members can access all questions
      if (isProMember) return true;

      // Free users can only access unlocked questions
      return !isQuestionLocked(category, questionNumber);
    },
    [isProMember]
  );

  /**
   * Check if a question is locked for free users
   * @param category - The category of the question
   * @param questionNumber - The question number within the category
   * @returns true if the question requires Pro membership
   */
  const isLocked = useCallback(
    (category: string, questionNumber: number): boolean => {
      if (isProMember) return false;
      return isQuestionLocked(category, questionNumber);
    },
    [isProMember]
  );

  /**
   * Get the free question limit for a category
   */
  const getFreeLimitForCategory = useCallback(
    (category: string): number => {
      return getFreeQuestionLimit(category);
    },
    []
  );

  return {
    canAccessQuestion,
    isLocked,
    getFreeLimitForCategory,
    isProMember,
    isLoading,
  };
}
