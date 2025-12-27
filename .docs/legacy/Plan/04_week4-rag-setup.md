# Week 4: Azure AI Search + RAG環境構築

**期間**: 第4週（5営業日）
**目標**: Azure AI Searchインフラ構築、PDF処理パイプライン実装

## Day 1: Azure AI Search リソース作成

### タスク 4.1: Azure AI Search サービス作成
- **工数**: 1時間
- **依存**: Week 1-3完了
- **スキル**: Azure CLI, Azure AI Search
- **成果物**: Azure AI Searchリソース

**手順**:
```bash
# Azure AI Search作成 (Standard S1)
az search service create \
  --name search-concrete-questions-dev \
  --resource-group concrete-app-dev-rg \
  --sku standard \
  --location japaneast \
  --partition-count 1 \
  --replica-count 1

# 管理キー取得
az search admin-key show \
  --service-name search-concrete-questions-dev \
  --resource-group concrete-app-dev-rg
```

**SKU選択理由**:
- **Standard S1**: ベクトル検索、セマンティック検索をサポート
- **コスト**: 約¥27,000/月
- **性能**: 100問生成には十分

**完了条件**:
- [ ] Azure AI Searchサービス作成完了
- [ ] 管理キー取得
- [ ] Azureポータルでアクセス確認
- [ ] `.env`に認証情報追加

---

### タスク 4.2: Azure OpenAI Serviceセットアップ
- **工数**: 1時間
- **依存**: タスク4.1
- **スキル**: Azure OpenAI Service
- **成果物**: GPT-4デプロイメント、Embeddingsデプロイメント

**手順**:
```bash
# Azure OpenAI リソース作成（まだの場合）
az cognitiveservices account create \
  --name openai-concrete-dev \
  --resource-group concrete-app-dev-rg \
  --kind OpenAI \
  --sku S0 \
  --location eastus

# GPT-4モデルデプロイ
az cognitiveservices account deployment create \
  --name openai-concrete-dev \
  --resource-group concrete-app-dev-rg \
  --deployment-name gpt-4 \
  --model-name gpt-4 \
  --model-version "0613" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name "Standard"

# Embeddingsモデルデプロイ
az cognitiveservices account deployment create \
  --name openai-concrete-dev \
  --resource-group concrete-app-dev-rg \
  --deployment-name text-embedding-ada-002 \
  --model-name text-embedding-ada-002 \
  --model-version "2" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name "Standard"
```

**完了条件**:
- [ ] OpenAIリソース作成完了
- [ ] GPT-4デプロイメント完了
- [ ] Embeddingsデプロイメント完了
- [ ] APIキー取得・環境変数設定

---

### タスク 4.3: Blob Storageコンテナ作成
- **工数**: 0.5時間
- **依存**: Week 1完了
- **スキル**: Azure Storage
- **成果物**: PDFアップロード用コンテナ

**手順**:
```bash
# 既存のStorage Accountを使用（Week 1で作成済み）
STORAGE_ACCOUNT="concreteappstorage"

# コンテナ作成
az storage container create \
  --name source-documents \
  --account-name $STORAGE_ACCOUNT \
  --public-access off

# コンテナ作成確認
az storage container list \
  --account-name $STORAGE_ACCOUNT \
  --output table
```

**完了条件**:
- [ ] `source-documents` コンテナ作成完了
- [ ] 接続文字列取得
- [ ] アクセス権限確認

---

### タスク 4.4: 環境変数設定ファイル作成
- **工数**: 0.5時間
- **依存**: タスク4.1, 4.2, 4.3
- **スキル**: 設定管理
- **成果物**: `.env.rag` ファイル

**実装**:
```bash
# .env.rag
# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://search-concrete-questions-dev.search.windows.net
AZURE_SEARCH_ADMIN_KEY=your-admin-key
AZURE_SEARCH_INDEX_NAME=concrete-documents
AZURE_SEARCH_INDEXER_NAME=concrete-indexer
AZURE_SEARCH_DATASOURCE_NAME=concrete-blob-datasource
AZURE_SEARCH_SKILLSET_NAME=concrete-skillset

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_NAME=source-documents
AZURE_STORAGE_BLOB_NAME=Concrete_Diagnostician_2024.pdf

# Azure OpenAI Service
AZURE_OPENAI_ENDPOINT=https://openai-concrete-dev.openai.azure.com/
AZURE_OPENAI_KEY=your-openai-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Cognitive Services (OCR用)
AZURE_COGNITIVE_SERVICES_KEY=your-cognitive-key
```

