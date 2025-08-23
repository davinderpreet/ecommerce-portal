# Simple Test Script for Data Sync Services (Shopify + BestBuy only)
# Tests core sync functionality without Amazon

$baseUrl = "https://ecommerce-portal-production-d5b5.up.railway.app"
$token = $null

Write-Host "Testing Data Sync Services (Shopify + BestBuy)" -ForegroundColor Cyan

# Authenticate
Write-Host "Authenticating..." -ForegroundColor Yellow
$loginData = @{
    email = "admin@ecommerce.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $response.token
    Write-Host "✅ Authentication successful" -ForegroundColor Green
}
catch {
    Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Test 1: Sync Status
Write-Host "`nTesting sync status..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/status" -Method GET -Headers $headers
    Write-Host "✅ Sync status retrieved" -ForegroundColor Green
    Write-Host "Processing: $($response.isProcessing)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Sync status failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: BestBuy Data Mapping
Write-Host "`nTesting BestBuy data mapping..." -ForegroundColor Yellow
$bestbuyProduct = @{
    offer_id = "TEST-123"
    product_sku = "SKU-456"
    product_title = "Test Product"
    price = 99.99
    quantity = 10
    state = 11
}

$testData = @{
    channelName = "bestbuy"
    dataType = "product"
    rawData = $bestbuyProduct
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/map-test" -Method POST -Body $testData -Headers $headers
    Write-Host "✅ BestBuy mapping successful" -ForegroundColor Green
    Write-Host "Mapped SKU: $($response.mappedData.sku)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ BestBuy mapping failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Webhook Test
Write-Host "`nTesting webhook..." -ForegroundColor Yellow
$webhookData = @{
    test = $true
    source = "test-script"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/test" -Method POST -Body $webhookData -ContentType "application/json"
    Write-Host "✅ Webhook test successful" -ForegroundColor Green
}
catch {
    Write-Host "❌ Webhook test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: BestBuy API Connection
Write-Host "`nTesting BestBuy API connection..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/bestbuy/test" -Method GET -Headers $headers
    if ($response.success) {
        Write-Host "✅ BestBuy API connected" -ForegroundColor Green
        Write-Host "Shop: $($response.data.shop_name)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ BestBuy API test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Trigger Sync Job
Write-Host "`nTriggering BestBuy sync job..." -ForegroundColor Yellow
$syncData = @{
    channelId = 2
    syncType = "products"
    priority = 8
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/trigger" -Method POST -Body $syncData -Headers $headers
    Write-Host "✅ Sync job triggered" -ForegroundColor Green
    Write-Host "Job ID: $($response.jobId)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Sync trigger failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Data sync testing completed!" -ForegroundColor Green
