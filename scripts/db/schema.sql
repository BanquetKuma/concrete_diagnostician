-- Concrete Diagnostician Database Schema
-- Created: 2024-12-18

-- =============================================
-- users テーブル
-- デバイスベースのユーザー管理
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);

-- =============================================
-- questions テーブル
-- 問題データ（100問）
-- =============================================
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  number INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  choices TEXT NOT NULL,  -- JSON配列: [{"id": "a", "text": "選択肢A"}, ...]
  correct_choice_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_book TEXT,
  source_page INTEGER,
  source_section TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);

-- =============================================
-- answers テーブル
-- 学習履歴
-- =============================================
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_question ON answers(user_id, question_id);
