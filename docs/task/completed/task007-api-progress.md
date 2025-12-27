# Task 007: 進捗取得API実装

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 2時間 |
| 依存タスク | task006 |
| 成果物 | 進捗取得APIエンドポイント |

---

## 目的

ユーザーの学習進捗を取得するAPIを実装する。年度別・カテゴリ別の進捗状況を提供する。

---

## 📚 学習ポイント：集計クエリとデータ分析

### SQL 集計関数とは？

進捗APIでは、大量のデータを集計して「サマリー」を返します。
SQLには便利な集計関数があります。

```sql
【よく使う集計関数】

COUNT(*)     → 行数をカウント
SUM(column)  → 値を合計
AVG(column)  → 平均値を計算
MAX(column)  → 最大値を取得
MIN(column)  → 最小値を取得

例: 100件の解答データから「正答数」を集計
SELECT COUNT(*) as total, SUM(is_correct) as correct
FROM answers WHERE user_id = 'xxx'
→ 結果: total=100, correct=85
```

### GROUP BY の威力

`GROUP BY` を使うと、カテゴリごとに集計できます。

```sql
【GROUP BY なし】
SELECT COUNT(*) FROM questions
→ 100（全問題数）

【GROUP BY あり】
SELECT year, COUNT(*) FROM questions GROUP BY year
→ 2024: 50, 2023: 50（年度別の問題数）

【図解】
┌─────────────────────────────────┐
│      全データ (100件)           │
└─────────────────────────────────┘
          ↓ GROUP BY year
┌───────────────┐ ┌───────────────┐
│  2024 (50件)  │ │  2023 (50件)  │
└───────────────┘ └───────────────┘
```

### LEFT JOIN と外部結合

「まだ解答していない問題」も含めて表示するには `LEFT JOIN` を使います。

```sql
【INNER JOIN】
questions と answers の両方に存在するデータのみ
→ 解答済みの問題だけが結果に含まれる

【LEFT JOIN】
questions のすべて + 対応する answers
→ 未解答の問題も NULL として含まれる

図解:
questions                 answers
┌──────────┐            ┌──────────┐
│ Q1 ─────────────────── A1       │
│ Q2 ─────────────────── A2       │
│ Q3       │            │         │  ← Q3は未解答
└──────────┘            └──────────┘

LEFT JOIN の結果:
Q1, A1 (解答済み)
Q2, A2 (解答済み)
Q3, NULL (未解答)
```

---

## 手順

### 1. 型定義追加

`workers/src/types/progress.ts`:

```typescript
export interface YearProgress {
  year: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number; // パーセンテージ (0-100)
}

export interface CategoryProgress {
  category: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

export interface OverallProgress {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyStreak: number; // 連続学習日数
  lastStudyDate: string | null;
}

export interface UserProgress {
  userId: string;
  overall: OverallProgress;
  byYear: YearProgress[];
  byCategory: CategoryProgress[];
}
```

### 2. 進捗ルート実装

`workers/src/routes/progress.ts`:

