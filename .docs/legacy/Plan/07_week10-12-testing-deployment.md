# Week 10-12: テスト・最適化・App Storeデプロイ

**期間**: 第10-12週（15営業日）
**目標**: 総合テスト完了、パフォーマンス最適化、App Store審査通過・リリース

---

## Week 10: 総合テスト・品質保証

### Day 1-2: Unit Test実装

#### タスク 10.1: コンポーネントUnit Test
- **工数**: 6時間
- **依存**: Week 8-9完了
- **スキル**: Jest, React Native Testing Library
- **成果物**: Unit Testスイート（カバレッジ80%以上）

**テスト実装例** (`__tests__/components/ExamYearList.test.tsx`):
```typescript
import { render } from '@testing-library/react-native';
import { ExamYearList } from '@/components/ExamYearList';

describe('ExamYearList', () => {
  const mockYears = [
    { year: 2024, totalQuestions: 100, completedQuestions: 25 },
    { year: 2023, totalQuestions: 100, completedQuestions: 0 },
  ];

  it('should render year list correctly', () => {
    const { getByText } = render(
      <ExamYearList years={mockYears} onYearPress={() => {}} isLoading={false} />
    );

    expect(getByText('2024年度')).toBeTruthy();
    expect(getByText('2023年度')).toBeTruthy();
  });

  it('should display progress correctly', () => {
    const { getByText } = render(
      <ExamYearList years={mockYears} onYearPress={() => {}} isLoading={false} />
    );

    expect(getByText('25 / 100')).toBeTruthy();
  });

  it('should show loading state', () => {
    const { getByText } = render(
      <ExamYearList years={[]} onYearPress={() => {}} isLoading={true} />
    );

    expect(getByText(/読み込み中/)).toBeTruthy();
  });
});
```

**package.json スクリプト追加**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**完了条件**:
- [ ] 全コンポーネントテスト実装
- [ ] カバレッジ80%以上達成
- [ ] 全テストパス

---

#### タスク 10.2: Service/Utility Unit Test
- **工数**: 4時間
- **依存**: タスク10.1
- **スキル**: Jest
- **成果物**: Service層テストスイート

**テスト実装例** (`__tests__/services/progressService.test.ts`):
```typescript
import { progressService } from '@/services/progressService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');

describe('ProgressService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save answer locally when offline', async () => {
    const mockSetItem = AsyncStorage.setItem as jest.Mock;

    await progressService.saveAnswer(
      'user-001',
      '2024-q001',
      '2024-q001-a',
      true
    );

    expect(mockSetItem).toHaveBeenCalled();
  });

  it('should sync offline answers when online', async () => {
    const mockAnswers = [
      {
        questionId: '2024-q001',
        selectedChoiceId: '2024-q001-a',
        isCorrect: true,
        answeredAt: '2025-01-13T00:00:00Z',
        synced: false,
      },
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(mockAnswers)
    );

    const syncedCount = await progressService.syncOfflineAnswers('user-001');

    expect(syncedCount).toBe(1);
  });
});
```

**完了条件**:
- [ ] progressService テスト
- [ ] syncManager テスト
- [ ] API client テスト
- [ ] カバレッジ確認

---

### Day 3-4: Integration Test

#### タスク 10.3: 画面遷移統合テスト
- **工数**: 6時間
- **依存**: タスク10.2
- **スキル**: Detox, E2E Testing
- **成果物**: E2Eテストスイート

**Detoxセットアップ**:
```bash
npm install --save-dev detox jest-circus

# iOS Simulator準備
xcrun simctl boot "iPhone 15"
```

**`.detoxrc.js` 設定**:
```javascript
module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ConcreteApp.app',
      build: 'xcodebuild -workspace ios/ConcreteApp.xcworkspace -scheme ConcreteApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
  },
  configurations: {
    'ios.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
```

