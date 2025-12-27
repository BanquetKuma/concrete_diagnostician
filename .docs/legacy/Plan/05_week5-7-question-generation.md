# Week 5-7: RAG問題生成実装・100問生成

**期間**: 第5-7週（15営業日）
**目標**: RAG問題生成パイプライン実装、100問生成完了、専門家レビュー

---

## Week 5: RAG問題生成パイプライン実装

### Day 1-2: 問題生成クラス実装

#### タスク 5.1: RAG問題生成クラス実装
- **工数**: 4時間
- **依存**: Week 4完了
- **スキル**: TypeScript, Azure OpenAI SDK
- **成果物**: RAGQuestionGenerator クラス

**実装** (`scripts/rag/ragQuestionGenerator.ts`):
既に`06_ai-rag-question-generation-guide.md`に詳細実装あり

**完了条件**:
- [ ] RAGQuestionGeneratorクラス実装
- [ ] 検索→プロンプト生成→GPT-4呼び出し実装
- [ ] トレーサビリティ情報付与実装

---

#### タスク 5.2: プロンプトテンプレート設計
- **工数**: 3時間
- **依存**: タスク5.1
- **スキル**: プロンプトエンジニアリング
- **成果物**: 最適化されたプロンプトテンプレート

**システムプロンプト**:
```typescript
private getSystemPrompt(): string {
  return `
あなたはコンクリート診断士試験の問題作成の専門家です。
提供された参考資料に基づいて、正確で教育的価値の高い問題を作成します。

【重要な原則】
1. 参考資料の内容に忠実に基づくこと
2. 参考資料に明記されていない情報は推測しない
3. 具体的な数値やデータは参考資料から引用する
4. 解説には参考資料の該当箇所を明示する

【問題作成の品質基準】
- 実際の試験レベルに準じた専門性と難易度
- 正解は1つのみで明確に特定できる
- 誤答も技術的に検討が必要なレベル（引っ掛け問題）
- 解説は受験者の理解を深める教育的内容
- 選択肢は参考資料に基づいた内容にする

【禁止事項】
- 参考資料にない情報の捏造
- あいまいな正解の設定
- 単純すぎる誤答の作成
`;
}
```

**完了条件**:
- [ ] システムプロンプト完成
- [ ] ユーザープロンプトテンプレート完成
- [ ] 出力形式指定完成

---

#### タスク 5.3: 検索クエリ設計
- **工数**: 4時間
- **依存**: `07_question-themes-list.md`
- **スキル**: 情報検索、ドメイン知識
- **成果物**: 100テーマ分の検索クエリ

**クエリ設計例**:
```typescript
// scripts/rag/searchQueries.ts
export const SEARCH_QUERIES = [
  {
    category: 'CAT-01',
    categoryName: 'コンクリート材料学',
    theme: '中性化のメカニズムと進行過程',
    difficulty: 'basic' as const,
    searchQuery: {
      theme: '中性化のメカニズムと進行過程',
      searchText: '中性化 炭酸化 水酸化カルシウム CO2 pH アルカリ性',
      semanticQuery: 'コンクリートの中性化はどのようなメカニズムで進行するか？化学反応式と影響要因を説明せよ。',
      top: 5,
    },
  },
  {
    category: 'CAT-01',
    categoryName: 'コンクリート材料学',
    theme: 'セメントの種類と特性（普通、早強、中庸熱等）',
    difficulty: 'basic' as const,
    searchQuery: {
      theme: 'セメントの種類と特性',
      searchText: 'セメント 種類 普通ポルトランド 早強 中庸熱 特性 用途',
      semanticQuery: 'セメントの種類ごとの特性と適切な用途について説明せよ。',
      top: 5,
    },
  },
  // ... 残り98テーマ
];
```

**完了条件**:
- [ ] 100テーマ分のクエリ設計完了
- [ ] searchText最適化（キーワード選定）
- [ ] semanticQuery最適化（質問形式）
- [ ] カテゴリ・難易度割り当て完了

---

### Day 3: パイロット生成（10問）

#### タスク 5.4: パイロット生成スクリプト実装
- **工数**: 2時間
- **依存**: タスク5.1, 5.2, 5.3
- **スキル**: TypeScript
- **成果物**: パイロット生成スクリプト

