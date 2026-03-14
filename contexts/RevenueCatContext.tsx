import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

const ENTITLEMENT_ID = 'pro';
const PRO_STATUS_CACHE_KEY = 'revenuecat_pro_status';
const MAX_INIT_RETRIES = 3;
const isExpoGo = Constants.appOwnership === 'expo';

interface RevenueCatContextValue {
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

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

interface RevenueCatProviderProps {
  children: React.ReactNode;
  clerkUserId: string | null | undefined;
}

export function RevenueCatProvider({ children, clerkUserId }: RevenueCatProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProMember, setIsProMember] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  // Load cached Pro status from SecureStore
  const loadCachedProStatus = useCallback(async () => {
    try {
      const cached = await SecureStore.getItemAsync(PRO_STATUS_CACHE_KEY);
      if (cached === 'true') {
        setIsProMember(true);
      }
    } catch {
      // Ignore cache read errors
    }
  }, []);

  // Persist Pro status to SecureStore
  const cacheProStatus = useCallback(async (isPro: boolean) => {
    try {
      await SecureStore.setItemAsync(PRO_STATUS_CACHE_KEY, isPro ? 'true' : 'false');
    } catch {
      // Ignore cache write errors
    }
  }, []);

  const updateProStatus = useCallback((info: CustomerInfo) => {
    const isPro = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    setIsProMember(isPro);
    cacheProStatus(isPro);
  }, [cacheProStatus]);

  // Initialize RevenueCat with retry
  const initializeRevenueCat = useCallback(async () => {
    if (Platform.OS === 'web' || isExpoGo) {
      setIsLoading(false);
      if (Platform.OS === 'web') {
        setError('サブスクリプションはモバイルアプリでのみ利用可能です');
      }
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

      Purchases.configure({ apiKey });
      setIsInitialized(true);

      // ClerkユーザーIDでlogInし、匿名IDと紐づける
      let info: CustomerInfo;
      if (clerkUserId) {
        const { customerInfo: logInInfo } = await Purchases.logIn(clerkUserId);
        info = logInInfo;
      } else {
        info = await Purchases.getCustomerInfo();
      }
      setCustomerInfo(info);
      updateProStatus(info);

      const allOfferings = await Purchases.getOfferings();
      if (allOfferings.current) {
        setOfferings(allOfferings.current);
      }

      setError(null);
      setIsLoading(false);
      retryCountRef.current = 0;
    } catch (err) {
      console.error('Failed to initialize RevenueCat:', err);

      // On failure, keep cached Pro status (don't reset isProMember)
      // Schedule retry with exponential backoff
      if (retryCountRef.current < MAX_INIT_RETRIES) {
        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          initializeRevenueCat();
        }, delay);
        setError('課金システムに接続中...');
      } else {
        setError('課金システムの初期化に失敗しました');
      }
      setIsLoading(false);
    }
  }, [clerkUserId, updateProStatus]);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web' || isExpoGo || !isInitialized) return;

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      updateProStatus(info);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh customer info:', err);
      // Keep existing Pro status on refresh failure
    }
  }, [isInitialized, updateProStatus]);

  // Ensure RevenueCat is logged in with Clerk User ID before purchase/restore
  const ensureLoggedIn = useCallback(async () => {
    if (clerkUserId) {
      try {
        await Purchases.logIn(clerkUserId);
      } catch (err) {
        console.error('RevenueCat logIn failed:', err);
      }
    }
  }, [clerkUserId]);

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

        // Clerk User ID でログイン済みであることを保証（匿名IDへの購入紐付けを防止）
        await ensureLoggedIn();

        const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(newInfo);
        updateProStatus(newInfo);

        setIsLoading(false);
        return newInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      } catch (err: unknown) {
        setIsLoading(false);

        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          return false;
        }

        const errorMessage =
          err instanceof Error ? err.message : '購入処理に失敗しました';
        setError(errorMessage);
        console.error('Purchase failed:', err);
        return false;
      }
    },
    [isInitialized, ensureLoggedIn, updateProStatus]
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

      // Clerk User ID でログイン済みであることを保証（正しい顧客コンテキストで復元）
      await ensureLoggedIn();

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
  }, [isInitialized, ensureLoggedIn, updateProStatus]);

  // Load cached status on mount, then initialize
  useEffect(() => {
    loadCachedProStatus().then(() => {
      initializeRevenueCat();
    });
  }, [loadCachedProStatus, initializeRevenueCat]);

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
  }, [isInitialized, updateProStatus]);

  // Handle clerkUserId changes (login/logout)
  useEffect(() => {
    if (Platform.OS === 'web' || isExpoGo || !isInitialized) return;

    const handleUserChange = async () => {
      try {
        if (clerkUserId) {
          const { customerInfo: logInInfo } = await Purchases.logIn(clerkUserId);
          setCustomerInfo(logInInfo);
          updateProStatus(logInInfo);
        } else {
          const info = await Purchases.logOut();
          setCustomerInfo(info);
          updateProStatus(info);
        }
      } catch (err) {
        console.error('RevenueCat user change failed:', err);
      }
    };

    handleUserChange();
  }, [clerkUserId, isInitialized, updateProStatus]);

  // AppState listener: refresh on foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        refreshCustomerInfo();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [refreshCustomerInfo]);

  const value: RevenueCatContextValue = {
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

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCatContext(): RevenueCatContextValue {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error('useRevenueCatContext must be used within a RevenueCatProvider');
  }
  return context;
}
