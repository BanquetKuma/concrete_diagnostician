---
name: question-generator
description: コンクリート診断士試験の問題を生成する。Gemini File Search API（RAG）と教科書PDFを使用して、カテゴリ別に四肢択一問題を自動生成。「問題を追加したい」「新しい問題を生成して」「○○分野の問題を作って」などのリクエストに使用。
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Question Generator Skill

コンクリート診断士試験の問題をGemini RAGを使って生成するスキル。

## 前提条件

- Python仮想環境: `.venv/`
- Gemini API Key: `.env.gemini` に設定済み
- File Search Store: 教科書PDF（10分割）がアップロード済み
- Store名: `fileSearchStores/concretediagnosticiantextbo-0uzz0ql8wznf`

## 問題生成手順

### Step 1: 現在の問題数を確認

```bash
# データベースの問題数を確認
curl -s "https://concrete-diagnostician-api.banquet-kuma.workers.dev/api/questions/categories" | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'総問題数: {sum(c[\"totalQuestions\"] for c in data[\"categories\"])}')"
```

### Step 2: カテゴリ設定を確認・更新

カテゴリ定義ファイル: `scripts/gemini_rag/categories.py`

```python
CATEGORIES = {
    "materials": {"name": "コンクリート材料", "count": 15, ...},
    "mix-design": {"name": "配合設計", "count": 10, ...},
    "construction": {"name": "施工", "count": 15, ...},
    "quality": {"name": "品質管理・検査", "count": 15, ...},
    "deterioration": {"name": "劣化・損傷", "count": 20, ...},
    "diagnosis": {"name": "調査・診断", "count": 15, ...},
    "repair": {"name": "補修・補強", "count": 10, ...},
}
```

追加問題数に応じて `count` を増やす。

### Step 3: 問題を生成

```bash
cd /mnt/c/dev/IOS_App_Dev/concrete_diagnostician
source .venv/bin/activate

# 全カテゴリ生成
python scripts/gemini_rag/generate_questions.py

# 特定カテゴリのみ生成
python scripts/gemini_rag/generate_questions.py --category materials

# テスト生成（1問のみ）
python scripts/gemini_rag/generate_questions.py --test
```

### Step 4: 生成結果を確認

```bash
# 生成されたJSONファイルを確認
ls -la data/generated/

# 問題数をカウント
python3 -c "import json; data=json.load(open('data/generated/questions_YYYYMMDD_HHMMSS.json')); print(f'生成問題数: {len(data)}')"
```

### Step 5: データベースにインポート

```bash
# Turso DBにインポート
python scripts/db/import_questions.py data/generated/questions_YYYYMMDD_HHMMSS.json

# Cloudflare Workersをデプロイ（キャッシュクリア）
cd workers && npx wrangler deploy
```

## 生成される問題フォーマット

```json
{
  "id": "gen-materials-001",
  "year": 2024,
  "number": 1,
  "category": "materials",
  "text": "問題文...",
  "choices": [
    {"id": "a", "text": "選択肢1", "isCorrect": false},
    {"id": "b", "text": "選択肢2", "isCorrect": true},
    {"id": "c", "text": "選択肢3", "isCorrect": false},
    {"id": "d", "text": "選択肢4", "isCorrect": false}
  ],
  "correctChoiceId": "b",
  "explanation": "解説文（教科書の該当箇所を引用）",
  "source": {"book": "この1冊で合格！コンクリート診断士", "page": 45, "section": "3.2.1"}
}
```

## トラブルシューティング

### API Key エラー
```bash
# .env.gemini を確認
cat .env.gemini | grep GOOGLE_API_KEY
```

### Store名エラー
```bash
# File Search Store が存在するか確認
cat .env.gemini | grep FILE_SEARCH_STORE_NAME
```

### バリデーションエラーが多い場合
- 個別カテゴリで再生成を試みる
- プロンプトを調整して再実行

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/gemini_rag/generate_questions.py` | メイン生成スクリプト |
| `scripts/gemini_rag/categories.py` | カテゴリ定義 |
| `scripts/gemini_rag/prompts.py` | プロンプトテンプレート |
| `scripts/db/import_questions.py` | DBインポート |
| `.env.gemini` | API設定（gitignore） |
| `data/generated/` | 生成結果保存先 |
