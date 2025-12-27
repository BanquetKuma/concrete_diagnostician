# Task 003: 100問データ Turso 投入

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 1時間 |
| 依存タスク | task002 |
| 成果物 | 100問データ登録完了 |

---

## 目的

生成済みの100問データ (`data/generated/questions_merged_100.json`) を Turso データベースに投入する。

---

## 手順

### 1. 投入スクリプト作成

`scripts/db/import_questions.py` を作成:

```python
#!/usr/bin/env python3
import json
import os
from libsql_experimental import connect

# 環境変数読み込み
from dotenv import load_dotenv
load_dotenv('.env.turso')

def main():
    # Turso接続
    conn = connect(
        os.getenv('TURSO_DATABASE_URL'),
        auth_token=os.getenv('TURSO_AUTH_TOKEN')
    )

    # JSONファイル読み込み
    with open('data/generated/questions_merged_100.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)

    # データ投入
    for q in questions:
        conn.execute('''
            INSERT INTO questions (
                id, year, number, category, text,
                choices, correct_choice_id, explanation,
                source_book, source_page, source_section
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            q['id'],
            q['year'],
            q['number'],
            q['category'],
            q['text'],
            json.dumps(q['choices'], ensure_ascii=False),
            q['correctChoiceId'],
            q['explanation'],
            q.get('source', {}).get('book'),
            q.get('source', {}).get('page'),
            q.get('source', {}).get('section'),
        ))

    conn.commit()
    print(f"Imported {len(questions)} questions")

if __name__ == '__main__':
    main()
```

### 2. Python仮想環境の有効化

プロジェクトには`.venv`仮想環境が用意されています。依存パッケージをインストールする前に、必ず仮想環境を有効化してください。

#### Linux / WSL2 の場合

```bash
# プロジェクトルートから実行
source .venv/bin/activate

# 有効化されると、プロンプトが変わる
# (例) (.venv) user@hostname:~/project$
```

#### Windows PowerShell の場合

```powershell
# プロジェクトルートから実行
.venv\Scripts\Activate.ps1

# 実行ポリシーエラーが出た場合
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.venv\Scripts\Activate.ps1
```

#### Windows コマンドプロンプト の場合

```cmd
.venv\Scripts\activate.bat
```

#### 仮想環境を終了する場合

```bash
deactivate
```

> 💡 **なぜ仮想環境を使うか？**
>
> - プロジェクトごとに依存パッケージを分離できる
> - システムのPythonを汚さない
> - 再現性のある環境を構築できる

### 3. 依存パッケージインストール

```bash
# 仮想環境が有効な状態で実行
pip install libsql-experimental python-dotenv
```

### 4. スクリプト実行

```bash
python scripts/db/import_questions.py
```

### 5. 確認

```bash
turso db shell concrete-diagnostician
> SELECT COUNT(*) FROM questions;
> SELECT id, category, substr(text, 1, 30) FROM questions LIMIT 5;
```

---

## 完了条件

- [x] 投入スクリプト作成完了
- [x] スクリプト実行成功
- [x] 100問全て登録確認
- [x] カテゴリ別件数確認

---

## カテゴリ別期待値

| カテゴリ | 件数 |
|---------|------|
| materials | 15 |
| mix-design | 10 |
| construction | 15 |
| quality | 15 |
| deterioration | 20 |
| diagnosis | 15 |
| repair | 10 |
| **合計** | **100** |

---

## 📚 学習ポイント

### What: データ投入（ETL）とは

**ETL** = Extract（抽出）、Transform（変換）、Load（読込）

```
[JSON ファイル] → [Python スクリプト] → [Turso DB]
    Extract          Transform           Load
```

今回は生成済みJSONをDBに投入する「データマイグレーション」の一種。

### Why: スクリプト化する理由

#### 直接SQLではなくスクリプトを使う理由

| 方法 | メリット | デメリット |
|------|---------|-----------|
| 手動SQL | シンプル | 100件の手入力は非現実的 |
| CSVインポート | 標準機能 | JSON構造に対応しにくい |
| Pythonスクリプト | 柔軟、再実行可能 | 環境構築必要 |

**スクリプト化のメリット**:

- 何度でも再実行可能（開発中のリセット）
- エラーハンドリングが可能
- データ変換ロジックを記述可能

### How: libsql-experimental の仕組み

```python
from libsql_experimental import connect

conn = connect(
    os.getenv('TURSO_DATABASE_URL'),  # libsql://xxx.turso.io
    auth_token=os.getenv('TURSO_AUTH_TOKEN')
)
```

**libsql-experimental**:

- Turso公式のPythonクライアント
- SQLite互換API（`execute`, `commit`等）
- HTTPS経由でエッジDBに接続

**接続フロー**:

```
Python → HTTPS → Turso Edge → libSQL DB
                    ↓
              JWT認証で接続許可
```

### Tips: 実践的なアドバイス

1. **冪等性を確保する**: 再実行してもエラーにならない設計

   ```python
   # INSERT OR REPLACE で重複を上書き
   conn.execute('''
       INSERT OR REPLACE INTO questions (id, ...) VALUES (?, ...)
   ''', (...))
   ```

2. **バッチ処理で高速化**: 大量データは一括コミット

   ```python
   for q in questions:
       conn.execute('INSERT ...', (...))
   conn.commit()  # 最後に1回だけ
   ```

3. **トランザクション管理**: エラー時のロールバック

   ```python
   try:
       for q in questions:
           conn.execute(...)
       conn.commit()
   except Exception as e:
       conn.rollback()
       raise e
   ```

4. **進捗表示**: 大量データ投入時に便利

   ```python
   from tqdm import tqdm
   for q in tqdm(questions, desc="Importing"):
       conn.execute(...)
   ```

5. **環境変数の安全な読み込み**:

   ```python
   from dotenv import load_dotenv
   load_dotenv('.env.turso')  # .gitignoreに追加済み
   ```

---

## 次のタスク

→ [task004-cloudflare-workers-setup.md](./task004-cloudflare-workers-setup.md)
