# Gemini File Search API を使った問題生成RAGシステム実装計画

## 概要

コンクリート診断士教科書PDF（10分割済み）から、Google Gemini File Search APIを使って試験問題を自動生成する。

## 前提条件

| 項目 | 内容 |
|------|------|
| PDFファイル | `data/concrete_diagnostician_2024_part01-10.pdf` (各32-44MB, 計508ページ) |
| Python仮想環境 | `.venv/` |
| Gemini API制限 | 100MB/ファイル, 無料枠1GB |
| Google API Key | 取得済み |
| 生成問題数 | 100問以上 |
| カテゴリ分類 | 分野別 |

---

## 実行済み: File Search Store 情報

| 項目 | 値 |
|------|-----|
| Store名 | `fileSearchStores/concretediagnosticiantextbo-0uzz0ql8wznf` |
| アップロード日時 | 2024-12-16 |
| アップロードファイル数 | 10/10 成功 |
| 総サイズ | 352.5 MB |

---

## Phase 1: 環境セットアップ

### 1.1 必要パッケージのインストール

```bash
source .venv/bin/activate
pip install google-genai python-dotenv
```

### 1.2 環境変数設定ファイル作成

**ファイル**: `.env.gemini`

```bash
# Google Gemini API
GOOGLE_API_KEY=your-gemini-api-key

# モデル設定
GEMINI_MODEL=gemini-2.5-pro

# File Search Store
FILE_SEARCH_STORE_NAME=concrete-diagnostician-textbook

# 生成設定
QUESTIONS_PER_CATEGORY=15
TEMPERATURE=0.7
```

---

## Phase 2: Gemini File Search Store 構築

### 2.1 実装ファイル

**ファイル**: `scripts/gemini_rag/setup_file_store.py`

### 2.2 処理フロー

```
.env.gemini 読み込み
    ↓
Gemini Client 初期化
    ↓
File Search Store 作成
    ↓
for each PDF in data/:
    ├─ upload_to_file_search_store()
    └─ 完了待機 (polling)
    ↓
Store名を .env.gemini に追記
```

### 2.3 サンプルコード

```python
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import time

load_dotenv('.env.gemini')

client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))

# File Search Store 作成
file_search_store = client.file_search_stores.create(
    config={'display_name': 'concrete-diagnostician-textbook'}
)

# PDFアップロード
pdf_files = sorted([f for f in os.listdir('data/') if f.endswith('.pdf') and 'part' in f])

for pdf_file in pdf_files:
    print(f"Uploading: {pdf_file}")
    operation = client.file_search_stores.upload_to_file_search_store(
        file=f'data/{pdf_file}',
        file_search_store_name=file_search_store.name,
        config={'display_name': pdf_file}
    )

    # 完了待機
    while not operation.done:
        time.sleep(5)
        operation = client.operations.get(operation)

    print(f"Completed: {pdf_file}")

print(f"Store Name: {file_search_store.name}")
```

---

## Phase 3: 問題生成パイプライン

### 3.1 実装ファイル

**ファイル**: `scripts/gemini_rag/generate_questions.py`

### 3.2 分野別カテゴリ

| 分野コード | 分野名 | 想定問題数 | キーワード例 |
|-----------|--------|-----------|-------------|
| materials | コンクリート材料 | 15問 | セメント、骨材、混和材 |
| mix-design | 配合設計 | 10問 | 水セメント比、スランプ |
| construction | 施工 | 15問 | 打設、締固め、養生 |
| quality | 品質管理・検査 | 15問 | 圧縮強度試験、非破壊検査 |
| deterioration | 劣化・損傷 | 20問 | 中性化、塩害、ASR、凍害 |
| diagnosis | 調査・診断 | 15問 | 目視点検、コア採取 |
| repair | 補修・補強 | 10問 | 断面修復、ひび割れ補修 |
| **合計** | | **100問** | |

### 3.3 問題生成プロンプト

```
あなたはコンクリート診断士試験の出題者です。
提供された教科書の内容に基づいて、四肢択一問題を作成してください。

【分野】{category_name}
【キーワード】{keywords}

【出力形式】JSON
{
  "id": "gen-{category}-{number}",
  "year": 2024,
  "number": {number},
  "category": "{category}",
  "text": "問題文",
  "choices": [
    {"id": "a", "text": "選択肢1", "isCorrect": false},
    {"id": "b", "text": "選択肢2", "isCorrect": true},
    {"id": "c", "text": "選択肢3", "isCorrect": false},
    {"id": "d", "text": "選択肢4", "isCorrect": false}
  ],
  "correctChoiceId": "b",
  "explanation": "解説文（教科書の該当箇所を引用）",
  "source": {"page": 45, "section": "3.2.1"}
}

【条件】
- 教科書の内容に忠実に出題
- 選択肢は紛らわしいが明確に区別可能にする
- 解説は教科書の該当箇所を明示する
- 実務で重要な知識を優先的に出題
```

