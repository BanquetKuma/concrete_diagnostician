#!/usr/bin/env python3
"""
Generate exam questions using Gemini File Search API.

Usage:
    source .venv/bin/activate
    python scripts/gemini_rag/generate_questions.py [--test] [--category CATEGORY]
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from scripts.gemini_rag.categories import CATEGORIES, get_all_categories, get_total_question_count
from scripts.gemini_rag.prompts import (
    QUESTION_GENERATION_SYSTEM_PROMPT,
    get_question_generation_prompt,
    get_single_question_prompt
)

def print_progress_bar(current: int, total: int, prefix: str = '', suffix: str = '', length: int = 30):
    """Print a progress bar"""
    filled = int(length * current // total)
    bar = '█' * filled + '░' * (length - filled)
    percent = f"{100 * current / total:.1f}"
    print(f'\r{prefix} |{bar}| {percent}% ({current}/{total}) {suffix}', end='', flush=True)

def parse_args():
    parser = argparse.ArgumentParser(description='Generate exam questions using Gemini')
    parser.add_argument('--test', action='store_true', help='Generate only 1 test question')
    parser.add_argument('--category', type=str, help='Generate questions for specific category only')
    parser.add_argument('--output', type=str, help='Output file path')
    return parser.parse_args()

def extract_json_from_response(text: str) -> list:
    """Extract JSON array from response text"""
    # Try to find JSON array in the response
    # First, try direct parsing
    text = text.strip()

    # Remove markdown code blocks if present
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

def validate_question(question: dict) -> tuple[bool, str]:
    """Validate question format"""
    required_fields = ['id', 'text', 'choices', 'correctChoiceId', 'explanation']

    for field in required_fields:
        if field not in question:
            return False, f"Missing required field: {field}"

    # Validate choices
    if not isinstance(question['choices'], list) or len(question['choices']) != 4:
        return False, "Must have exactly 4 choices"

    correct_count = sum(1 for c in question['choices'] if c.get('isCorrect', False))
    if correct_count != 1:
        return False, f"Must have exactly 1 correct choice, found {correct_count}"

    # Check correctChoiceId matches
    correct_ids = [c['id'] for c in question['choices'] if c.get('isCorrect', False)]
    if question['correctChoiceId'] not in correct_ids:
        return False, "correctChoiceId does not match isCorrect in choices"

    return True, "Valid"

def generate_test_question(client, store_name: str, model: str):
    """Generate a single test question"""
    from google.genai import types

    category_info = CATEGORIES['materials']
    prompt = get_single_question_prompt(
        category_info['name'],
        category_info['keywords'],
        topic="セメントの種類と特性"
    )

    print("Generating test question...")
    print(f"Model: {model}")
    print(f"Store: {store_name}")

    response = client.models.generate_content(
        model=model,
        contents=[
            QUESTION_GENERATION_SYSTEM_PROMPT,
            prompt
        ],
        config=types.GenerateContentConfig(
            tools=[types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[store_name]
                )
            )],
            temperature=0.7
        )
    )

    print("\nRaw response:")
    print("-" * 40)
    print(response.text)
    print("-" * 40)

    # Extract and validate
    try:
        questions = extract_json_from_response(response.text)
        if questions:
            is_valid, msg = validate_question(questions[0])
            print(f"\nValidation: {msg}")
            return questions[0]
    except Exception as e:
        print(f"\nError extracting JSON: {e}")

    return None

def generate_questions_for_category(client, store_name: str, model: str, category_code: str, category_info: dict):
    """Generate questions for a single category"""
    from google.genai import types

    prompt = get_question_generation_prompt(
        category_info['name'],
        category_info['keywords'],
        category_info['count']
    )

    print(f"   ⏳ Gemini API呼び出し中...")

    try:
        response = client.models.generate_content(
            model=model,
            contents=[
                QUESTION_GENERATION_SYSTEM_PROMPT,
                prompt
            ],
            config=types.GenerateContentConfig(
                tools=[types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[store_name]
                    )
                )],
                temperature=0.7
            )
        )

        print(f"   ⏳ レスポンス解析中...")

        # レスポンスの確認
        if response is None or response.text is None:
            print(f"   ❌ APIからの応答がありません（レート制限または安全フィルター）")
            print(f"   💡 数分待ってから再試行してください")
            return []

        questions = extract_json_from_response(response.text)
        print(f"   📝 {len(questions)}問を取得、バリデーション中...")

        # Validate and fix IDs
        valid_questions = []
        invalid_count = 0
        for i, q in enumerate(questions):
            # Fix ID format
            q['id'] = f"gen-{category_code}-{i+1:03d}"
            q['category'] = category_code

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
        return []

def main():
    args = parse_args()

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
        print("Run setup_file_store.py first to create the store")
        sys.exit(1)

    # Import google.genai
    try:
        from google import genai
    except ImportError:
        print("Error: google-genai not installed")
        sys.exit(1)

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Test mode
    if args.test:
        question = generate_test_question(client, store_name, model)
        if question:
            output_path = project_root / 'data' / 'generated' / 'test_question.json'
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(question, f, ensure_ascii=False, indent=2)
            print(f"\nTest question saved to: {output_path}")
        return

    # Full generation
    all_questions = []
    categories_to_process = [args.category] if args.category else get_all_categories()
    total_categories = len(categories_to_process)
    total_target_questions = sum(CATEGORIES[c]['count'] for c in categories_to_process if c in CATEGORIES)

    print("\n" + "=" * 60)
    print("🚀 問題生成開始")
    print("=" * 60)
    print(f"対象カテゴリ数: {total_categories}")
    print(f"目標問題数: {total_target_questions}問")
    print("=" * 60)

    for cat_idx, category_code in enumerate(categories_to_process, 1):
        if category_code not in CATEGORIES:
            print(f"Warning: Unknown category '{category_code}', skipping")
            continue

        category_info = CATEGORIES[category_code]

        # カテゴリ進捗表示
        print(f"\n📁 [{cat_idx}/{total_categories}] {category_info['name']} ({category_code})")
        print(f"   目標: {category_info['count']}問")

        questions = generate_questions_for_category(
            client, store_name, model, category_code, category_info
        )
        all_questions.extend(questions)

        # 全体進捗表示
        print(f"\n   ✅ 完了: {len(questions)}問生成")
        print(f"   📊 全体進捗: {len(all_questions)}/{total_target_questions}問 ({100*len(all_questions)//total_target_questions}%)")

    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_path = args.output or project_root / 'data' / 'generated' / f'questions_{timestamp}.json'
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 50)
    print("Generation Summary")
    print("=" * 50)
    print(f"Total questions generated: {len(all_questions)}")
    print(f"Output file: {output_path}")

    # Category breakdown
    print("\nBy category:")
    for cat in get_all_categories():
        count = sum(1 for q in all_questions if q.get('category') == cat)
        if count > 0:
            print(f"  {cat}: {count}")

    print(f"\nNext step: Run export_questions.py to convert to TypeScript")

if __name__ == '__main__':
    main()
