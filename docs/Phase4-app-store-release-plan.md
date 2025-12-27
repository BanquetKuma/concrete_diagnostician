# Phase 4: App Store リリース計画

**作成日**: 2024-12-17
**目標**: コンクリート診断士試験対策アプリをApp Storeに公開する

---

## 現在の状況

### 完了済み (Phase 1-3)

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | フロントエンド基盤構築 (Expo/React Native) | ✅ 完了 |
| 2 | 画面実装 (ホーム、問題演習、進捗表示) | ✅ 完了 |
| 3 | Gemini RAGで100問生成・アプリ統合 | ✅ 完了 |

### 技術スタック (確定)

| 領域 | 技術 | 備考 |
|------|------|------|
| フロントエンド | Expo SDK 53 + React Native | iOS/Android/Web対応 |
| 言語 | TypeScript | Strict mode |
| ナビゲーション | Expo Router | ファイルベース |
| バックエンド | Cloudflare Workers | 無料枠: 10万リクエスト/日 |
| データベース | Turso (SQLite Edge) | 無料枠: 9GB |
| ストレージ | Cloudflare R2 | 無料枠: 10GB |
| 問題生成 | Gemini File Search API | 完了済み |

---

## Phase 4: バックエンド構築

**期間**: 1週間
**目標**: Cloudflare Workers + Turso でAPIを構築

### 4.1 Turso データベース構築

| タスク | 工数 | 成果物 |
|--------|------|--------|
| Tursoアカウント作成 | 30分 | アカウント |
| データベース作成 | 30分 | `concrete-diagnostician` DB |
| スキーマ定義・適用 | 2時間 | テーブル作成済み |
| 100問データ投入 | 1時間 | 問題データ登録完了 |

**スキーマ**:
```sql
-- users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- questions (100問)
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  number INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  choices TEXT NOT NULL,
  correct_choice_id TEXT NOT NULL,
  explanation TEXT NOT NULL
);

-- answers (学習履歴)
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Cloudflare Workers API実装

| タスク | 工数 | 成果物 |
|--------|------|--------|
| Workers プロジェクト作成 | 30分 | `workers/` ディレクトリ |
| Hono フレームワーク設定 | 1時間 | API基盤 |
| 問題取得API実装 | 2時間 | `GET /api/questions/:year` |
| 解答保存API実装 | 2時間 | `POST /api/answers` |
| 進捗取得API実装 | 2時間 | `GET /api/progress/:userId` |
| デプロイ・動作確認 | 1時間 | 本番URL |

**API エンドポイント**:
```
GET  /api/questions/:year     # 年度別問題取得
GET  /api/questions/:year/:id # 問題詳細取得
POST /api/answers             # 解答保存
GET  /api/progress/:userId    # 学習進捗取得
```

### 4.3 フロントエンド統合

| タスク | 工数 | 成果物 |
|--------|------|--------|
| APIクライアント更新 | 2時間 | Cloudflare Workers接続 |
| モックデータ削除 | 1時間 | 実API利用 |
| オフライン対応確認 | 2時間 | ローカルキャッシュ動作 |

---

## Phase 5: 品質保証・テスト

**期間**: 1週間
**目標**: バグ修正、UI/UX最終調整

### 5.1 機能テスト

| テスト項目 | 内容 |
|-----------|------|
| 問題表示 | 100問全て正常に表示されるか |
| 選択肢タップ | 正誤判定・ハイライト動作 |
| 解説表示 | スクロール・表示確認 |
| 進捗保存 | 学習履歴が正しく保存されるか |
| オフライン | ネットワーク切断時の動作 |

### 5.2 UI/UX調整

| 項目 | 内容 |
|------|------|
| フォントサイズ | 読みやすさ確認 |
| タップ領域 | ボタンの押しやすさ |
| 色彩 | 正解(緑)/不正解(赤)の視認性 |
| ダークモード | 夜間学習対応 |
| Safe Area | ノッチ・ホームバー対応 |

### 5.3 パフォーマンス確認

| 指標 | 目標値 |
|------|--------|
| 初回起動 | < 3秒 |
| 画面遷移 | < 300ms |
| API応答 | < 1.5秒 |

---

## Phase 6: Apple Developer Program

**期間**: 3-5日
**目標**: 開発者アカウント・証明書準備

### 6.1 Apple Developer Program 登録

| タスク | 工数 | 費用 |
|--------|------|------|
| Apple ID準備 | - | 無料 |
| Developer Program 登録 | 30分 | ¥12,980/年 |
| 承認待ち | 24-48時間 | - |

### 6.2 証明書・プロファイル作成

| タスク | 内容 |
|--------|------|
| App ID 登録 | Bundle ID: `com.yourcompany.concrete-diagnostician` |
| 開発証明書 | Development Certificate |
| 配布証明書 | Distribution Certificate |
| Provisioning Profile | App Store用 |

**EAS を使用する場合**:
```bash
npm install -g eas-cli
eas login
eas credentials  # 証明書自動作成
```

---

## Phase 7: App Store 申請準備

**期間**: 1週間
**目標**: 申請に必要な全素材を準備

### 7.1 アプリアイコン

| サイズ | 用途 |
|--------|------|
| 1024x1024 | App Store |
| 180x180 | iPhone |
| 167x167 | iPad Pro |
| 152x152 | iPad |
| 120x120 | iPhone (Spotlight) |

### 7.2 スクリーンショット

| デバイス | サイズ | 枚数 |
|---------|--------|------|
| iPhone 6.9" | 1320x2868 | 5枚 |
| iPhone 6.7" | 1290x2796 | 5枚 |
| iPhone 5.5" | 1242x2208 | 5枚 |
| iPad 12.9" | 2048x2732 | 5枚 |

**必須画面**:
1. ホーム画面（年度選択）
2. 問題一覧画面
3. 問題演習画面
4. 解説表示画面
5. 進捗・統計画面

### 7.3 テキストコンテンツ

| 項目 | 文字数 | 内容例 |
|------|--------|--------|
| アプリ名 | 30文字以内 | コンクリート診断士試験対策 |
| サブタイトル | 30文字以内 | スキマ時間で効率的に学習 |
| 説明文 | 4,000文字以内 | 機能説明、特徴 |
| キーワード | 100文字以内 | コンクリート診断士,試験対策,... |

### 7.4 法的ドキュメント

| ドキュメント | URL | 内容 |
|-------------|-----|------|
| プライバシーポリシー | 要作成 | データ収集・利用方針 |
| 利用規約 | 要作成 | サービス利用条件 |
| サポートページ | 要作成 | FAQ、問い合わせ先 |

---

## Phase 8: TestFlight ベータテスト

**期間**: 1週間
**目標**: 内部テスターでバグ発見・修正

### 8.1 TestFlight 配信

```bash
# EAS Build で本番ビルド作成
eas build --platform ios --profile production