### 3.4 生成コード

```python
from google import genai
from google.genai import types
import json

def generate_questions_for_category(client, store_name, category, count=15):
    """指定カテゴリの問題を生成"""

    prompt = f"""
    【分野】{category['name']}
    【キーワード】{', '.join(category['keywords'])}

    上記の分野について、教科書の内容に基づいて{count}問の四肢択一問題を作成してください。
    出力はJSON配列形式でお願いします。
    """

    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[store_name]
                )
            )]
        )
    )

    # JSON抽出
    return parse_questions_json(response.text)
```

---

## Phase 4: 出力・統合

### 4.1 出力ファイル

**JSON出力**: `data/generated/questions_{category}.json`

**TypeScript出力**: `lib/data/generatedQuestions.ts`

### 4.2 TypeScript形式

```typescript
import { Question } from '@/lib/types';

// 自動生成された問題データ
export const generatedQuestions: Question[] = [
  {
    id: 'gen-materials-001',
    year: 2024,
    number: 1,
    category: 'materials',
    text: 'セメントの水和反応について...',
    choices: [
      { id: 'a', text: '選択肢1', isCorrect: false },
      { id: 'b', text: '選択肢2', isCorrect: true },
      { id: 'c', text: '選択肢3', isCorrect: false },
      { id: 'd', text: '選択肢4', isCorrect: false },
    ],
    correctChoiceId: 'b',
    explanation: '解説...',
  },
  // ... 100問以上
];

// カテゴリ別エクスポート
export const questionsByCategory = {
  materials: generatedQuestions.filter(q => q.category === 'materials'),
  'mix-design': generatedQuestions.filter(q => q.category === 'mix-design'),
  construction: generatedQuestions.filter(q => q.category === 'construction'),
  quality: generatedQuestions.filter(q => q.category === 'quality'),
  deterioration: generatedQuestions.filter(q => q.category === 'deterioration'),
  diagnosis: generatedQuestions.filter(q => q.category === 'diagnosis'),
  repair: generatedQuestions.filter(q => q.category === 'repair'),
};
```

### 4.3 mockQuestions.ts への統合

```typescript
import { generatedQuestions } from './generatedQuestions';

export const mockQuestionsDatabase = {
  2024: [...mockQuestions2024, ...generatedQuestions],
  2023: mockQuestions2023,
  2022: [],
  2021: [],
};
```

---

## ディレクトリ構造

```
concrete_diagnostician/
├── scripts/
│   └── gemini_rag/
│       ├── __init__.py
│       ├── setup_file_store.py    # Store作成・PDF Upload
│       ├── generate_questions.py  # 問題生成メイン
│       ├── prompts.py             # プロンプトテンプレート
│       ├── categories.py          # カテゴリ定義
│       └── export_questions.py    # TypeScript形式で出力
├── .env.gemini                    # Gemini API設定 (gitignore)
├── .env.gemini.example            # 設定テンプレート
├── data/
│   ├── concrete_diagnostician_2024_part01-10.pdf  # 分割PDF
│   └── generated/                 # 生成結果保存
│       ├── questions_materials.json
│       ├── questions_construction.json
│       └── ...
└── lib/data/
    ├── mockQuestions.ts           # 既存モック
    └── generatedQuestions.ts      # 生成問題 (新規)
```

---

## 実装順序

| Step | タスク | 成果物 |
|------|--------|--------|
| 1 | 環境セットアップ | google-genai インストール |
| 2 | 設定ファイル作成 | `.env.gemini`, `.env.gemini.example` |
| 3 | ディレクトリ作成 | `scripts/gemini_rag/` |
| 4 | File Store構築 | `setup_file_store.py` |
| 5 | PDFアップロード | Gemini Store にPDF登録 |
| 6 | 単体テスト | 1問生成してフォーマット確認 |
| 7 | カテゴリ定義 | `categories.py` |
| 8 | バッチ生成 | 分野ごとに問題生成 |
| 9 | 品質チェック | 生成結果レビュー |
| 10 | TypeScript出力 | `generatedQuestions.ts` |
| 11 | アプリ統合 | `mockQuestions.ts` 更新 |

