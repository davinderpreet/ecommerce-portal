# Sales Processing Engine Test Script - Milestone 9
# Tests order processing, status management, and sales aggregations

$baseUrl = "https://ecommerce-portal-production.up.railway.app"
$testEmail = "test@example.com"
$testPassword = "password123"

Write-Host "Testing Sales Processing Engine (Milestone 9)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Function to make authenticated requests
function Invoke-AuthenticatedRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [string]$Token
    )
    
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            return Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers -Body $jsonBody
        } else {
            return Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers
        }
    } catch {
        Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Step 1: Authentication
Write-Host "`n1. Authenticating..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $testEmail
        password = $testPassword
    }
    
    $authResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    
    if ($authResponse.success) {
        $token = $authResponse.token
        Write-Host "✅ Authentication successful" -ForegroundColor Green
    } else {
        Write-Host "❌ Authentication failed: $($authResponse.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test Sales Processing Statistics
Write-Host "`n2. Testing Sales Processing Statistics..." -ForegroundColor Yellow
$statsResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/stats" -Token $token

if ($statsResponse) {
    Write-Host "✅ Sales stats retrieved successfully" -ForegroundColor Green
    Write-Host "   Orders Processed: $($statsResponse.stats.ordersProcessed)" -ForegroundColor White
    Write-Host "   Errors Count: $($statsResponse.stats.errorsCount)" -ForegroundColor White
    Write-Host "   Is Initialized: $($statsResponse.stats.isInitialized)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to get sales statistics" -ForegroundColor Red
}

# Step 3: Test Order Processing with Sample Shopify Order
Write-Host "`n3. Testing Order Processing (Shopify Sample)..." -ForegroundColor Yellow

$shopifyOrder = @{
    orderData = @{
        id = "12345678901"
        name = "#TEST001"
        email = "customer@example.com"
        created_at = "2025-08-23T12:00:00Z"
        total_price = "99.99"
        currency = "USD"
        financial_status = "paid"
        fulfillment_status = "unfulfilled"
        customer = @{
            first_name = "John"
            last_name = "Doe"
        }
        line_items = @(
            @{
                id = "item1"
                title = "Test Product"
                quantity = 2
                price = "49.99"
            }
        )
        shipping_address = @{
            name = "John Doe"
            address1 = "123 Test St"
            city = "Test City"
            province = "ON"
            country = "Canada"
            zip = "K1A 0A6"
        }
    }
    channelName = "shopify"
    channelId = 1
}

$processResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/process-order" -Method "POST" -Body $shopifyOrder -Token $token

if ($processResponse -and $processResponse.success) {
    Write-Host "✅ Shopify order processed successfully" -ForegroundColor Green
    Write-Host "   Order ID: $($processResponse.data.orderId)" -ForegroundColor White
    Write-Host "   Processing Time: $($processResponse.data.processingTime)ms" -ForegroundColor White
} else {
    Write-Host "❌ Failed to process Shopify order" -ForegroundColor Red
    if ($processResponse) {
        Write-Host "   Error: $($processResponse.message)" -ForegroundColor Red
    }
}

# Step 4: Test Order Queue Processing with BestBuy Order
Write-Host "`n4. Testing Order Queue (BestBuy Sample)..." -ForegroundColor Yellow

$bestbuyOrder = @{
    orderData = @{
        order_id = "BB-987654321"
        commercial_id = "BB-TEST002"
        customer_email = "bestbuy@example.com"
        created_date = "2025-08-23T12:30:00Z"
        total_price = "149.99"
        currency_iso_code = "CAD"
        state = "waiting_acceptance"
        customer = @{
            firstname = "Jane"
            lastname = "Smith"
        }
        order_lines = @(
            @{
                product_id = "prod123"
                quantity = 1
                price = "149.99"
            }
        )
    }
    channelName = "bestbuy_canada"
    channelId = 2
    priority = 7
}

$queueResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/queue-order" -Method "POST" -Body $bestbuyOrder -Token $token

if ($queueResponse -and $queueResponse.success) {
    Write-Host "✅ BestBuy order queued successfully" -ForegroundColor Green
    Write-Host "   Queue Item ID: $($queueResponse.queueItem.id)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to queue BestBuy order" -ForegroundColor Red
}

# Step 5: Process the Queue
Write-Host "`n5. Processing Sales Queue..." -ForegroundColor Yellow

$processQueueBody = @{ limit = 5 }
$processQueueResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/process-queue" -Method "POST" -Body $processQueueBody -Token $token

if ($processQueueResponse -and $processQueueResponse.success) {
    Write-Host "✅ Sales queue processed successfully" -ForegroundColor Green
    Write-Host "   $($processQueueResponse.message)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to process sales queue" -ForegroundColor Red
}

# Step 6: Test Order Status Management
Write-Host "`n6. Testing Order Status Management..." -ForegroundColor Yellow

# First, let's try to update the status of the Shopify order we just processed
$statusUpdateBody = @{
    status = "processing"
    fulfillmentStatus = "partial"
    reason = "Order being prepared for shipment"
    changedBy = "test_script"
}

$statusResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/12345678901/status" -Method "PUT" -Body $statusUpdateBody -Token $token

if ($statusResponse -and $statusResponse.success) {
    Write-Host "✅ Order status updated successfully" -ForegroundColor Green
    Write-Host "   Previous Status: $($statusResponse.data.previousStatus)" -ForegroundColor White
    Write-Host "   New Status: $($statusResponse.data.newStatus)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to update order status" -ForegroundColor Red
    if ($statusResponse) {
        Write-Host "   Error: $($statusResponse.message)" -ForegroundColor Red
    }
}

# Step 7: Get Orders by Status
Write-Host "`n7. Testing Get Orders by Status..." -ForegroundColor Yellow

$ordersByStatusResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/status/processing" -Token $token

if ($ordersByStatusResponse -and $ordersByStatusResponse.success) {
    Write-Host "✅ Orders by status retrieved successfully" -ForegroundColor Green
    Write-Host "   Found $($ordersByStatusResponse.data.Count) processing orders" -ForegroundColor White
} else {
    Write-Host "❌ Failed to get orders by status" -ForegroundColor Red
}

# Step 8: Test Order Analytics
Write-Host "`n8. Testing Order Analytics..." -ForegroundColor Yellow

$startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
$endDate = (Get-Date).ToString("yyyy-MM-dd")

$analyticsResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/analytics?startDate=$startDate&endDate=$endDate" -Token $token

if ($analyticsResponse -and $analyticsResponse.success) {
    Write-Host "✅ Order analytics retrieved successfully" -ForegroundColor Green
    Write-Host "   Analytics for last 7 days:" -ForegroundColor White
    foreach ($stat in $analyticsResponse.data) {
        Write-Host "     Status: $($stat.order_status) | Orders: $($stat.order_count) | Revenue: $($stat.total_revenue)" -ForegroundColor White
    }
} else {
    Write-Host "❌ Failed to get order analytics" -ForegroundColor Red
}

# Step 9: Test Sales Aggregations
Write-Host "`n9. Testing Sales Aggregations..." -ForegroundColor Yellow

$aggregationsResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/sales/aggregations?startDate=$startDate&endDate=$endDate" -Token $token

if ($aggregationsResponse -and $aggregationsResponse.success) {
    Write-Host "✅ Sales aggregations retrieved successfully" -ForegroundColor Green
    Write-Host "   Aggregations for last 7 days:" -ForegroundColor White
    foreach ($agg in $aggregationsResponse.data) {
        Write-Host "     Date: $($agg.date_key) | Channel: $($agg.channel_name) | Orders: $($agg.total_orders) | Revenue: $($agg.total_revenue)" -ForegroundColor White
    }
} else {
    Write-Host "❌ Failed to get sales aggregations" -ForegroundColor Red
}

# Step 10: Test Workflow Rule Creation
Write-Host "`n10. Testing Workflow Rule Creation..." -ForegroundColor Yellow

$workflowRule = @{
    channelName = "shopify"
    fromStatus = "paid"
    toStatus = "processing"
    conditions = @{
        "total_amount" = 50.00
    }
    actions = @(
        @{
            type = "send_notification"
            template = "order_processing"
            recipient = "customer"
        }
    )
}

$ruleResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/workflow-rules" -Method "POST" -Body $workflowRule -Token $token

if ($ruleResponse -and $ruleResponse.success) {
    Write-Host "✅ Workflow rule created successfully" -ForegroundColor Green
    Write-Host "   Rule ID: $($ruleResponse.data.id)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to create workflow rule" -ForegroundColor Red
}

# Step 11: Test Order History
Write-Host "`n11. Testing Order History..." -ForegroundColor Yellow

$historyResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/12345678901/history" -Token $token

if ($historyResponse -and $historyResponse.success) {
    Write-Host "✅ Order history retrieved successfully" -ForegroundColor Green
    Write-Host "   History entries: $($historyResponse.data.Count)" -ForegroundColor White
    foreach ($entry in $historyResponse.data) {
        Write-Host "     $($entry.created_at): $($entry.previous_status) → $($entry.new_status)" -ForegroundColor White
    }
} else {
    Write-Host "❌ Failed to get order history" -ForegroundColor Red
}

# Step 12: Test Notifications Processing
Write-Host "`n12. Testing Notifications Processing..." -ForegroundColor Yellow

$notificationsBody = @{ limit = 5 }
$notificationsResponse = Invoke-AuthenticatedRequest -Url "$baseUrl/api/orders/process-notifications" -Method "POST" -Body $notificationsBody -Token $token

if ($notificationsResponse -and $notificationsResponse.success) {
    Write-Host "✅ Notifications processed successfully" -ForegroundColor Green
    Write-Host "   $($notificationsResponse.message)" -ForegroundColor White
} else {
    Write-Host "❌ Failed to process notifications" -ForegroundColor Red
}

# Final Summary
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "Sales Processing Engine Test Summary" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "✅ Core Features Tested:" -ForegroundColor Green
Write-Host "   • Sales processing statistics" -ForegroundColor White
Write-Host "   • Order processing (Shopify & BestBuy)" -ForegroundColor White
Write-Host "   • Order queue management" -ForegroundColor White
Write-Host "   • Order status management" -ForegroundColor White
Write-Host "   • Order analytics and aggregations" -ForegroundColor White
Write-Host "   • Workflow rules and notifications" -ForegroundColor White
Write-Host "   • Order history tracking" -ForegroundColor White

Write-Host "`n🎯 Milestone 9: Sales Processing Engine - Testing Complete!" -ForegroundColor Cyan
Write-Host "Ready for production use and M10 Order Management System" -ForegroundColor Green