**`.gitignore` 追加**:
```bash
echo ".env.rag" >> .gitignore
```

**完了条件**:
- [ ] `.env.rag` ファイル作成
- [ ] 全認証情報記載
- [ ] `.env.rag.example` テンプレート作成
- [ ] `.gitignore` 更新確認

---

## Day 2: PDFアップロード・インデックス作成

### タスク 4.5: PDFアップロードスクリプト実装
- **工数**: 1.5時間
- **依存**: タスク4.3
- **スキル**: TypeScript, Azure SDK
- **成果物**: PDFアップロードスクリプト

**実装** (`scripts/rag/uploadPDF.ts`):
```typescript
import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.rag' });

async function uploadPDF() {
  console.log('📁 Starting PDF upload...\n');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
  const blobName = process.env.AZURE_STORAGE_BLOB_NAME!;

  // BlobServiceClient初期化
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // PDFファイルパス
  const filePath = path.join(
    __dirname,
    '../../question_creation_data/Concrete_Diagnostician _ 2024.pdf'
  );

  // ファイル存在確認
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📄 File: ${path.basename(filePath)}`);
  console.log(`📊 Size: ${fileSizeMB} MB\n`);

  // アップロード
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  console.log('⬆️  Uploading to Azure Blob Storage...');
  const uploadResponse = await blockBlobClient.uploadFile(filePath, {
    metadata: {
      title: 'コンクリート診断士試験参考資料',
      year: '2024',
      documentType: 'reference_material',
      uploadDate: new Date().toISOString(),
    },
    blobHTTPHeaders: {
      blobContentType: 'application/pdf',
    },
  });

  console.log(`✅ Upload completed successfully!`);
  console.log(`   Request ID: ${uploadResponse.requestId}`);
  console.log(`   URL: ${blockBlobClient.url}\n`);

  // 検証
  const properties = await blockBlobClient.getProperties();
  console.log('✔️  Verification:');
  console.log(`   Content Length: ${properties.contentLength} bytes`);
  console.log(`   Content Type: ${properties.contentType}`);
  console.log(`   Metadata: ${JSON.stringify(properties.metadata, null, 2)}`);
}

uploadPDF().catch((error) => {
  console.error('❌ Upload failed:', error.message);
  process.exit(1);
});
```

**package.json スクリプト追加**:
```json
{
  "scripts": {
    "rag:upload": "ts-node scripts/rag/uploadPDF.ts"
  }
}
```

**完了条件**:
- [ ] スクリプト実装完了
- [ ] PDF正常アップロード
- [ ] メタデータ設定確認
- [ ] Blob URLアクセス確認

---

### タスク 4.6: 検索インデックス作成スクリプト実装
- **工数**: 2時間
- **依存**: タスク4.1
- **スキル**: TypeScript, Azure AI Search SDK
- **成果物**: インデックス作成スクリプト

**実装** (`scripts/rag/createIndex.ts`):
```typescript
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.rag' });

async function createIndex() {
  console.log('🔍 Creating Azure AI Search index...\n');

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
        sortable: false,
        searchable: false,
      },
      {
        name: 'content',
        type: 'Edm.String',
        searchable: true,
        filterable: false,
        sortable: false,
        analyzer: 'ja.microsoft', // 日本語アナライザー
      },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        dimensions: 1536, // text-embedding-ada-002の次元数
        vectorSearchProfile: 'vector-profile',
      },
      {
        name: 'title',
        type: 'Edm.String',
        searchable: true,
        filterable: true,
        sortable: true,
      },
      {
        name: 'metadata',
        type: 'Edm.String',
        searchable: true,
        filterable: false,
      },
      {
        name: 'pageNumber',
        type: 'Edm.Int32',
        filterable: true,
        sortable: true,
        facetable: true,
      },
      {
        name: 'chunkId',
        type: 'Edm.String',
        filterable: true,
        sortable: false,
      },
    ],
    vectorSearch: {
      algorithms: [
        {
          name: 'vector-algorithm',
          kind: 'hnsw',
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
          algorithmConfigurationName: 'vector-algorithm',
        },
      ],
    },
    semantic: {
      configurations: [
        {
          name: 'semantic-config',
          prioritizedFields: {
            titleField: {
              fieldName: 'title',
            },
            contentFields: [
              {
                fieldName: 'content',
              },
            ],
          },
        },
      ],
    },
  };

  console.log(`📝 Index name: ${indexName}`);
  console.log(`📊 Fields: ${index.fields.length}`);
  console.log(`🔍 Vector search: Enabled (HNSW)`);
  console.log(`🧠 Semantic search: Enabled\n`);

  console.log('Creating index...');
  const result = await client.createOrUpdateIndex(index as any);

  console.log(`✅ Index created successfully: ${result.name}`);
}

