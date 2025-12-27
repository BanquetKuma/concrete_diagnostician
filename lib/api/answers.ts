// Answers API hook
// Provides convenient functions for saving and retrieving user answers

import { apiClient, Answer, ApiError } from './client';

/**
 * Save a user's answer to a question
 * @param userId - The user's ID
 * @param questionId - The question ID (format: gen-{category}-{number})
 * @param selectedChoice - The ID of the selected choice
 * @param isCorrect - Whether the answer was correct
 */
export async function saveAnswer(
  userId: string,
  questionId: string,
  selectedChoice: string,
  isCorrect: boolean
): Promise<Answer> {
  try {
    const response = await apiClient.saveAnswer(userId, questionId, selectedChoice, isCorrect);
    return response.answer;
  } catch (error) {
    console.error(`Failed to save answer for question ${questionId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to save answer', undefined, error);
  }
}

/**
 * Get all answers for a specific user
 * @param userId - The user's ID
 */
export async function getUserAnswers(userId: string): Promise<Answer[]> {
  try {
    const response = await apiClient.getUserAnswers(userId);
    return response.answers;
  } catch (error) {
    console.error(`Failed to fetch answers for user ${userId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to fetch user answers', undefined, error);
  }
}

/**
 * Check if a specific question has been answered by the user
 * @param answers - Array of user's answers
 * @param questionId - The question ID to check
 */
export function isQuestionAnswered(answers: Answer[], questionId: string): boolean {
  return answers.some((answer) => answer.questionId === questionId);
}

/**
 * Get the answer for a specific question if it exists
 * @param answers - Array of user's answers
 * @param questionId - The question ID to find
 */
export function getAnswerForQuestion(answers: Answer[], questionId: string): Answer | undefined {
  return answers.find((answer) => answer.questionId === questionId);
}

/**
 * Calculate accuracy from a set of answers
 * @param answers - Array of answers to calculate accuracy from
 */
export function calculateAccuracy(answers: Answer[]): number {
  if (answers.length === 0) {
    return 0;
  }
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  return Math.round((correctCount / answers.length) * 100);
}

/**
 * Filter answers by year (extracted from questionId)
 * Question IDs follow the format: gen-{category}-{number}
 * Note: Year information is not in questionId, so this requires answer metadata
 */
export function filterAnswersByCorrectness(
  answers: Answer[],
  isCorrect: boolean
): Answer[] {
  return answers.filter((answer) => answer.isCorrect === isCorrect);
}
