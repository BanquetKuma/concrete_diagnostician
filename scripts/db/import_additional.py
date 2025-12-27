#!/usr/bin/env python3
"""
Import additional questions to Turso DB.
Usage: python scripts/db/import_additional.py <json_file>
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    from libsql_experimental import connect
except ImportError:
    print("Error: libsql-experimental がインストールされていません")
    print("実行: pip install libsql-experimental python-dotenv")
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/db/import_additional.py <json_file>")
        sys.exit(1)

    json_path = sys.argv[1]

    # Load environment
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / '.env.turso'

    if not env_path.exists():
        print(f"Error: {env_path} not found")
        sys.exit(1)

    load_dotenv(env_path)

    db_url = os.getenv('TURSO_DATABASE_URL')
    auth_token = os.getenv('TURSO_AUTH_TOKEN')

    if not db_url or not auth_token:
        print("Error: TURSO_DATABASE_URL または TURSO_AUTH_TOKEN が設定されていません")
        sys.exit(1)

    print(f"Connecting to: {db_url}")
    conn = connect(db_url, auth_token=auth_token)

    # Check current count
    result = conn.execute("SELECT COUNT(*) FROM questions")
    before_count = result.fetchone()[0]
    print(f"Current questions in DB: {before_count}")

    # Load JSON
    if not os.path.exists(json_path):
        print(f"Error: JSONファイルが見つかりません: {json_path}")
        sys.exit(1)

    print(f"Loading: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    print(f"Found {len(questions)} questions to import")

    # Import
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
                q.get('year', 2024),
                q.get('number', 0),
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
            print(f"Error inserting {q.get('id', 'unknown')}: {e}")
            error_count += 1

    conn.commit()

    # Verify
    result = conn.execute("SELECT COUNT(*) FROM questions")
    after_count = result.fetchone()[0]

    print(f"\n" + "=" * 50)
    print(f"Import completed:")
    print(f"  Success: {success_count}")
    print(f"  Errors:  {error_count}")
    print(f"  Before:  {before_count}")
    print(f"  After:   {after_count}")
    print(f"  Added:   {after_count - before_count}")
    print("=" * 50)

    # Category breakdown
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
