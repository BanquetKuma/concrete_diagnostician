# Azure RAG サービス制約一覧

このドキュメントは、Azure RAG パイプライン（直接インデクシング方式）で使用する各 Azure サービスの制約・上限値をまとめたものです。

**最終更新日**: 2025-01-16
**対象バージョン**: Azure Document Intelligence 2024-11-30 GA

---

## 📄 Azure Document Intelligence の制約

### ファイルサイズ制限

| プラン | 最大ファイルサイズ | 備考 |
|--------|-------------------|------|
| **S0 (有料版)** | **500 MB** | 推奨プラン |
| F0 (無料版) | 4 MB | 本番環境では非推奨 |

**重要**:
- PDF ファイルは 500 MB 以下である必要があります
- これを超える場合は、PDF を分割する必要があります

### ページ数制限

| プラン | 最大ページ数 | 備考 |
|--------|-------------|------|
| **S0 (有料版)** | **2,000 ページ** | - |
| F0 (無料版) | 最初の 2 ページのみ | 本番環境では非推奨 |

**重要**:
- 2,000 ページを超える PDF は処理できません
- 大規模なドキュメントは複数の PDF に分割してください

### 画像サイズ制限

| 項目 | 最小値 | 最大値 |
|------|--------|--------|
| 画像の幅・高さ | 50 pixels | 10,000 pixels |

### その他の制約

| 項目 | 制約内容 |
|------|----------|
| **パスワード保護** | ❌ パスワード付き PDF は処理不可。事前に解除が必要 |
| **スキャン画像品質** | 低品質なスキャン画像は OCR 精度が低下する可能性あり |
| **言語サポート** | prebuilt-layout モデルは多言語対応（日本語含む） |

### API レート制限

| プラン | TPS (Transactions Per Second) |
|--------|-------------------------------|
| S0 | 15 TPS (デフォルト) |

**注意**: 大量の PDF を処理する場合、TPS 制限に注意してリトライロジックを実装してください。

---

## 🤖 Azure OpenAI Embeddings API の制約

### トークン制限（入力テキスト長）

| モデル | 最大トークン数 | 次元数 | 備考 |
|--------|---------------|--------|------|
| **text-embedding-3-small** | **8,192** | 1,536 | 推奨モデル |
| **text-embedding-3-large** | 8,192 | 3,072 | 高精度が必要な場合 |
| text-embedding-ada-002 | 2,048 (Azure版) | 1,536 | 旧モデル（非推奨） |

**重要**:
- 実装では `text-embedding-3-small` (8,192 トークン) を想定
- 1 トークン ≈ 0.75 英単語 ≈ 1.3 文字（日本語）
- 安全マージンとして、実装では 8,191 文字で切り詰め

### バッチリクエスト制限

| 項目 | 制限値 |
|------|--------|
| 最大配列サイズ | 2,048 入力/リクエスト |

**注意**:
- `embedding_generator.py` では単一テキストずつ処理
- バッチ処理を実装する場合は、この制限に注意

### レート制限（TPM: Tokens Per Minute）

| モデル | デフォルト TPM |
|--------|----------------|
| text-embedding-3-* | 350,000 TPM (リージョンごと) |

**計算例**:
- 1,000 文字のチャンク = 約 1,300 トークン
- 350,000 TPM ÷ 1,300 = 約 269 チャンク/分
- 1 PDF (100 チャンク) の処理時間 ≈ 22 秒

### RPM (Requests Per Minute) 制限

デプロイメントごとに設定される RPM に応じて制限されます。
- スタンダードデプロイメント: 通常 6 RPM〜数百 RPM
- プロビジョンドデプロイメント: より高い RPM

**対策**:
- エラーハンドリングとリトライロジックの実装
- `embedding_generator.py` では個別の例外処理を実装済み

---

## 🔍 Azure AI Search Index の制約

### Vector フィールドの制約

| 項目 | 制限値 | 備考 |
|------|--------|------|
| **最大次元数** | **3,072** | text-embedding-3-large の最大次元数と一致 |
| 推奨次元数 | 1,536 | text-embedding-3-small と一致 |

**重要**:
- Index Schema の `dimensions` 設定とモデルの出力次元数を一致させる必要があります
- 実装では `text-embedding-3-small` (1,536 次元) を使用

### ドキュメントサイズ制限

| 項目 | 制限値 |
|------|--------|
| 最大ドキュメントサイズ | 16 MB/ドキュメント |
| 最大フィールド数 | 1,000 フィールド |
| 最大コレクション項目数 | 3,000 項目（Collection フィールド） |

