#!/usr/bin/env python3
"""
Turso DBへの問題データ投入スクリプト
data/generated/questions_merged_100.json を questions テーブルに投入する
"""
import json
import os
import sys

from dotenv import load_dotenv

# Turso接続用
try:
    from libsql_experimental import connect
except ImportError:
    print("Error: libsql-experimental がインストールされていません")
    print("実行: pip install libsql-experimental python-dotenv")
    sys.exit(1)


def main():
    # プロジェクトルートから実行されることを想定
    env_path = '.env.turso'
    if not os.path.exists(env_path):
        # scripts/db/ から実行された場合
        env_path = '../../.env.turso'

    load_dotenv(env_path)

    db_url = os.getenv('TURSO_DATABASE_URL')
    auth_token = os.getenv('TURSO_AUTH_TOKEN')

    if not db_url or not auth_token:
        print("Error: TURSO_DATABASE_URL または TURSO_AUTH_TOKEN が設定されていません")
        print("  .env.turso ファイルを確認してください")
        sys.exit(1)

    print(f"Connecting to: {db_url}")

    # Turso接続
    conn = connect(db_url, auth_token=auth_token)

    # JSONファイルパス（コマンドライン引数から取得）
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
    else:
        json_path = 'data/generated/questions_merged_100.json'
        if not os.path.exists(json_path):
            # scripts/db/ から実行された場合
            json_path = '../../data/generated/questions_merged_100.json'

    if not os.path.exists(json_path):
        print(f"Error: JSONファイルが見つかりません: {json_path}")
        print("Usage: python import_questions.py <json_file_path>")
        sys.exit(1)

    # JSONファイル読み込み
    print(f"Loading: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    print(f"Found {len(questions)} questions")

    # データ投入
    success_count = 0
    error_count = 0

    for q in questions:
        try:
            conn.execute('''
                INSERT OR REPLACE INTO questions (
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
            success_count += 1
        except Exception as e:
            print(f"Error inserting {q['id']}: {e}")
            error_count += 1

    conn.commit()

    print(f"\nImport completed:")
    print(f"  Success: {success_count}")
    print(f"  Errors:  {error_count}")

    # 確認クエリ
    result = conn.execute("SELECT COUNT(*) FROM questions")
    count = result.fetchone()[0]
    print(f"\nTotal questions in DB: {count}")

    # カテゴリ別集計
    print("\nCategory breakdown:")
    result = conn.execute("""
        SELECT category, COUNT(*) as count
        FROM questions
        GROUP BY category
        ORDER BY count DESC
    """)
    for row in result.fetchall():
        print(f"  {row[0]}: {row[1]}")


if __name__ == '__main__':
    main()
