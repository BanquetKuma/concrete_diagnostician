---
name: question-reviewer
description: 生成された問題の品質をレビューする。問題文の正確性、選択肢の妥当性、解説の適切さ、フォーマットの整合性をチェック。「問題をレビューして」「生成した問題を確認して」「品質チェックして」などのリクエストに使用。
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Question Reviewer Skill

生成された問題の品質をレビュー・修正するスキル。

## レビュー観点

### 1. 技術的正確性

- [ ] 問題文の内容が教科書・専門書と一致しているか
- [ ] 正解が技術的に正しいか
- [ ] 誤答選択肢が明らかに間違いとわかるか（紛らわしすぎないか）

### 2. 解説の品質

- [ ] 正解の理由が明確に説明されているか
- [ ] 誤答選択肢についても説明があるか
- [ ] 教科書の参照ページ・セクションが正確か

### 3. フォーマット整合性

- [ ] ID形式: `gen-{category}-{number}`
- [ ] 選択肢が4つあるか
- [ ] `isCorrect: true` が1つだけか
- [ ] `correctChoiceId` と `isCorrect` が一致しているか

### 4. 日本語品質

- [ ] 問題文が自然な日本語か
- [ ] 専門用語が正しく使われているか
- [ ] 誤字脱字がないか

## レビュー手順

### Step 1: JSONファイルの読み込み

```bash
# 最新の生成ファイルを確認
ls -lt data/generated/ | head -5

# ファイルを読み込み
cat data/generated/questions_YYYYMMDD_HHMMSS.json | python3 -m json.tool | head -100
```

### Step 2: 自動バリデーション

```python
import json

def validate_question(q):
    errors = []

    # 必須フィールド
    required = ['id', 'text', 'choices', 'correctChoiceId', 'explanation', 'category']
    for field in required:
        if field not in q:
            errors.append(f"Missing: {field}")

    # 選択肢チェック
    if len(q.get('choices', [])) != 4:
        errors.append(f"Choices count: {len(q.get('choices', []))}")

    # 正解チェック
    correct_count = sum(1 for c in q.get('choices', []) if c.get('isCorrect'))
    if correct_count != 1:
        errors.append(f"Correct count: {correct_count}")

    # ID形式
    if not q.get('id', '').startswith('gen-'):
        errors.append(f"Invalid ID format: {q.get('id')}")

    return errors

# 使用例
with open('data/generated/questions_XXX.json') as f:
    questions = json.load(f)

for q in questions:
    errors = validate_question(q)
    if errors:
        print(f"{q['id']}: {errors}")
```

### Step 3: カテゴリ別レビュー

各カテゴリから代表的な問題を抽出してレビュー：

```bash
# カテゴリ別問題数
python3 -c "
import json
from collections import Counter
data = json.load(open('data/generated/questions_XXX.json'))
for cat, count in Counter(q['category'] for q in data).items():
    print(f'{cat}: {count}問')
"
```

### Step 4: 問題内容のレビュー

**重点チェック項目**:

1. **劣化・損傷 (deterioration)**
   - 中性化、塩害、ASR、凍害の説明が正確か
   - 劣化メカニズムの理解が正しいか

2. **調査・診断 (diagnosis)**
   - 検査方法の手順が正しいか
   - 判定基準が適切か

3. **補修・補強 (repair)**
   - 工法の選定理由が適切か
   - 施工手順が正しいか

### Step 5: 修正が必要な問題の対応

```python
# 問題の修正例
def fix_question(q, fixes):
    """
    fixes = {
        'text': '修正後の問題文',
        'explanation': '修正後の解説',
        'choices': [...],
    }
    """
    q.update(fixes)
    return q
```

### Step 6: 最終確認

```bash
# 修正後のファイルを保存
python3 -c "
import json
# 修正済みデータを保存
with open('data/generated/questions_reviewed.json', 'w') as f:
    json.dump(reviewed_questions, f, ensure_ascii=False, indent=2)
"
```

## よくある問題と修正例

| 問題 | 原因 | 修正方法 |
|------|------|----------|
| 正解が複数 | isCorrectの設定ミス | 1つだけtrueに修正 |
| 解説が不十分 | 生成時の情報不足 | 教科書を参照して追記 |
| 専門用語の誤り | AIの誤解 | 正しい用語に修正 |
| 選択肢が似すぎ | 差別化不足 | 明確に区別できる選択肢に |

## チェックリスト

### 技術レビュー
- [ ] 全問題の自動バリデーション完了
- [ ] 各カテゴリから5問以上を手動レビュー
- [ ] 解説の参照ページを確認

### 品質レビュー
- [ ] 日本語の自然さを確認
- [ ] 難易度のバランスを確認
- [ ] 重複問題がないことを確認

### 最終確認
- [ ] 修正後の再バリデーション
- [ ] レビュー済みファイルの保存
- [ ] DBインポート準備完了