---

## 注意事項

1. **API制限**: 無料枠は1GB。10個のPDF（計350MB程度）は範囲内
2. **レート制限**: 大量生成時は適度な間隔を空ける
3. **品質確認**: 生成された問題は専門家による監修が必要
4. **著作権**: 教科書内容の引用は適切な範囲で行う
5. **gitignore**: `.env.gemini` はコミットしない

---

## 進捗状況

| Step | タスク | 状態 | 完了日 |
|------|--------|------|--------|
| 1 | 環境セットアップ | ✅ 完了 | 2024-12-16 |
| 2 | 設定ファイル作成 | ✅ 完了 | 2024-12-16 |
| 3 | ディレクトリ作成 | ✅ 完了 | 2024-12-16 |
| 4 | File Store構築スクリプト | ✅ 完了 | 2024-12-16 |
| 5 | PDFアップロード | ✅ 完了 | 2024-12-16 |
| 6 | 単体テスト | ✅ 完了 | 2024-12-17 |
| 7 | カテゴリ定義 | ✅ 完了 | 2024-12-17 |
| 8 | バッチ生成 | ✅ 完了 | 2024-12-17 |
| 9 | 品質チェック | ⏳ 次のステップ | - |
| 10 | TypeScript出力 | 未着手 | - |
| 11 | アプリ統合 | 未着手 | - |

### 完了済み成果物

- **単体テスト結果**: `data/generated/test_question.json`
  - ポルトランドセメントに関する四肢択一問題
  - 詳細な解説付き（正解・誤答の理由明記）
  - JSON形式バリデーション済み

- **カテゴリ定義**: `scripts/gemini_rag/categories.py`
  - 7分野、計100問の定義完了

---

## 次のアクション

1. ~~Google API Key を `.env.gemini` に設定~~ ✅
2. ~~`scripts/gemini_rag/setup_file_store.py` を実行してPDFをアップロード~~ ✅
3. ~~テスト生成で問題フォーマットを確認~~ ✅
4. **バッチ生成を実行** ⏳

### バッチ生成コマンド

```bash
cd /mnt/c/dev/IOS_App_Dev/concrete_diagnostician
source .venv/bin/activate
python scripts/gemini_rag/generate_questions.py
```

### 生成後の次ステップ

```bash
python scripts/gemini_rag/export_questions.py
```

---

## 作業ログ

### 2024-12-17: バッチ生成完了

#### 実施内容

1. **全カテゴリ一括生成を実行**
   ```bash
   python scripts/gemini_rag/generate_questions.py
   ```
   - 結果: 89/100問生成（11問がバリデーションエラーでスキップ）

2. **不足カテゴリの分析**
   | カテゴリ | 生成数 | 目標 | 不足 |
   |---------|-------|------|------|
   | construction | 5 | 15 | -10 |
   | quality | 14 | 15 | -1 |
   | その他5カテゴリ | 70 | 70 | 0 |

3. **不足カテゴリの再生成**
   ```bash
   python scripts/gemini_rag/generate_questions.py --category construction --output data/generated/questions_construction_retry.json
   python scripts/gemini_rag/generate_questions.py --category quality --output data/generated/questions_quality_retry.json
   ```
   - construction: 15/15 成功
   - quality: 15/15 成功

4. **マージ処理**
   - 元の89問から construction(5問), quality(14問) を削除
   - 再生成した construction(15問), quality(15問) を追加
   - 結果: **100問完成**

#### 生成ファイル

| ファイル | 内容 |
|---------|------|
| `data/generated/questions_20251217_003125.json` | 初回生成 (89問) |
| `data/generated/questions_construction_retry.json` | construction再生成 (15問) |
| `data/generated/questions_quality_retry.json` | quality再生成 (15問) |
| `data/generated/questions_merged_100.json` | **最終マージ版 (100問)** |

#### カテゴリ別内訳（最終版）

| カテゴリ | 問題数 |
|---------|-------|
| materials | 15 |
| mix-design | 10 |
| construction | 15 |
| quality | 15 |
| deterioration | 20 |
| diagnosis | 15 |
| repair | 10 |
| **合計** | **100** |

#### 次のアクション

1. `python scripts/gemini_rag/export_questions.py` でTypeScript形式に変換
2. 品質チェック（内容の正確性確認）
3. アプリへの統合

