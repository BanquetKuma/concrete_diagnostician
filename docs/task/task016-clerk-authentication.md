# Task 016: Clerk 認証機能実装

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 7 - 認証機能追加 |
| 工数 | 10-12時間（約2日） |
| 依存タスク | task009（API統合完了） |
| 成果物 | Google認証対応のユーザー認証システム |
| 費用 | 無料（10,000 MAUまで） |

---

## 目的

デバイスIDベースの簡易認証から、Clerkを使用した本格的な認証システムに移行する。
これにより、機種変更時のデータ引き継ぎ、複数デバイスでの利用が可能になる。

---

## なぜ Clerk を選択したか

| 比較項目 | Clerk | Supabase Auth |
|---------|-------|---------------|
| 無料枠 | 10,000 MAU | 50,000 MAU |
| Expo統合 | 公式SDK充実 | 設定が複雑 |
| Expo Go対応 | 対応 | 開発ビルド必要 |
| Google認証 | 簡単 | 複雑 |
| 既存構成との相性 | 変更不要 | DB連携考慮必要 |

**結論**: 実装工数の少なさとExpo Goでの開発効率を優先してClerkを採用。

---

## 工数内訳

| タスク | 工数 |
|--------|------|
| 16.1 Clerkアカウント・ダッシュボード設定 | 1時間 |
| 16.2 Expoプロジェクトへの統合 | 2時間 |
| 16.3 認証画面UI実装 | 3時間 |
| 16.4 既存UserServiceの移行 | 2時間 |
| 16.5 バックエンドAPI連携 | 2時間 |
| 16.6 テスト・デバッグ | 2時間 |
| **合計** | **12時間** |

---

## 16.1 Clerkアカウント・ダッシュボード設定

### 工数: 1時間

### 手順

1. **Clerkアカウント作成**
   - https://clerk.com にアクセス
   - GitHubまたはメールでサインアップ

2. **新規アプリケーション作成**
   - ダッシュボードで「Create application」
   - アプリ名: `Concrete Diagnostician`

3. **認証方法の設定**
   - Email（必須）: 有効化
   - Google OAuth: 有効化
   - Apple（任意）: 後で追加可能

4. **Google OAuth設定**
   - Google Cloud Consoleでプロジェクト作成
   - OAuth同意画面の設定
   - OAuth 2.0クライアントID作成（Web application）
   - ClerkダッシュボードにClient ID/Secretを登録

5. **API Keysの取得**
   - `CLERK_PUBLISHABLE_KEY` をコピー
   - Native API を有効化（Clerk Dashboard → Native Applications）

### チェックリスト

- [ ] Clerkアカウント作成
- [ ] アプリケーション作成
- [ ] Google OAuth設定完了
- [ ] Native API有効化
- [ ] Publishable Key取得

---

## 16.2 Expoプロジェクトへの統合

### 工数: 2時間

### 依存パッケージインストール

```bash
npx expo install @clerk/clerk-expo expo-secure-store expo-web-browser expo-linking
```

### 環境変数設定

`.env` ファイル:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

### ClerkProvider設定

`app/_layout.tsx`:
```typescript
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

// トークンキャッシュの設定
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      // 保存失敗時は無視
    }
  },
};

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        {/* 既存のUserProviderを置き換え */}
        <Stack />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

### チェックリスト

- [ ] パッケージインストール完了
- [ ] 環境変数設定
- [ ] ClerkProvider設定
- [ ] アプリ起動確認

---

## 16.3 認証画面UI実装

### 工数: 3時間

### ディレクトリ構造

```
app/
├── (auth)/                    # 認証が必要なルート
│   ├── _layout.tsx
│   └── (tabs)/
│       ├── index.tsx          # ホーム
│       └── stats.tsx          # 統計
├── (public)/                  # 認証不要のルート
│   ├── sign-in.tsx            # サインイン画面
│   └── sign-up.tsx            # サインアップ画面
└── _layout.tsx                # ルートレイアウト
```

### サインイン画面

`app/(public)/sign-in.tsx`:
```typescript
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;

    try {
      const redirectUrl = Linking.createURL('/');

      const { createdSessionId, signIn: signInResult } = await signIn.create({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        router.replace('/(auth)/(tabs)');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>コンクリート診断士</Text>
      <Text style={styles.subtitle}>試験対策アプリ</Text>

      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
        <Text style={styles.googleButtonText}>Googleでサインイン</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(public)/sign-up')}>
        <Text style={styles.linkText}>アカウントをお持ちでない方</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 20,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#4285F4',
    fontSize: 14,
  },
});
```

### 認証ガード（ルートレイアウト）

`app/_layout.tsx` に認証チェックを追加:
```typescript
import { useAuth } from '@clerk/clerk-expo';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

function useProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && !inAuthGroup) {
      // サインイン済みで認証外ページにいる場合、ホームへ
      router.replace('/(auth)/(tabs)');
    } else if (!isSignedIn && inAuthGroup) {
      // 未サインインで認証ページにいる場合、サインインへ
      router.replace('/(public)/sign-in');
    }
  }, [isSignedIn, isLoaded, segments]);
}
```

### チェックリスト

- [ ] ルート構造の変更
- [ ] サインイン画面実装
- [ ] サインアップ画面実装
- [ ] 認証ガード実装
- [ ] Google認証動作確認

---

## 16.4 既存UserServiceの移行

### 工数: 2時間

### 変更内容

**Before (デバイスIDベース)**:
```typescript
// lib/services/userService.ts
const deviceId = generateDeviceId();
const response = await apiClient.registerUser(deviceId);
```

**After (Clerk)**:
```typescript
// hooks/useClerkUser.ts
import { useUser } from '@clerk/clerk-expo';

export function useClerkUser() {
  const { user, isLoaded } = useUser();

  return {
    userId: user?.id,           // Clerk User ID
    email: user?.primaryEmailAddress?.emailAddress,
    isLoaded,
  };
}
```

### UserContextの更新

`contexts/UserContext.tsx`:
```typescript
import { useUser } from '@clerk/clerk-expo';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  const contextValue = {
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      createdAt: user.createdAt?.toISOString() || '',
    } : null,
    isLoading: !isLoaded,
    isInitialized: isLoaded,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}
```

### データマイグレーション戦略

既存のデバイスIDベースユーザーからの移行:

```typescript
// 初回サインイン時に既存データを紐付け
async function migrateUserData(clerkUserId: string) {
  const existingDeviceId = await SecureStore.getItemAsync('concrete_diagnostician_device_id');

  if (existingDeviceId) {
    // バックエンドAPIで既存データを新ユーザーに紐付け
    await api.post('/api/users/migrate', {
      clerkUserId,
      deviceId: existingDeviceId,
    });
  }
}
```

### チェックリスト

- [ ] UserContext更新
- [ ] 既存UserService削除/無効化
- [ ] データマイグレーション実装
- [ ] 動作確認

---

## 16.5 バックエンドAPI連携

### 工数: 2時間

### Cloudflare Workers更新

`workers/src/routes/users.ts`:
```typescript
import { Hono } from 'hono';

const users = new Hono();

// Clerk Webhook または直接連携
users.post('/sync', async (c) => {
  const { clerkUserId, email } = await c.req.json();

  // 既存ユーザーを検索（メールアドレスで）
  const existing = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email],
  });

  if (existing.rows.length > 0) {
    // 既存ユーザーにClerk IDを紐付け
    await db.execute({
      sql: 'UPDATE users SET clerk_id = ? WHERE email = ?',
      args: [clerkUserId, email],
    });
    return c.json({ status: 'linked' });
  }

  // 新規ユーザー作成
  await db.execute({
    sql: 'INSERT INTO users (id, clerk_id, email, created_at) VALUES (?, ?, ?, ?)',
    args: [crypto.randomUUID(), clerkUserId, email, new Date().toISOString()],
  });

  return c.json({ status: 'created' }, 201);
});

