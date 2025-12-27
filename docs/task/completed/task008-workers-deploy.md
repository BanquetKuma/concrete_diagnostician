# Task 008: Cloudflare Workers 本番デプロイ

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 1時間 |
| 依存タスク | task007 |
| 成果物 | 本番API URL |

---

## 目的

開発した API を Cloudflare Workers 本番環境にデプロイし、動作確認を行う。

---

## 📚 学習ポイント：本番デプロイの基本

### 開発環境と本番環境の違い

```
【開発環境 (Development)】
- localhost:8787 でローカル実行
- エラーメッセージが詳細
- .dev.vars で環境変数を管理
- 自分だけがアクセス

【本番環境 (Production)】
- xxxxx.workers.dev でグローバル公開
- エラーメッセージは最小限（セキュリティ）
- wrangler secret で暗号化管理
- 世界中からアクセス可能
```

### なぜ TypeScript のビルド確認が重要か？

デプロイ前に `npx tsc --noEmit` でエラーチェックします。

```
【ビルド確認の理由】

ローカルでは動いていても...

✗ 型エラーが潜んでいる可能性
✗ 未使用の import がある
✗ undefined になりうる変数

本番環境でエラーが出ると...

✗ API が完全停止
✗ ユーザーに影響
✗ 深夜でも緊急対応が必要

→ デプロイ前のチェックで防げる！
```

### wrangler deploy の流れ

```
【デプロイプロセス】

1. npx wrangler deploy 実行
   ↓
2. TypeScript → JavaScript にコンパイル
   ↓
3. コードを Cloudflare にアップロード
   ↓
4. 世界300+のエッジサーバーに配布
   ↓
5. 数秒後、新しいコードが有効化
   ↓
6. URL が発行される
   https://concrete-diagnostician-api.xxxxx.workers.dev
```

### 本番URLの取り扱い

本番URLは**フロントエンドに設定する値**になります。
この URL をメモしておき、次のタスク（フロントエンド統合）で使用します。

---

## 手順

### 1. wrangler.toml 最終確認

`workers/wrangler.toml`:

```toml
name = "concrete-diagnostician-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# シークレットは wrangler secret put で設定済み
# TURSO_DATABASE_URL
# TURSO_AUTH_TOKEN
```

### 2. TypeScript ビルド確認

```bash
cd workers

# TypeScript コンパイルエラーがないか確認
npx tsc --noEmit

# ローカルで最終動作確認
npx wrangler dev
```

### 3. シークレット設定確認

```bash
# 設定済みシークレット一覧確認
wrangler secret list

# 未設定の場合は設定
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
```

### 4. 本番デプロイ

```bash
cd workers

# デプロイ実行
npx wrangler deploy

# 出力例:
# Published concrete-diagnostician-api
# https://concrete-diagnostician-api.<your-subdomain>.workers.dev
```

### 5. デプロイ確認

デプロイ後に表示されるURLで動作確認:

```bash
# ベースURL（例）
BASE_URL="https://concrete-diagnostician-api.xxxxx.workers.dev"

# ヘルスチェック
curl $BASE_URL/
curl $BASE_URL/api/health

# 年度一覧取得
curl $BASE_URL/api/questions/years

# 2024年度問題一覧
curl $BASE_URL/api/questions/2024

# ユーザー登録
curl -X POST $BASE_URL/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-production-device"}'

# 解答保存
curl -X POST $BASE_URL/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<userId>",
    "questionId": "q-2024-001",
    "selectedChoice": "b",
    "isCorrect": true
  }'

# 進捗取得
curl $BASE_URL/api/progress/<userId>
```

### 6. Cloudflare Dashboard での確認

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. Workers & Pages → `concrete-diagnostician-api` を選択
3. 以下を確認:
   - **Metrics**: リクエスト数、エラー率
   - **Logs**: リアルタイムログ
   - **Settings**: 環境変数、シークレット

### 7. カスタムドメイン設定（オプション）

必要に応じてカスタムドメインを設定:

```bash
# wrangler.toml に追加
# [routes]
# pattern = "api.yourdomain.com/*"
# zone_name = "yourdomain.com"
```

または Cloudflare Dashboard から:

1. Workers → concrete-diagnostician-api
2. Triggers → Custom Domains
3. Add Custom Domain

---

## 本番URL管理

デプロイ後の本番URLを記録:

| 項目 | URL |
|------|-----|
| Base URL | `https://concrete-diagnostician-api.banquet-kuma.workers.dev` |
| Health Check | `/api/health` |
| Questions API | `/api/questions/*` |
| Answers API | `/api/answers/*` |
| Users API | `/api/users/*` |
| Progress API | `/api/progress/*` |

---

## 📚 学習ポイント：本番運用の監視

### wrangler tail でリアルタイムログ監視

本番環境で何が起きているかを確認するには `wrangler tail` を使います。

```bash
wrangler tail

# 出力例:
# [2024-12-17 10:00:01] GET /api/questions/years 200 OK 45ms
# [2024-12-17 10:00:02] POST /api/answers 201 Created 120ms
# [2024-12-17 10:00:03] GET /api/progress/xxx 500 Error 89ms
```

これにより、エラーが発生した瞬間にリアルタイムで確認できます。

### Cloudflare Dashboard の見方

Dashboard では以下の情報が確認できます：

```
【Metrics（メトリクス）】
- リクエスト数: 今日何回APIが呼ばれたか
- エラー率: 500エラーの割合
- CPU時間: 処理にかかった時間

【Logs（ログ）】
- リクエストの詳細
- エラーのスタックトレース
- レスポンス時間

【Settings（設定）】
- 環境変数の確認・変更
- カスタムドメイン設定
```

---

## トラブルシューティング

> 💡 **よくあるトラブルと解決方法**
>
> | 症状 | 原因 | 解決策 |
> |------|------|--------|
> | 500エラー | シークレット未設定 | `wrangler secret list` で確認 |
> | DB接続エラー | URLが間違っている | Turso の URL を再確認 |
> | CORSエラー | origin設定の問題 | cors() ミドルウェアを確認 |
> | デプロイ失敗 | TypeScriptエラー | `npx tsc --noEmit` で確認 |

### デプロイエラー

```bash
# ログを確認
wrangler tail

# 詳細ログでデプロイ
wrangler deploy --verbose
```

### API エラー

1. Cloudflare Dashboard → Workers → Logs でエラー確認
2. シークレットが正しく設定されているか確認
3. Turso データベースが正常に接続できるか確認

### CORS エラー

フロントエンドから接続時にCORSエラーが出る場合:

- `cors()` ミドルウェアの設定を確認
- `origin` を必要に応じて制限

---

## 完了条件

- [x] TypeScript ビルドエラーなし ✅
- [x] wrangler deploy 成功 ✅
- [x] 本番URL取得 ✅
- [x] GET /api/questions/years 動作確認 ✅
- [x] GET /api/questions/:year 動作確認 ✅
- [x] GET /api/questions/:year/:id 動作確認 ✅
- [x] POST /api/users/register 動作確認 ✅
- [x] POST /api/answers 動作確認 ✅
- [x] GET /api/progress/:userId 動作確認 ✅
- [x] Cloudflare Dashboard でメトリクス確認 ✅

---

## 完了記録

| 項目 | 内容 |
|------|------|
| 完了日 | 2024-12-22 |
| 本番URL | `https://concrete-diagnostician-api.banquet-kuma.workers.dev` |
| Version ID | `9128292a-894e-4139-a4c5-40ee0ca5cc3b` |
| サブドメイン | `banquet-kuma.workers.dev` |

---

## 環境変数まとめ

| 変数名 | 設定方法 | 値 |
|--------|----------|-----|
| ENVIRONMENT | wrangler.toml [vars] | production |
| TURSO_DATABASE_URL | wrangler secret put | libsql://... |
| TURSO_AUTH_TOKEN | wrangler secret put | トークン |

---

## 次のタスク

→ [task009-frontend-api-integration.md](./task009-frontend-api-integration.md)
