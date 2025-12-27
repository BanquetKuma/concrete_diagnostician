// Progress API hook
// Provides convenient functions for fetching and analyzing user progress

import {
  apiClient,
  UserProgress,
  YearProgress,
  OverallProgress,
  ApiError,
} from './client';

/**
 * Fetch overall progress for a user
 * Returns comprehensive progress data including overall stats, by year, and by category
 */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  try {
    const response = await apiClient.getProgress(userId);
    return response.progress;
  } catch (error) {
    console.error(`Failed to fetch progress for user ${userId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to fetch user progress', undefined, error);
  }
}

/**
 * Fetch progress for a specific year
 * Returns detailed question-level progress information
 */
export async function getYearProgressDetail(
  userId: string,
  year: number
): Promise<{
  year: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
  questions: {
    questionId: string;
    number: number;
    category: string;
    isAnswered: boolean;
    isCorrect: boolean;
    answeredAt: string | null;
  }[];
}> {
  try {
    return await apiClient.getYearProgress(userId, year);
  } catch (error) {
    console.error(`Failed to fetch progress for year ${year}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Failed to fetch progress for year ${year}`, undefined, error);
  }
}

/**
 * Calculate completion percentage from progress data
 */
export function calculateCompletionPercentage(progress: OverallProgress | YearProgress): number {
  if (progress.totalQuestions === 0) {
    return 0;
  }
  return Math.round((progress.answeredQuestions / progress.totalQuestions) * 100);
}

/**
 * Get unanswered questions count
 */
export function getUnansweredCount(progress: OverallProgress | YearProgress): number {
  return progress.totalQuestions - progress.answeredQuestions;
}

/**
 * Check if all questions in a year are completed
 */
export function isYearCompleted(yearProgress: YearProgress): boolean {
  return yearProgress.answeredQuestions === yearProgress.totalQuestions;
}

/**
 * Get progress summary text for display
 */
export function getProgressSummary(progress: OverallProgress | YearProgress): string {
  const completion = calculateCompletionPercentage(progress);
  const accuracy = progress.accuracy;
  return `${completion}% complete, ${accuracy}% accuracy`;
}

/**
 * Sort years by completion (least complete first for focused study)
 */
export function sortYearsByCompletion(years: YearProgress[]): YearProgress[] {
  return [...years].sort((a, b) => {
    const completionA = calculateCompletionPercentage(a);
    const completionB = calculateCompletionPercentage(b);
    return completionA - completionB;
  });
}

/**
 * Get the category with lowest accuracy (needs most improvement)
 */
export function getWeakestCategory(
  categories: UserProgress['byCategory']
): UserProgress['byCategory'][0] | null {
  if (categories.length === 0) {
    return null;
  }

  // Only consider categories with at least one answer
  const answeredCategories = categories.filter((c) => c.answeredQuestions > 0);
  if (answeredCategories.length === 0) {
    return null;
  }

  return answeredCategories.reduce((weakest, current) =>
    current.accuracy < weakest.accuracy ? current : weakest
  );
}

/**
 * Get the category with highest accuracy (strongest area)
 */
export function getStrongestCategory(
  categories: UserProgress['byCategory']
): UserProgress['byCategory'][0] | null {
  if (categories.length === 0) {
    return null;
  }

  // Only consider categories with at least one answer
  const answeredCategories = categories.filter((c) => c.answeredQuestions > 0);
  if (answeredCategories.length === 0) {
    return null;
  }

  return answeredCategories.reduce((strongest, current) =>
    current.accuracy > strongest.accuracy ? current : strongest
  );
}

/**
 * Format study streak for display
 */
export function formatStudyStreak(streak: number): string {
  if (streak === 0) {
    return 'No streak yet';
  }
  if (streak === 1) {
    return '1 day streak';
  }
  return `${streak} day streak`;
}

/**
 * Check if user studied today based on lastStudyDate
 */
export function hasStudiedToday(lastStudyDate: string | null): boolean {
  if (!lastStudyDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastStudy = new Date(lastStudyDate);
  lastStudy.setHours(0, 0, 0, 0);

  return lastStudy.getTime() === today.getTime();
}
