import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LoadingView } from '@/components/ui/LoadingView';
import { useRevenueCat } from '@/hooks/useRevenueCat';

export default function SubscriptionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    isInitialized,
    isProMember,
    offerings,
    isLoading,
    error,
    purchasePackage,
    restorePurchases,
  } = useRevenueCat();

  const handlePurchase = async () => {
    if (!offerings?.monthly) {
      Alert.alert('エラー', '購入可能なプランがありません');
      return;
    }

    const success = await purchasePackage(offerings.monthly);
    if (success) {
      Alert.alert('成功', 'Proプランへのアップグレードが完了しました！');
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

  // Web platform message
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView style={styles.container}>
          <ThemedView style={styles.content}>
            <View style={styles.headerSection}>
              <ThemedText type="title">⭐ プラン</ThemedText>
            </View>

            <View style={[styles.webNoticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.webNoticeIcon}>📱</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.webNoticeTitle}>
                モバイルアプリをご利用ください
              </ThemedText>
              <ThemedText style={styles.webNoticeText}>
                サブスクリプションの購入・管理は、iOSまたはAndroidアプリからのみ可能です。
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
            <ThemedText type="title">⭐ プラン</ThemedText>
            <ThemedText style={styles.subtitle}>
              学習をもっと快適に
            </ThemedText>
          </View>

          {/* Current Status */}
          <View style={[styles.statusCard, {
            backgroundColor: isProMember ? '#10B981' : colors.card,
            borderColor: isProMember ? '#10B981' : colors.border
          }]}>
            <ThemedText style={[styles.statusIcon, isProMember && styles.whiteText]}>
              {isProMember ? '⭐' : '👤'}
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={[styles.statusTitle, isProMember && styles.whiteText]}>
              {isProMember ? 'Pro会員' : '無料会員'}
            </ThemedText>
            <ThemedText style={[styles.statusDescription, isProMember && styles.whiteText]}>
              {isProMember
                ? 'すべての機能をご利用いただけます'
                : 'すべての問題を無料でご利用いただけます'}
            </ThemedText>
          </View>

          {/* Error Display */}
          {error && (
            <View style={[styles.errorCard, { borderColor: '#EF4444' }]}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Pro Benefits */}
          <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText type="subtitle" style={styles.benefitsTitle}>
              Proプランの特典
            </ThemedText>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                <ThemedText style={styles.benefitText}>広告なしで快適に学習</ThemedText>
              </View>
              <View style={styles.benefitItem}>
                <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                <ThemedText style={styles.benefitText}>オフライン学習機能（予定）</ThemedText>
              </View>
              <View style={styles.benefitItem}>
                <ThemedText style={styles.benefitIcon}>✓</ThemedText>
                <ThemedText style={styles.benefitText}>詳細な学習統計（予定）</ThemedText>
              </View>
            </View>
          </View>

          {/* Pricing */}
          {offerings && !isProMember && (
            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: '#0a7ea4' }]}>
              <ThemedText type="subtitle" style={styles.pricingTitle}>
                月額プラン
              </ThemedText>
              {offerings.monthly && (
                <>
                  <ThemedText style={styles.price}>
                    {offerings.monthly.product.priceString}
                    <ThemedText style={styles.pricePeriod}> / 月</ThemedText>
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.purchaseButton, isLoading && styles.disabledButton]}
                    onPress={handlePurchase}
                    disabled={isLoading}
                  >
                    <ThemedText style={styles.purchaseButtonText}>
                      {isLoading ? '処理中...' : 'Proにアップグレード'}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              )}
              {!offerings.monthly && (
                <ThemedText style={styles.noOfferingText}>
                  現在購入可能なプランがありません
                </ThemedText>
              )}
            </View>
          )}

          {/* Restore Purchases */}
          {!isProMember && (
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading}
            >
              <ThemedText style={styles.restoreButtonText}>
                購入を復元する
              </ThemedText>
            </TouchableOpacity>
          )}

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
  },
  statusCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    fontSize: 40,
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
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '400',
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
});
