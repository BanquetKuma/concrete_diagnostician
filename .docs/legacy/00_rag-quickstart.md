# RAG問題生成 - クイックスタートガイド

## 概要

このプロジェクトでは、**Azure AI Search + Azure OpenAI Service**を組み合わせた**RAG（Retrieval-Augmented Generation）**システムを使用して、コンクリート診断士試験の問題を100問生成します。

---

## 📚 なぜRAGを使うのか？

### 従来のアプローチ（使用しない）
```
GPT-4に直接依頼
  ↓
幻覚（Hallucination）のリスク
  ↓
不正確な情報を含む問題が生成される可能性
```

### RAGアプローチ（採用）
```
PDF参考資料
  ↓
Azure AI Searchでインデックス化
  ↓
テーマごとに関連情報を検索
  ↓
検索結果 + GPT-4で問題生成
  ↓
参考資料に基づいた正確な問題
```

### RAGの利点
- ✅ **正確性**: 実際の参考資料に基づいた問題生成
- ✅ **トレーサビリティ**: どの資料から生成したか追跡可能
- ✅ **著作権クリア**: オリジナル問題として正当性を主張できる
- ✅ **品質の一貫性**: 全問題が同じ資料に基づく

---

## 🏗️ システムアーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│ 1. PDFドキュメント                                     │
│    Concrete_Diagnostician_2024.pdf (352MB)        │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 2. Azure Blob Storage                               │
│    - コンテナ: source-documents                      │
│    - PDFをアップロード                                │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 3. Azure AI Search                                  │
│    ┌──────────────────────────────────┐            │
│    │ インデクサー (Indexer)            │            │
│    │  - PDFからテキスト抽出           │            │
│    │  - 1,000トークンごとにチャンク分割 │            │
│    │  - ベクトル化 (Embeddings)       │            │
│    └──────────────┬───────────────────┘            │
│                   ↓                                 │
│    ┌──────────────────────────────────┐            │
│    │ 検索インデックス                  │            │
│    │  - テキスト検索                   │            │
│    │  - ベクトル検索                   │            │
│    │  - ハイブリッド検索               │            │
│    └──────────────────────────────────┘            │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 4. RAGパイプライン                                   │
│    ┌──────────────────────────────────┐            │
│    │ 各テーマに対して:                 │            │
│    │  1. 検索クエリ生成               │            │
│    │  2. AI Searchで関連チャンク検索   │            │
│    │  3. 検索結果をプロンプトに統合    │            │
│    │  4. GPT-4で問題生成              │            │
│    └──────────────────────────────────┘            │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 5. 生成された100問                                   │
│    - JSON形式                                        │
│    - トレーサビリティ情報付き                         │
│    - 専門家レビュー待ち                              │
└─────────────────────────────────────────────────────┘
```

---

## 📋 ドキュメント構成

| ファイル | 内容 | 対象読者 |
|---------|------|---------|
| **00_rag-quickstart.md** (本ファイル) | 全体概要とクイックスタート | 全員 |
| **05_question-generation-plan.md** | 問題生成の詳細計画 | PM, 技術者 |
| **06_ai-rag-question-generation-guide.md** | RAG実装の技術ガイド | エンジニア |
| **07_question-themes-list.md** | 100問のテーマ一覧 | コンテンツ担当 |

---

## 🚀 実装ステップ

### Phase 1: Azure環境セットアップ（1週間）

#### 必要なAzureリソース
- **Azure AI Search** (Standard S1)
- **Azure Blob Storage** (Standard LRS)
- **Azure OpenAI Service** (GPT-4 + text-embedding-ada-002)

#### セットアップ手順
```bash
# 1. リソースグループ作成
az group create --name rg-concrete-app --location japaneast

# 2. AI Search作成
az search service create \
  --name search-concrete-questions \
  --resource-group rg-concrete-app \
  --sku standard

# 3. Blob Storage作成
az storage account create \
  --name stconcretedocs \
  --resource-group rg-concrete-app

# 4. PDFアップロード
npx ts-node scripts/uploadPDF.ts
```

### Phase 2: インデックス構築（1週間）

#### インデックス作成
```bash
# インデックス作成
npx ts-node scripts/createIndex.ts

