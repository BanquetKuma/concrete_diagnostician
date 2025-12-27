// Component for displaying category list with progress

import React, { memo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { CategorySummary } from '@/lib/api/client';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface CategoryWithProgress extends CategorySummary {
  completedQuestions: number;
}

interface CategoryListProps {
  categories: CategoryWithProgress[];
  isLoading?: boolean;
  onCategoryPress: (category: string) => void;
}

const CategoryListComponent: React.FC<CategoryListProps> = ({
  categories,
  isLoading = false,
  onCategoryPress,
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

  if (categories.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText style={styles.emptyText}>
          利用可能な分野がありません
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {categories.map((category) => (
        <TouchableOpacity
          key={category.category}
          style={[
            styles.categoryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => onCategoryPress(category.category)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeader}>
            <ThemedText type="subtitle" style={styles.categoryTitle}>
              {category.label}
            </ThemedText>
            <ThemedText style={styles.questionCount}>
              全{category.totalQuestions}問
            </ThemedText>
          </View>

          <View style={styles.progressContainer}>
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
                      width: `${category.totalQuestions > 0 ? (category.completedQuestions / category.totalQuestions) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressPercentage}>
                {category.totalQuestions > 0 ? Math.round((category.completedQuestions / category.totalQuestions) * 100) : 0}%
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ThemedView>
  );
};

CategoryListComponent.displayName = 'CategoryList';

export const CategoryList = memo(CategoryListComponent);

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
  categoryCard: {
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
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
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
