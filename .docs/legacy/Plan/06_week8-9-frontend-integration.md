# Week 8-9: フロントエンド統合・オフライン機能

**期間**: 第8-9週（10営業日）
**目標**: API統合、モックデータ削除、オフライン機能実装

---

## Week 8: フロントエンドAPI統合

### Day 1: Cosmos DB データ投入

#### タスク 8.1: Cosmos DB投入スクリプト実装
- **工数**: 2時間
- **依存**: Week 7完了
- **スキル**: TypeScript, Cosmos DB SDK
- **成果物**: データ投入スクリプト

**実装** (`scripts/uploadToCosmos.ts`):
```typescript
import { CosmosClient } from '@azure/cosmos';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

async function uploadToCosmos() {
  console.log('📤 Uploading questions to Cosmos DB...\n');

  const endpoint = process.env.COSMOS_ENDPOINT!;
  const key = process.env.COSMOS_KEY!;

  const client = new CosmosClient({ endpoint, key });
  const database = client.database('ConcreteAppDB');
  const container = database.container('questions');

  // 生成済み問題を読み込み
  const questionsJson = await fs.readFile(
    './data/generated_questions_rag_2024.json',
    'utf-8'
  );
  const questions = JSON.parse(questionsJson);

  console.log(`📊 Total questions to upload: ${questions.length}\n`);

  let successCount = 0;
  let failedCount = 0;

  for (const question of questions) {
    try {
      // Cosmos DB用にデータ整形
      const cosmosDoc = {
        id: question.id,
        year: String(question.year), // パーティションキー
        questionNumber: question.number,
        questionText: question.questionText,
        choices: question.choices.map((c: any) => ({
          id: c.id || `${question.id}-${c.label.toLowerCase()}`,
          label: c.label,
          text: c.text,
        })),
        correctChoiceId: question.correctChoiceId ||
          `${question.id}-${question.choices.find((c: any) => c.isCorrect).label.toLowerCase()}`,
        explanation: question.explanation,
        category: question.category,
        difficulty: question.difficulty,
        keywords: question.keywords || [],
        references: question.references || [],
        sources: question.sources || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await container.items.create(cosmosDoc);
      successCount++;
      console.log(`✅ Q${question.number} uploaded`);
    } catch (error: any) {
      failedCount++;
      console.error(`❌ Q${question.number} failed: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Upload completed`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`${'='.repeat(60)}\n`);
}

uploadToCosmos().catch(console.error);
```

**完了条件**:
- [ ] スクリプト実装完了
- [ ] 100問アップロード成功
- [ ] Cosmos DBデータ確認

---

#### タスク 8.2: 年度別データ検証
- **工数**: 1時間
- **依存**: タスク8.1
- **スキル**: Azure Portal, クエリ
- **成果物**: データ検証レポート

**検証クエリ**:
```sql
-- 総問題数確認
SELECT VALUE COUNT(1) FROM c WHERE c.year = '2024'

-- カテゴリ別問題数
SELECT c.category, COUNT(1) as count
FROM c
WHERE c.year = '2024'
GROUP BY c.category

-- 難易度別問題数
SELECT c.difficulty, COUNT(1) as count
FROM c
WHERE c.year = '2024'
GROUP BY c.difficulty
```

**完了条件**:
- [ ] 総問題数100確認
- [ ] カテゴリ別分布確認
- [ ] 難易度別分布確認
- [ ] データ整合性確認

---

### Day 2-3: API Client実装

#### タスク 8.3: API Client リファクタリング
- **工数**: 4時間
- **依存**: タスク8.2, Week 2-3 API実装完了
- **スキル**: TypeScript, React Native
- **成果物**: 本番API対応 API Client

