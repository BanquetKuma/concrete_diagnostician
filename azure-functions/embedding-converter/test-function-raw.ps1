# Azure Functions Embedding API Test - Raw JSON Response
# This script captures the raw JSON to see actual data types

param(
    [string]$FunctionUrl = "https://concrete-embedding-converter.azurewebsites.net/api/embedding?code=x_9QYAPrxMSN-hmB9VxQIiCFYlnGXfDdXdQ1CV7aRVClAzFuefq1xA==",
    [string]$TestText = "Test text for concrete diagnostician exam"
)

Write-Host "=== Azure Functions Raw JSON Test ===" -ForegroundColor Cyan
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

# Call API and get raw response
Write-Host "Calling Azure Functions..." -ForegroundColor Yellow
try {
    # Use Invoke-WebRequest instead of Invoke-RestMethod to get raw content
    $rawResponse = Invoke-WebRequest -Uri $FunctionUrl -Method POST -Body $body -ContentType "application/json"

    Write-Host "SUCCESS: Request completed" -ForegroundColor Green
    Write-Host ""

    # Display raw JSON response
    Write-Host "=== Raw JSON Response ===" -ForegroundColor Cyan
    $rawJson = $rawResponse.Content
    Write-Host $rawJson
    Write-Host ""

    # Parse JSON manually
    $response = $rawJson | ConvertFrom-Json

    # Check first few vector elements in raw JSON
    Write-Host "=== Vector Element Analysis ===" -ForegroundColor Yellow
    Write-Host ""

    if ($response.values -and $response.values.Count -gt 0) {
        $vectorData = $response.values[0].data.vector

        if ($vectorData -and $vectorData.Count -gt 0) {
            Write-Host "Vector dimensions: $($vectorData.Count)"
            Write-Host ""

            # Extract first element from raw JSON string
            Write-Host "First 5 elements from raw JSON:" -ForegroundColor Yellow
            $rawJson -match '"vector":\s*\[([\d\.\-,\s]+)' | Out-Null
            if ($matches -and $matches.Count -gt 0) {
                $vectorString = $matches[1]
                $firstElements = ($vectorString -split ',')[0..4]
                foreach ($elem in $firstElements) {
                    $trimmed = $elem.Trim()
                    Write-Host "  $trimmed"

                    # Check precision
                    if ($trimmed -match '\.') {
                        $decimalPart = ($trimmed -split '\.')[1]
                        $precision = $decimalPart.Length
                        Write-Host "    Decimal places: $precision" -ForegroundColor Gray

                        # Float32 has ~7 significant digits, Float64 has ~15
                        if ($precision -gt 10) {
                            Write-Host "    -> Likely Float64 (high precision)" -ForegroundColor Red
                        } else {
                            Write-Host "    -> Likely Float32 (normal precision)" -ForegroundColor Green
                        }
                    }
                }
            }

            Write-Host ""
            Write-Host "=== Diagnosis ===" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Check the decimal precision above:" -ForegroundColor White
            Write-Host "  - Float32: ~7 significant digits (6-8 decimal places)" -ForegroundColor White
            Write-Host "  - Float64: ~15 significant digits (14-17 decimal places)" -ForegroundColor White
            Write-Host ""

            # Count decimal places in first element
            $firstElemStr = $vectorData[0].ToString()
            if ($firstElemStr -match '\.(\d+)') {
                $decimalPlaces = $matches[1].Length
                Write-Host "First element decimal places: $decimalPlaces" -ForegroundColor White

                if ($decimalPlaces -gt 10) {
                    Write-Host ""
                    Write-Host "RESULT: Float64 (Double) detected - HIGH PRECISION" -ForegroundColor Red
                    Write-Host "Action: function_app.py needs fixing" -ForegroundColor Yellow
                } else {
                    Write-Host ""
                    Write-Host "RESULT: Float32 (Single) detected - NORMAL PRECISION" -ForegroundColor Green
                    Write-Host "Action: Indexer/Index needs complete reset" -ForegroundColor Yellow
                }
            }

        } else {
            Write-Host "ERROR: Vector data is empty" -ForegroundColor Red
        }

    } else {
        Write-Host "ERROR: No values in response" -ForegroundColor Red
    }

} catch {
    Write-Host "ERROR: Request failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
