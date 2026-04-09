import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createDbClient } from '../lib/db';
import { callGemini } from '../lib/gemini';
import { ChatRequest, ChatUsage } from '../types/chat';

export interface ChatEnv {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_API_KEY: string;
  FILE_SEARCH_STORE_NAME: string;
  GEMINI_MODEL?: string;
}

const DAILY_LIMIT = 15;
const MONTHLY_LIMIT = 300;
const DEFAULT_MODEL = 'gemini-2.5-pro';
const CHUNK_DELAY_MS = 30;

const chat = new Hono<{ Bindings: ChatEnv }>();

// Ensure chat_usage table exists (idempotent)
async function ensureTable(db: ReturnType<typeof createDbClient>) {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS chat_usage (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )`,
    args: [],
  });
}

async function getUsage(
  db: ReturnType<typeof createDbClient>,
  userId: string
): Promise<ChatUsage> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7) + '%';

  const dailyRes = await db.execute({
    sql: 'SELECT count FROM chat_usage WHERE user_id = ? AND date = ?',
    args: [userId, today],
  });
  const dailyUsed =
    dailyRes.rows.length > 0 ? Number(dailyRes.rows[0].count) : 0;

  const monthlyRes = await db.execute({
    sql: "SELECT COALESCE(SUM(count), 0) as total FROM chat_usage WHERE user_id = ? AND date LIKE ?",
    args: [userId, monthPrefix],
  });
  const monthlyUsed = Number(monthlyRes.rows[0]?.total ?? 0);

  return {
    dailyUsed,
    dailyLimit: DAILY_LIMIT,
    monthlyUsed,
    monthlyLimit: MONTHLY_LIMIT,
  };
}

async function incrementUsage(
  db: ReturnType<typeof createDbClient>,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db.execute({
    sql: `INSERT INTO chat_usage (user_id, date, count) VALUES (?, ?, 1)
          ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1`,
    args: [userId, today],
  });
}

/**
 * Split text into chunks at natural boundaries (sentence endings, newlines,
 * markdown headings) so streaming feels natural.
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  // Split on: sentence-ending punctuation, newlines, markdown headings
  const parts = text.split(/(?<=[。！？\n])|(?=\n#{1,3}\s)/);
  let buffer = '';
  for (const part of parts) {
    buffer += part;
    if (buffer.length >= 40) {
      chunks.push(buffer);
      buffer = '';
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

// SSE streaming chat endpoint
chat.post('/', async (c) => {
  let body: ChatRequest;
  try {
    body = await c.req.json<ChatRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.message || typeof body.message !== 'string') {
    return c.json({ error: 'userId and message are required' }, 400);
  }

  if (body.message.length > 2000) {
    return c.json({ error: 'message exceeds maximum length (2000 chars)' }, 400);
  }

  if (!c.env.GOOGLE_API_KEY || !c.env.FILE_SEARCH_STORE_NAME) {
    return c.json({ error: 'Chat service is not configured' }, 503);
  }

  const db = createDbClient(c.env);
  await ensureTable(db);

  // Rate limit check (before SSE starts so we can return normal JSON errors)
  const usage = await getUsage(db, body.userId);
  if (usage.dailyUsed >= DAILY_LIMIT) {
    return c.json(
      { error: 'daily_limit_exceeded', message: '本日の送信上限に達しました', usage },
      429
    );
  }
  if (usage.monthlyUsed >= MONTHLY_LIMIT) {
    return c.json(
      { error: 'monthly_limit_exceeded', message: '今月の送信上限に達しました', usage },
      429
    );
  }

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  return streamSSE(c, async (stream) => {
    try {
      const reply = await callGemini({
        apiKey: c.env.GOOGLE_API_KEY,
        model: c.env.GEMINI_MODEL || DEFAULT_MODEL,
        fileSearchStoreName: c.env.FILE_SEARCH_STORE_NAME,
        message: body.message,
        history,
        questionContext: body.questionContext,
      });

      await incrementUsage(db, body.userId);

      const newUsage: ChatUsage = {
        ...usage,
        dailyUsed: usage.dailyUsed + 1,
        monthlyUsed: usage.monthlyUsed + 1,
      };

      // Stream reply in chunks
      const chunks = splitIntoChunks(reply);
      for (const chunk of chunks) {
        await stream.writeSSE({
          event: 'chunk',
          data: JSON.stringify({ text: chunk }),
        });
        await stream.sleep(CHUNK_DELAY_MS);
      }

      // Final event with usage
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ usage: newUsage }),
      });
    } catch (error) {
      console.error('Chat SSE error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message }),
      });
    }
  });
});

// Get current usage without sending a message
chat.get('/usage/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const db = createDbClient(c.env);
    await ensureTable(db);
    const usage = await getUsage(db, userId);
    return c.json({ usage });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return c.json({ error: 'Failed to fetch usage' }, 500);
  }
});

export default chat;
