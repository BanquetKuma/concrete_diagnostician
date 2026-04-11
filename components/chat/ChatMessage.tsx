import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

const LOADING_STEPS = [
  { text: '教科書を検索中...', delay: 0 },
  { text: '関連する内容を抽出中...', delay: 3000 },
  { text: '回答を生成中...', delay: 7000 },
];

interface Props {
  message: ChatMessageType;
}

/**
 * Animated step indicator shown while waiting for the first SSE chunk.
 */
function LoadingSteps({ color }: { color: string }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timers = LOADING_STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color={color} style={styles.spinner} />
      <ThemedText style={[styles.loadingText, { color }]}>
        {LOADING_STEPS[stepIndex].text}
      </ThemedText>
    </View>
  );
}

export function ChatMessage({ message }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const isUser = message.role === 'user';
  const palette = Colors[scheme];

  const bubbleStyle = isUser
    ? {
        backgroundColor: palette.tint,
        alignSelf: 'flex-end' as const,
        maxWidth: '85%' as const,
      }
    : {
        backgroundColor: palette.card,
        alignSelf: 'stretch' as const,
        borderWidth: 1,
        borderColor: palette.border,
      };

  const textColor = isUser ? '#fff' : palette.text;

  // User messages: plain text
  if (isUser) {
    return (
      <View style={[styles.bubble, bubbleStyle]}>
        <ThemedText style={[styles.text, { color: textColor }]}>
          {message.content}
        </ThemedText>
      </View>
    );
  }

  // Assistant message: empty content = loading, otherwise Markdown
  if (message.content === '') {
    return (
      <View style={[styles.bubble, bubbleStyle]}>
        <LoadingSteps color={palette.tint} />
      </View>
    );
  }

  const mdStyles = StyleSheet.create({
    body: { color: textColor, fontSize: 15, lineHeight: 22 },
    heading1: { color: textColor, fontSize: 20, fontWeight: '700', marginTop: 12, marginBottom: 4 },
    heading2: { color: textColor, fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 4 },
    heading3: { color: textColor, fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: palette.tint,
      paddingLeft: 10,
      marginVertical: 6,
      opacity: 0.85,
    },
    code_inline: {
      backgroundColor: palette.border,
      color: textColor,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: palette.border,
      color: textColor,
      padding: 10,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'monospace',
      marginVertical: 6,
    },
    fence: {
      backgroundColor: palette.border,
      color: textColor,
      padding: 10,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'monospace',
      marginVertical: 6,
    },
    table: { borderWidth: 1, borderColor: palette.border, borderRadius: 4, marginVertical: 6 },
    thead: { backgroundColor: palette.border },
    th: { padding: 6, fontWeight: '700' },
    td: { padding: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
    tr: { flexDirection: 'row' },
    hr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border, marginVertical: 8 },
    paragraph: { marginVertical: 3 },
    link: { color: palette.tint, textDecorationLine: 'underline' },
  });

  return (
    <View style={[styles.bubble, bubbleStyle]}>
      <Markdown style={mdStyles}>{message.content}</Markdown>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginVertical: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  spinner: {
    transform: [{ scale: 0.8 }],
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
