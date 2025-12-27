# RAG問題生成実装ガイド

## 概要

本ドキュメントは、Azure AI SearchとAzure OpenAI Serviceを組み合わせたRAG（Retrieval-Augmented Generation）システムを使用して、コンクリート診断士試験問題を生成するための技術実装ガイドです。

---

## アーキテクチャ概要

```
PDF文書
  ↓
Azure Blob Storage
  ↓
Azure AI Search (Indexer + Skillset)
  ├─ テキスト抽出
  ├─ チャンキング
  └─ ベクトル化 (OpenAI Embeddings)
  ↓
検索インデックス
  ├─ テキスト検索
  ├─ ベクトル検索
  └─ ハイブリッド検索
  ↓
RAG Pipeline
  ├─ クエリ生成
  ├─ 関連チャンク検索
  └─ プロンプト構築
  ↓
Azure OpenAI Service (GPT-4)
  ↓
問題生成（JSON）
```

---

## Phase 1: Azure AI Searchのセットアップ

### 1.1 必要なAzureリソース

```bash
# リソースグループ作成
az group create \
  --name rg-concrete-app \
  --location japaneast

# Azure AI Search作成
az search service create \
  --name search-concrete-questions \
  --resource-group rg-concrete-app \
  --sku standard \
  --location japaneast

# Blob Storage作成
az storage account create \
  --name stconcretedocs \
  --resource-group rg-concrete-app \
  --location japaneast \
  --sku Standard_LRS

# コンテナ作成
az storage container create \
  --name source-documents \
  --account-name stconcretedocs
```

### 1.2 環境変数設定

```bash
# .env.local
# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://search-concrete-questions.search.windows.net
AZURE_SEARCH_ADMIN_KEY=your-admin-key-here
AZURE_SEARCH_INDEX_NAME=concrete-documents

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string-here
AZURE_STORAGE_CONTAINER_NAME=source-documents

# Azure OpenAI Service
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 1.3 PDFアップロード

```typescript
// scripts/uploadPDF.ts
import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function uploadPDF() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // PDFファイルパス
  const filePath = path.join(
    __dirname,
    '../question_creation_data/Concrete_Diagnostician _ 2024.pdf'
  );

  const blobName = 'Concrete_Diagnostician_2024.pdf';
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  console.log(`Uploading ${blobName}...`);

  const uploadResponse = await blockBlobClient.uploadFile(filePath, {
    metadata: {
      title: 'コンクリート診断士試験参考資料',
      year: '2024',
      documentType: 'reference_material',
    },
  });

  console.log(`✅ Upload completed: ${uploadResponse.requestId}`);
  console.log(`📁 Blob URL: ${blockBlobClient.url}`);
}

uploadPDF().catch(console.error);
```

---

## Phase 2: インデックスとスキルセットの作成

### 2.1 インデックス定義

```typescript
// scripts/createIndex.ts
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function createIndex() {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
  const apiKey = process.env.AZURE_SEARCH_ADMIN_KEY!;
  const indexName = process.env.AZURE_SEARCH_INDEX_NAME!;

  const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

  const index = {
    name: indexName,
    fields: [
      {
        name: 'id',
        type: 'Edm.String',
        key: true,
        filterable: true,
      },
      {
        name: 'content',
        type: 'Edm.String',
        searchable: true,
        analyzer: 'ja.microsoft', // 日本語アナライザー
      },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: 1536, // text-embedding-ada-002の次元数
        vectorSearchProfileName: 'vector-profile',
      },
      {
        name: 'title',
        type: 'Edm.String',
        searchable: true,
        filterable: true,
      },
      {
        name: 'metadata',
        type: 'Edm.String',
        searchable: true,
      },
      {
        name: 'pageNumber',
        type: 'Edm.Int32',
        filterable: true,
        sortable: true,
      },
      {
        name: 'chunkId',
        type: 'Edm.String',
        filterable: true,
      },
    ],
    vectorSearch: {
      algorithms: [
        {
          name: 'vector-config',
          kind: 'hnsw', // Hierarchical Navigable Small World
          hnswParameters: {
            metric: 'cosine',
            m: 4,
            efConstruction: 400,
            efSearch: 500,
          },
        },
      ],
      profiles: [
        {
          name: 'vector-profile',
          algorithm: 'vector-config',
        },
      ],
    },
    semantic: {
      configurations: [
        {
          name: 'semantic-config',
          prioritizedFields: {
            titleField: { fieldName: 'title' },
            contentFields: [{ fieldName: 'content' }],
          },
        },
      ],
    },
  };

  console.log('Creating index...');
  const result = await client.createOrUpdateIndex(index);
  console.log(`✅ Index created: ${result.name}`);
}