---

### 2024-12-18: バックエンドAPI構築 (Phase 4)

#### 実施内容

**task003: Turso DBへの問題インポート** ✅
- `scripts/db/import_questions.py` 作成
- 100問をTurso DBにインポート完了
- カテゴリ別内訳確認済み

**task004: Cloudflare Workers プロジェクト作成** ✅
- `workers/` ディレクトリ構築
- Hono フレームワーク導入
- `wrangler dev` でローカル開発サーバー起動確認

**task005: 問題取得API実装** ✅
- `workers/src/lib/db.ts` - Turso接続モジュール
- `workers/src/types/question.ts` - 型定義
- `workers/src/routes/questions.ts` - APIルート実装

#### 実装したAPIエンドポイント

| エンドポイント | 機能 | 確認結果 |
|--------------|------|---------|
| `GET /api/questions/years` | 年度一覧取得 | ✅ 動作確認 |
| `GET /api/questions/:year` | 年度別問題リスト | ✅ 100問取得確認 |
| `GET /api/questions/:year/:id` | 問題詳細取得 | ✅ 解説含む全項目取得確認 |

#### 作成ファイル

```
workers/
├── src/
│   ├── index.ts          # エントリーポイント（Hono統合）
│   ├── lib/
│   │   └── db.ts         # Turso DB接続
│   ├── types/
│   │   └── question.ts   # 型定義
│   └── routes/
│       └── questions.ts  # 問題API
├── package.json
├── tsconfig.json
├── wrangler.toml
└── .dev.vars             # ローカル環境変数（gitignore）
```

#### 次のタスク

- [x] Cloudflare本番デプロイ ✅ (2024-12-22完了)
- [ ] task006: 解答保存API実装
- [ ] task007: 学習進捗API実装

---

### 2024-12-22: Cloudflare本番デプロイ完了

#### 実施内容

1. **workers.devサブドメイン有効化**
   - `banquet-kuma.workers.dev` を有効化
   - Cloudflare Dashboardから設定

2. **本番デプロイ実行**
   ```bash
   npx wrangler deploy
   ```
   - Version ID: `9128292a-894e-4139-a4c5-40ee0ca5cc3b`

3. **全APIエンドポイント動作確認**

#### 本番API情報

| 項目 | 値 |
|-----|-----|
| Base URL | `https://concrete-diagnostician-api.banquet-kuma.workers.dev` |
| 年度一覧 | `GET /api/questions/years` |
| 問題リスト | `GET /api/questions/:year` |
| 問題詳細 | `GET /api/questions/:year/:id` |

#### 確認結果

| エンドポイント | ステータス |
|--------------|----------|
| `/api/questions/years` | ✅ 動作確認 (2024年度: 100問) |
| `/api/questions/2024` | ✅ 動作確認 (100問取得) |
| `/api/questions/2024/gen-materials-001` | ✅ 動作確認 (問題文・選択肢・解説) |

#### 次のタスク

1. **task006: 解答保存API実装**
   - `POST /api/answers` - 解答結果を保存
   - `answers`テーブルへの書き込み

2. **task007: 学習進捗API実装**
   - `GET /api/progress/:userId` - ユーザーの学習進捗取得
   - `GET /api/progress/:userId/:year` - 年度別進捗取得

---

### 2024-12-27: 追加問題生成 (136問)

#### 実施内容

1. **4カテゴリの追加問題生成**
   - Gemini File Search APIを使用して新規問題を生成

   | カテゴリ | 生成数 | ファイル |
   |---------|-------|---------|
   | construction | 36問 | `questions_20251227_211857.json` |
   | quality | 38問 | `questions_20251227_212215.json` |
   | diagnosis | 37問 | `questions_20251227_212628.json` |
   | mix-design | 25問 | `questions_20251227_213051.json` |
   | **合計** | **136問** | |

2. **品質レビュー実施**
   - `question-reviewer` skillを使用して全問題をレビュー
   - バリデーション: 必須フィールド、選択肢数、正解数を確認
   - 全問題がフォーマット要件を満たすことを確認

3. **Turso DBへのインポート**
   ```bash
   python scripts/db/import_questions.py data/generated/questions_20251227_211857.json
   python scripts/db/import_questions.py data/generated/questions_20251227_212215.json
   python scripts/db/import_questions.py data/generated/questions_20251227_212628.json
   python scripts/db/import_questions.py data/generated/questions_20251227_213051.json
   ```

