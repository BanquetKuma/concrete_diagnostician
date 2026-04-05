// API client for Cloudflare Workers communication

import { getApiConfig, API_ENDPOINTS } from './config';

// Import canonical types from lib/types
import type {
  ExamYear,
  CategorySummary,
  QuestionChoice,
  QuestionSource,
  Question,
  QuestionListItem,
  User,
  Answer,
  YearProgress,
  OverallProgress,
  UserProgress,
  CategoryProgress,
  ChatMessage,
  ChatResponse,
  ChatUsage,
} from '@/lib/types';
import { ApiError } from '@/lib/types';

// Re-export types for backward compatibility
export type {
  ExamYear,
  CategorySummary,
  QuestionChoice,
  QuestionSource,
  Question,
  QuestionListItem,
  User,
  Answer,
  YearProgress,
  OverallProgress,
  UserProgress,
  CategoryProgress,
  ChatMessage,
  ChatResponse,
  ChatUsage,
};
export { ApiError };

// Cache entry type
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  // In-memory cache for static data
  private cache = new Map<string, CacheEntry<unknown>>();
  private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    const config = getApiConfig();
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  // Cache helper methods
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > ApiClient.CACHE_TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Clear all cached data (useful for force refresh)
  clearCache(): void {
    this.cache.clear();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Use default error message
        }
        throw new ApiError(errorMessage, response.status, errorText);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      throw new ApiError('Network error occurred', undefined, error);
    }
  }

  // User API methods
  async registerUser(deviceId: string): Promise<{ user: User; isNew: boolean }> {
    return this.request(API_ENDPOINTS.users.register, {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
  }

  async getUser(userId: string): Promise<{ user: User }> {
    return this.request(API_ENDPOINTS.users.get(userId));
  }

  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(API_ENDPOINTS.users.delete(userId), {
      method: 'DELETE',
    });
  }

  // Question API methods
  async getExamYears(): Promise<{ years: ExamYear[] }> {
    const cacheKey = 'exam_years';
    const cached = this.getCached<{ years: ExamYear[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.request<{ years: { year: number; totalQuestions: number }[] }>(
      API_ENDPOINTS.questions.years
    );
    const result = {
      years: response.years.map((y) => ({
        year: y.year,
        totalQuestions: y.totalQuestions,
        completedQuestions: 0,
      })),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getQuestions(year: number): Promise<{ questions: QuestionListItem[] }> {
    const cacheKey = `questions_${year}`;
    const cached = this.getCached<{ questions: QuestionListItem[] }>(cacheKey);
    if (cached) return cached;

    const result = await this.request<{ questions: QuestionListItem[] }>(
      API_ENDPOINTS.questions.list(year)
    );

    this.setCache(cacheKey, result);
    return result;
  }

  async getQuestion(year: number, questionId: string): Promise<{ question: Question }> {
    return this.request(API_ENDPOINTS.questions.detail(year, questionId));
  }

  // Category-based question methods
  async getCategories(): Promise<{ categories: CategorySummary[] }> {
    const cacheKey = 'categories';
    const cached = this.getCached<{ categories: CategorySummary[] }>(cacheKey);
    if (cached) return cached;

    const result = await this.request<{ categories: CategorySummary[] }>(
      API_ENDPOINTS.questions.categories
    );

    this.setCache(cacheKey, result);
    return result;
  }

  async getQuestionsByCategory(category: string): Promise<{
    category: string;
    label: string;
    questions: QuestionListItem[];
    total: number;
  }> {
    return this.request(API_ENDPOINTS.questions.listByCategory(category));
  }

  async getQuestionByCategory(
    category: string,
    questionId: string
  ): Promise<{ question: Question; categoryLabel: string }> {
    return this.request(API_ENDPOINTS.questions.detailByCategory(category, questionId));
  }

  // Answer API methods
  async saveAnswer(
    userId: string,
    questionId: string,
    selectedChoice: string,
    isCorrect: boolean
  ): Promise<{ answer: Answer }> {
    return this.request(API_ENDPOINTS.answers.save, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        questionId,
        selectedChoice,
        isCorrect,
      }),
    });
  }

  async getUserAnswers(userId: string): Promise<{ answers: Answer[] }> {
    return this.request(API_ENDPOINTS.answers.userAnswers(userId));
  }

  async clearCategoryAnswers(
    userId: string,
    category: string
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    return this.request(API_ENDPOINTS.answers.clearByCategory(userId, category), {
      method: 'DELETE',
    });
  }

  async clearAllAnswers(
    userId: string
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    return this.request(API_ENDPOINTS.answers.clearAll(userId), {
      method: 'DELETE',
    });
  }

  // Progress API methods
  async getProgress(userId: string): Promise<{ progress: UserProgress }> {
    return this.request(API_ENDPOINTS.progress.get(userId));
  }

  async getYearProgress(
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
    return this.request(API_ENDPOINTS.progress.byYear(userId, year));
  }

  async getCategoryProgress(
    userId: string,
    category: string
  ): Promise<{
    category: string;
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    accuracy: number;
    questions: {
      questionId: string;
      number: number;
      year: number;
      isAnswered: boolean;
      isCorrect: boolean;
      answeredAt: string | null;
    }[];
  }> {
    return this.request(API_ENDPOINTS.progress.byCategory(userId, category));
  }

  // Chat API methods
  async postChat(
    userId: string,
    message: string,
    history: ChatMessage[],
    questionContext?: string
  ): Promise<ChatResponse> {
    return this.request(API_ENDPOINTS.chat.send, {
      method: 'POST',
      body: JSON.stringify({ userId, message, history, questionContext }),
    });
  }

  async getChatUsage(userId: string): Promise<{ usage: ChatUsage }> {
    return this.request(API_ENDPOINTS.chat.usage(userId));
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request(API_ENDPOINTS.health);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();