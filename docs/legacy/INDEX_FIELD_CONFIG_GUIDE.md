# インデックスフィールド設定ガイド

## 概要

このドキュメントは、Azure AI Searchのインデックスフィールド設定における重要な制約と、過去に発生したエラーの再発防止策をまとめたものです。

---

## 🚨 発生したエラーと原因

### エラー1: 32KB制限エラー

**エラーメッセージ:**
```
Field 'content' contains a term that is too large to process.
The max length for UTF-8 encoded terms is 32766 bytes.
```

**原因:**
`content`フィールドに以下の設定がされていた：
- `filterable: true`
- `sortable: true`
- `facetable: true`

これらの設定があると、フィールド全体が**1つのトークン**として扱われ、32KB（32,766バイト）を超えるとエラーになります。

**影響:**
- 大きなテキストチャンク（特にPDFのOCR結果）が処理できない
- インデクサーが`transientFailure`状態になる

---

### エラー2: 内容が取得できない

**症状:**
RAGで検索結果を取得しても、`content`フィールドの値が空

**原因:**
`content`フィールドに以下の設定がされていた：
- `retrievable: false`

**影響:**
- 検索結果で内容を取得できない
- RAGで回答生成時にコンテキストが得られない

---

## ✅ 正しいフィールド設定

### 大きなテキストフィールド（content）の推奨設定

**用途:** RAGで使用する、長文のテキストコンテンツ

```json
{
  "name": "content",
  "type": "Edm.String",
  "searchable": true,      // ✅ 全文検索に必要
  "filterable": false,     // ❌ 32KB制限を回避
  "retrievable": true,     // ✅ RAGで内容取得に必要
  "stored": true,          // ✅ データを保存
  "sortable": false,       // ❌ 32KB制限を回避
  "facetable": false,      // ❌ 32KB制限を回避
  "key": false,
  "analyzer": "ja.microsoft",  // 日本語形態素解析
  "synonymMaps": []
}
```

### 設定項目の説明

| 項目 | 設定値 | 理由 |
|------|--------|------|
| **searchable** | `true` | 全文検索に必須。アナライザーでトークン化される |
| **filterable** | `false` | 完全一致フィルタは不要。32KB制限を回避 |
| **retrievable** | `true` | 検索結果で内容を取得するために必須（RAG） |
| **stored** | `true` | データをインデックスに保存 |
| **sortable** | `false` | ソート不要。32KB制限を回避 |
| **facetable** | `false` | ファセット不要。32KB制限を回避 |
| **analyzer** | `ja.microsoft` | 日本語の形態素解析に必要 |

---

## 📋 フィールドタイプ別の推奨設定

### 1. 長文テキストフィールド（RAG用）

**例:** `content`, `description`, `summary`

```json
{
  "searchable": true,
  "filterable": false,
  "retrievable": true,
  "sortable": false,
  "facetable": false,
  "analyzer": "ja.microsoft"
}
```

### 2. 短いテキストフィールド（メタデータ）

**例:** `title`, `category`, `author`

```json
{
  "searchable": true,
  "filterable": true,    // ✅ 短いのでフィルタ可能
  "retrievable": true,
  "sortable": true,      // ✅ 短いのでソート可能
  "facetable": true,     // ✅ カテゴリ分類に使用可能
  "analyzer": "ja.microsoft"
}
```

### 3. ID・パスフィールド

**例:** `metadata_storage_path`, `chunkId`

```json
{
  "searchable": false,   // 検索不要
  "filterable": true,    // 完全一致フィルタで使用
  "retrievable": true,
  "sortable": false,     // ソート不要
  "facetable": false
}
```

### 4. ベクトルフィールド

**例:** `contentVector`

```json
{
  "type": "Collection(Edm.Single)",
  "searchable": true,      // ベクトル検索に必要
  "filterable": false,
  "retrievable": true,     // RAGで使用する場合はtrue
  "sortable": false,
  "facetable": false,
  "dimensions": 1536,
  "vectorSearchProfile": "vector-profile"
}
```

### 5. 数値フィールド

**例:** `pageNumber`, `score`

```json
{
  "type": "Edm.Int32",
  "searchable": false,
  "filterable": true,      // 範囲フィルタに使用
  "retrievable": true,
  "sortable": true,        // ページ順ソートに使用
  "facetable": true        // ページ番号でグループ化
}
```

---

## 🔧 インデックス作成時のチェックリスト

### 設計段階

- [ ] 各フィールドの用途を明確にする（検索用/メタデータ/RAG用）
- [ ] 長文テキストフィールドは `filterable/sortable/facetable` を `false` にする
- [ ] RAGで使用するフィールドは `retrievable: true` にする
- [ ] 日本語フィールドには適切なアナライザーを設定する

### 作成後の確認

- [ ] インデックス定義をエクスポートして、ローカルに保存
- [ ] `index-definition.json` をGit管理下に置く
- [ ] テストデータで動作確認（小さいPDFで先に試す）
- [ ] フィールドサイズの大きいドキュメントでテスト