#### DB総問題数

| 状態 | 問題数 |
|-----|-------|
| インポート前 | 166問 |
| インポート後 | 302問 |

#### カテゴリ別内訳（最終）

| カテゴリ | 問題数 |
|---------|-------|
| materials | 15 |
| mix-design | 35 |
| construction | 51 |
| quality | 53 |
| deterioration | 70 |
| diagnosis | 52 |
| repair | 26 |
| **合計** | **302** |

---

### 2024-12-28: UI/UX改善・学習履歴機能追加

#### 実施内容

1. **学習履歴クリア機能（分野別）**
   - バックエンド: `DELETE /api/answers/user/:userId/category/:category`
   - フロントエンド: `app/questions/category/[category].tsx` に「学習履歴をクリア」ボタン追加
   - 確認ダイアログ付き、日本語分野名で完了メッセージ表示

2. **学習履歴クリア機能（全分野）**
   - バックエンド: `DELETE /api/answers/user/:userId`
   - フロントエンド: `app/(tabs)/index.tsx` に「全学習履歴をクリア」ボタン追加
   - ホームページ下部に配置、赤枠スタイル（控えめなデザイン）

3. **統計表示の改善**
   - 解答数0でも統計UIを表示するよう修正
   - `components/StudyStats.tsx` の条件分岐を修正
   - 修正前: `!progress || progress.overall.answeredQuestions === 0` で非表示
   - 修正後: `!progress` のみで判定、0でも全項目表示

4. **最終学習日の保持機能**
   - **問題**: 学習履歴クリア後に「最終学習日」が消える
   - **原因**: `lastStudyDate`が`answers`テーブルから計算されていた
   - **解決策**: `users`テーブルに`last_study_date`カラムを追加

   | 変更ファイル | 内容 |
   |------------|------|
   | DB (Turso) | `ALTER TABLE users ADD COLUMN last_study_date TEXT` |
   | `workers/src/routes/answers.ts` | 解答保存時に`users.last_study_date`を更新 |
   | `workers/src/routes/progress.ts` | `users.last_study_date`から最終学習日を取得 |

#### 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `workers/src/routes/answers.ts` | DELETE endpoints追加、last_study_date更新 |
| `workers/src/routes/progress.ts` | last_study_dateをusersテーブルから取得 |
| `lib/api/config.ts` | clearByCategory, clearAll endpoints追加 |
| `lib/api/client.ts` | clearCategoryAnswers(), clearAllAnswers() 追加 |
| `app/questions/category/[category].tsx` | 分野別クリアボタン追加 |
| `app/(tabs)/index.tsx` | 全履歴クリアボタン追加 |
| `components/StudyStats.tsx` | 0件時も統計表示 |

#### デプロイ

```bash
cd workers && npx wrangler deploy
```
- Version ID: `b9fa9662-82d0-46f5-8c94-87087bc73d97`

#### 動作確認

- [x] 分野別学習履歴クリア
- [x] 全学習履歴クリア
- [x] クリア後も最終学習日が保持される
- [x] 解答数0でも統計が表示される

---

## 現在のシステム状態

### DB (Turso)

| テーブル | 概要 |
|---------|------|
| `users` | ユーザー情報 (id, device_id, created_at, last_study_date) |
| `questions` | 問題データ (302問) |
| `answers` | 解答履歴 |

### API (Cloudflare Workers)

