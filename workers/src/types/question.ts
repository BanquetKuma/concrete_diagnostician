export interface Question {
  id: string;
  year: number;
  number: number;
  category: string;
  text: string;
  choices: Choice[];
  correctChoiceId: string;
  explanation: string;
}

export interface Choice {
  id: string;
  text: string;
}

export interface QuestionListItem {
  id: string;
  year: number;
  number: number;
  category: string;
}

export interface YearSummary {
  year: number;
  totalQuestions: number;
}

export interface CategorySummary {
  category: string;
  label: string;
  totalQuestions: number;
}
