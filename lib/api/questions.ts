// Questions API hook
// Provides convenient functions for fetching exam years and questions

import { apiClient, ExamYear, Question, QuestionListItem, ApiError } from './client';

/**
 * Fetch all available exam years with question counts
 */
export async function getExamYears(): Promise<ExamYear[]> {
  try {
    const response = await apiClient.getExamYears();
    return response.years;
  } catch (error) {
    console.error('Failed to fetch exam years:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to fetch exam years', undefined, error);
  }
}

/**
 * Fetch question list for a specific year
 * Returns lightweight question metadata (id, number, category)
 */
export async function getQuestionsByYear(year: number): Promise<QuestionListItem[]> {
  try {
    const response = await apiClient.getQuestions(year);
    return response.questions;
  } catch (error) {
    console.error(`Failed to fetch questions for year ${year}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Failed to fetch questions for year ${year}`, undefined, error);
  }
}

/**
 * Fetch full question details including text, choices, and explanation
 * @param year - The exam year
 * @param questionId - The question ID (format: gen-{category}-{number})
 */
export async function getQuestionDetail(
  year: number,
  questionId: string
): Promise<Question> {
  try {
    const response = await apiClient.getQuestion(year, questionId);
    return response.question;
  } catch (error) {
    console.error(`Failed to fetch question ${questionId} for year ${year}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Failed to fetch question ${questionId}`, undefined, error);
  }
}

/**
 * Get the next question ID in sequence
 * Useful for navigation between questions
 */
export function getNextQuestionId(
  questions: QuestionListItem[],
  currentQuestionId: string
): string | null {
  const currentIndex = questions.findIndex((q) => q.id === currentQuestionId);
  if (currentIndex === -1 || currentIndex >= questions.length - 1) {
    return null;
  }
  return questions[currentIndex + 1].id;
}

/**
 * Get the previous question ID in sequence
 * Useful for navigation between questions
 */
export function getPreviousQuestionId(
  questions: QuestionListItem[],
  currentQuestionId: string
): string | null {
  const currentIndex = questions.findIndex((q) => q.id === currentQuestionId);
  if (currentIndex <= 0) {
    return null;
  }
  return questions[currentIndex - 1].id;
}

/**
 * Get question number from question ID
 * Extracts the numeric portion from IDs like "gen-materials-001"
 */
export function getQuestionNumber(questionId: string): number {
  const match = questionId.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}
