/**
 * Progress Service
 *
 * Purpose: Manage user study progress and answer tracking
 * Features:
 * - Get user progress by year
 * - Save answers to backend
 * - Track study statistics
 */

import { apiClient, UserProgress, YearProgress } from '@/lib/api/client';

/**
 * Progress service for managing study data
 */
export const progressService = {
  /**
   * Get user's full progress data
   */
  async getUserProgress(userId: string): Promise<UserProgress | null> {
    try {
      const response = await apiClient.getProgress(userId);
      return response.progress;
    } catch (error) {
      console.error('Failed to get user progress:', error);
      return null;
    }
  },

  /**
   * Get user's study progress by year
   */
  async getAllStudyProgress(userId: string): Promise<YearProgress[]> {
    try {
      const response = await apiClient.getProgress(userId);
      return response.progress.byYear;
    } catch (error) {
      console.error('Failed to get user progress:', error);
      return [];
    }
  },

  /**
   * Save a user's answer to a question
   */
  async saveAnswer(
    userId: string,
    questionId: string,
    selectedChoiceId: string,
    isCorrect: boolean
  ): Promise<void> {
    try {
      await apiClient.saveAnswer(userId, questionId, selectedChoiceId, isCorrect);
    } catch (error) {
      console.error('Failed to save answer:', error);
      // TODO: Queue for offline sync
      throw error;
    }
  },
};
