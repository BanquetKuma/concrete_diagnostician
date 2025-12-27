# 技術設計書

## 概要

本ドキュメントでは、コンクリート診断士試験対策アプリMVPの詳細な技術設計を定義します。

## システム全体アーキテクチャ

### 高レベルアーキテクチャ図

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Azure Cloud    │    │  External APIs  │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │React Native │ │    │ │Azure Functions│ │    │ │Azure OpenAI│ │
│ │   + Expo    │◄────┤ │              │◄┼────┤ │  Service    │ │
│ │             │ │    │ │  (Node.js)   │ │    │ │   (GPT-4)   │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │                 │
│ │   Zustand   │ │    │ │Azure Cosmos  │ │    │                 │
│ │  (State)    │ │    │ │      DB      │ │    │                 │
│ └─────────────┘ │    │ │   (NoSQL)    │ │    │                 │
│                 │    │ └──────────────┘ │    │                 │
│ ┌─────────────┐ │    │                  │    │                 │
│ │Secure Store │ │    │ ┌──────────────┐ │    │                 │
│ │ (Local)     │ │    │ │ Blob Storage │ │    │                 │
│ └─────────────┘ │    │ │   (Assets)   │ │    │                 │
└─────────────────┘    │ └──────────────┘ │    │                 │
                       └──────────────────┘    └─────────────────┘
```

## フロントエンド設計

### 技術スタック詳細

#### コア技術

- **React Native**: 0.79.5 - ネイティブパフォーマンスの実現
- **Expo SDK**: 53.0.0 - 開発効率化とクロスプラットフォーム対応
- **TypeScript**: 5.3.x - 型安全性と開発体験向上
- **Expo Router**: 4.x - ファイルベースルーティング

#### 状態管理アーキテクチャ

```typescript
// Zustandストア設計
interface AppState {
  // ユーザー状態
  user: {
    id: string | null;
    isInitialized: boolean;
  };

  // 問題・学習状態
  questions: {
    currentYear: number;
    currentQuestionId: string | null;
    answers: Record<string, AnswerData>;
    progress: Record<number, ProgressData>;
  };

