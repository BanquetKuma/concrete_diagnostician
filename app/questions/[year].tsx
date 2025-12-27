// Questions list screen for specific year

import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LoadingView } from '@/components/ui/LoadingView';
import { ErrorView } from '@/components/ui/ErrorView';
import { apiClient, QuestionListItem } from '@/lib/api/client';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useUser } from '@/hooks/useUser';

// カテゴリ名の日本語マッピング
const CATEGORY_LABELS: Record<string, string> = {
  'materials': 'コンクリート材料学',
  'mix-design': '配合設計',
  'construction': '施工技術',
  'quality': '品質管理',
  'deterioration': '劣化メカニズム',
  'diagnosis': '診断技術',
  'repair': '補修・補強工法',
  'maintenance': '維持管理計画',
  'regulations': '関連法規・基準',
};

// 回答状態の型
interface QuestionStatus {
  questionId: string;
  isAnswered: boolean;
  isCorrect: boolean;
}

export default function QuestionsListScreen() {
  const { year } = useLocalSearchParams<{ year: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUser();

  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [questionStatuses, setQuestionStatuses] = useState<Map<string, QuestionStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 画面がフォーカスされるたびにデータを再取得
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!year) return;

        try {
          setIsLoading(true);
          setError(null);

          // 問題一覧を取得
          const response = await apiClient.getQuestions(parseInt(year));
          setQuestions(response.questions);

          // ユーザーの回答状態を取得
          if (user?.id) {
            try {
              const progressResponse = await apiClient.getYearProgress(user.id, parseInt(year));
              const statusMap = new Map<string, QuestionStatus>();
              progressResponse.questions.forEach((q) => {
                statusMap.set(q.questionId, {
                  questionId: q.questionId,
                  isAnswered: q.isAnswered,
                  isCorrect: q.isCorrect,
                });
              });
              setQuestionStatuses(statusMap);
            } catch {
              // 進捗取得に失敗しても問題一覧は表示する
              console.log('Progress fetch failed, continuing without status');
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '問題データの取得に失敗しました';
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }, [year, user?.id])
  );

  const handleQuestionPress = (questionId: string) => {
    router.push({
      pathname: '/questions/[year]/[questionId]',
      params: { year: year as string, questionId }
    });
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleHomePress = () => {
    router.push('/(tabs)');
  };

  if (isLoading) {
    return <LoadingView message={`${year}年度の問題を読み込み中...`} />;
  }

  if (error) {
    return <ErrorView message="エラーが発生しました" details={error} onRetry={handleBackPress} />;
  }

  if (questions.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">{year}年度の問題</ThemedText>
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            この年度の問題はまだ準備されていません
          </ThemedText>
          <TouchableOpacity style={styles.button} onPress={handleBackPress}>
            <ThemedText style={styles.buttonText}>戻る</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.headerContainer}>
            <ThemedView style={styles.navigationRow}>
              <TouchableOpacity style={styles.homeButton} onPress={handleHomePress}>
                <ThemedText style={styles.homeButtonText}>ホームへ</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
                <ThemedText style={styles.backButtonText}>直前の問題に戻る →</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            <ThemedText type="title">{year}年度の問題 ({questions.length}問)</ThemedText>
          </ThemedView>

          <ThemedView style={styles.questionsContainer}>
          {questions.map((question, index) => {
            const status = questionStatuses.get(question.id);
            const displayNumber = index + 1;
            const categoryLabel = CATEGORY_LABELS[question.category] || question.category;

            // 回答状態に応じたスタイルとテキスト
            let statusText = '未回答';
            let statusStyle = styles.statusUnanswered;
            if (status?.isAnswered) {
              if (status.isCorrect) {
                statusText = '正解';
                statusStyle = styles.statusCorrect;
              } else {
                statusText = '不正解';
                statusStyle = styles.statusIncorrect;
              }
            }

            return (
              <TouchableOpacity
                key={question.id}
                style={[
                  styles.questionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => handleQuestionPress(question.id)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`問題${displayNumber}`}
                accessibilityHint="この問題を開始するにはタップしてください"
              >
                <ThemedView style={styles.questionHeader}>
                  <ThemedText type="subtitle">
                    問題 {displayNumber}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.categoryText,
                      { color: colors.tint }
                    ]}
                    numberOfLines={2}
                  >
                    {categoryLabel}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={[styles.statusText, statusStyle]}>
                  {statusText}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
          </ThemedView>
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
    gap: 15,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-end',
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  homeButton: {
    alignSelf: 'flex-start',
  },
  homeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  questionsContainer: {
    gap: 12,
  },
  questionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  statusText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  statusUnanswered: {
    color: '#8E8E93',
  },
  statusCorrect: {
    color: '#34C759',
  },
  statusIncorrect: {
    color: '#FF3B30',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 20,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 10,
  },
});