**重要**:
- 1 ドキュメント内の全フィールド合計サイズが 16 MB 以下である必要
- Vector フィールド (1,536 次元 × 4 bytes) ≈ 6 KB
- テキストコンテンツは残り容量（約 16 MB - 6 KB）まで格納可能

### インデックス全体の制約

| SKU | 最大ドキュメント数 | 最大ストレージ |
|-----|-------------------|----------------|
| Basic | 1,000,000 | 2 GB |
| Standard (S1) | 15,000,000 | 25 GB |
| Standard (S2) | 60,000,000 | 100 GB |
| Standard (S3) | 120,000,000 | 200 GB |

### バッチアップロード制約

| 項目 | 推奨値 | 最大値 |
|------|--------|--------|
| バッチサイズ | 100 ドキュメント | 1,000 ドキュメント |
| リクエストサイズ | 16 MB 以下 | - |

**実装**:
- `index_uploader.py` ではデフォルト 100 ドキュメント/バッチ
- これにより安定したパフォーマンスと低エラー率を実現

---

## 📦 Azure Blob Storage の制約

### ファイルアクセス要件

| 項目 | 要件 |
|------|------|
| URL アクセス | HTTPS URL でアクセス可能である必要 |
| 認証方式 | SAS トークン または Public Access |
| SAS トークン有効期限 | 処理完了まで有効である必要 |

### ファイルサイズ制限

| ストレージタイプ | 最大ファイルサイズ |
|-----------------|-------------------|
| Block Blob | 約 190.7 TB |

**注意**:
- Blob Storage 自体は大容量対応だが、Document Intelligence の 500 MB 制限が実質的な上限

---

## 🚨 制約違反時の対処法

### シナリオ 1: PDF が 500 MB を超える

**対処法**:
1. PDF を複数ファイルに分割
2. 各ファイルを個別に処理
3. `main.py --pdf-urls-file` で一括処理

**分割方法**:
```bash
# PyPDF2 を使用した分割例
pip install PyPDF2
python scripts/split_large_pdf.py input.pdf --max-size 400MB
```

### シナリオ 2: PDF が 2,000 ページを超える

**対処法**:
1. PDF をページ範囲で分割
2. Document Intelligence の `pages` パラメータで範囲指定（要実装）

### シナリオ 3: チャンクが 8,192 トークンを超える

**対処法**:
1. `--chunk-size` パラメータを小さくする（デフォルト 1000 → 800 など）
2. `--overlap` パラメータを調整

```bash
python main.py --pdf-url "..." --chunk-size 800 --overlap 80
```

### シナリオ 4: TPM/RPM 制限に到達

**エラーメッセージ例**:
```
RateLimitError: Rate limit exceeded. Retry after X seconds.
```

**対処法**:
1. リトライロジックによる自動再試行（実装済み）
2. 処理速度を落とす（sleep 追加）
3. Azure OpenAI のデプロイメントスケールアップを検討

### シナリオ 5: Index のストレージ容量不足

**エラーメッセージ例**:
```
Quota exceeded: Index storage limit reached
```

**対処法**:
1. 不要なドキュメントの削除
2. Azure AI Search の SKU アップグレード（S1 → S2 など）
3. 古いインデックスのアーカイブ

---

## 📊 推奨構成

### 本番環境推奨

| サービス | 推奨 SKU/プラン | 理由 |
|----------|----------------|------|
| Document Intelligence | S0 | 500 MB、2,000 ページ対応 |
| Azure OpenAI | Standard デプロイメント | 柔軟なスケーリング |
| Azure AI Search | S1 以上 | 15M ドキュメント、25 GB 対応 |
| Blob Storage | Standard (Hot tier) | 頻繁なアクセスに最適 |

### 開発/テスト環境

| サービス | 推奨 SKU/プラン | 理由 |
|----------|----------------|------|
| Document Intelligence | S0 | F0 は 4 MB 制限で不十分 |
| Azure OpenAI | Standard デプロイメント | コスト効率的 |
| Azure AI Search | Basic | 小規模テストに十分 |
| Blob Storage | Standard (Cool tier) | コスト削減 |

---

## 🔗 参考資料

- [Azure Document Intelligence Service Limits](https://learn.microsoft.com/azure/ai-services/document-intelligence/service-limits)
- [Azure OpenAI Service Quotas and Limits](https://learn.microsoft.com/azure/ai-services/openai/quotas-limits)
- [Azure AI Search Service Limits](https://learn.microsoft.com/azure/search/search-limits-quotas-capacity)
- [Azure AI Search Vector Index Limits](https://learn.microsoft.com/azure/search/vector-search-index-size)

---

**注意**: この制約情報は 2025年1月時点のものです。Azure のサービスアップデートにより変更される可能性があります。最新情報は上記の公式ドキュメントを参照してください。