createIndex().catch(console.error);
```

### 2.2 スキルセット定義

```json
{
  "name": "concrete-skillset",
  "description": "Skillset for extracting and vectorizing concrete diagnostician content",
  "skills": [
    {
      "@odata.type": "#Microsoft.Skills.Vision.OcrSkill",
      "context": "/document/normalized_images/*",
      "defaultLanguageCode": "ja",
      "detectOrientation": true,
      "inputs": [
        {
          "name": "image",
          "source": "/document/normalized_images/*"
        }
      ],
      "outputs": [
        {
          "name": "text",
          "targetName": "text"
        }
      ]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.MergeSkill",
      "context": "/document",
      "insertPreTag": " ",
      "insertPostTag": " ",
      "inputs": [
        {
          "name": "text",
          "source": "/document/content"
        },
        {
          "name": "itemsToInsert",
          "source": "/document/normalized_images/*/text"
        }
      ],
      "outputs": [
        {
          "name": "mergedText",
          "targetName": "merged_content"
        }
      ]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
      "context": "/document",
      "textSplitMode": "pages",
      "maximumPageLength": 4000,
      "pageOverlapLength": 800,
      "defaultLanguageCode": "ja",
      "inputs": [
        {
          "name": "text",
          "source": "/document/merged_content"
        }
      ],
      "outputs": [
        {
          "name": "textItems",
          "targetName": "pages"
        }
      ]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.AzureOpenAIEmbeddingSkill",
      "context": "/document/pages/*",
      "resourceUri": "${AZURE_OPENAI_ENDPOINT}",
      "apiKey": "${AZURE_OPENAI_KEY}",
      "deploymentId": "${AZURE_OPENAI_EMBEDDING_DEPLOYMENT}",
      "inputs": [
        {
          "name": "text",
          "source": "/document/pages/*"
        }
      ],
      "outputs": [
        {
          "name": "embedding",
          "targetName": "vector"
        }
      ]
    }
  ],
  "cognitiveServices": {
    "@odata.type": "#Microsoft.Azure.Search.CognitiveServicesByKey",
    "key": "${COGNITIVE_SERVICES_KEY}"
  }
}
```

### 2.3 インデクサー作成

```typescript
// scripts/createIndexer.ts
import { SearchIndexerClient, AzureKeyCredential } from '@azure/search-documents';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function createIndexer() {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
  const apiKey = process.env.AZURE_SEARCH_ADMIN_KEY!;

  const client = new SearchIndexerClient(endpoint, new AzureKeyCredential(apiKey));

  // データソース作成
  const dataSource = {
    name: 'concrete-blob-datasource',
    type: 'azureblob',
    credentials: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
    },
    container: {
      name: process.env.AZURE_STORAGE_CONTAINER_NAME!,
    },
  };

  console.log('Creating data source...');
  await client.createOrUpdateDataSourceConnection(dataSource);

  // インデクサー作成
  const indexer = {
    name: 'concrete-indexer',
    dataSourceName: 'concrete-blob-datasource',
    targetIndexName: process.env.AZURE_SEARCH_INDEX_NAME!,
    skillsetName: 'concrete-skillset',
    parameters: {
      configuration: {
        dataToExtract: 'contentAndMetadata',
        imageAction: 'generateNormalizedImages',
        parsingMode: 'default',
      },
    },
    fieldMappings: [
      {
        sourceFieldName: 'metadata_storage_path',
        targetFieldName: 'id',
        mappingFunction: {
          name: 'base64Encode',
        },
      },
      {
        sourceFieldName: 'metadata_storage_name',
        targetFieldName: 'title',
      },
    ],
    outputFieldMappings: [
      {
        sourceFieldName: '/document/pages/*',
        targetFieldName: 'content',
      },
      {
        sourceFieldName: '/document/pages/*/vector',
        targetFieldName: 'contentVector',
      },
    ],
  };

  console.log('Creating indexer...');
  const result = await client.createOrUpdateIndexer(indexer);
  console.log(`✅ Indexer created: ${result.name}`);

  // インデクサー実行
  console.log('Running indexer...');
  await client.runIndexer(indexer.name);
  console.log('✅ Indexer started');
}