**E2Eテスト実装** (`e2e/userFlow.e2e.ts`):
```typescript
import { by, element, expect, device } from 'detox';

describe('User Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete full user flow', async () => {
    // ホーム画面表示確認
    await expect(element(by.text('コンクリート診断士'))).toBeVisible();

    // 年度選択
    await element(by.text('2024年度')).tap();

    // 問題一覧表示確認
    await expect(element(by.id('question-list'))).toBeVisible();

    // 最初の問題をタップ
    await element(by.id('question-item-1')).tap();

    // 問題画面表示確認
    await expect(element(by.id('question-text'))).toBeVisible();

    // 選択肢Aをタップ
    await element(by.id('choice-a')).tap();

    // 解説表示確認
    await expect(element(by.id('explanation'))).toBeVisible();

    // 次の問題へ
    await element(by.id('next-question-button')).tap();

    // 次の問題が表示されることを確認
    await expect(element(by.text('問題 2'))).toBeVisible();
  });

  it('should work offline', async () => {
    // ネットワークをオフに
    await device.setURLBlacklist(['*']);

    // 年度選択
    await element(by.text('2024年度')).tap();

    // オフラインインジケーター表示確認
    await expect(element(by.text('オフラインモード'))).toBeVisible();

    // 問題解答可能確認
    await element(by.id('question-item-1')).tap();
    await element(by.id('choice-a')).tap();

    // 解答記録成功確認
    await expect(element(by.id('explanation'))).toBeVisible();

    // ネットワーク復帰
    await device.setURLBlacklist([]);
  });
});
```

**完了条件**:
- [ ] E2Eテストスイート実装
- [ ] 主要ユーザーフロー網羅
- [ ] オフラインシナリオテスト
- [ ] 全テストパス

---

### Day 5: パフォーマンステスト

#### タスク 10.4: パフォーマンス計測
- **工数**: 4時間
- **依存**: Week 8-9完了
- **スキル**: React Native Performance
- **成果物**: パフォーマンスレポート

**計測項目**:
```typescript
// lib/utils/performanceMonitor.ts
export class PerformanceMonitor {
  static measureRenderTime(componentName: string): void {
    const startTime = performance.now();

    // コンポーネントレンダリング後
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`⏱️  ${componentName} render time: ${renderTime.toFixed(2)}ms`);

      if (renderTime > 100) {
        console.warn(`⚠️  ${componentName} render is slow (> 100ms)`);
      }
    });
  }

  static measureAPICallTime(apiName: string, promise: Promise<any>): Promise<any> {
    const startTime = performance.now();

    return promise.finally(() => {
      const endTime = performance.now();
      const apiTime = endTime - startTime;

      console.log(`⏱️  ${apiName} API call: ${apiTime.toFixed(2)}ms`);

      if (apiTime > 1500) {
        console.warn(`⚠️  ${apiName} API is slow (> 1.5s)`);
      }
    });
  }
}
```

**ベンチマーク目標**:
- 画面遷移: < 300ms
- API レスポンス: < 1.5秒
- リスト表示（100項目）: < 500ms
- メモリ使用量: < 150MB

**完了条件**:
- [ ] パフォーマンス計測実装
- [ ] 全ベンチマーク達成
- [ ] ボトルネック特定
- [ ] パフォーマンスレポート作成

---

## Week 11: 最適化・Apple Developer Program

### Day 1-2: パフォーマンス最適化

#### タスク 11.1: リスト最適化（FlatList）
- **工数**: 4時間
- **依存**: タスク10.4
- **スキル**: React Native最適化
- **成果物**: 最適化済みリストコンポーネント

**最適化実装**:
```typescript
// components/QuestionList.tsx
import { FlatList, View } from 'react-native';
import { memo, useCallback } from 'react';

interface QuestionListProps {
  questions: Question[];
  onQuestionPress: (questionId: string) => void;
}

const QuestionItem = memo(({ question, onPress }: any) => {
  return (
    <TouchableOpacity onPress={() => onPress(question.id)}>
      <ThemedView style={styles.questionItem}>
        <ThemedText>問題 {question.number}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );
});

export function QuestionList({ questions, onQuestionPress }: QuestionListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Question }) => (
      <QuestionItem question={item} onPress={onQuestionPress} />
    ),
    [onQuestionPress]
  );

  const keyExtractor = useCallback((item: Question) => item.id, []);

  return (
    <FlatList
      data={questions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
      getItemLayout={(data, index) => ({
        length: 80, // アイテムの高さ
        offset: 80 * index,
        index,
      })}
    />
  );
}
```

