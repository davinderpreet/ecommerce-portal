# Detailed BestBuy API Connection Test
$baseUrl = "https://ecommerce-portal-production.up.railway.app/api"

Write-Host "🚀 Testing BestBuy Connection with Detailed Error Handling..." -ForegroundColor Green
Write-Host ""

# Step 1: Create test user
Write-Host "1. Creating test user..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$testUser = @{
    email = "bestbuy-test-$timestamp@example.com"
    password = "testpass123"
    firstName = "BestBuy"
    lastName = "Tester"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $testUser -ContentType "application/json"
    $token = $registerResponse.token
    Write-Host "✅ Test user created successfully" -ForegroundColor Green
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ User registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test BestBuy API with detailed error handling
Write-Host "2. Testing BestBuy API connection..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/bestbuy/test" -Method Get -Headers $headers -UseBasicParsing
    $bestbuyResponse = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ BestBuy API Response Received" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Cyan
    Write-Host "Response:" -ForegroundColor Cyan
    $bestbuyResponse | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
    
} catch {
    Write-Host "❌ BestBuy API Error Details:" -ForegroundColor Red
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "   Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    
    # Try to get the error response body
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        
        Write-Host "   Error Response Body:" -ForegroundColor Red
        try {
            $errorJson = $errorBody | ConvertFrom-Json
            $errorJson | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Yellow
        } catch {
            Write-Host "   $errorBody" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   Could not read error response body" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Test completed!" -ForegroundColor Green
