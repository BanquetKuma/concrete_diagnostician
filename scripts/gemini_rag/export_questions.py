#!/usr/bin/env python3
"""
Export generated questions to TypeScript format.

Usage:
    source .venv/bin/activate
    python scripts/gemini_rag/export_questions.py [--input INPUT_FILE]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from scripts.gemini_rag.categories import get_all_categories

def parse_args():
    parser = argparse.ArgumentParser(description='Export questions to TypeScript')
    parser.add_argument('--input', type=str, help='Input JSON file (default: latest in data/generated/)')
    parser.add_argument('--output', type=str, help='Output TypeScript file')
    return parser.parse_args()

def find_latest_json():
    """Find the most recent questions JSON file"""
    generated_dir = project_root / 'data' / 'generated'
    json_files = list(generated_dir.glob('questions_*.json'))

    if not json_files:
        return None

    return max(json_files, key=lambda f: f.stat().st_mtime)

def escape_ts_string(s: str) -> str:
    """Escape string for TypeScript"""
    return (s
        .replace('\\', '\\\\')
        .replace("'", "\\'")
        .replace('\n', '\\n')
        .replace('\r', '\\r')
        .replace('\t', '\\t'))

def transform_choice_id(question_id: str, choice_id: str) -> str:
    """Transform choice ID to be unique: 'a' -> 'gen-materials-001-a'"""
    return f"{question_id}-{choice_id}"

def format_choice(choice: dict, question_id: str) -> str:
    """Format a single choice as TypeScript with unique ID"""
    unique_id = transform_choice_id(question_id, choice["id"])
    return f"""      {{
        id: '{unique_id}',
        text: '{escape_ts_string(choice["text"])}',
        isCorrect: {"true" if choice["isCorrect"] else "false"},
      }}"""

def format_question(question: dict) -> str:
    """Format a single question as TypeScript"""
    q_id = question["id"]
    choices_str = ',\n'.join(format_choice(c, q_id) for c in question['choices'])
    correct_id = transform_choice_id(q_id, question["correctChoiceId"])

    return f"""  {{
    id: '{q_id}',
    year: {question.get("year", 2024)},
    number: {question.get("number", 1)},
    category: '{question.get("category", "unknown")}',
    text: '{escape_ts_string(question["text"])}',
    choices: [
{choices_str}
    ],
    correctChoiceId: '{correct_id}',
    explanation: '{escape_ts_string(question["explanation"])}',
  }}"""

def generate_typescript(questions: list) -> str:
    """Generate TypeScript file content"""
    questions_str = ',\n'.join(format_question(q) for q in questions)

    categories = get_all_categories()
    category_filters = '\n'.join([
        f"  '{cat}': generatedQuestions.filter(q => q.category === '{cat}'),"
        for cat in categories
    ])

    return f"""// Auto-generated questions from Concrete Diagnostician textbook
// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// Total questions: {len(questions)}

import {{ Question }} from '@/lib/types';

export const generatedQuestions: Question[] = [
{questions_str}
];

// Category-based exports
export const questionsByCategory = {{
{category_filters}
}};

// Statistics
export const generatedQuestionsStats = {{
  total: {len(questions)},
  byCategory: {{
{chr(10).join(f"    '{cat}': {sum(1 for q in questions if q.get('category') == cat)}," for cat in categories)}
  }},
  generatedAt: '{datetime.now().isoformat()}',
}};
"""

def main():
    args = parse_args()

    # Find input file
    if args.input:
        input_path = Path(args.input)
    else:
        input_path = find_latest_json()

    if not input_path or not input_path.exists():
        print("Error: No input file found")
        print("Run generate_questions.py first to generate questions")
        sys.exit(1)

    print(f"Reading questions from: {input_path}")

    # Load questions
    with open(input_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    if not questions:
        print("Error: No questions found in input file")
        sys.exit(1)

    print(f"Loaded {len(questions)} questions")

    # Generate TypeScript
    ts_content = generate_typescript(questions)

    # Output path
    output_path = args.output or project_root / 'lib' / 'data' / 'generatedQuestions.ts'
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)

    print(f"\nTypeScript file generated: {output_path}")
    print(f"Total questions: {len(questions)}")

    # Category breakdown
    print("\nBy category:")
    for cat in get_all_categories():
        count = sum(1 for q in questions if q.get('category') == cat)
        if count > 0:
            print(f"  {cat}: {count}")

    print("\nNext step: Import generatedQuestions in mockQuestions.ts")
    print("""
Example integration in lib/data/mockQuestions.ts:

  import { generatedQuestions } from './generatedQuestions';

  export const mockQuestionsDatabase = {
    2024: [...mockQuestions2024, ...generatedQuestions],
    // ...
  };
""")

if __name__ == '__main__':
    main()