createIndex().catch((error) => {
  console.error('❌ Index creation failed:', error.message);
  process.exit(1);
});
```

**完了条件**:
- [ ] インデックス作成スクリプト実装
- [ ] インデックス正常作成
- [ ] ベクトル検索設定確認
- [ ] セマンティック検索設定確認

---

### タスク 4.7: データソース作成スクリプト実装
- **工数**: 1時間
- **依存**: タスク4.5, 4.6
- **スキル**: TypeScript, Azure AI Search SDK
- **成果物**: データソース作成スクリプト

**実装** (`scripts/rag/createDataSource.ts`):
```typescript
import { SearchIndexerClient, AzureKeyCredential } from '@azure/search-documents';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.rag' });

async function createDataSource() {
  console.log('📦 Creating data source...\n');

  const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
  const apiKey = process.env.AZURE_SEARCH_ADMIN_KEY!;
  const dataSourceName = process.env.AZURE_SEARCH_DATASOURCE_NAME!;

  const client = new SearchIndexerClient(endpoint, new AzureKeyCredential(apiKey));

  const dataSource = {
    name: dataSourceName,
    type: 'azureblob',
    credentials: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
    },
    container: {
      name: process.env.AZURE_STORAGE_CONTAINER_NAME!,
    },
    dataChangeDetectionPolicy: {
      '@odata.type': '#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy',
      highWaterMarkColumnName: '_ts',
    },
  };

  console.log(`📝 Data source name: ${dataSourceName}`);
  console.log(`📁 Container: ${dataSource.container.name}\n`);

  console.log('Creating data source...');
  await client.createOrUpdateDataSourceConnection(dataSource as any);

  console.log('✅ Data source created successfully');
}

createDataSource().catch((error) => {
  console.error('❌ Data source creation failed:', error.message);
  process.exit(1);
});
```

**完了条件**:
- [ ] データソース作成完了
- [ ] Blob Storageとの接続確認
- [ ] 変更検出ポリシー設定確認

---

## Day 3: スキルセット・インデクサー作成

### タスク 4.8: スキルセット作成（Azure Portal）
- **工数**: 2時間
- **依存**: タスク4.7
- **スキル**: Azure AI Search, Cognitive Services
- **成果物**: スキルセット設定

**スキルセット構成**:
1. **OCR Skill** - PDFからテキスト抽出
2. **Merge Skill** - テキスト統合
3. **Split Skill** - チャンキング（1,000トークン、200オーバーラップ）
4. **Embedding Skill** - ベクトル化

**Azure Portalでの作成手順**:
1. Azure AI Searchリソースを開く
2. 「スキルセット」→「+ 追加」
3. 以下のJSONを入力:

```json
{
  "name": "concrete-skillset",
  "description": "PDF processing skillset for concrete diagnostician content",
  "skills": [
    {
      "@odata.type": "#Microsoft.Skills.Vision.OcrSkill",
      "name": "OCR",
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
      "name": "Merge",
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
      "name": "Split",
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
      "name": "Embedding",
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
    "key": "${AZURE_COGNITIVE_SERVICES_KEY}"
  },
  "knowledgeStore": null
}
```

**完了条件**:
- [ ] スキルセット作成完了
- [ ] 各スキルの設定確認
- [ ] Cognitive Services接続確認

---

### タスク 4.9: インデクサー作成・実行
- **工数**: 2時間
- **依存**: タスク4.8
- **スキル**: Azure AI Search
- **成果物**: インデクサー、インデックス済みデータ

**インデクサー設定** (Azure Portal):
```json
{
  "name": "concrete-indexer",
  "dataSourceName": "concrete-blob-datasource",
  "targetIndexName": "concrete-documents",
  "skillsetName": "concrete-skillset",
  "schedule": null,
  "parameters": {
    "batchSize": 1,
    "maxFailedItems": 0,
    "maxFailedItemsPerBatch": 0,
    "configuration": {
      "dataToExtract": "contentAndMetadata",
      "imageAction": "generateNormalizedImages",
      "parsingMode": "default"
    }
  },
  "fieldMappings": [
    {
      "sourceFieldName": "metadata_storage_path",
      "targetFieldName": "id",
      "mappingFunction": {
        "name": "base64Encode"
      }
    },
    {
      "sourceFieldName": "metadata_storage_name",
      "targetFieldName": "title"
    }
  ],
  "outputFieldMappings": [
    {
      "sourceFieldName": "/document/pages/*",
      "targetFieldName": "content"
    },
    {
      "sourceFieldName": "/document/pages/*/vector",
      "targetFieldName": "contentVector"
    }
  ]
}
```

**実行・監視**:
```bash
# インデクサー実行
az search indexer run \
  --name concrete-indexer \
  --service-name search-concrete-questions-dev \
  --resource-group concrete-app-dev-rg

# ステータス確認
az search indexer show-status \
  --name concrete-indexer \
  --service-name search-concrete-questions-dev \
  --resource-group concrete-app-dev-rg
```

**完了条件**:
- [ ] インデクサー作成完了
- [ ] インデクサー実行成功
- [ ] インデックスにデータ投入確認（ドキュメント数 > 0）
- [ ] エラーなし確認

---

## Day 4: 検索機能実装・テスト

### タスク 4.10: 検索サービスクラス実装
- **工数**: 3時間
- **依存**: タスク4.9
- **スキル**: TypeScript, Azure AI Search SDK
- **成果物**: 検索サービスクラス

**実装** (`lib/services/searchService.ts`):
```typescript
import {
  SearchClient,
  AzureKeyCredential,
  SearchOptions,
} from '@azure/search-documents';
import { OpenAIClient, AzureKeyCredential as OpenAIKeyCredential } from '@azure/openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.rag' });

