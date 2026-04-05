import { StyleSheet, View } from 'react-native';
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

  return (
    <View style={[styles.bubble, bubbleStyle]}>
      <ThemedText style={[styles.text, { color: textColor }]}>
        {message.content}
      </ThemedText>
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
