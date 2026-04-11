/**
 * Build a rich context string that the AI chat will receive as the
 * system prompt augmentation when the user asks the assistant about
 * a specific question.
 */

import type { Question } from '@/lib/types';

export function buildQuestionContext(
  question: Question,
  selectedChoiceId: string | null,
  isAnswered: boolean
): string {
  const lines: string[] = [];

  lines.push('【問題文】');
  lines.push(question.text);
  lines.push('');

  lines.push('【選択肢】');
  question.choices.forEach((choice) => {
    const marker = choice.isCorrect ? '◯' : '・';
    lines.push(`${marker} ${choice.id}. ${choice.text}`);
  });
  lines.push('');

  const correct = question.choices.find((c) => c.id === question.correctChoiceId);
  if (correct) {
    lines.push(`【正解】${correct.id}. ${correct.text}`);
    lines.push('');
  }

  if (isAnswered && selectedChoiceId) {
    const selected = question.choices.find((c) => c.id === selectedChoiceId);
    if (selected) {
      const result = selected.isCorrect ? '正解' : '不正解';
      lines.push(`【学習者の解答】${selected.id}. ${selected.text}（${result}）`);
      lines.push('');
    }
  }

  if (question.explanation) {
    lines.push('【解説】');
    lines.push(question.explanation);
  }

  return lines.join('\n');
}
