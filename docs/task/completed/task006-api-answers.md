# Task 006: 解答保存API実装

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 2時間 |
| 依存タスク | task005 |
| 成果物 | 解答保存APIエンドポイント |

---

## 目的

ユーザーの解答を保存するAPIを実装する。同時にデバイスベースのユーザー管理も実装する。

---

## 📚 学習ポイント：データの永続化とユーザー管理

### POST リクエストとは？

HTTP メソッドの中で、**POST** は「新しいデータを作成する」時に使います。

```
【HTTPメソッドの使い分け】

GET    → データを「取得」する（読み取り専用）
POST   → データを「作成」する（新規追加）
PUT    → データを「更新」する（既存データの変更）
DELETE → データを「削除」する
```

### デバイスベース認証とは？

このアプリでは、ログイン画面なしでユーザーを識別します。

```
【デバイスベース認証のフロー】

1. アプリ初回起動
   ↓
2. デバイス固有のIDを取得（例: "iPhone-ABC123"）
   ↓
3. サーバーに送信「このデバイスIDのユーザーいる？」
   ↓
4a. いる場合 → 既存ユーザー情報を返す
4b. いない場合 → 新規ユーザーを作成して返す
```

**メリット**: ユーザーがパスワードを覚える必要がない、アプリ起動後すぐ使える
**デメリット**: 機種変更時にデータ引き継ぎができない

### UUID（Universally Unique Identifier）

ユーザーIDには UUID を使用します。これは世界中で一意（ユニーク）になる識別子です。

```
UUID の例: 550e8400-e29b-41d4-a716-446655440000

【なぜ連番ではなくUUIDを使うか？】

❌ 連番（1, 2, 3...）の問題:
   - 他人のIDを推測できる（セキュリティリスク）
   - 複数サーバー間で重複の可能性

✅ UUIDのメリット:
   - 推測不可能（ランダム）
   - 衝突の確率が天文学的に低い
   - 分散システムで安全
```

---

## 手順

### 1. 型定義追加

`workers/src/types/answer.ts`:

```typescript
export interface AnswerRequest {
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
}

export interface AnswerResponse {
  id: number;
  userId: string;
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
  answeredAt: string;
}
```

### 2. ユーザー型定義

`workers/src/types/user.ts`:

```typescript
export interface User {
  id: string;
  deviceId: string;
  createdAt: string;
}

export interface UserCreateRequest {
  deviceId: string;
}
```

### 3. ユーザールート実装

`workers/src/routes/users.ts`:

```typescript
import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { User, UserCreateRequest } from '../types/user';
import { v4 as uuidv4 } from 'uuid';

const users = new Hono<{ Bindings: Env }>();

// ユーザー登録/取得（デバイスIDベース）
users.post('/register', async (c) => {
  const db = createDbClient(c.env);
  const body = await c.req.json<UserCreateRequest>();

  if (!body.deviceId) {
    return c.json({ error: 'deviceId is required' }, 400);
  }

  try {
    // 既存ユーザー確認
    const existing = await db.execute({
      sql: 'SELECT id, device_id, created_at FROM users WHERE device_id = ?',
      args: [body.deviceId],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const user: User = {
        id: row.id as string,
        deviceId: row.device_id as string,
        createdAt: row.created_at as string,
      };
      return c.json({ user, isNew: false });
    }

    // 新規ユーザー作成
    const userId = uuidv4();
    await db.execute({
      sql: 'INSERT INTO users (id, device_id) VALUES (?, ?)',
      args: [userId, body.deviceId],
    });

    const user: User = {
      id: userId,
      deviceId: body.deviceId,
      createdAt: new Date().toISOString(),
    };

    return c.json({ user, isNew: true }, 201);
  } catch (error) {
    console.error('Error registering user:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

// ユーザー情報取得
users.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: 'SELECT id, device_id, created_at FROM users WHERE id = ?',
      args: [userId],
    });

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const row = result.rows[0];
    const user: User = {
      id: row.id as string,
      deviceId: row.device_id as string,
      createdAt: row.created_at as string,
    };

    return c.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

export default users;
```

