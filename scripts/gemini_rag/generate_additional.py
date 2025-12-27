#!/usr/bin/env python3
"""
Generate ADDITIONAL exam questions (150 more to reach 250 total).
This script generates only the new questions needed, with proper ID numbering.

Usage:
    source .venv/bin/activate
    python scripts/gemini_rag/generate_additional.py
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from scripts.gemini_rag.prompts import (
    QUESTION_GENERATION_SYSTEM_PROMPT,
    get_question_generation_prompt,
)

# Existing counts (already in DB) and target counts
GENERATION_CONFIG = {
    "materials": {"name": "コンクリート材料", "existing": 15, "target": 37, "keywords": ["セメント", "骨材", "混和材", "混和剤", "水", "鉄筋"]},
    "mix-design": {"name": "配合設計", "existing": 10, "target": 25, "keywords": ["水セメント比", "スランプ", "空気量", "単位水量", "単位セメント量"]},
    "construction": {"name": "施工", "existing": 15, "target": 37, "keywords": ["打設", "締固め", "養生", "打継ぎ", "運搬", "型枠"]},
    "quality": {"name": "品質管理・検査", "existing": 15, "target": 38, "keywords": ["圧縮強度試験", "非破壊検査", "コア採取", "反発硬度", "超音波"]},
    "deterioration": {"name": "劣化・損傷", "existing": 20, "target": 50, "keywords": ["中性化", "塩害", "ASR", "アルカリシリカ反応", "凍害", "化学的侵食", "ひび割れ"]},
    "diagnosis": {"name": "調査・診断", "existing": 15, "target": 38, "keywords": ["目視点検", "コア採取", "調査計画", "劣化予測", "健全度評価"]},
    "repair": {"name": "補修・補強", "existing": 10, "target": 25, "keywords": ["断面修復", "ひび割れ補修", "表面保護", "電気防食", "補強"]},
}

def extract_json_from_response(text: str) -> list:
    """Extract JSON array from response text"""
    text = text.strip()

    # Remove markdown code blocks
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    text = text.strip()

    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        elif isinstance(result, dict):
            return [result]
    except json.JSONDecodeError:
        pass

    # Try to find JSON array pattern
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Try to find single JSON object
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            obj = json.loads(match.group())
            return [obj]
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from response: {text[:200]}...")

def validate_question(question: dict) -> tuple:
    """Validate question format"""
    required_fields = ['id', 'text', 'choices', 'correctChoiceId', 'explanation']

    for field in required_fields:
        if field not in question:
            return False, f"Missing required field: {field}"

    if not isinstance(question['choices'], list) or len(question['choices']) != 4:
        return False, "Must have exactly 4 choices"

    correct_count = sum(1 for c in question['choices'] if c.get('isCorrect', False))
    if correct_count != 1:
        return False, f"Must have exactly 1 correct choice, found {correct_count}"

    correct_ids = [c['id'] for c in question['choices'] if c.get('isCorrect', False)]
    if question['correctChoiceId'] not in correct_ids:
        return False, "correctChoiceId does not match isCorrect in choices"

    return True, "Valid"

def generate_questions_for_category(client, store_name: str, model: str, category_code: str, config: dict, start_id: int, count: int):
    """Generate questions for a single category"""
    from google.genai import types

    # Customize prompt to emphasize generating NEW, DIFFERENT questions
    base_prompt = get_question_generation_prompt(
        config['name'],
        config['keywords'],
        count
    )

    enhanced_prompt = f"""
{base_prompt}

