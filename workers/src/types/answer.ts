export interface AnswerRequest {
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
}

export interface AnswerResponse {
  id: number;
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
  answeredAt: string;
}
