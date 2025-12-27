export interface YearProgress {
  year: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number; // パーセンテージ (0-100)
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
  studyStreak: number; // 連続学習日数
  lastStudyDate: string | null;
}

export interface UserProgress {
  userId: string;
  overall: OverallProgress;
  byYear: YearProgress[];
  byCategory: CategoryProgress[];
}