```typescript
import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import {
  UserProgress,
  OverallProgress,
  YearProgress,
  CategoryProgress,
} from '../types/progress';

const progress = new Hono<{ Bindings: Env }>();

// ユーザー進捗取得（総合）
progress.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    // ユーザー存在確認
    const userCheck = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    // 全体進捗
    const overallResult = await db.execute({
      sql: `
        SELECT
          (SELECT COUNT(*) FROM questions) as total_questions,
          COUNT(DISTINCT a.question_id) as answered_questions,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
          MAX(a.answered_at) as last_study_date
        FROM answers a
        WHERE a.user_id = ?
      `,
      args: [userId],
    });

    const overallRow = overallResult.rows[0];
    const totalQ = overallRow.total_questions as number;
    const answeredQ = overallRow.answered_questions as number;
    const correctCount = (overallRow.correct_count as number) || 0;

    const overall: OverallProgress = {
      totalQuestions: totalQ,
      answeredQuestions: answeredQ,
      correctAnswers: correctCount,
      accuracy: answeredQ > 0 ? Math.round((correctCount / answeredQ) * 100) : 0,
      studyStreak: await calculateStudyStreak(db, userId),
      lastStudyDate: overallRow.last_study_date as string | null,
    };

    // 年度別進捗
    const yearResult = await db.execute({
      sql: `
        SELECT
          q.year,
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_count
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id AND a.user_id = ?
        GROUP BY q.year
        ORDER BY q.year DESC
      `,
      args: [userId],
    });

    const byYear: YearProgress[] = yearResult.rows.map(row => {
      const total = row.total_questions as number;
      const answered = row.answered_questions as number;
      const correct = (row.correct_count as number) || 0;
      return {
        year: row.year as number,
        totalQuestions: total,
        answeredQuestions: answered,
        correctAnswers: correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      };
    });

    // カテゴリ別進捗
    const categoryResult = await db.execute({
      sql: `
        SELECT
          q.category,
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_count
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id AND a.user_id = ?
        GROUP BY q.category
        ORDER BY q.category
      `,
      args: [userId],
    });

    const byCategory: CategoryProgress[] = categoryResult.rows.map(row => {
      const total = row.total_questions as number;
      const answered = row.answered_questions as number;
      const correct = (row.correct_count as number) || 0;
      return {
        category: row.category as string,
        totalQuestions: total,
        answeredQuestions: answered,
        correctAnswers: correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      };
    });

    const userProgress: UserProgress = {
      userId,
      overall,
      byYear,
      byCategory,
    };

    return c.json({ progress: userProgress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return c.json({ error: 'Failed to fetch progress' }, 500);
  }
});

// 年度別進捗取得
progress.get('/:userId/year/:year', async (c) => {
  const userId = c.req.param('userId');
  const year = parseInt(c.req.param('year'));
  const db = createDbClient(c.env);

  if (isNaN(year)) {
    return c.json({ error: 'Invalid year parameter' }, 400);
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT
          q.id,
          q.number,
          q.category,
          CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as is_answered,
          COALESCE(a.is_correct, 0) as is_correct,
          a.answered_at
        FROM questions q
        LEFT JOIN (
          SELECT question_id, id, is_correct, answered_at,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.year = ?
        ORDER BY q.number
      `,
      args: [userId, year],
    });

    const questions = result.rows.map(row => ({
      questionId: row.id as string,
      number: row.number as number,
      category: row.category as string,
      isAnswered: (row.is_answered as number) === 1,
      isCorrect: (row.is_correct as number) === 1,
      answeredAt: row.answered_at as string | null,
    }));

    const answered = questions.filter(q => q.isAnswered);
    const correct = answered.filter(q => q.isCorrect);

    return c.json({
      year,
      totalQuestions: questions.length,
      answeredQuestions: answered.length,
      correctAnswers: correct.length,
      accuracy: answered.length > 0 ? Math.round((correct.length / answered.length) * 100) : 0,
      questions,
    });
  } catch (error) {
    console.error('Error fetching year progress:', error);
    return c.json({ error: 'Failed to fetch year progress' }, 500);
  }
});

// 連続学習日数計算ヘルパー
async function calculateStudyStreak(db: ReturnType<typeof createDbClient>, userId: string): Promise<number> {
  try {
    const result = await db.execute({
      sql: `
        SELECT DISTINCT DATE(answered_at) as study_date
        FROM answers
        WHERE user_id = ?
        ORDER BY study_date DESC
      `,
      args: [userId],
    });

    if (result.rows.length === 0) {
      return 0;
    }

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < result.rows.length; i++) {
      const studyDate = new Date(result.rows[i].study_date as string);
      studyDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (studyDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (i === 0 && studyDate.getTime() === expectedDate.getTime() - 86400000) {
        // 昨日まで連続していた場合
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (studyDate.getTime() === yesterday.getTime()) {
          streak++;
        }
      } else {
        break;
      }
    }

    return streak;
  } catch {
    return 0;
  }
}

