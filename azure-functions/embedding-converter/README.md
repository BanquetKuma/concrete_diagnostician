# Embedding Converter - Custom Web API Skill

Azure AI Search用のカスタムスキルで、エンベディングベクトルをFloat32に明示的に変換します。

## 🎯 Purpose

Azure OpenAI Embedding SkillがCollection(Edm.Double)を返すため、Azure AI SearchのCollection(Edm.Single)フィールドと互換性がない問題を解決します。

## 📋 Prerequisites

- Python 3.9 or higher
- Azure Functions Core Tools (`func`)
- Azure CLI (`az`)
- Azure subscription with:
  - Azure Functions resource
  - Azure OpenAI Service deployment (text-embedding-3-small or ada-002)

## 🛠️ Local Development

### 1. Create virtual environment

```powershell
cd azure-functions/embedding-converter
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure environment

```powershell
# Copy example to actual .env file
Copy-Item .env.example .env

# Edit .env and add your Azure OpenAI credentials
# AZURE_OPENAI_ENDPOINT=https://concrete-openai-dev.openai.azure.com/
# AZURE_OPENAI_API_KEY=your-actual-key
# AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
# AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 4. Run locally

```powershell
func start
```

The function will be available at: `http://localhost:7071/api/embedding`

### 5. Test locally

```powershell
$body = @{
    values = @(
        @{
            recordId = "test-1"
            data = @{
                text = "This is a test sentence for embedding generation."
            }
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:7071/api/embedding" -Method POST -Body $body -ContentType "application/json"
```

Expected output:
```json
{
  "values": [
    {
      "recordId": "test-1",
      "data": {
        "vector": [0.123, 0.456, ..., 0.789]  // 1536 Float32 values
      },
      "errors": null,
      "warnings": null
    }
  ]
}
```

## 🚀 Deployment

### 1. Create Azure Function App

```powershell
# Login to Azure
az login

# Set variables
$RESOURCE_GROUP = "concrete-app-dev-rg"
$LOCATION = "japaneast"
$STORAGE_ACCOUNT = "concreteragfuncdev"
$FUNCTION_APP = "concrete-embedding-converter"

# Create storage account
az storage account create `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Standard_LRS

# Create Function App (Python 3.9+)
az functionapp create `
  --resource-group $RESOURCE_GROUP `
  --consumption-plan-location $LOCATION `
  --runtime python `
  --runtime-version 3.9 `
  --functions-version 4 `
  --name $FUNCTION_APP `
  --storage-account $STORAGE_ACCOUNT `
  --os-type Linux
```

### 2. Configure Application Settings

```powershell
az functionapp config appsettings set `
  --name $FUNCTION_APP `
  --resource-group $RESOURCE_GROUP `
  --settings `
    AZURE_OPENAI_ENDPOINT="https://concrete-openai-dev.openai.azure.com/" `
    AZURE_OPENAI_API_KEY="cadf7018a0ff4eedaa507c2af570d4ec" `
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small" `
    AZURE_OPENAI_API_VERSION="2024-02-15-preview"
```

### 3. Deploy Function Code

```powershell
# Make sure you're in the function directory
cd azure-functions/embedding-converter

# Activate virtual environment if not already
.venv\Scripts\Activate.ps1

# Deploy
func azure functionapp publish $FUNCTION_APP
```

### 4. Get Function URL and Key

```powershell
# Get function key
$FUNCTION_KEY = az functionapp keys list `
  --name $FUNCTION_APP `
  --resource-group $RESOURCE_GROUP `
  --query "functionKeys.default" `
  --output tsv

# Function URL will be:
# https://concrete-embedding-converter.azurewebsites.net/api/embedding?code=$FUNCTION_KEY

Write-Host "Function URL: https://$FUNCTION_APP.azurewebsites.net/api/embedding?code=$FUNCTION_KEY"
```

### 5. Update Skillset Definition

Update `scripts/rag/skillset-definition.json` line 89:

```json
"uri": "https://concrete-embedding-converter.azurewebsites.net/api/embedding?code=YOUR_ACTUAL_FUNCTION_KEY"
```

### 6. Recreate Skillset and Run Indexer

```powershell
cd ../../  # Back to project root
.\scripts\rag\venv\Scripts\Activate.ps1

# Delete old skillset
python scripts\rag\create_skillset.py delete

# Create new skillset with Custom Web API Skill
python scripts\rag\create_skillset.py create

# Wait for skillset creation
Start-Sleep -Seconds 30

# Reset and run indexer
python scripts\rag\create_indexer.py reset
python scripts\rag\create_indexer.py run

# Check status
Start-Sleep -Seconds 300
python scripts\rag\create_indexer.py status
```

## ✅ Verification

### Check if contentVector is populated

```powershell
# Use Azure Portal or Azure CLI to query index
az search index show `
  --index-name concrete-questions-index `
  --service-name search-concrete-questions-dev `
  --resource-group $RESOURCE_GROUP
```

Expected: Documents should have `contentVector` populated with 1536 Float32 values (not empty arrays).

### Verify data type

The indexer should NO LONGER show:
```
❌ The data field 'contentVector/0' has an invalid value of type 'Collection(Edm.Double)'
```

Instead, vectors should be successfully stored as `Collection(Edm.Single)`.

## 🔧 Troubleshooting

### Function returns 401 Unauthorized
- Check if Azure OpenAI API key is correctly set in Function App settings
- Verify endpoint URL has trailing slash

### Function times out
- Increase timeout in skillset-definition.json (default: PT230S = 230 seconds)
- Check Azure OpenAI quota limits

### Indexer still fails
- Check Function App logs: `func azure functionapp logstream $FUNCTION_APP`
- Verify Function URL and key are correct in skillset definition
- Test function directly with Invoke-RestMethod

## 📊 Performance

- **Processing time**: ~1-2 seconds per chunk
- **Batch size**: 1 (recommended for Azure AI Search Custom Skills)
- **Parallelism**: 5 concurrent requests
- **Timeout**: 230 seconds

## 🔒 Security

- Function uses Function-level authentication (key in URL query parameter)
- For production: Consider using Managed Identity instead of API keys
- Store secrets in Azure Key Vault

## 📚 References

- [Azure AI Search Custom Web API Skill](https://learn.microsoft.com/en-us/azure/search/cognitive-search-custom-skill-web-api)
- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [Azure OpenAI Embeddings](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/embeddings)
