# Azure RAG 作業進捗サマリー

**最終更新日**: 2025-11-05
**次回作業再開予定**: 未定

---

## 📊 現在の状況

### ステータス: 実装完了・リソース未作成・低コスト運用を検討中

Azure 予算超過のため、Azure リソース作成を延期。
実装とドキュメント作成は**100%完了**しています。

### ⚠️ 重要な変更履歴

#### 2025-11-05: Azure AI Search リソース作成の方針変更

**状況**:
- 当初の計画では Azure AI Search (S1: $250/月) を作成予定だった
- コスト懸念により、リソース作成方針を見直すことを決定
- **注意**: Azure AI Search リソースはまだ作成していない（削除したわけではない）

**理由**:
- Azure AI Search (S1) のコスト ($250/月) が予算を圧迫
- 開発・テスト段階では継続的な稼働が不要
- リソース未作成の段階で方針変更が可能

**今後の選択肢**:

**🎯 オプション A: Basic SKU を使用（推奨）**
- コスト: **$75/月**（S1の約1/3）
- 容量: 2 GB ストレージ、100万ドキュメント
- 開発・テストには十分な性能
- 次回作業時の作成手順は同じ（SKU 選択時に Basic を選ぶだけ）

**💡 オプション B: テスト時のみ作成・即削除（最もコスト効率的）**
- テスト実行時に Basic または S1 を作成
- テスト完了後（数時間以内）に即座に削除
- Azure は日割り課金のため、数時間分のコストのみ（**$2〜8程度**）
- Index Schema は SETUP.md に保存済みのため、再作成は容易（5〜10分）
- **推奨運用**: 月1〜2回のテスト時のみ作成

**🔍 オプション C: 代替アーキテクチャの検討（要調査）**
- Vector Database の代替サービス
  - Pinecone（無料枠あり）
  - Weaviate（オープンソース）
  - Qdrant（オープンソース）
- Azure Cosmos DB with Vector Search
- 実装コード変更が必要になる可能性あり

**次回作業時の推奨アプローチ**:
1. **オプション B を採用**（テスト時のみ作成・即削除）
2. テスト実行前に Basic SKU で Azure AI Search を作成
3. Index Schema を `SETUP.md` の JSON から作成（5分）
4. テスト実行（15〜30分）
5. テスト完了後、リソースを即座に削除
6. 総コスト: **$2〜3程度**

---

## ✅ 完了済みタスク

### 1. アーキテクチャ変更の決定 ✓

**背景**:
- Skillset/Indexer 方式では Collection(Edm.Double) エラーが解決不可能
- JSON 型推論の問題により Float32 制御が困難

**決定事項**:
- **Azure AI Search 標準 Indexer を使用しない**
- **Python で直接インデクシングを行う**方式に全面変更
- Document Intelligence + Azure OpenAI + 直接アップロードの組み合わせ

### 2. Python 直接インデクシングシステムの実装 ✓

#### 2.1 コアモジュール (100% 完了)

| ファイル | 行数 | 機能 | 状態 |
|---------|------|------|------|
| `document_processor.py` | 177 | PDF 解析・チャンク分割 | ✅ 完了 |
| `embedding_generator.py` | 111 | Float32 エンベディング生成 | ✅ 完了 |
| `index_uploader.py` | 257 | Index 直接アップロード | ✅ 完了 |
| `main.py` | 267 | オーケストレーション | ✅ 完了 |

**実装場所**: `scripts/rag/direct_indexing/`

**Float32 精度保証の実装**:
```python
# embedding_generator.py の核心ロジック
embedding_float64 = response.data[0].embedding
embedding_float32 = np.array(embedding_float64, dtype=np.float32)
float32_list = [round(float(val), 7) for val in embedding_float32]
```

#### 2.2 サポートファイル

- `__init__.py` - パッケージ初期化 ✅
- `requirements-indexing.txt` - 依存パッケージリスト ✅
- `README.md` - 使用方法ドキュメント ✅

### 3. ドキュメント作成 ✓

#### 3.1 計画書・ガイド類 (100% 完了)

