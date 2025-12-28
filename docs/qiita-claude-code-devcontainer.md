# GitHub CodespacesでClaude Codeを使う方法

## はじめに

Claude Codeは、Anthropic社が提供するAIコーディングアシスタントのCLIツールです。GitHub Codespacesと組み合わせることで、どこからでもAI支援の開発環境にアクセスできます。

この記事では、devcontainerを設定してClaude Codeを自動インストールする方法を解説します。

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

### 設定のポイント

| 項目 | 説明 |
|------|------|
| `image` | `universal:2`はNode.js、Python等がプリインストールされた汎用イメージ |
| `postCreateCommand` | コンテナ作成時に自動実行されるコマンド |
| `TZ` | タイムゾーン設定（日本時間） |

## Codespaceの起動

1. GitHubでリポジトリを開く
2. 緑色の「Code」ボタンをクリック
3. 「Codespaces」タブを選択
4. 「Create codespace on main」をクリック

初回起動時は`postCreateCommand`が実行され、Claude Codeが自動的にインストールされます。

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

| 環境 | 用途 |
|------|------|
| **Codespaces** | コード編集、Claude Code使用、Expo Web確認 |
| **ローカル環境** | モバイル実機テスト |

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
