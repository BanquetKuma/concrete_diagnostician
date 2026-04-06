import { StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const isUser = message.role === 'user';
  const palette = Colors[scheme];

  const bubbleStyle = isUser
    ? { backgroundColor: palette.tint, alignSelf: 'flex-end' as const }
    : { backgroundColor: palette.card, alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: palette.border };

  const textColor = isUser ? '#fff' : palette.text;

  // User messages: plain text. Assistant messages: Markdown.
  if (isUser) {
    return (
      <View style={[styles.bubble, bubbleStyle]}>
        <ThemedText style={[styles.text, { color: textColor }]}>
          {message.content}
        </ThemedText>
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
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginVertical: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
});
