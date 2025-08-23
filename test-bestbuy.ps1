# BestBuy API Connection Test for Railway Deployment
$baseUrl = "https://ecommerce-portal-production.up.railway.app/api"

Write-Host "🚀 Testing BestBuy Connection on Railway..." -ForegroundColor Green
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

# Step 2: Test BestBuy API
Write-Host "2. Testing BestBuy API connection..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $token"
}

try {
    $bestbuyResponse = Invoke-RestMethod -Uri "$baseUrl/bestbuy/test" -Method Get -Headers $headers
    
    Write-Host "Status: $($bestbuyResponse.success)" -ForegroundColor $(if($bestbuyResponse.success) {"Green"} else {"Red"})
    Write-Host "Message: $($bestbuyResponse.message)" -ForegroundColor Cyan
    
    if ($bestbuyResponse.success) {
        Write-Host ""
        Write-Host "✅ BestBuy Connection Test PASSED!" -ForegroundColor Green
        Write-Host "   Platform: $($bestbuyResponse.platform)" -ForegroundColor Cyan
        Write-Host "   API Key: $($bestbuyResponse.apiKey)" -ForegroundColor Cyan
        
        if ($bestbuyResponse.data) {
            Write-Host "   Account Data:" -ForegroundColor Cyan
            $bestbuyResponse.data | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Gray
        }
    } else {
        Write-Host ""
        Write-Host "❌ BestBuy Connection Test FAILED!" -ForegroundColor Red
        Write-Host "   Error: $($bestbuyResponse.message)" -ForegroundColor Red
        
        if ($bestbuyResponse.troubleshooting) {
            Write-Host ""
            Write-Host "💡 Troubleshooting suggestions:" -ForegroundColor Yellow
            $bestbuyResponse.troubleshooting.PSObject.Properties | ForEach-Object {
                Write-Host "   - $($_.Name): $($_.Value)" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "❌ BestBuy API test failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Test completed!" -ForegroundColor Green
