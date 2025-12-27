/**
 * Core type definitions for the concrete diagnostician exam app
 *
 * These types are the canonical source of truth and match the API contract.
 * All timestamps use ISO 8601 string format for JSON serialization compatibility.
 */

export interface User {
  id: string;
  deviceId: string;
  createdAt: string;
}

export interface QuestionChoice {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuestionSource {
  book: string;
  page: number;
  section?: string;
}

export interface Question {
  id: string;
  year: number;
  number: number;
  category: string;
  text: string;
  choices: QuestionChoice[];
  correctChoiceId: string;
  explanation: string;
  source?: QuestionSource;
}

export interface QuestionListItem {
  id: string;
  year: number;
  number: number;
  category: string;
}

export interface ExamYear {
  year: number;
  totalQuestions: number;
  completedQuestions?: number;
}

export interface CategorySummary {
  category: string;
  label: string;
  totalQuestions: number;
  completedQuestions?: number;
}

export interface Answer {
  id: number;
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
  answeredAt: string;
}

export interface YearProgress {
  year: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

export interface CategoryProgress {
  category: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

export interface OverallProgress {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyStreak: number;
  lastStudyDate: string | null;
}

export interface UserProgress {
  userId: string;
  overall: OverallProgress;
  byYear: YearProgress[];
  byCategory: CategoryProgress[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** @deprecated Use QuestionChoice instead */
export type Choice = QuestionChoice;

/** @deprecated Use Answer instead */
export type UserAnswer = Answer;

/** @deprecated Use YearProgress instead */
export type StudyProgress = YearProgress;
