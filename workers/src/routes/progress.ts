import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import {
  UserProgress,
  OverallProgress,
  YearProgress,
  CategoryProgress,
} from '../types/progress';

const progress = new Hono<{ Bindings: Env }>();

// 連続学習日数を計算するヘルパー関数
function calculateStudyStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  // 日付を昇順でソート
  const sortedDates = [...new Set(dates.map(d => d.split('T')[0]))].sort();

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 最新の学習日が今日か昨日でなければストリークは0
  const lastStudyDate = sortedDates[sortedDates.length - 1];
  if (lastStudyDate !== today && lastStudyDate !== yesterday) {
    return 0;
  }

  // 最新日から遡って連続日数をカウント
  let streak = 1;
  for (let i = sortedDates.length - 2; i >= 0; i--) {
    const current = new Date(sortedDates[i + 1]);
    const prev = new Date(sortedDates[i]);
    const diffDays = (current.getTime() - prev.getTime()) / 86400000;

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ユーザーの全体進捗取得
progress.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createDbClient(c.env);

  try {
    // 年度別の統計を取得（全体の統計はここから集計）
    const yearResult = await db.execute({
      sql: `
        SELECT
          q.year,
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_answers
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, id,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        GROUP BY q.year
        ORDER BY q.year DESC
      `,
      args: [userId],
    });

    // カテゴリ別の統計を取得
    const categoryResult = await db.execute({
      sql: `
        SELECT
          q.category,
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_answers
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, id,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.category IS NOT NULL
        GROUP BY q.category
        ORDER BY q.category
      `,
      args: [userId],
    });

    // 学習日履歴を取得（ストリーク計算用）
    const datesResult = await db.execute({
      sql: `
        SELECT DISTINCT DATE(answered_at) as study_date
        FROM answers
        WHERE user_id = ?
        ORDER BY study_date DESC
      `,
      args: [userId],
    });

    // 最終学習日を取得（users.last_study_dateから取得 - 履歴クリア後も保持される）
    const lastStudyResult = await db.execute({
      sql: `SELECT last_study_date FROM users WHERE id = ?`,
      args: [userId],
    });

    const studyDates = datesResult.rows.map(row => row.study_date as string);
    const studyStreak = calculateStudyStreak(studyDates);

    // まず年度別データを計算
    const byYear: YearProgress[] = yearResult.rows.map(row => {
      const total = row.total_questions as number;
      const answered = row.answered_questions as number;
      const correct = row.correct_answers as number;
      return {
        year: row.year as number,
        totalQuestions: total,
        answeredQuestions: answered,
        correctAnswers: correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      };
    });

    // 全体の統計は年度別データから集計（一貫性を確保）
    const totalQuestions = byYear.reduce((sum, y) => sum + y.totalQuestions, 0);
    const answeredQuestions = byYear.reduce((sum, y) => sum + y.answeredQuestions, 0);
    const correctAnswers = byYear.reduce((sum, y) => sum + y.correctAnswers, 0);

    const overall: OverallProgress = {
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      accuracy: answeredQuestions > 0
        ? Math.round((correctAnswers / answeredQuestions) * 100)
        : 0,
      studyStreak,
      lastStudyDate: lastStudyResult.rows.length > 0
        ? lastStudyResult.rows[0].last_study_date as string | null
        : null,
    };

    const byCategory: CategoryProgress[] = categoryResult.rows.map(row => {
      const total = row.total_questions as number;
      const answered = row.answered_questions as number;
      const correct = row.correct_answers as number;
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
    console.error('Error fetching user progress:', error);
    return c.json({ error: 'Failed to fetch user progress' }, 500);
  }
});

// 特定年度の進捗取得
progress.get('/:userId/year/:year', async (c) => {
  const userId = c.req.param('userId');
  const year = parseInt(c.req.param('year'));
  const db = createDbClient(c.env);

  if (isNaN(year)) {
    return c.json({ error: 'Invalid year parameter' }, 400);
  }

  try {
    // 年度の統計を取得
    const yearResult = await db.execute({
      sql: `
        SELECT
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_answers
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, id,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.year = ?
      `,
      args: [userId, year],
    });

    // 問題ごとの解答状況を取得
    const questionsResult = await db.execute({
      sql: `
        SELECT
          q.id,
          q.number,
          q.category,
          a.is_correct,
          a.answered_at
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, answered_at,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.year = ?
        ORDER BY q.number
      `,
      args: [userId, year],
    });

    const row = yearResult.rows[0];
    const totalQuestions = row.total_questions as number;
    const answeredQuestions = row.answered_questions as number;
    const correctAnswers = row.correct_answers as number;

    const yearProgress: YearProgress = {
      year,
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      accuracy: answeredQuestions > 0
        ? Math.round((correctAnswers / answeredQuestions) * 100)
        : 0,
    };

    const questions = questionsResult.rows.map(q => ({
      questionId: q.id as string,
      number: q.number as number,
      category: q.category as string | null,
      isAnswered: q.is_correct !== null,
      isCorrect: q.is_correct === null ? false : (q.is_correct as number) === 1,
      answeredAt: q.answered_at as string | null,
    }));

    return c.json({
      year: yearProgress.year,
      totalQuestions: yearProgress.totalQuestions,
      answeredQuestions: yearProgress.answeredQuestions,
      correctAnswers: yearProgress.correctAnswers,
      accuracy: yearProgress.accuracy,
      questions,
    });
  } catch (error) {
    console.error('Error fetching year progress:', error);
    return c.json({ error: 'Failed to fetch year progress' }, 500);
  }
});

// 特定分野の進捗取得
progress.get('/:userId/category/:category', async (c) => {
  const userId = c.req.param('userId');
  const category = c.req.param('category');
  const db = createDbClient(c.env);

  try {
    // 分野の統計を取得
    const categoryResult = await db.execute({
      sql: `
        SELECT
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN q.id END) as answered_questions,
          COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_answers
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, id,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.category = ?
      `,
      args: [userId, category],
    });

    // 問題ごとの解答状況を取得
    const questionsResult = await db.execute({
      sql: `
        SELECT
          q.id,
          q.number,
          q.year,
          a.is_correct,
          a.answered_at
        FROM questions q
        LEFT JOIN (
          SELECT question_id, is_correct, answered_at,
            ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at DESC) as rn
          FROM answers
          WHERE user_id = ?
        ) a ON q.id = a.question_id AND a.rn = 1
        WHERE q.category = ?
        ORDER BY q.year DESC, q.number ASC
      `,
      args: [userId, category],
    });

    const row = categoryResult.rows[0];
    const totalQuestions = row.total_questions as number;
    const answeredQuestions = row.answered_questions as number;
    const correctAnswers = row.correct_answers as number;

    const questions = questionsResult.rows.map(q => ({
      questionId: q.id as string,
      number: q.number as number,
      year: q.year as number,
      isAnswered: q.is_correct !== null,
      isCorrect: q.is_correct === null ? false : (q.is_correct as number) === 1,
      answeredAt: q.answered_at as string | null,
    }));

    return c.json({
      category,
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      accuracy: answeredQuestions > 0
        ? Math.round((correctAnswers / answeredQuestions) * 100)
        : 0,
      questions,
    });
  } catch (error) {
    console.error('Error fetching category progress:', error);
    return c.json({ error: 'Failed to fetch category progress' }, 500);
  }
});

export default progress;
