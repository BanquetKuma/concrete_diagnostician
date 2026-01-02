// Statistics screen showing user learning progress

import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { StudyStats } from '@/components/StudyStats';
import { CategoryRadarChart } from '@/components/CategoryRadarChart';
import { progressService } from '@/lib/services/progressService';
import { useUserContext } from '@/contexts/UserContext';
import { UserProgress } from '@/lib/api/client';

export default function StatsScreen() {
  const { user } = useUserContext();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { signOut } = useAuth();

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
      const loadProgress = async () => {
        if (!user) return;

        try {
          setIsLoading(true);
          const progressData = await progressService.getUserProgress(user.id);
          setProgress(progressData);
        } catch (error) {
          console.error('Failed to load progress:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadProgress();
    }, [user])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.content}>
          {/* Header with logout button */}
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
              <ThemedText style={styles.logoutButtonText}>ログアウト</ThemedText>
            </TouchableOpacity>
          </View>

          <StudyStats progress={progress} isLoading={isLoading} />

          {/* Radar Chart for category visualization */}
          {progress && !isLoading && (
            <CategoryRadarChart categories={progress.byCategory} />
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
});