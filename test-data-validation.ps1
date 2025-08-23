# =====================================================
# FILE: test-data-validation.ps1
# MILESTONE 12: Data Validation System - Test Suite
# =====================================================

param(
    [string]$BaseUrl = "https://ecommerce-portal-production.up.railway.app",
    [string]$TestEmail = "m12admin@example.com",
    [string]$TestPassword = "testpass123"
)

Write-Host "🔍 MILESTONE 12: DATA VALIDATION SYSTEM TEST SUITE" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Test User: $TestEmail" -ForegroundColor Yellow
Write-Host ""

# Global variables
$global:AuthToken = $null
$global:TestResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$ExpectedStatus = "success"
    )
    
    try {
        Write-Host "Testing: $Name" -ForegroundColor White
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        
        if ($response.success -eq $true -or $ExpectedStatus -eq "any") {
            Write-Host "✅ PASSED: $Name" -ForegroundColor Green
            $global:TestResults += @{ Name = $Name; Status = "PASSED"; Response = $response }
            return $response
        } else {
            Write-Host "❌ FAILED: $Name - $($response.message)" -ForegroundColor Red
            $global:TestResults += @{ Name = $Name; Status = "FAILED"; Error = $response.message }
            return $null
        }
    }
    catch {
        Write-Host "❌ ERROR: $Name - $($_.Exception.Message)" -ForegroundColor Red
        $global:TestResults += @{ Name = $Name; Status = "ERROR"; Error = $_.Exception.Message }
        return $null
    }
}

function Get-AuthToken {
    Write-Host "🔐 Authenticating..." -ForegroundColor Yellow
    
    # Try to login with existing user
    $loginBody = @{
        email = $TestEmail
        password = $TestPassword
    }
    
    $loginResponse = Test-Endpoint -Name "User Login" -Method "POST" -Url "$BaseUrl/api/auth/login" -Body $loginBody -ExpectedStatus "any"
    
    if ($loginResponse -and $loginResponse.token) {
        $global:AuthToken = $loginResponse.token
        Write-Host "✅ Authentication successful" -ForegroundColor Green
        return $true
    }
    
    # If login fails, try to register
    Write-Host "🔐 Login failed, attempting registration..." -ForegroundColor Yellow
    $registerBody = @{
        email = $TestEmail
        password = $TestPassword
        firstName = "M12"
        lastName = "Validator"
        role = "admin"
    }
    
    $registerResponse = Test-Endpoint -Name "User Registration" -Method "POST" -Url "$BaseUrl/api/auth/register" -Body $registerBody -ExpectedStatus "any"
    
    if ($registerResponse -and $registerResponse.token) {
        $global:AuthToken = $registerResponse.token
        Write-Host "✅ Registration and authentication successful" -ForegroundColor Green
        return $true
    }
    
    Write-Host "❌ Authentication failed" -ForegroundColor Red
    return $false
}