> 💡 **Upsert パターン（登録または取得）**
>
> `POST /api/users/register` は「Upsert」と呼ばれるパターンを実装しています。
>
> ```
> Upsert = Update + Insert（更新または挿入）
>
> IF 既存データあり THEN
>   既存データを返す（Update相当）
> ELSE
>   新規作成して返す（Insert）
> END IF
> ```
>
> これにより、フロントエンドは「ユーザーが存在するかどうか」を気にせず、
> 常に同じエンドポイントを呼ぶだけで済みます。

### 4. 解答ルート実装

`workers/src/routes/answers.ts`:

```typescript
import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { AnswerRequest, AnswerResponse } from '../types/answer';

const answers = new Hono<{ Bindings: Env }>();

// 解答保存
answers.post('/', async (c) => {
  const db = createDbClient(c.env);
  const body = await c.req.json<AnswerRequest>();

  // バリデーション
  if (!body.userId || !body.questionId || !body.selectedChoice || body.isCorrect === undefined) {
    return c.json({
      error: 'Missing required fields: userId, questionId, selectedChoice, isCorrect',
    }, 400);
  }

  try {
    // ユーザー存在確認
    const userCheck = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [body.userId],
    });

    if (userCheck.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    // 問題存在確認
    const questionCheck = await db.execute({
      sql: 'SELECT id FROM questions WHERE id = ?',
      args: [body.questionId],
    });

    if (questionCheck.rows.length === 0) {
      return c.json({ error: 'Question not found' }, 404);
    }

    // 解答保存
    const result = await db.execute({
      sql: `
        INSERT INTO answers (user_id, question_id, selected_choice, is_correct)
        VALUES (?, ?, ?, ?)
      `,
      args: [body.userId, body.questionId, body.selectedChoice, body.isCorrect ? 1 : 0],
    });

    const answerId = Number(result.lastInsertRowid);

    const response: AnswerResponse = {
      id: answerId,
      userId: body.userId,
      questionId: body.questionId,
      selectedChoice: body.selectedChoice,
      isCorrect: body.isCorrect,
      answeredAt: new Date().toISOString(),
    };

    return c.json({ answer: response }, 201);
  } catch (error) {
    console.error('Error saving answer:', error);
    return c.json({ error: 'Failed to save answer' }, 500);
  }
});

// ユーザーの解答履歴取得
answers.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const result = await db.execute({
      sql: `
        SELECT id, user_id, question_id, selected_choice, is_correct, answered_at
        FROM answers
        WHERE user_id = ?
        ORDER BY answered_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [userId, limit, offset],
    });

    const answerList: AnswerResponse[] = result.rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      questionId: row.question_id as string,
      selectedChoice: row.selected_choice as string,
      isCorrect: (row.is_correct as number) === 1,
      answeredAt: row.answered_at as string,
    }));

    return c.json({
      answers: answerList,
      total: answerList.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching answers:', error);
    return c.json({ error: 'Failed to fetch answers' }, 500);
  }
});

// 特定問題の解答履歴取得
answers.get('/question/:questionId/user/:userId', async (c) => {
  const questionId = c.req.param('questionId');
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: `
        SELECT id, user_id, question_id, selected_choice, is_correct, answered_at
        FROM answers
        WHERE question_id = ? AND user_id = ?
        ORDER BY answered_at DESC
      `,
      args: [questionId, userId],
    });

    const answerList: AnswerResponse[] = result.rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      questionId: row.question_id as string,
      selectedChoice: row.selected_choice as string,
      isCorrect: (row.is_correct as number) === 1,
      answeredAt: row.answered_at as string,
    }));

    return c.json({ answers: answerList });
  } catch (error) {
    console.error('Error fetching question answers:', error);
    return c.json({ error: 'Failed to fetch answers' }, 500);
  }
});

