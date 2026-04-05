export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  userId: string;
  message: string;
  history: ChatMessage[];
  questionContext?: string;
}

export interface ChatUsage {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

export interface ChatResponse {
  reply: string;
  usage: ChatUsage;
}