| ドキュメント | 行数 | 内容 | 状態 |
|-------------|------|------|------|
| `docs/rag/service-limits.md` | 380 | Azure サービス制約一覧 | ✅ 完了 |
| `docs/rag/prerequisites-checklist.md` | 420 | 事前準備チェックリスト | ✅ 完了 |
| `scripts/rag/direct_indexing/SETUP.md` | 780 | Azure Portal セットアップ手順 | ✅ 完了 |
| `scripts/rag/direct_indexing/README.md` | - | システム使用方法（更新） | ✅ 完了 |

#### 3.2 ドキュメント内容詳細

**`service-limits.md`** の主要内容:
- Document Intelligence: 500 MB/ファイル、2,000 ページ制限
- Azure OpenAI: 8,192 トークン制限、1,536 次元出力
- Azure AI Search: 3,072 次元まで対応
- 制約超過時の対処法
- 本番/開発環境の推奨構成

**`prerequisites-checklist.md`** の主要内容:
- Phase 1: Azure リソースの作成・確認
- Phase 2: 環境変数の設定
- Phase 3: Python 環境のセットアップ
- Phase 4: セットアップ検証
- Phase 5: テスト実行
- トラブルシューティングガイド

**`SETUP.md`** の主要内容:
- Azure Portal での画面操作手順（スクリーンショット級の詳細）
- Document Intelligence リソースの作成方法
- Azure OpenAI のモデルデプロイ手順
- Azure AI Search Index Schema の作成（3つの方法）
- Blob Storage と SAS トークン設定
- 完全な環境変数設定例

### 4. 検証スクリプトの実装 ✓

**`validate_setup.py`** (340行) の機能:
- ✅ 環境変数の自動読み込みと検証
- ✅ Document Intelligence への接続テスト
- ✅ Azure OpenAI への接続テスト（実際にエンベディング生成）
- ✅ Azure AI Search への接続テスト
- ✅ Index の存在確認
- ✅ ContentVector フィールドの型チェック（Float32/Float64 判定）
- ✅ エンベディング次元数の確認
- ✅ 詳細なエラーメッセージとトラブルシューティング情報

**実行方法**:
```bash
cd scripts/rag/direct_indexing
python validate_setup.py
```

### 5. 環境設定ファイルの更新 ✓

**`.env.rag.example`** に追加:
```bash
# Azure Document Intelligence
DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-document-intelligence.cognitiveservices.azure.com/
DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key
DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
```

---

## 🔴 未完了タスク（次回作業）

### タスク #1: Azure リソースの作成 🎯 **最優先**

**必要なリソース**:

1. **Azure Document Intelligence**
   - SKU: S0 (有料版)
   - リージョン: Japan East または East US
   - 推定コスト: 従量課金（使用量に応じる）

2. **Azure OpenAI**
   - モデル: text-embedding-3-small をデプロイ
   - リージョン: 他リソースと同じ
   - 推定コスト: $0.00002/1K トークン

3. **Azure AI Search**
   - SKU: S1 以上推奨（開発: Basic も可）
   - Index: `concrete-questions-index` を作成
   - **重要**: ContentVector フィールドは `Collection(Edm.Single)` で作成
   - 推定コスト: S1 で約 $250/月

4. **Azure Blob Storage** (既存利用可能な場合はスキップ)
   - PDF ファイルホスティング用
   - Public Access または SAS トークンで URL アクセス可能にする

**作業手順書**: `scripts/rag/direct_indexing/SETUP.md` を参照

**所要時間**: 初回 60〜90 分

---

### タスク #2: 環境変数の設定

**ファイル**: `.env.rag`

**設定内容**:
```bash
# Azure Document Intelligence
DOCUMENT_INTELLIGENCE_ENDPOINT=https://[your-resource].cognitiveservices.azure.com/
DOCUMENT_INTELLIGENCE_KEY=********************************
DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://[your-resource].openai.azure.com/
AZURE_OPENAI_API_KEY=********************************
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://[your-service].search.windows.net
AZURE_SEARCH_ADMIN_KEY=********************************
AZURE_SEARCH_INDEX_NAME=concrete-questions-index
```

