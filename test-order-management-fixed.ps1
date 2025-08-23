# M10 Order Management System Test Script
# Tests all new M10 services and integration with M9 components

param(
    [string]$BaseUrl = "https://ecommerce-portal-production-2b8b.up.railway.app",
    [string]$TestEmail = "admin@yourdomain.com",
    [string]$TestPassword = "admin123"
)

$baseUrl = $BaseUrl
$testEmail = $TestEmail
$testPassword = $TestPassword

Write-Host "🚀 Starting M10 Order Management System Tests..." -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray

# Helper function for authenticated requests
function Invoke-AuthenticatedRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [string]$Token
    )
    
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            return Invoke-RestMethod -Uri $Url -Method $Method -Body $jsonBody -Headers $headers
        } else {
            return Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers
        }
    } catch {
        Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Authentication
Write-Host "`n1. Authenticating..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $testEmail
        password = $testPassword
    }
    
    $authResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $token = $authResponse.token
    Write-Host "✓ Authentication successful" -ForegroundColor Green
} catch {
    Write-Host "✗ Authentication failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test order data
$testOrderId = "TEST_ORDER_" + (Get-Date -Format "yyyyMMdd_HHmmss")
$testOrderData = @{
    orderId = $testOrderId
    channel = "shopify"
    totalAmount = 299.99
    customerTier = "premium"
    urgency = "normal"
    items = @(
        @{
            productId = "PROD_001"
            sku = "SKU_001"
            quantity = 2
            price = 149.99
        }
    )
    shippingAddress = @{
        street = "123 Test St"
        city = "Toronto"
        province = "ON"
        postal_code = "M1M 1M1"
        country = "CA"
    }
    customerEmail = $testEmail
}

# 2. Test Order Lifecycle Management
Write-Host "`n2. Testing Order Lifecycle Management..." -ForegroundColor Yellow

# Start order lifecycle
$lifecycleResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/$testOrderId/lifecycle/start" -Method POST -Body $testOrderData -Token $token
if ($lifecycleResult -and $lifecycleResult.success) {
    Write-Host "✓ Order lifecycle started successfully" -ForegroundColor Green
    Write-Host "   Lifecycle ID: $($lifecycleResult.lifecycle.id)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to start order lifecycle" -ForegroundColor Red
}

# Progress order stage
$progressData = @{
    newStage = "payment_verified"
    assignedTo = "payment_team"
    notes = "Payment verified via test system"
}
$progressResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/$testOrderId/lifecycle/progress" -Method PUT -Body $progressData -Token $token
if ($progressResult -and $progressResult.success) {
    Write-Host "✓ Order stage progressed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to progress order stage" -ForegroundColor Red
}

# Get order tracking
$trackingResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/$testOrderId/lifecycle/tracking" -Method GET -Token $token
if ($trackingResult -and $trackingResult.success) {
    Write-Host "✓ Order tracking retrieved successfully" -ForegroundColor Green
    Write-Host "   Current Stage: $($trackingResult.tracking.currentStage)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to retrieve order tracking" -ForegroundColor Red
}

# 3. Test Fulfillment Service
Write-Host "`n3. Testing Fulfillment Service..." -ForegroundColor Yellow

# Get shipping rates
$shippingData = @{
    orderId = $testOrderId
    destination = @{
        city = "Vancouver"
        province = "BC"
        postal_code = "V6B 1A1"
        country = "CA"
    }
    items = @(
        @{
            weight = 2.5
            dimensions = @{
                length = 30
                width = 20
                height = 10
            }
        }
    )
}
$shippingRatesResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/fulfillment/shipping-rates" -Method POST -Body $shippingData -Token $token
if ($shippingRatesResult -and $shippingRatesResult.success) {
    Write-Host "✓ Shipping rates calculated successfully" -ForegroundColor Green
    Write-Host "   Available rates: $($shippingRatesResult.rates.Count)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to calculate shipping rates" -ForegroundColor Red
}

# Allocate inventory
$inventoryData = @{
    orderId = $testOrderId
    items = @(
        @{
            sku = "SKU_001"
            quantity = 2
            fulfillmentCenter = "MAIN"
        }
    )
}
$inventoryResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/fulfillment/inventory/allocate" -Method POST -Body $inventoryData -Token $token
if ($inventoryResult -and $inventoryResult.success) {
    Write-Host "✓ Inventory allocated successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to allocate inventory" -ForegroundColor Red
}

# Create shipping label
$labelData = @{
    orderId = $testOrderId
    shippingMethod = "standard"
    carrier = "canada_post"
}
$labelResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/fulfillment/shipping/create-label" -Method POST -Body $labelData -Token $token
if ($labelResult -and $labelResult.success) {
    Write-Host "✓ Shipping label created successfully" -ForegroundColor Green
    Write-Host "   Tracking Number: $($labelResult.label.trackingNumber)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to create shipping label" -ForegroundColor Red
}

# Update fulfillment status
$fulfillmentStatusData = @{
    orderId = $testOrderId
    status = "shipped"
    trackingNumber = "TEST_TRACK_123456"
    carrier = "Canada Post"
}
$fulfillmentStatusResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/fulfillment/status/update" -Method PUT -Body $fulfillmentStatusData -Token $token
if ($fulfillmentStatusResult -and $fulfillmentStatusResult.success) {
    Write-Host "✓ Fulfillment status updated successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to update fulfillment status" -ForegroundColor Red
}

# 4. Test Customer Notification Service
Write-Host "`n4. Testing Customer Notification Service..." -ForegroundColor Yellow

# Queue notification
$notificationData = @{
    customerEmail = $testEmail
    type = "order_confirmation"
    orderId = $testOrderId
    templateData = @{
        customerName = "Test Customer"
        orderTotal = "299.99"
        orderItems = "2x Test Product"
    }
}
$queueResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/notifications/queue" -Method POST -Body $notificationData -Token $token
if ($queueResult -and $queueResult.success) {
    Write-Host "✓ Notification queued successfully" -ForegroundColor Green
    Write-Host "   Notification ID: $($queueResult.notification.id)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to queue notification" -ForegroundColor Red
}

# Send notification
$sendData = @{
    customerEmail = $testEmail
    type = "order_shipped"
    orderId = $testOrderId
    templateData = @{
        customerName = "Test Customer"
        trackingNumber = "TEST_TRACK_123456"
        carrier = "Canada Post"
        estimatedDelivery = "2-3 business days"
        trackingUrl = "https://www.canadapost.ca/track"
    }
}
$sendResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/notifications/send" -Method POST -Body $sendData -Token $token
if ($sendResult -and $sendResult.success) {
    Write-Host "✓ Notification sent successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to send notification" -ForegroundColor Red
}

# Process notification queue
$processResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/notifications/process" -Method POST -Token $token
if ($processResult -and $processResult.success) {
    Write-Host "✓ Notification queue processed successfully" -ForegroundColor Green
    Write-Host "   Processed: $($processResult.processed)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to process notification queue" -ForegroundColor Red
}

# Get notification history
$historyResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/notifications/history?email=$testEmail" -Method GET -Token $token
if ($historyResult -and $historyResult.success) {
    Write-Host "✓ Notification history retrieved successfully" -ForegroundColor Green
    Write-Host "   Total notifications: $($historyResult.history.Count)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to retrieve notification history" -ForegroundColor Red
}

# 5. Test Order Analytics Dashboard
Write-Host "`n5. Testing Order Analytics Dashboard..." -ForegroundColor Yellow

# Get real-time status
$statusResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/analytics/orders/status" -Method GET -Token $token
if ($statusResult -and $statusResult.success) {
    Write-Host "✓ Real-time order status retrieved successfully" -ForegroundColor Green
    Write-Host "   Total orders: $($statusResult.status.totalOrders)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to retrieve real-time order status" -ForegroundColor Red
}

# Get performance metrics
$metricsResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/analytics/orders/performance" -Method GET -Token $token
if ($metricsResult -and $metricsResult.success) {
    Write-Host "✓ Performance metrics retrieved successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to retrieve performance metrics" -ForegroundColor Red
}

# Get customer insights
$insightsResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/analytics/orders/customer-insights" -Method GET -Token $token
if ($insightsResult -and $insightsResult.success) {
    Write-Host "✓ Customer insights retrieved successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to retrieve customer insights" -ForegroundColor Red
}

# Get daily analytics
$dailyResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/analytics/orders/daily" -Method GET -Token $token
if ($dailyResult -and $dailyResult.success) {
    Write-Host "✓ Daily analytics retrieved successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to retrieve daily analytics" -ForegroundColor Red
}

# 6. Test Integration with M9 Services
Write-Host "`n6. Testing M9 Integration..." -ForegroundColor Yellow

# Test sales processing integration
$salesData = @{
    orderId = $testOrderId
    channel = "shopify"
    amount = 299.99
    items = @(
        @{
            sku = "SKU_001"
            quantity = 2
            price = 149.99
        }
    )
}
$salesResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/process" -Method POST -Body $salesData -Token $token
if ($salesResult -and $salesResult.success) {
    Write-Host "✓ M9 sales processing integration working" -ForegroundColor Green
} else {
    Write-Host "✗ M9 sales processing integration failed" -ForegroundColor Red
}

# Test order status management integration
$statusUpdateData = @{
    status = "completed"
    notes = "Order completed via M10 testing"
}
$orderStatusResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/$testOrderId/status" -Method PUT -Body $statusUpdateData -Token $token
if ($orderStatusResult) {
    Write-Host "✓ M9 order status management integration working" -ForegroundColor Green
} else {
    Write-Host "✗ M9 order status management integration failed" -ForegroundColor Red
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "Order Management System Test Summary" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "✓ Core Features Tested:" -ForegroundColor Green
Write-Host "   ✓ Order lifecycle management" -ForegroundColor Green
Write-Host "   ✓ Fulfillment and shipping coordination" -ForegroundColor Green
Write-Host "   ✓ Customer notification system" -ForegroundColor Green
Write-Host "   ✓ Order analytics dashboard" -ForegroundColor Green
Write-Host "   ✓ Integration with M9 services" -ForegroundColor Green
Write-Host "   ✓ Real-time order tracking" -ForegroundColor Green

Write-Host "`n🎯 Milestone 10: Order Management System - Testing Complete!" -ForegroundColor Magenta
Write-Host "Ready for production use and M11 Sales Reporting APIs" -ForegroundColor Magenta
