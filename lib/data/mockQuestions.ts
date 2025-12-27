// Mock questions data for development and testing

import { Question, QuestionChoice } from '@/lib/types';
import { generatedQuestions } from './generatedQuestions';

// Sample mock questions for 2024
export const mockQuestions2024: Question[] = [
  {
    id: '2024-q1',
    year: 2024,
    number: 1,
    category: '材料',
    text: 'コンクリートの圧縮強度に最も影響を与える要因として適切でないものはどれか。',
    choices: [
      {
        id: '2024-q1-a',
        text: '水セメント比',
        isCorrect: false,
      },
      {
        id: '2024-q1-b',
        text: 'セメントの種類',
        isCorrect: false,
      },
      {
        id: '2024-q1-c',
        text: '養生条件',
        isCorrect: false,
      },
      {
        id: '2024-q1-d',
        text: 'コンクリートの色',
        isCorrect: true,
      },
    ],
    correctChoiceId: '2024-q1-d',
    explanation: 'コンクリートの圧縮強度は、水セメント比、セメントの種類、養生条件などの技術的要因に大きく影響されますが、コンクリートの色は強度には直接影響しません。色は主に使用する骨材やセメントの種類によって決まる外観的な要素です。',
  },
  {
    id: '2024-q2',
    year: 2024,
    number: 2,
    category: '劣化',
    text: 'コンクリートの中性化について正しい説明はどれか。',
    choices: [
      {
        id: '2024-q2-a',
        text: '中性化は鉄筋の腐食を防ぐ現象である',
        isCorrect: false,
      },
      {
        id: '2024-q2-b',
        text: '中性化は大気中の二酸化炭素とコンクリート中の水酸化カルシウムが反応する現象である',
        isCorrect: true,
      },
      {
        id: '2024-q2-c',
        text: '中性化は低温で促進される',
        isCorrect: false,
      },
      {
        id: '2024-q2-d',
        text: '中性化した部分は強度が著しく低下する',
        isCorrect: false,
      },
    ],
    correctChoiceId: '2024-q2-b',
    explanation: 'コンクリートの中性化は、大気中の二酸化炭素（CO₂）とコンクリート中の水酸化カルシウム（Ca(OH)₂）が反応して炭酸カルシウム（CaCO₃）となる現象です。この反応により、コンクリートのpHが低下し、鉄筋の不動態皮膜が破壊されて腐食が開始される要因となります。',
  },
  {
    id: '2024-q3',
    year: 2024,
    number: 3,
    category: '維持管理',
    text: '鉄筋コンクリート構造物の耐久性向上のために最も効果的な対策はどれか。',
    choices: [
      {
        id: '2024-q3-a',
        text: 'かぶり厚さを大きくする',
        isCorrect: true,
      },
      {
        id: '2024-q3-b',
        text: 'コンクリートの色を濃くする',
        isCorrect: false,
      },
      {
        id: '2024-q3-c',
        text: '鉄筋の直径を小さくする',
        isCorrect: false,
      },
      {
        id: '2024-q3-d',
        text: 'セメント使用量を減らす',
        isCorrect: false,
      },
    ],
    correctChoiceId: '2024-q3-a',
    explanation: 'かぶり厚さを大きくすることは、鉄筋を外部環境から保護し、中性化や塩害から鉄筋を守る最も基本的で効果的な対策です。適切なかぶり厚さにより、コンクリートの緻密性と保護層としての機能が向上し、構造物の耐久性が大幅に向上します。',
  },
];

// Sample mock questions for 2023
export const mockQuestions2023: Question[] = [
  {
    id: '2023-q1',
    year: 2023,
    number: 1,
    category: '施工',
    text: 'フレッシュコンクリートの品質管理項目として最も適切でないものはどれか。',
    choices: [
      {
        id: '2023-q1-a',
        text: 'スランプ',
        isCorrect: false,
      },
      {
        id: '2023-q1-b',
        text: '空気量',
        isCorrect: false,
      },
      {
        id: '2023-q1-c',
        text: 'コンクリート温度',
        isCorrect: false,
      },
      {
        id: '2023-q1-d',
        text: '圧縮強度',
        isCorrect: true,
      },
    ],
    correctChoiceId: '2023-q1-d',
    explanation: 'フレッシュコンクリートの品質管理項目は、打設直後に測定できるものです。スランプ、空気量、コンクリート温度は現場で即座に測定可能ですが、圧縮強度は硬化後の試験であり、通常28日強度で評価されるため、フレッシュコンクリートの管理項目としては適切ではありません。',
  },
];

// Mock questions database
// 2024: Generated 100 questions from Gemini RAG + 3 sample questions
export const mockQuestionsDatabase = {
  2024: [...generatedQuestions, ...mockQuestions2024],
  2023: mockQuestions2023,
  2022: [], // Empty for now
  2021: [], // Empty for now
} as const;

// Helper functions
export const getQuestionsByYear = (year: number): Question[] => {
  const questions = mockQuestionsDatabase[year as keyof typeof mockQuestionsDatabase];
  return questions ? [...questions] : [];
};

export const getQuestionById = (questionId: string): Question | undefined => {
  for (const questions of Object.values(mockQuestionsDatabase)) {
    const question = questions.find(q => q.id === questionId);
    if (question) return question;
  }
  return undefined;
};