#!/usr/bin/env python3
"""
Turso DBの参照表記を統一するスクリプト

変換ルール:
- 「教科書」→「この1冊で合格！コンクリート診断士2024年版」
- 「セクション」を削除
- 余分なスペースを整理
"""
import os
import re
import sys

from dotenv import load_dotenv

try:
    from libsql_experimental import connect
except ImportError:
    print("Error: libsql-experimental がインストールされていません")
    print("実行: pip install libsql-experimental python-dotenv")
    sys.exit(1)


def normalize_reference(text: str) -> str:
    """参照表記を統一する"""
    if not text:
        return text

    # 「教科書」を正式名称に置換
    text = text.replace('教科書', 'この1冊で合格！コンクリート診断士2024年版 ')

    # 「セクション」を削除
    text = re.sub(r'セクション\s*', '', text)

    # 余分なスペースを整理
    text = re.sub(r'\s+', ' ', text)

    # 「p.XX」の前にスペースを確保
    text = re.sub(r'版\s*p\.', '版 p.', text)

    return text.strip()


def main():
    # 環境変数読み込み
    env_path = '.env.turso'
    if not os.path.exists(env_path):
        env_path = '../../.env.turso'

    load_dotenv(env_path)

    db_url = os.getenv('TURSO_DATABASE_URL')
    auth_token = os.getenv('TURSO_AUTH_TOKEN')

    if not db_url or not auth_token:
        print("Error: TURSO_DATABASE_URL または TURSO_AUTH_TOKEN が設定されていません")
        sys.exit(1)

    print(f"Connecting to: {db_url}")
    conn = connect(db_url, auth_token=auth_token)

    # 参照を含む問題を取得
    print("\n参照を含む問題を検索中...")
    result = conn.execute("""
        SELECT id, explanation
        FROM questions
        WHERE explanation LIKE '%参照%'
    """)

    questions = result.fetchall()
    print(f"Found {len(questions)} questions with references")

    # プレビューモード: 変更内容を確認
    print("\n=== 変更プレビュー ===\n")

    updates = []
    for row in questions:
        q_id = row[0]
        original = row[1]
        normalized = normalize_reference(original)

        if original != normalized:
            updates.append((q_id, normalized))

            # 参照部分のみ抽出して表示
            ref_pattern = r'[（(]参照[：:].*?[）)]'
            original_ref = re.search(ref_pattern, original)
            normalized_ref = re.search(ref_pattern, normalized)

            if original_ref and normalized_ref:
                print(f"ID: {q_id}")
                print(f"  Before: {original_ref.group()}")
                print(f"  After:  {normalized_ref.group()}")
                print()

    if not updates:
        print("変更が必要な問題はありません")
        return

    print(f"\n=== {len(updates)} 件の問題を更新します ===")

    # --yes オプションで確認スキップ
    if '--yes' not in sys.argv:
        try:
            confirm = input("\n更新を実行しますか？ (yes/no): ")
            if confirm.lower() != 'yes':
                print("キャンセルしました")
                return
        except EOFError:
            print("\n非対話モードです。--yes オプションを付けて実行してください")
            return

    # 更新実行
    success_count = 0
    error_count = 0

    for q_id, new_explanation in updates:
        try:
            conn.execute("""
                UPDATE questions
                SET explanation = ?
                WHERE id = ?
            """, (new_explanation, q_id))
            success_count += 1
            print(f"Updated: {q_id}")
        except Exception as e:
            print(f"Error updating {q_id}: {e}")
            error_count += 1

    conn.commit()

    print(f"\n=== 完了 ===")
    print(f"  成功: {success_count}")
    print(f"  エラー: {error_count}")


if __name__ == '__main__':
    main()