  // UI状態
  ui: {
    isLoading: boolean;
    error: string | null;
    theme: 'light' | 'dark';
  };
}
```

#### コンポーネント設計パターン

```typescript
// 共通コンポーネント構造
interface ComponentProps {
  // 必須プロパティ
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// 高階コンポーネントパターン
export function withTheme<P extends object>(
  Component: ComponentType<P>
): ComponentType<P & ThemeProps> {
  return (props: P & ThemeProps) => {
    const colorScheme = useColorScheme();
    return <Component {...props} colors={Colors[colorScheme ?? 'light']} />;
  };
}
```

### ディレクトリ構造詳細

```
src/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   └── _layout.tsx    # Tab layout
│   ├── questions/         # Question screens
│   │   ├── [year]/        # Year-based routing
│   │   └── [id].tsx       # Individual question
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── ui/               # Basic UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ProgressBar.tsx
│   ├── themed/           # Theme-aware components
│   │   ├── ThemedView.tsx
│   │   └── ThemedText.tsx
│   └── features/         # Feature-specific components
│       ├── QuestionCard.tsx
│       ├── AnswerChoice.tsx
│       └── ExplanationView.tsx
├── hooks/                # Custom React hooks
│   ├── useColorScheme.ts
│   ├── useUserData.ts
│   └── useQuestions.ts
├── services/            # External service integrations
│   ├── api.ts           # Azure Functions client
│   ├── storage.ts       # Local storage utilities
│   └── analytics.ts     # Usage analytics
├── store/               # State management
│   ├── userStore.ts
│   ├── questionsStore.ts
│   └── uiStore.ts
├── types/               # TypeScript type definitions
│   ├── question.ts
│   ├── user.ts
│   └── api.ts
└── utils/               # Utility functions
    ├── constants.ts
    ├── validation.ts
    └── formatters.ts
```

## バックエンド設計

### Azure Functions 設計

#### API エンドポイント設計

```typescript
// ユーザー管理 API
POST / api / users; // ユーザー作成
GET / api / users / { userId }; // ユーザー情報取得

// 問題データ API
GET / api / questions / years; // 年度リスト取得
GET / api / questions / { year }; // 年度別問題リスト
GET / api / questions / { year } / { id }; // 個別問題詳細

// 学習履歴 API
POST / api / progress / answers; // 解答記録
GET / api / progress / { userId }; // 学習進捗取得
GET / api / progress / { userId } / { year }; // 年度別進捗取得

// コンテンツ管理 API (内部用)
POST / api / admin / content / generate; // AI解説生成
PUT / api / admin / content / approve; // 解説承認
```

#### Function App 構造

```
functions/
├── src/
│   ├── users/
│   │   ├── createUser.ts
│   │   └── getUser.ts
│   ├── questions/
│   │   ├── getQuestionYears.ts
│   │   ├── getQuestionsByYear.ts
│   │   └── getQuestionDetail.ts
│   ├── progress/
│   │   ├── recordAnswer.ts
│   │   └── getProgress.ts
│   ├── admin/
│   │   ├── generateExplanation.ts
│   │   └── approveContent.ts
│   ├── shared/
│   │   ├── database.ts
│   │   ├── azure-openai.ts
│   │   └── validation.ts
│   └── types/
│       ├── cosmos.ts
│       ├── openai.ts
│       └── common.ts
├── host.json
├── local.settings.json
└── package.json
```

### データベース設計

#### Azure Cosmos DB スキーマ

##### Users Container

```json
{
  "id": "user-{uuid}",
  "partitionKey": "/userId",
  "userId": "uuid-string",
  "deviceId": "device-unique-id",
  "createdAt": "2025-01-15T10:00:00Z",
  "lastAccessedAt": "2025-01-15T15:30:00Z",
  "preferences": {
    "theme": "light",
    "fontSize": "medium"
  }
}
```

##### Questions Container

```json
{
  "id": "question-{year}-{number}",
  "partitionKey": "/year",
  "year": 2024,
  "questionNumber": 1,
  "questionText": "コンクリートの圧縮強度について...",
  "choices": [
    { "id": "A", "text": "選択肢A" },
    { "id": "B", "text": "選択肢B" },
    { "id": "C", "text": "選択肢C" },
    { "id": "D", "text": "選択肢D" }
  ],
  "correctAnswer": "A",
  "explanation": {
    "text": "AI生成された解説文",
    "isApproved": true,
    "approvedBy": "expert-id",
    "approvedAt": "2025-01-10T12:00:00Z"
  },
  "metadata": {
    "category": "材料",
    "difficulty": "medium",
    "source": "JCI-2024"
  }
}
```

##### Answers Container

```json
{
  "id": "answer-{userId}-{questionId}",
  "partitionKey": "/userId",
  "userId": "uuid-string",
  "questionId": "question-2024-1",
  "selectedAnswer": "B",
  "isCorrect": false,
  "answeredAt": "2025-01-15T15:45:00Z",
  "timeSpent": 45000
}
```

## AI 統合設計

### Azure OpenAI Service 統合

#### 解説生成プロンプト設計

```typescript
const EXPLANATION_PROMPT = `
あなたはコンクリート診断士試験の専門講師です。
以下の問題について、初学者にもわかりやすい解説を作成してください。

問題文: {questionText}
選択肢: {choices}
正解: {correctAnswer}

解説には以下を含めてください：
1. 正解の根拠となる技術的説明
2. 不正解選択肢がなぜ間違いなのかの説明
3. 関連する専門用語の簡潔な説明
4. 実務での応用例（可能な場合）

文字数: 200-400文字
口調: 丁寧で教育的
`;
```

#### API クライアント実装

```typescript
interface OpenAIClient {
  generateExplanation(question: QuestionData): Promise<ExplanationResult>;
}

class AzureOpenAIClient implements OpenAIClient {
  private client: OpenAIApi;

