import { useEffect, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { useChatContext } from '@/contexts/ChatContext';
import { useChatAccess } from '@/hooks/useChatAccess';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

export default function ChatScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const params = useLocalSearchParams<{ context?: string }>();
  const questionContext = typeof params.context === 'string' ? params.context : undefined;

  const { canAccessChat, isLoading: accessLoading } = useChatAccess();
  const {
    messages,
    usage,
    isSending,
    error,
    rateLimited,
    sendMessage,
    resetConversation,
  } = useChatContext();

  const listRef = useRef<FlatList<ChatMessageType>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Premium gate
  if (!accessLoading && !canAccessChat) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <ThemedView style={styles.gate}>
          <ThemedText type="title" style={styles.gateTitle}>AIチャット</ThemedText>
          <ThemedText style={[styles.gateBody, { color: palette.icon }]}>
            教科書の内容に基づいて質問に答えるAIアシスタントです。
            Premiumプランでご利用いただけます。
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)/subscription')}
            style={[styles.gateButton, { backgroundColor: palette.tint }]}
          >
            <ThemedText style={styles.gateButtonText}>プランを見る</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const handleSend = (text: string) => {
    sendMessage(text, questionContext);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <ThemedText type="subtitle">AIチャット</ThemedText>
              {usage && (
                <ThemedText style={[styles.usageText, { color: palette.icon }]}>
                  本日 {usage.dailyUsed}/{usage.dailyLimit} ・ 今月 {usage.monthlyUsed}/{usage.monthlyLimit}
                </ThemedText>
              )}
            </View>
            {messages.length > 0 && (
              <Pressable
                onPress={resetConversation}
                style={[styles.newChatButton, { borderColor: palette.tint }]}
              >
                <ThemedText style={[styles.newChatButtonText, { color: palette.tint }]}>
                  新しい会話
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        {questionContext && (
          <View style={[styles.contextBanner, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ThemedText style={[styles.contextLabel, { color: palette.icon }]}>
              関連する問題のコンテキスト付き
            </ThemedText>
            <ThemedText numberOfLines={2} style={styles.contextText}>
              {questionContext}
            </ThemedText>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={({ item }) => <ChatMessage message={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ChatEmptyState onSuggestionPress={(t) => sendMessage(t, questionContext)} />
          }
        />

        {error && !rateLimited && (
          <ThemedText style={[styles.errorText, { color: '#d9534f' }]}>{error}</ThemedText>
        )}
        {rateLimited && (
          <ThemedText style={[styles.errorText, { color: '#d9534f' }]}>
            送信上限に達しました。しばらくしてから再度お試しください。
          </ThemedText>
        )}

        <ChatInput
          onSend={handleSend}
          isSending={isSending}
          disabled={rateLimited}
          placeholder={rateLimited ? '上限に達しました' : '質問を入力...'}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBlock: {
    flex: 1,
  },
  usageText: {
    fontSize: 12,
    marginTop: 2,
  },
  newChatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  newChatButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contextBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  contextLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  contextText: {
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  errorText: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  gate: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    marginBottom: 12,
  },
  gateBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  gateButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  gateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