export interface SearchQuery {
  theme: string;
  searchText: string;
  semanticQuery: string;
  filter?: string;
  top?: number;
}

export interface SearchResult {
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
      new OpenAIKeyCredential(openAIKey)
    );

    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;
  }

  /**
   * ハイブリッド検索（テキスト + ベクトル + セマンティック）
   */
  async hybridSearch(query: SearchQuery): Promise<SearchResult[]> {
    console.log(`🔍 Searching for: "${query.theme}"`);

    // クエリのベクトル化
    const queryVector = await this.getEmbedding(query.semanticQuery);

    const searchOptions: SearchOptions<any> = {
      top: query.top || 5,
      select: ['id', 'content', 'title', 'pageNumber', 'chunkId'],
      searchFields: ['content'],
      vectors: [
        {
          value: queryVector,
          kNearestNeighborsCount: query.top || 5,
          fields: ['contentVector'],
        },
      ],
      queryType: 'semantic',
      semanticConfiguration: 'semantic-config',
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
        chunkId: result.document.chunkId || result.document.id,
      });
    }

    console.log(`   Found ${searchResults.length} results`);
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

**完了条件**:
- [ ] 検索サービスクラス実装完了
- [ ] ハイブリッド検索実装
- [ ] エンベディング機能実装
- [ ] プロンプト整形機能実装

---

### タスク 4.11: 検索テストスクリプト実装
- **工数**: 1.5時間
- **依存**: タスク4.10
- **スキル**: TypeScript
- **成果物**: 検索テストスクリプト

**実装** (`scripts/rag/testSearch.ts`):
```typescript
import { ConcreteSearchService } from '../../lib/services/searchService';

async function testSearch() {
  console.log('🧪 Testing Azure AI Search...\n');

  const searchService = new ConcreteSearchService();

  // テストクエリ
  const testQueries = [
    {
      theme: '中性化のメカニズム',
      searchText: '中性化 炭酸化 水酸化カルシウム',
      semanticQuery: 'コンクリートの中性化はどのようなメカニズムで進行するか？',
      top: 3,
    },
    {
      theme: 'ひび割れの原因',
      searchText: 'ひび割れ クラック 原因 種類',
      semanticQuery: 'コンクリートのひび割れの主な原因は何か？',
      top: 3,
    },
  ];

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テーマ: ${query.theme}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = await searchService.hybridSearch(query);

    if (results.length === 0) {
      console.log('❌ No results found');
      continue;
    }

    console.log(`✅ Found ${results.length} results:\n`);

    results.forEach((result, index) => {
      console.log(`[${index + 1}] Score: ${(result.score * 100).toFixed(1)}%`);
      console.log(`    Chunk ID: ${result.chunkId}`);
      console.log(`    Content preview: ${result.content.substring(0, 150)}...`);
      console.log('');
    });

    // プロンプト整形テスト
    console.log('📝 Formatted for prompt:\n');
    const formatted = searchService.formatSearchResultsForPrompt(results.slice(0, 2));
    console.log(formatted.substring(0, 500) + '...\n');
  }

  console.log('✅ Search test completed');
}

testSearch().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
```

