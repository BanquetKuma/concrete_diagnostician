# Cloudflare + Turso 低コストバックエンド設計

## 概要

Azure代替として、Cloudflare Workers + Turso Database を採用することで、MVPフェーズのバックエンドコストを**実質無料**に抑える。

---

## コスト比較

### Azure構成（現計画）

| サービス | 月額 | 備考 |
|---------|------|------|
| Cosmos DB | ¥3,000 | 400 RU/s |
| Azure Functions | ¥500 | 100万実行 |
| Blob Storage | ¥300 | 10GB |
| Application Insights | ¥1,000 | 5GB/月 |
| **合計** | **¥4,800/月** | 問題生成後 |

### Cloudflare + Turso構成（新提案）

| サービス | 月額 | 無料枠 |
|---------|------|--------|
| Cloudflare Workers | **¥0** | 100,000リクエスト/日 |
| Turso Database | **¥0** | 9GB, 10億行読み取り/月 |
| Cloudflare R2 | **¥0** | 10GB ストレージ |
| **合計** | **¥0/月** | MVPには十分 |

### 年間コスト削減効果

| 項目 | Azure | Cloudflare+Turso | 削減額 |
|------|-------|------------------|--------|
| 年間バックエンド | ¥57,600 | ¥0 | **¥57,600** |
| Apple Developer | ¥12,980 | ¥12,980 | ¥0 |
| **年間合計** | ¥70,580 | ¥12,980 | **¥57,600** |

---

## アーキテクチャ比較

### Before: Azure構成

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Expo App       │────▶│  Azure Functions │────▶│  Cosmos DB      │
│  (React Native) │     │  (Node.js)       │     │  (NoSQL)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Blob Storage    │
                        │  (PDF/Images)    │
                        └──────────────────┘
```

### After: Cloudflare + Turso構成

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Expo App       │────▶│ Cloudflare       │────▶│  Turso          │
│  (React Native) │     │ Workers          │     │  (SQLite Edge)  │
└─────────────────┘     │ (TypeScript)     │     └─────────────────┘
                        └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Cloudflare R2   │
                        │  (S3互換)        │
                        └──────────────────┘
```

---

## サービス詳細

### 1. Cloudflare Workers

**用途**: API エンドポイント（Azure Functions代替）

**無料枠**:
- 100,000 リクエスト/日
- 10ms CPU時間/リクエスト
- 128MB メモリ

**特徴**:
- TypeScript/JavaScript対応
- グローバルエッジ配信（低レイテンシ）
- Honoフレームワーク推奨

**実装例**:
```typescript
// workers/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@libsql/client';

const app = new Hono();

app.use('*', cors());

// Turso接続
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 問題取得API
app.get('/api/questions/:year', async (c) => {
  const year = c.req.param('year');
  const result = await db.execute({
    sql: 'SELECT * FROM questions WHERE year = ?',
    args: [year],
  });
  return c.json(result.rows);
});

// 解答保存API
app.post('/api/answers', async (c) => {
  const body = await c.req.json();
  await db.execute({
    sql: `INSERT INTO answers (user_id, question_id, selected_choice, is_correct, answered_at)
          VALUES (?, ?, ?, ?, datetime('now'))`,
    args: [body.userId, body.questionId, body.selectedChoice, body.isCorrect],
  });
  return c.json({ success: true });
});

export default app;
```

---

### 2. Turso Database

**用途**: データベース（Cosmos DB代替）

**無料枠**:
- 9GB ストレージ
- 500 データベース
- 10億行 読み取り/月
- 2500万行 書き込み/月

**特徴**:
- SQLite互換（馴染みのあるSQL）
- エッジレプリカ（低レイテンシ）
- libSQL（オープンソース）

**スキーマ設計**:
```sql
-- users テーブル
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);

-- questions テーブル
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  number INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  choices TEXT NOT NULL,  -- JSON配列
  correct_choice_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- answers テーブル
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- インデックス
CREATE INDEX idx_questions_year ON questions(year);
CREATE INDEX idx_answers_user ON answers(user_id);
CREATE INDEX idx_answers_question ON answers(question_id);
```

---

### 3. Cloudflare R2

**用途**: ファイルストレージ（Blob Storage代替）

**無料枠**:
- 10GB ストレージ
- 1000万 読み取り/月
- 100万 書き込み/月

**用途（本アプリ）**:
- 問題画像（将来的に）
- バックアップファイル

---

## 移行手順

### Step 1: Turso セットアップ

```bash
# Turso CLI インストール
curl -sSfL https://get.tur.so/install.sh | bash

# ログイン
turso auth login

# データベース作成
turso db create concrete-diagnostician

# 接続URL取得
turso db show concrete-diagnostician --url

# 認証トークン取得
turso db tokens create concrete-diagnostician
```

### Step 2: Cloudflare Workers セットアップ

```bash
# Wrangler CLI インストール
npm install -g wrangler

# ログイン
wrangler login

# プロジェクト作成
mkdir workers && cd workers
npm init -y
npm install hono @libsql/client

# wrangler.toml 設定
cat > wrangler.toml << 'EOF'
name = "concrete-diagnostician-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# シークレットは wrangler secret put で設定
EOF

# シークレット設定
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN

# デプロイ
wrangler deploy
```

### Step 3: 問題データ投入

```bash
# 生成済みJSONをTursoに投入
turso db shell concrete-diagnostician < scripts/import_questions.sql
```

### Step 4: アプリ側API設定

```typescript
// lib/config.ts
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8787'
  : 'https://concrete-diagnostician-api.your-subdomain.workers.dev';
```

---

## 無料枠で十分な理由

| 指標 | 想定値 | 無料枠 | 余裕度 |
|------|--------|--------|--------|
| 日次APIリクエスト | 1,000 | 100,000 | 100倍 |
| 月間DB読み取り | 100万行 | 10億行 | 1000倍 |
| 月間DB書き込み | 10万行 | 2500万行 | 250倍 |
| ストレージ | 100MB | 9GB | 90倍 |

**想定ユーザー規模（無料枠内）**:
- 同時アクティブユーザー: 100人
- 1日あたりリクエスト: 10,000
- 月間ユーザー数: 1,000人

---

## 制限事項と対策

### Cloudflare Workers

| 制限 | 対策 |
|------|------|
| 10ms CPU時間/リクエスト | シンプルなAPI設計、重い処理は避ける |
| 128MB メモリ | データはDBから取得、メモリにため込まない |
| 100,000リクエスト/日 | MVPでは十分、有料プランは$5/月 |

### Turso

| 制限 | 対策 |
|------|------|
| 9GB ストレージ | 問題データは数MB、十分 |
| SQLite互換 | 複雑なJOINは避ける |

---

## 将来的なスケールアップ

MVPで成功した場合の有料プランへの移行:

### Cloudflare Workers Paid ($5/月)
- 1000万リクエスト/月
- 50ms CPU時間/リクエスト

### Turso Scaler ($29/月)
- 24GB ストレージ
- 100億行 読み取り/月

**スケールアップ後の月額**: 約$34 (¥5,000) ← Azureより安い

---

## 次のアクション

1. [ ] Tursoアカウント作成・DB作成
2. [ ] Cloudflareアカウント作成・Workers設定
3. [ ] API実装（Hono + libsql）
4. [ ] 問題データ投入スクリプト作成
5. [ ] アプリ側APIクライアント実装
6. [ ] 動作確認・テスト

---

_作成日: 2024-12-17_
_ステータス: 検討中_
