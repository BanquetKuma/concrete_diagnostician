# Task 001: Turso アカウント作成・データベース構築

## 基本情報

| 項目 | 内容 |
|------|------|
| Phase | 4 - バックエンド構築 |
| 工数 | 1時間 |
| 依存タスク | なし |
| 成果物 | Turso アカウント、データベース |

---

## 目的

Turso (SQLite Edge Database) のアカウントを作成し、アプリ用のデータベースを構築する。

---

## 手順

### 1. Turso CLI インストール

```bash
# macOS / Linux / Windows (WSL)
curl -sSfL https://get.tur.so/install.sh | bash

# インストール後、現在のターミナルでTursoを有効化
source ~/.bashrc

# インストール確認
turso --version
```

※ 新しいターミナルを開く場合は `source ~/.bashrc` は不要

### 2. アカウント作成・ログイン

```bash
# ブラウザでログイン（GitHub連携推奨）
turso auth login
```

### 3. データベース作成

```bash
# データベース作成
turso db create concrete-diagnostician

# 作成確認
turso db list
```

### 4. 接続情報取得

```bash
# データベースURL取得
turso db show concrete-diagnostician --url

# 認証トークン作成
turso db tokens create concrete-diagnostician
```

### 5. 環境変数設定

`.env.turso` ファイルを作成:

```bash
TURSO_DATABASE_URL=libsql://concrete-diagnostician-xxxxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

---

## 完了条件

- [x] Turso CLI インストール完了
- [x] アカウント作成・ログイン完了
- [x] `concrete-diagnostician` データベース作成完了
- [x] 接続URL・認証トークン取得完了
- [x] `.env.turso` ファイル作成完了

---

## 📚 学習ポイント

### What: Tursoとは何か

Tursoは **SQLite互換のエッジデータベース** サービス。従来のクラウドデータベース（PostgreSQL, MySQL）と異なり、ユーザーに近いエッジロケーションでデータを提供する。

### Why: なぜTursoを選んだか

| 観点 | Turso | 従来のDB (PostgreSQL等) |
|------|-------|------------------------|
| レイテンシ | エッジで低遅延 | リージョン依存 |
| コスト | 無料枠9GB | 有料が多い |
| スケール | 自動 | 設定必要 |
| 学習コスト | SQLite互換で低い | 各DB固有の知識必要 |

モバイルアプリでは **低レイテンシ** が重要。Tursoはグローバルに分散配置されたエッジDBなので、日本からでも高速にアクセス可能。

### How: 内部の仕組み

```
[モバイルアプリ]
    ↓ HTTPS
[Cloudflare Workers]
    ↓ libSQL プロトコル
[Turso Edge DB] ← SQLite互換
    ↓ 自動レプリケーション
[複数エッジロケーション]
```

- **libSQL**: SQLiteのフォークで、ネットワーク対応を追加
- **エッジレプリケーション**: データが自動的に複数拠点に複製される
- **JWT認証**: トークンベースでセキュアにアクセス

### Tips: 実践的なアドバイス

1. **トークンの有効期限**: デフォルトで無期限だが、本番では期限付きを推奨
   ```bash
   turso db tokens create concrete-diagnostician --expiration 30d
   ```

2. **複数環境の管理**: 開発/本番でDBを分ける
   ```bash
   turso db create concrete-diagnostician-dev
   turso db create concrete-diagnostician-prod
   ```

3. **バックアップ**: Tursoは自動バックアップだが、エクスポートも可能
   ```bash
   turso db shell concrete-diagnostician .dump > backup.sql
   ```

---

## 参考リンク

- [Turso 公式サイト](https://turso.tech/)
- [Turso CLI ドキュメント](https://docs.turso.tech/cli/introduction)

---

## 次のタスク

→ [task002-turso-schema-setup.md](./task002-turso-schema-setup.md)
