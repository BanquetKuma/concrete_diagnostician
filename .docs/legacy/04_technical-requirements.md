# 技術要件と依存関係

## 概要

本ドキュメントでは、コンクリート診断士試験対策アプリMVPの技術要件、依存関係、および技術スタックの詳細を定義します。

## 技術スタック

### フロントエンド

#### コア技術

- **React Native**: 0.79.5
- **Expo SDK**: 53.0.0
- **TypeScript**: 5.3.x (strict mode)
- **React**: 19.0.0

#### ナビゲーション

- **Expo Router**: 4.x (ファイルベースルーティング)
- **React Navigation**: (Expo Router内部で使用)

#### 状態管理

- **React Context API**: アプリ状態、テーマ管理
- **Zustand** (推奨): グローバル状態管理
- **React Query/TanStack Query**: サーバー状態管理

#### UI/スタイリング

- **React Native StyleSheet**: 基本スタイリング
- **Expo Vector Icons**: アイコンライブラリ
- **React Native Reanimated**: アニメーション

### バックエンド (BaaS)

#### データベース

- **Azure Cosmos DB**
  - NoSQLデータベース
  - グローバル分散対応
  - 自動スケーリング

#### サーバーレス関数

- **Azure Functions**
  - Node.js ランタイム
  - TypeScript対応
  - HTTPトリガー

#### ストレージ

- **Azure Blob Storage**
  - 画像・リソース管理
  - CDN統合対応

### 外部サービス

#### AI/ML

- **Azure OpenAI Service**
  - 解説文生成
  - GPT-4モデル利用
  - バッチ処理対応

#### 分析・モニタリング

- **Azure Application Insights**
  - パフォーマンス監視
  - エラートラッキング

## 依存関係マップ

### 必須依存関係

```json
{
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~4.0.0",
    "expo-constants": "~17.0.0",
    "expo-device": "~7.0.0",
    "expo-font": "~13.0.0",
    "expo-linking": "~7.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "expo-system-ui": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "react": "19.0.0",
    "react-native": "0.79.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "4.4.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "@azure/storage-blob": "^12.17.0",
    "@azure/openai": "^1.0.0"
  }
}
```

### 開発依存関係

```json
{
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@expo/cli": "0.21.12",
    "@types/react": "~18.3.12",
    "typescript": "~5.3.3",
    "eslint": "^8.57.0",
    "eslint-config-expo": "^8.0.0",
    "jest": "^29.2.1",
    "@testing-library/react-native": "^12.4.0",
    "prettier": "^3.2.0"
  }
}
```

## 環境要件

### 開発環境

- **Node.js**: 18.x 以上
- **npm/yarn**: 最新安定版
- **Git**: バージョン管理
- **VSCode**: 推奨エディタ

### モバイル開発

- **Xcode**: 15.0以上 (iOS開発)
- **Android Studio**: 最新版 (Android開発)
- **Expo Go**: デバッグ用アプリ

### クラウド環境

- **Azure サブスクリプション**
  - Azure Functions
  - Azure Cosmos DB
  - Azure OpenAI Service
  - Azure Blob Storage
  - Azure Application Insights
- **Apple Developer Program** (iOS配布)

## API仕様

### ユーザー管理API

```typescript
interface UserAPI {
  // ユーザー作成（初回アクセス時）
  POST /api/users/create
  Request: {
    deviceId: string
  }
  Response: {
    userId: string
    createdAt: string
  }

  // ユーザー情報取得
  GET /api/users/:userId
  Response: {
    userId: string
    createdAt: string
    lastAccessedAt: string
  }
}
```

### 問題データAPI

```typescript
interface QuestionAPI {
  // 年度別問題リスト取得
  GET /api/questions/years
  Response: {
    years: Array<{
      year: number
      totalQuestions: number
      completedQuestions: number
    }>
  }

  // 問題詳細取得
  GET /api/questions/:year/:questionId
  Response: {
    id: string
    year: number
    questionNumber: number
    questionText: string
    choices: Array<{
      id: string
      text: string
    }>
    correctChoiceId: string
    explanation: string
  }
}
```

### 学習履歴API

```typescript
interface ProgressAPI {
  // 解答履歴保存
  POST /api/progress/answer
  Request: {
    userId: string
    questionId: string
    selectedChoiceId: string
    isCorrect: boolean
    timestamp: string
  }

  // 進捗取得
  GET /api/progress/:userId
  Response: {
    totalAnswered: number
    correctAnswers: number
    questionHistory: Array<AnswerHistory>
  }
}
```

### AI解説生成API

```typescript
interface AIExplanationAPI {
  // 解説文生成（バッチ処理用）
  POST /api/ai/generate-explanation
  Request: {
    questionText: string
    choices: Array<string>
    correctAnswer: string
  }
  Response: {
    explanation: string
    generatedAt: string
  }
}
```

## セキュリティ要件

### ユーザー識別

- デバイスIDベースの簡易ユーザー管理
- UUIDによるユーザー識別
- Expo Secure Storeでのユーザー情報保存

### データ保護

- HTTPS通信の強制
- センシティブデータの暗号化
- Expo Secure Storeの使用

### APIセキュリティ

- Rate Limiting実装
- CORS設定
- APIキーの環境変数管理

## パフォーマンス要件

### レスポンスタイム

- API応答: < 1.5秒
- 画面遷移: < 0.5秒
- 初回起動: < 3秒

### 最適化戦略

- 画像の遅延読み込み
- APIレスポンスのキャッシング
- バンドルサイズの最小化

## テスト要件

### 単体テスト

- Jest使用
- カバレッジ目標: 80%以上
- 重要なビジネスロジックは100%

### 統合テスト

- React Native Testing Library
- 主要ユーザーフローのテスト
- APIモックの使用

### E2Eテスト

- Detox (推奨)
- 主要シナリオの自動テスト
- CI/CDパイプライン統合

## デプロイメント要件

### ビルド設定

- EAS Build使用
- 環境別設定ファイル
- 自動バージョニング

### 配布

- TestFlight (iOS)
- Google Play Console (Android)
- OTA更新 (Expo Updates)

## 監視・運用要件

### ログ収集

- Azure Application Insights統合
- エラーログの自動収集
- パフォーマンスメトリクス

### アラート設定

- エラー率閾値: > 1%
- レスポンスタイム閾値: > 3秒
- ダウンタイム通知

## 移行・互換性

### バージョン管理

- セマンティックバージョニング
- 後方互換性の維持
- 段階的な機能リリース

### データ移行

- スキーマバージョン管理
- 移行スクリプトの準備
- ロールバック計画

---

_作成日: 2025-08-24_
_最終更新: 2025-08-24_