**実装** (`scripts/rag/pilotGenerate.ts`):
```typescript
import { RAGQuestionGenerator } from './ragQuestionGenerator';
import { SEARCH_QUERIES } from './searchQueries';
import * as fs from 'fs/promises';

async function pilotGenerate() {
  console.log('🧪 Pilot Generation: 10 questions\n');

  const generator = new RAGQuestionGenerator();

  // 最初の10テーマを選択
  const pilotQueries = SEARCH_QUERIES.slice(0, 10);
  const results = [];
  let questionNumber = 1;

  for (const config of pilotQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Q${questionNumber}: ${config.theme}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const generated = await generator.generateQuestion({
        ...config,
        questionNumber,
      });

      results.push({
        questionNumber,
        theme: config.theme,
        category: config.category,
        difficulty: config.difficulty,
        generated,
        status: 'success',
      });

      console.log(`✅ Generated successfully`);
      console.log(`   Sources: ${generated.sources.length} chunks`);
      console.log(`   Keywords: ${generated.keywords.join(', ')}`);

      // Rate limiting
      await sleep(5000);
    } catch (error: any) {
      console.error(`❌ Failed: ${error.message}`);
      results.push({
        questionNumber,
        theme: config.theme,
        status: 'failed',
        error: error.message,
      });
    }

    questionNumber++;
  }

  // 結果保存
  await fs.writeFile(
    './data/pilot_results.json',
    JSON.stringify(results, null, 2)
  );

  // サマリー
  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Pilot generation completed`);
  console.log(`   Success: ${successCount}/10`);
  console.log(`   Failed: ${10 - successCount}/10`);
  console.log(`${'='.repeat(60)}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

pilotGenerate().catch(console.error);
```

**完了条件**:
- [ ] パイロット生成スクリプト実装
- [ ] 10問生成実行
- [ ] 結果JSON保存確認

---

#### タスク 5.5: パイロット問題品質評価
- **工数**: 3時間
- **依存**: タスク5.4
- **スキル**: コンテンツレビュー
- **成果物**: 品質評価レポート

**評価基準**:
```markdown
# 問題品質評価シート

## Q1: [テーマ]

### 1. 参考資料との整合性 (1-5)
- [ ] 5: 完全に整合
- [ ] 4: ほぼ整合
- [ ] 3: 部分的に整合
- [ ] 2: やや乖離
- [ ] 1: 大きく乖離

### 2. 正解の明確性 (1-5)
- [ ] 5: 明確に1つ
- [ ] 4: ほぼ明確
- [ ] 3: やや曖昧
- [ ] 2: 複数解釈可能
- [ ] 1: 不明確

### 3. 誤答の質 (1-5)
- [ ] 5: もっともらしく検討が必要
- [ ] 4: 一定の検討が必要
- [ ] 3: やや単純
- [ ] 2: 明らかに誤り
- [ ] 1: 不適切

### 4. 解説の教育的価値 (1-5)
- [ ] 5: 非常に詳細で分かりやすい
- [ ] 4: 詳細で理解しやすい
- [ ] 3: 基本的な説明あり
- [ ] 2: やや不十分
- [ ] 1: 不十分

### 5. 難易度の適切性 (1-5)
- [ ] 5: 設定難易度と完全一致
- [ ] 4: ほぼ一致
- [ ] 3: やや乖離
- [ ] 2: 大きく乖離
- [ ] 1: 不適切

### 総合評価
- 平均スコア: ____ / 5.0
- 合否判定: [ ] 合格 [ ] 要修正 [ ] 不合格

### 改善提案
-
```

**完了条件**:
- [ ] 10問全て評価完了
- [ ] 平均スコア4.0以上確認
- [ ] 改善点リストアップ

---

### Day 4-5: プロンプト改善・再生成

#### タスク 5.6: プロンプト改善実装
- **工数**: 4時間
- **依存**: タスク5.5
- **スキル**: プロンプトエンジニアリング
- **成果物**: 改善版プロンプト

**改善項目例**:
- より具体的な指示追加
- 誤答生成ロジックの強化
- 解説の詳細度向上
- JSON出力形式の厳格化

**完了条件**:
- [ ] プロンプト改善実装
- [ ] 失敗したパイロット問題の再生成
- [ ] 平均スコア4.5以上達成

---

#### タスク 5.7: バッチ生成スクリプト実装
- **工数**: 3時間
- **依存**: タスク5.6
- **スキル**: TypeScript
- **成果物**: 100問バッチ生成スクリプト

**実装** (`scripts/rag/batchGenerate.ts`):
基本構造は`06_ai-rag-question-generation-guide.md`参照

**追加機能**:
- プログレスバー表示
- リトライロジック（最大3回）
- 中断・再開機能
- リアルタイムログ出力

**完了条件**:
- [ ] バッチ生成スクリプト実装
- [ ] リトライロジック実装
- [ ] 進捗保存・再開機能実装

---

## Week 6: 100問バッチ生成

### Day 1-2: フェーズ1生成（1-40問）

#### タスク 6.1: CAT-01〜02生成（基礎カテゴリ）
- **工数**: 8時間（実行時間含む）
- **依存**: Week 5完了
- **スキル**: 実行監視
- **成果物**: 40問のJSON

**実行**:
```bash
# フェーズ1: 問題1-40
npm run rag:batch -- --start 1 --end 40 --output ./data/phase1_questions.json
```

**監視項目**:
- API呼び出し成功率
- 平均生成時間
- エラー発生率
- コスト累計

**完了条件**:
- [ ] 40問生成完了
- [ ] 成功率95%以上
- [ ] JSON出力確認

---

#### タスク 6.2: フェーズ1中間レビュー
- **工数**: 4時間
- **依存**: タスク6.1
- **スキル**: コンテンツレビュー
- **成果物**: 中間レビューレポート

**サンプリング評価**:
- 10問（25%）をランダム選択
- 品質評価（タスク5.5の基準）
- 問題点の早期発見

**完了条件**:
- [ ] 10問サンプリング評価
- [ ] 平均スコア4.0以上
- [ ] 重大な問題なし確認

---

### Day 3-4: フェーズ2生成（41-80問）

#### タスク 6.3: CAT-03〜06生成（応用カテゴリ）
- **工数**: 8時間
- **依存**: タスク6.2
- **スキル**: 実行監視
- **成果物**: 40問のJSON

**実行**:
```bash
# フェーズ2: 問題41-80
npm run rag:batch -- --start 41 --end 80 --output ./data/phase2_questions.json
```

**完了条件**:
- [ ] 40問生成完了
- [ ] 成功率95%以上

---

### Day 5: フェーズ3生成（81-100問）

#### タスク 6.4: CAT-07〜08生成（実務カテゴリ）
- **工数**: 5時間
- **依存**: タスク6.3
- **スキル**: 実行監視
- **成果物**: 20問のJSON

**実行**:
```bash
# フェーズ3: 問題81-100
npm run rag:batch -- --start 81 --end 100 --output ./data/phase3_questions.json
```

**完了条件**:
- [ ] 20問生成完了
- [ ] 成功率95%以上

---

#### タスク 6.5: 全問題統合・データクリーニング
- **工数**: 3時間
- **依存**: タスク6.4
- **スキル**: データ処理
- **成果物**: `generated_questions_rag_2024.json`

**実装** (`scripts/rag/mergeQuestions.ts`):
```typescript
import * as fs from 'fs/promises';

async function mergeQuestions() {
  console.log('📦 Merging all generated questions...\n');

  // 3フェーズの結果を読み込み
  const phase1 = JSON.parse(await fs.readFile('./data/phase1_questions.json', 'utf-8'));
  const phase2 = JSON.parse(await fs.readFile('./data/phase2_questions.json', 'utf-8'));
  const phase3 = JSON.parse(await fs.readFile('./data/phase3_questions.json', 'utf-8'));

  const allQuestions = [...phase1, ...phase2, ...phase3];

  // データクリーニング
  const cleaned = allQuestions.map((q, index) => {
    // IDの統一
    q.id = `2024-q${String(index + 1).padStart(3, '0')}`;
    q.number = index + 1;
    q.year = 2024;

    // 重複チェック用ハッシュ追加
    q._hash = generateQuestionHash(q);

    return q;
  });

  // 重複検出
  const hashes = new Set();
  const duplicates = [];
  cleaned.forEach((q, index) => {
    if (hashes.has(q._hash)) {
      duplicates.push(index + 1);
    }
    hashes.add(q._hash);
  });

  if (duplicates.length > 0) {
    console.warn(`⚠️  Duplicate questions found: Q${duplicates.join(', Q')}`);
  }

  // 最終出力
  await fs.writeFile(
    './data/generated_questions_rag_2024.json',
    JSON.stringify(cleaned, null, 2)
  );

  console.log(`✅ Merged ${cleaned.length} questions`);
  console.log(`📁 Output: ./data/generated_questions_rag_2024.json`);
}

function generateQuestionHash(question: any): string {
  const content = question.questionText + question.choices.map((c: any) => c.text).join('');
  return require('crypto').createHash('sha256').update(content).digest('hex');
}

mergeQuestions().catch(console.error);
```

**完了条件**:
- [ ] 3フェーズ統合完了
- [ ] 重複問題検出・除外
- [ ] ID採番統一
- [ ] 100問JSON出力

---

## Week 7: 専門家レビュー・品質保証

### Day 1: レビュー用資料作成

#### タスク 7.1: Excel形式出力スクリプト実装
- **工数**: 3時間
- **依存**: タスク6.5
- **スキル**: TypeScript, ExcelJS
- **成果物**: Excelレビューシート

**実装** (`scripts/rag/exportToExcel.ts`):
```typescript
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';

async function exportToExcel() {
  console.log('📊 Exporting questions to Excel...\n');

  const questions = JSON.parse(
    await fs.readFile('./data/generated_questions_rag_2024.json', 'utf-8')
  );

  const workbook = new ExcelJS.Workbook();

  // シート1: 全問題一覧
  const summarySheet = workbook.addWorksheet('問題一覧');
  summarySheet.columns = [
    { header: 'No.', key: 'number', width: 8 },
    { header: 'カテゴリ', key: 'category', width: 20 },
    { header: 'テーマ', key: 'theme', width: 50 },
    { header: '難易度', key: 'difficulty', width: 12 },
    { header: 'レビュー状況', key: 'reviewStatus', width: 15 },
    { header: 'レビュアー', key: 'reviewer', width: 15 },
  ];

  questions.forEach((q: any) => {
    summarySheet.addRow({
      number: q.number,
      category: q.category,
      theme: q.keywords?.join(', ') || '',
      difficulty: q.difficulty,
      reviewStatus: '未レビュー',
      reviewer: '',
    });
  });

  // シート2: 各問題詳細（カテゴリ別）
  const categories = [...new Set(questions.map((q: any) => q.category))];

  categories.forEach(category => {
    const categoryQuestions = questions.filter((q: any) => q.category === category);
    const sheet = workbook.addWorksheet(category);

    categoryQuestions.forEach((q: any, index: number) => {
      const startRow = index * 20 + 1;

      sheet.getCell(`A${startRow}`).value = `問題 ${q.number}`;
      sheet.getCell(`A${startRow}`).font = { bold: true, size: 14 };

      sheet.getCell(`A${startRow + 2}`).value = '【問題文】';
      sheet.getCell(`A${startRow + 3}`).value = q.questionText;
      sheet.getCell(`A${startRow + 3}`).alignment = { wrapText: true };

      sheet.getCell(`A${startRow + 5}`).value = '【選択肢】';
      q.choices.forEach((choice: any, i: number) => {
        const correct = choice.isCorrect ? ' ★正解★' : '';
        sheet.getCell(`A${startRow + 6 + i}`).value = `${choice.label}. ${choice.text}${correct}`;
      });

      sheet.getCell(`A${startRow + 11}`).value = '【解説】';
      sheet.getCell(`A${startRow + 12}`).value = q.explanation;
      sheet.getCell(`A${startRow + 12}`).alignment = { wrapText: true };

      sheet.getCell(`A${startRow + 14}`).value = '【参考資料】';
      q.sources?.forEach((source: any, i: number) => {
        sheet.getCell(`A${startRow + 15 + i}`).value =
          `- ${source.title} (p.${source.pageNumber || '?'}, chunk: ${source.chunkId})`;
      });

      // レビュー欄
      sheet.getCell(`F${startRow}`).value = 'レビュー結果';
      sheet.getCell(`F${startRow}`).font = { bold: true };
      sheet.getCell(`F${startRow + 1}`).value = '合格 / 要修正 / 不合格';
      sheet.getCell(`F${startRow + 3}`).value = 'コメント:';
      sheet.getCell(`F${startRow + 4}`).value = '';
      sheet.getCell(`F${startRow + 4}`).alignment = { wrapText: true };
      sheet.mergeCells(`F${startRow + 4}:H${startRow + 10}`);
    });

    sheet.getColumn('A').width = 80;
    sheet.getColumn('F').width = 40;
  });

  // 保存
  await workbook.xlsx.writeFile('./data/questions_review_2024.xlsx');
  console.log('✅ Excel file created: ./data/questions_review_2024.xlsx');
}

exportToExcel().catch(console.error);
```

**完了条件**:
- [ ] Excelファイル生成
- [ ] 全問題詳細記載
- [ ] レビュー欄追加
- [ ] カテゴリ別シート作成

---

#### タスク 7.2: トレーサビリティレポート作成
- **工数**: 2時間
- **依存**: タスク6.5
- **スキル**: データ分析
- **成果物**: CSVレポート

**実装** (`scripts/rag/generateTraceabilityReport.ts`):
基本構造は`06_ai-rag-question-generation-guide.md`参照

**完了条件**:
- [ ] トレーサビリティCSV出力
- [ ] 全問題の出典情報記録
- [ ] チャンクIDマッピング完了

---

### Day 2-5: 専門家レビュー実施

#### タスク 7.3: 専門家レビュー（フェーズ1: CAT-01〜04）
- **工数**: 12時間（専門家作業時間）
- **依存**: タスク7.1
- **スキル**: ドメイン知識
- **成果物**: レビュー済みExcel（50問）

**レビュー体制**:
- 専門家A: CAT-01〜04担当
- 期限: 2営業日

**完了条件**:
- [ ] 50問レビュー完了
- [ ] 各問題の合否判定
- [ ] 修正コメント記載

---

#### タスク 7.4: 専門家レビュー（フェーズ2: CAT-05〜08）
- **工数**: 12時間
- **依存**: タスク7.1
- **スキル**: ドメイン知識
- **成果物**: レビュー済みExcel（50問）

**レビュー体制**:
- 専門家B: CAT-05〜08担当
- 期限: 2営業日

**完了条件**:
- [ ] 50問レビュー完了
- [ ] 各問題の合否判定
- [ ] 修正コメント記載

---

#### タスク 7.5: フィードバック反映・再生成
- **工数**: 8時間
- **依存**: タスク7.3, 7.4
- **スキル**: TypeScript, プロンプト調整
- **成果物**: 修正版問題

**修正プロセス**:
1. レビューExcelから要修正問題抽出
2. 専門家コメントを元にプロンプト調整
3. 要修正問題のみ再生成
4. 専門家に再レビュー依頼

**完了条件**:
- [ ] 全要修正問題を再生成
- [ ] 専門家承認率95%以上達成
- [ ] 最終版JSON更新

---

#### タスク 7.6: クロスチェック・最終承認
- **工数**: 4時間
- **依存**: タスク7.5
- **スキル**: 品質保証
- **成果物**: 最終承認済み100問

**クロスチェック項目**:
- [ ] 重複問題の最終確認
- [ ] 難易度バランス確認
- [ ] カテゴリ別問題数確認
- [ ] 全問題のトレーサビリティ確認
- [ ] JSON形式の妥当性確認

**完了条件**:
- [ ] 100問全て承認済み
- [ ] 最終版JSON確定
- [ ] レビュー完了レポート作成

---

## Week 5-7 完了チェックリスト

### 問題生成
- [ ] RAG問題生成パイプライン実装完了
- [ ] プロンプト最適化完了
- [ ] 100問バッチ生成完了
- [ ] 生成成功率95%以上達成

### 品質保証
- [ ] パイロット生成・評価完了
- [ ] 専門家レビュー完了（承認率95%以上）
- [ ] フィードバック反映完了
- [ ] トレーサビリティ記録完備

### 成果物
- [ ] `generated_questions_rag_2024.json` - 100問
- [ ] `question_traceability_2024.csv` - トレーサビリティ
- [ ] `questions_review_2024.xlsx` - レビュー結果
- [ ] レビュー完了レポート

### コスト
- [ ] Azure OpenAI API使用量確認
- [ ] 予算内収まり確認（見積: ¥50,000）

## 次週準備

**Week 8で実施すること**:
1. Cosmos DBへのデータ投入
2. フロントエンドAPI統合
3. モックデータから本番データへ切り替え

**準備事項**:
- Cosmos DB投入スクリプト準備
- フロントエンド統合テスト計画
- データ移行手順書作成