**既存ファイル更新** (`lib/api/client.ts`):
```typescript
import axios, { AxiosInstance } from 'axios';
import { ExamYear, Question, User } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:7071/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.config.url} - ${response.status}`);
        return response;
      },
      (error) => {
        console.error(`❌ API Error: ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  // ユーザー管理
  async createUser(deviceId: string): Promise<User> {
    const response = await this.client.post('/users', { deviceId });
    return response.data;
  }

  async getUser(deviceId: string): Promise<User> {
    const response = await this.client.get(`/users/${deviceId}`);
    return response.data;
  }

  async updateUserStats(deviceId: string, stats: Partial<User>): Promise<User> {
    const response = await this.client.patch(`/users/${deviceId}/stats`, stats);
    return response.data;
  }

  // 問題管理
  async getExamYears(): Promise<{ years: ExamYear[] }> {
    const response = await this.client.get('/questions', {
      params: { groupBy: 'year' },
    });

    // レスポンスを年度別に集計
    const questionsByYear = response.data.questions.reduce((acc: any, q: Question) => {
      if (!acc[q.year]) {
        acc[q.year] = { year: q.year, questions: [] };
      }
      acc[q.year].questions.push(q);
      return acc;
    }, {});

    const years: ExamYear[] = Object.values(questionsByYear).map((yearData: any) => ({
      year: yearData.year,
      totalQuestions: yearData.questions.length,
      completedQuestions: 0, // ユーザー進捗から計算
    }));

    return { years };
  }

  async getQuestionsByYear(year: number): Promise<{ questions: Question[] }> {
    const response = await this.client.get('/questions', {
      params: { year: String(year) },
    });
    return { questions: response.data.questions };
  }

  async getQuestionById(questionId: string, year: number): Promise<Question> {
    const response = await this.client.get(`/questions/${questionId}`, {
      params: { year: String(year) },
    });
    return response.data;
  }

  // 解答管理
  async recordAnswer(data: {
    userId: string;
    questionId: string;
    selectedAnswer: string;
    isCorrect: boolean;
    timeSpent?: number;
  }): Promise<any> {
    const response = await this.client.post('/answers', data);
    return response.data;
  }

  async getUserAnswers(userId: string, questionId?: string): Promise<any> {
    const response = await this.client.get(`/users/${userId}/answers`, {
      params: { questionId },
    });
    return response.data;
  }

  // 学習進捗
  async getYearProgress(userId: string, year: number): Promise<any> {
    const response = await this.client.get(`/users/${userId}/progress/year/${year}`);
    return response.data;
  }

  async getCategoryStats(userId: string): Promise<any> {
    const response = await this.client.get(`/users/${userId}/stats/category`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

**環境変数設定** (`.env`):
```bash
# 開発環境
EXPO_PUBLIC_API_BASE_URL=https://concrete-app-functions-dev.azurewebsites.net/api

# 本番環境（後で切り替え）
# EXPO_PUBLIC_API_BASE_URL=https://concrete-app-functions-prod.azurewebsites.net/api
```

**完了条件**:
- [ ] API Client実装完了
- [ ] 環境変数設定
- [ ] モックデータ削除
- [ ] 型定義更新

---

#### タスク 8.4: progressServiceリファクタリング
- **工数**: 3時間
- **依存**: タスク8.3
- **スキル**: TypeScript, React Native
- **成果物**: 本番API対応 progressService

**既存ファイル更新** (`services/progressService.ts`):
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api/client';

const PROGRESS_STORAGE_KEY = 'user_progress';
const OFFLINE_ANSWERS_KEY = 'offline_answers';

interface AnswerRecord {
  questionId: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  answeredAt: string;
  synced: boolean;
}

class ProgressService {
  /**
   * 解答を記録（オンライン/オフライン対応）
   */
  async saveAnswer(
    userId: string,
    questionId: string,
    selectedChoiceId: string,
    isCorrect: boolean
  ): Promise<void> {
    const answer: AnswerRecord = {
      questionId,
      selectedChoiceId,
      isCorrect,
      answeredAt: new Date().toISOString(),
      synced: false,
    };

    try {
      // オンラインでAPI送信を試みる
      await apiClient.recordAnswer({
        userId,
        questionId,
        selectedAnswer: selectedChoiceId,
        isCorrect,
      });

      answer.synced = true;
      console.log('✅ Answer synced to server');
    } catch (error) {
      console.warn('⚠️  Failed to sync answer, saving locally', error);
      // オフライン時はローカルに保存
      await this.saveOfflineAnswer(answer);
    }

    // ローカルストレージにも保存（キャッシュ）
    await this.saveLocalProgress(userId, questionId, answer);
  }

  /**
   * ローカル進捗保存
   */
  private async saveLocalProgress(
    userId: string,
    questionId: string,
    answer: AnswerRecord
  ): Promise<void> {
    try {
      const key = `${PROGRESS_STORAGE_KEY}_${userId}`;
      const existing = await AsyncStorage.getItem(key);
      const progress = existing ? JSON.parse(existing) : {};

      progress[questionId] = answer;

      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save local progress:', error);
    }
  }

  /**
   * オフライン解答を保存
   */
  private async saveOfflineAnswer(answer: AnswerRecord): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_ANSWERS_KEY);
      const offlineAnswers = existing ? JSON.parse(existing) : [];

      offlineAnswers.push(answer);

      await AsyncStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(offlineAnswers));
      console.log('💾 Offline answer saved');
    } catch (error) {
      console.error('Failed to save offline answer:', error);
    }
  }

  /**
   * オフライン解答を同期
   */
  async syncOfflineAnswers(userId: string): Promise<number> {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_ANSWERS_KEY);
      if (!existing) return 0;

      const offlineAnswers: AnswerRecord[] = JSON.parse(existing);
      if (offlineAnswers.length === 0) return 0;

      console.log(`🔄 Syncing ${offlineAnswers.length} offline answers...`);

      let syncedCount = 0;
      const remaining: AnswerRecord[] = [];

      for (const answer of offlineAnswers) {
        try {
          await apiClient.recordAnswer({
            userId,
            questionId: answer.questionId,
            selectedAnswer: answer.selectedChoiceId,
            isCorrect: answer.isCorrect,
          });
          syncedCount++;
        } catch (error) {
          console.warn(`Failed to sync answer ${answer.questionId}:`, error);
          remaining.push(answer);
        }
      }

      // 同期できなかった解答のみ保持
      await AsyncStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(remaining));

      console.log(`✅ Synced ${syncedCount}/${offlineAnswers.length} answers`);
      return syncedCount;
    } catch (error) {
      console.error('Failed to sync offline answers:', error);
      return 0;
    }
  }

  /**
   * ユーザーの解答履歴取得
   */
  async getUserProgress(userId: string, questionId?: string): Promise<any> {
    try {
      const response = await apiClient.getUserAnswers(userId, questionId);
      return response;
    } catch (error) {
      console.warn('Failed to fetch progress from server, using local cache', error);
      // オフライン時はローカルから取得
      return this.getLocalProgress(userId, questionId);
    }
  }

  /**
   * ローカル進捗取得
   */
  private async getLocalProgress(userId: string, questionId?: string): Promise<any> {
    try {
      const key = `${PROGRESS_STORAGE_KEY}_${userId}`;
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return { answers: [], count: 0 };

      const progress = JSON.parse(existing);

      if (questionId) {
        return progress[questionId] || null;
      }

      const answers = Object.values(progress);
      return { answers, count: answers.length };
    } catch (error) {
      console.error('Failed to get local progress:', error);
      return { answers: [], count: 0 };
    }
  }

  /**
   * ローカルキャッシュクリア
   */
  async clearLocalCache(userId: string): Promise<void> {
    try {
      const key = `${PROGRESS_STORAGE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      console.log('🗑️  Local progress cache cleared');
    } catch (error) {
      console.error('Failed to clear local cache:', error);
    }
  }
}

