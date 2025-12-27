// Component for displaying study statistics

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { UserProgress } from '@/lib/api/client';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CATEGORY_LABELS, sortByCategory } from '@/constants/Categories';

interface StudyStatsProps {
  progress: UserProgress | null;
  isLoading?: boolean;
}

const StudyStatsComponent: React.FC<StudyStatsProps> = ({ progress, isLoading = false }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Calculate stat items for display
  const statItems = useMemo(() => {
    if (!progress) return [];

    const { overall } = progress;
    return [
      {
        label: '総問題数',
        value: overall.totalQuestions,
        color: colors.tint,
      },
      {
        label: '解答数',
        value: overall.answeredQuestions,
        color: colors.tint,
      },
      {
        label: '正答数',
        value: overall.correctAnswers,
        color: '#34C759',
      },
      {
        label: '正答率',
        value: `${overall.accuracy}%`,
        color: overall.accuracy >= 80 ? '#34C759' : overall.accuracy >= 60 ? '#FF9500' : '#FF3B30',
      },
      {
        label: '連続学習',
        value: `${overall.studyStreak}日`,
        color: colors.tint,
      },
    ];
  }, [progress, colors.tint]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">統計データ読み込み中...</ThemedText>
      </ThemedView>
    );
  }

  if (!progress) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">学習統計</ThemedText>
        <ThemedText style={styles.noDataText}>
          統計データを読み込めませんでした
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>学習統計</ThemedText>

      {/* Overall Stats */}
      <ThemedView style={styles.statsGrid}>
        {statItems.map((stat, index) => (
          <ThemedView
            key={index}
            style={[
              styles.statCard,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <ThemedText style={[styles.statValue, { color: stat.color }]}>
              {stat.value}
            </ThemedText>
            <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
          </ThemedView>
        ))}
      </ThemedView>

      {/* Category-by-category breakdown */}
      <ThemedView style={styles.yearBreakdown}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          分野別詳細
        </ThemedText>
        {sortByCategory(progress.byCategory).map((categoryProgress) => (
          <ThemedView
            key={categoryProgress.category}
            style={[
              styles.yearCard,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <ThemedView style={styles.yearHeader}>
              <ThemedText style={styles.yearTitle}>
                {CATEGORY_LABELS[categoryProgress.category] || categoryProgress.category}
              </ThemedText>
              <ThemedText style={styles.yearAccuracy}>
                正答率: {categoryProgress.accuracy}%
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.yearStats}>
              <View style={styles.yearStat}>
                <ThemedText style={styles.yearStatValue}>
                  {categoryProgress.answeredQuestions}
                </ThemedText>
                <ThemedText style={styles.yearStatLabel}>解答済み</ThemedText>
              </View>
              <View style={styles.yearStat}>
                <ThemedText style={[styles.yearStatValue, { color: '#34C759' }]}>
                  {categoryProgress.correctAnswers}
                </ThemedText>
                <ThemedText style={styles.yearStatLabel}>正解</ThemedText>
              </View>
              <View style={styles.yearStat}>
                <ThemedText style={[styles.yearStatValue, { color: '#FF3B30' }]}>
                  {categoryProgress.answeredQuestions - categoryProgress.correctAnswers}
                </ThemedText>
                <ThemedText style={styles.yearStatLabel}>不正解</ThemedText>
              </View>
            </ThemedView>

            {/* Progress bar */}
            <ThemedView style={styles.progressContainer}>
              <ThemedView style={[styles.progressBar, { backgroundColor: colors.progressBackground }]}>
                <ThemedView
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.tint,
                      width: `${categoryProgress.totalQuestions > 0 ? (categoryProgress.answeredQuestions / categoryProgress.totalQuestions) * 100 : 0}%`,
                    },
                  ]}
                />
              </ThemedView>
              <ThemedText style={styles.progressText}>
                {categoryProgress.answeredQuestions} / {categoryProgress.totalQuestions}問
              </ThemedText>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>

      {/* Recent activity */}
      <ThemedView style={styles.recentActivity}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          最近の学習
        </ThemedText>
        <ThemedView
          style={[
            styles.activityCard,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <ThemedText style={styles.activityText}>
            {progress.overall.lastStudyDate
              ? `最終学習日: ${new Date(progress.overall.lastStudyDate).toLocaleDateString('ja-JP')}`
              : '学習履歴がありません'}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

StudyStatsComponent.displayName = 'StudyStats';

export const StudyStats = memo(StudyStatsComponent);

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  noDataText: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  yearBreakdown: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  yearCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  yearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yearTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  yearAccuracy: {
    fontSize: 14,
    opacity: 0.8,
  },
  yearStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  yearStat: {
    alignItems: 'center',
    gap: 4,
  },
  yearStatValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  yearStatLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  recentActivity: {
    gap: 8,
  },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityText: {
    textAlign: 'center',
    opacity: 0.8,
  },
});
