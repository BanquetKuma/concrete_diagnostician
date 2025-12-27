# Azure AI Search インデックス更新ガイド

## 目次

1. [概要](#概要)
2. [インデックス更新の3つのパターン](#インデックス更新の3つのパターン)
3. [パターン別手順](#パターン別手順)
4. [トラブルシューティング](#トラブルシューティング)
5. [ベストプラクティス](#ベストプラクティス)

---

## 概要

Azure AI Searchでは、インデクサーの**変更検出機能**により、Blob Storageに追加・更新されたファイルを自動的に検出し、インデックスに反映します。

### 基本的な仕組み

```
Blob Storage (source-documents)
  ├── PDF1.pdf
  ├── PDF2.pdf  ← 新規追加
  └── PDF3.pdf
        ↓
インデクサー（自動または手動実行）
  - 変更検出: PDF2.pdf が新しい
  - 処理: OCR → チャンク分割 → ベクトル化
        ↓
Azure AI Search Index
  - 既存チャンク: PDF1, PDF3
  - 新規チャンク: PDF2 ← 追加される
```

---

## インデックス更新の3つのパターン

| パターン | 説明 | 実行タイミング | 推奨シーン |
|---------|------|--------------|-----------|
| **パターンA: 自動更新** | ファイルをアップロードして放置 | 2時間ごと（自動） | 本番運用、夜間バッチ |
| **パターンB: 手動更新** | アップロード後すぐに手動実行 | 即時 | 開発中、テスト、デモ前 |
| **パターンC: 強制全件再処理** | 全ファイルを再処理 | 必要時 | トラブル時、設定変更後 |

---

## パターン別手順

### パターンA: 自動更新（完全放置）

**用途**: 本番運用、定期的なコンテンツ追加

#### 手順

```powershell
# 1. 新しいPDFをBlob Storageにアップロード
az storage blob upload `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --file "新しいPDF.pdf" `
  --name "新しいPDF.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# 2. 何もしない（放置）
# インデクサーが2時間以内に自動実行される

# 3. 後で確認（オプション）
python scripts/rag/create_indexer.py status
```

#### タイムライン

```
00:00 - ファイルアップロード完了
  ↓
01:00 - インデクサー自動実行（スケジュール）
  ↓
01:15 - 処理完了（約15分）
  ↓
01:15〜 - 新しいコンテンツが検索可能に
```

#### メリット・デメリット

✅ **メリット**:
- 完全に手間なし
- 深夜にファイル追加しても朝には反映済み
- 運用負荷ゼロ

⚠️ **デメリット**:
- 反映まで最大2時間かかる
- すぐに結果を確認できない

---

### パターンB: 手動更新（即時反映）

**用途**: 開発中、テスト、デモ前の緊急対応

#### 手順

```powershell
# 1. 新しいPDFをBlob Storageにアップロード
az storage blob upload `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --file "新しいPDF.pdf" `
  --name "新しいPDF.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# 2. インデクサーを手動実行
python scripts/rag/create_indexer.py run

# 3. 処理状況を監視
python scripts/rag/create_indexer.py status
# 「状態: running」なら処理中
# 「状態: ready」なら完了

# 4. インデックスのドキュメント数を確認
npm run rag:create-index stats
```

#### タイムライン

```
00:00 - ファイルアップロード完了
  ↓
00:01 - インデクサー手動実行
  ↓
00:15 - 処理完了（約15分）
  ↓
00:15〜 - 新しいコンテンツが検索可能に
```

#### メリット・デメリット

✅ **メリット**:
- すぐに処理開始
- リアルタイムで状況確認可能
- デバッグしやすい

⚠️ **デメリット**:
- 手動操作が必要
- 処理完了を待つ必要がある

---

### パターンC: 強制全件再処理

**用途**: トラブル時、設定変更後、データの整合性確認

#### 手順

```powershell
# 1. インデクサーをリセット（変更検出履歴をクリア）
python scripts/rag/create_indexer.py reset

# 2. インデクサーを実行（全ファイルが再処理される）
python scripts/rag/create_indexer.py run

# 3. 処理状況を監視（全ファイル処理のため時間がかかる）
python scripts/rag/create_indexer.py status

# 4. インデックスを確認
npm run rag:create-index stats
```

#### 実行が必要なケース

- インデクサーの設定を変更した後
- スキルセットの設定を変更した後
- データの整合性に問題がある場合
- 既存ファイルを更新したが反映されない場合

#### 注意事項

⚠️ **全ファイルを再処理するため、処理時間が長くなります**
- 10ファイル → 約30分
- 50ファイル → 約2-3時間
- 100ファイル → 約5-6時間

---

## ファイル操作別の詳細手順

### 1. 新しいPDFを追加する

```powershell
# 単一ファイルのアップロード
az storage blob upload `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --file "question_creation_data/新しい年度.pdf" `
  --name "新しい年度.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# 複数ファイルの一括アップロード
az storage blob upload-batch `
  --account-name concreteragstoragedev `
  --destination source-documents `
  --source "question_creation_data/追加資料/" `
  --pattern "*.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# すぐに反映したい場合
python scripts/rag/create_indexer.py run
```

### 2. 既存のPDFを更新する

```powershell
# 同じファイル名で上書きアップロード
az storage blob upload `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --file "question_creation_data/更新版.pdf" `
  --name "既存ファイル.pdf" `
  --overwrite `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# インデクサーを実行（古いチャンクを削除し、新しいチャンクを追加）
python scripts/rag/create_indexer.py run
```

### 3. PDFを削除する

```powershell
# Blob Storageからファイル削除
az storage blob delete `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --name "削除したいファイル.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# インデクサーを実行（インデックスからも自動削除される）
python scripts/rag/create_indexer.py run
```

### 4. 大容量PDFを分割してアップロード

```powershell
# 1. PDFを100ページごとに分割
python scripts/rag/split_pdf.py question_creation_data/大きなPDF.pdf

# 2. 分割したファイルを一括アップロード
az storage blob upload-batch `
  --account-name concreteragstoragedev `
  --destination source-documents `
  --source "question_creation_data/大きなPDF_split/" `
  --pattern "*.pdf" `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING

# 3. インデクサーを実行
python scripts/rag/create_indexer.py run
```

---

## 処理状況の確認方法

### インデクサーのステータス確認

```powershell
python scripts/rag/create_indexer.py status
```

**出力例（処理中）**:
```
状態: running

最終実行結果:
  - ステータス: inProgress
  - 開始時刻: 2025-10-13 14:30:00
  - 処理アイテム数: 3/6  ← 6ファイル中3ファイル処理済み
```

**出力例（成功）**:
```
状態: ready

最終実行結果:
  - ステータス: success
  - 開始時刻: 2025-10-13 14:30:00
  - 終了時刻: 2025-10-13 14:45:00
  - 処理アイテム数: 6  ← 全ファイル処理完了
  - 失敗数: 0
```

**出力例（エラー）**:
```
状態: ready

最終実行結果:
  - ステータス: transientFailure
  - 処理アイテム数: 5
  - 失敗数: 1

エラー詳細:
  1. Document is too large for extraction
     ドキュメント: 大きすぎるファイル.pdf
```

### インデックスのドキュメント数確認

```powershell
npm run rag:create-index stats
```

**出力例**:
```
Index Statistics:
  Document Count: 15,234  ← 索引化されたチャンク数
  Storage Size: 256 MB
```

### Blob Storageのファイル一覧確認

```powershell
az storage blob list `
  --account-name concreteragstoragedev `
  --container-name source-documents `
  --output table `
  --connection-string $env:AZURE_STORAGE_CONNECTION_STRING
```

---

## トラブルシューティング

### Q1: ファイルをアップロードしたが、検索結果に出てこない

**原因**: インデクサーがまだ実行されていない

**解決策**:
```powershell
# 手動で実行
python scripts/rag/create_indexer.py run

# 10-15分後に確認
python scripts/rag/create_indexer.py status
```

---

### Q2: インデクサーが「success」だが、処理アイテム数が0

**原因**: ファイルサイズが大きすぎて処理がスキップされた

**解決策**:
```powershell
# PDFを100ページごとに分割
python scripts/rag/split_pdf.py 大きなPDF.pdf

# 元の大きなファイルを削除
az storage blob delete --name "大きなPDF.pdf" ...

# 分割ファイルをアップロード
az storage blob upload-batch --source "大きなPDF_split/" ...

# インデクサーを実行
python scripts/rag/create_indexer.py run
```

---

### Q3: ファイルを更新したが、古い内容が検索される

**原因**: 変更検出が正しく動作していない

**解決策**:
```powershell
# インデクサーをリセット
python scripts/rag/create_indexer.py reset

# 再実行
python scripts/rag/create_indexer.py run
```

---

### Q4: エラー: "Indexer is already running"

**原因**: 前回の実行がまだ完了していない

**解決策**:
```powershell
# ステータスを確認
python scripts/rag/create_indexer.py status

# 「状態: ready」になるまで待つ（10-30分）
# その後、再度実行
python scripts/rag/create_indexer.py run
```

---

### Q5: 処理時間が異常に長い（1時間以上）

**原因**:
- PDFファイルが非常に大きい
- OCR処理に時間がかかっている
- Azure OpenAI APIのレート制限

**解決策**:
```powershell
# 処理を継続して待つ（推奨）
# または

# タイムアウトと判断した場合、インデクサーをリセット
python scripts/rag/create_indexer.py reset

# PDFを小さく分割して再アップロード
python scripts/rag/split_pdf.py --pages-per-chunk 50 大きなPDF.pdf
```

---

## ベストプラクティス

### 1. ファイル命名規則

✅ **推奨**:
```
ConcreteDiagnostician2024.pdf
Concrete_Materials_Guide_v2.pdf
exam_questions_2023.pdf
```

❌ **避けるべき**:
```
コンクリート診断士 2024.pdf  ← 日本語・スペース
Concrete&Materials(Guide).pdf  ← 特殊文字
診断士試験_問題集.pdf  ← 日本語
```

### 2. PDFサイズ管理

- **1ファイルあたり**: 50-100MB以下が理想
- **100MB超える場合**: 分割を検討
- **300MB以上**: 必ず分割する

### 3. アップロードタイミング

**本番環境**:
- 深夜や週末など、検索トラフィックが少ない時間帯
- 自動スケジュールに任せる

**開発環境**:
- いつでもOK
- 手動実行で即時確認

### 4. 定期メンテナンス

**月次**:
```powershell
# インデックスの統計を確認
npm run rag:create-index stats

# 不要なファイルをクリーンアップ
az storage blob list ... | grep "古い"
```

**四半期ごと**:
```powershell
# インデクサーを全件再処理（データ整合性確認）
python scripts/rag/create_indexer.py reset
python scripts/rag/create_indexer.py run
```

### 5. バックアップ戦略

- **Blob Storage**: バージョニング機能を有効化
- **インデックス**: 定期的にエクスポート（必要に応じて）
- **設定ファイル**: Gitで管理（`scripts/rag/`）

---

## スケジュール設定の変更

### 現在の設定確認

```powershell
# インデクサーの設定を確認
python scripts/rag/create_indexer.py list
```

### スケジュールの変更手順

1. `scripts/rag/create_indexer.py` を開く
2. Line 65 の `interval` を変更:

```python
# 変更前
schedule=IndexingSchedule(interval="PT2H"),  # 2時間ごと

# 変更例
schedule=IndexingSchedule(interval="PT1H"),   # 1時間ごと
schedule=IndexingSchedule(interval="PT4H"),   # 4時間ごと
schedule=IndexingSchedule(interval="PT24H"),  # 1日ごと
```

3. インデクサーを更新:

```powershell
python scripts/rag/create_indexer.py create
```

### スケジュールを無効化（手動実行のみ）

```python
# Line 65 をコメントアウト
# schedule=IndexingSchedule(interval="PT2H"),
```

---

## 運用チェックリスト

### 新しいPDF追加時

- [ ] ファイル名に日本語・スペース・特殊文字が含まれていないか確認
- [ ] ファイルサイズが100MB以下か確認（超える場合は分割）
- [ ] Blob Storageへのアップロード完了を確認
- [ ] 自動実行を待つ or 手動実行を選択
- [ ] 処理完了後、検索テストで動作確認

### 月次メンテナンス

- [ ] インデックスのドキュメント数を確認
- [ ] インデクサーのエラーログを確認
- [ ] 不要な古いファイルを削除
- [ ] Blob Storageの容量を確認

### トラブル発生時

- [ ] `python scripts/rag/create_indexer.py status` でエラー詳細を確認
- [ ] エラーメッセージをこのガイドで検索
- [ ] 解決しない場合は `reset` → `run` で再処理

---

## 関連ドキュメント

- [RAG Pipeline セットアップガイド](../scripts/rag/README.md)
- [PDF分割ツール使用ガイド](../scripts/rag/PDF_SPLIT_GUIDE.md)
- [スキルセット作成手順](../scripts/rag/SKILLSET_SETUP.md)
- [Azure AI Search 公式ドキュメント](https://learn.microsoft.com/azure/search/)

---

## まとめ

### 通常運用（推奨）

```powershell
# 1. ファイルをアップロード
az storage blob upload ...

# 2. 放置（2時間以内に自動処理）
# または
# 2. すぐに処理したい場合
python scripts/rag/create_indexer.py run
```

### トラブル時

```powershell
# 全件再処理
python scripts/rag/create_indexer.py reset
python scripts/rag/create_indexer.py run
```

**ファイルを追加するだけで、自動的にインデックスが更新されます！** 🎯