export const progressService = new ProgressService();
```

**完了条件**:
- [ ] オンライン/オフライン対応実装
- [ ] 同期ロジック実装
- [ ] ローカルキャッシュ実装

---

### Day 4-5: 画面統合テスト

#### タスク 8.5: ホーム画面統合テスト
- **工数**: 3時間
- **依存**: タスク8.4
- **スキル**: React Native, 統合テスト
- **成果物**: 統合済みホーム画面

**テスト項目**:
```typescript
// __tests__/integration/HomeScreen.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../app/(tabs)/index';

describe('HomeScreen Integration', () => {
  it('should fetch and display exam years from API', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('2024年度')).toBeTruthy();
    });

    // 進捗表示確認
    expect(getByText(/\/\s*100/)).toBeTruthy();
  });

  it('should handle API errors gracefully', async () => {
    // APIエラーをシミュレート
    jest.spyOn(apiClient, 'getExamYears').mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText(/エラー|読み込みに失敗/)).toBeTruthy();
    });
  });
});
```

**完了条件**:
- [ ] API連携動作確認
- [ ] ローディング状態表示確認
- [ ] エラーハンドリング確認
- [ ] 進捗表示確認

---

#### タスク 8.6: 問題演習画面統合テスト
- **工数**: 4時間
- **依存**: タスク8.4
- **スキル**: React Native, E2E テスト
- **成果物**: 統合済み問題演習画面

**テスト項目**:
```typescript
// __tests__/integration/QuestionScreen.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuestionScreen from '../../app/questions/[year]/[questionId]';