| エンドポイント | メソッド | 機能 |
|--------------|--------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/users/register` | POST | ユーザー登録 |
| `/api/users/:userId` | GET | ユーザー取得 |
| `/api/questions/years` | GET | 年度一覧 |
| `/api/questions/categories` | GET | カテゴリ一覧 |
| `/api/questions/:year` | GET | 年度別問題リスト |
| `/api/questions/:year/:id` | GET | 問題詳細 |
| `/api/questions/category/:category` | GET | カテゴリ別問題リスト |
| `/api/questions/category/:category/:id` | GET | カテゴリ別問題詳細 |
| `/api/answers` | POST | 解答保存 |
| `/api/answers/user/:userId` | GET | ユーザー解答履歴 |
| `/api/answers/user/:userId` | DELETE | 全解答履歴クリア |
| `/api/answers/user/:userId/category/:category` | DELETE | 分野別解答履歴クリア |
| `/api/progress/:userId` | GET | 全体進捗 |
| `/api/progress/:userId/year/:year` | GET | 年度別進捗 |
| `/api/progress/:userId/category/:category` | GET | カテゴリ別進捗 |

### 次のタスク

- [ ] App Store申請準備
- [ ] プライバシーポリシー作成
- [ ] 利用規約作成
- [ ] アプリアイコン・スクリーンショット準備
- [ ] Clerk認証機能実装（task016）

---

### 2024-12-29: 認証機能実装計画策定

#### 実施内容

1. **プロジェクト進捗状況の確認**
   - `docs/` 配下のドキュメントを精査
   - 完了済みタスク: task001〜task009（バックエンド構築、API統合）
   - 未完了タスク: task010〜task015（QA、App Store申請準備）

2. **現行ユーザー認証方式の調査**
   - デバイスIDベースの簡易認証
   - `lib/services/userService.ts` でデバイスID生成
   - SecureStoreで永続化
   - 同一デバイスは同一ユーザーとして識別

3. **認証なしのデメリット分析**
   - 機種変更・再インストールでデータ消失
   - 複数デバイス間の同期不可
   - 課金機能の実装困難
   - ユーザー特定・サポート対応の困難

4. **認証サービス比較検討**

   | 項目 | Clerk | Supabase Auth |
   |------|-------|---------------|
   | 無料枠 | 10,000 MAU | 50,000 MAU |
   | Expo統合 | 公式SDK充実 | 設定複雑 |
   | Expo Go対応 | 対応 | 開発ビルド必要 |
   | Google認証 | 簡単 | 複雑 |
   | 既存構成との相性 | 変更不要 | DB連携考慮必要 |

   **結論**: 実装工数の少なさを優先し **Clerk** を採用

5. **Clerk認証機能実装計画の作成**
   - ファイル: `docs/task/task016-clerk-authentication.md`
   - 工数見積もり: 10-12時間（約2日）

#### 作成ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/task/task016-clerk-authentication.md` | Clerk認証実装タスク定義書 |

#### 工数内訳（task016）

| タスク | 工数 |
|--------|------|
| Clerkアカウント・ダッシュボード設定 | 1時間 |
| Expoプロジェクトへの統合 | 2時間 |
| 認証画面UI実装 | 3時間 |
| 既存UserServiceの移行 | 2時間 |
| バックエンドAPI連携 | 2時間 |
| テスト・デバッグ | 2時間 |
| **合計** | **12時間** |

#### 次のアクション（明日以降）

1. Clerkアカウント作成・Google OAuth設定
2. `@clerk/clerk-expo` パッケージ導入
3. サインイン/サインアップ画面実装
4. 既存デバイスIDユーザーのデータ移行機能

---

### 2024-12-30: Google OAuth設定 進行中

#### 実施内容

1. **task016詳細手順の追記**
   - `docs/task/task016-clerk-authentication.md` に「Google OAuth設定 詳細手順」セクションを追加
   - Step 1〜4の詳細な画面操作手順を文書化
   - トラブルシューティング、本番公開時の追加作業も記載

2. **Clerkアカウント作成**
   - https://clerk.com でアカウント作成完了
   - アプリケーション「Concrete Diagnostician」作成済み

3. **Google Cloud Console 設定開始**
   - Google Cloud Console でプロジェクト作成
   - OAuth同意画面の設定を開始

#### 残件（Google OAuth設定）

| 項目 | 状態 | 備考 |
|------|------|------|
| Google Cloudプロジェクト作成 | ✅ 完了 | |
| OAuth同意画面 - ユーザータイプ選択 | ⏳ 作業中 | 「外部」を選択 |
| OAuth同意画面 - アプリ情報入力 | 未着手 | アプリ名、メール必須。URL類は後でOK |
| OAuth同意画面 - スコープ設定 | 未着手 | email, profile, openid のみ |
| OAuth同意画面 - テストユーザー追加 | 未着手 | 自分のGmailを追加 |
| OAuthクライアントID作成 | 未着手 | 「ウェブアプリケーション」選択 |
| Authorized redirect URI設定 | 未着手 | Clerkダッシュボードからコピー |
| Client ID/Secret取得 | 未着手 | ⚠️ Secretは作成時1回のみ表示 |
| Clerkダッシュボードに登録 | 未着手 | Social Connections → Google |
| Account Portalで動作確認 | 未着手 | |

#### 補足情報

- **OAuth同意画面の最小入力項目**（テスト段階）:
  - アプリ名: `コンクリート診断士`
  - ユーザーサポートメール: 自分のメールアドレス
  - デベロッパー連絡先: 自分のメールアドレス
  - ※ URL類（ホームページ、プライバシーポリシー等）は空欄でOK

