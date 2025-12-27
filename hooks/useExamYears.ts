// React hook for fetching exam years data

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ExamYear } from '@/lib/api/client';
import { progressService } from '@/lib/services/progressService';
import { useUserContext } from '@/contexts/UserContext';

interface UseExamYearsReturn {
  years: ExamYear[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useExamYears = (): UseExamYearsReturn => {
  const [years, setYears] = useState<ExamYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUserContext();

  const fetchExamYears = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.getExamYears();
      
      // If user is available, merge with progress data
      if (user) {
        const progressList = await progressService.getAllStudyProgress(user.id);
        
        const yearsWithProgress = response.years.map(year => {
          const progress = progressList.find(p => p.year === year.year);
          return {
            ...year,
            completedQuestions: progress?.answeredQuestions || 0,
          };
        });
        
        setYears(yearsWithProgress);
      } else {
        setYears(response.years);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '年度データの取得に失敗しました';
      setError(errorMessage);
      console.error('Failed to fetch exam years:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchExamYears();
  }, [fetchExamYears]);

  return {
    years,
    isLoading,
    error,
    refetch: fetchExamYears,
  };
};