# Task 009: フロントエンド API 統合

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 3時間 |
| 依存タスク | task008 |
| 成果物 | 実API接続完了 |

---

## 目的

フロントエンドアプリを Cloudflare Workers API に接続し、モックデータから実データへ移行する。

---

## 📚 学習ポイント：フロントエンドとバックエンドの連携

### API クライアントパターン

APIとの通信を一箇所にまとめると、保守性が向上します。

```
【API クライアントなし（悪い例）】

HomeScreen.tsx:
  fetch('https://api.example.com/questions')...

QuestionScreen.tsx:
  fetch('https://api.example.com/questions')...

→ URL変更時に全ファイル修正が必要...

【API クライアントあり（良い例）】

lib/api/client.ts:
  const API_URL = 'https://api.example.com'
  export const api = { get, post }

HomeScreen.tsx:
  api.get('/questions')

→ URL変更は1箇所だけ！
```

### Expo SecureStore とは？

ユーザーIDなど機密情報を安全に保存するためのストレージです。

```
【通常のAsyncStorage】
- 暗号化されていない
- 他のアプリからアクセス可能な場合がある
- 一般的なデータの保存向け

【SecureStore】
- iOS Keychain / Android Keystore で暗号化
- 他のアプリからアクセス不可
- 認証情報、トークンの保存向け

使い分け:
  - ユーザーID → SecureStore ✅
  - 設定値（ダークモード等）→ AsyncStorage
  - APIトークン → SecureStore ✅
```

### useEffect と API 呼び出し

コンポーネントがマウントされた時にAPIを呼ぶパターンです。

```typescript
useEffect(() => {
  async function loadData() {
    const data = await api.get('/questions');
    setQuestions(data);
  }
  loadData();
}, []); // 空配列 = マウント時に1回だけ実行

【useEffect の依存配列】
[] → コンポーネント表示時に1回だけ
[userId] → userId が変わるたびに実行
なし → 毎回のレンダリングで実行（注意！）
```

---

## 手順

### 1. 環境変数設定

`app.config.ts` または `.env` に API URL を設定:

```typescript
// app.config.ts
export default {
  expo: {
    // ... 既存設定
    extra: {
      apiUrl: process.env.API_URL || 'https://concrete-diagnostician-api.xxxxx.workers.dev',
    },
  },
};
```

`.env`:
```
API_URL=https://concrete-diagnostician-api.xxxxx.workers.dev
```

### 2. API クライアント作成

`lib/api/client.ts`:

```typescript
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8787';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'API request failed' };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Network error' };
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
```

### 3. ユーザー管理 Hook

`lib/api/users.ts`:

```typescript
import { api } from './client';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';

interface User {
  id: string;
  deviceId: string;
  createdAt: string;
}

const USER_ID_KEY = 'user_id';

export async function getOrCreateUser(): Promise<User | null> {
  // キャッシュ確認
  const cachedUserId = await SecureStore.getItemAsync(USER_ID_KEY);

  // デバイスID生成
  const deviceId = Device.deviceName || `device-${Date.now()}`;

  // ユーザー登録/取得
  const response = await api.post<{ user: User; isNew: boolean }>(
    '/api/users/register',
    { deviceId }
  );

  if (response.error || !response.data) {
    console.error('Failed to get/create user:', response.error);
    return null;
  }

  // ユーザーIDをキャッシュ
  await SecureStore.setItemAsync(USER_ID_KEY, response.data.user.id);

  return response.data.user;
}

export async function getCurrentUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}
```

### 4. 問題 API Hook

`lib/api/questions.ts`:

```typescript
import { api } from './client';

export interface Question {
  id: string;
  year: number;
  number: number;
  category: string;
  text: string;
  choices: { id: string; text: string }[];
  correctChoiceId: string;
  explanation: string;
}

export interface QuestionListItem {
  id: string;
  year: number;
  number: number;
  category: string;
}

export interface YearSummary {
  year: number;
  totalQuestions: number;
}

export async function fetchYears(): Promise<YearSummary[]> {
  const response = await api.get<{ years: YearSummary[] }>('/api/questions/years');
  return response.data?.years || [];
}

export async function fetchQuestionsByYear(year: number): Promise<QuestionListItem[]> {
  const response = await api.get<{ questions: QuestionListItem[] }>(
    `/api/questions/${year}`
  );
  return response.data?.questions || [];
}

export async function fetchQuestion(year: number, id: string): Promise<Question | null> {
  const response = await api.get<{ question: Question }>(
    `/api/questions/${year}/${id}`
  );
  return response.data?.question || null;
}
```