describe('QuestionScreen Integration', () => {
  it('should fetch and display question from API', async () => {
    const { getByText } = render(<QuestionScreen />);

    await waitFor(() => {
      expect(getByText(/コンクリート/)).toBeTruthy();
    });
  });

  it('should record answer and update progress', async () => {
    const { getByText } = render(<QuestionScreen />);

    await waitFor(() => {
      const choiceButton = getByText('A.');
      fireEvent.press(choiceButton);
    });

    await waitFor(() => {
      // 解説表示確認
      expect(getByText(/解説/)).toBeTruthy();
    });

    // API呼び出し確認
    expect(apiClient.recordAnswer).toHaveBeenCalled();
  });
});
```

**完了条件**:
- [ ] 問題表示確認
- [ ] 解答記録確認
- [ ] 進捗更新確認
- [ ] オフライン動作確認

---

## Week 9: オフライン機能実装

### Day 1-2: データ同期機能

#### タスク 9.1: 同期マネージャー実装
- **工数**: 4時間
- **依存**: タスク8.4
- **スキル**: TypeScript, React Native
- **成果物**: 同期マネージャー

**実装** (`services/syncManager.ts`):
```typescript
import NetInfo from '@react-native-community/netinfo';
import { progressService } from './progressService';
import { apiClient } from '../lib/api/client';

