# GitHub Codespaces × Claude CodeでExpo/React Native開発：完全ガイド

## はじめに

Claude Codeは、Anthropic社が提供するAIコーディングアシスタントのCLIツールです。GitHub Codespacesと組み合わせることで、どこからでもAI支援の開発環境にアクセスできます。

例えば、以下のような状況で重宝します。

- バケーション先にデスクトップPCを持って行けない
- 会社PCは家で施錠保管が必要
- ローカル環境を汚さずにExpo/React Nativeの開発をしたい

この記事では、以下の内容を解説します：

- devcontainerを設定してClaude Codeを自動インストールする方法
- **VS Code Desktopからの接続方法**（GitHubを開く手間なし）
- **ポートフォワーディングの仕組み**と、なぜOAuth認証テストに必要なのか
- **Expo開発時の注意点**（モバイル実機テストの制限、メモリ問題など）

## 目次

1. [前提条件](#前提条件)
2. [devcontainer.jsonの設定](#devcontainerjsonの設定)
3. [GitHub Codespacesの設定](#github-codespacesの設定)
   - [Codespacesの有効化](#codespacesの有効化)
   - [Secrets（シークレット）の登録](#リポジトリ設定secretsシークレットの登録)
   - [マシンタイプの選択](#マシンタイプの選択)
   - [タイムアウト設定](#タイムアウト設定)
   - [無料枠と課金](#無料枠と課金)
   - [リージョン設定](#リージョン設定)
   - [Access and security（アクセス制御）](#access-and-securityアクセス制御)
   - [Editor preference（エディタ設定）](#editor-preferenceエディタ設定)
4. [Codespaceの起動](#codespaceの起動)
   - [方法A：ブラウザから起動](#方法aブラウザから起動)
   - [方法B：VS Codeデスクトップから接続（推奨）](#方法bvs-codeデスクトップから接続推奨)
   - [仕組み：VS Code Desktopはどう動いているのか？](#仕組みvs-code-desktopはどう動いているのか)
5. [Claude Codeの使用](#claude-codeの使用)
6. [claude-monitorでトークン使用量を確認](#claude-monitorでトークン使用量を確認)
7. [設定変更後のコンテナ再構築](#設定変更後のコンテナ再構築)
8. [Tips](#tips)
   - [Expo開発でCodespacesを使う場合](#expo開発でcodespacesを使う場合)
   - [なぜVS Code Desktop接続でもモバイル実機テストができないのか？](#なぜvs-code-desktop接続でもモバイル実機テストができないのか)
   - [ブラウザ版CodespacesではOAuth認証が動かない](#制限事項ブラウザ版codespacesではoauth認証が動かない)
   - [環境変数の設定](#環境変数の設定)
9. [トラブルシューティング](#トラブルシューティング)
10. [まとめ](#まとめ)
11. [参考リンク](#参考リンク)

## 前提条件

- GitHubアカウント
- Anthropic APIキー（Claude Codeのサブスクリプション）
- リポジトリへのアクセス権限

## devcontainer.jsonの設定

リポジトリのルートに`.devcontainer/devcontainer.json`を作成します。

```json
{
  "name": "Claude Code Env",
  "image": "mcr.microsoft.com/devcontainers/universal:2",

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-python.python",
        "GitHub.copilot",
        "eamodio.gitlens"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode"
      }
    }
  },

  "postCreateCommand": "npm install -g @anthropic-ai/claude-code && pip install claude-monitor",

  "containerEnv": {
    "TZ": "Asia/Tokyo"
  }
}
```

### devcontainer.jsonの役割

`devcontainer.json`は、**開発環境をコードとして定義するファイル**です。「開発環境の設計図」と考えると分かり易いです。

#### なぜ必要なのか？

| 課題                                 | devcontainer.jsonによる解決             |
| ------------------------------------ | --------------------------------------- |
| 「俺の環境では動くのに...」問題      | 全員が同じコンテナ環境を使用            |
| 新メンバーの環境構築に半日かかる     | `devcontainer.json`をpullするだけで完了 |
| 「あのツールをインストールし忘れた」 | `postCreateCommand`で自動インストール   |
| VS Codeの設定がバラバラ              | `customizations.vscode`で統一           |

#### 各設定項目の詳細解説

##### 1. `name` - コンテナの識別名

```json
"name": "Claude Code Env"
```

VS CodeやDockerで表示される名前です。プロジェクト名や用途が分かる名前を付けます。

##### 2. `image` - ベースとなるDockerイメージ

```json
"image": "mcr.microsoft.com/devcontainers/universal:2"
```

| イメージ             | 特徴                                        | ユースケース               |
| -------------------- | ------------------------------------------- | -------------------------- |
| `universal:2`        | Node.js, Python, Java, Go等プリインストール | 複数言語を使うプロジェクト |
| `javascript-node:20` | Node.js特化                                 | フロントエンド専用         |
| `python:3.11`        | Python特化                                  | データサイエンス、ML       |

`universal:2`は約4GBと大きいですが、追加インストールの手間が省けます。

##### 3. `customizations.vscode.extensions` - 自動インストールする拡張機能

```json
"customizations": {
  "vscode": {
    "extensions": [
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode",
      "GitHub.copilot"
    ]
  }
}
```

拡張機能ID（`publisher.extensionName`形式）を指定すると、コンテナ起動時に自動インストールされます。

**拡張機能IDの調べ方：**

1. VS Codeで拡張機能を検索
2. 拡張機能ページの「Identifier」をコピー

##### 4. `customizations.vscode.settings` - VS Codeの設定を統一

```json
"settings": {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

チーム全員で同じフォーマッター設定やエディタ動作を強制できます。

##### 5. `postCreateCommand` - コンテナ作成後に実行するコマンド

```json
"postCreateCommand": "npm install -g @anthropic-ai/claude-code && pip install claude-monitor && npm install"
```

**実行タイミング：**

```
コンテナイメージ取得 → コンテナ作成 → postCreateCommand実行 → 開発開始
                                    ↑ ここで実行される
```

複数コマンドは`&&`で連結します。失敗時に止めたい場合は`&&`、続行したい場合は`;`を使います。

##### 6. `forwardPorts` - ポートフォワーディング設定

```json
"forwardPorts": [8081, 8082, 19000, 19001, 19002]
```

コンテナ内の指定ポートを、ローカルの同じポート番号に自動転送します。

```
ローカルPC                     Codespacesコンテナ
localhost:8082  ←──────────→  :8082 (Expo Web)
localhost:8081  ←──────────→  :8081 (Metro Bundler)
```

##### 7. `portsAttributes` - ポートごとの詳細設定

```json
"portsAttributes": {
  "8081": {
    "label": "Metro Bundler",
    "onAutoForward": "silent"
  },
  "8082": {
    "label": "Expo Web",
    "onAutoForward": "openBrowser"
  }
}
```

| 属性            | 値            | 動作                     |
| --------------- | ------------- | ------------------------ |
| `label`         | 任意の文字列  | ポート一覧での表示名     |
| `onAutoForward` | `silent`      | 自動転送するが通知しない |
|                 | `notify`      | 転送時に通知を表示       |
|                 | `openBrowser` | 自動でブラウザを開く     |
|                 | `ignore`      | 自動転送しない           |

##### 8. `containerEnv` - 環境変数の設定

```json
"containerEnv": {
  "EXPO_DEVTOOLS_LISTEN_ADDRESS": "0.0.0.0",
  "TZ": "Asia/Tokyo"
}
```

コンテナ内で利用可能な環境変数を設定します。

| 変数                           | 用途                                   |
| ------------------------------ | -------------------------------------- |
| `TZ`                           | タイムゾーン（ログの時刻表示等に影響） |
| `EXPO_DEVTOOLS_LISTEN_ADDRESS` | Expoを外部からアクセス可能にする       |

#### ライフサイクルフック一覧

`postCreateCommand`以外にも、様々なタイミングでコマンドを実行できます。

```
┌─────────────────────────────────────────────────────────────────┐
│                     コンテナのライフサイクル                       │
├─────────────────────────────────────────────────────────────────┤
│  initializeCommand  → コンテナ作成前（ローカルで実行）            │
│        ↓                                                        │
│  onCreateCommand    → コンテナ作成直後（初回のみ）               │
│        ↓                                                        │
│  updateContentCommand → リポジトリ更新後                         │
│        ↓                                                        │
│  postCreateCommand  → 上記すべて完了後（初回のみ）★よく使う      │
│        ↓                                                        │
│  postStartCommand   → コンテナ起動時（毎回）                     │
│        ↓                                                        │
│  postAttachCommand  → VS Code接続時（毎回）                      │
└─────────────────────────────────────────────────────────────────┘
```

| フック              | 実行タイミング | ユースケース           |
| ------------------- | -------------- | ---------------------- |
| `postCreateCommand` | 初回のみ       | パッケージインストール |
| `postStartCommand`  | 起動ごと       | サービス起動           |
| `postAttachCommand` | 接続ごと       | 環境変数の再読み込み   |

### 設定のポイント（まとめ）

| 項目                | 説明                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `image`             | `universal:2`はNode.js、Python等がプリインストールされた汎用イメージ |
| `postCreateCommand` | コンテナ作成時に自動実行されるコマンド                               |
| `TZ`                | タイムゾーン設定（日本時間）                                         |

## GitHub Codespacesの設定

devcontainer.jsonでコンテナの中身を定義したら、次はGitHub側でCodespacesの設定を行います。

### Codespacesの有効化

GitHub Codespacesは、以下の条件で利用可能です：

| アカウント種別                  | 利用可否 | 無料枠                         |
| ------------------------------- | -------- | ------------------------------ |
| 個人アカウント（Free）          | ✅ 可能  | 月120コア時間 + 15GBストレージ |
| 個人アカウント（Pro）           | ✅ 可能  | 月180コア時間 + 20GBストレージ |
| Organization（Team/Enterprise） | ✅ 可能  | 組織の設定による               |

特別な有効化作業は不要で、リポジトリの「Code」ボタンから直接作成できます。

### リポジトリ設定：Secrets（シークレット）の登録

APIキーなどの機密情報は、Codespacesのシークレットとして登録します。

#### 設定手順

1. GitHubでリポジトリを開く
2. **Settings** → **Secrets and variables** → **Codespaces**
3. **New repository secret** をクリック
4. Name と Value を入力して保存

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repository Settings                                  │
│                                                              │
│  ├── Secrets and variables                                   │
│  │   ├── Actions          ← GitHub Actions用                │
│  │   ├── Codespaces       ← ★ここを使う                     │
│  │   └── Dependabot                                         │
└─────────────────────────────────────────────────────────────┘
```

#### 登録例

| Name                    | 用途                   |
| ----------------------- | ---------------------- |
| `CLERK_PUBLISHABLE_KEY` | Clerk認証の公開キー    |
| `EXPO_PUBLIC_API_URL`   | APIのベースURL         |
| `DATABASE_URL`          | データベース接続文字列 |

:::note warn
シークレットは**そのリポジトリのCodespacesでのみ**利用可能です。フォーク先では使えません。
:::

#### Codespaces内での参照

登録したシークレットは、Codespaces内で環境変数として自動的に利用可能になります：

```bash
# ターミナルで確認
echo $CLERK_PUBLISHABLE_KEY
```

### マシンタイプの選択

Codespace作成時に、マシンスペックを選択できます。

| マシンタイプ | CPU    | メモリ | ストレージ | 用途                         |
| ------------ | ------ | ------ | ---------- | ---------------------------- |
| 2-core       | 2コア  | 8GB    | 32GB       | 軽量な作業、ドキュメント編集 |
| 4-core       | 4コア  | 16GB   | 32GB       | 一般的な開発（**推奨**）     |
| 8-core       | 8コア  | 32GB   | 64GB       | ビルドが重いプロジェクト     |
| 16-core      | 16コア | 64GB   | 128GB      | 大規模プロジェクト、ML       |

#### 選択方法

1. 「Create codespace on main」の横にある **▼** をクリック
2. **Configure and create codespace** を選択
3. マシンタイプを選んで作成

```
┌─────────────────────────────────────────┐
│  Create codespace                        │
│                                         │
│  Branch: main                           │
│  Region: US West ▼                      │
│  Machine type: 4-core (16GB RAM) ▼     │
│                                         │
│  [Create codespace]                     │
└─────────────────────────────────────────┘
```

:::note info
Claude Codeを使う場合、**4-core以上**を推奨します。2-coreだとレスポンスが遅くなることがあります。
:::

### タイムアウト設定

Codespacesは、一定時間操作がないと自動的に停止します。

#### デフォルト設定の変更

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Codespaces**
3. **Default idle timeout** を変更（最大240分）

| 設定値             | 説明                     |
| ------------------ | ------------------------ |
| 30分（デフォルト） | 短時間の作業向け         |
| 60〜120分          | 一般的な開発作業         |
| 240分（最大）      | 長時間の作業、ビルド待ち |

#### 課金への影響

停止中のCodespacesは**ストレージ料金のみ**発生します。コンピューティング料金は停止中は発生しません。

```
┌─────────────────────────────────────────────────────────────┐
│                    課金の仕組み                              │
├─────────────────────────────────────────────────────────────┤
│  稼働中: コンピューティング料金 + ストレージ料金             │
│  停止中: ストレージ料金のみ                                  │
│  削除後: 課金なし                                            │
└─────────────────────────────────────────────────────────────┘
```

:::note alert
**重要：使い終わったら必ず手動で停止しましょう！**

自動停止を待つと、待機時間分のコンピューティング料金が発生します。4-coreマシンで30分放置すると、2コア時間（無料枠の約1.7%）を消費します。
:::

#### 手動での停止方法

**方法1：VS Code Desktop から**

1. 左下の「><」アイコンをクリック
2. 「Stop Current Codespace」を選択

**方法2：GitHub から**

1. [github.com/codespaces](https://github.com/codespaces) にアクセス
2. 該当のCodespaceの「...」メニュー → 「Stop codespace」

**方法3：コマンドパレットから**

1. `F1` または `Ctrl + Shift + P`
2. 「Codespaces: Stop Current Codespace」を選択

#### 不要になったCodespaceは削除

長期間使わないCodespaceは削除することで、ストレージ料金も節約できます。

1. [github.com/codespaces](https://github.com/codespaces) にアクセス
2. 該当のCodespaceの「...」メニュー → 「Delete」

:::note warn
削除すると、コミットしていない変更は失われます。必ず `git push` してから削除してください。
:::

### 無料枠と課金

#### 個人アカウントの無料枠（月あたり）

| プラン | コア時間 | ストレージ |
| ------ | -------- | ---------- |
| Free   | 120時間  | 15GB       |
| Pro    | 180時間  | 20GB       |

**コア時間の計算例：**

- 2-coreマシンを1時間使用 → 2コア時間消費
- 4-coreマシンを1時間使用 → 4コア時間消費

つまり、4-coreマシンなら月30時間（120÷4）使用可能です。

#### 使用量の確認

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Billing and plans**
3. **Codespaces** セクションで確認

### リージョン設定

Codespacesのリージョン（データセンターの場所）を設定できます。

| リージョン     | 場所           | 日本からのレイテンシ |
| -------------- | -------------- | -------------------- |
| US East        | アメリカ東部   | 高め                 |
| US West        | アメリカ西部   | 中程度               |
| Europe West    | ヨーロッパ西部 | 高め                 |
| Southeast Asia | シンガポール   | **低め（推奨）**     |

#### 設定方法

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Codespaces**
3. **Default region** を「Southeast Asia」に変更

:::note info
日本から使う場合は **Southeast Asia** を選ぶと、レスポンスが改善されることがあります。
:::

### Access and security（アクセス制御）

Codespaceから他のリポジトリへのアクセス権限を制御できます。

:::note warn
この設定は**Deprecated（非推奨）**となっていますが、理解しておくと便利です。
:::

#### 設定場所

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Codespaces**
3. **Access and security** セクション

#### 設定オプション

| 設定 | 動作 |
|------|------|
| **Disabled（デフォルト・推奨）** | 開いたリポジトリのみアクセス可能 |
| All repositories | 自分が所有する全リポジトリにアクセス可能 |
| Selected repositories | 選択したリポジトリのみアクセス可能 |

#### 「Disabled」に設定した場合の動作

```
Codespace（concrete_diagnosticianリポジトリ用）
│
├── ✅ concrete_diagnostician  ← アクセス可能（開いたリポジトリ）
│
├── ❌ your-other-repo-1       ← アクセス不可
├── ❌ your-other-repo-2       ← アクセス不可
└── ❌ private-notes           ← アクセス不可
```

#### 具体的な影響

| 操作 | Disabled設定時の結果 |
|------|---------------------|
| `git clone` 他の自分のリポジトリ | 認証エラー |
| `git submodule` 他リポジトリ参照 | 取得失敗 |
| npm/pip 自分のプライベートパッケージ | インストール失敗 |
| GitHub API で他リポジトリ操作 | 権限エラー |

#### 推奨設定

| ユースケース | 推奨設定 |
|-------------|---------|
| 単一リポジトリで完結する開発 | **Disabled**（セキュア・推奨）|
| 複数リポジトリを横断する開発 | All repositories または Selected |
| モノレポ・サブモジュール使用 | All repositories または Selected |

:::note info
ほとんどのプロジェクトは単一リポジトリで完結するため、**Disabled のままで問題ありません**。
:::

### Editor preference（エディタ設定）

Codespaceを開く際のデフォルトエディタを設定できます。

#### 設定場所

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Codespaces**
3. **Editor preference** セクション

#### 選択肢と比較

| エディタ | 特徴 | OAuth認証 | 推奨度 |
|----------|------|-----------|--------|
| **VS Code Desktop** | ローカルアプリで接続。ポートフォワーディングが使える | ✅ 動作する | ⭐⭐⭐ **推奨** |
| VS Code for the Web | ブラウザで完結。手軽に使える | ❌ 動作しない | ⭐⭐☆ |
| JupyterLab (Preview) | Notebook編集特化。データサイエンス向け | − | ⭐☆☆ |

#### なぜVS Code Desktopが推奨なのか？

| 観点 | VS Code Desktop | VS Code for the Web |
|------|-----------------|---------------------|
| **OAuth認証テスト** | ✅ localhost経由で動作 | ❌ URLミスマッチで失敗 |
| **パフォーマンス** | ✅ ネイティブで高速 | △ ブラウザの制約あり |
| **キーバインド** | ✅ ローカル設定をそのまま使用 | △ ブラウザのショートカットと競合することも |
| **拡張機能** | ✅ フル機能 | △ 一部制限あり |
| **オフライン時** | ✅ 再接続が容易 | △ タブを閉じると最初から |

:::note alert
**Expo/React Native開発でOAuth認証（Clerk、Google認証など）をテストする場合は、VS Code Desktop一択です。**

ブラウザ版CodespacesではポートフォワーディングがURL形式で行われるため、`localhost` を期待するOAuth設定と一致せず認証エラーになります。
:::

#### 設定方法

1. GitHub右上のアイコン → **Settings**
2. 左メニューの **Codespaces**
3. **Editor preference** で **Visual Studio Code** を選択

この設定により、Codespaceを起動すると自動的にVS Code Desktopが開くようになります。

## Codespaceの起動

### 方法A：ブラウザから起動

#### 手順

1. GitHubでリポジトリを開く
2. 緑色の **「<> Code」ボタン** をクリック
3. **「Codespaces」タブ** を選択
4. **「Create codespace on main」** をクリック

```
┌─────────────────────────────────────────────────────────────────────┐
│  github.com/your-username/your-repo                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Code ▼]  ← ①ここをクリック                                        │
│  ┌───────────────────────────────────┐                              │
│  │  Local    | Codespaces            │ ← ②このタブを選択            │
│  ├───────────────────────────────────┤                              │
│  │                                   │                              │
│  │  Codespaces                       │                              │
│  │                                   │                              │
│  │  Your codespaces                  │                              │
│  │  (No codespaces)                  │                              │
│  │                                   │                              │
│  │  ┌─────────────────────────────┐  │                              │
│  │  │ + Create codespace on main │  │ ← ③このボタンをクリック      │
│  │  └─────────────────────────────┘  │                              │
│  │                                   │                              │
│  │  ─────────────────────────────    │                              │
│  │  [...] ← オプション選択           │ ← マシンタイプ等を選ぶ場合   │
│  └───────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

#### マシンタイプを選んで作成する場合

デフォルト以外のマシンタイプを選びたい場合：

1. **「...」（三点リーダー）** をクリック
2. **「New with options...」** を選択
3. ブランチ、リージョン、マシンタイプを選択
4. **「Create codespace」** をクリック

#### 初回起動時の流れ

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Codespace作成の流れ（初回）                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ① Dockerイメージの取得        （universal:2は約4GB、数分かかる）   │
│        ↓                                                            │
│  ② コンテナの作成・起動                                             │
│        ↓                                                            │
│  ③ postCreateCommand実行       （Claude Code等のインストール）      │
│        ↓                                                            │
│  ④ VS Code (ブラウザ版) が開く                                      │
│        ↓                                                            │
│  ⑤ 開発開始！                                                       │
│                                                                      │
│  ※ 初回は5〜10分程度かかることがあります                            │
│  ※ 2回目以降は数十秒で起動します                                    │
└─────────────────────────────────────────────────────────────────────┘
```

初回起動時は`postCreateCommand`が実行され、Claude Codeが自動的にインストールされます。

### 方法B：VS Codeデスクトップから接続（推奨）

VS Codeデスクトップアプリから直接Codespacesに接続できます。**GitHubを開く手間なく、VS Codeから直接起動・接続できる**のが大きなメリットです。

#### 事前準備：拡張機能のインストール

VS Codeに「GitHub Codespaces」拡張機能をインストールします：

1. VS Codeの拡張機能パネル（`Ctrl + Shift + X`）を開く
2. 「GitHub Codespaces」を検索
3. Microsoft公式の拡張機能をインストール

#### 接続手順

1. VS Code左下の **「><」アイコン** をクリック
2. **「Connect to Codespace...」** を選択
3. GitHubアカウントで認証（初回のみ）
4. 接続したいCodespaceを選択、または「Create New Codespace...」で新規作成

#### VS Codeデスクトップ接続のメリット

| メリット                   | 説明                                                      |
| -------------------------- | --------------------------------------------------------- |
| ワンクリック接続           | GitHubを開かずにVS Codeから直接起動・接続                 |
| ネイティブ体験             | ブラウザ版より高速で、ローカル開発と同じ操作感            |
| ローカル設定の活用         | キーバインドやテーマなど、既存のVS Code設定をそのまま使用 |
| 複数Codespace管理          | サイドバーから複数のCodespaceを簡単に切り替え             |
| **編集の即時反映**         | ローカルでの編集がクラウドに即座に同期される              |
| **ポートフォワーディング** | `localhost` でクラウド上のアプリにアクセス可能            |

#### 仕組み：VS Code Desktopはどう動いているのか？

VS Code DesktopからCodespacesに接続すると、以下のような構成で動作します。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        あなたのPC（ローカル）                            │
│  ┌─────────────────────┐                                                │
│  │   VS Code Desktop   │                                                │
│  │  ┌───────────────┐  │      ┌──────────────────┐                      │
│  │  │ エディタ画面  │──────────│ファイル編集が    │                      │
│  │  │               │  │  即時 │クラウドに即反映  │                      │
│  │  └───────────────┘  │  同期 └──────────────────┘                      │
│  │  ┌───────────────┐  │                                                │
│  │  │ ターミナル    │──────────→ クラウドで実行                         │
│  │  └───────────────┘  │                                                │
│  └──────────┬──────────┘                                                │
│             │ ポートフォワーディング                                     │
│             ↓                                                           │
│  ┌──────────────────────────┐                                           │
│  │ http://localhost:8082   │ ← ブラウザでアクセス可能                   │
│  └────────────┬─────────────┘                                           │
└───────────────│─────────────────────────────────────────────────────────┘
                │ SSHトンネル（暗号化）
                ↓
┌───────────────────────────────────────────────────────────────────────────┐
│                    GitHub Codespaces（クラウド）                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         コンテナ                                     │ │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐        │ │
│  │  │ ソースコード  │    │ Node.js       │    │ Claude Code   │        │ │
│  │  │ (リポジトリ)  │    │ Python 等     │    │               │        │ │
│  │  └───────────────┘    └───────────────┘    └───────────────┘        │ │
│  │                                                                      │ │
│  │  ┌───────────────────────────────────────┐                          │ │
│  │  │ Expo Web アプリ (:8082)               │ ← ここで動いている       │ │
│  │  └───────────────────────────────────────┘                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

##### ポイント

| 機能                       | 説明                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| **ファイル編集**           | VS Codeで編集 → 即座にクラウドのファイルに反映（遅延なし）              |
| **ターミナル**             | VS Codeのターミナル = クラウドのシェル（`claude` コマンドもここで実行） |
| **ポートフォワーディング** | クラウドの `:8082` を `localhost:8082` にマッピング                     |

つまり、**ローカルで開発しているのとまったく同じ感覚**で、実際にはクラウド上のマシンを操作しています。

#### 既存のCodespaceに再接続

一度作成したCodespaceには、次回以降さらに簡単に接続できます：

1. VS Codeを起動
2. 左下の「><」アイコン → 「Connect to Codespace...」
3. 既存のCodespaceが一覧表示されるので選択

停止中のCodespaceも自動的に起動されます。

## Claude Codeの使用

### 初回セットアップ

ターミナルで以下を実行してログインします：

```bash
claude
```

ブラウザが開き、Anthropicアカウントで認証を行います。

### 基本的な使い方

```bash
# 対話モードで起動
claude

# 特定のプロンプトを実行
claude "このプロジェクトの構造を説明して"

# ファイルを指定して質問
claude "このファイルのバグを見つけて" src/index.ts
```

## claude-monitorでトークン使用量を確認

[claude-monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor)を使うと、トークン使用量をリアルタイムでモニタリングできます。

```bash
# 起動（以下のコマンドはすべて同じ）
claude-monitor
cmonitor
ccmonitor
ccm
```

表示例：

```
📊 Session-Based Dynamic Limits
────────────────────────────────────────────────────────────
💰 Cost Usage:           🟢 [░░░░░░░░░░]  0.1%    $0.15 / $200.00
📊 Token Usage:          🟢 [░░░░░░░░░░]  0.0%    8 / 19,000
📨 Messages Usage:       🟢 [░░░░░░░░░░]  0.8%    2 / 250
────────────────────────────────────────────────────────────
```

## 設定変更後のコンテナ再構築

`devcontainer.json`を変更した場合は、コンテナの再構築が必要です。

### 方法A：画面左下のボタンから（推奨）

1. VS Code左下の **「><」アイコン** をクリック
2. **「Rebuild Container」** を選択

### 方法B：コマンドパレットから

1. `F1` または `Ctrl + Shift + P` を押す
2. `Codespaces: Rebuild Container` を選択

## Tips

### Expo開発でCodespacesを使う場合

#### 制限事項：モバイル実機テストは困難

Codespacesはクラウド上で動作するため、**モバイル実機からMetro Bundlerに直接接続できません**。

ngrokの`--tunnel`モードを使えば理論上は可能ですが、Codespaces環境ではngrokが不安定で接続タイムアウトが頻発します。

```bash
# これはCodespacesでは動作しないことが多い
npx expo start --tunnel --clear
# → CommandError: ngrok tunnel took too long to connect.
```

#### 推奨する使い分け

| 環境                                  | Expo Web (ブラウザ) | Expo Go (モバイル実機) | OAuth認証 |
| ------------------------------------- | ------------------- | ---------------------- | --------- |
| **Codespaces（ブラウザ版）**          | ✅ 可能             | ❌ 不可                | ❌ 不可   |
| **Codespaces（VS Code Desktop接続）** | ✅ 可能             | ❌ 不可                | ✅ 可能   |
| **ローカル環境**                      | ✅ 可能             | ✅ 可能                | ✅ 可能   |

#### なぜVS Code Desktop接続でもモバイル実機テストができないのか？

「VS Code Desktopならポートフォワーディングできるのに、なぜExpo Goでのモバイル実機テストはできないの？」という疑問があるかもしれません。

理由は、**ポートフォワーディングの方向が「PCのブラウザ向け」だから**です。

```
【ポートフォワーディングの方向】

クラウド(:8082) ──→ SSHトンネル ──→ あなたのPC(localhost:8082)
                                          ↑
                                    PCのブラウザからはアクセス可能 ✅
```

##### モバイル端末からはアクセスできない理由

```
┌─────────────────────────────────────────────────────────┐
│  あなたのPC                                              │
│  ┌─────────────────┐                                    │
│  │ localhost:8082  │ ← PCのブラウザからはOK ✅          │
│  └─────────────────┘                                    │
│  （このポートは外部に公開されていない）                   │
└─────────────────────────────────────────────────────────┘
                ↑
                │ アクセス不可 ❌
                │
┌─────────────────────────────────────────────────────────┐
│  スマートフォン（別デバイス）                            │
│  ┌─────────────────────────────────────────┐            │
│  │ Expo Go アプリ                          │            │
│  │                                         │            │
│  │ localhost:8082 → スマホ自身を指す       │            │
│  │ PCのIP:8082    → トンネルは外部非公開   │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

| 問題点             | 説明                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `localhost` の意味 | スマホで `localhost` はスマホ自身を指す（PCではない）                      |
| PCのIPアドレス指定 | ポートフォワーディングはPC内部のみ有効で、外部デバイスには公開されていない |

:::note warn
モバイル実機テストが必要な場合は、ローカル環境から `npx expo start` を実行してください。
:::

#### 制限事項：ブラウザ版CodespacesではOAuth認証が動かない

ブラウザ版のCodespacesでGoogle認証やClerk認証をテストしようとすると、エラーになります。

一言で言うと、**「セキュリティの『住所チェック』に引っかかるから」**です。

##### 理由：URLが一致しない問題

GoogleやClerkなどのOAuth認証は、セキュリティのため**「あらかじめ登録されたURL以外からのログインを拒否する」**という厳しいルールがあります。

| 項目                                | 内容                                      |
| ----------------------------------- | ----------------------------------------- |
| **登録済みURL**                     | `http://localhost:8082`                   |
| **ブラウザ版Codespacesの実際のURL** | `https://random-name-8082.app.github.dev` |

ブラウザ版CodespacesのURLはランダムに生成されるため、OAuth側に登録されておらず「知らないサイトからのアクセスだ！」と門前払いされます。

##### なぜVS Code Desktopなら解決するのか？

VS Code Desktopには**「ポートフォワーディング」**機能があり、これが「どこでもドア」のように働きます。

以下の図で、ブラウザ版とVS Code Desktop版の違いを比較してみましょう。

```
【ブラウザ版Codespaces】❌ 認証エラー

┌─────────────────┐      ┌─────────────────────────────────┐
│   OAuth設定     │      │        ブラウザ                  │
│                 │      │  ┌─────────────────────────┐    │
│ 許可リスト:     │      │  │ https://random-name-    │    │
│ ・localhost:8082│  ✗   │  │   8082.app.github.dev   │    │
│                 │←──×──│  │                         │    │
│ 「知らないURL   │ 拒否  │  │  「許可リストにない！」  │    │
│  からのアクセス │      │  └─────────────────────────┘    │
│  は拒否する」   │      │                                  │
└─────────────────┘      └─────────────────────────────────┘


【VS Code Desktop接続】✅ 認証成功

┌─────────────────┐      ┌─────────────────────────────────┐
│   OAuth設定     │      │   あなたのPC                     │
│                 │      │  ┌─────────────────────────┐    │
│ 許可リスト:     │      │  │ http://localhost:8082   │    │
│ ・localhost:8082│  ✓   │  │                         │    │
│                 │←──○──│  │ 「許可リストと一致！」   │    │
│                 │ 許可  │  └───────────┬─────────────┘    │
│                 │      │              │ ポートフォワード  │
└─────────────────┘      │              ↓                  │
                         │  ┌─────────────────────────┐    │
                         │  │ VS Code Desktop         │    │
                         │  │ (SSHトンネルで接続)     │    │
                         │  └───────────┬─────────────┘    │
                         └──────────────│──────────────────┘
                                        │
                                        ↓ 実際はクラウドで動作
                         ┌─────────────────────────────────┐
                         │   GitHub Codespaces             │
                         │  ┌─────────────────────────┐    │
                         │  │ Expo Web (:8082)        │    │
                         │  └─────────────────────────┘    │
                         └─────────────────────────────────┘
```

##### 流れのまとめ

1. クラウド上のCodespacesでアプリが `:8082` で動く
2. VS Code Desktopがクラウドの `:8082` とPCの `localhost:8082` を直結
3. PCで `http://localhost:8082` にアクセスすると、トンネル経由でクラウドに接続
4. OAuthプロバイダーから見ると `localhost:8082` からのアクセスに見える

**結果:** クラウド上のアプリを**「localhost で動いている」かのように見せかけられる**ため、OAuth設定を変更せずに認証テストが通ります。

:::note info
VS Code Desktop接続は、OAuth認証テストを行うNativeアプリ開発では必須です。
:::

#### CodespacesでのExpo Web確認

ブラウザでUIを確認する場合は問題なく動作します：

```bash
npx expo start --web --clear
```

#### モバイル実機テストはローカルで

モバイル端末でテストする場合は、ローカル環境（Windows PowerShell等）から実行してください：

```powershell
# Windows PowerShellで実行
cd C:\path\to\your\project
npx expo start
```

同じWiFiネットワーク上でQRコードをスキャンすれば接続できます。

#### devcontainer.jsonのポート設定（参考）

Expo Webを使う場合のポート設定：

```json
// devcontainer.json
{
  "forwardPorts": [8081, 8082, 19000, 19001, 19002],
  "portsAttributes": {
    "8081": { "label": "Metro Bundler", "onAutoForward": "silent" },
    "8082": { "label": "Expo Web", "onAutoForward": "openBrowser" }
  }
}
```

### 環境変数の設定

機密情報はCodespacesのSecretsで管理します：

1. リポジトリの「Settings」→「Secrets and variables」→「Codespaces」
2. 「New repository secret」でシークレットを追加

## トラブルシューティング

### Claude Codeがインストールされない

`postCreateCommand`が正しく実行されたか確認：

```bash
which claude
```

見つからない場合は手動でインストール：

```bash
npm install -g @anthropic-ai/claude-code
```

### タイムゾーンがおかしい

`containerEnv`に`TZ`が設定されているか確認し、コンテナを再構築してください。

### 認証エラーが出る

```bash
claude logout
claude
```

で再認証を試みてください。

### VS Code Desktopからの接続が頻繁に切れる

VS Code DesktopからCodespacesへの接続が頻繁に切れる場合、ネットワークの問題よりも**「メモリ不足（メモリオーバー）」**が原因である可能性が非常に高いです。

特にReact Native (Expo) の開発は、ビルドツール（Metro Bundler）が大量のメモリを消費するため、Codespacesの標準スペック（2コア / 4GBメモリ）では限界を超えやすいです。

#### 原因1：メモリ不足（RAM枯渇）【最も多い】

`npm run dev` や `npx expo start` を実行した瞬間や、ファイル保存時（ビルドが走る時）に切れる場合、ほぼこれが原因です。

```
┌─────────────────────────────────────────────────────────────────────┐
│                    メモリ不足で切断が起きる仕組み                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Metro Bundler起動 → メモリ使用量急増 → RAM上限に到達               │
│                                            ↓                        │
│                        Linux (CodespacesのOS) がシステム保護のため   │
│                        メモリを食っているプロセスを強制終了           │
│                                            ↓                        │
│                        VS Code ServerやNode.jsが落ちる               │
│                                            ↓                        │
│                        「接続が切れました」として見える               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**【対策】マシンタイプを変更する（推奨）**

1. ブラウザでGitHubのリポジトリを開く
2. 緑の `<> Code` ボタン → `Codespaces` タブ
3. 稼働中のCodespaceの右側の `...` をクリック
4. **「Change machine type」** を選択
5. **4コア / 16GB RAM** 以上に変更

:::note warn
マシンタイプを上げると無料枠の消費が早くなります。4-coreは2-coreの2倍速で消費されます。
:::

#### 原因2：プロセスの暴走

裏で古いExpoのプロセスが残ったまま新しいExpoを起動すると、衝突して負荷が倍増します。

**【対策】切断から復帰後は掃除してから起動**

```bash
# 1. 動いているNodeプロセスを止める
pkill -f node

# 2. キャッシュをクリアして起動
npx expo start --clear
```

#### 原因3：拡張機能の競合

VS Code Desktopの拡張機能が、Codespaces側と通信しすぎて詰まっている可能性があります。

**【対策】ブラウザ版Codespacesで作業する**

ブラウザ版は通信の仕組みがシンプル（直接接続）なため、Desktop版より安定することがあります。

「デスクトップが頻繁に切れるなら、今日はブラウザ版で凌ぐ」というのも有効な手です。

#### まとめ：接続が切れる場合のチェックリスト

| 優先度 | 対策 | 効果 |
|--------|------|------|
| ★★★ | マシンタイプを **4-core (16GB RAM)** 以上に変更 | 根本解決 |
| ★★☆ | 起動コマンドに `--clear` をつける | キャッシュ処理を軽減 |
| ★★☆ | 起動前に `pkill -f node` で掃除 | プロセス競合を防止 |
| ★☆☆ | ブラウザ版Codespacesを使う | 一時的な回避策 |

## まとめ

GitHub CodespacesとClaude Codeを組み合わせることで、以下のメリットが得られます：

- どこからでもAI支援の開発環境にアクセス可能
- チーム全員が同じ開発環境を使用できる
- ローカルマシンのスペックに依存しない

devcontainer.jsonを一度設定すれば、Codespaceを起動するだけでClaude Codeがすぐに使える環境が整います。

## 参考リンク

- [Claude Code 公式ドキュメント](https://docs.anthropic.com/claude-code)
- [GitHub Codespaces ドキュメント](https://docs.github.com/ja/codespaces)
- [claude-monitor (PyPI)](https://pypi.org/project/claude-monitor/)
- [Dev Containers 仕様](https://containers.dev/)
