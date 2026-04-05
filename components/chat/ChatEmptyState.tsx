import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const SUGGESTIONS = [
  '中性化のメカニズムを教えて',
  '塩害と中性化の違いは？',
  'アルカリシリカ反応の対策は？',
  'ひび割れの診断手法を説明して',
];

interface Props {
  onSuggestionPress?: (text: string) => void;
}

export function ChatEmptyState({ onSuggestionPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        教科書に基づくAIアシスタント
      </ThemedText>
      <ThemedText style={[styles.description, { color: palette.icon }]}>
        コンクリート診断士試験の学習範囲について、教科書の内容をもとに回答します。
      </ThemedText>
      <View style={styles.suggestions}>
        <ThemedText style={[styles.suggestionsLabel, { color: palette.icon }]}>
          質問例
        </ThemedText>
        {SUGGESTIONS.map((s) => (
          <ThemedText
            key={s}
            onPress={onSuggestionPress ? () => onSuggestionPress(s) : undefined}
            style={[
              styles.suggestion,
              {
                borderColor: palette.border,
                backgroundColor: palette.card,
                color: palette.text,
              },
            ]}
          >
            {s}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  suggestions: {
    width: '100%',
    gap: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  suggestion: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    overflow: 'hidden',
  },
});
