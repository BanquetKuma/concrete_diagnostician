import { StyleSheet, ScrollView, TouchableOpacity, Alert, Image, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CategoryList } from '@/components/CategoryList';
import { LoadingView } from '@/components/ui/LoadingView';
import { ErrorView } from '@/components/ui/ErrorView';
import { useUserContext } from '@/contexts/UserContext';
import { useCategories } from '@/hooks/useCategories';
import { apiClient } from '@/lib/api/client';
// Hero image for the app
const heroImage = require('@/assets/images/app_hero.png');

export default function HomeScreen() {
  const { user, isLoading, error, refreshUser, clearSession } = useUserContext();
  const { categories, isLoading: isLoadingCategories, error: categoriesError, refetch: refetchCategories } = useCategories();
  const { signOut, isSignedIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleSignOut = useCallback(async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('ログアウトしますか？');
      if (confirmed) {
        await signOut();
      }
    } else {
      Alert.alert(
        'ログアウト',
        'ログアウトしますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'ログアウト',
            style: 'destructive',
            onPress: async () => {
              await signOut();
            },
          },
        ]
      );
    }
  }, [signOut]);

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchCategories();
    }, [refetchCategories])
  );

  const handleRefreshUser = useCallback(async () => {
    try {
      await refreshUser();
      Alert.alert('成功', 'ユーザー情報を更新しました');
    } catch {
      Alert.alert('エラー', 'ユーザー情報の更新に失敗しました');
    }
  }, [refreshUser]);

  const handleCategoryPress = useCallback((category: string) => {
    router.push({
      pathname: '/questions/category/[category]' as const,
      params: { category }
    } as never);
  }, [router]);

  const executeClearAllHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      await apiClient.clearAllAnswers(user.id);
      refetchCategories();
      if (Platform.OS === 'web') {
        window.alert('全ての学習履歴をクリアしました');
      } else {
        Alert.alert('完了', '全ての学習履歴をクリアしました');
      }
    } catch (err) {
      console.error('Failed to clear all history:', err);
      if (Platform.OS === 'web') {
        window.alert('学習履歴のクリアに失敗しました');
      } else {
        Alert.alert('エラー', '学習履歴のクリアに失敗しました');
      }
    }
  }, [user?.id, refetchCategories]);

  const handleClearAllHistory = useCallback(() => {
    if (!user?.id) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('全ての分野の学習履歴を削除しますか？\n\nこの操作は取り消せません。');
      if (confirmed) {
        executeClearAllHistory();
      }
    } else {
      Alert.alert(
        '全学習履歴のクリア',
        '全ての分野の学習履歴を削除しますか？\n\nこの操作は取り消せません。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'クリア',
            style: 'destructive',
            onPress: () => executeClearAllHistory(),
          },
        ]
      );
    }
  }, [user?.id, executeClearAllHistory]);

  const executeDeleteAccount = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. バックエンドでユーザーデータ削除
      await apiClient.deleteAccount(user.id);

      // 2. ローカルストレージクリア
      await clearSession();

      // 3. Clerkからサインアウト
      await signOut();

      // 4. サインイン画面へ遷移
      router.replace('/(public)/sign-in');
    } catch (err) {
      console.error('Failed to delete account:', err);
      if (Platform.OS === 'web') {
        window.alert('アカウント削除に失敗しました');
      } else {
        Alert.alert('エラー', 'アカウント削除に失敗しました');
      }
    }
  }, [user?.id, clearSession, signOut, router]);

  const confirmDeleteAccount = useCallback(() => {
    if (!user?.id) return;

    Alert.alert(
      '最終確認',
      'アカウントを削除すると、すべてのデータが失われます。本当に削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '完全に削除',
          style: 'destructive',
          onPress: () => executeDeleteAccount(),
        },
      ]
    );
  }, [user?.id, executeDeleteAccount]);

  const handleDeleteAccount = useCallback(() => {
    if (!user?.id) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        '本当にアカウントを削除しますか？\n\n以下のデータが完全に削除されます：\n・学習履歴\n・ユーザー情報\n\nこの操作は取り消せません。'
      );
      if (confirmed) {
        const finalConfirm = window.confirm(
          '【最終確認】\nアカウントを削除すると、すべてのデータが失われます。本当に削除しますか？'
        );
        if (finalConfirm) {
          executeDeleteAccount();
        }
      }
    } else {
      Alert.alert(
        'アカウント削除',
        '本当にアカウントを削除しますか？\n\n以下のデータが完全に削除されます：\n・学習履歴\n・ユーザー情報\n\nこの操作は取り消せません。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除する',
            style: 'destructive',
            onPress: () => confirmDeleteAccount(),
          },
        ]
      );
    }
  }, [user?.id, executeDeleteAccount, confirmDeleteAccount]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message="エラーが発生しました" details={error} onRetry={handleRefreshUser} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.content}>
        {/* Header with login/logout button */}
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          {isSignedIn ? (
            <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
              <ThemedText style={styles.logoutButtonText}>ログアウト</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(public)/sign-in')} style={styles.loginButton}>
              <ThemedText style={styles.loginButtonText}>ログイン</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Hero Image */}
        <View style={[styles.heroContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image
            source={heroImage}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        {/* Catchphrase badges */}
        <ThemedView style={styles.badgeContainer}>
          <ThemedText style={styles.badge}>✓ 専門家監修</ThemedText>
          <ThemedText style={styles.badge}>✓ 教科書準拠</ThemedText>
          <ThemedText style={styles.badge}>✓ 詳細な解説付き</ThemedText>
        </ThemedView>

        <ThemedView style={styles.welcomeSection}>
          <ThemedText type="title">コンクリート診断士</ThemedText>
          <ThemedText type="title">試験対策アプリ</ThemedText>
          <ThemedText style={styles.subtitle}>
            スキマ時間で効率的に学習しましょう
          </ThemedText>
        </ThemedView>

        {/* Credibility section */}
        <View style={[styles.credibilityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.credibilityIcon}>📚</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.credibilityTitle}>
            専門書に基づいた問題
          </ThemedText>
          <ThemedText style={styles.credibilityText}>
            本アプリの問題は、過去の実際の試験問題・専門書を基に作成・監修しています。また、コンクリート診断士有資格者のレビューを受けています。
          </ThemedText>
        </View>

        <ThemedView style={styles.categoriesContainer}>
          <ThemedText type="subtitle">学習分野を選択</ThemedText>
          {categoriesError ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>
                分野データの読み込みに失敗しました
              </ThemedText>
              <TouchableOpacity style={styles.retryButton} onPress={refetchCategories}>
                <ThemedText style={styles.buttonText}>再試行</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <CategoryList
              categories={categories}
              isLoading={isLoadingCategories}
              onCategoryPress={handleCategoryPress}
            />
          )}
        </ThemedView>

        {/* Clear all history button - only show for signed-in users */}
        {user?.id && (
          <ThemedView style={styles.clearAllContainer}>
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAllHistory}
            >
              <ThemedText style={styles.clearAllButtonText}>
                全学習履歴をクリア
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        {/* Delete account button - only show for signed-in users */}
        {user?.id && (
          <ThemedView style={styles.deleteAccountContainer}>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
            >
              <ThemedText style={styles.deleteAccountButtonText}>
                アカウントを削除
              </ThemedText>
            </TouchableOpacity>
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
    paddingBottom: 100,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: -10,
  },
  headerSpacer: {
    flex: 1,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  logoutButtonText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
  loginButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  loginButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  heroContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: 180,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    fontSize: 13,
    opacity: 0.8,
    fontWeight: '500',
  },
  credibilityCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  credibilityIcon: {
    fontSize: 32,
  },
  credibilityTitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  credibilityText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 5,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
  },
  categoriesContainer: {
    gap: 10,
    marginTop: 20,
  },
  comingSoon: {
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 10,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    paddingHorizontal: 20,
  },
  clearAllContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  clearAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearAllButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteAccountContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  separator: {
    width: '60%',
    height: 1,
    backgroundColor: '#E5E5E5',
    marginBottom: 20,
  },
  deleteAccountButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  deleteAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