export default progress;
```

> 💡 **ウィンドウ関数 ROW_NUMBER() とは？**
>
> 年度別進捗取得では、同じ問題に複数回解答している場合、**最新の解答だけ**を取得します。
> これを実現するのが `ROW_NUMBER()` です。
>
> ```sql
> ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
>
> 【動作イメージ】
> question_id | answered_at      | rn
> ------------|------------------|----
> Q1          | 2024-12-17 10:00 | 1  ← 最新
> Q1          | 2024-12-16 09:00 | 2
> Q1          | 2024-12-15 08:00 | 3
> Q2          | 2024-12-17 11:00 | 1  ← 最新
> Q2          | 2024-12-10 07:00 | 2
>
> WHERE rn = 1 で、各問題の最新解答だけを取得
> ```
>
> **PARTITION BY**: グループを区切る（問題ごとに番号をリセット）
> **ORDER BY DESC**: 新しい順に番号を振る

> 💡 **連続学習日数（ストリーク）の計算ロジック**
>
> `calculateStudyStreak` 関数は、今日から何日連続で学習しているかを計算します。
>
> ```
> 【計算の流れ】
>
> 1. 学習した日付を新しい順に取得
>    → ["2024-12-17", "2024-12-16", "2024-12-15", "2024-12-13"]
>
> 2. 今日から1日ずつ遡って、学習日と一致するかチェック
>
>    今日 (12/17) と 12/17 → 一致！ streak=1
>    昨日 (12/16) と 12/16 → 一致！ streak=2
>    一昨日 (12/15) と 12/15 → 一致！ streak=3
>    3日前 (12/14) と 12/13 → 不一致... ストップ！
>
> 3. 結果: 連続3日間学習中
> ```
>
> この機能は、ユーザーのモチベーション維持に効果的です。

### 3. メインルーターに統合

`workers/src/index.ts` を更新:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import questions from './routes/questions';
import answers from './routes/answers';
import users from './routes/users';
import progress from './routes/progress';

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
app.route('/api/progress', progress);

export default app;
```

### 4. 動作確認

```bash
# 開発サーバー起動
cd workers
npx wrangler dev

# ユーザー進捗取得
curl http://localhost:8787/api/progress/<userId>

# 年度別進捗詳細取得
curl http://localhost:8787/api/progress/<userId>/year/2024
```

---

## APIエンドポイント仕様

### GET /api/progress/:userId

ユーザーの総合進捗を取得する。

**レスポンス例**:

```json
{
  "progress": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "overall": {
      "totalQuestions": 100,
      "answeredQuestions": 45,
      "correctAnswers": 38,
      "accuracy": 84,
      "studyStreak": 5,
      "lastStudyDate": "2024-12-17T10:00:00.000Z"
    },
    "byYear": [
      {
        "year": 2024,
        "totalQuestions": 50,
        "answeredQuestions": 30,
        "correctAnswers": 25,
        "accuracy": 83
      },
      {
        "year": 2023,
        "totalQuestions": 50,
        "answeredQuestions": 15,
        "correctAnswers": 13,
        "accuracy": 87
      }
    ],
    "byCategory": [
      {
        "category": "材料",
        "totalQuestions": 20,
        "answeredQuestions": 10,
        "correctAnswers": 8,
        "accuracy": 80
      }
    ]
  }
}
```

### GET /api/progress/:userId/year/:year

年度別の詳細進捗を取得する。

**レスポンス例**:

```json
{
  "year": 2024,
  "totalQuestions": 50,
  "answeredQuestions": 30,
  "correctAnswers": 25,
  "accuracy": 83,
  "questions": [
    {
      "questionId": "q-2024-001",
      "number": 1,
      "category": "材料",
      "isAnswered": true,
      "isCorrect": true,
      "answeredAt": "2024-12-17T10:00:00.000Z"
    },
    {
      "questionId": "q-2024-002",
      "number": 2,
      "category": "施工",
      "isAnswered": false,
      "isCorrect": false,
      "answeredAt": null
    }
  ]
}
```

---

## 完了条件

- [✖] progress.ts 型定義作成完了
- [✖] progress.ts ルート実装完了
- [✖] index.ts への統合完了
- [✖] GET /api/progress/:userId 動作確認
- [✖] GET /api/progress/:userId/year/:year 動作確認
- [✖] 連続学習日数計算が正しく動作

---

## 次のタスク

→ [task008-workers-deploy.md](./task008-workers-deploy.md)
