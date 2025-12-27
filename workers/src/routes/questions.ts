import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { Question, QuestionListItem, YearSummary, CategorySummary } from '../types/question';

const questions = new Hono<{ Bindings: Env }>();

// カテゴリ名の日本語マッピング
const CATEGORY_LABELS: Record<string, string> = {
  'materials': 'コンクリート材料学',
  'mix-design': '配合設計',
  'construction': '施工技術',
  'quality': '品質管理',
  'deterioration': '劣化メカニズム',
  'diagnosis': '診断技術',
  'repair': '補修・補強工法',
  'maintenance': '維持管理計画',
  'regulations': '関連法規・基準',
};

// カテゴリの表示順序
const CATEGORY_ORDER = [
  'materials',
  'mix-design',
  'construction',
  'quality',
  'deterioration',
  'diagnosis',
  'repair',
  'maintenance',
  'regulations',
];

// 分野一覧取得
questions.get('/categories', async (c) => {
  const db = createDbClient(c.env);

  try {
    const result = await db.execute(`
      SELECT category, COUNT(*) as total_questions
      FROM questions
      GROUP BY category
    `);

    const categoryMap = new Map<string, number>();
    result.rows.forEach(row => {
      categoryMap.set(row.category as string, row.total_questions as number);
    });

    // 指定順序でソート
    const categories: CategorySummary[] = CATEGORY_ORDER
      .filter(cat => categoryMap.has(cat))
      .map(cat => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        totalQuestions: categoryMap.get(cat) || 0,
      }));

    return c.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

// 年度一覧取得（後方互換性のため維持）
questions.get('/years', async (c) => {
  const db = createDbClient(c.env);

  try {
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

// 分野別問題一覧取得
questions.get('/category/:category', async (c) => {
  const category = c.req.param('category');
  const db = createDbClient(c.env);

  if (!CATEGORY_ORDER.includes(category)) {
    return c.json({ error: 'Invalid category parameter' }, 400);
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT id, year, number, category
        FROM questions
        WHERE category = ?
        ORDER BY year DESC, number ASC
      `,
      args: [category],
    });

    const questionList: QuestionListItem[] = result.rows.map(row => ({
      id: row.id as string,
      year: row.year as number,
      number: row.number as number,
      category: row.category as string,
    }));

    return c.json({
      category,
      label: CATEGORY_LABELS[category] || category,
      questions: questionList,
      total: questionList.length,
    });
  } catch (error) {
    console.error('Error fetching questions by category:', error);
    return c.json({ error: 'Failed to fetch questions' }, 500);
  }
});

// 分野別問題詳細取得
questions.get('/category/:category/:id', async (c) => {
  const category = c.req.param('category');
  const id = c.req.param('id');
  const db = createDbClient(c.env);

  try {
    const result = await db.execute({
      sql: `
        SELECT id, year, number, category, text, choices, correct_choice_id, explanation
        FROM questions
        WHERE category = ? AND id = ?
      `,
      args: [category, id],
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

    return c.json({ question, categoryLabel: CATEGORY_LABELS[category] || category });
  } catch (error) {
    console.error('Error fetching question detail:', error);
    return c.json({ error: 'Failed to fetch question' }, 500);
  }
});

// 年度別問題一覧取得（後方互換性のため維持）
questions.get('/:year', async (c) => {
  const year = parseInt(c.req.param('year'));
  const db = createDbClient(c.env);

  if (isNaN(year)) {
    return c.json({ error: 'Invalid year parameter' }, 400);
  }

  try {
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
