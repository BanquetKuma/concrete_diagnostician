import { Hono } from 'hono';
import { createDbClient, Env } from '../lib/db';
import { User, UserCreateRequest } from '../types/user';

const users = new Hono<{ Bindings: Env }>();

// ユーザー登録（upsert）
users.post('/register', async (c) => {
  const db = createDbClient(c.env);

  try {
    const body = await c.req.json<UserCreateRequest>();

    if (!body.deviceId) {
      return c.json({ error: 'deviceId is required' }, 400);
    }

    // 既存ユーザーを確認
    const existingResult = await db.execute({
      sql: 'SELECT id, device_id, created_at FROM users WHERE device_id = ?',
      args: [body.deviceId],
    });

    if (existingResult.rows.length > 0) {
      // 既存ユーザーを返す
      const row = existingResult.rows[0];
      const user: User = {
        id: row.id as string,
        deviceId: row.device_id as string,
        createdAt: row.created_at as string,
      };
      return c.json({ user, isNew: false });
    }

    // 新規ユーザー作成
    const userId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO users (id, device_id, created_at) VALUES (?, ?, ?)',
      args: [userId, body.deviceId, createdAt],
    });

    const user: User = {
      id: userId,
      deviceId: body.deviceId,
      createdAt,
    };

    return c.json({ user, isNew: true }, 201);
  } catch (error) {
    console.error('Error registering user:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

// ユーザー取得
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
