import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';

import { useColorScheme } from '@/hooks/useColorScheme';
import { UserProvider } from '@/contexts/UserContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
}

// 認証状態に基づくルート保護
function AuthGuard() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    // 初回マウント時にナビゲーション準備完了とする
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isNavigationReady) return;

    const inPublicGroup = segments[0] === '(public)';

    // サインイン済みでpublicグループにいる場合のみリダイレクト
    // 未サインインでもアプリ使用可能（ゲストアクセス）
    if (isSignedIn && inPublicGroup) {
      router.replace('/(tabs)');
    }
    // 注: 未サインインユーザーへの強制リダイレクトを削除（Apple Guideline 5.1.1対応）
  }, [isSignedIn, isLoaded, isNavigationReady]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <UserProvider>
      <RevenueCatProvider clerkUserId={userId}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Slot />
          <StatusBar style="auto" />
        </ThemeProvider>
      </RevenueCatProvider>
    </UserProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkLoaded>
        <AuthGuard />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