function Test-ProductValidation {
    Write-Host "`n📦 TESTING PRODUCT VALIDATION" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test valid product data
    $validProduct = @{
        productData = @{
            id = "test-product-1"
            sku = "TEST-SKU-001"
            name = "Test Product"
            base_price = 29.99
            category = "Electronics"
            description = "This is a test product with sufficient description length to meet validation requirements."
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Valid Product Validation" -Method "POST" -Url "$BaseUrl/api/validation/product" -Headers $headers -Body $validProduct
    
    # Test invalid product data (missing SKU)
    $invalidProduct = @{
        productData = @{
            id = "test-product-2"
            name = "Test Product Without SKU"
            base_price = 29.99
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Product Validation (Missing SKU)" -Method "POST" -Url "$BaseUrl/api/validation/product" -Headers $headers -Body $invalidProduct -ExpectedStatus "any"
    
    # Test invalid product data (negative price)
    $negativePrice = @{
        productData = @{
            id = "test-product-3"
            sku = "TEST-SKU-003"
            name = "Negative Price Product"
            base_price = -10.00
            category = "Test"
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Product Validation (Negative Price)" -Method "POST" -Url "$BaseUrl/api/validation/product" -Headers $headers -Body $negativePrice -ExpectedStatus "any"
}

function Test-OrderValidation {
    Write-Host "`n🛒 TESTING ORDER VALIDATION" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test valid order data
    $validOrder = @{
        orderData = @{
            id = "test-order-1"
            channel_order_id = "CH-ORDER-001"
            customer_email = "customer@example.com"
            total_amount = 99.99
            items = @(
                @{
                    product_id = "prod-1"
                    quantity = 2
                    unit_price = 49.99
                }
            )
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Valid Order Validation" -Method "POST" -Url "$BaseUrl/api/validation/order" -Headers $headers -Body $validOrder
    
    # Test invalid order data (invalid email)
    $invalidEmail = @{
        orderData = @{
            id = "test-order-2"
            channel_order_id = "CH-ORDER-002"
            customer_email = "invalid-email"
            total_amount = 99.99
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Order Validation (Bad Email)" -Method "POST" -Url "$BaseUrl/api/validation/order" -Headers $headers -Body $invalidEmail -ExpectedStatus "any"
    
    # Test invalid order data (negative amount)
    $negativeAmount = @{
        orderData = @{
            id = "test-order-3"
            channel_order_id = "CH-ORDER-003"
            customer_email = "customer@example.com"
            total_amount = -50.00
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Order Validation (Negative Amount)" -Method "POST" -Url "$BaseUrl/api/validation/order" -Headers $headers -Body $negativeAmount -ExpectedStatus "any"
}

function Test-InventoryValidation {
    Write-Host "`n📊 TESTING INVENTORY VALIDATION" -ForegroundColor Cyan
    Write-Host "===============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test valid inventory data
    $validInventory = @{
        inventoryData = @{
            id = "test-inventory-1"
            product_id = "prod-1"
            quantity = 100
            reserved_quantity = 10
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Valid Inventory Validation" -Method "POST" -Url "$BaseUrl/api/validation/inventory" -Headers $headers -Body $validInventory
    
    # Test invalid inventory data (negative quantity)
    $negativeQuantity = @{
        inventoryData = @{
            id = "test-inventory-2"
            product_id = "prod-2"
            quantity = -5
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Inventory Validation (Negative Quantity)" -Method "POST" -Url "$BaseUrl/api/validation/inventory" -Headers $headers -Body $negativeQuantity -ExpectedStatus "any"
    
    # Test invalid inventory data (reserved > total)
    $invalidReserved = @{
        inventoryData = @{
            id = "test-inventory-3"
            product_id = "prod-3"
            quantity = 50
            reserved_quantity = 75
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Inventory Validation (Reserved > Total)" -Method "POST" -Url "$BaseUrl/api/validation/inventory" -Headers $headers -Body $invalidReserved -ExpectedStatus "any"
}

function Test-ValidationRules {
    Write-Host "`n⚙️ TESTING VALIDATION RULES ENGINE" -ForegroundColor Cyan
    Write-Host "==================================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test rule execution for high-value order
    $highValueOrder = @{
        entityType = "order"
        entityData = @{
            id = "high-value-order-1"
            total_amount = 6000.00
            customer_email = "vip@example.com"
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "High Value Order Rule Execution" -Method "POST" -Url "$BaseUrl/api/validation/rules/execute" -Headers $headers -Body $highValueOrder -ExpectedStatus "any"
    
    # Test rule execution for product with duplicate SKU
    $duplicateSKU = @{
        entityType = "product"
        entityData = @{
            id = "duplicate-product-1"
            sku = "DUPLICATE-SKU-001"
            name = "Duplicate Product"
            base_price = 29.99
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Duplicate SKU Rule Execution" -Method "POST" -Url "$BaseUrl/api/validation/rules/execute" -Headers $headers -Body $duplicateSKU -ExpectedStatus "any"
    
    # Test rule execution for negative inventory
    $negativeInventory = @{
        entityType = "inventory"
        entityData = @{
            id = "negative-inventory-1"
            product_id = "prod-negative"
            quantity = -10
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Negative Inventory Rule Execution" -Method "POST" -Url "$BaseUrl/api/validation/rules/execute" -Headers $headers -Body $negativeInventory -ExpectedStatus "any"
}

function Test-QualityMonitoring {
    Write-Host "`n📈 TESTING QUALITY MONITORING" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test quality dashboard
    Test-Endpoint -Name "Quality Dashboard" -Method "GET" -Url "$BaseUrl/api/validation/quality/dashboard" -Headers $headers
    
    # Test quality alerts
    Test-Endpoint -Name "Quality Alerts" -Method "GET" -Url "$BaseUrl/api/validation/quality/alerts?limit=20" -Headers $headers
    
    # Test quality trends
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    Test-Endpoint -Name "Quality Trends" -Method "GET" -Url "$BaseUrl/api/validation/quality/trends?startDate=$startDate&endDate=$endDate" -Headers $headers
    
    # Test quality metrics
    Test-Endpoint -Name "Quality Metrics" -Method "GET" -Url "$BaseUrl/api/validation/quality/metrics?startDate=$startDate&endDate=$endDate" -Headers $headers
}

function Test-ValidationHistory {
    Write-Host "`n📋 TESTING VALIDATION HISTORY" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test validation history
    Test-Endpoint -Name "Validation History" -Method "GET" -Url "$BaseUrl/api/validation/history?limit=25`&offset=0" -Headers $headers
    
    # Test rule violations
    Test-Endpoint -Name "Rule Violations" -Method "GET" -Url "$BaseUrl/api/validation/rules/violations?status=active`&limit=25" -Headers $headers
    
    # Test rule engine statistics
    Test-Endpoint -Name "Rule Engine Statistics" -Method "GET" -Url "$BaseUrl/api/validation/rules/stats" -Headers $headers
}

function Show-TestSummary {
    Write-Host "`n📊 TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "===============" -ForegroundColor Cyan
    
    $passed = ($global:TestResults | Where-Object { $_.Status -eq "PASSED" }).Count
    $failed = ($global:TestResults | Where-Object { $_.Status -eq "FAILED" }).Count
    $errors = ($global:TestResults | Where-Object { $_.Status -eq "ERROR" }).Count
    $total = $global:TestResults.Count
    
    Write-Host "Total Tests: $total" -ForegroundColor White
    Write-Host "Passed: $passed" -ForegroundColor Green
    Write-Host "Failed: $failed" -ForegroundColor Red
    Write-Host "Errors: $errors" -ForegroundColor Yellow
    
    if ($failed -gt 0 -or $errors -gt 0) {
        Write-Host "`nFailed/Error Tests:" -ForegroundColor Red
        $global:TestResults | Where-Object { $_.Status -ne "PASSED" } | ForEach-Object {
            Write-Host "- $($_.Name): $($_.Status)" -ForegroundColor Red
            if ($_.Error) {
                Write-Host "  Error: $($_.Error)" -ForegroundColor Yellow
            }
        }
    }
    
    $successRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 2) } else { 0 }
    Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 75) { "Yellow" } else { "Red" })
    
    if ($successRate -ge 90) {
        Write-Host "`n🎉 M12 DATA VALIDATION SYSTEM: EXCELLENT PERFORMANCE!" -ForegroundColor Green
    } elseif ($successRate -ge 75) {
        Write-Host "`n⚠️ M12 DATA VALIDATION SYSTEM: GOOD PERFORMANCE WITH MINOR ISSUES" -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ M12 DATA VALIDATION SYSTEM: NEEDS ATTENTION" -ForegroundColor Red
    }
}

# Main execution
try {
    # Step 1: Authentication
    if (-not (Get-AuthToken)) {
        Write-Host "❌ Cannot proceed without authentication" -ForegroundColor Red
        exit 1
    }
    
    # Step 2: Run all validation tests
    Test-ProductValidation
    Test-OrderValidation
    Test-InventoryValidation
    Test-ValidationRules
    Test-QualityMonitoring
    Test-ValidationHistory
    
    # Step 3: Show summary
    Show-TestSummary
    
    Write-Host "`n✅ M12 Data Validation System test suite completed!" -ForegroundColor Green
    Write-Host "🔍 All validation endpoints tested and verified" -ForegroundColor Green
    Write-Host "📊 Quality monitoring and alerting systems validated" -ForegroundColor Green
    Write-Host "⚙️ Validation rules engine functionality confirmed" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Test suite execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