class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;

  /**
   * ネットワーク監視開始
   */
  startNetworkMonitoring(userId: string): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`🌐 Network status: ${this.isOnline ? 'Online' : 'Offline'}`);

      // オフライン→オンライン復帰時に自動同期
      if (wasOffline && this.isOnline) {
        this.syncNow(userId);
      }
    });

    // 定期同期（5分ごと）
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncNow(userId);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 監視停止
   */
  stopNetworkMonitoring(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 即座に同期実行
   */
  async syncNow(userId: string): Promise<boolean> {
    if (!this.isOnline) {
      console.log('⚠️  Cannot sync: Offline');
      return false;
    }

    try {
      console.log('🔄 Starting sync...');

      // オフライン解答を同期
      const syncedCount = await progressService.syncOfflineAnswers(userId);

      console.log(`✅ Sync completed: ${syncedCount} answers synced`);
      return true;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return false;
    }
  }

  /**
   * 同期状態取得
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
```

**完了条件**:
- [ ] 同期マネージャー実装
- [ ] ネットワーク監視実装
- [ ] 自動同期実装
- [ ] 手動同期機能実装

---

#### タスク 9.2: App初期化時の同期処理
- **工数**: 2時間
- **依存**: タスク9.1
- **スキル**: React Native
- **成果物**: 初期化処理更新

**実装** (`app/_layout.tsx`更新):
```typescript
import { useEffect } from 'react';
import { syncManager } from '../services/syncManager';
import { useUserContext } from '../contexts/UserContext';

export default function RootLayout() {
  const { user } = useUserContext();

  useEffect(() => {
    if (user) {
      // 同期マネージャー開始
      syncManager.startNetworkMonitoring(user.id);

      // アプリ起動時に即座に同期
      syncManager.syncNow(user.id);

      return () => {
        syncManager.stopNetworkMonitoring();
      };
    }
  }, [user]);

  return (
    // ... 既存のレイアウト
  );
}
```

**完了条件**:
- [ ] アプリ起動時同期実装
- [ ] バックグラウンド同期実装
- [ ] アプリ終了時のクリーンアップ実装

---

### Day 3-4: オフラインUI実装

#### タスク 9.3: オフライン表示コンポーネント実装
- **工数**: 3時間
- **依存**: タスク9.1
- **スキル**: React Native, UI/UX
- **成果物**: オフラインインジケーター

**実装** (`components/OfflineIndicator.tsx`):
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { syncManager } from '../services/syncManager';
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>⚠️ オフラインモード</Text>
      <Text style={styles.subtext}>解答はオンライン復帰時に同期されます</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ff9800',
    padding: 12,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
```

**完了条件**:
- [ ] オフラインインジケーター実装
- [ ] 全画面に配置
- [ ] 同期状態表示実装

---

#### タスク 9.4: 統計画面実装
- **工数**: 4時間
- **依存**: Week 3 API実装
- **スキル**: React Native, Chart.js
- **成果物**: 統計画面

**実装** (`app/(tabs)/stats.tsx`):
```typescript
import { View, ScrollView, StyleSheet } from 'react-native';
import { ThemedText, ThemedView } from '@/components/themed';
import { useUserContext } from '@/contexts/UserContext';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export default function StatsScreen() {
  const { user } = useUserContext();
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const stats = await apiClient.getCategoryStats(user.id);
      setCategoryStats(stats.categoryStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>読み込み中...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title">学習統計</ThemedText>

        {/* 総合統計 */}
        <ThemedView style={styles.overallStats}>
          <ThemedText type="subtitle">総合成績</ThemedText>
          <ThemedText>
            総問題数: {user?.totalQuestionsAnswered || 0}
          </ThemedText>
          <ThemedText>
            正解数: {user?.correctAnswers || 0}
          </ThemedText>
          <ThemedText>
            正解率: {user?.studyStats?.averageScore.toFixed(1) || 0}%
          </ThemedText>
        </ThemedView>

        {/* カテゴリ別統計 */}
        <ThemedView style={styles.categoryStats}>
          <ThemedText type="subtitle">カテゴリ別成績</ThemedText>
          {categoryStats.map((cat: any) => (
            <ThemedView key={cat.category} style={styles.categoryItem}>
              <ThemedText>{cat.category}</ThemedText>
              <ThemedText>
                正解率: {cat.accuracyRate.toFixed(1)}%
              </ThemedText>
              <ThemedText>
                解答数: {cat.totalAnswered}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  overallStats: { marginBottom: 24 },
  categoryStats: { marginTop: 24 },
  categoryItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
});
```

**完了条件**:
- [ ] 統計画面実装
- [ ] カテゴリ別統計表示
- [ ] グラフ表示（オプション）

---

### Day 5: Week 8-9完了確認

#### タスク 9.5: 統合テスト実施
- **工数**: 4時間
- **依存**: 全タスク完了
- **スキル**: テスト、QA
- **成果物**: テストレポート

**テスト項目**:
```markdown
# Week 8-9 統合テストチェックリスト

## API統合
- [ ] ホーム画面で年度一覧表示
- [ ] 問題一覧取得
- [ ] 個別問題表示
- [ ] 解答記録
- [ ] 進捗更新

## オフライン機能
- [ ] オフライン時に解答記録
- [ ] オンライン復帰時に自動同期
- [ ] 同期状態表示
- [ ] オフラインインジケーター表示

## エラーハンドリング
- [ ] ネットワークエラー処理
- [ ] APIエラー処理
- [ ] タイムアウト処理
- [ ] リトライロジック

## パフォーマンス
- [ ] 画面遷移スムーズ
- [ ] API レスポンス1.5秒以内
- [ ] ローカルキャッシュ動作確認
```

**完了条件**:
- [ ] 全テスト項目パス
- [ ] テストレポート作成
- [ ] Week 10準備完了

---

## Week 8-9 完了チェックリスト

### データ投入
- [ ] Cosmos DBに100問投入完了
- [ ] データ検証完了

### API統合
- [ ] API Client実装完了
- [ ] 全画面API連携完了
- [ ] モックデータ削除完了

### オフライン機能
- [ ] 同期マネージャー実装完了
- [ ] オフライン解答記録実装
- [ ] 自動同期実装完了

### 統合テスト
- [ ] 全機能統合テスト完了
- [ ] エラーハンドリング確認
- [ ] パフォーマンステスト完了

## 次週準備

**Week 10-12で実施すること**:
1. 総合テスト（Unit, Integration, E2E）
2. パフォーマンス最適化
3. Apple Developer Program登録
4. App Store申請準備
5. TestFlight beta配信
6. 本番リリース
