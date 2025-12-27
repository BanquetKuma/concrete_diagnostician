# Task 002: Turso スキーマ定義・適用

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 2時間 |
| 依存タスク | task001 |
| 成果物 | データベーススキーマ |

---

## 目的

Turso データベースにテーブルを作成し、アプリで使用するスキーマを定義する。

---

## スキーマ設計

### users テーブル

デバイスベースのユーザー管理

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);

CREATE INDEX idx_users_device ON users(device_id);
```

### questions テーブル

問題データ（100問）

```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  number INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  choices TEXT NOT NULL,  -- JSON配列
  correct_choice_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_book TEXT,
  source_page INTEGER,
  source_section TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_year ON questions(year);
CREATE INDEX idx_questions_category ON questions(category);
```

### answers テーブル

学習履歴

```sql
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX idx_answers_user ON answers(user_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);
```

---

## 手順

### 1. スキーマファイル作成

`scripts/db/schema.sql` を作成:

```sql
-- ファイル内容は上記スキーマを結合
```

### 2. スキーマ適用

```bash
# Turso シェルで実行
turso db shell concrete-diagnostician < scripts/db/schema.sql

# または対話モード
turso db shell concrete-diagnostician
> .read scripts/db/schema.sql
```

### 3. 確認

```bash
turso db shell concrete-diagnostician
> .tables
> .schema users
> .schema questions
> .schema answers
```

---

## 完了条件

- [x] `scripts/db/schema.sql` ファイル作成
- [x] users テーブル作成完了
- [x] questions テーブル作成完了
- [x] answers テーブル作成完了
- [x] インデックス作成完了
- [x] スキーマ確認完了

---

## 📚 学習ポイント

### What: データベーススキーマとは

スキーマは **データベースの設計図**。テーブル構造、カラム型、制約、インデックスを定義する。アプリケーションの基盤となるため、最初に慎重に設計することが重要。

### Why: この設計の意図

#### 1. なぜ3テーブル構成か

```
[users] 1 ←――→ N [answers] N ←――→ 1 [questions]
```

- **正規化**: データの重複を避け、整合性を保つ
- **拡張性**: 将来的に問題やユーザー情報を追加しやすい
- **クエリ効率**: 必要なデータだけを取得可能

#### 2. なぜTEXT型のPRIMARY KEYか

```sql
id TEXT PRIMARY KEY  -- UUID形式: "550e8400-e29b-41d4-a716-446655440000"
```

- **分散生成可能**: サーバーに問い合わせずにクライアントでID生成
- **衝突しない**: UUIDは実質的にユニーク
- **セキュリティ**: 連番と違い、推測困難

#### 3. なぜchoicesがJSON (TEXT) か

```sql
choices TEXT NOT NULL  -- '[{"id": "a", "text": "選択肢A"}, ...]'
```

- **SQLiteの制限**: 配列型がないためJSONで代用
- **柔軟性**: 選択肢数が問題によって異なる可能性
- **シンプルさ**: 別テーブルにするほど複雑でない

### How: インデックスの仕組み

```sql
CREATE INDEX idx_answers_user ON answers(user_id);
```

**インデックスなし（フルスキャン）**:

```
検索: user_id = 'abc123'
処理: 全レコードを1件ずつ確認 → O(n)
10万件なら10万回の比較
```

**インデックスあり（B-tree検索）**:

```
検索: user_id = 'abc123'
処理: ツリー構造を辿る → O(log n)
10万件でも約17回の比較
```

#### 複合インデックスの順序

```sql
CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);
```

- `WHERE user_id = ?` → ✅ 使える
- `WHERE user_id = ? AND question_id = ?` → ✅ 使える
- `WHERE question_id = ?` → ❌ 使えない（最初のカラムが必要）

### Tips: 実践的なアドバイス

1. **IF NOT EXISTSを使う**: 再実行時のエラーを防ぐ

   ```sql
   CREATE TABLE IF NOT EXISTS users (...);
   CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
   ```

2. **マイグレーション管理**: 本番運用ではスキーマ変更を追跡

   ```
   scripts/db/
   ├── schema.sql        # 初期スキーマ
   ├── migration_001.sql # 変更1
   └── migration_002.sql # 変更2
   ```

3. **FOREIGN KEYの注意**: SQLiteではデフォルト無効

   ```sql
   PRAGMA foreign_keys = ON;  -- 有効化が必要
   ```

4. **NULL vs DEFAULT**: 明示的に設計
   - `NOT NULL`: 必須項目
   - `DEFAULT CURRENT_TIMESTAMP`: 自動設定
   - `NULL許容`: オプション項目

---

## 次のタスク

→ [task003-import-questions-to-turso.md](./task003-import-questions-to-turso.md)