**チェックリスト**:
- [ ] `.env.rag.example` をコピーして `.env.rag` を作成
- [ ] 全ての `********************************` を実際の値に置換
- [ ] ファイルパーミッションを設定: `chmod 600 .env.rag`
- [ ] `.gitignore` に `.env.rag` が含まれていることを確認

**所要時間**: 10 分

---

### タスク #3: セットアップ検証の実行

**コマンド**:
```bash
cd scripts/rag/direct_indexing
python validate_setup.py
```

**成功時の出力例**:
```
============================================================
Azure RAG Setup Validation
============================================================

🔍 Checking Python dependencies...
✅ All required Python packages installed
🔍 Checking environment variables...
✅ Environment variables loaded successfully
🔍 Checking Document Intelligence connection...
✅ Document Intelligence: Connection configured
   Endpoint: https://...
🔍 Checking Azure OpenAI connection...
✅ Azure OpenAI: Connection successful
   Model: text-embedding-3-small
   Dimensions: 1536
🔍 Checking Azure AI Search connection...
✅ Azure AI Search: Connection successful
   Index: concrete-questions-index
✅ ContentVector field is Collection(Edm.Single) (Float32) ✓
   Dimensions: 1536

============================================================
VALIDATION SUMMARY
============================================================
✅ All checks passed!

You can now run the indexing pipeline:
  python main.py --pdf-url "YOUR_PDF_URL"
```

**エラーが出た場合**:
- エラーメッセージに従って対処
- `docs/rag/prerequisites-checklist.md` のトラブルシューティングセクションを参照

**所要時間**: 5 分

---

### タスク #4: テスト PDF の準備

**要件**:
- サイズ: 10 MB 以下（初回テストは小さいファイル推奨）
- ページ数: 10 ページ以下
- 形式: PDF
- 場所: Azure Blob Storage にアップロード済み
- アクセス: SAS トークン付き URL を取得

**SAS トークン生成方法**:
```bash
az storage blob generate-sas \
  --account-name YOUR_STORAGE_ACCOUNT \
  --container-name YOUR_CONTAINER \
  --name test.pdf \
  --permissions r \
  --expiry 2025-11-10T00:00:00Z \
  --https-only \
  --output tsv
```

または Azure Portal で:
1. Blob Storage → Container → PDF ファイルを右クリック
2. "Generate SAS" を選択
3. Permissions: Read のみ
4. Expiry: 1週間後など
5. "Generate SAS token and URL" をクリック
6. URL をコピー

**所要時間**: 10 分

---

### タスク #5: テストインデクシングの実行 🎯 **次回の作業開始ポイント**

**コマンド**:
```bash
cd scripts/rag/direct_indexing
python main.py --pdf-url "https://YOUR_STORAGE.blob.core.windows.net/CONTAINER/test.pdf?sv=...&sig=..."
```

**期待される動作**:
1. PDF のダウンロードと解析
2. ページごとのテキスト抽出
3. チャンクへの分割
4. 各チャンクの Float32 エンベディング生成
5. Azure AI Search Index への直接アップロード

**成功時の出力例**:
```
2025-11-04 10:00:00 - INFO - Loading environment variables...
2025-11-04 10:00:01 - INFO - Initializing components...
2025-11-04 10:00:02 - INFO - Processing 1 PDF(s)
2025-11-04 10:00:03 - INFO - Processing PDF: https://...
2025-11-04 10:00:05 - INFO - Analysis completed. Found 5 pages
2025-11-04 10:00:05 - INFO - Page 1: Created 3 chunks
...
2025-11-04 10:00:06 - INFO - Created 15 documents from PDF
2025-11-04 10:00:06 - INFO - Generated 15 embeddings
2025-11-04 10:00:07 - INFO - Uploading 15 documents to index...
2025-11-04 10:00:08 - INFO - Batch 1/1 completed: 15 succeeded, 0 failed

============================================================
INDEXING SUMMARY
============================================================
Total PDFs processed: 1
Total documents created: 15
Successfully uploaded: 15
Failed uploads: 0
============================================================
```