# スキルセット・インデクサー作成（Azure Portal推奨）
# - PDFテキスト抽出
# - チャンキング (1,000トークン)
# - ベクトル化 (text-embedding-ada-002)
```

#### 検証
```bash
# 検索テスト
npx ts-node scripts/testSearch.ts
```

### Phase 3: 問題生成（2週間）

#### パイロット生成（10問）
```bash
# 10問でテスト
npx ts-node scripts/pilotGenerateRAG.ts
```

#### 本番生成（100問）
```bash
# 100問生成
npx ts-node scripts/batchGenerateRAG.ts
```

#### 出力
- `data/generated_questions_rag_2024.json` - 問題データ
- `data/question_traceability_2024.csv` - トレーサビリティレポート

### Phase 4: 専門家レビュー（2週間）

#### レビュー用Excel出力
```bash
npx ts-node scripts/exportToExcel.ts
```

#### レビュープロセス
1. 専門家A: CAT-01〜04のレビュー
2. 専門家B: CAT-05〜08のレビュー
3. フィードバック反映
4. クロスチェック

### Phase 5: データベース投入（1週間）

```bash
# 最終検証
npx ts-node scripts/validateQuestions.ts

# Cosmos DBへ投入
npx ts-node scripts/uploadToCosmos.ts
```

---

## 💻 開発環境セットアップ

### 必要なツール
- Node.js 18.x以上
- TypeScript 5.x
- Azure CLI
- Azure サブスクリプション

### パッケージインストール
```bash
npm install @azure/search-documents
npm install @azure/openai
npm install @azure/storage-blob
npm install dotenv
```

### 環境変数設定
```bash
# .env.local
AZURE_SEARCH_ENDPOINT=https://search-concrete-questions.search.windows.net
AZURE_SEARCH_ADMIN_KEY=your-key
AZURE_SEARCH_INDEX_NAME=concrete-documents

AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_NAME=source-documents

AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

---

## 📊 品質保証

### トレーサビリティ

各問題には以下の情報が記録されます:

```json
{
  "id": "2024-q001",
  "text": "問題文...",
  "explanation": "解説...",
  "sources": [
    {
      "chunkId": "chunk_0123",
      "title": "Concrete_Diagnostician_2024.pdf",
      "pageNumber": 45
    }
  ]
}
```

### 検証項目
- [ ] 参考資料との整合性確認
- [ ] 技術的正確性の検証
- [ ] 重複問題の検出
- [ ] 難易度バランスの確認
- [ ] 専門家による全問レビュー

---

## 📈 進捗管理

### マイルストーン

| Week | マイルストーン | 完了基準 |
|------|--------------|---------|
| 1 | Azure環境構築完了 | インデクサー稼働 |
| 2 | RAGパイプライン構築完了 | 10問テスト生成成功 |
| 3-4 | 100問生成完了 | 全問JSON出力 |
| 5-6 | 専門家レビュー完了 | 全問承認 |
| 7 | データベース投入完了 | 本番環境反映 |

### KPI
- 問題生成成功率: **100%** (失敗した問題は再生成)
- 専門家承認率: **95%以上**
- トレーサビリティ記録率: **100%**

---

## 🔧 トラブルシューティング

### よくある問題

#### 1. インデクサーがPDFを処理できない
**原因**: PDFが大きすぎる、または破損している
**対策**: PDFを分割するか、Azure Cognitive ServicesのOCRスキルを追加

#### 2. 検索結果が空
**原因**: インデックスが正しく構築されていない
**対策**: インデクサーのステータスを確認、エラーログをチェック

#### 3. GPT-4がJSON形式で出力しない
**原因**: プロンプトが不明瞭
**対策**: プロンプトに「```json ... ```で囲んで出力」を明記

#### 4. Rate Limit エラー
**原因**: APIの呼び出し回数超過
**対策**: リトライロジックの実装、待機時間の追加

---

## 📞 サポート

### 質問・問題報告
- GitHub Issues: プロジェクトリポジトリ
- Slack: #concrete-app-dev チャンネル

### 関連リソース
- [Azure AI Search ドキュメント](https://learn.microsoft.com/azure/search/)
- [Azure OpenAI Service ドキュメント](https://learn.microsoft.com/azure/ai-services/openai/)
- [RAGパターン ベストプラクティス](https://learn.microsoft.com/azure/architecture/ai-ml/guide/rag/rag-solution-design-and-evaluation-guide)

---

## ✅ チェックリスト

### 開発前の準備
- [ ] Azureサブスクリプション確認
- [ ] Azure AI SearchのStandard S1プラン確認
- [ ] Azure OpenAI Serviceアクセス権確認
- [ ] PDFファイルの準備完了
- [ ] 専門家レビュアーの確保

### 開発中
- [ ] Azure環境セットアップ完了
- [ ] インデクサー正常稼働
- [ ] 検索テスト成功
- [ ] パイロット生成成功
- [ ] プロンプト調整完了

### 開発後
- [ ] 100問生成完了
- [ ] トレーサビリティレポート作成
- [ ] 専門家レビュー完了
- [ ] データベース投入完了
- [ ] 統合テスト成功

---

_作成日: 2025-10-13_
_最終更新: 2025-10-13_
_バージョン: 1.0_

**次のステップ**: `05_question-generation-plan.md` を読んで詳細計画を確認してください。
