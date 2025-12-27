import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { AnswerRequest, AnswerResponse } from '../types/answer';

const answers = new Hono<{ Bindings: Env }>();

// 解答保存
answers.post('/', async (c) => {
  const db = createDbClient(c.env);

  try {
    const body = await c.req.json<AnswerRequest>();

    if (!body.userId || !body.questionId || !body.selectedChoice || body.isCorrect === undefined) {
      return c.json({ error: 'userId, questionId, selectedChoice, and isCorrect are required' }, 400);
    }

    const answeredAt = new Date().toISOString();

    const result = await db.execute({
      sql: `INSERT INTO answers (user_id, question_id, selected_choice_id, is_correct, answered_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [body.userId, body.questionId, body.selectedChoice, body.isCorrect ? 1 : 0, answeredAt],
    });

    // Update users.last_study_date (preserved even after clearing history)
    await db.execute({
      sql: `UPDATE users SET last_study_date = ? WHERE id = ?`,
      args: [answeredAt, body.userId],
    });

    const answer: AnswerResponse = {
      id: Number(result.lastInsertRowid),
      userId: body.userId,
      questionId: body.questionId,
      selectedChoice: body.selectedChoice,
      isCorrect: body.isCorrect,
      answeredAt,
    };

    return c.json({ answer }, 201);
  } catch (error) {
    console.error('Error saving answer:', error);
    return c.json({ error: 'Failed to save answer' }, 500);
  }
});

// ユーザーの解答履歴取得（ページネーション付き）
answers.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: `SELECT id, user_id, question_id, selected_choice_id, is_correct, answered_at
            FROM answers
            WHERE user_id = ?
            ORDER BY answered_at DESC
            LIMIT ? OFFSET ?`,
      args: [userId, limit, offset],
    });

    const answerList: AnswerResponse[] = result.rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      questionId: row.question_id as string,
      selectedChoice: row.selected_choice_id as string,
      isCorrect: (row.is_correct as number) === 1,
      answeredAt: row.answered_at as string,
    }));

    // 総件数を取得
    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as total FROM answers WHERE user_id = ?',
      args: [userId],
    });
    const total = countResult.rows[0].total as number;

    return c.json({
      answers: answerList,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + answerList.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching answer history:', error);
    return c.json({ error: 'Failed to fetch answer history' }, 500);
  }
});

// 特定の問題への解答取得
answers.get('/question/:questionId/user/:userId', async (c) => {
  const questionId = c.req.param('questionId');
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: `SELECT id, user_id, question_id, selected_choice_id, is_correct, answered_at
            FROM answers
            WHERE question_id = ? AND user_id = ?
            ORDER BY answered_at DESC
            LIMIT 1`,
      args: [questionId, userId],
    });

    if (result.rows.length === 0) {
      return c.json({ answer: null });
    }

    const row = result.rows[0];
    const answer: AnswerResponse = {
      id: row.id as number,
      userId: row.user_id as string,
      questionId: row.question_id as string,
      selectedChoice: row.selected_choice_id as string,
      isCorrect: (row.is_correct as number) === 1,
      answeredAt: row.answered_at as string,
    };

    return c.json({ answer });
  } catch (error) {
    console.error('Error fetching answer:', error);
    return c.json({ error: 'Failed to fetch answer' }, 500);
  }
});

// 特定分野の解答履歴をクリア
answers.delete('/user/:userId/category/:category', async (c) => {
  const userId = c.req.param('userId');
  const category = c.req.param('category');
  const db = createDbClient(c.env);

  try {
    // 該当分野の問題IDを取得してから、その問題への解答を削除
    const result = await db.execute({
      sql: `DELETE FROM answers
            WHERE user_id = ?
            AND question_id IN (
              SELECT id FROM questions WHERE category = ?
            )`,
      args: [userId, category],
    });

    return c.json({
      success: true,
      deletedCount: result.rowsAffected,
      message: `${category}分野の学習履歴をクリアしました`,
    });
  } catch (error) {
    console.error('Error clearing category answers:', error);
    return c.json({ error: 'Failed to clear category answers' }, 500);
  }
});

// 全解答履歴をクリア
answers.delete('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: 'DELETE FROM answers WHERE user_id = ?',
      args: [userId],
    });

    return c.json({
      success: true,
      deletedCount: result.rowsAffected,
      message: '全ての学習履歴をクリアしました',
    });
  } catch (error) {
    console.error('Error clearing all answers:', error);
    return c.json({ error: 'Failed to clear all answers' }, 500);
  }
});

export default answers;