- **本番公開時に追加設定が必要な項目**:
  - プライバシーポリシーURL
  - 承認済みドメイン
  - Google審査の申請

#### 次のアクション

1. OAuth同意画面のアプリ情報入力を完了
2. スコープ設定（email, profile, openid）
3. テストユーザー追加
4. OAuthクライアントID作成
5. Clerkダッシュボードに認証情報登録
6. Account Portalで動作確認

---

## 2025-12-31 作業ログ

### 完了した作業

#### App Store登録準備

1. **法的ドキュメント作成**
   - [x] プライバシーポリシー (`docs/legal/privacy-policy.md`)
   - [x] 利用規約 (`docs/legal/terms-of-service.md`)
   - [x] サポートページ (`docs/legal/support.md`)
   - [x] GitHub Pages用設定 (`docs/legal/_config.yml`)

2. **app.json設定更新**
   - [x] アプリ名を日本語に変更（コンクリート診断士試験対策）
   - [x] iOS bundleIdentifier設定（com.banquetkuma.concretediagnostician）
   - [x] Android package設定
   - [x] buildNumber/versionCode設定

3. **EAS Build設定**
   - [x] eas.json作成（development/preview/production）

### 残件（ユーザー作業）

| 作業 | 説明 |
|------|------|
| Apple Developer Program登録 | https://developer.apple.com/programs/ で登録（¥12,980/年） |
| GitHub Pages有効化 | Settings → Pages → main branch, /docs folder |
| アプリアイコン作成 | 1024x1024のオリジナルアイコンが必要 |
| eas.json更新 | Apple ID、App Store Connect App ID、Team IDを設定 |
| スクリーンショット撮影 | 各デバイスサイズ×5枚 |

### 公開予定URL（GitHub Pages有効化後）

| ドキュメント | URL |
|-------------|-----|
| プライバシーポリシー | https://banquetkuma.github.io/concrete_diagnostician/legal/privacy-policy |
| 利用規約 | https://banquetkuma.github.io/concrete_diagnostician/legal/terms-of-service |
| サポート | https://banquetkuma.github.io/concrete_diagnostician/legal/support |

### 備考

- 2025-12-30: Clerk認証実装完了（Google/GitHub OAuth）
- 認証後のログアウト機能を各画面の右上に配置済み

---

## 残件: Apple Developer承認後の作業

### RevenueCat決済機能の設定（承認待ち）

**ステータス**: ⏳ Apple Developer Program承認待ち

#### コード実装（完了済み）✅

| ファイル | 内容 |
|---------|------|
| `hooks/useRevenueCat.ts` | 課金ロジックフック |
| `app/(tabs)/subscription.tsx` | プラン画面UI |
| `app/(tabs)/_layout.tsx` | 「⭐ プラン」タブ追加 |
| `app.json` | `expo-build-properties` 設定（iOS deploymentTarget: 15.1） |
| `.env` | RevenueCat APIキー（プレースホルダー） |

#### 承認後に必要な作業

| 順序 | 作業 | 詳細 |
|-----|------|------|
| 1 | App Store Connect ログイン | https://appstoreconnect.apple.com |
| 2 | API Key 作成 | ユーザーとアクセス → キー → App Store Connect API → 新規作成 |
| 3 | p8ファイルダウンロード | ⚠️ 作成時1回のみダウンロード可能 |
| 4 | Key ID / Issuer ID コピー | キー一覧とページ上部から取得 |
| 5 | RevenueCat アプリ登録 | https://app.revenuecat.com でプロジェクト作成 |
| 6 | RevenueCat に認証情報登録 | p8ファイル、Key ID、Issuer ID を入力 |
| 7 | Bundle ID 設定 | `com.banquetkuma.concretediagnostician` |
| 8 | サブスクリプション商品作成 | App Store Connect → アプリ → サブスクリプション |
| 9 | RevenueCat で商品連携 | Entitlement: `pro_access` に商品を紐付け |
| 10 | `.env` 更新 | `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` に実際のキーを設定 |
| 11 | Development Build 作成 | `eas build --profile development --platform ios` |
| 12 | Sandbox テスト | App Store Connect でテスターアカウント作成 |

#### RevenueCat認証情報（設定後に記入）

```
Public API Key (iOS): appl_XXXXXXXXXX
Entitlement ID: pro_access
Bundle ID: com.banquetkuma.concretediagnostician
```

