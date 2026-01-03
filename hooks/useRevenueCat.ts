// React hook for RevenueCat subscription management

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

// Entitlement ID configured in RevenueCat dashboard
const ENTITLEMENT_ID = 'pro';

// Check if running in Expo Go (not a standalone build)
const isExpoGo = Constants.appOwnership === 'expo';

interface UseRevenueCatReturn {
  isInitialized: boolean;
  isProMember: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  isLoading: boolean;
  error: string | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

export const useRevenueCat = (): UseRevenueCatReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProMember, setIsProMember] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize RevenueCat
  const initializeRevenueCat = useCallback(async () => {
    // RevenueCat is not supported on web or Expo Go
    if (Platform.OS === 'web' || isExpoGo) {
      setIsLoading(false);
      // Don't show error in Expo Go - it's expected behavior
      if (Platform.OS === 'web') {
        setError('サブスクリプションはモバイルアプリでのみ利用可能です');
      }
      // In Expo Go, silently skip - subscriptions will work in production build
      return;
    }

    try {
      const apiKey =
        Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
          : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

      if (!apiKey || apiKey.includes('YOUR_')) {
        setIsLoading(false);
        setError('RevenueCat APIキーが設定されていません');
        return;
      }

      // Configure RevenueCat
      Purchases.configure({ apiKey });
      setIsInitialized(true);

      // Get initial customer info
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      updateProStatus(info);

      // Get offerings
      const allOfferings = await Purchases.getOfferings();
      if (allOfferings.current) {
        setOfferings(allOfferings.current);
        // Debug: Log price data to verify what RevenueCat returns
        if (allOfferings.current.monthly) {
          console.log('[RevenueCat Debug] Monthly product:', {
            priceString: allOfferings.current.monthly.product.priceString,
            price: allOfferings.current.monthly.product.price,
            currencyCode: allOfferings.current.monthly.product.currencyCode,
            identifier: allOfferings.current.monthly.product.identifier,
          });
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize RevenueCat:', err);
      setError('課金システムの初期化に失敗しました');
      setIsLoading(false);
    }
  }, []);

  // Check if user has pro entitlement
  const updateProStatus = (info: CustomerInfo) => {
    const isPro =
      info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    setIsProMember(isPro);
  };

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web' || isExpoGo || !isInitialized) return;

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      updateProStatus(info);
    } catch (err) {
      console.error('Failed to refresh customer info:', err);
    }
  }, [isInitialized]);

  // Purchase a package
  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      if (Platform.OS === 'web' || isExpoGo || !isInitialized) {
        setError('この環境では購入できません（本番ビルドでご利用ください）');
        return false;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(newInfo);
        updateProStatus(newInfo);

        setIsLoading(false);
        return newInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      } catch (err: unknown) {
        setIsLoading(false);

        // Check if user cancelled
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          // User cancelled, not an error
          return false;
        }

        const errorMessage =
          err instanceof Error ? err.message : '購入処理に失敗しました';
        setError(errorMessage);
        console.error('Purchase failed:', err);
        return false;
      }
    },
    [isInitialized]
  );

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || isExpoGo || !isInitialized) {
      setError('この環境では復元できません（本番ビルドでご利用ください）');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      updateProStatus(info);

      setIsLoading(false);

      const restored = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      if (!restored) {
        setError('復元可能な購入が見つかりませんでした');
      }
      return restored;
    } catch (err) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : '購入の復元に失敗しました';
      setError(errorMessage);
      console.error('Restore failed:', err);
      return false;
    }
  }, [isInitialized]);

  // Initialize on mount
  useEffect(() => {
    initializeRevenueCat();
  }, [initializeRevenueCat]);

  // Listen for customer info updates
  useEffect(() => {
    if (Platform.OS === 'web' || isExpoGo || !isInitialized) return;

    const customerInfoListener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      updateProStatus(info);
    };

    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, [isInitialized]);

  return {
    isInitialized,
    isProMember,
    customerInfo,
    offerings,
    isLoading,
    error,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
  };
};
