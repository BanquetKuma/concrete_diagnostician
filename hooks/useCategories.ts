// React hook for fetching category data with progress

import { useState, useEffect, useCallback } from 'react';
import { apiClient, CategorySummary } from '@/lib/api/client';
import { useUserContext } from '@/contexts/UserContext';
import { sortByCategory } from '@/constants/Categories';

interface CategoryWithProgress extends CategorySummary {
  completedQuestions: number;
}

interface UseCategoriesReturn {
  categories: CategoryWithProgress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<CategoryWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUserContext();

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Parallel API calls for better performance
      const [categoriesResponse, progressResponse] = await Promise.all([
        apiClient.getCategories(),
        user ? apiClient.getProgress(user.id) : Promise.resolve(null),
      ]);

      // Merge with progress data if available
      if (progressResponse) {
        const categoryProgress = progressResponse.progress.byCategory;

        const categoriesWithProgress = categoriesResponse.categories.map((cat) => {
          const progress = categoryProgress.find((p) => p.category === cat.category);
          return {
            ...cat,
            completedQuestions: progress?.answeredQuestions || 0,
          };
        });

        setCategories(sortByCategory(categoriesWithProgress));
      } else {
        const categoriesWithDefaults = categoriesResponse.categories.map((cat) => ({
          ...cat,
          completedQuestions: 0,
        }));
        setCategories(sortByCategory(categoriesWithDefaults));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分野データの取得に失敗しました';
      setError(errorMessage);
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
  };
};