  async generateExplanation(question: QuestionData): Promise<ExplanationResult> {
    const prompt = this.buildPrompt(question);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    return {
      text: response.choices[0].message.content,
      generatedAt: new Date().toISOString(),
      model: 'gpt-4',
    };
  }
}
```

## セキュリティ設計

### 認証・認可戦略

```typescript
// MVP: デバイスIDベース認証
interface AuthStrategy {
  generateUserId(): string;
  validateRequest(userId: string): boolean;
  rateLimit(userId: string): boolean;
}

class DeviceBasedAuth implements AuthStrategy {
  generateUserId(): string {
    return `user_${uuidv4()}`;
  }

  validateRequest(userId: string): boolean {
    // UUIDフォーマット検証
    return UUID_REGEX.test(userId);
  }

  rateLimit(userId: string): boolean {
    // メモリベースの簡易レート制限
    return this.rateLimiter.check(userId);
  }
}
```

### データ暗号化

```typescript
// Expo Secure Store での機密データ保存
class SecureStorage {
  static async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      requireAuthentication: false, // MVPでは簡易化
      keychainService: 'concrete-diagnostician-app',
    });
  }

  static async getItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }
}
```

## パフォーマンス設計

### フロントエンド最適化

```typescript
// React.memo による再レンダリング最適化
export const QuestionCard = memo(
  ({ question, onAnswer }: QuestionCardProps) => {
    // コンポーネント実装
  },
  (prevProps, nextProps) => {
    return prevProps.question.id === nextProps.question.id;
  }
);

// useCallback によるイベントハンドラー最適化
const handleAnswerSelect = useCallback(
  (answerId: string) => {
    recordAnswer({
      questionId: question.id,
      selectedAnswer: answerId,
      timestamp: Date.now(),
    });
  },
  [question.id]
);
```

### バックエンド最適化

```typescript
// Cosmos DB クエリ最適化
const getQuestionsByYear = async (year: number): Promise<Question[]> => {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.year = @year',
    parameters: [{ name: '@year', value: year }],
  };

  // パーティションキーを指定してクエリを最適化
  const options = {
    partitionKey: year,
    maxItemCount: 50,
  };

  return await container.items.query(querySpec, options).fetchAll();
};
```

## モニタリング・ログ設計

### Application Insights 統合

```typescript
// カスタムテレメトリ
class AppInsightsLogger {
  static trackUserAction(action: string, properties?: Record<string, string>) {
    appInsights.trackEvent({
      name: 'UserAction',
      properties: {
        action,
        timestamp: new Date().toISOString(),
        ...properties,
      },
    });
  }

  static trackPerformance(name: string, duration: number) {
    appInsights.trackMetric({
      name: `Performance_${name}`,
      value: duration,
    });
  }
}
```

### 主要メトリクス

- **ユーザーエンゲージメント**: DAU/MAU、問題解答数、セッション時間
- **パフォーマンス**: API応答時間、画面読み込み時間、クラッシュ率
- **ビジネスKPI**: 年度別学習完了率、正答率、リテンション率

## 開発・デプロイ設計

### CI/CD パイプライン

```yaml
# GitHub Actions
name: Mobile App CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run lint
      - run: npm run test

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: expo/expo-github-action@v7
      - run: eas build --platform ios --non-interactive
```

### 環境管理

```typescript
// 環境設定
interface EnvConfig {
  API_BASE_URL: string;
  AZURE_FUNCTION_KEY: string;
  COSMOS_DB_ENDPOINT: string;
  OPENAI_ENDPOINT: string;
}

const config: Record<string, EnvConfig> = {
  development: {
    API_BASE_URL: 'http://localhost:7071/api',
    // 開発環境設定
  },
  production: {
    API_BASE_URL: 'https://concrete-app-func.azurewebsites.net/api',
    // 本番環境設定
  },
};
```

---

_作成日: 2025-08-24_
_最終更新: 2025-08-24_
_設計バージョン: v1.0_