**完了条件**:
- [ ] FlatList最適化実装
- [ ] メモ化実装
- [ ] レンダリング速度改善確認

---

#### タスク 11.2: 画像・アセット最適化
- **工数**: 2時間
- **依存**: なし
- **スキル**: Asset Management
- **成果物**: 最適化済みアセット

**最適化手順**:
```bash
# 画像圧縮
npm install --save-dev imagemin imagemin-pngquant imagemin-mozjpeg

# スクリプト実行
node scripts/optimizeImages.js

# アプリアイコン生成（全サイズ）
npx expo prebuild --clean
```

**完了条件**:
- [ ] 全画像最適化
- [ ] アプリアイコン全サイズ作成
- [ ] スプラッシュスクリーン最適化
- [ ] バンドルサイズ削減確認

---

### Day 3-4: Apple Developer Program

#### タスク 11.3: Apple Developer Program登録
- **工数**: 2時間
- **依存**: なし
- **スキル**: Apple Developer管理
- **成果物**: 有効なApple Developerアカウント

**登録手順**:
1. [Apple Developer](https://developer.apple.com/)にアクセス
2. 「Enroll」をクリック
3. Apple IDでログイン
4. 年会費支払い（¥12,980）
5. 承認待ち（通常24-48時間）

**完了条件**:
- [ ] Apple Developer Program登録完了
- [ ] アカウント承認済み
- [ ] 年会費支払い完了

---

#### タスク 11.4: App ID・証明書作成
- **工数**: 3時間
- **依存**: タスク11.3
- **スキル**: iOS証明書管理
- **成果物**: App ID、証明書、Provisioning Profile

**作成手順**:
```bash
# EAS CLIインストール（Expoの場合）
npm install -g eas-cli

# EASログイン
eas login

# iOS証明書自動作成
eas credentials

# App ID作成
# Bundle Identifier: com.yourcompany.concreteapp

# Distribution Certificate作成
# Provisioning Profile作成（App Store）
```

**App Store Connect設定**:
1. [App Store Connect](https://appstoreconnect.apple.com/)にログイン
2. 「マイApp」→「+」→「新規App」
3. アプリ情報入力:
   - プラットフォーム: iOS
   - 名前: コンクリート診断士試験対策アプリ
   - プライマリ言語: 日本語
   - Bundle ID: com.yourcompany.concreteapp
   - SKU: concrete-app-2024

**完了条件**:
- [ ] App ID作成完了
- [ ] Distribution Certificate作成
- [ ] Provisioning Profile作成
- [ ] App Store Connectアプリ登録完了

---

### Day 5: プライバシーポリシー・利用規約

#### タスク 11.5: プライバシーポリシー作成
- **工数**: 3時間
- **依存**: なし
- **スキル**: 法務、ライティング
- **成果物**: プライバシーポリシー（日本語・英語）

**プライバシーポリシーテンプレート**:
```markdown
# プライバシーポリシー

最終更新日: 2025年X月X日

## 1. 収集する情報

当アプリは以下の情報を収集します:

- デバイス識別子（匿名化）
- 学習進捗データ（解答履歴、正解率）
- アプリ使用状況

## 2. 情報の利用目的

収集した情報は以下の目的で利用します:

- 学習進捗の保存・表示
- アプリの改善
- 統計データの分析

## 3. 情報の第三者提供

当アプリは、ユーザーの個人情報を第三者に提供しません。

## 4. データの保存期間

学習データは、アプリをアンインストールするまで保存されます。

## 5. お問い合わせ

support@example.com
```

**完了条件**:
- [ ] プライバシーポリシー作成
- [ ] Webサイトに公開
- [ ] App Store Connectに登録

---

#### タスク 11.6: 利用規約作成
- **工数**: 2時間
- **依存**: なし
- **スキル**: 法務、ライティング
- **成果物**: 利用規約

**完了条件**:
- [ ] 利用規約作成
- [ ] Webサイトに公開
- [ ] アプリ内リンク設定

---

## Week 12: App Store申請・リリース

### Day 1-2: アプリビルド・TestFlight

#### タスク 12.1: App Store用ビルド作成
- **工数**: 3時間
- **依存**: タスク11.4
- **スキル**: EAS Build, iOS Build
- **成果物**: App Store用IPAファイル

**ビルド手順** (Expo EAS使用):
```bash
# eas.json設定
{
  "build": {
    "production": {
      "ios": {
        "releaseChannel": "production",
        "distribution": "store",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD1234"
      }
    }
  }
}

# 本番ビルド実行
eas build --platform ios --profile production

# ビルド完了待ち（20-30分）
# IPA ダウンロード
```

**完了条件**:
- [ ] IPAファイル生成成功
- [ ] ビルド検証パス
- [ ] アーカイブ作成完了

---

#### タスク 12.2: TestFlight配信
- **工数**: 2時間
- **依存**: タスク12.1
- **スキル**: TestFlight管理
- **成果物**: TestFlight beta版

**配信手順**:
```bash
# EASを使用した自動提出
eas submit --platform ios --profile production

# または手動でApp Store Connectから
# 1. App Store Connectにログイン
# 2. 「TestFlight」タブを開く
# 3. ビルドを選択
# 4. テスター追加
```

**完了条件**:
- [ ] TestFlight配信完了
- [ ] 内部テスター招待
- [ ] ベータ版動作確認

---

#### タスク 12.3: Beta テスト実施
- **工数**: 8時間（2日間）
- **依存**: タスク12.2
- **スキル**: QA、ユーザーフィードバック
- **成果物**: Betaテストレポート

**テスト計画**:
- テスター数: 10-20名
- テスト期間: 2日間
- フィードバック収集: Google Form

**テスト項目**:
```markdown
# TestFlight Beta テストチェックリスト

## 基本機能
- [ ] アプリ起動
- [ ] 年度一覧表示
- [ ] 問題表示
- [ ] 解答記録
- [ ] 進捗表示

## オフライン機能
- [ ] オフライン時の解答記録
- [ ] オンライン復帰時の同期

## UI/UX
- [ ] 操作の直感性
- [ ] デザインの見やすさ
- [ ] レスポンス速度

## バグ報告
- クラッシュ: Yes / No
- 動作不良: 詳細記述
```

**完了条件**:
- [ ] 10名以上のテスター参加
- [ ] フィードバック収集完了
- [ ] 重大バグゼロ確認
- [ ] 必要な修正実施

---

### Day 3-4: App Store申請

#### タスク 12.4: App Store情報入力
- **工数**: 4時間
- **依存**: タスク12.3
- **スキル**: App Store管理、マーケティング
- **成果物**: App Store Connect完全設定

**必要な情報**:

**1. アプリ情報**:
```
名前: コンクリート診断士試験対策アプリ
サブタイトル: スキマ時間で効率学習
カテゴリ: 教育
言語: 日本語
```

**2. 説明文**:
```
【アプリの特徴】
✅ 100問の過去問演習
✅ 詳細な解説付き
✅ 学習進捗の可視化
✅ オフライン対応

【こんな方におすすめ】
・コンクリート診断士試験の受験者
・スキマ時間で効率よく学習したい方
・自分の苦手分野を把握したい方

【主な機能】
- 年度別問題演習
- カテゴリ別学習
- 学習統計表示
- オフライン学習対応
```

**3. スクリーンショット**:
- iPhone 6.7" (4枚以上)
- iPhone 6.5" (4枚以上)
- iPhone 5.5" (4枚以上)

**4. キーワード**:
```
コンクリート診断士,試験対策,資格試験,過去問,学習,建築,土木
```

**5. サポートURL**: https://yourwebsite.com/support
**6. マーケティングURL**: https://yourwebsite.com
**7. プライバシーポリシーURL**: https://yourwebsite.com/privacy

**完了条件**:
- [ ] 全情報入力完了
- [ ] スクリーンショット全サイズ作成
- [ ] プレビュー動画作成（オプション）
- [ ] URL全て有効

---

#### タスク 12.5: App Review情報入力
- **工数**: 2時間
- **依存**: タスク12.4
- **スキル**: App Store審査対応
- **成果物**: 審査用情報

**審査用情報**:
```markdown
# App Review Information

## デモアカウント
不要（認証なし）

## 審査の注意事項
本アプリは、コンクリート診断士試験の学習支援アプリです。
問題は、Azure OpenAI Serviceを使用して生成され、
専門家によるレビューを経ています。

## 連絡先情報
名前: [Your Name]
電話: [Your Phone]
Email: [Your Email]
```

**完了条件**:
- [ ] 審査情報入力完了
- [ ] 連絡先情報入力
- [ ] 審査ノート記載

---

#### タスク 12.6: 申請提出
- **工数**: 1時間
- **依存**: タスク12.5
- **スキル**: App Store管理
- **成果物**: 審査中ステータス

**提出手順**:
1. App Store Connectで最終確認
2. 「審査に提出」をクリック
3. 輸出コンプライアンス確認
4. 広告ID使用確認
5. コンテンツ権利確認
6. 提出完了

**完了条件**:
- [ ] 申請提出完了
- [ ] ステータス「審査待ち」確認
- [ ] 確認メール受信

---

### Day 5: 審査対応・リリース

#### タスク 12.7: 審査期間対応
- **工数**: 可変（平均3-7日）
- **依存**: タスク12.6
- **スキル**: App Store審査対応
- **成果物**: 審査承認

**審査ステータス**:
- 審査待ち (Waiting for Review): 1-3日
- 審査中 (In Review): 1-2日
- 承認 (Approved): 即座
- リジェクト (Rejected): 対応後再提出

**よくあるリジェクト理由と対策**:

1. **メタデータ不一致**:
   - スクリーンショットとアプリ内容が違う
   - → スクリーンショット再作成

2. **プライバシーポリシー不備**:
   - URLアクセスできない
   - → URL確認、サーバー確認

3. **機能不明確**:
   - 審査員が使い方を理解できない
   - → 審査ノートに詳細説明追加

4. **クラッシュ**:
   - 審査中にクラッシュ
   - → ログ確認、修正、再提出

**完了条件**:
- [ ] 審査承認
- [ ] ステータス「承認済み」確認

---

#### タスク 12.8: リリース実行
- **工数**: 1時間
- **依存**: タスク12.7
- **スキル**: App Store管理
- **成果物**: App Store公開

**リリース手順**:
1. App Store Connectで「リリース」をクリック
2. リリース日時選択（即座 or 指定日時）
3. リリース実行
4. App Storeで検索可能になるまで待機（24時間以内）

**リリース後確認**:
- App Storeで検索
- ダウンロード可能確認
- アプリ起動確認

**完了条件**:
- [ ] リリース実行完了
- [ ] App Store公開確認
- [ ] ダウンロード可能確認
- [ ] 初回ダウンロード・起動確認

---

## Week 10-12 完了チェックリスト

### テスト
- [ ] Unit Test（カバレッジ80%以上）
- [ ] Integration Test
- [ ] E2E Test（Detox）
- [ ] パフォーマンステスト

### 最適化
- [ ] リスト最適化
- [ ] 画像・アセット最適化
- [ ] バンドルサイズ削減
- [ ] メモリ使用量最適化

### Apple Developer
- [ ] Apple Developer Program登録
- [ ] App ID作成
- [ ] 証明書作成
- [ ] Provisioning Profile作成
- [ ] App Store Connect設定

### 法務・ドキュメント
- [ ] プライバシーポリシー作成・公開
- [ ] 利用規約作成・公開
- [ ] サポートサイト作成

### TestFlight
- [ ] Beta版配信
- [ ] 10名以上テスター参加
- [ ] フィードバック収集
- [ ] 重大バグ修正

### App Store
- [ ] アプリ情報入力完了
- [ ] スクリーンショット作成・登録
- [ ] 審査情報入力
- [ ] 申請提出
- [ ] 審査承認
- [ ] **本番リリース完了** 🎉

## プロジェクト完了

**総開発期間**: 12週間
**総工数**: 約500時間
**成果物**:
- iOS アプリ（App Store公開）
- 100問の問題データ（RAG生成、専門家レビュー済み）
- Azureバックエンド（Cosmos DB, Functions, AI Search）
- 完全なドキュメント

**次のステップ**:
1. ユーザーフィードバック収集
2. アプリ改善（バージョン1.1計画）
3. マーケティング・プロモーション
4. Android版開発検討

---

**🎉 おめでとうございます！プロジェクト完了です！**