createIndexer().catch(console.error);
```

---

## Phase 3: RAG検索サービスの実装

### 3.1 検索サービスクラス

```typescript
// lib/services/searchService.ts
import {
  SearchClient,
  AzureKeyCredential,
  SearchOptions,
} from '@azure/search-documents';
import { OpenAIClient } from '@azure/openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface SearchQuery {
  theme: string;
  searchText: string;
  semanticQuery: string;
  filter?: string;
  top?: number;
}

interface SearchResult {
  id: string;
  content: string;
  title: string;
  pageNumber?: number;
  score: number;
  chunkId: string;
}

export class ConcreteSearchService {
  private searchClient: SearchClient<any>;
  private openAIClient: OpenAIClient;
  private embeddingDeployment: string;

  constructor() {
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT!;
    const searchKey = process.env.AZURE_SEARCH_ADMIN_KEY!;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME!;

    this.searchClient = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchKey)
    );

    const openAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const openAIKey = process.env.AZURE_OPENAI_KEY!;
    this.openAIClient = new OpenAIClient(
      openAIEndpoint,
      new AzureKeyCredential(openAIKey)
    );

    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;
  }

  /**
   * ハイブリッド検索（テキスト + ベクトル）
   */
  async hybridSearch(query: SearchQuery): Promise<SearchResult[]> {
    // クエリのベクトル化
    const queryVector = await this.getEmbedding(query.semanticQuery);

    const searchOptions: SearchOptions<any> = {
      top: query.top || 5,
      select: ['id', 'content', 'title', 'pageNumber', 'chunkId'],
      searchFields: ['content'],
      vectorSearchOptions: {
        queries: [
          {
            kind: 'vector',
            vector: queryVector,
            kNearestNeighborsCount: query.top || 5,
            fields: ['contentVector'],
          },
        ],
      },
      queryType: 'semantic',
      semanticSearchOptions: {
        configurationName: 'semantic-config',
        captions: {
          captionType: 'extractive',
          maxSize: 200,
        },
      },
    };

    if (query.filter) {
      searchOptions.filter = query.filter;
    }

    const results = await this.searchClient.search(query.searchText, searchOptions);

    const searchResults: SearchResult[] = [];
    for await (const result of results.results) {
      searchResults.push({
        id: result.document.id,
        content: result.document.content,
        title: result.document.title,
        pageNumber: result.document.pageNumber,
        score: result.score || 0,
        chunkId: result.document.chunkId,
      });
    }

    return searchResults;
  }

  /**
   * テキストをベクトル化
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openAIClient.getEmbeddings(
      this.embeddingDeployment,
      [text]
    );

    return response.data[0].embedding;
  }

  /**
   * 検索結果をプロンプト用に整形
   */
  formatSearchResultsForPrompt(results: SearchResult[]): string {
    return results
      .map((result, index) => {
        return `
【参考資料 ${index + 1}】
出典: ${result.title} (ページ ${result.pageNumber || '不明'})
チャンクID: ${result.chunkId}
関連度: ${(result.score * 100).toFixed(1)}%

内容:
${result.content}
`;
      })
      .join('\n---\n');
  }
}
```

---

## Phase 4: RAG問題生成パイプライン

### 4.1 問題生成クラス（RAG対応）

```typescript
// scripts/ragQuestionGenerator.ts
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { ConcreteSearchService } from '../lib/services/searchService';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface QuestionConfig {
  category: string;
  theme: string;
  difficulty: 'basic' | 'standard' | 'advanced';
  questionNumber: number;
  searchQuery: SearchQuery;
}

interface SearchQuery {
  theme: string;
  searchText: string;
  semanticQuery: string;
  filter?: string;
  top?: number;
}

interface GeneratedQuestion {
  questionText: string;
  choices: Array<{
    label: string;
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
  keywords: string[];
  references: string[];
  sources: Array<{
    chunkId: string;
    title: string;
    pageNumber?: number;
  }>;
}

export class RAGQuestionGenerator {
  private openAIClient: OpenAIClient;
  private searchService: ConcreteSearchService;
  private deploymentName: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const apiKey = process.env.AZURE_OPENAI_KEY!;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME!;

    this.openAIClient = new OpenAIClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );

    this.searchService = new ConcreteSearchService();
  }

  /**
   * RAGを使用して問題を生成
   */
  async generateQuestion(config: QuestionConfig): Promise<GeneratedQuestion> {
    // Step 1: 関連情報を検索
    console.log(`Searching for: ${config.searchQuery.theme}`);
    const searchResults = await this.searchService.hybridSearch(config.searchQuery);

    if (searchResults.length === 0) {
      throw new Error(`No relevant content found for theme: ${config.theme}`);
    }

    // Step 2: 検索結果をプロンプトに整形
    const formattedSources = this.searchService.formatSearchResultsForPrompt(
      searchResults
    );

    // Step 3: プロンプト生成
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(config, formattedSources);

    // Step 4: GPT-4で問題生成
    const response = await this.openAIClient.getChatCompletions(
      this.deploymentName,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 3000,
        topP: 0.95,
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // JSONの抽出
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const question: GeneratedQuestion = JSON.parse(jsonStr);

    // ソース情報を追加
    question.sources = searchResults.map(result => ({
      chunkId: result.chunkId,
      title: result.title,
      pageNumber: result.pageNumber,
    }));

    return question;
  }

  private getSystemPrompt(): string {
    return `
あなたはコンクリート診断士試験の問題作成の専門家です。
提供された参考資料に基づいて、正確で教育的価値の高い問題を作成します。

【重要な原則】
1. 参考資料の内容に忠実に基づくこと
2. 参考資料に明記されていない情報は推測しない
3. 具体的な数値やデータは参考資料から引用する
4. 解説には参考資料の該当箇所を明示する

【問題作成の品質基準】
- 実際の試験レベルに準じた専門性と難易度
- 正解は1つのみで明確に特定できる
- 誤答も技術的に検討が必要なレベル（引っ掛け問題）
- 解説は受験者の理解を深める教育的内容
`;
  }

  private getUserPrompt(config: QuestionConfig, sources: string): string {
    const difficultyDesc = {
      basic: '基礎レベル（基本的な知識・定義の確認）',
      standard: '標準レベル（実務的な知識の応用）',
      advanced: '応用レベル（複合的な思考が必要）',
    };

    return `
以下の参考資料に基づいて、コンクリート診断士試験の問題を1問作成してください。

${sources}

---

【作成する問題の条件】
- カテゴリー: ${config.category}
- テーマ: ${config.theme}
- 難易度: ${difficultyDesc[config.difficulty]}
- 問題番号: ${config.questionNumber}
- 問題形式: 4択問題

【出力形式】
以下のJSON形式で出力してください：

\`\`\`json
{
  "questionText": "問題文（200-400文字、参考資料の内容を反映）",
  "choices": [
    {
      "label": "A",
      "text": "選択肢A",
      "isCorrect": false
    },
    {
      "label": "B",
      "text": "選択肢B",
      "isCorrect": true
    },
    {
      "label": "C",
      "text": "選択肢C",
      "isCorrect": false
    },
    {
      "label": "D",
      "text": "選択肢D",
      "isCorrect": false
    }
  ],
  "explanation": "詳細な解説（300-600文字）。正解の根拠として参考資料の該当箇所を引用すること。",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "references": ["参考資料1のチャンクID", "参考資料2のチャンクID"]
}
\`\`\`

【重要な注意事項】
1. 正解は必ず1つのみ
2. 選択肢は参考資料に基づいた内容にする
3. 誤答も「もっともらしい」内容にする
4. 解説では参考資料のどの部分を根拠にしたか明記する
5. 具体的な数値やデータは参考資料から正確に引用する
`;
  }
}
```

### 4.2 バッチ生成スクリプト

```typescript
// scripts/batchGenerateRAG.ts
import { RAGQuestionGenerator } from './ragQuestionGenerator';
import { Question, Choice } from '../lib/types';
import * as fs from 'fs/promises';

// 検索クエリ定義
const SEARCH_QUERIES = [
  {
    category: 'CAT-01',
    categoryName: 'コンクリート材料学',
    theme: '中性化のメカニズムと進行過程',
    difficulty: 'basic' as const,
    searchQuery: {
      theme: '中性化のメカニズムと進行過程',
      searchText: '中性化 炭酸化 水酸化カルシウム CO2 pH',
      semanticQuery: 'コンクリートの中性化はどのようなメカニズムで進行するか？',
      top: 5,
    },
  },
  // ... 他の99テーマも同様に定義
];

