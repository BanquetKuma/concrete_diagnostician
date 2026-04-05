# RAGチャットボット機能 要件定義書

**作成日**: 2026-04-06
**対象バージョン**: v1.1.0（予定）
**ステータス**: 実装完了（コード）／手動設定・リリース待ち

---

## 1. 概要

コンクリート診断士試験対策アプリに、教科書PDFを知識源とするAIチャットボット機能を追加する。学習者が問題演習中に生じた疑問を即座に教科書ベースで解消できる学習体験を提供する。

### 1.1 解決する課題

| ユーザーの課題 | 本機能による解決 |
|---|---|
| 問題を解いた後、不明点を調べるために教科書を開くのが手間 | アプリ内で質問するだけで教科書に基づく回答が得られる |
| 参考書が手元にないスキマ時間でも疑問を解消したい | スマホ1台で完結する学習アシスタント |
| 専門用語や概念の関連性を体系的に理解したい | 対話形式で深掘り質問ができる |

### 1.2 スコープ

**本フェーズで実装すること**
- 教科書PDFを知識源としたRAGチャットボット
- 独立タブからの汎用的な質問
- 問題詳細画面からコンテキスト付きで質問
- 新規課金プラン（Premium）の追加
- 1日・月単位の送信制限

**スコープ外（将来対応）**
- 回答のストリーミング表示
- 引用・出典表示
- 会話履歴のデバイス/サーバー永続化
- 画像・音声入力
- 複数モデル切替

---

## 2. 技術設計サマリ

### 2.1 RAG方式: Gemini File Search API

本機能のRAG（検索拡張生成）は、Google が提供する **Gemini File Search API** を利用する。
公式ドキュメント: https://ai.google.dev/gemini-api/docs/file-search?hl=ja

**採用理由**:
- Google 側が管理するマネージド・ベクトルストアを使うため、埋め込み計算・チャンキング・類似度検索を自前実装する必要がない
- `generateContent` 呼び出しに `file_search` ツールを付けるだけで自動的に関連箇所を参照した回答が生成される
- 既存の問題生成スクリプトと同じインフラを流用できる

**呼び出し方（本実装の例）**:
```ts
tools: [{
  file_search: {
    file_search_store_names: [
      'fileSearchStores/concretediagnosticiantextbo-0uzz0ql8wznf'
    ]
  }
}]
```

### 2.2 既存RAG基盤の流用

| 項目 | 値 |
|---|---|
| File Search Store | `fileSearchStores/concretediagnosticiantextbo-0uzz0ql8wznf` |
| 教科書PDF | `data/concrete_diagnostician_2024_part01-10.pdf`（10分割、508ページ、352.5MB） |
| モデル | `gemini-2.5-pro` |
| API エンドポイント | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |

既存の問題生成スクリプト（`scripts/gemini_rag/generate_questions.py`）と同じFile Search Storeを再利用するため、追加のデータ準備は不要。

### 2.2 アーキテクチャ

```
[Chatタブ]            [問題詳細画面: AIに質問ボタン]
     │                            │
     └─────────┬──────────────────┘
               ▼
          useChatbot ──── useChatAccess (Premium判定)
               │
               ▼
        apiClient.postChat()
               │
               ▼
   POST /api/chat (Cloudflare Workers)
     ├─ レート制限チェック (Turso: chat_usage)
     ├─ Gemini REST API 呼び出し
     │    └─ File Search Tool で教科書を参照
     └─ 使用量を +1 し返却
               │
               ▼
     { reply, usage: { dailyUsed, dailyLimit,
                       monthlyUsed, monthlyLimit } }
```

---

## 3. 機能要件

### F-CHAT-01: チャットタブ

| 項目 | 要件 |
|---|---|
| F-CHAT-01-01 | タブバーに「AIチャット」タブを追加する（順序：ホーム / 統計 / AIチャット / Pro版） |
| F-CHAT-01-02 | 非Premium会員には Premium プランへの誘導カードを表示する |
| F-CHAT-01-03 | チャット画面は以下の要素で構成する：ヘッダー（使用量表示）、メッセージリスト、入力欄 |
| F-CHAT-01-04 | 初回表示時は空の状態案内（質問例 4 件）を表示する |
| F-CHAT-01-05 | 質問例タップで即時送信できる |
| F-CHAT-01-06 | メッセージ送信後、リストを自動で末尾にスクロールする |

### F-CHAT-02: 問題画面からの呼び出し

