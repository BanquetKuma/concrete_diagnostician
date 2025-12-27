# Azure Infrastructure Setup Guide

このドキュメントでは、コンクリート診断士試験対策アプリのAzureインフラストラクチャの構築手順を説明します。

## 前提条件

- Azureサブスクリプションを持っていること
- Azure CLI がインストールされていること
- 適切な権限（サブスクリプション共同作成者以上）を持っていること

## 1. リソースグループの作成

```bash
# 開発環境用
az group create --name concrete-exam-app-dev --location japaneast

# 本番環境用
az group create --name concrete-exam-app-prod --location japaneast
```

## 2. Azure Cosmos DB の設定

### 2.1 Cosmos DB アカウントの作成

```bash
# 開発環境
az cosmosdb create \
  --name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --default-consistency-level Session \
  --locations regionName=japaneast failoverPriority=0 isZoneRedundant=False

# 本番環境
az cosmosdb create \
  --name concrete-exam-cosmosdb-prod \
  --resource-group concrete-exam-app-prod \
  --default-consistency-level Session \
  --locations regionName=japaneast failoverPriority=0 isZoneRedundant=True
```

### 2.2 データベースとコンテナーの作成

```bash
# データベース作成
az cosmosdb sql database create \
  --account-name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --name ConcreteExamAppDev

# コンテナー作成
az cosmosdb sql container create \
  --account-name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --database-name ConcreteExamAppDev \
  --name Users \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --database-name ConcreteExamAppDev \
  --name Questions \
  --partition-key-path "/year" \
  --throughput 400

az cosmosdb sql container create \
  --account-name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --database-name ConcreteExamAppDev \
  --name UserAnswers \
  --partition-key-path "/userId" \
  --throughput 400

az cosmosdb sql container create \
  --account-name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --database-name ConcreteExamAppDev \
  --name StudyProgress \
  --partition-key-path "/userId" \
  --throughput 400
```

## 3. Azure Functions の設定

### 3.1 Functions App の作成

```bash
# ストレージアカウント作成（Functions用）
az storage account create \
  --name concreteexamfuncdev \
  --resource-group concrete-exam-app-dev \
  --location japaneast \
  --sku Standard_LRS

# Functions App作成
az functionapp create \
  --name concrete-exam-functions-dev \
  --resource-group concrete-exam-app-dev \
  --storage-account concreteexamfuncdev \
  --consumption-plan-location japaneast \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

### 3.2 Function App の設定

```bash
# アプリ設定
az functionapp config appsettings set \
  --name concrete-exam-functions-dev \
  --resource-group concrete-exam-app-dev \
  --settings \
  COSMOS_DB_ENDPOINT="https://concrete-exam-cosmosdb-dev.documents.azure.com:443/" \
  COSMOS_DB_KEY="<your-cosmos-key>" \
  DATABASE_NAME="ConcreteExamAppDev"
```

## 4. Azure OpenAI Service の設定

### 4.1 Azure OpenAI リソースの作成

```bash
az cognitiveservices account create \
  --name concrete-exam-openai-dev \
  --resource-group concrete-exam-app-dev \
  --location eastus \
  --kind OpenAI \
  --sku S0
```

### 4.2 モデルデプロイメント

```bash
# GPT-4モデルのデプロイ
az cognitiveservices account deployment create \
  --name concrete-exam-openai-dev \
  --resource-group concrete-exam-app-dev \
  --deployment-name gpt-4 \
  --model-name gpt-4 \
  --model-version "0613" \
  --model-format OpenAI \
  --scale-settings-scale-type "Standard"
```

## 5. Azure Blob Storage の設定

### 5.1 ストレージアカウントの作成

```bash
az storage account create \
  --name concreteexamstorage \
  --resource-group concrete-exam-app-dev \
  --location japaneast \
  --sku Standard_LRS \
  --access-tier Hot
```

### 5.2 コンテナーの作成

```bash
az storage container create \
  --name exam-resources \
  --account-name concreteexamstorage \
  --auth-mode login \
  --public-access off
```

## 6. Azure Application Insights の設定

```bash
az monitor app-insights component create \
  --app concrete-exam-insights-dev \
  --location japaneast \
  --resource-group concrete-exam-app-dev \
  --application-type web
```

## 7. 接続文字列の取得

### Cosmos DB

```bash
az cosmosdb keys list \
  --name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --type keys
```

### OpenAI Service

```bash
az cognitiveservices account keys list \
  --name concrete-exam-openai-dev \
  --resource-group concrete-exam-app-dev
```

### Storage Account

```bash
az storage account keys list \
  --account-name concreteexamstorage \
  --resource-group concrete-exam-app-dev
```

### Application Insights

```bash
az monitor app-insights component show \
  --app concrete-exam-insights-dev \
  --resource-group concrete-exam-app-dev \
  --query connectionString
```

## 8. セキュリティ設定

### 8.1 アクセス制限の設定

```bash
# Functions App のCORS設定
az functionapp cors add \
  --name concrete-exam-functions-dev \
  --resource-group concrete-exam-app-dev \
  --allowed-origins "*"
```

### 8.2 Key Vault の設定（オプション）

```bash
az keyvault create \
  --name concrete-exam-kv-dev \
  --resource-group concrete-exam-app-dev \
  --location japaneast
```

## 9. 監視とアラート

### 9.1 基本アラートルールの設定

```bash
# 高いエラー率のアラート
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group concrete-exam-app-dev \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/concrete-exam-app-dev/providers/Microsoft.Web/sites/concrete-exam-functions-dev" \
  --condition "avg exceptions/server > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## 10. バックアップとディザスタリカバリ

### 10.1 Cosmos DB の継続的バックアップ

```bash
az cosmosdb update \
  --name concrete-exam-cosmosdb-dev \
  --resource-group concrete-exam-app-dev \
  --backup-policy-type Continuous
```

## 次のステップ

1. `.env`ファイルを作成し、上記で取得した接続文字列を設定
2. Azure Functions プロジェクトの作成とデプロイ
3. サンプルデータの投入とテスト
4. 本番環境への同様の設定適用

## 注意事項

- **コスト管理**: 開発環境では最小構成を使用し、不要な時は停止する
- **セキュリティ**: 本番環境では適切なアクセス制御とKey Vaultを使用する
- **監視**: Application Insights を活用して、パフォーマンスとエラーを監視する
