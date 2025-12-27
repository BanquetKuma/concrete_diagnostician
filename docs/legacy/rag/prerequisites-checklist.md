# Azure RAG 事前準備チェックリスト

このドキュメントは、Azure RAG パイプライン（直接インデクシング方式）を実行する前に必要な準備事項をまとめたチェックリストです。

**対象**: 開発者・システム管理者
**所要時間**: 初回セットアップ 60〜90 分

---

## 📋 Phase 1: Azure リソースの作成・確認

### 1.1 Azure Document Intelligence リソース

- [ ] **リソースが作成済みである**
  - リソース名: `_______________`
  - リージョン: `_______________`
  - プラン: ☑ S0 (有料版) / ☐ F0 (無料版)

- [ ] **Endpoint を取得済み**
  - 形式: `https://[resource-name].cognitiveservices.azure.com/`
  - 取得方法: Azure Portal → リソース → Keys and Endpoint

- [ ] **API Key を取得済み**
  - Key 1 または Key 2 のいずれか
  - 取得方法: Azure Portal → リソース → Keys and Endpoint

**確認方法**:
```bash
# curl で接続テスト
curl -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
  "https://YOUR_ENDPOINT/formrecognizer/info?api-version=2024-11-30"
```

---

### 1.2 Azure OpenAI リソース

- [ ] **リソースが作成済みである**
  - リソース名: `_______________`
  - リージョン: `_______________`

- [ ] **Embedding モデルがデプロイ済みである**
  - ☑ text-embedding-3-small (推奨)
  - ☐ text-embedding-3-large
  - ☐ text-embedding-ada-002 (旧モデル)
  - デプロイメント名: `_______________`

- [ ] **Endpoint を取得済み**
  - 形式: `https://[resource-name].openai.azure.com/`
  - 取得方法: Azure Portal → リソース → Keys and Endpoint

- [ ] **API Key を取得済み**
  - Key 1 または Key 2 のいずれか
  - 取得方法: Azure Portal → リソース → Keys and Endpoint

- [ ] **API Version を確認済み**
  - 推奨: `2024-02-15-preview` 以降

**確認方法**:
```bash
# curl で接続テスト
curl -H "api-key: YOUR_KEY" \
  "https://YOUR_ENDPOINT/openai/deployments?api-version=2024-02-15-preview"
```

**重要**: デプロイメント名は任意ですが、`.env.rag` に設定する名前と一致させてください。

---

### 1.3 Azure AI Search リソース

- [ ] **リソースが作成済みである**
  - リソース名: `_______________`
  - リージョン: `_______________`
  - SKU: ☑ S1 (推奨) / ☐ Basic / ☐ S2 / ☐ S3

- [ ] **Endpoint を取得済み**
  - 形式: `https://[service-name].search.windows.net`
  - 取得方法: Azure Portal → リソース → Overview

- [ ] **Admin Key を取得済み**
  - Primary または Secondary Admin Key
  - 取得方法: Azure Portal → リソース → Keys

**確認方法**:
```bash
# curl で接続テスト
curl -H "api-key: YOUR_ADMIN_KEY" \
  "https://YOUR_SEARCH_SERVICE.search.windows.net/indexes?api-version=2024-07-01"
```

---

### 1.4 Azure AI Search Index の作成・確認

- [ ] **Index が作成済みである**
  - Index 名: `_______________` (例: `concrete-questions-index`)

- [ ] **Index Schema に以下のフィールドが定義されている**:

#### 必須フィールド

| フィールド名 | 型 | Key | Searchable | 備考 |
|-------------|----|----|------------|------|
| `ID` | Edm.String | ✅ Yes | No | ドキュメント一意識別子 |
| `Content` | Edm.String | No | ✅ Yes | テキストコンテンツ |
| `ContentVector` | Collection(Edm.Single) | No | No | **Float32 ベクトル (1536次元)** |

#### オプションフィールド（推奨）

| フィールド名 | 型 | 備考 |
|-------------|----|----|
| `SourceURL` | Edm.String | PDF の URL |
| `PageNumber` | Edm.Int32 | ページ番号 |
| `ChunkIndex` | Edm.Int32 | チャンクインデックス |
| `ProcessedDate` | Edm.DateTimeOffset | 処理日時 |

- [ ] **Vector Search Profile が設定されている**
  - アルゴリズム: HNSW (推奨) または Exhaustive KNN
  - 距離メトリック: cosine / dotProduct / euclidean

