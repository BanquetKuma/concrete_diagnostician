// Questions list screen for specific category

import { StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
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
import { useQuestionAccess } from '@/hooks/useQuestionAccess';

// 回答状態の型
interface QuestionStatus {
  questionId: string;
  isAnswered: boolean;
  isCorrect: boolean;
}

export default function CategoryQuestionsListScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUser();
  const { isLocked, getFreeLimitForCategory } = useQuestionAccess();

  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [categoryLabel, setCategoryLabel] = useState<string>('');
  const [questionStatuses, setQuestionStatuses] = useState<Map<string, QuestionStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 画面がフォーカスされるたびにデータを再取得
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!category) return;

        try {
          setIsLoading(true);
          setError(null);

          // 問題一覧を取得
          const response = await apiClient.getQuestionsByCategory(category);
          setQuestions(response.questions);
          setCategoryLabel(response.label);

          // ユーザーの回答状態を取得
          if (user?.id) {
            try {
              const progressResponse = await apiClient.getCategoryProgress(user.id, category);
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
    }, [category, user?.id])
  );

  const handleQuestionPress = (questionId: string, questionNumber: number) => {
    // ロックされた問題の場合はアップグレードを促す
    if (isLocked(category as string, questionNumber)) {
      const freeLimit = getFreeLimitForCategory(category as string);
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `この問題はProプラン限定です。\n\n${categoryLabel}分野では問題1〜${freeLimit}が無料でご利用いただけます。\n\nすべての問題にアクセスするにはProプランにアップグレードしてください。\n\nアップグレード画面に移動しますか？`
        );
        if (confirmed) {
          router.push('/subscription');
        }
      } else {
        Alert.alert(
          'Proプラン限定',
          `この問題はProプラン限定です。\n\n${categoryLabel}分野では問題1〜${freeLimit}が無料でご利用いただけます。\n\nすべての問題にアクセスするにはProプランにアップグレードしてください。`,
          [
            { text: 'キャンセル', style: 'cancel' },
            {
              text: 'アップグレード',
              onPress: () => router.push('/subscription'),
            },
          ]
        );
      }
      return;
    }

    router.push({
      pathname: '/questions/category/[category]/[questionId]' as const,
      params: { category: category as string, questionId }
    } as never);
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleHomePress = () => {
    router.push('/(tabs)');
  };

  const executeClearHistory = useCallback(async () => {
    if (!user?.id || !category) return;
    try {
      await apiClient.clearCategoryAnswers(user.id, category);
      setQuestionStatuses(new Map());
      if (Platform.OS === 'web') {
        window.alert(`${categoryLabel}分野の学習履歴をクリアしました`);
      } else {
        Alert.alert('完了', `${categoryLabel}分野の学習履歴をクリアしました`);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
      if (Platform.OS === 'web') {
        window.alert('学習履歴のクリアに失敗しました');
      } else {
        Alert.alert('エラー', '学習履歴のクリアに失敗しました');
      }
    }
  }, [user?.id, category, categoryLabel]);

  const handleClearHistory = useCallback(() => {
    if (!user?.id || !category) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${categoryLabel}分野の学習履歴をすべて削除しますか？\n\nこの操作は取り消せません。`);
      if (confirmed) {
        executeClearHistory();
      }
    } else {
      Alert.alert(
        '学習履歴のクリア',
        `${categoryLabel}分野の学習履歴をすべて削除しますか？\n\nこの操作は取り消せません。`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'クリア',
            style: 'destructive',
            onPress: () => executeClearHistory(),
          },
        ]
      );
    }
  }, [user?.id, category, categoryLabel, executeClearHistory]);

  if (isLoading) {
    return <LoadingView message={`${categoryLabel || category}分野の問題を読み込み中...`} />;
  }

  if (error) {
    return <ErrorView message="エラーが発生しました" details={error} onRetry={handleBackPress} />;
  }

  if (questions.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">{categoryLabel}分野の問題</ThemedText>
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            この分野の問題はまだ準備されていません
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
                <ThemedText style={styles.backButtonText}>直前の問題に戻る</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            <ThemedText type="title">{categoryLabel}分野の問題 ({questions.length}問)</ThemedText>
            <TouchableOpacity
              style={styles.clearHistoryButton}
              onPress={handleClearHistory}
            >
              <ThemedText style={styles.clearHistoryButtonText}>
                学習履歴をクリア
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={styles.questionsContainer}>
          {questions.map((question, index) => {
            const status = questionStatuses.get(question.id);
            const displayNumber = index + 1;
            const questionIsLocked = isLocked(category as string, displayNumber);

            // 回答状態に応じたスタイルとテキスト
            let statusText = '未回答';
            let statusStyle = styles.statusUnanswered;
            if (questionIsLocked) {
              statusText = '🔒 Pro限定';
              statusStyle = styles.statusLocked;
            } else if (status?.isAnswered) {
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
                  questionIsLocked && styles.questionCardLocked,
                ]}
                onPress={() => handleQuestionPress(question.id, displayNumber)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`問題${displayNumber}${questionIsLocked ? ' Pro限定' : ''}`}
                accessibilityHint={questionIsLocked ? 'この問題はProプラン限定です' : 'この問題を開始するにはタップしてください'}
              >
                <ThemedView style={styles.questionHeader}>
                  <ThemedText type="subtitle" style={questionIsLocked && styles.lockedText}>
                    問題 {displayNumber}
                  </ThemedText>
                  <ThemedText style={[styles.statusText, statusStyle]}>
                    {statusText}
                  </ThemedText>
                </ThemedView>
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
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
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
  clearHistoryButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginTop: 10,
  },
  clearHistoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusLocked: {
    color: '#8E8E93',
  },
  questionCardLocked: {
    opacity: 0.7,
  },
  lockedText: {
    opacity: 0.6,
  },
});