**確認項目**:
- [ ] ログに `Collection(Edm.Double)` エラーが**出ないこと**
- [ ] `Successfully uploaded: X` が 0 より大きいこと
- [ ] `Failed uploads: 0` であること

**所要時間**: 5〜10 分（PDF サイズによる）

---

### タスク #6: Azure Portal での検証

**手順**:

1. **Azure Portal にアクセス**
   - https://portal.azure.com

2. **Azure AI Search リソースを開く**

3. **Search Explorer に移動**
   - Indexes → `concrete-questions-index` → Search

4. **全件検索を実行**
   ```json
   {
     "search": "*",
     "select": "ID,Content,SourceURL,PageNumber",
     "top": 10
   }
   ```

5. **結果を確認**
   - ドキュメントが表示されること
   - Content フィールドにテキストが含まれていること
   - ContentVector フィールドが存在すること（値は非表示）

6. **ベクトル検索を実行**
   ```json
   {
     "search": "コンクリート診断",
     "vectorQueries": [
       {
         "kind": "text",
         "text": "コンクリートの診断方法",
         "fields": "ContentVector",
         "k": 5
       }
     ]
   }
   ```

7. **類似ドキュメントが返されることを確認**

**所要時間**: 5 分

---

## 📅 次回作業の推奨フロー (2025-11-04 以降)

### Phase 1: 準備 (60〜90 分)

```bash
# Step 1: Azure Portal でリソース作成
# - Document Intelligence
# - Azure OpenAI (text-embedding-3-small デプロイ)
# - Azure AI Search (Index 作成)
# 参照: scripts/rag/direct_indexing/SETUP.md

# Step 2: 環境変数設定
cp .env.rag.example .env.rag
nano .env.rag  # 実際の値を設定

# Step 3: セットアップ検証
cd scripts/rag/direct_indexing
python validate_setup.py
```

### Phase 2: テスト実行 (15〜20 分)

```bash
# Step 4: テスト PDF 準備
# - Azure Blob Storage にアップロード
# - SAS トークン付き URL を取得

# Step 5: テストインデクシング実行
python main.py --pdf-url "YOUR_PDF_SAS_URL"

# Step 6: Azure Portal で結果確認
# - Search Explorer で検索テスト
```

### Phase 3: 本番運用 (必要に応じて)

```bash
# 複数 PDF の一括処理
echo "https://storage.blob.../doc1.pdf?sas" > pdf_urls.txt
echo "https://storage.blob.../doc2.pdf?sas" >> pdf_urls.txt
python main.py --pdf-urls-file pdf_urls.txt

# パラメータ調整
python main.py --pdf-url "..." \
  --chunk-size 1200 \
  --overlap 150 \
  --batch-size 50
```

---

## 🎯 成功の判定基準

### ✅ 成功パターン

1. **validate_setup.py が全チェック通過**
   - ✅ All checks passed! が表示される

2. **main.py が正常完了**
   - ✅ Successfully uploaded > 0
   - ✅ Failed uploads = 0
   - ❌ `Collection(Edm.Double)` エラーが**出ない**

3. **Search Explorer で検索可能**
   - ドキュメントが返される
   - ベクトル検索が機能する

### ❌ 失敗パターンと対処法

| エラー | 原因 | 対処法 |
|--------|------|--------|
| Missing environment variables | .env.rag 未設定 | Phase 1 Step 2 を実行 |
| HTTP 401 Unauthorized | API Key が無効 | Azure Portal で Key を再生成 |
| Index not found | Index 未作成 | SETUP.md の Index 作成手順を実行 |
| ContentVector is Collection(Edm.Double) | Index の型が間違い | Index を削除して Collection(Edm.Single) で再作成 |
| Rate limit exceeded | TPM/RPM 超過 | 数分待ってから再試行 |

---

## 📊 予算とコスト見積もり

### 開発・テスト期間（1ヶ月）の推定コスト

| サービス | SKU | 使用量見積もり | 月額コスト（USD） |
|----------|-----|---------------|------------------|
| Document Intelligence | S0 | 100 PDF × 500 ページ | $15〜30 |
| Azure OpenAI | text-embedding-3-small | 5M トークン | $100 |
| Azure AI Search | S1 | 常時稼働 | $250 |
| Blob Storage | Standard (Hot) | 10 GB | $2 |
| **合計** | | | **$367〜382** |