| 項目 | 要件 |
|---|---|
| F-CHAT-02-01 | 問題に解答した後、「💬 AIに質問する」ボタンを表示する |
| F-CHAT-02-02 | ボタンタップ時、問題本文をコンテキストとしてチャット画面に渡す |
| F-CHAT-02-03 | 非Premium会員がタップした場合はサブスクリプション画面へ誘導する（ボタンラベルに「Premium限定」を付記） |
| F-CHAT-02-04 | 年度別問題画面・分野別問題画面の両方で利用可能にする |

### F-CHAT-03: 会話管理

| 項目 | 要件 |
|---|---|
| F-CHAT-03-01 | 会話履歴はセッション内（メモリ）のみで保持する |
| F-CHAT-03-02 | 画面遷移で履歴はリセットされる |
| F-CHAT-03-03 | APIリクエスト時は直近 10 往復の履歴を送信する（トークン数削減のため） |
| F-CHAT-03-04 | 1メッセージは最大 2,000 文字に制限する |

### F-CHAT-04: レート制限

| 項目 | 要件 |
|---|---|
| F-CHAT-04-01 | 1ユーザーあたり 1日 15 通、月 300 通を上限とする |
| F-CHAT-04-02 | 上限到達時は HTTP 429 を返し、画面にその旨を表示する |
| F-CHAT-04-03 | 使用量は Turso DB の `chat_usage` テーブルで管理する |
| F-CHAT-04-04 | 月次カウントは `date LIKE 'YYYY-MM-%'` で日次レコードを集計する |
| F-CHAT-04-05 | 使用量はレスポンスに含めて返却し、UIで可視化する（本日 N/15・今月 N/300） |

### F-CHAT-05: 課金（Premium プラン）

| 項目 | 要件 |
|---|---|
| F-CHAT-05-01 | 新規 RevenueCat entitlement `premium` を定義する |
| F-CHAT-05-02 | Premium は Pro の上位プランとして、Pro の全機能 + AIチャットを提供する |
| F-CHAT-05-03 | Premium会員は `isProMember=true` として扱う（上位互換） |
| F-CHAT-05-04 | 既存Pro会員は Premium に自動移行しない（別プランとして販売） |
| F-CHAT-05-05 | Premium 契約状態を Expo SecureStore にキャッシュし、オフライン時も判定可能にする |
| F-CHAT-05-06 | 販売価格は **¥980/月**（月額サブスクリプション）とする |

---

## 4. 非機能要件

### 4.1 セキュリティ

| 項目 | 要件 |
|---|---|
| SEC-01 | Gemini API キーはクライアントに含めず、Cloudflare Workers のシークレットとして管理する |
| SEC-02 | ユーザー入力は Workers 側で長さ検証（≤2,000文字）を行う |
| SEC-03 | API キーが漏洩した場合は即座にローテーション可能な設計とする |

### 4.2 パフォーマンス

| 項目 | 要件 |
|---|---|
| PERF-01 | メッセージ送信からの初回レスポンス受信まで 10秒以内を目標とする（Gemini 2.5 Pro の応答時間に依存） |
| PERF-02 | レート制限チェックのDB読み書きは 500ms 以内に完了させる |

### 4.3 運用・コスト

| 項目 | 要件 |
|---|---|
| OPS-01 | 1メッセージあたりの API コスト概算：約 ¥1.8（入出力 + File Search） |
| OPS-02 | 1ユーザー月300通 × ¥1.8 = 最悪 ¥540／月。¥980/月 × (1−30%) = 手取り ¥686 で黒字確保 |
| OPS-03 | 使用量メトリクスをリリース後に継続監視し、上限を調整する |

---

## 5. データ設計

### 5.1 Turso DB: `chat_usage` テーブル（新規）