export default answers;
```

> 💡 **データ整合性の守り方**
>
> 解答を保存する前に、ユーザーと問題が本当に存在するかをチェックしています。
> これは**参照整合性**を保つための重要なパターンです。
>
> ```
> 【解答保存時のチェック順序】
>
> 1. バリデーション: 必須フィールドがあるか？
>    → ないなら 400 Bad Request
>
> 2. ユーザー存在確認: このユーザーIDは有効か？
>    → 無効なら 404 Not Found
>
> 3. 問題存在確認: この問題IDは有効か？
>    → 無効なら 404 Not Found
>
> 4. データ保存: 上記すべてOKなら INSERT
>    → 成功したら 201 Created
> ```
>
> **なぜ存在確認が必要？**
> - 不正なデータがDBに入るのを防ぐ
> - エラー原因を特定しやすくする（どのデータが無効か分かる）
> - データベースの参照整合性エラーを事前に回避

> 💡 **ページネーション（limit/offset）**
>
> `GET /api/answers/user/:userId` では、クエリパラメータで結果数を制限できます。
>
> ```
> /api/answers/user/xxx?limit=10&offset=0  → 1〜10件目
> /api/answers/user/xxx?limit=10&offset=10 → 11〜20件目
>
> 【ページネーションの仕組み】
>
> LIMIT 10   → 最大10件を取得
> OFFSET 20  → 最初の20件をスキップ
>
> 例: 全50件のデータがある場合
>   Page 1: LIMIT 10 OFFSET 0  → 1〜10件
>   Page 2: LIMIT 10 OFFSET 10 → 11〜20件
>   Page 3: LIMIT 10 OFFSET 20 → 21〜30件
> ```
>
> 大量のデータを一度に取得すると、通信量とメモリを消費するため、
> 必要な分だけ取得するのがベストプラクティスです。

### 5. UUID パッケージ追加

```bash
cd workers
npm install uuid
npm install -D @types/uuid
```

### 6. メインルーターに統合

`workers/src/index.ts` を更新:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import questions from './routes/questions';
import answers from './routes/answers';
import users from './routes/users';

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

// API ルート
app.route('/api/questions', questions);
app.route('/api/answers', answers);
app.route('/api/users', users);

export default app;
```

### 7. 動作確認

```bash
# 開発サーバー起動
cd workers
npx wrangler dev

# ユーザー登録
curl -X POST http://localhost:8787/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-001"}'

# 解答保存
curl -X POST http://localhost:8787/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<取得したuserId>",
    "questionId": "q-2024-001",
    "selectedChoice": "b",
    "isCorrect": true
  }'

# 解答履歴取得
curl http://localhost:8787/api/answers/user/<userId>
```

---

## APIエンドポイント仕様

### POST /api/users/register

デバイスIDでユーザー登録/取得を行う。

**リクエスト**:
```json
{
  "deviceId": "unique-device-identifier"
}
```

**レスポンス例**:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deviceId": "unique-device-identifier",
    "createdAt": "2024-12-17T10:00:00.000Z"
  },
  "isNew": true
}
```

### POST /api/answers

解答を保存する。

**リクエスト**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "questionId": "q-2024-001",
  "selectedChoice": "b",
  "isCorrect": true
}
```

**レスポンス例**:
```json
{
  "answer": {
    "id": 1,
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "questionId": "q-2024-001",
    "selectedChoice": "b",
    "isCorrect": true,
    "answeredAt": "2024-12-17T10:05:00.000Z"
  }
}
```

### GET /api/answers/user/:userId

ユーザーの解答履歴を取得する。

**クエリパラメータ**:
- `limit`: 取得件数（デフォルト: 50）
- `offset`: オフセット（デフォルト: 0）

**レスポンス例**:
```json
{
  "answers": [
    {
      "id": 1,
      "userId": "...",
      "questionId": "q-2024-001",
      "selectedChoice": "b",
      "isCorrect": true,
      "answeredAt": "2024-12-17T10:05:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

## 完了条件

- [ ] answer.ts 型定義作成完了
- [ ] user.ts 型定義作成完了
- [ ] users.ts ルート実装完了
- [ ] answers.ts ルート実装完了
- [ ] uuid パッケージインストール完了
- [ ] index.ts への統合完了
- [ ] POST /api/users/register 動作確認
- [ ] POST /api/answers 動作確認
- [ ] GET /api/answers/user/:userId 動作確認

---

## 次のタスク

→ [task007-api-progress.md](./task007-api-progress.md)