async function batchGenerate() {
  const generator = new RAGQuestionGenerator();
  const allQuestions: Question[] = [];
  let questionNumber = 1;

  for (const config of SEARCH_QUERIES) {
    console.log(`\n=== Generating Q${questionNumber}: ${config.theme} ===`);

    try {
      const generated = await generator.generateQuestion({
        ...config,
        questionNumber,
      });

      // データ変換
      const correctChoice = generated.choices.find(c => c.isCorrect)!;
      const choices: Choice[] = generated.choices.map(c => ({
        id: `2024-q${String(questionNumber).padStart(3, '0')}-${c.label.toLowerCase()}`,
        text: c.text,
        isCorrect: c.isCorrect,
      }));

      const question: Question = {
        id: `2024-q${String(questionNumber).padStart(3, '0')}`,
        year: 2024,
        number: questionNumber,
        text: generated.questionText,
        choices,
        correctChoiceId: `2024-q${String(questionNumber).padStart(3, '0')}-${correctChoice.label.toLowerCase()}`,
        explanation: generated.explanation,
        category: config.category,
        difficulty: config.difficulty,
        keywords: generated.keywords,
        references: generated.references,
        sources: generated.sources, // RAG特有のメタデータ
      };

      allQuestions.push(question);
      questionNumber++;

      // Progress log
      console.log(`✅ Generated Q${questionNumber - 1}`);
      console.log(`   Sources: ${generated.sources.length} chunks`);

      // Rate limiting
      await sleep(3000);
    } catch (error) {
      console.error(`❌ Failed to generate Q${questionNumber}:`, error);
      questionNumber++;
    }
  }

  // 結果を保存
  const outputPath = './data/generated_questions_rag_2024.json';
  await fs.writeFile(outputPath, JSON.stringify(allQuestions, null, 2));

  console.log(`\n✅ Generated ${allQuestions.length} questions`);
  console.log(`📁 Saved to: ${outputPath}`);

  // トレーサビリティレポート作成
  await generateTraceabilityReport(allQuestions);
}

async function generateTraceabilityReport(questions: Question[]) {
  const report = questions.map(q => ({
    questionNumber: q.number,
    questionId: q.id,
    theme: q.keywords?.join(', '),
    sourcesCount: q.sources?.length || 0,
    sources: q.sources?.map(s => `${s.title} (p.${s.pageNumber || '?'}, chunk: ${s.chunkId})`).join('; '),
  }));

  const csvHeader = 'QuestionNumber,QuestionID,Theme,SourcesCount,Sources\n';
  const csvRows = report.map(r =>
    `${r.questionNumber},"${r.questionId}","${r.theme}",${r.sourcesCount},"${r.sources}"`
  ).join('\n');

  await fs.writeFile(
    './data/question_traceability_2024.csv',
    csvHeader + csvRows
  );

  console.log('📊 Traceability report saved');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

batchGenerate().catch(console.error);
```

---

## Phase 5: 実行とテスト

### 5.1 セットアップ手順

```bash
# パッケージインストール
npm install @azure/search-documents @azure/openai @azure/storage-blob

# PDFアップロード
npx ts-node scripts/uploadPDF.ts

# インデックス作成
npx ts-node scripts/createIndex.ts

# スキルセット・インデクサー作成（Azure Portal推奨）

# 検索テスト
npx ts-node scripts/testSearch.ts

# パイロット生成（10問）
npx ts-node scripts/pilotGenerateRAG.ts

# 本番生成（100問）
npx ts-node scripts/batchGenerateRAG.ts
```

### 5.2 トラブルシューティング

#### インデクサーが失敗する場合

```bash
# インデクサーステータス確認
az search indexer show \
  --name concrete-indexer \
  --service-name search-concrete-questions \
  --resource-group rg-concrete-app

# エラーログ確認
az search indexer show-status \
  --name concrete-indexer \
  --service-name search-concrete-questions \
  --resource-group rg-concrete-app
```

#### 検索結果が空の場合

- インデックスが正しく構築されているか確認
- 検索クエリの日本語が正しくトークン化されているか確認
- ベクトル検索の次元数が一致しているか確認

---

## 次のステップ

1. [ ] Azure AI Searchリソース作成
2. [ ] PDFアップロードとインデクサー実行
3. [ ] 検索機能のテスト
4. [ ] 10問のパイロット生成
5. [ ] プロンプト調整
6. [ ] 100問の本格生成

---

_作成日: 2025-10-13_
_最終更新: 2025-10-13_
_バージョン: 2.0 (RAG対応)_