### 5. 解答 API Hook

`lib/api/answers.ts`:

```typescript
import { api } from './client';

export interface Answer {
  id: number;
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
  answeredAt: string;
}

export async function saveAnswer(
  userId: string,
  questionId: string,
  selectedChoice: string,
  isCorrect: boolean
): Promise<Answer | null> {
  const response = await api.post<{ answer: Answer }>('/api/answers', {
    userId,
    questionId,
    selectedChoice,
    isCorrect,
  });
  return response.data?.answer || null;
}

export async function fetchUserAnswers(userId: string): Promise<Answer[]> {
  const response = await api.get<{ answers: Answer[] }>(
    `/api/answers/user/${userId}`
  );
  return response.data?.answers || [];
}
```

### 6. 進捗 API Hook

`lib/api/progress.ts`:

```typescript
import { api } from './client';

export interface OverallProgress {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyStreak: number;
  lastStudyDate: string | null;
}

export interface YearProgress {
  year: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

export interface UserProgress {
  userId: string;
  overall: OverallProgress;
  byYear: YearProgress[];
  byCategory: { category: string; totalQuestions: number; answeredQuestions: number; correctAnswers: number; accuracy: number }[];
}

export async function fetchProgress(userId: string): Promise<UserProgress | null> {
  const response = await api.get<{ progress: UserProgress }>(
    `/api/progress/${userId}`
  );
  return response.data?.progress || null;
}

export async function fetchYearProgress(userId: string, year: number) {
  const response = await api.get<{
    year: number;
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    accuracy: number;
    questions: {
      questionId: string;
      number: number;
      category: string;
      isAnswered: boolean;
      isCorrect: boolean;
      answeredAt: string | null;
    }[];
  }>(`/api/progress/${userId}/year/${year}`);
  return response.data || null;
}
```

### 7. 依存パッケージインストール

```bash
npx expo install expo-secure-store expo-device expo-constants
```

### 8. 既存コンポーネントの更新

ホーム画面の年度リスト更新例:

```typescript
// app/(tabs)/index.tsx
import { useEffect, useState } from 'react';
import { fetchYears, YearSummary } from '@/lib/api/questions';
import { fetchProgress, YearProgress } from '@/lib/api/progress';
import { getOrCreateUser } from '@/lib/api/users';

export default function HomeScreen() {
  const [years, setYears] = useState<YearSummary[]>([]);
  const [progress, setProgress] = useState<YearProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // ユーザー取得/作成
        const user = await getOrCreateUser();
        if (!user) return;

        // 年度一覧取得
        const yearsData = await fetchYears();
        setYears(yearsData);

        // 進捗取得
        const progressData = await fetchProgress(user.id);
        if (progressData) {
          setProgress(progressData.byYear);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ... 残りのコンポーネント実装
}
```

### 9. モックデータの削除

実API接続完了後、以下を削除:
- `data/mockQuestions.ts`（存在する場合）
- モックデータを返していたローカル関数

### 10. オフラインキャッシュ対応（オプション）

`lib/api/cache.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'api_cache_';
const CACHE_TTL = 1000 * 60 * 60; // 1時間

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Cache error:', error);
  }
}
```

---

## ディレクトリ構造

```
lib/
├── api/
│   ├── client.ts       # API クライアント基盤
│   ├── users.ts        # ユーザー API
│   ├── questions.ts    # 問題 API
│   ├── answers.ts      # 解答 API
│   ├── progress.ts     # 進捗 API
│   └── cache.ts        # キャッシュユーティリティ
```

---

## 完了条件

- [ ] API クライアント作成完了
- [ ] ユーザー管理 Hook 実装完了
- [ ] 問題 API Hook 実装完了
- [ ] 解答 API Hook 実装完了
- [ ] 進捗 API Hook 実装完了
- [ ] 依存パッケージインストール完了
- [ ] ホーム画面で年度一覧が表示される
- [ ] 問題演習画面で実問題が表示される
- [ ] 解答がサーバーに保存される
- [ ] 進捗がサーバーから取得できる
- [ ] モックデータ削除完了

---

## 次のタスク

→ [task010-quality-assurance.md](./task010-quality-assurance.md)
