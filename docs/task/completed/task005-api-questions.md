# Task 005: 問題取得API実装

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 2時間 |
| 依存タスク | task004 |
| 成果物 | 問題取得APIエンドポイント |

---

## 目的

年度別の問題一覧取得、および個別問題詳細取得のAPIを実装する。

---

## 📚 学習ポイント：RESTful API 設計の基礎

### REST とは？

**REST**（Representational State Transfer）は、Web API の設計思想です。
HTTPメソッドとURLの組み合わせで「何をするか」を表現します。

```
【RESTful API の基本パターン】

GET    /api/questions       → 問題一覧を取得
GET    /api/questions/123   → ID:123 の問題を取得
POST   /api/questions       → 新しい問題を作成
PUT    /api/questions/123   → ID:123 の問題を更新
DELETE /api/questions/123   → ID:123 の問題を削除
```

### なぜ階層的なURL設計か？

このタスクでは以下のエンドポイントを実装します：

| エンドポイント | 意味 |
|--------------|------|
| `GET /api/questions/years` | 年度の一覧を取得 |
| `GET /api/questions/2024` | 2024年度の問題一覧 |
| `GET /api/questions/2024/q-2024-001` | 特定の問題詳細 |

この設計は「リソースの階層構造」を URL で表現しています：

```
問題（questions）
  └── 年度（2024, 2023...）
        └── 個別問題（q-2024-001, q-2024-002...）
```

### 型定義（TypeScript）の重要性

API のレスポンス形式を TypeScript の型で定義することで：
- フロントエンドとバックエンドで同じ型を共有できる
- コンパイル時にバグを発見できる
- エディタの自動補完が効く

---

## 手順

### 1. Turso データベース接続モジュール作成

`workers/src/lib/db.ts`:

```typescript
import { createClient } from '@libsql/client/web';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

export function createDbClient(env: Env) {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}
```

> 💡 **データベース接続モジュールの解説**
>
> **なぜモジュールとして分離するのか？**
>
> データベース接続ロジックを `db.ts` に集約することで：
> - 複数のルートファイルから同じ接続方法を使える（DRY原則）
> - 接続設定を変更する場合、1箇所だけ修正すれば良い
> - テスト時にモック（偽物）に差し替えやすい
>
> **`@libsql/client/web` とは？**
>
> Turso は SQLite 互換のエッジデータベースです。`@libsql/client/web` は
> Cloudflare Workers 環境で動作するように最適化されたクライアントライブラリです。
>
> ```
> [Workers] ---HTTP/WebSocket---> [Turso Edge DB]
>              libsql/client
> ```
>
> **環境変数を `env` で受け取る理由**
>
> Cloudflare Workers では、環境変数は `process.env` ではなく、
> リクエストハンドラの引数として渡されます。これはセキュリティと
> 隔離性のための設計です。

### 2. 問題データの型定義

`workers/src/types/question.ts`:

```typescript
export interface Question {
  id: string;
  year: number;
  number: number;
  category: string;
  text: string;
  choices: Choice[];
  correctChoiceId: string;
  explanation: string;
}

export interface Choice {
  id: string;
  text: string;
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
```

### 3. 問題取得ルート実装

`workers/src/routes/questions.ts`:

```typescript
import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { Question, QuestionListItem, YearSummary } from '../types/question';

const questions = new Hono<{ Bindings: Env }>();

// 年度一覧取得
questions.get('/years', async (c) => {
  const db = createDbClient(c.env);

  try {
    // 💡 GROUP BY で年度ごとに集計、ORDER BY DESC で新しい年度を先に
    const result = await db.execute(`
      SELECT year, COUNT(*) as total_questions
      FROM questions
      GROUP BY year
      ORDER BY year DESC
    `);

    const years: YearSummary[] = result.rows.map(row => ({
      year: row.year as number,
      totalQuestions: row.total_questions as number,
    }));

    return c.json({ years });
  } catch (error) {
    console.error('Error fetching years:', error);
    return c.json({ error: 'Failed to fetch years' }, 500);
  }
});

// 年度別問題一覧取得
questions.get('/:year', async (c) => {
  // 💡 URL パラメータは文字列なので、数値に変換
  const year = parseInt(c.req.param('year'));
  const db = createDbClient(c.env);

  // 💡 バリデーション: 不正な入力を早期に弾く
  if (isNaN(year)) {
    return c.json({ error: 'Invalid year parameter' }, 400);
  }

  try {
    // 💡 パラメータ化クエリ: SQLインジェクション対策
    // ❌ 危険: `WHERE year = ${year}` （文字列結合）
    // ✅ 安全: `WHERE year = ?` + args配列
    const result = await db.execute({
      sql: `
        SELECT id, year, number, category
        FROM questions
        WHERE year = ?
        ORDER BY number ASC
      `,
      args: [year],
    });

    const questionList: QuestionListItem[] = result.rows.map(row => ({
      id: row.id as string,
      year: row.year as number,
      number: row.number as number,
      category: row.category as string,
    }));

    return c.json({
      year,
      questions: questionList,
      total: questionList.length,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return c.json({ error: 'Failed to fetch questions' }, 500);
  }
});

// 問題詳細取得
questions.get('/:year/:id', async (c) => {
  const year = parseInt(c.req.param('year'));
  const id = c.req.param('id');
  const db = createDbClient(c.env);

  if (isNaN(year)) {
    return c.json({ error: 'Invalid year parameter' }, 400);
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT id, year, number, category, text, choices, correct_choice_id, explanation
        FROM questions
        WHERE year = ? AND id = ?
      `,
      args: [year, id],
    });

    if (result.rows.length === 0) {
      return c.json({ error: 'Question not found' }, 404);
    }

    const row = result.rows[0];
    const question: Question = {
      id: row.id as string,
      year: row.year as number,
      number: row.number as number,
      category: row.category as string,
      text: row.text as string,
      choices: JSON.parse(row.choices as string),
      correctChoiceId: row.correct_choice_id as string,
      explanation: row.explanation as string,
    };

    return c.json({ question });
  } catch (error) {
    console.error('Error fetching question detail:', error);
    return c.json({ error: 'Failed to fetch question' }, 500);
  }
});