**完了条件**:
- [ ] テストスクリプト実装
- [ ] 複数クエリでテスト成功
- [ ] 検索結果の品質確認
- [ ] スコアリング適切性確認

---

## Day 5: ドキュメント作成・Week完了確認

### タスク 4.12: RAG環境セットアップガイド作成
- **工数**: 2時間
- **依存**: Day 1-4完了
- **スキル**: 技術文書作成
- **成果物**: セットアップガイド

**ドキュメント** (`docs/rag/setup-guide.md`):
- Azure リソース作成手順
- 環境変数設定方法
- トラブルシューティング
- よくある質問

**完了条件**:
- [ ] セットアップガイド作成
- [ ] 手順書の検証完了
- [ ] スクリーンショット追加

---

### タスク 4.13: Week 4 完了確認・レビュー
- **工数**: 2時間
- **依存**: 全タスク完了
- **スキル**: プロジェクト管理
- **成果物**: Week 4完了レポート

**確認項目**:
```markdown
# Week 4 完了チェックリスト

## Azure環境
- [ ] Azure AI Search作成完了
- [ ] Azure OpenAI Service設定完了
- [ ] Blob Storage設定完了
- [ ] 環境変数設定完了

## PDF処理
- [ ] PDFアップロード成功
- [ ] インデックス作成完了
- [ ] スキルセット設定完了
- [ ] インデクサー実行成功

## 検索機能
- [ ] 検索サービスクラス実装完了
- [ ] ハイブリッド検索動作確認
- [ ] 検索品質確認
- [ ] テストスクリプト動作確認

## コスト
- [ ] Azure AI Search: 約¥27,000/月
- [ ] Azure OpenAI: 約¥5,000/月（見積もり）
- [ ] Blob Storage: 約¥100/月
- [ ] 合計: 約¥32,100/月

## 次週準備
- [ ] Week 5計画確認
- [ ] 問題生成用テーマリスト準備
- [ ] GPT-4プロンプト初期設計
```

**完了条件**:
- [ ] 全チェックリスト完了
- [ ] Week 4レポート作成
- [ ] Week 5キックオフ準備完了

---

## Week 4 トラブルシューティング

### インデクサーエラー
```bash
# エラーログ確認
az search indexer show-status \
  --name concrete-indexer \
  --service-name search-concrete-questions-dev \
  --resource-group concrete-app-dev-rg \
  --query 'lastResult.errors' \
  --output table
```

**よくあるエラー**:
- **OCRエラー**: Cognitive Servicesキーが無効
- **Embeddingエラー**: OpenAIデプロイメント名が間違っている
- **タイムアウト**: PDFが大きすぎる（batchSize=1に設定）

### 検索結果が空
1. インデックスにドキュメントがあるか確認
2. 日本語アナライザーが正しく設定されているか確認
3. ベクトル検索の次元数が1536か確認

### コスト超過
- インデクサーをスケジュール実行せず、手動実行にする
- 不要なインデックスを削除する
- Standard S1からBasicにダウングレード（ベクトル検索不可）

---

## 次週への引き継ぎ

**Week 5で実施すること**:
1. RAG問題生成パイプライン実装
2. GPT-4プロンプト設計・最適化
3. パイロット生成（10問）
4. プロンプト改善

**準備事項**:
- 問題テーマリスト（`07_question-themes-list.md`）確認
- GPT-4のレート制限確認
- 生成問題の評価基準策定

---

## 実装記録（2025-10-13）

### Azure CLIデプロイ方式の採用

**採用理由**:
- Bicepと比較してエラーが少なく、デバッグが容易
- リソースの状態確認とエラーハンドリングが柔軟
- PowerShellスクリプトによる自動化が可能

**実装ファイル**:
- `scripts/azure/deploy-week4-resources.ps1` - 統合デプロイスクリプト
- `scripts/azure/deploy-openai.ps1` - OpenAI専用デプロイスクリプト（予備）

### デプロイ完了リソース

#### Azure AI Search
- **サービス名**: search-concrete-questions-dev
- **SKU**: Standard S1
- **エンドポイント**: https://search-concrete-questions-dev.search.windows.net
- **月額コスト**: 約¥27,000

