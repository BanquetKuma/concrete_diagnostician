import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LoadingView } from '@/components/ui/LoadingView';
import { useRevenueCat } from '@/hooks/useRevenueCat';

// Legal document URLs (Cloudflare Pages)
const TERMS_OF_SERVICE_URL = 'https://concrete-diagnostician-docs.pages.dev/terms-of-service';
const PRIVACY_POLICY_URL = 'https://concrete-diagnostician-docs.pages.dev/privacy-policy';
const SUPPORT_URL = 'https://concrete-diagnostician-docs.pages.dev/support';

export default function SubscriptionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    isInitialized,
    isProMember,
    isPremiumMember,
    offerings,
    isLoading,
    error,
    purchasePackage,
    restorePurchases,
  } = useRevenueCat();

  const handlePurchasePro = async () => {
    if (!offerings?.lifetime) {
      Alert.alert('エラー', '購入可能なプランがありません');
      return;
    }
    const success = await purchasePackage(offerings.lifetime);
    if (success) {
      Alert.alert('成功', 'Pro版の購入が完了しました！');
    }
  };

  const handlePurchasePremium = async () => {
    if (!offerings?.monthly) {
      Alert.alert('エラー', '購入可能なプランがありません');
      return;
    }
    const success = await purchasePackage(offerings.monthly);
    if (success) {
      Alert.alert('成功', 'Premiumプランの購入が完了しました！');
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('成功', '購入を復元しました！');
    } else {
      Alert.alert('お知らせ', '復元可能な購入が見つかりませんでした');
    }
  };

  // Header title based on membership
  const headerTitle = isPremiumMember
    ? '⭐ Premiumプラン利用中'
    : isProMember
      ? '⭐ Pro版を購入済み'
      : '⭐ プランを選択';

  // Status card config
  const statusConfig = isPremiumMember
    ? { color: '#6366F1', label: 'Premium会員', description: '全問題 + AIチャットが利用可能' }
    : isProMember
      ? { color: '#10B981', label: 'Pro会員', description: 'すべての問題（250問）にアクセス可能' }
      : { color: colors.card, label: '無料会員', description: '各分野の基礎問題（約100問）が無料' };

  const hasPaidPlan = isProMember || isPremiumMember;
  const statusBorderColor = hasPaidPlan ? statusConfig.color : colors.border;

  // Web platform message
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView style={styles.container}>
          <ThemedView style={styles.content}>
            <View style={styles.headerSection}>
              <ThemedText type="title">⭐ Pro版を購入</ThemedText>
            </View>

            <View style={[styles.webNoticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.webNoticeIcon}>📱</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.webNoticeTitle}>
                モバイルアプリをご利用ください
              </ThemedText>
              <ThemedText style={styles.webNoticeText}>
                Pro版の購入・管理は、iOSまたはAndroidアプリからのみ可能です。
              </ThemedText>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText type="subtitle" style={styles.featureTitle}>
                現在のご利用状況
              </ThemedText>
              <ThemedText style={styles.featureText}>
                すべての問題を無料でご利用いただけます。
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading && !isInitialized) {
    return <LoadingView />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.content}>
          {/* Header */}
          <View style={styles.headerSection}>
            <ThemedText type="title">{headerTitle}</ThemedText>
            {!hasPaidPlan && (
              <ThemedText style={styles.subtitle}>
                学習スタイルに合ったプランをお選びください
              </ThemedText>
            )}
          </View>

          {/* Current Status */}
          <View style={[styles.statusCard, {
            backgroundColor: hasPaidPlan ? statusConfig.color : colors.card,
            borderColor: statusBorderColor,
          }]}>
            <ThemedText type="defaultSemiBold" style={[styles.statusTitle, hasPaidPlan && styles.whiteText]}>
              {statusConfig.label}
            </ThemedText>
            <ThemedText style={[styles.statusDescription, hasPaidPlan && styles.whiteText]}>
              {statusConfig.description}
            </ThemedText>
          </View>

          {/* Error Display */}
          {error && (
            <View style={[styles.errorCard, { borderColor: '#EF4444' }]}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* ===== Pro Plan Section (shown first, lower commitment) ===== */}
          {!isProMember && (
            <>
              <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText type="subtitle" style={styles.benefitsTitle}>
                  Proプランの特典
                </ThemedText>
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                    <ThemedText style={styles.benefitText}>全250問にアクセス可能（無料版は約100問）</ThemedText>
                  </View>
                  <View style={styles.benefitItem}>
                    <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                    <ThemedText style={styles.benefitText}>各分野の応用・発展問題を学習</ThemedText>
                  </View>
                  <View style={styles.benefitItem}>
                    <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                    <ThemedText style={styles.benefitText}>広告なしで快適に学習</ThemedText>
                  </View>
                </View>
              </View>

              {/* Pro Pricing */}
              {offerings && (
                <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: '#0a7ea4' }]}>
                  <ThemedText type="subtitle" style={styles.pricingTitle}>
                    買い切りプラン（Pro）
                  </ThemedText>
                  {offerings.lifetime ? (
                    <>
                      <ThemedView style={styles.priceContainer}>
                        <ThemedText
                          style={styles.price}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {offerings.lifetime.product.priceString}
                        </ThemedText>
                        <ThemedText style={styles.pricePeriod}>（税込・買い切り）</ThemedText>
                      </ThemedView>
                      <ThemedText style={styles.priceNote}>一度のお支払いで永久にご利用いただけます</ThemedText>
                      <TouchableOpacity
                        style={[styles.purchaseButton, isLoading && styles.disabledButton]}
                        onPress={handlePurchasePro}
                        disabled={isLoading}
                      >
                        <ThemedText style={styles.purchaseButtonText}>
                          {isLoading ? '処理中...' : '購入する'}
                        </ThemedText>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <ThemedText style={styles.noOfferingText}>
                      現在購入可能なプランがありません
                    </ThemedText>
                  )}
                </View>
              )}
            </>
          )}

          {/* ===== Premium Plan Section (shown below Pro as an upsell) ===== */}
          {!isPremiumMember && (
            <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.planHeader}>
                <ThemedText type="subtitle" style={styles.benefitsTitle}>
                  Premiumプランの特典
                </ThemedText>
                <View style={styles.recommendBadge}>
                  <ThemedText style={styles.recommendBadgeText}>おすすめ</ThemedText>
                </View>
              </View>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <ThemedText style={[styles.benefitIcon, { color: '#6366F1' }]}>✓</ThemedText>
                  <ThemedText style={styles.benefitText}>Proプランの全特典を含む</ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <ThemedText style={[styles.benefitIcon, { color: '#6366F1' }]}>✓</ThemedText>
                  <ThemedText style={styles.benefitText}>AIチャットで教科書に基づく質問が可能</ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <ThemedText style={[styles.benefitIcon, { color: '#6366F1' }]}>✓</ThemedText>
                  <ThemedText style={styles.benefitText}>1日15通・月300通まで質問可能</ThemedText>
                </View>
              </View>
            </View>
          )}

          {/* Premium Pricing */}
          {offerings && !isPremiumMember && (
            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: '#6366F1' }]}>
              <ThemedText type="subtitle" style={styles.pricingTitle}>
                Premiumプラン
              </ThemedText>
              {offerings.monthly ? (
                <>
                  <ThemedView style={styles.priceContainer}>
                    <ThemedText
                      style={[styles.price, { color: '#6366F1' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {offerings.monthly.product.priceString}
                    </ThemedText>
                    <ThemedText style={styles.pricePeriod}>（税込・月額）</ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.priceNote}>全問題アクセス + AIチャット機能付き</ThemedText>
                  <TouchableOpacity
                    style={[styles.purchaseButton, { backgroundColor: '#6366F1' }, isLoading && styles.disabledButton]}
                    onPress={handlePurchasePremium}
                    disabled={isLoading}
                  >
                    <ThemedText style={styles.purchaseButtonText}>
                      {isLoading ? '処理中...' : 'Premiumに登録する'}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <ThemedText style={styles.noOfferingText}>
                  現在準備中です。しばらくお待ちください。
                </ThemedText>
              )}
            </View>
          )}

          {/* Manage Subscription (Premium members) */}
          {isPremiumMember && (
            <View style={[styles.manageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText type="defaultSemiBold" style={styles.manageTitle}>
                サブスクリプションの管理
              </ThemedText>
              <ThemedText style={[styles.manageDescription, { color: colors.icon }]}>
                プランの変更や解約は、Appleのサブスクリプション管理画面から行えます。
              </ThemedText>
              <TouchableOpacity
                style={[styles.manageButton, { borderColor: '#6366F1' }]}
                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
              >
                <ThemedText style={[styles.manageButtonText, { color: '#6366F1' }]}>
                  サブスクリプションを管理
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Restore Purchases — always visible (shared between Pro and Premium) */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <ThemedText style={styles.restoreButtonText}>
              購入を復元する
            </ThemedText>
          </TouchableOpacity>

          {/* Legal Links */}
          <View style={styles.legalSection}>
            <View style={styles.legalLinks}>
              <TouchableOpacity
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                style={styles.legalLink}
              >
                <ThemedText style={styles.legalLinkText}>利用規約</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.legalSeparator}>|</ThemedText>
              <TouchableOpacity
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                style={styles.legalLink}
              >
                <ThemedText style={styles.legalLinkText}>プライバシーポリシー</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.legalSeparator}>|</ThemedText>
              <TouchableOpacity
                onPress={() => Linking.openURL(SUPPORT_URL)}
                style={styles.legalLink}
              >
                <ThemedText style={styles.legalLinkText}>サポート</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
    fontSize: 16,
    textAlign: 'center',
  },
  statusCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: {
    fontSize: 20,
  },
  statusDescription: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recommendBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  benefitsCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  benefitsTitle: {
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '600',
  },
  benefitText: {
    fontSize: 15,
    flex: 1,
  },
  pricingCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: 16,
  },
  pricingTitle: {
    fontSize: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    maxWidth: '100%',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0a7ea4',
    lineHeight: 44,
    flexShrink: 1,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '400',
  },
  priceNote: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: -4,
  },
  purchaseButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  noOfferingText: {
    opacity: 0.6,
    textAlign: 'center',
  },
  manageCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  manageTitle: {
    fontSize: 16,
  },
  manageDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  manageButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 4,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#0a7ea4',
    fontSize: 16,
  },
  webNoticeCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  webNoticeIcon: {
    fontSize: 48,
  },
  webNoticeTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  webNoticeText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
  },
  featureCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureTitle: {
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    opacity: 0.8,
  },
  legalSection: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    padding: 4,
  },
  legalLinkText: {
    fontSize: 13,
    color: '#0a7ea4',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 13,
    opacity: 0.4,
  },
});
