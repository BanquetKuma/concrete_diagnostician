import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';

// WebBrowserセッションの処理を完了させる（OAuth redirect後）
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const redirectUrl = Linking.createURL('/');

      // SSO flow for Google
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId) {
        await ssoSetActive!({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.errors?.[0]?.message || 'サインインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, startSSOFlow, router]);

  const handleGitHubSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const redirectUrl = Linking.createURL('/');

      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_github',
        redirectUrl,
      });

      if (createdSessionId) {
        await ssoSetActive!({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('GitHub sign-in error:', err);
      setError(err.errors?.[0]?.message || 'サインインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, startSSOFlow, router]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>コンクリート診断士</Text>
        <Text style={styles.subtitle}>試験対策アプリ</Text>
      </View>

      <View style={styles.buttonContainer}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Googleでサインイン</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.githubButton]}
          onPress={handleGitHubSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>GitHubでサインイン</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        サインインすることで、学習履歴を保存できます
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  githubButton: {
    backgroundColor: '#24292e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  footerText: {
    marginTop: 40,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