**確認方法**:
```bash
# Index 定義を取得
curl -H "api-key: YOUR_ADMIN_KEY" \
  "https://YOUR_SEARCH_SERVICE.search.windows.net/indexes/INDEX_NAME?api-version=2024-07-01"
```

**重要**: `ContentVector` フィールドが `Collection(Edm.Single)` (Float32) であることを必ず確認してください。`Collection(Edm.Double)` の場合は Index を作り直す必要があります。

---

### 1.5 Azure Blob Storage（PDF ホスティング用）

- [ ] **Storage Account が作成済みである**
  - Account 名: `_______________`
  - リージョン: `_______________`

- [ ] **Container が作成済みである**
  - Container 名: `_______________` (例: `source-documents`)

- [ ] **PDF ファイルがアップロード済みである**
  - アップロード方法: Azure Portal / Azure Storage Explorer / `az storage blob upload`

- [ ] **PDF に SAS トークン付き URL でアクセス可能である**
  - または Public Access が有効化されている

**SAS トークン生成方法**:
```bash
# Azure CLI で SAS トークン生成（有効期限: 7日間）
az storage blob generate-sas \
  --account-name YOUR_STORAGE_ACCOUNT \
  --container-name YOUR_CONTAINER \
  --name YOUR_FILE.pdf \
  --permissions r \
  --expiry 2025-01-23T00:00:00Z \
  --https-only \
  --output tsv
```

**確認方法**:
```bash
# curl で PDF アクセステスト
curl -I "https://YOUR_STORAGE_ACCOUNT.blob.core.windows.net/CONTAINER/FILE.pdf?SAS_TOKEN"
```

---

## 📝 Phase 2: 環境変数の設定

### 2.1 `.env.rag` ファイルの作成

- [ ] **`.env.rag.example` をコピーして `.env.rag` を作成**
  ```bash
  cp .env.rag.example .env.rag
  ```

- [ ] **以下の環境変数を設定**:

#### Azure Document Intelligence
```bash
DOCUMENT_INTELLIGENCE_ENDPOINT=https://[resource-name].cognitiveservices.azure.com/
DOCUMENT_INTELLIGENCE_KEY=********************************
DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
```