#### Azure Blob Storage
- **アカウント名**: concreteragstoragedev
- **コンテナ名**: source-documents
- **アクセス層**: Hot
- **月額コスト**: 約¥100

#### Azure OpenAI Service
- **サービス名**: concrete-openai-dev
- **リージョン**: East US（Japan Eastでは利用不可のため）
- **エンドポイント**: https://eastus.api.cognitive.microsoft.com/

**デプロイ済みモデル**:
1. **gpt-4o-mini** (2024-07-18)
   - SKU: Standard
   - 容量: 50K TPM
   - 選定理由: クォータ制約により当初予定のgpt-4.1からダウングレード。コスト効率が高く、問題生成に十分な性能を持つ

2. **text-embedding-3-small** (version 1)
   - SKU: Standard
   - 容量: 1K TPM
   - 選定理由: text-embedding-3-largeのクォータ不足により選定。ベクトル次元数は1536から調整が必要

**クォータ制約対応の経緯**:
1. 当初計画: gpt-4.1 (GlobalStandard) + text-embedding-3-large
2. 問題発生: 両モデルともクォータ不足（既存リソースで使用済み）
3. 最終決定: gpt-4o-mini (Standard) + text-embedding-3-small
   - 既存リソースへの影響を避けるため、別クォータプールを使用
   - コスト効率を重視

### TypeScript実行環境の修正

**問題**:
- Expo/React Nativeプロジェクトで`ts-node`がESM互換性エラーを発生
- エラー内容: "Unknown file extension '.ts'"

**原因**:
- `tsconfig.json`が`expo/tsconfig.base`を継承
- Expoの設定がESM環境を想定しており、ts-nodeのデフォルト設定と競合

**解決策**:
1. `tsx`パッケージをインストール（v4.20.6）
2. package.jsonのRAGスクリプトを修正:
   ```json
   "rag:upload": "tsx scripts/rag/uploadPDF.ts",
   "rag:create-index": "tsx scripts/rag/createIndex.ts",
   "rag:create-datasource": "tsx scripts/rag/createDataSource.ts",
   "rag:test-search": "tsx scripts/rag/testSearch.ts"
   ```

**実行結果**:
- 352.34 MBのPDFファイルのアップロードに成功
- Blob Storage コンテナ `source-documents` に正常格納

### 環境変数ファイル