【重要な追加指示】
- 既存の問題と重複しない、新しい視点・トピックの問題を生成してください
- より専門的・応用的な問題を含めてください
- 実務に即した問題を含めてください
- 数値や具体的な基準に関する問題も含めてください
"""

    print(f"   ⏳ Gemini API呼び出し中 ({count}問を要求)...")

    try:
        response = client.models.generate_content(
            model=model,
            contents=[
                QUESTION_GENERATION_SYSTEM_PROMPT,
                enhanced_prompt
            ],
            config=types.GenerateContentConfig(
                tools=[types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[store_name]
                    )
                )],
                temperature=0.8  # Slightly higher for more variety
            )
        )

        print(f"   ⏳ レスポンス解析中...")
        questions = extract_json_from_response(response.text)
        print(f"   📝 {len(questions)}問を取得、バリデーション中...")

        valid_questions = []
        invalid_count = 0

        for i, q in enumerate(questions):
            # Assign IDs starting from start_id
            q_num = start_id + i
            q['id'] = f"gen-{category_code}-{q_num:03d}"
            q['category'] = category_code
            q['year'] = 2024
            q['number'] = q_num

            is_valid, msg = validate_question(q)
            if is_valid:
                valid_questions.append(q)
                print(f"   ✓ 問題 {i+1}/{len(questions)}: {q['id']} OK")
            else:
                invalid_count += 1
                print(f"   ✗ 問題 {i+1}/{len(questions)}: スキップ ({msg})")

        if invalid_count > 0:
            print(f"   ⚠️  {invalid_count}問がバリデーションエラーでスキップされました")

        return valid_questions

    except Exception as e:
        print(f"   ❌ エラー発生: {e}")
        import traceback
        traceback.print_exc()
        return []

def main():
    # Load environment
    env_path = project_root / '.env.gemini'
    if not env_path.exists():
        print(f"Error: {env_path} not found.")
        sys.exit(1)

    load_dotenv(env_path)

    api_key = os.getenv('GOOGLE_API_KEY')
    store_name = os.getenv('FILE_SEARCH_STORE_NAME')
    model = os.getenv('GEMINI_MODEL', 'gemini-2.5-pro')

    if not api_key or api_key == 'your-gemini-api-key':
        print("Error: GOOGLE_API_KEY is not set")
        sys.exit(1)

    if not store_name:
        print("Error: FILE_SEARCH_STORE_NAME is not set")
        sys.exit(1)

    # Import google.genai
    try:
        from google import genai
    except ImportError:
        print("Error: google-genai not installed")
        print("Run: pip install google-genai")
        sys.exit(1)

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Calculate totals
    total_new = sum(c['target'] - c['existing'] for c in GENERATION_CONFIG.values())

    print("\n" + "=" * 60)
    print("🚀 追加問題生成開始")
    print("=" * 60)
    print(f"生成予定: {total_new}問（各カテゴリの不足分）")
    print("=" * 60)

    for cat, cfg in GENERATION_CONFIG.items():
        new_count = cfg['target'] - cfg['existing']
        print(f"  {cfg['name']}: {cfg['existing']}問 → {cfg['target']}問 (+{new_count})")
    print("=" * 60)

    all_questions = []
    total_categories = len(GENERATION_CONFIG)

    for cat_idx, (category_code, config) in enumerate(GENERATION_CONFIG.items(), 1):
        new_count = config['target'] - config['existing']
        start_id = config['existing'] + 1  # Start from next ID after existing

        print(f"\n📁 [{cat_idx}/{total_categories}] {config['name']} ({category_code})")
        print(f"   既存: {config['existing']}問, 追加: {new_count}問 (ID: {start_id}〜{config['target']})")

        questions = generate_questions_for_category(
            client, store_name, model, category_code, config, start_id, new_count
        )
        all_questions.extend(questions)

        print(f"\n   ✅ 完了: {len(questions)}問生成")
        print(f"   📊 全体進捗: {len(all_questions)}/{total_new}問 ({100*len(all_questions)//total_new if total_new > 0 else 0}%)")

    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_path = project_root / 'data' / 'generated' / f'questions_additional_{timestamp}.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("📊 生成サマリー")
    print("=" * 60)
    print(f"総生成問題数: {len(all_questions)}")
    print(f"出力ファイル: {output_path}")

    print("\nカテゴリ別:")
    for cat in GENERATION_CONFIG.keys():
        count = sum(1 for q in all_questions if q.get('category') == cat)
        if count > 0:
            print(f"  {cat}: {count}問")

    print(f"\n次のステップ:")
    print(f"  1. レビュー: python scripts/gemini_rag/review_questions.py {output_path}")
    print(f"  2. インポート: python scripts/db/import_additional.py {output_path}")

if __name__ == '__main__':
    main()
