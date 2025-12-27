// Component for displaying exam years list

import React, { memo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { ExamYear } from '@/lib/api/client';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface ExamYearListProps {
  years: ExamYear[];
  isLoading?: boolean;
  onYearPress: (year: number) => void;
}

const ExamYearListComponent: React.FC<ExamYearListProps> = ({
  years,
  isLoading = false,
  onYearPress,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>読み込み中...</ThemedText>
      </ThemedView>
    );
  }

  if (years.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText style={styles.emptyText}>
          利用可能な問題がありません
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {years.map((yearData) => (
        <TouchableOpacity
          key={yearData.year}
          style={[
            styles.yearCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => onYearPress(yearData.year)}
          activeOpacity={0.7}
        >
          <View style={styles.yearHeader}>
            <ThemedText type="subtitle" style={styles.yearTitle}>
              {yearData.year}年度
            </ThemedText>
            <ThemedText style={styles.questionCount}>
              全{yearData.totalQuestions}問
            </ThemedText>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTextContainer}>
              <ThemedText style={styles.progressLabel}>進捗状況</ThemedText>
              <ThemedText style={styles.progressText}>
                {yearData.completedQuestions ?? 0} / {yearData.totalQuestions ?? 0} 問完了
              </ThemedText>
            </View>

            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: colors.progressBackground,
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.tint,
                      width: `${yearData.totalQuestions > 0 ? ((yearData.completedQuestions ?? 0) / yearData.totalQuestions) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressPercentage}>
                {yearData.totalQuestions > 0 ? Math.round(((yearData.completedQuestions ?? 0) / yearData.totalQuestions) * 100) : 0}%
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ThemedView>
  );
};

ExamYearListComponent.displayName = 'ExamYearList';

export const ExamYearList = memo(ExamYearListComponent);

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    opacity: 0.5,
    fontSize: 16,
  },
  yearCard: {
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
  yearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  questionCount: {
    opacity: 0.7,
    fontSize: 14,
  },
  progressContainer: {
    gap: 8,
  },
  progressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  progressText: {
    fontSize: 14,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});