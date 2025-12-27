# MVP後の次期開発フェーズ計画書

## 目次

1. [現在の状況（MVP）](#現在の状況mvp)
2. [次期フェーズの目標](#次期フェーズの目標)
3. [Phase 1: FastAPI バックエンドAPI開発](#phase-1-fastapi-バックエンドapi開発)
4. [Phase 2: iPhoneアプリへのRAG統合](#phase-2-iphoneアプリへのrag統合)
5. [Phase 3: UX改善とストリーミング対応](#phase-3-ux改善とストリーミング対応)
6. [Phase 4: 運用最適化](#phase-4-運用最適化)
7. [技術スタック](#技術スタック)
8. [アーキテクチャ図](#アーキテクチャ図)
9. [開発スケジュール](#開発スケジュール)
10. [コスト試算](#コスト試算)

---

## 現在の状況（MVP）

### 完成済みコンポーネント

✅ **フロントエンド（iPhoneアプリ）**
- React Native / Expo による iOS アプリ
- 過去問演習機能（問題表示、解答、解説表示）
- 学習履歴の保存
- 年度別問題リスト

✅ **RAGインフラストラクチャ**
- Azure AI Search インデックス
- スキルセット（OCR、テキスト分割、ベクトル化）
- インデクサー（自動更新対応）
- Blob Storage（PDF保管）

✅ **TypeScript検索サービス**
- `lib/services/searchService.ts` - ハイブリッド検索実装済み
- ベクトル検索、キーワード検索、セマンティック検索対応

### 未実装の部分

❌ **バックエンドAPI**
- iPhoneアプリから呼び出すRESTful API
- 認証・認可機能
- Rate Limiting

❌ **RAG回答生成機能のアプリ統合**
- 質問入力UI
- 回答表示UI
- 情報源の表示

---

## 次期フェーズの目標

### ビジネスゴール

**「学習者が過去問演習中に疑問を持ったとき、AIに質問して即座に回答を得られる」**

### 具体的な実現機能

1. **質問入力**: アプリ内で自由に質問を入力できる
2. **AI回答生成**: RAGを使った正確な回答を表示
3. **情報源表示**: 回答の根拠となる過去問のページを表示
4. **学習履歴連携**: 間違えた問題に関連する質問を推奨
5. **リアルタイム表示**: ChatGPTのような文字が流れる体験

### ユーザー体験イメージ

```
【ユーザーの操作フロー】

1. 過去問を解いている
   ↓
2. 「コンクリートのひび割れ幅0.3mmは許容範囲？」と疑問
   ↓
3. アプリ内の「質問」ボタンをタップ
   ↓
4. 質問を入力または音声入力
   ↓
5. 3秒で回答が表示開始（リアルタイムで文字が流れる）
   ↓
6. 回答の下に情報源（過去問のページ番号）が表示
   ↓
7. タップすると該当ページのPDFにジャンプ
```

---

## Phase 1: FastAPI バックエンドAPI開発

### 1.1 目標

**セキュアで高性能なRAG APIを構築**

### 1.2 実装内容

#### 1.2.1 FastAPIアプリケーション構築

**ディレクトリ構成**:
```
backend/
├── main.py                 # FastAPIアプリケーション本体
├── requirements.txt        # Python依存関係
├── Dockerfile             # コンテナイメージ定義
├── .env.production        # 本番環境変数
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── question.py    # 質問＆回答エンドポイント
│   │   ├── search.py      # 検索のみエンドポイント
│   │   ├── indexer.py     # インデクサー管理
│   │   └── health.py      # ヘルスチェック
│   ├── models/
│   │   ├── __init__.py
│   │   ├── request.py     # リクエストモデル（Pydantic）
│   │   └── response.py    # レスポンスモデル
│   ├── services/
│   │   ├── __init__.py
│   │   ├── search.py      # Azure AI Search操作
│   │   ├── openai.py      # Azure OpenAI操作
│   │   └── auth.py        # 認証処理
│   └── middleware/
│       ├── __init__.py
│       ├── cors.py        # CORS設定
│       ├── rate_limit.py  # Rate Limiting
│       └── logging.py     # ロギング
├── tests/
│   ├── test_question.py
│   ├── test_search.py
│   └── test_integration.py
└── scripts/
    └── deploy.sh          # デプロイスクリプト
```

#### 1.2.2 主要エンドポイント

| エンドポイント | メソッド | 説明 | 認証 |
|--------------|---------|------|------|
| `/api/ask` | POST | 質問に対してRAG回答生成 | 必須 |
| `/api/ask/stream` | POST | ストリーミング回答生成 | 必須 |
| `/api/search` | POST | 検索のみ（回答生成なし） | 必須 |
| `/api/indexer/status` | GET | インデクサー状態確認 | Admin |
| `/api/indexer/run` | POST | インデクサー手動実行 | Admin |
| `/health` | GET | ヘルスチェック | 不要 |
| `/docs` | GET | Swagger UI | 不要 |

#### 1.2.3 コア機能実装

**1. 質問＆回答生成エンドポイント (`/api/ask`)**

```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import os

app = FastAPI(
    title="Concrete Diagnostician RAG API",
    version="1.0.0"
)

class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(5, ge=1, le=10)
    user_id: str = Field(..., description="ユーザーID（学習履歴連携用）")
    context: Optional[str] = Field(None, description="現在解いている問題のID")

class Source(BaseModel):
    file_name: str
    page_number: int
    content: str
    score: float

class AnswerResponse(BaseModel):
    answer: str
    sources: List[Source]
    tokens_used: int
    processing_time_ms: int

@app.post("/api/ask", response_model=AnswerResponse)
async def ask_question(
    request: QuestionRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    質問に対してRAGで回答を生成

    処理フロー:
    1. Azure AI Searchでハイブリッド検索
    2. 検索結果をコンテキストとして整形
    3. Azure OpenAI (GPT-4) で回答生成
    4. トークン数と処理時間を記録
    """
    start_time = time.time()

    # 1. 検索
    search_results = await search_service.hybrid_search(
        query=request.question,
        top_k=request.top_k,
        user_context=request.context
    )

    # 2. プロンプト作成
    context = format_search_results(search_results)
    system_prompt = create_system_prompt(context)

    # 3. 回答生成
    response = await openai_service.generate_answer(
        system_prompt=system_prompt,
        user_question=request.question
    )

    # 4. ログ記録（学習分析用）
    await log_question(
        user_id=request.user_id,
        question=request.question,
        answer=response.answer,
        sources=search_results
    )

    processing_time = (time.time() - start_time) * 1000

    return AnswerResponse(
        answer=response.answer,
        sources=[Source(**s) for s in search_results],
        tokens_used=response.tokens_used,
        processing_time_ms=int(processing_time)
    )
```

**2. ストリーミング回答エンドポイント (`/api/ask/stream`)**

```python
from fastapi.responses import StreamingResponse
import asyncio

@app.post("/api/ask/stream")
async def ask_question_stream(
    request: QuestionRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    ストリーミング形式で回答を生成
    ChatGPTのようにリアルタイムで文字が表示される
    """
    async def generate():
        # 検索
        search_results = await search_service.hybrid_search(
            query=request.question,
            top_k=request.top_k
        )

        # まず情報源を送信
        yield f"data: {json.dumps({'type': 'sources', 'data': search_results})}\n\n"

        # OpenAI ストリーミング
        context = format_search_results(search_results)
        stream = await openai_service.generate_answer_stream(
            context=context,
            question=request.question
        )

        # 回答をリアルタイムで送信
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'type': 'content', 'data': chunk.choices[0].delta.content})}\n\n"
                await asyncio.sleep(0.01)  # レート制限

        # 完了通知
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

**3. 認証ミドルウェア**

```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    """
    APIキー検証

    本番環境:
    - Azure Key Vaultからキーを取得
    - ユーザーごとに異なるキーを発行
    - Rate Limitingと連携
    """
    valid_keys = await get_valid_api_keys()  # Key Vaultから取得

    if api_key not in valid_keys:
        raise HTTPException(
            status_code=403,
            detail="Invalid API Key"
        )

    return api_key
```

**4. Rate Limiting**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/ask")
@limiter.limit("10/minute")  # 1ユーザーあたり10回/分
async def ask_question(request: QuestionRequest):
    # ...
```

#### 1.2.4 既存コードの再利用

**既存のTypeScriptコードをPythonに移植**:

```python
# lib/services/searchService.ts → backend/api/services/search.py

from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI

class ConcreteSearchService:
    def __init__(self):
        self.search_client = SearchClient(
            endpoint=os.getenv('AZURE_SEARCH_ENDPOINT'),
            index_name=os.getenv('AZURE_SEARCH_INDEX_NAME'),
            credential=AzureKeyCredential(os.getenv('AZURE_SEARCH_ADMIN_KEY'))
        )

        self.openai_client = AzureOpenAI(
            api_key=os.getenv('AZURE_OPENAI_API_KEY'),
            endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
            api_version='2024-08-01-preview'
        )

    async def hybrid_search(self, query: str, top_k: int = 5):
        """
        既存のTypeScript実装と同じロジック
        - キーワード検索
        - ベクトル検索
        - セマンティックランキング
        """
        # ベクトル化
        query_vector = await self._get_embedding(query)

        # ハイブリッド検索
        results = self.search_client.search(
            search_text=query,
            vectors=[{
                "value": query_vector,
                "k": top_k,
                "fields": "contentVector"
            }],
            query_type="semantic",
            semantic_configuration_name="semantic-config",
            top=top_k
        )

        return [self._format_result(r) for r in results]
```

### 1.3 デプロイ環境

**Azure Container Apps（推奨）**

```yaml
# azure-container-app.yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8000
      transport: auto
    secrets:
      - name: azure-search-key
        value: <from-key-vault>
      - name: azure-openai-key
        value: <from-key-vault>
  template:
    containers:
      - image: concreterag.azurecr.io/api:latest
        name: fastapi-app
        resources:
          cpu: 1.0
          memory: 2Gi
        env:
          - name: AZURE_SEARCH_ENDPOINT
            value: "https://search-concrete-questions-dev.search.windows.net"
          - name: AZURE_SEARCH_ADMIN_KEY
            secretRef: azure-search-key
          - name: AZURE_OPENAI_ENDPOINT
            value: "https://concrete-openai-dev.openai.azure.com/"
          - name: AZURE_OPENAI_API_KEY
            secretRef: azure-openai-key
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-rule
          http:
            metadata:
              concurrentRequests: "30"
```

**デプロイコマンド**:
```bash
# 1. Dockerイメージをビルド
docker build -t concreterag.azurecr.io/api:latest .

# 2. Azure Container Registryにプッシュ
docker push concreterag.azurecr.io/api:latest

# 3. Container Appsにデプロイ
az containerapp create \
  --name concrete-rag-api \
  --resource-group rg-concrete-questions-dev \
  --environment concrete-env \
  --image concreterag.azurecr.io/api:latest \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10
```

### 1.4 開発タスクリスト

- [ ] FastAPIプロジェクト初期化
- [ ] Pydanticモデル定義（リクエスト/レスポンス）
- [ ] Azure AI Search統合（既存コード移植）
- [ ] Azure OpenAI統合（回答生成）
- [ ] ストリーミングレスポンス実装
- [ ] 認証ミドルウェア実装
- [ ] Rate Limiting実装
- [ ] エラーハンドリング
- [ ] ロギング＆モニタリング
- [ ] ユニットテスト作成
- [ ] 統合テスト作成
- [ ] Swagger UI カスタマイズ
- [ ] Dockerfile作成
- [ ] Azure Container Apps デプロイ設定
- [ ] CI/CD パイプライン構築
- [ ] 本番環境テスト

### 1.5 推定工数

| タスク | 工数 |
|--------|------|
| FastAPI基盤構築 | 3日 |
| 検索＆回答生成機能 | 5日 |
| ストリーミング対応 | 2日 |
| 認証・セキュリティ | 3日 |
| テスト作成 | 3日 |
| デプロイ設定 | 2日 |
| **合計** | **18日（約3.5週間）** |

---

## Phase 2: iPhoneアプリへのRAG統合

### 2.1 目標

**ユーザーが質問してAI回答を得られるUI実装**

### 2.2 実装内容

#### 2.2.1 画面設計

**新規画面: 質問画面 (`app/screens/QuestionScreen.tsx`)**

```
┌────────────────────────────┐
│  ← 質問する            ⚙  │
├────────────────────────────┤
│                            │
│  【入力エリア】              │
│  ┌────────────────────┐    │
│  │ 質問を入力...       │ 🎤 │
│  └────────────────────┘    │
│                            │
│  よくある質問:              │
│  • ひび割れの許容幅は？     │
│  • 中性化深さの測定方法は？ │
│                            │
│  【回答エリア】              │
│  ┌────────────────────┐    │
│  │ コンクリートのひび割れ... │
│  │                        │
│  │ ひび割れの許容幅は構造物  │
│  │ の種類によって異なります... │
│  │                        │
│  │ [情報源を表示]          │
│  └────────────────────┘    │
│                            │
└────────────────────────────┘
```

**情報源表示モーダル**:

```
┌────────────────────────────┐
│  情報源              ✕     │
├────────────────────────────┤
│                            │
│  📄 2024年度過去問題集      │
│     ページ 45-47           │
│     関連度: ★★★★★         │
│                            │
│     "ひび割れ幅の許容値は..." │
│                            │
│     [PDFを開く]            │
│                            │
│  📄 2023年度過去問題集      │
│     ページ 102-104         │
│     関連度: ★★★★☆         │
│                            │
│     "構造物の種類によって..." │
│                            │
│     [PDFを開く]            │
│                            │
└────────────────────────────┘
```

#### 2.2.2 コンポーネント実装

**1. 質問入力コンポーネント**

```typescript
// components/QuestionInput.tsx
import { useState } from 'react';
import { TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  loading: boolean;
}

export function QuestionInput({ onSubmit, loading }: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    if (question.trim() && !loading) {
      onSubmit(question);
      setQuestion('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="質問を入力してください..."
        style={styles.input}
        multiline
        maxLength={500}
        editable={!loading}
      />

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !question.trim()}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Ionicons
          name="send"
          size={24}
          color={loading ? '#ccc' : '#007AFF'}
        />
      </TouchableOpacity>
    </View>
  );
}
```

**2. ストリーミング回答表示コンポーネント**

```typescript
// components/StreamingAnswer.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface StreamingAnswerProps {
  answer: string;
  isStreaming: boolean;
}

export function StreamingAnswer({ answer, isStreaming }: StreamingAnswerProps) {
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    // カーソル点滅アニメーション
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDisplayedAnswer(answer);
  }, [answer]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.answer}>
        {displayedAnswer}
        {isStreaming && (
          <Text style={[styles.cursor, !cursorVisible && styles.cursorHidden]}>
            |
          </Text>
        )}
      </Text>
    </ScrollView>
  );
}
```

**3. 情報源リストコンポーネント**

```typescript
// components/SourceList.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Source {
  fileName: string;
  pageNumber: number;
  content: string;
  score: number;
}

interface SourceListProps {
  sources: Source[];
  onSourcePress: (source: Source) => void;
}

export function SourceList({ sources, onSourcePress }: SourceListProps) {
  const renderStars = (score: number) => {
    const stars = Math.round(score * 5);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>参考資料</Text>

      {sources.map((source, index) => (
        <TouchableOpacity
          key={index}
          style={styles.sourceCard}
          onPress={() => onSourcePress(source)}
        >
          <View style={styles.sourceHeader}>
            <Ionicons name="document-text" size={20} color="#007AFF" />
            <Text style={styles.fileName}>{source.fileName}</Text>
          </View>

          <Text style={styles.pageNumber}>
            ページ {source.pageNumber}
          </Text>

          <Text style={styles.relevance}>
            関連度: {renderStars(source.score)}
          </Text>

          <Text style={styles.excerpt} numberOfLines={2}>
            {source.content}
          </Text>

          <Text style={styles.viewPdf}>PDFを開く →</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

**4. メイン質問画面**

```typescript
// app/(tabs)/question.tsx
import { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { QuestionInput } from '@/components/QuestionInput';
import { StreamingAnswer } from '@/components/StreamingAnswer';
import { SourceList } from '@/components/SourceList';

export default function QuestionScreen() {
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const handleQuestionSubmit = async (question: string) => {
    setLoading(true);
    setStreaming(true);
    setAnswer('');
    setSources([]);

    try {
      // ストリーミングAPI呼び出し
      const response = await fetch(
        'https://concrete-rag-api.azurecontainerapps.io/api/ask/stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.EXPO_PUBLIC_API_KEY
          },
          body: JSON.stringify({
            question,
            top_k: 5,
            user_id: 'current-user-id'
          })
        }
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'sources') {
              setSources(data.data);
            } else if (data.type === 'content') {
              setAnswer(prev => prev + data.data);
            } else if (data.type === 'done') {
              setStreaming(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setAnswer('エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  return (
    <View style={styles.container}>
      <QuestionInput
        onSubmit={handleQuestionSubmit}
        loading={loading}
      />

      {loading && !answer && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>回答を生成中...</Text>
        </View>
      )}

      {answer && (
        <>
          <StreamingAnswer
            answer={answer}
            isStreaming={streaming}
          />

          {sources.length > 0 && (
            <SourceList
              sources={sources}
              onSourcePress={(source) => {
                // PDFビューアーを開く
                console.log('Open PDF:', source);
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
```

#### 2.2.3 API通信サービス

```typescript
// services/ragService.ts
interface QuestionRequest {
  question: string;
  top_k?: number;
  user_id: string;
  context?: string;
}

interface AnswerResponse {
  answer: string;
  sources: Source[];
  tokens_used: number;
  processing_time_ms: number;
}

export class RAGService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://concrete-rag-api.azurecontainerapps.io';
    this.apiKey = process.env.EXPO_PUBLIC_API_KEY!;
  }

  async askQuestion(request: QuestionRequest): Promise<AnswerResponse> {
    const response = await fetch(`${this.baseUrl}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  }

  async *askQuestionStream(request: QuestionRequest): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/ask/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(request)
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield JSON.parse(line.slice(6));
        }
      }
    }
  }
}
```

### 2.3 開発タスクリスト

- [ ] 質問画面UI設計
- [ ] QuestionInputコンポーネント実装
- [ ] StreamingAnswerコンポーネント実装
- [ ] SourceListコンポーネント実装
- [ ] RAGServiceクラス実装
- [ ] ストリーミングレスポンス処理
- [ ] エラーハンドリング
- [ ] ローディング状態管理
- [ ] 音声入力対応
- [ ] よくある質問機能
- [ ] 学習履歴連携
- [ ] PDFビューアー統合
- [ ] オフライン対応（キャッシュ）
- [ ] UIテスト
- [ ] 統合テスト

### 2.4 推定工数

| タスク | 工数 |
|--------|------|
| UI設計・プロトタイプ | 2日 |
| コンポーネント実装 | 5日 |
| API統合 | 3日 |
| ストリーミング対応 | 2日 |
| PDFビューアー統合 | 2日 |
| テスト・デバッグ | 3日 |
| **合計** | **17日（約3.5週間）** |

---

## Phase 3: UX改善とストリーミング対応

### 3.1 目標

**ChatGPTのような滑らかなユーザー体験**

### 3.2 実装内容

#### 3.2.1 リアルタイム文字表示

- 回答が1文字ずつ流れるように表示
- タイピングエフェクト
- カーソル点滅アニメーション

#### 3.2.2 音声入力対応

```typescript
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

// 音声入力
const handleVoiceInput = async () => {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') return;

  // 音声認識実装
  // Azure Speech Services or Expo Speech Recognition
};

// 音声読み上げ（回答を読み上げる）
const handleSpeakAnswer = (answer: string) => {
  Speech.speak(answer, {
    language: 'ja-JP',
    rate: 1.0
  });
};
```

#### 3.2.3 コンテキスト学習

- 前回の質問を覚えて関連質問を推奨
- 間違えた問題に基づいて推奨質問を生成

### 3.3 推定工数

| タスク | 工数 |
|--------|------|
| ストリーミングUX改善 | 3日 |
| 音声入力実装 | 3日 |
| 音声読み上げ実装 | 2日 |
| コンテキスト学習 | 3日 |
| **合計** | **11日（約2週間）** |

---

## Phase 4: 運用最適化

### 4.1 目標

**安定した本番運用とコスト最適化**

### 4.2 実装内容

#### 4.2.1 モニタリング

```python
# Application Insights統合
from opencensus.ext.azure.log_exporter import AzureLogHandler
import logging

logger = logging.getLogger(__name__)
logger.addHandler(AzureLogHandler(
    connection_string=os.getenv('APPLICATIONINSIGHTS_CONNECTION_STRING')
))

@app.post("/api/ask")
async def ask_question(request: QuestionRequest):
    logger.info(f"Question received: {request.question[:50]}...")

    start_time = time.time()

    try:
        result = await process_question(request)

        logger.info(f"Question answered successfully in {time.time() - start_time:.2f}s")
        logger.info(f"Tokens used: {result.tokens_used}")

        return result

    except Exception as e:
        logger.error(f"Error processing question: {str(e)}")
        raise
```

#### 4.2.2 コスト最適化

**キャッシング戦略**:

```python
from functools import lru_cache
import hashlib

# よくある質問をキャッシュ
@lru_cache(maxsize=1000)
async def get_cached_answer(question_hash: str):
    # Redis or Azure Cache for Redis
    cached = await redis_client.get(f"answer:{question_hash}")
    if cached:
        return json.loads(cached)
    return None

@app.post("/api/ask")
async def ask_question(request: QuestionRequest):
    # 質問のハッシュを計算
    question_hash = hashlib.md5(request.question.encode()).hexdigest()

    # キャッシュチェック
    cached_answer = await get_cached_answer(question_hash)
    if cached_answer:
        logger.info("Returning cached answer")
        return cached_answer

    # 新規回答生成
    answer = await generate_answer(request)

    # キャッシュに保存（24時間）
    await redis_client.setex(
        f"answer:{question_hash}",
        86400,
        json.dumps(answer)
    )

    return answer
```

#### 4.2.3 A/Bテスト

- プロンプトの改善テスト
- 検索結果数（top_k）の最適化
- ストリーミング vs 一括レスポンス

### 4.3 推定工数

| タスク | 工数 |
|--------|------|
| Application Insights統合 | 2日 |
| Redis キャッシング | 3日 |
| A/Bテストフレームワーク | 3日 |
| コスト分析ダッシュボード | 2日 |
| **合計** | **10日（2週間）** |

---

## 技術スタック

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Python | 3.11+ | プログラミング言語 |
| FastAPI | 0.109+ | Web フレームワーク |
| Pydantic | 2.5+ | データバリデーション |
| Azure SDK | 最新 | Azure サービス統合 |
| OpenAI SDK | 1.12+ | Azure OpenAI 統合 |
| uvicorn | 0.27+ | ASGI サーバー |
| Redis | 7.2+ | キャッシング |

### フロントエンド（既存）

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React Native | 0.73+ | モバイルアプリフレームワーク |
| Expo | 53+ | 開発プラットフォーム |
| TypeScript | 5.3+ | 型安全性 |

### インフラ

| サービス | 用途 |
|---------|------|
| Azure Container Apps | FastAPI ホスティング |
| Azure Container Registry | Docker イメージ管理 |
| Azure AI Search | 検索エンジン |
| Azure OpenAI | GPT-4 回答生成 |
| Azure Blob Storage | PDF 保管 |
| Azure Cache for Redis | 回答キャッシング |
| Azure Application Insights | モニタリング |
| Azure Key Vault | シークレット管理 |

---

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                    iPhoneアプリ (React Native)                │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 過去問演習   │  │ 質問＆回答   │  │ 学習統計     │      │
│  │ (既存機能)   │  │ (新機能)     │  │ (既存機能)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / X-API-Key
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Azure Container Apps)          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Endpoints                                        │   │
│  │  • POST /api/ask           - 質問＆回答生成          │   │
│  │  • POST /api/ask/stream    - ストリーミング回答      │   │
│  │  • POST /api/search        - 検索のみ                │   │
│  │  • GET  /api/indexer/status - インデクサー状態       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 認証         │  │ Rate Limit   │  │ ロギング     │      │
│  │ Middleware   │  │ Middleware   │  │ Middleware   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ↓                    ↓                    ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Azure AI Search │  │ Azure OpenAI    │  │ Azure Cache     │
│                 │  │                 │  │ for Redis       │
│ • Hybrid Search │  │ • GPT-4         │  │                 │
│ • Vector Search │  │ • Embeddings    │  │ • 回答キャッシュ│
│ • Semantic      │  │ • Streaming     │  │ • セッション    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         ↑
         │
┌─────────────────┐
│ Azure Blob      │
│ Storage         │
│                 │
│ • PDF保管       │
│ • 自動更新      │
└─────────────────┘
```

---

## 開発スケジュール

### 全体スケジュール（12週間）

```
Week 1-3: Phase 1 - FastAPI バックエンドAPI開発
  Week 1: 基盤構築、検索機能実装
  Week 2: 回答生成機能、ストリーミング実装
  Week 3: 認証・セキュリティ、テスト

Week 4-6: Phase 2 - iPhoneアプリへのRAG統合
  Week 4: UI設計、コンポーネント実装
  Week 5: API統合、ストリーミング対応
  Week 6: PDFビューアー統合、テスト

Week 7-8: Phase 3 - UX改善
  Week 7: 音声入力・読み上げ実装
  Week 8: コンテキスト学習、UX改善

Week 9-10: Phase 4 - 運用最適化
  Week 9: モニタリング、キャッシング
  Week 10: A/Bテスト、コスト最適化

Week 11-12: 統合テスト・本番リリース準備
  Week 11: 総合テスト、バグ修正
  Week 12: ドキュメント整備、本番デプロイ
```

### マイルストーン

| マイルストーン | 期限 | 成果物 |
|--------------|------|--------|
| M1: FastAPI本番デプロイ | Week 3 | 動作するRAG API |
| M2: アプリβ版リリース | Week 6 | テスター向けアプリ配信 |
| M3: UX改善完了 | Week 8 | 音声対応、滑らかなUI |
| M4: 本番リリース | Week 12 | App Store公開 |

---

## コスト試算

### 月額コスト（想定ユーザー数: 100人）

| サービス | 使用量 | 単価 | 月額コスト |
|---------|--------|------|----------|
| **Azure Container Apps** | 1 vCPU, 2GB RAM | $0.000024/秒 | $52 |
| **Azure AI Search** | Standard S1 | ¥27,000/月 | ¥27,000 |
| **Azure OpenAI (GPT-4)** | 500k tokens/月 | $0.03/1k tokens | $15 |
| **Azure OpenAI (Embeddings)** | 1M tokens/月 | $0.0001/1k tokens | $0.1 |
| **Azure Blob Storage** | 10GB | ¥250/月 | ¥250 |
| **Azure Cache for Redis** | Basic C0 | ¥1,700/月 | ¥1,700 |
| **Application Insights** | 5GB/月 | ¥300/GB | ¥1,500 |
| **Azure Container Registry** | Basic | ¥600/月 | ¥600 |
| **合計** | - | - | **¥31,050 + $67 ≈ ¥41,000** |

### ユーザー数増加時のコスト（月間）

| ユーザー数 | OpenAI Token数 | Azure Container Apps | 月額合計 |
|-----------|---------------|---------------------|---------|
| 100人 | 500k tokens | 1インスタンス | ¥41,000 |
| 500人 | 2.5M tokens | 2インスタンス | ¥55,000 |
| 1,000人 | 5M tokens | 3インスタンス | ¥75,000 |
| 5,000人 | 25M tokens | 10インスタンス | ¥220,000 |

### コスト最適化施策

1. **Redis キャッシング**: よくある質問の回答をキャッシュ → OpenAI コスト30-50%削減
2. **プロンプト最適化**: トークン数削減 → OpenAI コスト20-30%削減
3. **Container Apps スケーリング**: 使用量に応じた自動スケール → 無駄なコスト削減
4. **Reserved Capacity**: Azure AI Search の予約インスタンス → 30%割引

---

## リスクと対策

### リスク1: OpenAI API レート制限

**影響**: ユーザーが同時に質問すると処理できない

**対策**:
- Rate Limiting ミドルウェアでユーザーあたりの制限設定
- キューイング機能実装
- キャッシュによる API 呼び出し削減

### リスク2: 回答品質の問題

**影響**: 不正確な回答により信頼性低下

**対策**:
- A/B テストで継続的なプロンプト改善
- ユーザーフィードバック機能（👍/👎）
- 専門家による定期的なレビュー

### リスク3: コスト超過

**影響**: 予算オーバー

**対策**:
- Azure Cost Management でアラート設定
- キャッシング戦略で API 呼び出し削減
- 月額料金プラン（ユーザー課金）で収益化

### リスク4: パフォーマンス問題

**影響**: 回答生成が遅い（3秒以上）

**対策**:
- ストリーミングレスポンスで体感速度向上
- Container Apps の自動スケーリング
- CDN によるキャッシュ配信

---

## 成功指標（KPI）

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| **回答生成時間** | 平均 3秒以内 | Application Insights |
| **回答精度** | ユーザー評価 80%以上 | アプリ内フィードバック |
| **API可用性** | 99.9% | Azure Monitor |
| **ユーザーあたり質問数** | 月平均 10回以上 | ログ分析 |
| **キャッシュヒット率** | 30%以上 | Redis メトリクス |
| **月額コスト効率** | ユーザーあたり ¥400以下 | Azure Cost Management |

---

## まとめ

### MVP後の次のステップ

1. ✅ **Phase 1**: FastAPI バックエンドAPI開発（3.5週間）
2. ✅ **Phase 2**: iPhoneアプリへのRAG統合（3.5週間）
3. ✅ **Phase 3**: UX改善とストリーミング対応（2週間）
4. ✅ **Phase 4**: 運用最適化（2週間）

### 期待される成果

- **ユーザー体験の向上**: 疑問をすぐに解決できる
- **学習効率の向上**: AI による個別指導
- **差別化**: 他の試験対策アプリにない機能
- **収益化の可能性**: プレミアム機能として課金

### 開発開始条件

- ✅ MVP（過去問演習機能）完成
- ✅ Azure AI Search インデックス構築完了
- ✅ 予算承認（初期開発: 約3ヶ月、運用: 月額¥41,000〜）

**次のアクションアイテム**:
1. Phase 1 の FastAPI 開発着手
2. Azure Container Apps 環境準備
3. API 仕様書の詳細化

---

**この計画書により、MVPから次のフェーズへの移行がスムーズに進められます！** 🚀

---

## 参考資料

### 動画リソース

| タイトル | URL | 説明 |
|---------|-----|------|
| Claude CodeとExpoでスマホアプリを量産する方法 | https://www.youtube.com/watch?v=c46iIqF5GyQ&t=38s | Expo/React Nativeを使用したClaude Codeによる効率的なアプリ開発手法 |

---

_最終更新: 2025-12-17_
