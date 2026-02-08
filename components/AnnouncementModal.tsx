import { StyleSheet, Modal, ScrollView, TouchableOpacity, View, Linking, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

interface AnnouncementModalProps {
  visible: boolean;
  isProMember: boolean;
  onClose: () => void;
}

export function AnnouncementModal({ visible, isProMember, onClose }: AnnouncementModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor: colors.border }]}>
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isProMember ? (
              <>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                  {'【重要】有料プランの買い切りモデル移行と、\nサブスクリプション解約のお願い'}
                </ThemedText>
                <ThemedText style={styles.body}>
                  コンクリート診断士試験対策アプリをご利用いただきありがとうございます。
                </ThemedText>
                <ThemedText style={styles.body}>
                  このたび、より長く安心してご利用いただけるよう、サブスクリプションを廃止し、一度の購入で全機能が使える「買い切りモデル」へ移行いたしました。
                </ThemedText>
                <ThemedText style={[styles.body, styles.highlight]}>
                  現在サブスクリプションをご利用中のお客様は、追加料金なしで今後もすべての機能をご利用いただけます。
                </ThemedText>
                <ThemedText style={styles.body}>
                  つきましては、月額料金の発生を止めるため、お手数ですが以下の手順でサブスクリプションの解約手続きをお願いいたします。解約後もPro会員の権限はそのまま維持されます。
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.stepsTitle}>
                  解約手順
                </ThemedText>
                <ThemedText style={styles.body}>
                  下のボタンからサブスクリプション管理画面を開き、本アプリを選択して「サブスクリプションをキャンセル」してください。
                </ThemedText>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.subscriptionLink}
                    onPress={() => Linking.openURL(APPLE_SUBSCRIPTIONS_URL)}
                  >
                    <ThemedText style={styles.subscriptionLinkText}>
                      サブスクリプション管理画面を開く
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <ThemedText style={[styles.body, styles.manualSteps]}>
                  {`手動の場合：「設定」→ ご自身の名前 →「サブスクリプション」→ 本アプリを選択 →「サブスクリプションをキャンセル」`}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                  お知らせ: 買い切りプランが登場しました
                </ThemedText>
                <ThemedText style={styles.body}>
                  このたび、一度のお支払いで全250問にアクセスできる買い切りプランを導入いたしました。
                </ThemedText>
                <ThemedText style={styles.body}>
                  サブスクリプションではございません。一度ご購入いただければ、追加料金なしで永久にご利用いただけます。
                </ThemedText>
              </>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={onClose}
          >
            <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#000">
              OK
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 400,
  },
  scrollContent: {
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  highlight: {
    fontWeight: '600',
  },
  stepsTitle: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 8,
  },
  subscriptionLink: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualSteps: {
    fontSize: 12,
    opacity: 0.7,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
