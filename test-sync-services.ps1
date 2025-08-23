# Test Script for Milestone 8: Data Sync Services
# Tests sync endpoints, data mapping, and webhook functionality

$baseUrl = "https://ecommerce-portal-production-d5b5.up.railway.app"
$token = $null

Write-Host "🧪 Starting Milestone 8 Data Sync Services Tests" -ForegroundColor Cyan
Write-Host "=" * 50

# Function to authenticate and get JWT token
function Get-AuthToken {
    Write-Host "🔐 Authenticating..." -ForegroundColor Yellow
    
    $loginData = @{
        email = "admin@ecommerce.com"
        password = "admin123"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        $script:token = $response.token
        Write-Host "✅ Authentication successful" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to get headers with auth token
function Get-Headers {
    return @{
        'Authorization' = "Bearer $script:token"
        'Content-Type' = 'application/json'
    }
}

# Test sync status endpoint
function Test-SyncStatus {
    Write-Host "`n📊 Testing sync status endpoint..." -ForegroundColor Yellow
    
    try {
        $headers = Get-Headers
        $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/status" -Method GET -Headers $headers
        
        Write-Host "✅ Sync Status Response:" -ForegroundColor Green
        Write-Host "- Processing: $($response.isProcessing)"
        Write-Host "- Recent Logs Count: $($response.recentLogs.Count)"
        Write-Host "- Stats: $($response.stats | ConvertTo-Json -Compress)"
        
        return $true
    }
    catch {
        Write-Host "❌ Sync status test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test data mapping functionality
function Test-DataMapping {
    Write-Host "`n🔄 Testing data mapping..." -ForegroundColor Yellow
    
    try {
        $bestbuyProduct = @{
            offer_id = "TEST-OFFER-123"
            product_sku = "TEST-SKU-456"
            product_title = "Test Product"
            description = "Test product description"
            brand = "Test Brand"
            category_code = "electronics"
            price = 99.99
            quantity = 10
            state = 11
            date_created = "2024-02-23T12:00:00Z"
            last_updated = "2024-02-23T12:00:00Z"
        }
        
        $testData = @{
            channelName = "bestbuy"
            dataType = "product"
            rawData = $bestbuyProduct
        } | ConvertTo-Json -Depth 3
        
        $headers = Get-Headers
        $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/map-test" -Method POST -Body $testData -Headers $headers
        
        Write-Host "✅ Data Mapping Test Successful:" -ForegroundColor Green
        Write-Host "- Original SKU: $($bestbuyProduct.product_sku)"
        Write-Host "- Mapped SKU: $($response.mappedData.sku)"
        Write-Host "- Mapped Name: $($response.mappedData.name)"
        Write-Host "- Mapped Price: $($response.mappedData.price)"
        
        return $true
    }
    catch {
        Write-Host "❌ Data mapping test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test manual sync trigger
function Test-SyncTrigger {
    Write-Host "`n🚀 Testing manual sync trigger..." -ForegroundColor Yellow
    
    try {
        $syncData = @{
            channelId = 2  # BestBuy channel
            syncType = "products"
            priority = 8
        } | ConvertTo-Json
        
        $headers = Get-Headers
        $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/trigger" -Method POST -Body $syncData -Headers $headers
        
        Write-Host "✅ Sync Trigger Successful:" -ForegroundColor Green
        Write-Host "- Job ID: $($response.jobId)"
        Write-Host "- Message: $($response.message)"
        
        return $true
    }
    catch {
        Write-Host "❌ Sync trigger test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test webhook endpoints
function Test-Webhooks {
    Write-Host "`n🔗 Testing webhook endpoints..." -ForegroundColor Yellow
    
    try {
        # Test webhook status
        $headers = Get-Headers
        $statusResponse = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/status" -Method GET -Headers $headers
        
        Write-Host "✅ Webhook Status Retrieved:" -ForegroundColor Green
        Write-Host "- Available Endpoints: $($statusResponse.endpoints.PSObject.Properties.Count)"
        
        # Test webhook (no auth required for webhooks)
        $testWebhookData = @{
            test = $true
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            source = "powershell-test-script"
        } | ConvertTo-Json
        
        $testWebhookResponse = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/test" -Method POST -Body $testWebhookData -ContentType "application/json"
        
        Write-Host "✅ Test Webhook Successful:" -ForegroundColor Green
        Write-Host "- Response: $($testWebhookResponse.message)"
        
        return $true
    }
    catch {
        Write-Host "❌ Webhook test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test sync logs endpoint
function Test-SyncLogs {
    Write-Host "`n📋 Testing sync logs..." -ForegroundColor Yellow
    
    try {
        $headers = Get-Headers
        $response = Invoke-RestMethod -Uri "$baseUrl/api/sync/logs?limit=5" -Method GET -Headers $headers
        
        Write-Host "✅ Sync Logs Retrieved:" -ForegroundColor Green
        Write-Host "- Total Logs: $($response.pagination.total)"
        Write-Host "- Current Page: $($response.pagination.page)"
        Write-Host "- Logs Count: $($response.logs.Count)"
        
        if ($response.logs.Count -gt 0) {
            $latestLog = $response.logs[0]
            Write-Host "- Latest Log Type: $($latestLog.sync_type)"
            Write-Host "- Latest Log Status: $($latestLog.status)"
        }
        
        return $true
    }
    catch {
        Write-Host "❌ Sync logs test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test BestBuy integration with sync services
function Test-BestBuySync {
    Write-Host "`n🛒 Testing BestBuy integration with sync..." -ForegroundColor Yellow
    
    try {
        # First test BestBuy API connection
        $headers = Get-Headers
        $bestbuyResponse = Invoke-RestMethod -Uri "$baseUrl/api/bestbuy/test" -Method GET -Headers $headers
        
        if ($bestbuyResponse.success) {
            Write-Host "✅ BestBuy API Connection: OK" -ForegroundColor Green
            Write-Host "- Shop: $($bestbuyResponse.data.shop_name)"
            Write-Host "- Shop ID: $($bestbuyResponse.data.shop_id)"
            
            # Now trigger a BestBuy product sync
            $syncData = @{
                channelId = 2  # BestBuy channel
                syncType = "products"
                priority = 9
            } | ConvertTo-Json
            
            $syncResponse = Invoke-RestMethod -Uri "$baseUrl/api/sync/trigger" -Method POST -Body $syncData -Headers $headers
            
            Write-Host "✅ BestBuy Sync Triggered:" -ForegroundColor Green
            Write-Host "- Job ID: $($syncResponse.jobId)"
            
            return $true
        } else {
            Write-Host "⚠️ BestBuy API connection failed, skipping sync test" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ BestBuy sync test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main test execution
$results = @{
    authentication = $false
    syncStatus = $false
    dataMapping = $false
    syncTrigger = $false
    webhooks = $false
    syncLogs = $false
    bestbuySync = $false
}

# Authenticate first
$results.authentication = Get-AuthToken
if (-not $results.authentication) {
    Write-Host "`n❌ Cannot proceed without authentication" -ForegroundColor Red
    exit 1
}

# Run all tests
$results.syncStatus = Test-SyncStatus
$results.dataMapping = Test-DataMapping
$results.syncTrigger = Test-SyncTrigger
$results.webhooks = Test-Webhooks
$results.syncLogs = Test-SyncLogs
$results.bestbuySync = Test-BestBuySync

# Summary
Write-Host "`n$('=' * 50)" -ForegroundColor Cyan
Write-Host "📊 TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50

$passed = ($results.Values | Where-Object { $_ -eq $true }).Count
$total = $results.Count

foreach ($test in $results.GetEnumerator()) {
    $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL" }
    $testName = $test.Key.ToUpper()
    Write-Host "$status $testName"
}

Write-Host "`n$('=' * 50)" -ForegroundColor Cyan
Write-Host "🎯 OVERALL: $passed/$total tests passed" -ForegroundColor Cyan

if ($passed -eq $total) {
    Write-Host "🎉 ALL TESTS PASSED - Milestone 8 Data Sync Services is working correctly!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Some tests failed - check the logs above for details" -ForegroundColor Yellow
}

Write-Host "" -ForegroundColor Gray
Write-Host "Test completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
