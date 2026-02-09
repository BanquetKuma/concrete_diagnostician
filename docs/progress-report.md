# 開発進捗レポート

最終更新: 2026-02-08

## 現在のステータス

**App Store 審査再提出待ち（v1.0.1 ビルド中）**

v1.0.0 は App Store Connect への submit 済みだが、ゲストユーザー向けログインボタン追加等の変更を反映した再ビルドが必要になった。
`expo.version` が `1.0.0` のままだったため `You've already submitted this version` エラーで auto-submit が失敗。
`1.0.1` にバンプし、Windows PowerShell から `eas build --profile production --platform ios --auto-submit` を実行する段階。

---

## 次回再開時の作業（iPhone 実機確認）

### 1. Production ビルド + Submit 実行

Windows PowerShell で以下を実行:

```powershell
cd C:\dev\IOS_App_Dev\concrete_diagnostician
eas build --profile production --platform ios --auto-submit
```

- `expo.version`: `1.0.1`（済）
- `ios.buildNumber`: `autoIncrement: true` により自動インクリメント

### 2. TestFlight で動作確認

ビルド完了後（10-20分）+ App Store Connect 処理（5-30分）を待ち:

1. TestFlight で v1.0.1 をインストール
2. 以下を確認:
   - アプリ起動・ホーム画面表示
   - 問題演習の動作（解答→正誤判定→解説表示）
   - ゲストモードでの動作
   - ゲストユーザー向けヘッダーログインボタンの表示・動作
   - サブスクリプション画面の表示
   - お知らせモーダルの表示

### 3. App Store 用スクリーンショット撮影

TestFlight で確認後、App Store 提出用のスクリーンショットを撮影:

- 6.7インチ (iPhone 15 Pro Max): 1290 x 2796 px
- 6.9インチ (iPhone 16 Pro Max): 1320 x 2868 px

---

## 完了済みフェーズ

### フェーズ0: プロジェクト初期設定 ✅

- Expo Router ファイルベースルーティング設定
- TypeScript strict mode 設定
- ESLint/Prettier 設定
- ディレクトリ構造整理
- Azure 環境の設計と計画

### フェーズ1: 基本機能実装 ✅

- デバイスベースユーザー管理（Expo SecureStore）
- ホーム画面 UI（年度別問題リスト + 進捗表示）
- API クライアント実装

### フェーズ2: コア機能（問題演習） ✅

- 問題表示 UI
- 4択解答ロジック
- 正誤判定 + フィードバック（緑/赤ハイライト）
- 解説表示
- 学習履歴保存

### フェーズ3: バックエンド + 認証 ✅

- Cloudflare Workers + Turso DB（Hono フレームワーク）
- Clerk 認証（Apple / Google / GitHub OAuth）
- RevenueCat サブスクリプション（月額プラン）
- 統計画面（正答率、学習進捗）

### フェーズ4: App Store リリース準備 ✅

- EAS Build 設定（production プロファイル）
- App Store Connect 設定
- iPad 非対応設定（Guideline 2.3.3 対策）
- ゲストアクセス追加（Guideline 5.1.1 対策）
- ゲストユーザー向けヘッダーログインボタン追加
- お知らせモーダル機能追加

---

## 直近の変更履歴（git log）

| コミット | 内容 |
|----------|------|
| `68235d2` | Version 1.0.1 バンプ、CLAUDE.md に EAS submit 注意事項追加 |
| `0481e19` | ゲストユーザー向けヘッダーログインボタン追加 |
| `8e93897` | ゲストモードバグ修正（解答表示、統計読込、アカウントボタン） |
| `54cfd46` | ログイン画面にサインインメリット表示追加 |
| `3001f53` | ゲストアクセス追加（Apple Guideline 5.1.1 対応） |
| `d8358ad` | iPad サポート無効化（App Store 審査対応） |

---

## 既知の課題

- **AUTH-001**: 異なる OAuth プロバイダ間で学習履歴が共有されない（優先度: 低、将来対応）
- **GIT-001**: RAG 用巨大 PDF ファイルは git 管理対象外

詳細は `docs/remaining-issues.md` を参照。

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Expo SDK 53 / React Native / TypeScript |
| ルーティング | Expo Router（ファイルベース） |
| 認証 | Clerk（Apple / Google / GitHub OAuth） |
| 課金 | RevenueCat（App Store IAP） |
| バックエンド | Cloudflare Workers + Hono |
| データベース | Turso（libSQL） |
| ビルド・配信 | EAS Build / EAS Submit / TestFlight |