#### Azure OpenAI
```bash
AZURE_OPENAI_ENDPOINT=https://[resource-name].openai.azure.com/
AZURE_OPENAI_API_KEY=********************************
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

#### Azure AI Search
```bash
AZURE_SEARCH_ENDPOINT=https://[service-name].search.windows.net
AZURE_SEARCH_ADMIN_KEY=********************************
AZURE_SEARCH_INDEX_NAME=concrete-questions-index
```

- [ ] **`.env.rag` ファイルのパーミッションを確認**
  ```bash
  chmod 600 .env.rag  # 所有者のみ読み書き可能
  ```

**セキュリティ注意**:
- `.env.rag` を Git にコミットしないこと（`.gitignore` に含める）
- API Key を他人と共有しないこと
- 本番環境では Azure Key Vault の使用を推奨

---

## 🔧 Phase 3: Python 環境のセットアップ

### 3.1 Python バージョンの確認

- [ ] **Python 3.9 以上がインストール済み**
  ```bash
  python --version
  # または
  python3 --version
  ```

### 3.2 仮想環境の作成（推奨）

- [ ] **仮想環境を作成**
  ```bash
  python -m venv venv_rag
  ```

- [ ] **仮想環境をアクティベート**
  ```bash
  # Windows (PowerShell)
  .\venv_rag\Scripts\Activate.ps1

  # Linux/Mac
  source venv_rag/bin/activate
  ```

### 3.3 依存パッケージのインストール

- [ ] **requirements-indexing.txt からインストール**
  ```bash
  pip install -r scripts/rag/direct_indexing/requirements-indexing.txt
  ```

- [ ] **インストール確認**
  ```bash
  pip list | grep -E "azure-|openai|numpy"
  ```

**期待される出力例**:
```
azure-ai-documentintelligence    1.0.0b1
azure-search-documents            11.5.2
azure-core                        1.31.0
azure-identity                    1.19.0
openai                            1.47.0
numpy                             2.1.1
```

---

## ✅ Phase 4: セットアップ検証

### 4.1 自動検証スクリプトの実行

- [ ] **`validate_setup.py` を実行**
  ```bash
  cd scripts/rag/direct_indexing
  python validate_setup.py
  ```

**成功例**:
```
✅ Environment variables loaded successfully
✅ Document Intelligence: Connection successful
✅ Azure OpenAI: Connection successful (model: text-embedding-3-small)
✅ Azure AI Search: Connection successful
✅ Index 'concrete-questions-index' exists
✅ ContentVector field is Collection(Edm.Single) (Float32) ✓
✅ All checks passed!
```

**エラーが発生した場合**:
- エラーメッセージを確認し、対応するセクションに戻って設定を見直してください
- トラブルシューティングセクションを参照してください

---

## 🧪 Phase 5: テスト実行

### 5.1 単一 PDF でのテスト

- [ ] **小さい PDF (5〜10 ページ) を準備**
  - サイズ: 数 MB 以内
  - ページ数: 10 ページ以下

- [ ] **テスト実行**
  ```bash
  python main.py --pdf-url "https://YOUR_STORAGE.blob.core.windows.net/CONTAINER/test.pdf?SAS_TOKEN"
  ```

- [ ] **ログを確認**
  - `Processing PDF: ...` が表示される
  - `Analysis completed. Found X pages` が表示される
  - `Generated X embeddings` が表示される
  - `Upload completed: X succeeded, 0 failed` が表示される

### 5.2 Azure Portal でのインデックス確認

- [ ] **Azure Portal にアクセス**
  - Azure AI Search リソース → Search Explorer

- [ ] **クエリを実行**
  ```json
  {
    "search": "*",
    "select": "ID,Content,SourceURL,PageNumber",
    "top": 10
  }
  ```

- [ ] **ドキュメントが正しくインデックスされていることを確認**
  - `Content` フィールドにテキストが含まれている
  - `ContentVector` フィールドが存在する（値は表示されない）

### 5.3 ベクトル検索のテスト

- [ ] **類似検索クエリを実行**
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

- [ ] **関連ドキュメントが返されることを確認**

---

## 🚨 トラブルシューティング

### エラー: Missing required environment variables

**原因**: `.env.rag` ファイルが存在しないか、必要な変数が未設定

**対処法**:
1. `.env.rag` ファイルが存在するか確認
2. 全ての必要な環境変数が設定されているか確認
3. 変数名のスペルミスがないか確認

---

### エラー: HTTP 401 Unauthorized

**原因**: API Key が無効または期限切れ

**対処法**:
1. Azure Portal で API Key を再生成
2. `.env.rag` に正しい Key を設定
3. Key の前後に余分なスペースがないか確認

---

### エラー: Index 'XXX' not found

**原因**: Index が存在しないか、Index 名が間違っている

**対処法**:
1. Azure Portal で Index が作成されているか確認
2. `.env.rag` の `AZURE_SEARCH_INDEX_NAME` が正しいか確認
3. 必要に応じて Index を作成（`SETUP.md` 参照）

---

### エラー: ContentVector field is Collection(Edm.Double)

**原因**: Index の Vector フィールドが Float64 で定義されている

**対処法**:
1. Index を削除
2. `Collection(Edm.Single)` で Index を再作成
3. 詳細は `SETUP.md` の「Index Schema 作成」セクションを参照

---

### エラー: Rate limit exceeded

**原因**: Azure OpenAI の TPM/RPM 制限に到達

**対処法**:
1. 数分待ってから再試行
2. `--batch-size` を小さくする
3. Azure OpenAI のデプロイメントをスケールアップ

---

### エラー: PDF too large (>500MB)

**原因**: PDF が Document Intelligence の制限を超えている

**対処法**:
1. PDF を複数ファイルに分割
2. 画像圧縮で PDF サイズを縮小
3. 詳細は `service-limits.md` を参照

---

## 📊 完了確認

全てのチェックボックスが ✅ になったら、セットアップ完了です！

### 次のステップ:
1. **本番 PDF でのインデクシング開始**
   ```bash
   python main.py --pdf-urls-file production_pdfs.txt
   ```

2. **モニタリングとログ確認**
   - Azure Portal で Index のドキュメント数を監視
   - ログファイルでエラーを確認

3. **アプリケーションとの統合**
   - RAG パイプラインをアプリケーションに統合
   - 検索 API の実装

---

## 📚 関連ドキュメント

- [サービス制約一覧](./service-limits.md)
- [セットアップガイド](../../scripts/rag/direct_indexing/SETUP.md)
- [README](../../scripts/rag/direct_indexing/README.md)

---

**最終更新日**: 2025-01-16
