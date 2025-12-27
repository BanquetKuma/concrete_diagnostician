import { StyleSheet, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface ErrorViewProps {
  message?: string;
  details?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorView({
  message = 'エラーが発生しました',
  details,
  onRetry,
  fullScreen = true,
}: ErrorViewProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={[styles.container, fullScreen && styles.fullScreen]}>
      <ThemedText type="title" style={styles.title}>
        {message}
      </ThemedText>
      {details && (
        <ThemedText style={styles.details}>{details}</ThemedText>
      )}
      {onRetry && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
          onPress={onRetry}
        >
          <ThemedText style={styles.retryText}>再試行</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  fullScreen: {
    flex: 1,
  },
  title: {
    color: '#e74c3c',
    textAlign: 'center',
  },
  details: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
