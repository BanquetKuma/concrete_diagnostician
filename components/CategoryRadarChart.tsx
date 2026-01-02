// Radar chart component for visualizing category accuracy
// Uses react-native-svg for cross-platform rendering

import React, { memo, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CATEGORY_LABELS } from '@/constants/Categories';

interface CategoryData {
  category: string;
  accuracy: number;
  answeredQuestions: number;
}

interface CategoryRadarChartProps {
  categories: CategoryData[];
}

const CategoryRadarChartComponent: React.FC<CategoryRadarChartProps> = ({ categories }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Filter categories with at least one answered question
  const activeCategories = useMemo(() => {
    return categories.filter((cat) => cat.answeredQuestions > 0);
  }, [categories]);

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 80, 300);
  const centerX = chartSize / 2;
  const centerY = chartSize / 2;
  const maxRadius = chartSize / 2 - 40;

  // Calculate points for radar chart
  const chartData = useMemo(() => {
    if (activeCategories.length < 3) {
      return null; // Need at least 3 categories for radar chart
    }

    const numCategories = activeCategories.length;
    const angleStep = (2 * Math.PI) / numCategories;

    // Grid lines (20%, 40%, 60%, 80%, 100%)
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

    // Calculate data points
    // Minimum radius of 10% so 0% accuracy is still visible as a shape
    const minRadiusRatio = 0.1;
    const dataPoints = activeCategories.map((cat, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      // Scale accuracy to range [minRadiusRatio, 1.0] for visual clarity
      const scaledRatio = minRadiusRatio + (cat.accuracy / 100) * (1 - minRadiusRatio);
      const radius = scaledRatio * maxRadius;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: CATEGORY_LABELS[cat.category] || cat.category,
        accuracy: cat.accuracy,
        labelX: centerX + (maxRadius + 30) * Math.cos(angle),
        labelY: centerY + (maxRadius + 30) * Math.sin(angle),
      };
    });

    // Grid polygon points for each level
    const gridPolygons = gridLevels.map((level) => {
      const points = activeCategories.map((_, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const radius = level * maxRadius;
        return `${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`;
      });
      return points.join(' ');
    });

    // Axis lines from center to each vertex
    const axisLines = activeCategories.map((_, index) => {
      const angle = index * angleStep - Math.PI / 2;
      return {
        x2: centerX + maxRadius * Math.cos(angle),
        y2: centerY + maxRadius * Math.sin(angle),
      };
    });

    // Data polygon points
    const dataPolygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

    return {
      dataPoints,
      gridPolygons,
      axisLines,
      dataPolygonPoints,
      gridLevels,
    };
  }, [activeCategories, centerX, centerY, maxRadius]);

  if (!chartData || activeCategories.length < 3) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="defaultSemiBold" style={styles.title}>
          分野別レーダーチャート
        </ThemedText>
        <ThemedView
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <ThemedText style={styles.emptyText}>
            3分野以上の回答でチャートが表示されます
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const gridColor = colorScheme === 'dark' ? '#444' : '#ddd';
  const textColor = colorScheme === 'dark' ? '#fff' : '#333';
  const fillColor = colorScheme === 'dark' ? 'rgba(0, 122, 255, 0.3)' : 'rgba(0, 122, 255, 0.2)';
  const strokeColor = '#007AFF';

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="defaultSemiBold" style={styles.title}>
        分野別レーダーチャート
      </ThemedText>
      <ThemedView
        style={[
          styles.chartCard,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View style={styles.chartContainer}>
          <Svg width={chartSize} height={chartSize}>
            <G>
              {/* Grid polygons */}
              {chartData.gridPolygons.map((points, index) => (
                <Polygon
                  key={`grid-${index}`}
                  points={points}
                  fill="none"
                  stroke={gridColor}
                  strokeWidth={1}
                />
              ))}

              {/* Axis lines */}
              {chartData.axisLines.map((line, index) => (
                <Line
                  key={`axis-${index}`}
                  x1={centerX}
                  y1={centerY}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={gridColor}
                  strokeWidth={1}
                />
              ))}

              {/* Data polygon (filled area) */}
              <Polygon
                points={chartData.dataPolygonPoints}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
              />

              {/* Data points */}
              {chartData.dataPoints.map((point, index) => (
                <Circle
                  key={`point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={strokeColor}
                />
              ))}

              {/* Category labels with accuracy */}
              {chartData.dataPoints.map((point, index) => {
                // Truncate long labels
                const label = point.label.length > 5
                  ? point.label.substring(0, 5) + '..'
                  : point.label;
                return (
                  <G key={`label-${index}`}>
                    <SvgText
                      x={point.labelX}
                      y={point.labelY - 7}
                      fontSize={10}
                      fill={textColor}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {label}
                    </SvgText>
                    <SvgText
                      x={point.labelX}
                      y={point.labelY + 7}
                      fontSize={10}
                      fill={point.accuracy >= 60 ? '#34C759' : point.accuracy >= 30 ? '#FF9500' : '#FF3B30'}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fontWeight="bold"
                    >
                      {point.accuracy}%
                    </SvgText>
                  </G>
                );
              })}

              {/* Center label */}
              <SvgText
                x={centerX}
                y={centerY}
                fontSize={10}
                fill={gridColor}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                0%
              </SvgText>
            </G>
          </Svg>
        </View>

        {/* Detailed explanation */}
        <ThemedView style={styles.explanationContainer}>
          <ThemedText style={styles.explanationTitle}>
            チャートの見方
          </ThemedText>
          <ThemedView style={styles.explanationList}>
            <ThemedText style={styles.explanationItem}>
              ・各軸の先に分野名と正答率を表示
            </ThemedText>
            <ThemedText style={styles.explanationItem}>
              ・外側に伸びるほど正答率が高い（100%が最大）
            </ThemedText>
            <ThemedText style={styles.explanationItem}>
              ・青い領域が大きく均等なほど、バランス良く学習できています
            </ThemedText>
            <ThemedText style={styles.explanationItem}>
              ・凹んでいる分野を重点的に学習しましょう
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.legendRow}>
            <ThemedText style={[styles.legendItem, { color: '#34C759' }]}>■ 60%以上</ThemedText>
            <ThemedText style={[styles.legendItem, { color: '#FF9500' }]}>■ 30-59%</ThemedText>
            <ThemedText style={[styles.legendItem, { color: '#FF3B30' }]}>■ 30%未満</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

CategoryRadarChartComponent.displayName = 'CategoryRadarChart';

export const CategoryRadarChart = memo(CategoryRadarChartComponent);

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
  explanationContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    width: '100%',
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  explanationList: {
    gap: 4,
  },
  explanationItem: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  legendItem: {
    fontSize: 11,
    fontWeight: '600',
  },
});
