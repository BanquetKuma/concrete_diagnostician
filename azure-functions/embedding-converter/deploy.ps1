#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Embedding Converter Azure Function

.DESCRIPTION
    This script deploys the Custom Web API Skill for Float32 embedding conversion to Azure Functions.

.EXAMPLE
    .\deploy.ps1
#>

param(
    [string]$ResourceGroup = "concrete-app-dev-rg",
    [string]$Location = "japaneast",
    [string]$StorageAccount = "concreteragfuncdev",
    [string]$FunctionApp = "concrete-embedding-converter"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Embedding Converter Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if logged in to Azure
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in to Azure. Please run 'az login'" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "✓ Subscription: $($account.name)" -ForegroundColor Green
Write-Host ""

# Check if Function App exists
Write-Host "Checking if Function App exists..." -ForegroundColor Yellow
$functionAppExists = az functionapp show `
    --name $FunctionApp `
    --resource-group $ResourceGroup `
    2>$null

if (-not $functionAppExists) {
    Write-Host "Function App '$FunctionApp' does not exist." -ForegroundColor Red
    Write-Host "Creating resources..." -ForegroundColor Yellow
    Write-Host ""

    # Create storage account
    Write-Host "Creating storage account: $StorageAccount" -ForegroundColor Yellow
    az storage account create `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --query "provisioningState" `
        --output tsv

    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to create storage account" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Storage account created" -ForegroundColor Green
    Write-Host ""

    # Create Function App
    Write-Host "Creating Function App: $FunctionApp" -ForegroundColor Yellow
    az functionapp create `
        --resource-group $ResourceGroup `
        --consumption-plan-location $Location `
        --runtime python `
        --runtime-version 3.9 `
        --functions-version 4 `
        --name $FunctionApp `
        --storage-account $StorageAccount `
        --os-type Linux `
        --query "defaultHostName" `
        --output tsv

    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to create Function App" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Function App created" -ForegroundColor Green
    Write-Host ""

    # Wait for Function App to be ready
    Write-Host "Waiting for Function App to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30

    # Configure application settings
    Write-Host "Configuring application settings..." -ForegroundColor Yellow

    # Load environment variables from .env.rag
    $envFile = "../../.env.rag"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^AZURE_OPENAI_(.+)=(.+)$') {
                $key = "AZURE_OPENAI_$($matches[1])"
                $value = $matches[2]
                Write-Host "  Setting $key" -ForegroundColor Gray
            }
        }

        # Read specific values
        $content = Get-Content $envFile -Raw
        $endpoint = if ($content -match 'AZURE_OPENAI_ENDPOINT=(.+)') { $matches[1].Trim() } else { "" }
        $apiKey = if ($content -match 'AZURE_OPENAI_API_KEY=(.+)') { $matches[1].Trim() } else { "" }
        $deployment = if ($content -match 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT=(.+)') { $matches[1].Trim() } else { "text-embedding-3-small" }
        $apiVersion = if ($content -match 'AZURE_OPENAI_API_VERSION=(.+)') { $matches[1].Trim() } else { "2024-02-15-preview" }

        az functionapp config appsettings set `
            --name $FunctionApp `
            --resource-group $ResourceGroup `
            --settings `
                "AZURE_OPENAI_ENDPOINT=$endpoint" `
                "AZURE_OPENAI_API_KEY=$apiKey" `
                "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=$deployment" `
                "AZURE_OPENAI_API_VERSION=$apiVersion" `
            --output none

        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Failed to configure application settings" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Application settings configured" -ForegroundColor Green
    } else {
        Write-Host "⚠ .env.rag not found. Please configure settings manually." -ForegroundColor Yellow
    }
    Write-Host ""

} else {
    Write-Host "✓ Function App '$FunctionApp' exists" -ForegroundColor Green
    Write-Host ""
}

# Deploy function code
Write-Host "Deploying function code..." -ForegroundColor Yellow
func azure functionapp publish $FunctionApp --python

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Function code deployed successfully" -ForegroundColor Green
Write-Host ""

# Get function key
Write-Host "Retrieving function key..." -ForegroundColor Yellow
$functionKey = az functionapp keys list `
    --name $FunctionApp `
    --resource-group $ResourceGroup `
    --query "functionKeys.default" `
    --output tsv

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to retrieve function key" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Function key retrieved" -ForegroundColor Green
Write-Host ""

# Display function URL
$functionUrl = "https://$FunctionApp.azurewebsites.net/api/embedding?code=$functionKey"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Function URL:" -ForegroundColor Yellow
Write-Host $functionUrl -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update scripts/rag/skillset-definition.json line 89 with the above URL" -ForegroundColor Gray
Write-Host "2. Run: python scripts\rag\create_skillset.py delete" -ForegroundColor Gray
Write-Host "3. Run: python scripts\rag\create_skillset.py create" -ForegroundColor Gray
Write-Host "4. Run: python scripts\rag\create_indexer.py reset" -ForegroundColor Gray
Write-Host "5. Run: python scripts\rag\create_indexer.py run" -ForegroundColor Gray
Write-Host ""
