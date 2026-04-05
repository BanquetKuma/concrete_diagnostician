import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, isSending, placeholder }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled && !isSending;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={[styles.container, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
      <TextInput
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder={placeholder ?? '質問を入力...'}
        placeholderTextColor={palette.icon}
        multiline
        maxLength={2000}
        editable={!disabled}
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={[
          styles.sendButton,
          { backgroundColor: canSend ? palette.tint : palette.border },
        ]}
      >
        {isSending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <ThemedText style={styles.sendText}>送信</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 15,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
