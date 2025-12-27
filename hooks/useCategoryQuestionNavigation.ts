// React hook for category-based question navigation logic

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient, QuestionListItem } from '@/lib/api/client';

interface UseCategoryQuestionNavigationReturn {
  questions: QuestionListItem[];
  currentIndex: number;
  currentQuestion: QuestionListItem | null;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoading: boolean;
  error: string | null;
  goToNext: () => string | null; // Returns next question ID or null
  goToPrevious: () => string | null; // Returns previous question ID or null
  goToIndex: (index: number) => string | null;
  totalQuestions: number;
}

export const useCategoryQuestionNavigation = (
  category: string,
  currentQuestionId: string
): UseCategoryQuestionNavigationReturn => {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getQuestionsByCategory(category);
      setQuestions(response.questions);

      // Find current question index
      const index = response.questions.findIndex(q => q.id === currentQuestionId);
      if (index >= 0) {
        setCurrentIndex(index);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '問題データの取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [category, currentQuestionId]);

  useEffect(() => {
    if (category && currentQuestionId) {
      fetchQuestions();
    }
  }, [fetchQuestions, category, currentQuestionId]);

  const goToNext = useCallback((): string | null => {
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      return questions[nextIndex].id;
    }
    return null;
  }, [currentIndex, questions]);

  const goToPrevious = useCallback((): string | null => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      return questions[prevIndex].id;
    }
    return null;
  }, [currentIndex, questions]);

  const goToIndex = useCallback((index: number): string | null => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      return questions[index].id;
    }
    return null;
  }, [questions]);

  // Memoize computed values for performance
  const computedValues = useMemo(() => ({
    currentQuestion: questions[currentIndex] || null,
    hasNext: currentIndex < questions.length - 1,
    hasPrevious: currentIndex > 0,
    totalQuestions: questions.length,
  }), [questions, currentIndex]);

  return {
    questions,
    currentIndex,
    ...computedValues,
    isLoading,
    error,
    goToNext,
    goToPrevious,
    goToIndex,
  };
};