### 変更時の注意

- [ ] **既存のフィールド設定は変更できない** - 削除→再作成が必要
- [ ] 変更前にインデックス定義をバックアップ
- [ ] データソース、スキルセットは保持される
- [ ] インデクサーは再作成が必要

---

## 🛠️ トラブルシューティング

### 問題: 32KB制限エラーが発生する

**チェック項目:**
1. エラーが出ているフィールドを特定
2. そのフィールドの `filterable`, `sortable`, `facetable` を確認
3. 必要がなければ `false` に変更（インデックス再作成）

**修正手順:**
```powershell
# 1. 現在のインデックス定義をエクスポート（Azure Portal）
# 2. 問題のフィールド設定を修正
# 3. インデクサー削除
python scripts/rag/create_indexer.py delete

# 4. インデックス削除（Azure Portal）
# 5. 修正したJSONでインデックス再作成（Azure Portal）
# 6. インデクサー再作成
python scripts/rag/create_indexer.py create
python scripts/rag/create_indexer.py run
```

### 問題: RAGで内容が取得できない

**チェック項目:**
1. `content`フィールドの `retrievable` が `true` か確認
2. 検索クエリで `select` パラメータに `content` が含まれているか確認

**修正手順:**
- `retrievable: false` の場合 → インデックス再作成
- クエリの問題 → `select` パラメータを修正

### 問題: 日本語の検索精度が低い

**チェック項目:**
1. `analyzer` が `ja.microsoft` に設定されているか確認
2. 検索クエリで適切なアナライザーが使用されているか確認

---

## 📝 インデックス定義の管理

### バージョン管理

**推奨ファイル構造:**
```
scripts/rag/
  ├── index-definition.json          # 最新の正式版
  ├── index-definition.backup.json   # バックアップ
  └── index-history/
      ├── index-definition-v1.json   # 初期バージョン
      └── index-definition-v2.json   # contentフィールド修正版
```

### 定義のエクスポート手順

1. **Azure Portal** → **search-concrete-questions-dev** → **インデックス**
2. **concrete-questions-index** を開く
3. 上部の「**JSON**」ボタンをクリック
4. JSON全体をコピー
5. `scripts/rag/index-definition.json` に保存
6. Git にコミット

```powershell
git add scripts/rag/index-definition.json
git commit -m "Update index definition: fix content field settings"
```

---

## 🎯 ベストプラクティス

### 1. フィールド設計の原則

✅ **DO:**
- 用途を明確にしてから設計する
- 不要な機能は無効化する（パフォーマンスとサイズ制約）
- RAG用フィールドは `retrievable: true` を必須とする
- ドキュメントに設計意図を残す

❌ **DON'T:**
- 全フィールドに `filterable/sortable/facetable: true` を設定しない
- 長文フィールドをソート可能にしない
- RAG用フィールドを `retrievable: false` にしない
- アナライザーを設定せずに日本語フィールドを作らない

### 2. テスト戦略

1. **小規模テスト**: 1ページのPDFで先にテスト
2. **中規模テスト**: 10-20ページで動作確認
3. **本番サイズテスト**: 100ページ以上で負荷確認
4. **エラーハンドリング**: 意図的にエラーを起こして挙動確認

### 3. 運用時の注意

- インデックス定義は必ずバージョン管理する
- 変更時は必ずバックアップを取る
- 本番環境での変更は慎重に（データ消失のリスク）
- 定期的にインデックス統計を確認（ドキュメント数、容量）

---

## 📚 参考情報

### Azure AI Search ドキュメント

- [フィールド属性の定義](https://learn.microsoft.com/ja-jp/azure/search/search-what-is-an-index#field-attributes)
- [サービス制限](https://learn.microsoft.com/ja-jp/azure/search/search-limits-quotas-capacity)
- [日本語アナライザー](https://learn.microsoft.com/ja-jp/azure/search/index-add-language-analyzers)

### 制限値

| 項目 | Standard Tier | 説明 |
|------|---------------|------|
| ドキュメントサイズ | 128 MB | 1つのPDFの最大サイズ |
| フィールド値（filterable） | 32 KB | フィルタ可能フィールドの最大サイズ |
| インデックス合計サイズ | 無制限 | ドキュメント数の制限はストレージ次第 |
| ベクトル次元数 | 3072 | ベクトルフィールドの最大次元数 |

---

## 🔄 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|----------|---------|--------|
| 2025-10-14 | v1.0 | 初版作成。contentフィールド32KB制限エラーの再発防止策を文書化 | - |

---

## まとめ

### 重要ポイント

1. **長文フィールドは `filterable/sortable/facetable: false`** にする
2. **RAG用フィールドは `retrievable: true`** を必須とする
3. **インデックス定義は必ずバージョン管理**する
4. **変更前に必ずバックアップ**を取る
5. **小規模テストから段階的に**検証する

このガイドに従うことで、インデックス設定に起因するエラーを防ぎ、安定したRAGシステムを構築できます。
