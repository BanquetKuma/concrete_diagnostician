# Task 004: Cloudflare Workers プロジェクト作成

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 1.5時間 |
| 依存タスク | task003 |
| 成果物 | Workers プロジェクト基盤 |

---

## 目的

Cloudflare Workers プロジェクトを作成し、Hono フレームワークでAPI基盤を構築する。

---

## 📚 学習ポイント：なぜ Cloudflare Workers を選ぶのか？

### サーバーレスアーキテクチャとは

従来のサーバー運用では、24時間稼働するサーバーを管理する必要がありました。**サーバーレス**は、リクエストが来たときだけコードが実行され、使った分だけ課金される仕組みです。

```
【従来のサーバー】
[リクエスト] → [常時稼働サーバー] → [レスポンス]
                     ↑
              24時間電気代がかかる

【サーバーレス（Cloudflare Workers）】
[リクエスト] → [一時的にコード実行] → [レスポンス]
                     ↑
              使った時間だけ課金
```

### Cloudflare Workers の特徴

1. **エッジコンピューティング**: 世界中のデータセンター（300+）でコードが実行されるため、ユーザーに近い場所から応答できる
2. **コールドスタートがほぼゼロ**: AWS Lambda等と比べて起動が非常に速い（V8 Isolates技術）
3. **無料枠が充実**: 1日10万リクエストまで無料
4. **簡単なデプロイ**: `wrangler deploy` 一発でグローバル展開

### なぜ Hono フレームワーク？

Hono（炎）は、日本人開発者が作った超軽量Webフレームワークです。

| 特徴 | 説明 |
|------|------|
| 超軽量 | わずか14KB、Cloudflare Workers に最適 |
| Express互換 | Express.jsを知っていれば即座に使える |
| TypeScript | 型安全な開発が可能 |
| マルチランタイム | Workers、Deno、Bun、Node.js で動作 |

```typescript
// Hono は Express に似たシンプルな構文
app.get('/hello', (c) => c.text('Hello!'))  // Hono
app.get('/hello', (req, res) => res.send('Hello!'))  // Express（参考）
```

---

## 手順

### 1. Wrangler CLI インストール

```bash
npm install -g wrangler
```

### 2. Cloudflare ログイン

```bash
wrangler login
# ブラウザで認証
```

### 3. プロジェクト作成

```bash
cd /mnt/c/dev/IOS_App_Dev/concrete_diagnostician

# workers ディレクトリ作成
mkdir -p workers
cd workers

# package.json 初期化
npm init -y

# 依存パッケージインストール
npm install hono @libsql/client
npm install -D wrangler typescript @types/node
```

### 4. TypeScript 設定

`workers/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

> 💡 **設定項目の解説**
> - `target: "ES2021"`: Cloudflare Workers はモダンな JavaScript エンジン（V8）で動作するため、最新の構文が使える
> - `module: "ESNext"`: ESモジュール形式でコードを書く（`import/export` 構文）
> - `strict: true`: 厳格な型チェックを有効にしてバグを防ぐ
> - `types`: Cloudflare Workers 固有の型定義（`Request`, `Response` など）を読み込む

### 5. Wrangler 設定

`workers/wrangler.toml`:

```toml
name = "concrete-diagnostician-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# シークレットは wrangler secret put で設定
# TURSO_DATABASE_URL
# TURSO_AUTH_TOKEN
```

> 💡 **wrangler.toml の解説**
>
> Wrangler は Cloudflare Workers の CLI ツールで、`wrangler.toml` はその設定ファイルです。
>
> | 項目 | 説明 |
> |------|------|
> | `name` | デプロイ後の URL に使われる（例: `concrete-diagnostician-api.xxx.workers.dev`）|
> | `main` | エントリーポイントとなるファイル |
> | `compatibility_date` | Workers ランタイムのバージョンを固定（互換性維持のため） |
> | `[vars]` | 環境変数（公開しても問題ない値） |
>
> **シークレットと環境変数の違い**
> - `[vars]`: コードに含まれる（Git にコミットされる）
> - `wrangler secret`: 暗号化されて保存（APIキーやパスワード向け）

### 6. エントリーポイント作成

`workers/src/index.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS設定
app.use('*', cors({
  origin: '*',
  [task005-api-questions.md](completed/task005-api-questions.md)
}));

// ヘルスチェック
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Concrete Diagnostician API' });
});

// API ルート（後続タスクで実装）
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy' });
});

export default app;
```

> 💡 **コード解説**
>
> **CORS（Cross-Origin Resource Sharing）とは？**
>
> ブラウザのセキュリティ機能により、異なるドメイン間の通信は制限されています。
> 例えば、アプリ（`localhost:8081`）から API（`workers.dev`）へのリクエストは、
> CORS 設定なしでは拒否されます。
>
> ```
> [Expo アプリ]  ----×---- [Workers API]   ← CORS エラー
> localhost:8081         workers.dev
>
> [Expo アプリ]  ----✓---- [Workers API]   ← CORS 設定で許可
> ```
>
> **ヘルスチェックエンドポイントの重要性**
>
> `/api/health` は「API が正常に動作しているか」を確認するためのエンドポイントです。
> - 監視ツールが定期的にアクセスして死活監視
> - デプロイ後の動作確認
> - ロードバランサーのヘルスチェック
>
> **`export default app` の意味**
>
> Cloudflare Workers は `default export` されたオブジェクトを自動的に実行します。
> Hono の `app` オブジェクトは Workers が期待する `fetch` ハンドラを内包しています。

### 7. ローカル開発サーバー起動

```bash
cd workers
npx wrangler dev
```

### 8. 動作確認

```bash
curl http://localhost:8787/
curl http://localhost:8787/api/health
```

---

## ディレクトリ構造

```
workers/
├── src/
│   ├── index.ts          # エントリーポイント
│   ├── routes/           # APIルート（後続タスク）
│   │   ├── questions.ts
│   │   ├── answers.ts
│   │   └── progress.ts
│   └── lib/
│       └── db.ts         # Turso接続
├── package.json
├── tsconfig.json
└── wrangler.toml
```

---

## 完了条件

- [x] Wrangler CLI インストール完了
- [ ] Cloudflare アカウント認証完了（デプロイ時に `wrangler login` 実行）
- [x] workers/ ディレクトリ作成
- [x] 依存パッケージインストール完了
- [x] wrangler.toml 設定完了
- [x] ローカル開発サーバー起動確認
- [x] ヘルスチェック API 動作確認

---

## 次のタスク

→ [task005-api-questions.md](./task005-api-questions.md)