`.env.rag`の最終設定:
```env
# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://search-concrete-questions-dev.search.windows.net
AZURE_SEARCH_ADMIN_KEY=***
AZURE_SEARCH_INDEX_NAME=concrete-questions-index

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=***
AZURE_STORAGE_ACCOUNT_NAME=concreteragstoragedev
AZURE_STORAGE_CONTAINER_NAME=source-documents

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_OPENAI_API_KEY=***
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**注意事項**:
- `AZURE_OPENAI_API_VERSION`はREST APIのバージョンであり、モデルバージョン（2024-07-18）とは別の概念
- APIバージョンは変更不要（2024-02-15-previewで固定）

### 実行環境の選択

**PowerShellが必須**:
- Azure Blob StorageへのネットワークアクセスにはWindows PowerShellが必要
- WSL2は仮想ネットワーク分離のため、Azureリソースへのアクセスに制約あり
- 開発時のファイル編集はWSL/VSCode、実行はPowerShellという使い分けが推奨

**実行例**:
```powershell
cd C:\Users\banqu\IOS_App_Dev\concrete_diagnostician
npm run rag:upload
```

---

## Phase 2.0: Azure AI Document Intelligence統合（次期計画）

### 目的
PDFから図・表・グラフなどの視覚情報を抽出し、RAGシステムの精度と情報量を向上させる。

### 背景
- **現状**: テキスト情報のみ抽出（OCR Skillによる基本的な文字認識）
- **課題**: コンクリート診断士試験資料は図が豊富（500ページ中、多数の写真・構造図・グラフを含む）
- **影響**: 視覚情報の欠落により、劣化状態の写真、構造図、データグラフなどの重要情報が失われる

### 技術スタック

#### Azure AI Document Intelligence
- **利用API**: Layout Analysis API / Prebuilt Models
- **抽出可能情報**:
  - 表構造の認識と抽出
  - 図・画像の検出と位置情報
  - テキストと図の関連付け
  - ページレイアウト構造の解析

#### 補助技術（オプション）
- **GPT-4 Vision / GPT-4o**: 抽出した図・表の内容理解と説明文生成
- **Azure Computer Vision**: 画像の詳細分析（劣化状態の判定など）

### 実装スコープ

#### フェーズ2.1: Document Intelligence基本統合
1. **Document Intelligence APIセットアップ**
   - Azure Cognitive Servicesリソース作成
   - API認証設定

2. **PDF解析パイプライン拡張**
   - 現行の`uploadPDF.ts`を拡張
   - Document Intelligence APIによる詳細解析の追加

3. **図・表メタデータの抽出**
   - 図の位置情報（ページ番号、座標）
   - 表データの構造化
   - キャプションテキストの関連付け

4. **Azure Blob Storageへの画像格納**
   - 抽出した図を個別の画像ファイルとして保存
   - メタデータと画像の紐付け

#### フェーズ2.2: マルチモーダル検索の実装
1. **GPT-4 Visionによる画像説明生成**
   - 抽出した図に対する説明文の自動生成
   - 図の内容を含めたテキスト検索の実現

2. **Search Indexの拡張**
   - 図の説明文フィールドを追加
   - 図とテキストの統合検索

3. **検索UIの改善**
   - 検索結果に図を含めて表示
   - 図の関連性スコアリング

### 参考実装
`C:\Users\banqu\OneDrive\ドキュメント\勉強\RAG構築\2Q-PoC\③-1 AIサーチインデックス作成_抽象型_先進技術開発_2.ipynb`

このノートブックには以下の実装例が含まれる（推定）:
- Document Intelligence APIの呼び出し方法
- 抽出データの構造化方法
- Search Indexへの統合パターン

### コスト見積もり（追加分）

| サービス | 月額見積もり | 備考 |
|---------|------------|------|
| Azure AI Document Intelligence | ¥3,000-5,000 | 500ページPDFの月次解析 |
| GPT-4 Vision API | ¥2,000-4,000 | 図の説明生成（オプション） |
| Azure Blob Storage（画像） | ¥300-500 | 抽出画像の保存 |
| **合計追加コスト** | **¥5,300-9,500/月** | |

### 実装優先度
**優先度**: 中（ユーザーフィードバック後に判断）

**判断基準**:
1. MVPリリース後のユーザーフィードバックで「図の説明が欲しい」という要望が多数ある
2. テキストのみのRAGでは問題生成の品質が不十分と判明
3. 予算的に追加コスト（月額¥5,000-10,000）が許容される

**実装タイミング**:
- MVP正式リリース後（Week 12以降）
- 初期ユーザーフィードバック収集後（リリースから1-2ヶ月後）
- バージョン2.0のメジャーアップデートとして実装

### 技術的課題と対策

#### 課題1: 処理時間の増加
- Document Intelligence APIは処理に時間がかかる（500ページで10-20分程度）
- **対策**: バックグラウンドジョブとして非同期処理、進捗表示UIの実装

#### 課題2: コストの増加
- GPT-4 Visionは従量課金で高額になる可能性
- **対策**: 重要な図のみを選別してVision処理、またはバッチ処理でコスト最適化

#### 課題3: 検索品質の評価
- 図の説明文が適切かどうかの評価が難しい
- **対策**: 専門家による抜き打ちレビュー、ユーザーフィードバック機能の実装

### 開発ロードマップ（Phase 2.0）

| フェーズ | 期間 | タスク | 成果物 |
|---------|------|--------|--------|
| 2.1 基本統合 | 1週間 | Document Intelligence統合、図抽出 | 図メタデータ、画像ファイル |
| 2.2 説明生成 | 1週間 | GPT-4 Vision統合、説明文生成 | 図の説明文データ |
| 2.3 検索統合 | 1週間 | Search Index拡張、検索UI改善 | マルチモーダル検索機能 |
| 2.4 テスト | 3日 | 統合テスト、品質評価 | テストレポート |

**総工数**: 約3週間（MVPの約60%の追加工数）

---

## セマンティックランカー実装（2025-10-13）

### 概要
Azure AI Searchのセマンティックランカー（Semantic Ranker）を有効化し、検索精度を向上させる実装を追加。

### セマンティック検索 vs セマンティックランカー

#### セマンティック検索（Semantic Search）
- **機能**: クエリとドキュメントの意味的類似性を基本的に理解
- **実装**: `semanticSearch` 設定と `semantic-config` の定義
- **現状**: 既に実装済み（createIndex.tsのLines 153-170）

#### セマンティックランカー（Semantic Ranker）
- **機能**: 深層学習モデルによる検索結果の再スコアリング
- **効果**: より高精度な関連性ランキング、文脈理解の向上
- **コスト**: 追加で約¥1,000-2,000/月
- **言語サポート**: 日本語対応（`ja-JP`）

### 実装変更

#### 1. インデックス設定（createIndex.ts）

**変更箇所**: Lines 153-170

**変更前**:
```typescript
semanticSearch: {
  configurations: [
    {
      name: 'semantic-config',
      prioritizedFields: {
        titleField: {
          fieldName: 'title',
        },
        contentFields: [
          {
            fieldName: 'content',
          },
        ],
      },
    },
  ],
},
```

**変更後**:
```typescript
semanticSearch: {
  configurations: [
    {
      name: 'semantic-config',
      prioritizedFields: {
        titleField: {
          fieldName: 'title',
        },
        contentFields: [
          {
            fieldName: 'content',
          },
        ],
        keywordFields: [], // Semantic ranker対応
      },
    },
  ],
},
```

#### 2. 検索実行ロジック（searchService.ts）

**変更箇所**: Lines 216-232（`hybridSearch`メソッド）

**追加パラメータ**:
```typescript
const searchOptions: SearchOptions<any> = {
  top: query.top || 5,
  filter: query.filter,
  vectors: [
    {
      value: queryVector,
      kNearestNeighborsCount: query.top || 5,
      fields: ['contentVector'],
    },
  ],
  queryType: query.useSemanticSearch !== false ? 'semantic' : 'simple',
  semanticConfiguration:
    query.useSemanticSearch !== false ? 'semantic-config' : undefined,
  queryLanguage: 'ja-JP', // 日本語セマンティックランカー
  semanticMaxWaitInMilliseconds: 1000, // ランカー処理タイムアウト
  select: ['chunkId', 'content', 'title', 'metadata_storage_name', 'pageNumber', 'category'],
};
```

### 期待される効果

1. **検索精度の向上**:
   - 単純なキーワードマッチングを超えた、文脈理解に基づく検索
   - 同義語、類義語の自動認識

2. **日本語特有の表現への対応**:
   - 助詞の違いによる意味の差異を理解
   - 専門用語と一般用語の関連付け

3. **RAG生成品質の向上**:
   - より関連性の高いコンテキストの取得
   - 問題生成時の情報の正確性向上

### テスト方法

インデックス再作成後、以下のコマンドでテスト:

```bash
# インデックスを再作成（セマンティックランカー有効化）
npm run rag:create-index recreate

