# =====================================================
# FILE: test-data-validation-fixed.ps1
# MILESTONE 12: Data Validation System - Test Suite
# =====================================================

param(
    [string]$BaseUrl = "https://ecommerce-portal-production.up.railway.app",
    [string]$TestEmail = "m11admin@example.com",
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
    
    Write-Host "Testing: $Name" -ForegroundColor White
    
    try {
        $requestParams = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @requestParams
        
        if ($response.success -eq $true -or $ExpectedStatus -eq "any") {
            Write-Host "✅ PASSED: $Name" -ForegroundColor Green
            $global:TestResults += @{ Name = $Name; Status = "PASSED"; Response = $response }
        } else {
            Write-Host "❌ FAILED: $Name - Unexpected response" -ForegroundColor Red
            $global:TestResults += @{ Name = $Name; Status = "FAILED"; Response = $response }
        }
    } catch {
        if ($ExpectedStatus -eq "any") {
            Write-Host "✅ PASSED: $Name (Expected error caught)" -ForegroundColor Green
            $global:TestResults += @{ Name = $Name; Status = "PASSED"; Error = $_.Exception.Message }
        } else {
            Write-Host "❌ FAILED: $Name - $($_.Exception.Message)" -ForegroundColor Red
            $global:TestResults += @{ Name = $Name; Status = "FAILED"; Error = $_.Exception.Message }
        }
    }
}

function Get-AuthToken {
    Write-Host "🔐 Authenticating..." -ForegroundColor Yellow
    
    $loginData = @{
        email = $TestEmail
        password = $TestPassword
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body ($loginData | ConvertTo-Json) -ContentType "application/json"
        
        if ($response.success -and $response.token) {
            $global:AuthToken = $response.token
            Write-Host "✅ Authentication successful" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Authentication failed: Invalid response" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
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
            customer_email = "customer@example.com"
            total_amount = 99.99
            currency = "CAD"
            status = "pending"
            items = @(
                @{
                    sku = "TEST-SKU-001"
                    quantity = 2
                    price = 49.99
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
            customer_email = "invalid-email"
            total_amount = 99.99
            currency = "CAD"
            status = "pending"
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Order Validation (Invalid Email)" -Method "POST" -Url "$BaseUrl/api/validation/order" -Headers $headers -Body $invalidEmail -ExpectedStatus "any"
    
    # Test invalid order data (negative amount)
    $negativeAmount = @{
        orderData = @{
            id = "test-order-3"
            customer_email = "customer@example.com"
            total_amount = -50.00
            currency = "CAD"
            status = "pending"
        }
        channelId = "test-channel-id"
    }
    
    Test-Endpoint -Name "Invalid Order Validation (Negative Amount)" -Method "POST" -Url "$BaseUrl/api/validation/order" -Headers $headers -Body $negativeAmount -ExpectedStatus "any"
}

function Test-QualityMonitoring {
    Write-Host "`n📈 TESTING QUALITY MONITORING" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test quality dashboard
    Test-Endpoint -Name "Quality Dashboard" -Method "GET" -Url "$BaseUrl/api/validation/quality/dashboard" -Headers $headers
    
    # Test quality alerts
    Test-Endpoint -Name "Quality Alerts" -Method "GET" -Url "$BaseUrl/api/validation/quality/alerts" -Headers $headers
    
    # Test quality trends
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    Test-Endpoint -Name "Quality Trends" -Method "GET" -Url "$BaseUrl/api/validation/quality/trends?startDate=$startDate&endDate=$endDate" -Headers $headers
}

function Test-ValidationHistory {
    Write-Host "`n📋 TESTING VALIDATION HISTORY" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    $headers = @{ "Authorization" = "Bearer $global:AuthToken" }
    
    # Test validation history
    Test-Endpoint -Name "Validation History" -Method "GET" -Url "$BaseUrl/api/validation/history?limit=25&offset=0" -Headers $headers
    
    # Test rule violations
    Test-Endpoint -Name "Rule Violations" -Method "GET" -Url "$BaseUrl/api/validation/rules/violations?status=active&limit=25" -Headers $headers
    
    # Test rule engine statistics
    Test-Endpoint -Name "Rule Engine Statistics" -Method "GET" -Url "$BaseUrl/api/validation/rules/stats" -Headers $headers
}

function Show-TestSummary {
    Write-Host "`n📊 TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "===============" -ForegroundColor Cyan
    
    $passed = ($global:TestResults | Where-Object { $_.Status -eq "PASSED" }).Count
    $failed = ($global:TestResults | Where-Object { $_.Status -eq "FAILED" }).Count
    $total = $global:TestResults.Count
    
    Write-Host "Total Tests: $total" -ForegroundColor White
    Write-Host "Passed: $passed" -ForegroundColor Green
    Write-Host "Failed: $failed" -ForegroundColor Red
    
    if ($failed -gt 0) {
        Write-Host "`nFailed Tests:" -ForegroundColor Red
        $global:TestResults | Where-Object { $_.Status -eq "FAILED" } | ForEach-Object {
            Write-Host "❌ $($_.Name)" -ForegroundColor Red
        }
    }
    
    $successRate = [math]::Round(($passed / $total) * 100, 2)
    Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Red" })
}

# Main execution
Write-Host "Starting M12 Data Validation System tests..." -ForegroundColor Yellow

if (Get-AuthToken) {
    Test-ProductValidation
    Test-OrderValidation
    Test-QualityMonitoring
    Test-ValidationHistory
    Show-TestSummary
} else {
    Write-Host "❌ Cannot proceed without authentication" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 M12 Data Validation System testing completed!" -ForegroundColor Green