### コスト削減のヒント

1. **開発環境は Basic SKU を使用**
   - Azure AI Search: Basic ($75/月) で十分

2. **テスト後はリソースを停止**
   - Azure AI Search は使わない時は削除
   - 再作成は簡単（Index Schema は保存しておく）

3. **大量処理は段階的に**
   - 最初は 10 PDF でテスト
   - 問題なければ徐々に増やす

---

## 🔧 トラブルシューティング

### よくある問題と解決策

#### 問題 1: validate_setup.py で Connection failed

**原因**: ネットワーク問題または API Key 無効

**解決策**:
```bash
# 1. インターネット接続確認
ping portal.azure.com

# 2. Azure Portal で API Key を確認
# Keys and Endpoint セクションで Key を再生成

# 3. .env.rag に正しい Key を設定
```

#### 問題 2: main.py で "Image too large" エラー

**原因**: PDF が 500 MB を超えている

**解決策**:
```bash
# PDF を分割
# または
# 画像圧縮で PDF サイズを縮小
```

#### 問題 3: Index に Upload できるがベクトル検索が動かない

**原因**: Vector Search Profile が未設定

**解決策**:
- SETUP.md の Index Schema 作成セクションを参照
- vectorSearch セクションが含まれているか確認

---

## 📚 参考ドキュメント一覧

### 必読ドキュメント

1. **セットアップ関連**
   - `docs/rag/prerequisites-checklist.md` - 事前準備チェックリスト
   - `scripts/rag/direct_indexing/SETUP.md` - 詳細セットアップ手順
   - `docs/rag/service-limits.md` - サービス制約一覧

2. **使用方法**
   - `scripts/rag/direct_indexing/README.md` - システム概要と使用方法

3. **コード**
   - `scripts/rag/direct_indexing/main.py` - メインスクリプト
   - `scripts/rag/direct_indexing/validate_setup.py` - 検証スクリプト

### Azure 公式ドキュメント

- [Azure Document Intelligence](https://learn.microsoft.com/azure/ai-services/document-intelligence/)
- [Azure OpenAI Embeddings](https://learn.microsoft.com/azure/ai-services/openai/how-to/embeddings)
- [Azure AI Search](https://learn.microsoft.com/azure/search/)
- [Vector Search](https://learn.microsoft.com/azure/search/vector-search-overview)

---

## 📝 備考

### システムの強み

1. **Float32 精度の完全制御**
   - NumPy + rounding で確実に Float32 に変換
   - Collection(Edm.Double) エラーを根本解決

2. **詳細なログとエラーハンドリング**
   - 各ステップの進捗が明確
   - エラー発生時の診断が容易

3. **柔軟なパラメータ調整**
   - chunk-size、overlap、batch-size をコマンドラインで指定可能

4. **包括的なドキュメント**
   - 初心者でも Azure Portal の操作から実行まで可能

### システムの制約

1. **Azure 予算が必要**
   - 最低でも月 $300〜400 程度

2. **初回セットアップに時間が必要**
   - Azure リソース作成: 60〜90 分

3. **大量 PDF 処理には時間がかかる**
   - 1 PDF (100 ページ) ≈ 2〜3 分
   - 100 PDF なら 3〜5 時間

---

## ✅ 最終チェックリスト（2025-11-04 作業開始前）

- [ ] この `work-progress-summary.md` を熟読
- [ ] Azure アカウントに予算を追加（最低 $400）
- [ ] `docs/rag/prerequisites-checklist.md` を印刷またはブックマーク
- [ ] `scripts/rag/direct_indexing/SETUP.md` を開く
- [ ] テスト用 PDF を 1〜2 個準備（10 MB 以下、10 ページ以下）

**準備完了したら、Phase 1 Step 1 から開始してください！**

---

**作成日**: 2025-01-16
**作成者**: Claude Code
**次回更新予定**: 2025-11-04（テスト完了後）
