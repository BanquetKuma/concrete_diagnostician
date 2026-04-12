#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Azure Functions Embedding API Test Script

.DESCRIPTION
    Tests the Azure Functions embedding generation API to verify:
    - API connectivity
    - Response format
    - Vector data type (Float32 vs Float64)

.EXAMPLE
    .\test-function.ps1

.EXAMPLE
    .\test-function.ps1 -TestText "カスタムテスト文章"
#>

param(
    [string]$FunctionUrl = "https://concrete-embedding-converter.azurewebsites.net/api/embedding?code=YOUR_FUNCTION_KEY",
    [string]$TestText = "コンクリート診断士試験のテスト文章です。"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Azure Functions Embedding API Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# テストリクエストボディ作成
$body = @{
    values = @(
        @{
            recordId = "test-1"
            data = @{
                text = $TestText
            }
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "送信するテキスト: $TestText" -ForegroundColor Yellow
Write-Host ""

# APIリクエスト実行
Write-Host "Azure Functionsを呼び出し中..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod `
        -Uri $FunctionUrl `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop

    Write-Host "✓ リクエスト成功" -ForegroundColor Green
    Write-Host ""

    # レスポンス内容を表示
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "レスポンス内容" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $responseJson = $response | ConvertTo-Json -Depth 10
    Write-Host $responseJson
    Write-Host ""

    # ベクトルデータの詳細確認
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ベクトルデータ分析" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    if ($response.values -and $response.values.Count -gt 0) {
        $vectorData = $response.values[0].data.vector

        if ($vectorData -and $vectorData.Count -gt 0) {
            Write-Host "ベクトル次元数: $($vectorData.Count)" -ForegroundColor White
            Write-Host "最初の10要素: $($vectorData[0..9] -join ', ')" -ForegroundColor White
            Write-Host ""

            # データ型チェック
            Write-Host "データ型分析:" -ForegroundColor Yellow
            $firstElement = $vectorData[0]
            Write-Host "  最初の要素値: $firstElement" -ForegroundColor White
            Write-Host "  .NET型: $($firstElement.GetType().FullName)" -ForegroundColor White

            # Float64 (Double) かどうか判定
            if ($firstElement.GetType().FullName -eq "System.Double") {
                Write-Host ""
                Write-Host "⚠ 警告: Float64 (Double) が返されています！" -ForegroundColor Red
                Write-Host "   Azure AI Searchが期待するのは Float32 (Single) です。" -ForegroundColor Red
                Write-Host "   function_app.py の修正が必要です。" -ForegroundColor Red
                Write-Host ""
                Write-Host "診断結果: Azure Functions側の問題" -ForegroundColor Red
                Write-Host "対処法: function_app.py を修正して再デプロイが必要" -ForegroundColor Yellow
            } elseif ($firstElement.GetType().FullName -eq "System.Single") {
                Write-Host ""
                Write-Host "✓ 正常: Float32 (Single) が返されています！" -ForegroundColor Green
                Write-Host "   Azure Functions側は正しく動作しています。" -ForegroundColor Green
                Write-Host ""
                Write-Host "診断結果: Azure Functions正常" -ForegroundColor Green
                Write-Host "対処法: Indexer/Index側の問題。完全リセットが必要" -ForegroundColor Yellow
            } else {
                Write-Host ""
                Write-Host "⚠ 不明な型: $($firstElement.GetType().FullName)" -ForegroundColor Yellow
            }

        } else {
            Write-Host "✗ ベクトルデータが空です" -ForegroundColor Red
        }

        # エラーチェック
        if ($response.values[0].errors) {
            Write-Host ""
            Write-Host "エラー情報:" -ForegroundColor Red
            $response.values[0].errors | ForEach-Object {
                Write-Host "  - $($_.message)" -ForegroundColor Red
            }
        }

    } else {
        Write-Host "✗ レスポンスに値が含まれていません" -ForegroundColor Red
    }

} catch {
    Write-Host "✗ リクエスト失敗" -ForegroundColor Red
    Write-Host "エラー詳細:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "詳細エラー情報:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }

    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "テスト完了" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