# 検索テストを実行
npm run rag:test-search
```

### コスト影響

| 項目 | 追加コスト | 備考 |
|-----|----------|------|
| セマンティックランカー | ¥1,000-2,000/月 | 使用量に応じた従量課金 |

**総月額コスト（更新後）**: 約¥33,100-34,100/月

### 実装ファイル

- `scripts/rag/createIndex.ts`: Lines 153-170 (keywordFields追加)
- `lib/services/searchService.ts`: Lines 229-230 (queryLanguage, semanticMaxWaitInMilliseconds追加)

### Azure Portal でのセマンティック構成設定（重要な注意点）

TypeScript SDK でのインデックス作成時にセマンティック設定が失敗したため、最終的に **Azure Portal の GUI** から設定しました。

#### 設定手順（2025-10-13実施）

1. Azure Portal で `search-concrete-questions-dev` を開く
2. 「インデックス」→ `concrete-questions-index` を選択
3. 「Semantic configurations」セクションに移動
4. Title field: `title` を選択
5. Content fields: `content` を選択
6. **⚠️ 重要**: 設定後、必ず **チェックマーク（✅）をクリックして保存**すること

**注意事項**:
- 設定を入力しただけでは保存されない
- **チェックマーク（✅）を押さないと、セマンティック構成が有効化されない**
- `npm run rag:create-index list` で「セマンティック検索: 有効」と表示されることを確認

#### 失敗時の症状
- Portal で設定を入力したが、チェックマークを押し忘れた
- `npm run rag:create-index list` で「セマンティック検索: 無効」と表示される
- 検索時にセマンティックランカーが機能しない

#### 確認方法
```powershell
npm run rag:create-index list
```

出力例（正しく設定された場合）:
```
1. concrete-questions-index
   フィールド数: 9
   ベクトル検索: 有効
   セマンティック検索: 有効  ← これが「有効」になっていること
```
