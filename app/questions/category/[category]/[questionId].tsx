// Individual question screen with answer functionality (category-based)

import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LoadingView } from '@/components/ui/LoadingView';
import { ErrorView } from '@/components/ui/ErrorView';
import { apiClient, Question, QuestionChoice } from '@/lib/api/client';
import { progressService } from '@/lib/services/progressService';
import { useUserContext } from '@/contexts/UserContext';
import { useCategoryQuestionNavigation } from '@/hooks/useCategoryQuestionNavigation';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useQuestionAccess } from '@/hooks/useQuestionAccess';

export default function CategoryQuestionScreen() {
  const { category, questionId } = useLocalSearchParams<{
    category: string;
    questionId: string;
  }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUserContext();
  const { isLocked, getFreeLimitForCategory } = useQuestionAccess();

  const navigation = useCategoryQuestionNavigation(
    category || '',
    questionId || ''
  );

  const [question, setQuestion] = useState<Question | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const fetchQuestion = async () => {
      if (!category || !questionId) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.getQuestionByCategory(category, questionId);
        setQuestion(response.question);
        setCategoryLabel(response.categoryLabel);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '問題データの取得に失敗しました';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestion();
  }, [category, questionId]);

  // アクセス権チェック：ロックされた問題の場合はサブスクリプション画面へ
  useEffect(() => {
    if (question && category && isLocked(category, question.number)) {
      const freeLimit = getFreeLimitForCategory(category);
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `この問題はProプラン限定です。\n\n${categoryLabel}分野では問題1〜${freeLimit}が無料でご利用いただけます。\n\nアップグレード画面に移動しますか？`
        );
        if (confirmed) {
          router.push('/subscription');
        } else {
          router.push({
            pathname: '/questions/category/[category]' as const,
            params: { category: category as string }
          } as never);
        }
      } else {
        Alert.alert(
          'Proプラン限定',
          `この問題はProプラン限定です。\n\n${categoryLabel}分野では問題1〜${freeLimit}が無料でご利用いただけます。`,
          [
            {
              text: '問題一覧に戻る',
              style: 'cancel',
              onPress: () => router.push({
                pathname: '/questions/category/[category]' as const,
                params: { category: category as string }
              } as never),
            },
            {
              text: 'アップグレード',
              onPress: () => router.push('/subscription'),
            },
          ]
        );
      }
    }
  }, [question, category, categoryLabel, isLocked, getFreeLimitForCategory, router]);

  const handleChoiceSelect = async (choiceId: string) => {
    if (isAnswered || !question) return;

    // UI更新は常に実行（回答を表示）
    setSelectedChoiceId(choiceId);
    setIsAnswered(true);
    setShowExplanation(true);

    const isCorrect = choiceId === question.correctChoiceId;

    // 進捗保存はuserがある場合のみ
    if (user) {
      try {
        await progressService.saveAnswer(
          user.id,
          questionId as string,
          choiceId,
          isCorrect
        );
      } catch (error) {
        console.error('Failed to save answer:', error);
      }
    }
  };

  const handleBackPress = () => {
    // Navigate explicitly to question list instead of using router.back()
    // to ensure consistent navigation behavior
    router.push({
      pathname: '/questions/category/[category]' as const,
      params: { category: category as string }
    } as never);
  };

  const handleNextQuestion = () => {
    const nextQuestionId = navigation.goToNext();
    if (nextQuestionId && category) {
      router.push({
        pathname: '/questions/category/[category]/[questionId]' as const,
        params: { category: category as string, questionId: nextQuestionId }
      } as never);
    } else {
      Alert.alert('完了', 'すべての問題が完了しました！', [
        {
          text: '問題一覧に戻る',
          onPress: () => router.push({
            pathname: '/questions/category/[category]' as const,
            params: { category: category as string }
          } as never),
        },
        {
          text: 'ホームに戻る',
          onPress: () => router.push('/(tabs)'),
        },
      ]);
    }
  };

  const handlePreviousQuestion = () => {
    const prevQuestionId = navigation.goToPrevious();
    if (prevQuestionId && category) {
      router.push({
        pathname: '/questions/category/[category]/[questionId]' as const,
        params: { category: category as string, questionId: prevQuestionId }
      } as never);
    }
  };

  const getChoiceStyle = useCallback((choice: QuestionChoice) => {
    const baseStyle = [
      styles.choiceButton,
      { backgroundColor: colors.card, borderColor: colors.border },
    ];

    if (!isAnswered) {
      return baseStyle;
    }

    if (choice.id === selectedChoiceId) {
      // Selected choice
      if (choice.isCorrect) {
        return [
          ...baseStyle,
          { backgroundColor: '#34C759', borderColor: '#34C759' },
        ];
      } else {
        return [
          ...baseStyle,
          { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
        ];
      }
    } else if (choice.isCorrect) {
      // Correct choice (not selected)
      return [
        ...baseStyle,
        { backgroundColor: '#34C759', borderColor: '#34C759' },
      ];
    }

    return baseStyle;
  }, [colors.card, colors.border, isAnswered, selectedChoiceId]);

  const getChoiceTextColor = useCallback((choice: QuestionChoice) => {
    if (!isAnswered) {
      return colors.text;
    }

    if (choice.id === selectedChoiceId || choice.isCorrect) {
      return '#FFFFFF';
    }

    return colors.text;
  }, [colors.text, isAnswered, selectedChoiceId]);

  // Memoized explanation processing to avoid re-parsing on every render
  const processedExplanation = useMemo(() => {
    if (!question?.explanation) return { parts: [], inlineReference: null };

    const text = question.explanation;
    // インライン参照を抽出（全角・半角括弧両対応）
    const referencePattern = /[（(]参照[：:].*?[）)]\s*$/;
    const referenceMatch = text.match(referencePattern);
    const inlineReference = referenceMatch ? referenceMatch[0] : null;
    const textWithoutRef = inlineReference ? text.replace(referencePattern, '').trim() : text;

    // 改行で分割し、空行を除去
    const lines = textWithoutRef.split('\n').filter(line => line.trim());

    // 各行がすでに【正解】や【誤り】で始まっている場合はそのまま返す
    if (lines.length > 1 && lines.some(line => line.trim().startsWith('【誤り】'))) {
      return { parts: lines, inlineReference };
    }

    // 【正解】と【誤り】で分割（全角・半角両対応）
    const sections = textWithoutRef.split(/(?=【正解】|【誤り】|\[正解\]|\[誤り\])/);
    const result: string[] = [];

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // 【誤り】セクションで複数の回答が含まれているかチェック
      if (trimmed.startsWith('【誤り】') || trimmed.startsWith('[誤り]')) {
        // 「。」の後に「a:」「b:」等が続くパターンを検出して分割
        const withSeparators = trimmed.replace(/。([a-dａ-ｄ][：:])/g, '。\n【誤り】$1');
        const parts = withSeparators.split('\n');
        result.push(...parts.filter(p => p.trim()));
      } else {
        result.push(trimmed);
      }
    }

    return { parts: result, inlineReference };
  }, [question?.explanation]);

  if (isLoading) {
    return <LoadingView message="問題を読み込み中..." />;
  }

  if (error || !question) {
    return (
      <ErrorView
        message="エラーが発生しました"
        details={error || '問題が見つかりません'}
        onRetry={handleBackPress}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.content}>
        {/* Header */}
        <ThemedView style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="問題一覧へ戻る"
          >
            <ThemedText style={styles.backButtonText}>問題一覧へ戻る</ThemedText>
          </TouchableOpacity>
          <ThemedView style={styles.questionInfo}>
            <ThemedText type="subtitle">
              {categoryLabel} 問題{question.number}
            </ThemedText>
            <ThemedText style={styles.progressInfo}>
              {navigation.currentIndex + 1} / {navigation.totalQuestions}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Question */}
        <ThemedView
          style={[
            styles.questionContainer,
            {
              backgroundColor: colorScheme === 'dark' ? '#1C3A5E' : '#E8F4FD',
            }
          ]}
        >
          <ThemedText style={styles.questionText}>{question.text}</ThemedText>
        </ThemedView>

        {/* Choices */}
        <ThemedView style={styles.choicesContainer}>
          {question.choices.map((choice, index) => (
            <TouchableOpacity
              key={choice.id}
              style={getChoiceStyle(choice)}
              onPress={() => handleChoiceSelect(choice.id)}
              disabled={isAnswered}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`選択肢${String.fromCharCode(65 + index)}: ${choice.text}`}
              accessibilityState={{ disabled: isAnswered, selected: selectedChoiceId === choice.id }}
            >
              <ThemedText
                style={[
                  styles.choiceText,
                  { color: getChoiceTextColor(choice) },
                ]}
              >
                {String.fromCharCode(65 + index)}. {choice.text}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Result */}
        {isAnswered && (
          <ThemedView style={styles.resultContainer}>
            <ThemedText
              type="subtitle"
              style={[
                styles.resultText,
                {
                  color:
                    selectedChoiceId === question.correctChoiceId
                      ? '#34C759'
                      : '#FF3B30',
                },
              ]}
            >
              {selectedChoiceId === question.correctChoiceId ? '正解！' : '不正解'}
            </ThemedText>
          </ThemedView>
        )}

        {/* Explanation */}
        {showExplanation && (
          <ThemedView
            style={[
              styles.explanationContainer,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <ThemedText type="subtitle" style={styles.explanationTitle}>
              解説
            </ThemedText>
            {processedExplanation.parts.map((part, index) => (
              <ThemedView key={index} style={index > 0 ? { marginTop: 20 } : undefined}>
                <ThemedText style={styles.explanationText}>
                  {part}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}

        {/* Navigation */}
        {isAnswered && (
          <ThemedView style={styles.navigationContainer}>
            <ThemedView style={styles.navigationButtons}>
              {navigation.hasPrevious && (
                <TouchableOpacity
                  style={styles.previousButton}
                  onPress={handlePreviousQuestion}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="前の問題に移動"
                >
                  <ThemedText style={styles.buttonText}>← 前の問題</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  { flex: navigation.hasPrevious ? 1 : undefined }
                ]}
                onPress={handleNextQuestion}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={navigation.hasNext ? "次の問題に移動" : "問題を完了する"}
              >
                <ThemedText style={styles.buttonText}>
                  {navigation.hasNext ? '次の問題へ →' : '完了'}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  headerContainer: {
    gap: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  questionInfo: {
    alignItems: 'center',
    gap: 5,
  },
  progressInfo: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
  },
  questionContainer: {
    padding: 20,
    borderRadius: 12,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 15,
    lineHeight: 22,
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '600',
  },
  explanationContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
  },
  referenceContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  referenceTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  referenceText: {
    fontSize: 14,
    lineHeight: 20,
  },
  navigationContainer: {
    gap: 12,
    paddingTop: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  nextButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 120,
  },
  previousButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
