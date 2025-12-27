// Statistics screen showing user learning progress

import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { StudyStats } from '@/components/StudyStats';
import { progressService } from '@/lib/services/progressService';
import { useUserContext } from '@/contexts/UserContext';
import { UserProgress } from '@/lib/api/client';

export default function StatsScreen() {
  const { user } = useUserContext();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          <StudyStats progress={progress} isLoading={isLoading} />
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
  },
});