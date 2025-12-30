# Task 016: Clerk 認証機能実装

## 基本情報

| 項目       | 内容                                 |
| ---------- | ------------------------------------ |
| Phase      | 7 - 認証機能追加                     |
| 工数       | 10-12時間（約2日）                   |
| 依存タスク | task009（API統合完了）               |
| 成果物     | Google認証対応のユーザー認証システム |
| 費用       | 無料（10,000 MAUまで）               |

---

## 目的

デバイスIDベースの簡易認証から、Clerkを使用した本格的な認証システムに移行する。
これにより、機種変更時のデータ引き継ぎ、複数デバイスでの利用が可能になる。

---

## なぜ Clerk を選択したか

| 比較項目         | Clerk       | Supabase Auth  |
| ---------------- | ----------- | -------------- |
| 無料枠           | 10,000 MAU  | 50,000 MAU     |
| Expo統合         | 公式SDK充実 | 設定が複雑     |
| Expo Go対応      | 対応        | 開発ビルド必要 |
| Google認証       | 簡単        | 複雑           |
| 既存構成との相性 | 変更不要    | DB連携考慮必要 |

**結論**: 実装工数の少なさとExpo Goでの開発効率を優先してClerkを採用。

---

## 工数内訳

| タスク                                   | 工数       |
| ---------------------------------------- | ---------- |
| 16.1 Clerkアカウント・ダッシュボード設定 | 1時間      |
| 16.2 Expoプロジェクトへの統合            | 2時間      |
| 16.3 認証画面UI実装                      | 3時間      |
| 16.4 既存UserServiceの移行               | 2時間      |
| 16.5 バックエンドAPI連携                 | 2時間      |
| 16.6 テスト・デバッグ                    | 2時間      |
| **合計**                                 | **12時間** |

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

4. **Google OAuth設定**（詳細は下記「Google OAuth設定 詳細手順」を参照）

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

## Google OAuth設定 詳細手順

### Step 1: Google Cloud Console でプロジェクト作成

#### 1.1 Google Cloud Console にアクセス