#### 注意事項

- RevenueCatはネイティブモジュールのため **Expo Go では動作しない**
- Development Build または Production Build が必要
- Web版では「モバイルアプリをご利用ください」メッセージを表示済み

---

## 2025-01-02 作業ログ

### パフォーマンス最適化

#### 実施内容

1. **useCallbackによるメモ化**
   - `app/(tabs)/index.tsx` の全コールバック関数を`useCallback`でラップ
   - 不要な再レンダリングを防止

2. **API呼び出しの並列化**
   - `hooks/useCategories.ts` で`Promise.all`を使用
   - カテゴリ一覧と進捗データを同時取得

3. **画像アセット圧縮**
   - Python PILで圧縮処理
   - icon.png: 1.6MB → 524KB (67%削減)
   - adaptive-icon.png: 1.6MB → 524KB (67%削減)
   - app_hero.png: 590KB → 468KB (21%削減)

4. **未使用アセット削除**
   - `react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png`, `partial-react-logo.png` を削除

### Web版互換性修正

#### 問題
- `Alert.alert`がWeb版で動作しない（学習履歴クリアボタンが無反応）

#### 解決策
- `Platform.OS`チェックを追加
- Web: `window.confirm()` / `window.alert()` を使用
- iOS/Android: 従来の`Alert.alert`を使用

#### 修正ファイル
| ファイル | 変更内容 |
|---------|---------|
| `app/(tabs)/index.tsx` | 全学習履歴クリアのPlatform対応 |
| `app/questions/category/[category].tsx` | 分野別履歴クリアのPlatform対応 |

### 統計画面の充実

#### 追加機能

1. **強み・弱み分析セクション** (`components/StudyStats.tsx`)
   - 💪 得意分野（正答率最高の分野）
   - 📚 要改善（正答率最低の分野）
   - `getStrongestCategory` / `getWeakestCategory` 関数を活用

2. **学習達成バッジ**
   - 🎯 100問達成
   - ⭐ 正答率80%達成（10問以上解答時）
   - 🔥 7日連続学習
   - 🏆 全分野制覇（全分野50%以上）
   - 未達成バッジは半透明表示

3. **今日の学習サマリー**
   - 📈 今日の学習状況
   - `hasStudiedToday`関数で判定

4. **分野別レーダーチャート** (`components/CategoryRadarChart.tsx` 新規作成)
   - `react-native-svg`パッケージを追加
   - 各分野の正答率を視覚化
   - 3分野以上回答でチャート表示
   - 各軸に分野名と正答率（色分け）を表示
   - 0%でも最小半径で形状表示
   - ダークモード対応
   - 凡例: 緑(60%以上)、オレンジ(30-59%)、赤(30%未満)

#### 追加パッケージ

```bash
npm install react-native-svg --legacy-peer-deps
```

---

## 残件一覧

### 優先度: 高

| タスク | 状態 | 詳細 |
|--------|------|------|
| Apple Developer Program承認 | ⏳ 承認待ち | 登録済み、承認待ち |
| RevenueCat決済機能設定 | ⏳ 承認待ち | コード実装済み、App Store Connect設定待ち |
| アカウント削除機能 | 🔲 未着手 | `docs/task/task017-account-deletion.md` 参照 |

### 優先度: 中

| タスク | 状態 | 詳細 |
|--------|------|------|
| 問題数修正 | ✅ 完了 | 302問 → 250問に修正済み |
| GitHub Pages有効化 | 🔲 未着手 | Settings → Pages → main branch, /docs folder |
| アプリアイコン作成 | ✅ 完了 | 圧縮済み |
| スクリーンショット撮影 | 🔲 未着手 | 各デバイスサイズ×5枚 |

### 優先度: 低

| タスク | 状態 | 詳細 |
|--------|------|------|
| 問題品質チェック | ⏳ 継続中 | 専門家レビュー |
| オフライン対応 | 🔲 未着手 | 将来バージョン |
| 苦手問題推薦機能 | 🔲 未着手 | 将来バージョン |

---

## 次のアクション

1. **Apple Developer承認後**
   - App Store Connect APIキー作成
   - RevenueCat設定
   - Development Build作成
   - サンドボックステスト

2. **App Store申請前**
   - アカウント削除機能実装（App Store審査要件）
   - スクリーンショット撮影
   - App Store Connectメタデータ入力

3. **継続的改善**
   - ユーザーフィードバック収集
   - 問題コンテンツ追加