export default questions;
```

### 4. メインルーターに統合

`workers/src/index.ts` を更新:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import questions from './routes/questions';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ヘルスチェック
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Concrete Diagnostician API' });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy' });
});

// 問題API
app.route('/api/questions', questions);

export default app;
```

### 5. Turso シークレット設定

```bash
cd workers

# Turso の接続情報をシークレットとして設定
wrangler secret put TURSO_DATABASE_URL
# プロンプトで libsql://... の URL を入力

wrangler secret put TURSO_AUTH_TOKEN
# プロンプトでトークンを入力
```

### 6. ローカルテスト用 .dev.vars 作成

`workers/.dev.vars`:

```
TURSO_DATABASE_URL=libsql://concrete-diagnostician-xxxxx.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

※ `.gitignore` に `.dev.vars` を追加すること

> 💡 **開発環境と本番環境の環境変数管理**
>
> | ファイル | 用途 | Git管理 |
> |---------|------|---------|
> | `.dev.vars` | ローカル開発用 | ❌ 無視 |
> | `wrangler.toml [vars]` | 公開しても良い値 | ✅ 管理 |
> | `wrangler secret` | 本番シークレット | ❌ Cloudflare上で暗号化 |
>
> **なぜ .dev.vars が必要か？**
>
> `wrangler dev` でローカル開発する際、本番の `wrangler secret` は
> 参照できません。そのため、ローカル専用の環境変数ファイルが必要です。
>
> **セキュリティのベストプラクティス**
> - `.dev.vars` は必ず `.gitignore` に追加
> - トークンやパスワードは絶対にコミットしない
> - チーム開発なら `.dev.vars.example` を作成し、形式だけ共有

### 7. 動作確認

```bash
# 開発サーバー起動
cd workers
npx wrangler dev

# 年度一覧取得
curl http://localhost:8787/api/questions/years

# 2024年度の問題一覧取得
curl http://localhost:8787/api/questions/2024

# 問題詳細取得
curl http://localhost:8787/api/questions/2024/q-2024-001
```

---

## APIエンドポイント仕様

### GET /api/questions/years

年度一覧を取得する。

**レスポンス例**:
```json
{
  "years": [
    { "year": 2024, "totalQuestions": 50 },
    { "year": 2023, "totalQuestions": 50 }
  ]
}
```

### GET /api/questions/:year

指定年度の問題一覧を取得する。

**レスポンス例**:
```json
{
  "year": 2024,
  "questions": [
    { "id": "q-2024-001", "year": 2024, "number": 1, "category": "材料" },
    { "id": "q-2024-002", "year": 2024, "number": 2, "category": "施工" }
  ],
  "total": 50
}
```

### GET /api/questions/:year/:id

問題詳細を取得する。

**レスポンス例**:
```json
{
  "question": {
    "id": "q-2024-001",
    "year": 2024,
    "number": 1,
    "category": "材料",
    "text": "コンクリートの圧縮強度に関する記述として...",
    "choices": [
      { "id": "a", "text": "選択肢A" },
      { "id": "b", "text": "選択肢B" },
      { "id": "c", "text": "選択肢C" },
      { "id": "d", "text": "選択肢D" }
    ],
    "correctChoiceId": "b",
    "explanation": "正解はBです。理由は..."
  }
}
```

---

## 完了条件

- [x] db.ts 接続モジュール作成完了
- [x] 型定義ファイル作成完了
- [x] questions.ts ルート実装完了
- [x] index.ts への統合完了
- [x] Turso シークレット設定完了（.dev.vars でローカル開発用に設定済み）
- [x] GET /api/questions/years 動作確認
- [x] GET /api/questions/:year 動作確認
- [x] GET /api/questions/:year/:id 動作確認

---

## 次のタスク

→ [task006-api-answers.md](./task006-api-answers.md)