# TestFlight に提出
eas submit --platform ios
```

### 8.2 テスター募集

| 区分 | 人数 | 対象 |
|------|------|------|
| 内部テスター | 5-10名 | 知人・同僚 |
| 外部テスター | 20-30名 | 一般募集（任意） |

### 8.3 フィードバック収集

- Google Form でバグ報告収集
- 重大バグは即座に修正
- UI/UX改善点をリストアップ

---

## Phase 9: App Store 審査・リリース

**期間**: 1-2週間（審査期間含む）
**目標**: App Store 公開

### 9.1 申請手順

1. App Store Connect でアプリ情報入力
2. スクリーンショット・アイコンアップロード
3. プライバシーポリシーURL設定
4. 本番ビルドをアップロード
5. 「審査に提出」をクリック

### 9.2 審査対応

| ステータス | 期間 | 対応 |
|-----------|------|------|
| 審査待ち | 1-3日 | 待機 |
| 審査中 | 1-2日 | 待機 |
| 承認 | 即座 | リリース実行 |
| リジェクト | - | 指摘事項修正→再申請 |

### 9.3 よくあるリジェクト理由

| 理由 | 対策 |
|------|------|
| プライバシーポリシー不備 | URL確認、内容充実 |
| クラッシュ | 事前テスト徹底 |
| 機能不明確 | 審査ノートに使い方説明 |
| スクリーンショット不一致 | 最新UIで再作成 |

---

## スケジュール概要

| Phase | 内容 | 期間 | 累計 |
|-------|------|------|------|
| 4 | バックエンド構築 | 1週間 | 1週間 |
| 5 | 品質保証・テスト | 1週間 | 2週間 |
| 6 | Apple Developer | 3-5日 | 2.5週間 |
| 7 | 申請準備 | 1週間 | 3.5週間 |
| 8 | TestFlight | 1週間 | 4.5週間 |
| 9 | 審査・リリース | 1-2週間 | 5.5-6.5週間 |

**想定リリース**: 約6週間後

---

## コスト見積もり

| 項目 | 初期費用 | 月額 |
|------|---------|------|
| Apple Developer Program | ¥12,980 | - |
| Cloudflare Workers | ¥0 | ¥0 |
| Turso Database | ¥0 | ¥0 |
| Cloudflare R2 | ¥0 | ¥0 |
| **合計** | **¥12,980** | **¥0** |

---

## チェックリスト

### Phase 4: バックエンド
- [ ] Turso アカウント作成
- [ ] データベース作成・スキーマ適用
- [ ] 100問データ投入
- [ ] Cloudflare Workers デプロイ
- [ ] API動作確認
- [ ] フロントエンド統合

### Phase 5: 品質保証
- [ ] 全機能テスト
- [ ] UI/UX調整
- [ ] パフォーマンス確認
- [ ] バグ修正

### Phase 6: Apple Developer
- [ ] Apple Developer Program 登録
- [ ] 証明書作成
- [ ] Provisioning Profile 作成

### Phase 7: 申請準備
- [ ] アプリアイコン作成
- [ ] スクリーンショット作成
- [ ] 説明文作成
- [ ] プライバシーポリシー作成
- [ ] 利用規約作成
- [ ] サポートページ作成

### Phase 8: TestFlight
- [ ] 本番ビルド作成
- [ ] TestFlight 配信
- [ ] テスター招待
- [ ] フィードバック対応

### Phase 9: リリース
- [ ] App Store Connect 情報入力
- [ ] 審査申請
- [ ] 審査対応
- [ ] **App Store 公開**

---

_最終更新: 2024-12-17_
