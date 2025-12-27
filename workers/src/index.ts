import { Hono } from 'hono';
import { cors } from 'hono/cors';
import questions from './routes/questions';
import users from './routes/users';
import answers from './routes/answers';
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

// 問題API
app.route('/api/questions', questions);

// ユーザーAPI
app.route('/api/users', users);

// 解答API
app.route('/api/answers', answers);

// 進捗API
app.route('/api/progress', progress);

export default app;