```sql
CREATE TABLE IF NOT EXISTS chat_usage (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,        -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

- 本番の Turso DB では、Workers 側の `ensureTable()` が初回アクセス時に自動作成する
- 月次集計は `SELECT SUM(count) WHERE user_id = ? AND date LIKE 'YYYY-MM-%'`

### 5.2 API 型定義

**リクエスト** `POST /api/chat`
```ts
{
  userId: string;
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  questionContext?: string;
}
```

**レスポンス**
```ts
{
  reply: string;
  usage: {
    dailyUsed: number;
    dailyLimit: 15;
    monthlyUsed: number;
    monthlyLimit: 300;
  };
}
```

**エラー**（429）
```ts
{
  error: 'daily_limit_exceeded' | 'monthly_limit_exceeded';
  message: string;
  usage: { ... };
}
```

---

## 6. ファイル構成

### 6.1 新規ファイル

**バックエンド（Cloudflare Workers）**
- `workers/src/routes/chat.ts` — `/api/chat` エンドポイント
- `workers/src/lib/gemini.ts` — Gemini REST API 呼び出しラッパー
- `workers/src/types/chat.ts` — 型定義

**フロントエンド（Expo / React Native）**
- `app/(tabs)/chat.tsx` — チャットタブ画面
- `components/chat/ChatMessage.tsx` — メッセージ吹き出し
- `components/chat/ChatInput.tsx` — 入力欄
- `components/chat/ChatEmptyState.tsx` — 空状態（質問例）
- `hooks/useChatbot.ts` — セッション内状態管理
- `hooks/useChatAccess.ts` — Premium 判定

### 6.2 編集ファイル

- `workers/src/index.ts` — ルート追加、Bindings 追加
- `workers/wrangler.toml` — シークレット設定コメント
- `contexts/RevenueCatContext.tsx` — `isPremiumMember` 追加
- `lib/api/client.ts` — `postChat()` 追加
- `lib/api/config.ts` — チャットエンドポイント追加
- `lib/types/index.ts` — チャット関連型追加
- `app/(tabs)/_layout.tsx` — Chat タブ登録
- `components/ui/IconSymbol.tsx` — `ellipsis.bubble.fill` 等のアイコン追加
- `app/questions/[year]/[questionId].tsx` — 「AIに質問」ボタン追加
- `app/questions/category/[category]/[questionId].tsx` — 同上

---

## 7. リリース前チェックリスト

### 7.1 手動設定（コード外）

- [ ] Workers シークレット設定
  ```bash
  cd workers
  wrangler secret put GOOGLE_API_KEY
  wrangler secret put FILE_SEARCH_STORE_NAME
  wrangler secret put GEMINI_MODEL
  ```
- [ ] Workers デプロイ：`npx wrangler deploy`
- [ ] RevenueCat ダッシュボードで entitlement `premium` を作成
- [ ] App Store Connect で Premium サブスクリプション商品を作成（¥980/月）
- [ ] RevenueCat の offering に Premium 商品を紐付け
- [ ] `app.json` の `version` を 1.0.4 → 1.1.0 にインクリメント

### 7.2 動作確認

- [ ] `curl -X POST https://concrete-diagnostician-api.banquet-kuma.workers.dev/api/chat` でレスポンス確認
- [ ] レート制限の 429 レスポンス確認（16通目で上限到達）
- [ ] Chat タブ表示（非Premiumで誘導、Premiumで利用可能）
- [ ] 問題画面からの「AIに質問」遷移 + コンテキスト表示
- [ ] セッション内履歴クリア（タブ切替で消える）

### 7.3 コスト監視

- [ ] Google Cloud Console で Gemini API 使用量アラートを設定（月 ¥10,000 到達で通知）
- [ ] リリース後 2 週間の使用量レポートを確認し、上限値を見直す

---

## 8. リスク分析

| リスク | 影響 | 対策 |
|---|---|---|
| Gemini API 料金が想定を超える | 高 | 1日15通の厳格な上限 + 月次総額モニタリング + 必要なら上限調整 |
| File Search Store が応答しない／削除される | 高 | エラー監視、バックアップとして Store の再構築手順を `scripts/gemini_rag/setup_file_store.py` に保持 |
| RevenueCat の `premium` entitlement が未作成でクラッシュ | 中 | コードは entitlement 不在時も安全に `false` を返すよう実装済み |
| AI が誤った情報を回答する | 中 | システムプロンプトで「教科書に基づく」「不確かな場合は正直に」を明記。将来的に引用表示を追加 |
| プロンプトインジェクション | 低 | Gemini の File Search API はサーバサイドで動作、外部URL呼び出し等の副作用なし |

---

## 9. 参考資料

- 既存のRAG実装計画: [`gemini-rag-implementation-plan.md`](./gemini-rag-implementation-plan.md)
- Cloudflare Workers + Turso アーキテクチャ: [`cloudflare-turso-architecture.md`](./cloudflare-turso-architecture.md)
- Gemini File Search API: https://ai.google.dev/gemini-api/docs/file-search
