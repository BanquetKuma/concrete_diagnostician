# Azure AI Search インデクサー トラブルシューティング履歴

## 目次

1. [仮想環境のセットアップ（必須）](#仮想環境のセットアップ必須)
2. [エラー1: contentVector が空になる問題](#エラー1-contentvector-が空になる問題)
3. [エラー2: Azure OpenAI Rate Limit による120分タイムアウト](#エラー2-azure-openai-rate-limit-による120分タイムアウト)
4. [エラー3: Azure OpenAI Embedding Skill エラー](#エラー3-azure-openai-embedding-skill-エラー)
5. [予防策と推奨設定](#予防策と推奨設定)

---

## 仮想環境のセットアップ（必須）

### 📌 重要

RAGスクリプト（`scripts/rag/` 配下）を実行するには、**必ず仮想環境を使用**してください。

### 理由

RAGスクリプトは以下のAzure SDKに依存しており、グローバル環境にインストールすると他のプロジェクトと競合する可能性があります：

- `azure-search-documents>=12.0.0`
- `azure-storage-blob>=12.19.0`
- `azure-identity>=1.15.0`
- `python-dotenv>=1.0.0`
- `pypdf>=3.0.0`

### ✅ 仮想環境の作成と使用方法

#### Windows PowerShell の場合

```powershell
# 1. プロジェクトディレクトリに移動
cd C:\Users\banqu\IOS_App_Dev\concrete_diagnostician

# 2. 既存の仮想環境を有効化
.\scripts\rag\venv\Scripts\Activate.ps1

# 3. スクリプトを実行
python scripts\rag\create_indexer.py status

# 4. 仮想環境を終了（作業完了後）
deactivate
```

**実行ポリシーエラーが出た場合**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\rag\venv\Scripts\Activate.ps1
```

#### WSL2 (Linux) の場合

```bash
# 1. プロジェクトディレクトリに移動
cd /mnt/c/Users/banqu/IOS_App_Dev/concrete_diagnostician

# 2. 既存の仮想環境を有効化
source scripts/rag/venv/bin/activate

# 3. スクリプトを実行
python scripts/rag/create_indexer.py status

# 4. 仮想環境を終了（作業完了後）
deactivate
```

### 🔧 仮想環境の再作成（必要な場合のみ）

#### PowerShell

```powershell
# 古い仮想環境を削除
Remove-Item -Recurse -Force scripts\rag\venv

# セットアップスクリプトを実行
.\scripts\rag\setup_venv.ps1
```

#### WSL2 / Linux

```bash
# 古い仮想環境を削除
rm -rf scripts/rag/venv

# セットアップスクリプトを実行
bash scripts/rag/setup_venv.sh
```

### 📝 仮想環境が有効化されているか確認

#### PowerShell

```powershell
# プロンプトに (venv) が表示される
(venv) PS C:\Users\banqu\IOS_App_Dev\concrete_diagnostician>

# または、Pythonパスを確認
python -c "import sys; print(sys.prefix)"
# 出力: C:\Users\banqu\IOS_App_Dev\concrete_diagnostician\scripts\rag\venv
```

#### WSL2 / Linux

```bash
# プロンプトに (venv) が表示される
(venv) user@host:/mnt/c/Users/banqu/IOS_App_Dev/concrete_diagnostician$

# または、Pythonパスを確認
python -c "import sys; print(sys.prefix)"
# 出力: /mnt/c/Users/banqu/IOS_App_Dev/concrete_diagnostician/scripts/rag/venv
```

### ⚠️ 注意事項

1. **WSL2で作成した仮想環境はPowerShellで使えません**（逆も同様）
   - WSL2: `scripts/rag/venv/bin/activate`
   - PowerShell: `scripts\rag\venv\Scripts\Activate.ps1`

2. **グローバル環境での実行は非推奨**
   - パッケージの競合リスク
   - バージョン管理が困難

3. **仮想環境は必ず有効化してから実行**
   - プロンプトに `(venv)` が表示されていることを確認

### 🎯 よくあるエラーと解決策

#### エラー1: `ModuleNotFoundError: No module named 'azure'`

**原因**: 仮想環境が有効化されていない

**解決策**:
```powershell
.\scripts\rag\venv\Scripts\Activate.ps1
```

#### エラー2: `Activate.ps1 cannot be loaded`

**原因**: PowerShellの実行ポリシー制限

**解決策**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### エラー3: 仮想環境が破損している

**原因**: パッケージの不整合

**解決策**:
```powershell
# 仮想環境を削除
Remove-Item -Recurse -Force scripts\rag\venv

# セットアップスクリプトで再作成
.\scripts\rag\setup_venv.ps1
```

---

## エラー1: contentVector が空になる問題

### 🔴 発生日時
2025年10月14日

### 🔍 症状

インデクサーが実行され、インデックスドキュメントは作成されるが、`contentVector` フィールドが空の配列 `[]` になる。

```json
{
  "contentVector": [],  // 空！
  "content": "...",
  "metadata_storage_name": "ConcreteDiagnostician2024_part01_pages1-100.pdf",
  "metadata_storage_path": "https://...",
  "pageNumber": null,
  "chunkId": null,
  "category": null
}
```

### 🔬 根本原因

**スキルセットの出力構造とインデックスのフィールド構造の不一致**

1. **スキルセット**（`skillset-definition.json`）:
   - Split Skill がテキストを分割 → `/document/chunks/*` （配列）
   - Embedding Skill が各チャンクにベクトル生成 → `/document/chunks/*/vector` （配列の各要素）

2. **インデックス**（`index-definition.json`）:
   - フラットな構造: `contentVector` フィールド（単一のベクトル）

3. **インデクサー設定**（`create_indexer.py`）:
   - `output_field_mappings` が**削除されていた**
   - → スキルセットの出力（配列）をインデックス（フラット構造）にマッピングできない
   - → `contentVector` が空になる

### ✅ 解決策

**`output_field_mappings` を追加して、チャンク配列を個別ドキュメントにマッピング**

#### 修正内容（`scripts/rag/create_indexer.py` 89-98行目）

```python
output_field_mappings=[
    FieldMapping(
        source_field_name="/document/chunks/*",        # スキルセットのチャンクテキスト（末尾スラッシュなし）
        target_field_name="content"                    # インデックスのcontentフィールド
    ),
    FieldMapping(
        source_field_name="/document/chunks/*/vector", # スキルセットのベクトル
        target_field_name="contentVector"              # インデックスのcontentVectorフィールド
    )
]
```

⚠️ **重要**: `/document/chunks/*/` と末尾にスラッシュをつけると以下のエラーが発生します：
```
sourceFieldName is an invalid path: empty property token must be escaped as '~2~2'
```
正しい形式は `/document/chunks/*` （末尾スラッシュなし）です。

#### 動作の仕組み

1. **スキルセット**: 1つのPDFを複数のチャンクに分割（例: 100個）
2. **各チャンク**: テキスト + 1536次元のベクトル
3. **output_field_mappings**:
   - `/document/chunks/*/` のパス（`*` はワイルドカード）により、**各チャンクを個別のインデックスドキュメントとして作成**
   - 1つのPDF（100ページ）→ 約100-200個のインデックスドキュメント（チャンクサイズによる）
4. **結果**: 各ドキュメントに `content`（テキスト）と `contentVector`（1536次元ベクトル）が格納される

### 📝 コミット情報

- **ファイル**: `scripts/rag/create_indexer.py`
- **修正箇所**: 89-98行目
- **修正日**: 2025年10月14日

---

## エラー2: Azure OpenAI Rate Limit による120分タイムアウト

### 🔴 発生日時
2025年10月14日

### 🔍 症状

インデクサーが120分（Azure AI Search の制限時間上限）実行されてタイムアウト。

```
Indexing was stopped because indexer execution time quota of 120 minutes has been reached.
Current run with batch size 10 has processed 1 documents, where 1 documents has been
successfully updated and 0 documents need to be re-computed.
```

**処理結果**:
- 実行時間: 120分（2時間）
- 処理ドキュメント数: 1個のみ
- 成功: 1個
- ベクトル生成: 0個（失敗）

### 🔬 根本原因

**Azure OpenAI の TPM (Tokens Per Minute) が非常に低く設定されていた**

Azure OpenAI デプロイメント `text-embedding-3-small` の設定:

```json
"rateLimits": [
  {
    "count": 1.0,           // 10秒あたり1リクエストのみ！
    "key": "request",
    "renewalPeriod": 10.0   // 10秒
  },
  {
    "count": 1000.0,        // 1分あたり1000トークンのみ
    "key": "token",
    "renewalPeriod": 60.0   // 60秒
  }
]
```

#### 処理時間の計算

**シナリオ**: 585ページのPDF（6ファイルに分割）

1. **チャンク数**:
   - 1ページあたり約2-3チャンク（チャンクサイズ1000文字）
   - 585ページ × 2.5チャンク = 約1,463チャンク

2. **必要なリクエスト数**: 1,463リクエスト

3. **処理時間**（1000 TPM の場合）:
   - 10秒あたり1リクエスト
   - 1,463リクエスト × 10秒 = **14,630秒（約244分）**
   - → **120分制限を大幅に超過**

### ✅ 解決策

**Azure OpenAI の TPM を大幅に増加**

#### 実施した対応

Azure Portal で `text-embedding-3-small` デプロイメントの TPM を変更:

- **変更前**: 1,000 TPM
- **変更後**: **350,000 TPM**（350倍）

#### 手順

1. Azure Portal → `concrete-openai-dev` リソース
2. **Model deployments** → `text-embedding-3-small` → **Edit**
3. **Tokens per Minute (TPM)** を **350,000** に変更
4. **Save**

#### 期待される効果

- **処理速度**: 350倍高速化
- **推定処理時間**:
  - 以前: 244分（タイムアウト）
  - 変更後: **約0.7分（42秒）**で全1,463チャンク処理完了
- **全6ファイルの処理時間**: **約2-5分**

### 📊 TPM設定のベストプラクティス

| PDFページ数 | 推定チャンク数 | 推奨TPM | 推定処理時間 |
|-----------|--------------|---------|-------------|
| 100ページ | 250チャンク | 50,000 | 30秒 |
| 500ページ | 1,250チャンク | 100,000 | 1分 |
| 1,000ページ | 2,500チャンク | 200,000 | 1.5分 |
| 2,000ページ | 5,000チャンク | 350,000 | 2分 |

### 🎯 推奨設定

**開発環境**: 100,000 TPM
**本番環境**: 350,000 TPM（最大値）

---

## エラー3: Azure OpenAI Embedding Skill エラー

### 🔴 発生日時
2025年10月14日

### 🔍 症状

インデクサー実行中に以下のエラーが発生:

```
'Enrichment.AzureOpenAIEmbeddingSkill.Azure OpenAI Embedding Skill'
'Could not execute skill because Web Api skill response is invalid'
'Unexpected character encountered while parsing value: d. Path '', line 0, position 0.'
```

### 🔬 根本原因

**2つの可能性**:

1. **Rate Limit 超過**: TPMが低すぎて、リクエストが拒否される
2. **エンコーディング問題**: PDF内の特殊文字がAzure OpenAI APIで処理できない

このエラーは、**エラー2のRate Limit問題と連動**していた。

### ✅ 解決策

**TPMを350,000に増加することで解決**

Rate Limitが原因だったため、TPM増加により:
- リクエストが正常に処理される
- Azure OpenAI Embedding Skill が正しくベクトルを返す

---

## 予防策と推奨設定

### 1. インデクサー設定

#### `create_indexer.py` の推奨設定

```python
indexer = SearchIndexer(
    name=self.indexer_name,
    description="Indexer for processing PDF documents",
    data_source_name=self.datasource_name,
    target_index_name=self.index_name,
    skillset_name=self.skillset_name,
    schedule=IndexingSchedule(interval="PT2H"),  # 2時間ごと
    parameters=IndexingParameters(
        batch_size=1,  # ✅ 大きなPDFの場合は1推奨
        max_failed_items=0,
        max_failed_items_per_batch=0,
        configuration={
            "dataToExtract": "contentAndMetadata",
            "imageAction": "generateNormalizedImages",  # OCR必要な場合のみ
            "parsingMode": "default",
            "failOnUnsupportedContentType": False,
            "failOnUnprocessableDocument": False,
            "indexStorageMetadataOnlyForOversizedDocuments": False
        }
    ),
    field_mappings=[
        FieldMapping(
            source_field_name="metadata_storage_path",
            target_field_name="metadata_storage_path"
        ),
        FieldMapping(
            source_field_name="metadata_storage_name",
            target_field_name="metadata_storage_name"
        )
    ],
    output_field_mappings=[  # ✅ 必須！
        FieldMapping(
            source_field_name="/document/chunks/*",  # ⚠️ 末尾スラッシュなし
            target_field_name="content"
        ),
        FieldMapping(
            source_field_name="/document/chunks/*/vector",
            target_field_name="contentVector"
        )
    ]
)
```

### 2. Azure OpenAI 設定

#### デプロイメント設定

| パラメータ | 開発環境 | 本番環境 |
|----------|---------|---------|
| **TPM** | 100,000 | 350,000 |
| **RPM (Requests Per Minute)** | 1,000 | 5,000 |
| **モデル** | text-embedding-3-small | text-embedding-3-small |
| **バージョン** | 1 | 1 |

#### 確認コマンド

```powershell
az cognitiveservices account deployment show `
  --name concrete-openai-dev `
  --resource-group concrete-app-dev-rg `
  --deployment-name text-embedding-3-small `
  --query "properties.rateLimits"
```

### 3. スキルセット設定

#### `create_skillset.py` の推奨設定

```python
{
  "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
  "name": "Text Split Skill",
  "context": "/document",
  "textSplitMode": "pages",
  "maximumPageLength": 1000,  # ✅ 1000文字推奨（日本語対応）
  "pageOverlapLength": 200,   # ✅ 200文字オーバーラップ
  "inputs": [
    {
      "name": "text",
      "source": "/document/merged_content"
    }
  ],
  "outputs": [
    {
      "name": "textItems",
      "targetName": "chunks"
    }
  ]
}
```

### 4. PDF分割ガイドライン

| PDFサイズ | ページ数 | 推奨分割 | 理由 |
|----------|---------|---------|------|
| 小（<20MB） | <100ページ | 分割不要 | 処理時間5分以内 |
| 中（20-50MB） | 100-300ページ | 100ページずつ | 処理時間10分以内 |
| 大（50-100MB） | 300-585ページ | 100ページずつ | 現在の設定 ✅ |
| 特大（>100MB） | >585ページ | 50ページずつ | タイムアウト防止 |

### 5. モニタリング

#### インデクサーステータスの定期確認

```powershell
# ステータス確認コマンド（5-10分ごとに実行）
python scripts\rag\create_indexer.py status
```

#### 確認すべきポイント

- ✅ **状態**: `running` → `success`
- ✅ **処理済みアイテム数**: 全ファイル数と一致
- ✅ **失敗数**: 0
- ✅ **エラーメッセージ**: なし

### 6. トラブルシューティングフロー

```
インデクサーエラー発生
  ↓
0. 仮想環境を有効化（必須！）
  .\scripts\rag\venv\Scripts\Activate.ps1  # PowerShell
  source scripts/rag/venv/bin/activate     # WSL2
  ↓
1. ステータス確認
  python scripts\rag\create_indexer.py status
  ↓
2. エラー内容を確認
  ├─ "ModuleNotFoundError" → 仮想環境確認
  ├─ "contentVector is empty" → output_field_mappings 確認
  ├─ "timeout 120 minutes" → TPM 確認・増加
  ├─ "Web Api skill response invalid" → TPM 確認・増加
  └─ その他 → ログ確認
  ↓
3. 修正後、リセット＆再実行
  python scripts\rag\create_indexer.py reset
  python scripts\rag\create_indexer.py run
  ↓
4. 結果確認（10分後）
  python scripts\rag\create_indexer.py status
```

---

## まとめ

### 重要な学び

1. **output_field_mappings は必須**: スキルセットの配列出力をインデックスにマッピングするために必要
2. **Azure OpenAI TPM は十分に確保**: 最低100,000、推奨350,000
3. **PDF分割は適切に**: 100ページずつが最適（585ページの場合）
4. **OCRは必要な場合のみ**: スキャン画像PDFの場合は必須、テキストPDFの場合は不要
5. **定期的なステータス確認**: エラーの早期発見のため

### チェックリスト

インデクサー実行前に以下を確認:

- [ ] **仮想環境が有効化されている**（プロンプトに `(venv)` 表示）
- [ ] `output_field_mappings` が設定されている
- [ ] Azure OpenAI TPM が 100,000 以上
- [ ] PDF が適切なサイズに分割されている（100ページ推奨）
- [ ] スキルセットのチャンクサイズが適切（1000文字推奨）
- [ ] Blob Storage にPDFが正しくアップロードされている

---

**このトラブルシューティングガイドにより、同様のエラーを迅速に解決できます！** 🚀