// データマイグレーション
users.post('/migrate', async (c) => {
  const { clerkUserId, deviceId } = await c.req.json();

  // デバイスIDベースの学習履歴をClerkユーザーに移行
  await db.execute({
    sql: 'UPDATE answers SET user_id = ? WHERE user_id = (SELECT id FROM users WHERE device_id = ?)',
    args: [clerkUserId, deviceId],
  });

  return c.json({ status: 'migrated' });
});

export { users };
```

### DBスキーマ更新

```sql
-- usersテーブルに clerk_id カラム追加
ALTER TABLE users ADD COLUMN clerk_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email TEXT;

-- インデックス追加
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
```

### チェックリスト

- [ ] usersテーブルスキーマ更新
- [ ] /api/users/sync エンドポイント実装
- [ ] /api/users/migrate エンドポイント実装
- [ ] Workersデプロイ
- [ ] API動作確認

---

## 16.6 テスト・デバッグ

### 工数: 2時間

### テストシナリオ

| # | シナリオ | 期待結果 |
|---|---------|---------|
| 1 | 新規ユーザーがGoogleでサインアップ | アカウント作成、ホーム画面表示 |
| 2 | 既存ユーザーがGoogleでサインイン | 学習履歴が保持されている |
| 3 | サインアウト | サインイン画面に戻る |
| 4 | 別デバイスでサインイン | 同じ学習履歴が表示される |
| 5 | デバイスIDユーザーの移行 | 既存データがClerkユーザーに紐付く |
| 6 | オフライン時の動作 | エラーメッセージ表示 |

### デバッグチェックリスト

- [ ] Expo Goでの動作確認
- [ ] 開発ビルドでの動作確認
- [ ] Google認証フロー確認
- [ ] トークン永続化確認
- [ ] API連携確認
- [ ] エラーハンドリング確認

---

## ファイル変更一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `app/(public)/sign-in.tsx` | サインイン画面 |
| `app/(public)/sign-up.tsx` | サインアップ画面 |
| `app/(public)/_layout.tsx` | 公開ルートレイアウト |
| `app/(auth)/_layout.tsx` | 認証必須ルートレイアウト |
| `hooks/useClerkUser.ts` | Clerkユーザーフック |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `app/_layout.tsx` | ClerkProvider追加、認証ガード |
| `contexts/UserContext.tsx` | Clerk連携に変更 |
| `workers/src/routes/users.ts` | sync/migrateエンドポイント追加 |
| `.env` | CLERK_PUBLISHABLE_KEY追加 |
| `package.json` | Clerk依存パッケージ追加 |

### 削除候補

| ファイル | 理由 |
|---------|------|
| `lib/services/userService.ts` | Clerkに置き換え |

---

## 完了条件

- [ ] Clerkダッシュボード設定完了
- [ ] Google OAuth動作確認
- [ ] サインイン/サインアップ画面実装
- [ ] 認証ガード動作確認
- [ ] 既存学習履歴の移行動作確認
- [ ] 複数デバイスでのデータ同期確認
- [ ] エラーハンドリング実装
- [ ] 全テストシナリオ合格

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Google OAuth設定ミス | 認証不可 | Clerkドキュメントに従って設定 |
| 既存ユーザーデータ消失 | ユーザー離脱 | マイグレーション機能で対応 |
| Clerk障害 | サービス停止 | オフラインキャッシュで最低限動作 |
| MAU上限超過 | 課金発生 | 利用状況モニタリング |

---

## 参考リンク

- [Clerk Expo Quickstart](https://clerk.com/docs/quickstarts/expo)
- [Clerk Google OAuth](https://clerk.com/docs/authentication/social-connections/google)
- [@clerk/clerk-expo npm](https://www.npmjs.com/package/@clerk/clerk-expo)
- [Expo Router Authentication](https://docs.expo.dev/router/reference/authentication/)

---

## 次のタスク

認証機能実装後:
- App Storeリリース準備（task012へ戻る）
- または、RAG質問機能の実装（MVP_NEXT_PHASE_PLANへ）

---

_作成日: 2025-12-29_
