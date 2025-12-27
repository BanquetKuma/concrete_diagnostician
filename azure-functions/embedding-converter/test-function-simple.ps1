# Azure Functions Embedding API Test Script
# Simple version with minimal formatting

param(
    [string]$FunctionUrl = "https://concrete-embedding-converter.azurewebsites.net/api/embedding?code=x_9QYAPrxMSN-hmB9VxQIiCFYlnGXfDdXdQ1CV7aRVClAzFuefq1xA==",
    [string]$TestText = "Test text for concrete diagnostician exam"
)

Write-Host "=== Azure Functions Embedding API Test ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test text: $TestText" -ForegroundColor Yellow
Write-Host ""

# Create request body
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

# Call API
Write-Host "Calling Azure Functions..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $FunctionUrl -Method POST -Body $body -ContentType "application/json"

    Write-Host "SUCCESS: Request completed" -ForegroundColor Green
    Write-Host ""

    # Display response
    Write-Host "=== Response ===" -ForegroundColor Cyan
    $responseJson = $response | ConvertTo-Json -Depth 10
    Write-Host $responseJson
    Write-Host ""

    # Analyze vector data
    Write-Host "=== Vector Data Analysis ===" -ForegroundColor Cyan

    if ($response.values -and $response.values.Count -gt 0) {
        $vectorData = $response.values[0].data.vector

        if ($vectorData -and $vectorData.Count -gt 0) {
            Write-Host "Vector dimensions: $($vectorData.Count)"
            Write-Host "First 10 elements: $($vectorData[0..9] -join ', ')"
            Write-Host ""

            # Check data type
            Write-Host "=== Data Type Check ===" -ForegroundColor Yellow
            $firstElement = $vectorData[0]
            Write-Host "First element value: $firstElement"
            Write-Host ".NET Type: $($firstElement.GetType().FullName)"
            Write-Host ""

            # Determine if Float64 or Float32
            if ($firstElement.GetType().FullName -eq "System.Double") {
                Write-Host "WARNING: Float64 (Double) detected!" -ForegroundColor Red
                Write-Host "Azure AI Search expects Float32 (Single)" -ForegroundColor Red
                Write-Host "Action required: Fix function_app.py and redeploy" -ForegroundColor Yellow
            } elseif ($firstElement.GetType().FullName -eq "System.Single") {
                Write-Host "SUCCESS: Float32 (Single) detected!" -ForegroundColor Green
                Write-Host "Azure Functions is working correctly" -ForegroundColor Green
                Write-Host "Action required: Reset Indexer/Index completely" -ForegroundColor Yellow
            } else {
                Write-Host "UNKNOWN type: $($firstElement.GetType().FullName)" -ForegroundColor Yellow
            }

        } else {
            Write-Host "ERROR: Vector data is empty" -ForegroundColor Red
        }

        # Check for errors
        if ($response.values[0].errors) {
            Write-Host ""
            Write-Host "=== Errors ===" -ForegroundColor Red
            $response.values[0].errors | ForEach-Object {
                Write-Host "  - $($_.message)" -ForegroundColor Red
            }
        }

    } else {
        Write-Host "ERROR: No values in response" -ForegroundColor Red
    }

} catch {
    Write-Host "ERROR: Request failed" -ForegroundColor Red
    Write-Host "Error message: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }

    exit 1
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