1. ブラウザで [Google Cloud Console](https://console.cloud.google.com/) を開く
2. Googleアカウントでログイン（開発用のGoogleアカウント推奨）

#### 1.2 新規プロジェクト作成

1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. 以下を入力:
   - **プロジェクト名**: `concrete-diagnostician` （任意の名前）
   - **組織**: 個人の場合は「組織なし」
   - **場所**: デフォルトのまま
4. 「作成」をクリック
5. 作成完了後、そのプロジェクトが選択されていることを確認

---

### Step 2: OAuth 同意画面の設定

#### 2.1 OAuth 同意画面に移動

1. 左メニューから「APIとサービス」→「OAuth 同意画面」を選択
2. 「始める」または「Get Started」をクリック

#### 2.2 ユーザータイプの選択

| タイプ   | 説明                   | 推奨場面                           |
| -------- | ---------------------- | ---------------------------------- |
| **内部** | 組織内ユーザーのみ     | Google Workspace利用時             |
| **外部** | すべてのGoogleユーザー | **一般公開アプリ（こちらを選択）** |

→ **「外部」を選択**して「作成」をクリック

#### 2.3 アプリ情報の入力

**OAuth 同意画面**タブで以下を入力:

| 項目                         | 入力値                        | 備考                     |
| ---------------------------- | ----------------------------- | ------------------------ |
| アプリ名                     | `コンクリート診断士`          | ユーザーに表示される名前 |
| ユーザーサポートメール       | 自分のメールアドレス          | 問い合わせ先             |
| アプリのロゴ                 | （任意）アプリアイコン        | 後から設定可能           |
| アプリのホームページ         | `https://yourapp.com`         | 本番URL（仮でOK）        |
| アプリのプライバシーポリシー | `https://yourapp.com/privacy` | App Store申請時に必要    |
| アプリの利用規約             | `https://yourapp.com/terms`   | （任意）                 |
| 承認済みドメイン             | `yourapp.com`                 | 本番ドメイン             |
| デベロッパーの連絡先情報     | 自分のメールアドレス          | Google からの通知用      |

「保存して次へ」をクリック

#### 2.4 スコープの設定

**スコープ**タブ:

1. 「スコープを追加または削除」をクリック
2. 以下の**基本スコープ**を選択:
   - `email` - ユーザーのメールアドレス
   - `profile` - ユーザーの基本プロフィール
   - `openid` - OpenID Connect認証
3. 「更新」をクリック
4. 「保存して次へ」をクリック

> **注意**: 機密性の高いスコープ（カレンダー、ドライブ等）は選択しない。追加するとGoogle審査が厳しくなる。

#### 2.5 テストユーザーの追加

**テストユーザー**タブ:

1. 「+ ADD USERS」をクリック
2. テスト用のGoogleアカウントのメールアドレスを追加
   - 自分のメールアドレス
   - テスターのメールアドレス（最大100人）
3. 「保存して次へ」をクリック

> **重要**: 「公開ステータス」が「テスト」の間は、ここに登録したユーザーのみがログイン可能。

#### 2.6 概要の確認

内容を確認して「ダッシュボードに戻る」をクリック

---

### Step 3: OAuth 2.0 クライアントID作成

#### 3.1 認証情報ページに移動

1. 左メニューから「APIとサービス」→「認証情報」を選択
2. 「+ 認証情報を作成」→「OAuth クライアント ID」をクリック

#### 3.2 アプリケーションの種類を選択

| 種類                   | 用途                        |
| ---------------------- | --------------------------- |
| ウェブアプリケーション | **Clerkの場合はこれを選択** |
| Android                | ネイティブAndroidアプリ     |
| iOS                    | ネイティブiOSアプリ         |
| デスクトップアプリ     | PC用アプリ                  |

→ **「ウェブアプリケーション」を選択**

> **なぜウェブアプリケーション？**: Clerkがサーバーサイドで認証を処理するため。Expo/React NativeからはClerk経由でGoogle認証を行う。

#### 3.3 クライアントID詳細の入力

| 項目 | 入力値                        |
| ---- | ----------------------------- |
| 名前 | `Clerk OAuth Client` （任意） |

**承認済みの JavaScript 生成元**（Authorized JavaScript origins）:

```
https://your-clerk-domain.clerk.accounts.dev
```

（開発環境の場合。Clerkダッシュボードで確認）

**承認済みのリダイレクト URI**（Authorized redirect URIs）:

⚠️ **重要**: この値はClerkダッシュボードからコピーする

1. 別タブで [Clerk Dashboard](https://dashboard.clerk.com/) を開く
2. 「SSO Connections」→「Add connection」→「Google」を選択
3. 「Use custom credentials」をON
4. 表示される **Authorized Redirect URI** をコピー
   - 形式: `https://your-app.clerk.accounts.dev/v1/oauth_callback`
5. Google Cloud Console に戻って貼り付け

#### 3.4 作成完了

「作成」をクリックすると、以下が表示される:

```
クライアント ID:     xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
クライアント シークレット: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **2025年6月以降の重要な変更**:

- クライアントシークレットは**作成時に1回だけ**表示される
- 必ずこの時点でコピーして安全な場所に保存すること
- 紛失した場合は新しいクライアントIDを作り直す必要がある

---

### Step 4: Clerk ダッシュボードに認証情報を登録

#### 4.1 Clerkダッシュボードを開く

1. [Clerk Dashboard](https://dashboard.clerk.com/) にアクセス
2. 対象のアプリケーションを選択

#### 4.2 Google接続の設定

1. 左メニューから「User & Authentication」→「Social Connections」を選択
2. 「Google」の行で「Manage」をクリック
3. 以下を設定:

| 項目                           | 設定値                             |
| ------------------------------ | ---------------------------------- |
| Enable for sign-up and sign-in | ✅ ON                              |
| Use custom credentials         | ✅ ON                              |
| Client ID                      | Google Cloud Consoleでコピーした値 |
| Client Secret                  | Google Cloud Consoleでコピーした値 |

4. 「Save」をクリック

#### 4.3 動作確認

1. Clerkダッシュボードの「Account Portal」プレビューを開く
2. 「Sign in with Google」ボタンをクリック
3. Googleログイン画面が表示されることを確認
4. テストユーザーでログインできることを確認

---

### Google OAuth トラブルシューティング

#### エラー: 「このアプリはGoogleで確認されていません」

**原因**: 公開ステータスが「テスト」のため

**対処法**:

- テスト段階: テストユーザーとして登録されたアカウントでログイン
- 本番公開時: OAuth同意画面で「アプリを公開」→ Googleの審査を受ける

#### エラー: 「redirect_uri_mismatch」

**原因**: リダイレクトURIの設定ミス

**対処法**:

1. ClerkダッシュボードのRedirect URIを再確認
2. Google Cloud Consoleの「承認済みのリダイレクト URI」と完全一致させる
3. `http://` と `https://` の違いに注意
4. 末尾のスラッシュ `/` の有無に注意

#### エラー: 「invalid_client」

**原因**: Client ID または Client Secret が間違っている

**対処法**:

1. Google Cloud ConsoleでClient IDを再確認
2. Clerkダッシュボードに正しくコピーされているか確認
3. 余分なスペースが含まれていないか確認

---

### 本番公開時の追加作業

#### Google審査の申請

テスト段階から本番公開するには:

1. Google Cloud Console →「OAuth 同意画面」
2. 「アプリを公開」をクリック
3. 審査に必要な情報:
   - プライバシーポリシーURL（必須）
   - アプリのデモ動画（推奨）
   - 使用するスコープの説明
4. 審査には数日〜数週間かかる場合がある

#### ドメイン認証（本番環境）

Clerkの本番環境では:

1. 独自ドメインが必要
2. DNSレコードの設定が必要
3. Clerkダッシュボードで確認手順が表示される

---

### Google OAuth設定 チェックリスト

- [ ] Google Cloud Console でプロジェクト作成完了
- [ ] OAuth 同意画面設定完了（外部、基本スコープ）
- [ ] テストユーザー追加完了
- [ ] OAuth 2.0 クライアントID作成完了
- [ ] Client ID / Client Secret を安全に保存
- [ ] Clerk ダッシュボードに認証情報登録完了
- [ ] Account Portal でGoogle認証動作確認完了

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
import { Platform } from 'react-native';  // ← Web対応に必要

// トークンキャッシュの設定（Web対応版）
// ※ expo-secure-storeはネイティブ専用のため、Webでは無効化する
// ※ WebではClerkが自動的にCookie/localStorageを使用する
const tokenCache = {
  async getToken(key: string) {
    // Webブラウザでは SecureStore が使えないのでスキップ
    if (Platform.OS === 'web') return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    // Webブラウザでは SecureStore が使えないのでスキップ
    if (Platform.OS === 'web') return;
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
    userId: user?.id, // Clerk User ID
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
users.post('/sync', async c => {
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
users.post('/migrate', async c => {
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

| #   | シナリオ                           | 期待結果                          |
| --- | ---------------------------------- | --------------------------------- |
| 1   | 新規ユーザーがGoogleでサインアップ | アカウント作成、ホーム画面表示    |
| 2   | 既存ユーザーがGoogleでサインイン   | 学習履歴が保持されている          |
| 3   | サインアウト                       | サインイン画面に戻る              |
| 4   | 別デバイスでサインイン             | 同じ学習履歴が表示される          |
| 5   | デバイスIDユーザーの移行           | 既存データがClerkユーザーに紐付く |
| 6   | オフライン時の動作                 | エラーメッセージ表示              |

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

| ファイル                   | 内容                     |
| -------------------------- | ------------------------ |
| `app/(public)/sign-in.tsx` | サインイン画面           |
| `app/(public)/sign-up.tsx` | サインアップ画面         |
| `app/(public)/_layout.tsx` | 公開ルートレイアウト     |
| `app/(auth)/_layout.tsx`   | 認証必須ルートレイアウト |
| `hooks/useClerkUser.ts`    | Clerkユーザーフック      |

### 変更

| ファイル                      | 変更内容                       |
| ----------------------------- | ------------------------------ |
| `app/_layout.tsx`             | ClerkProvider追加、認証ガード  |
| `contexts/UserContext.tsx`    | Clerk連携に変更                |
| `workers/src/routes/users.ts` | sync/migrateエンドポイント追加 |
| `.env`                        | CLERK_PUBLISHABLE_KEY追加      |
| `package.json`                | Clerk依存パッケージ追加        |

### 削除候補

| ファイル                      | 理由            |
| ----------------------------- | --------------- |
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

| リスク                 | 影響         | 対策                             |
| ---------------------- | ------------ | -------------------------------- |
| Google OAuth設定ミス   | 認証不可     | Clerkドキュメントに従って設定    |
| 既存ユーザーデータ消失 | ユーザー離脱 | マイグレーション機能で対応       |
| Clerk障害              | サービス停止 | オフラインキャッシュで最低限動作 |
| MAU上限超過            | 課金発生     | 利用状況モニタリング             |

---

## App Store 公開時の追加要件

App Store（iOS）への公開時には、認証機能に関連して以下の対応が必要。

### 1. Apple Developer Program への登録（必須）

| 項目       | 内容                                               |
| ---------- | -------------------------------------------------- |
| 費用       | 年額 $99（約15,000円）                             |
| タイミング | リリース直前でOK（登録完了まで数日かかる場合あり） |
| URL        | https://developer.apple.com/programs/              |

### 2. Sign in with Apple について（2024年ルール改定）

#### 旧ルール（2019年〜2024年1月）

> ソーシャルログイン（Google, Facebook等）を使う場合、Sign in with Appleも**必須**

#### 新ルール（2024年1月〜現在）

> ソーシャルログインを使う場合、以下のプライバシー要件を満たす**別のログインオプション**も提供すること:
>
> - データ収集を名前とメールアドレスに限定
> - メールアドレスを非公開にできる
> - アプリ利用をトラッキングしない

**実質的な意味**: Sign in with Appleはこれらの要件を満たすため、最も簡単な選択肢。**厳密には必須ではなくなったが、追加を推奨**。

#### Clerkでの Sign in with Apple 追加手順

1. Clerkダッシュボード → Social Connections → Apple
2. Apple Developer Programで「Sign in with Apple」を有効化
3. Service ID、Key ID、Team ID を取得
4. Clerkダッシュボードに登録

> **参考**: [Clerk Apple OAuth設定](https://clerk.com/docs/authentication/social-connections/apple)

### 3. プライバシーポリシー・サポートURL（必須）

App Store Connect での申請時に**必須入力**となる項目:

| 項目                    | 必須    | 内容                               |
| ----------------------- | ------- | ---------------------------------- |
| プライバシーポリシーURL | ✅ 必須 | 個人情報の取り扱いを記載したページ |
| サポートURL             | ✅ 必須 | ユーザーからの問い合わせ窓口       |
| 利用規約URL             | 任意    | サービス利用規約                   |

#### 簡単な作成方法

- **Notion**: 無料でページ作成、公開URL取得可能
- **GitHub Pages**: リポジトリに`privacy.md`を作成
- **無料ブログ**: はてなブログ、note等

#### プライバシーポリシーに記載すべき内容

```
1. 収集する情報（メールアドレス、学習履歴等）
2. 情報の利用目的
3. 第三者への提供の有無
4. データの保管期間
5. ユーザーの権利（削除請求等）
6. 問い合わせ先
```

### 4. アカウント削除機能（必須）

[App Store Review Guideline 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) により、**アプリ内からアカウント削除できる機能**が必須。

#### 要件

| 項目     | 要件                                                     |
| -------- | -------------------------------------------------------- |
| 削除方法 | アプリ内から実行可能であること（メール・電話対応は不可） |
| 削除範囲 | 一時停止ではなく完全削除                                 |
| 配置場所 | 設定画面など見つけやすい場所                             |
| 確認UI   | 確認ダイアログを表示（誤操作防止）                       |

#### 実装例

```typescript
// app/(auth)/settings.tsx
import { useClerk } from '@clerk/clerk-expo';

export default function SettingsScreen() {
  const { user } = useClerk();

  const handleDeleteAccount = async () => {
    Alert.alert(
      'アカウント削除',
      'アカウントを削除すると、すべての学習履歴が失われます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            // バックエンドでユーザーデータ削除
            await api.delete(`/api/users/${user?.id}`);
            // Clerkアカウント削除
            await user?.delete();
          },
        },
      ]
    );
  };

  return (
    <View>
      {/* 他の設定項目 */}
      <TouchableOpacity onPress={handleDeleteAccount}>
        <Text style={{ color: 'red' }}>アカウントを削除</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 5. Google Cloud 本番化

アプリ公開時に Google Cloud Console で以下の設定変更が必要:

| 項目                    | 対応内容                                 |
| ----------------------- | ---------------------------------------- |
| 承認済みドメイン        | 本番ドメインを追加                       |
| プライバシーポリシーURL | 実際のURLを入力                          |
| アプリロゴ              | 正式なアプリアイコンを設定               |
| 公開ステータス          | 「テスト」→「公開」に変更                |
| Google審査              | スコープに応じて審査申請（数日〜数週間） |

---

### App Store 公開時チェックリスト

| 項目                        | 状態   | 備考                  |
| --------------------------- | ------ | --------------------- |
| Apple Developer Program登録 | 未着手 | $99/年                |
| Sign in with Apple追加      | 未着手 | 推奨（必須ではない）  |
| プライバシーポリシー作成    | 未着手 | Notion/GitHub Pages等 |
| サポートURL作成             | 未着手 | 問い合わせフォーム    |
| アカウント削除機能実装      | 未着手 | 設定画面に配置        |
| Google Cloud本番化          | 未着手 | ドメイン・URL設定     |

---

## 参考リンク

### Clerk

- [Clerk Expo Quickstart](https://clerk.com/docs/quickstarts/expo)
- [Clerk Google OAuth](https://clerk.com/docs/authentication/social-connections/google)
- [Clerk Apple OAuth](https://clerk.com/docs/authentication/social-connections/apple)
- [@clerk/clerk-expo npm](https://www.npmjs.com/package/@clerk/clerk-expo)

### Expo

- [Expo Router Authentication](https://docs.expo.dev/router/reference/authentication/)

### Apple App Store

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Sign in with Apple requirement (9to5Mac - 2024年ルール変更)](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/)
- [Account deletion requirement](https://developer.apple.com/news/?id=12m75xbj)
- [Apple Developer Program](https://developer.apple.com/programs/)

### Google Cloud

- [Google Cloud Console](https://console.cloud.google.com/)
- [Setting up OAuth 2.0](https://support.google.com/cloud/answer/6158849)

---

## 次のタスク

認証機能実装後:

- App Storeリリース準備（task012へ戻る）
- または、RAG質問機能の実装（MVP_NEXT_PHASE_PLANへ）

---

_作成日: 2025-12-29_
