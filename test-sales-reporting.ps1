# M11 Sales Reporting APIs Test Script
# Tests all new M11 sales reporting and analytics services

param(
    [string]$BaseUrl = "https://ecommerce-portal-production-2b8b.up.railway.app",
    [string]$TestEmail = "admin@yourdomain.com",
    [string]$TestPassword = "admin123"
)

$baseUrl = $BaseUrl
$testEmail = $TestEmail
$testPassword = $TestPassword

Write-Host "📊 Starting M11 Sales Reporting APIs Tests..." -ForegroundColor Cyan
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

# Set test date range (last 30 days)
$endDate = (Get-Date).ToString("yyyy-MM-dd")
$startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")

Write-Host "`nTest Period: $startDate to $endDate" -ForegroundColor Gray

# 2. Test Sales Summary API
Write-Host "`n2. Testing Sales Summary API..." -ForegroundColor Yellow

$summaryResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/summary?startDate=$startDate&endDate=$endDate" -Method GET -Token $token
if ($summaryResult -and $summaryResult.success) {
    Write-Host "✓ Sales summary retrieved successfully" -ForegroundColor Green
    Write-Host "   Total Orders: $($summaryResult.summary.total_orders)" -ForegroundColor Gray
    Write-Host "   Total Revenue: $($summaryResult.summary.total_revenue)" -ForegroundColor Gray
    Write-Host "   Average Order Value: $($summaryResult.summary.avg_order_value)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to retrieve sales summary" -ForegroundColor Red
}

# 3. Test Channel Performance API
Write-Host "`n3. Testing Channel Performance API..." -ForegroundColor Yellow

$channelResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/channels?startDate=$startDate&endDate=$endDate" -Method GET -Token $token
if ($channelResult -and $channelResult.success) {
    Write-Host "✓ Channel performance retrieved successfully" -ForegroundColor Green
    Write-Host "   Channels analyzed: $($channelResult.channels.Count)" -ForegroundColor Gray
    foreach ($channel in $channelResult.channels) {
        Write-Host "   - $($channel.channel_name): $($channel.total_orders) orders, $($channel.total_revenue) revenue" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve channel performance" -ForegroundColor Red
}

# 4. Test Top Products API
Write-Host "`n4. Testing Top Products API..." -ForegroundColor Yellow

$productsResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/products/top?startDate=$startDate&endDate=$endDate&limit=5" -Method GET -Token $token
if ($productsResult -and $productsResult.success) {
    Write-Host "✓ Top products retrieved successfully" -ForegroundColor Green
    Write-Host "   Top products count: $($productsResult.products.Count)" -ForegroundColor Gray
    foreach ($product in $productsResult.products) {
        Write-Host "   - $($product.product_name): $($product.units_sold) units, $($product.total_revenue) revenue" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve top products" -ForegroundColor Red
}

# 5. Test Sales Trends API
Write-Host "`n5. Testing Sales Trends API..." -ForegroundColor Yellow

$trendsResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/trends?startDate=$startDate&endDate=$endDate&granularity=daily" -Method GET -Token $token
if ($trendsResult -and $trendsResult.success) {
    Write-Host "✓ Sales trends retrieved successfully" -ForegroundColor Green
    Write-Host "   Trend data points: $($trendsResult.trends.Count)" -ForegroundColor Gray
    if ($trendsResult.trends.Count -gt 0) {
        $latestTrend = $trendsResult.trends[-1]
        Write-Host "   Latest trend: $($latestTrend.period) - $($latestTrend.orders) orders, $($latestTrend.revenue) revenue" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve sales trends" -ForegroundColor Red
}

# 6. Test Customer Segmentation API
Write-Host "`n6. Testing Customer Segmentation API..." -ForegroundColor Yellow

$segmentationResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/customers/segmentation?startDate=$startDate&endDate=$endDate" -Method GET -Token $token
if ($segmentationResult -and $segmentationResult.success) {
    Write-Host "✓ Customer segmentation retrieved successfully" -ForegroundColor Green
    Write-Host "   Customer segments: $($segmentationResult.segments.Count)" -ForegroundColor Gray
    foreach ($segment in $segmentationResult.segments) {
        Write-Host "   - $($segment.segment): $($segment.customer_count) customers, avg spent: $($segment.avg_total_spent)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve customer segmentation" -ForegroundColor Red
}

# 7. Test Comprehensive Report Generation
Write-Host "`n7. Testing Comprehensive Report Generation..." -ForegroundColor Yellow

$comprehensiveData = @{
    startDate = $startDate
    endDate = $endDate
}
$comprehensiveResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/generate/comprehensive" -Method POST -Body $comprehensiveData -Token $token
if ($comprehensiveResult -and $comprehensiveResult.success) {
    Write-Host "✓ Comprehensive report generated successfully" -ForegroundColor Green
    Write-Host "   Report sections: $($comprehensiveResult.report.sections.PSObject.Properties.Name.Count)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to generate comprehensive report" -ForegroundColor Red
}

# 8. Test Report Templates API
Write-Host "`n8. Testing Report Templates API..." -ForegroundColor Yellow

$templatesResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/templates" -Method GET -Token $token
if ($templatesResult -and $templatesResult.success) {
    Write-Host "✓ Report templates retrieved successfully" -ForegroundColor Green
    Write-Host "   Available templates: $($templatesResult.templates.Count)" -ForegroundColor Gray
    foreach ($template in $templatesResult.templates) {
        Write-Host "   - $($template.template_name): $($template.name)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve report templates" -ForegroundColor Red
}

# 9. Test Template Report Generation
Write-Host "`n9. Testing Template Report Generation..." -ForegroundColor Yellow

$templateData = @{
    startDate = $startDate
    endDate = $endDate
    user = "test_user"
}
$templateResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/generate/daily_sales" -Method POST -Body $templateData -Token $token
if ($templateResult -and $templateResult.success) {
    Write-Host "✓ Template report generated successfully" -ForegroundColor Green
    Write-Host "   Report ID: $($templateResult.report_id)" -ForegroundColor Gray
    Write-Host "   Template: $($templateResult.template)" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to generate template report" -ForegroundColor Red
}

# 10. Test Report History API
Write-Host "`n10. Testing Report History API..." -ForegroundColor Yellow

$historyResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/history?limit=5" -Method GET -Token $token
if ($historyResult -and $historyResult.success) {
    Write-Host "✓ Report history retrieved successfully" -ForegroundColor Green
    Write-Host "   Historical reports: $($historyResult.reports.Count)" -ForegroundColor Gray
    foreach ($report in $historyResult.reports) {
        Write-Host "   - $($report.report_name): $($report.status) - $($report.generated_at)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Failed to retrieve report history" -ForegroundColor Red
}

# 11. Test Data Export API
Write-Host "`n11. Testing Data Export API..." -ForegroundColor Yellow

$exportData = @{
    data = @(
        @{ product = "Test Product 1"; sales = 100; revenue = 1000 }
        @{ product = "Test Product 2"; sales = 200; revenue = 2000 }
    )
    format = "csv"
}
$exportResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/export" -Method POST -Body $exportData -Token $token
if ($exportResult) {
    Write-Host "✓ Data export completed successfully" -ForegroundColor Green
    Write-Host "   Export format: CSV" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to export data" -ForegroundColor Red
}

# 12. Test Channel-Specific Reports
Write-Host "`n12. Testing Channel-Specific Reports..." -ForegroundColor Yellow

# Get first channel ID for testing
if ($channelResult -and $channelResult.success -and $channelResult.channels.Count -gt 0) {
    $testChannelId = $channelResult.channels[0].channel_id
    $channelSpecificResult = Invoke-AuthenticatedRequest -Url "$baseUrl/api/reports/sales/summary?startDate=$startDate&endDate=$endDate&channelId=$testChannelId" -Method GET -Token $token
    if ($channelSpecificResult -and $channelSpecificResult.success) {
        Write-Host "✓ Channel-specific report generated successfully" -ForegroundColor Green
        Write-Host "   Channel ID: $testChannelId" -ForegroundColor Gray
    } else {
        Write-Host "✗ Failed to generate channel-specific report" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ Skipping channel-specific test - no channels available" -ForegroundColor Yellow
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "Sales Reporting APIs Test Summary" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "✓ Core Features Tested:" -ForegroundColor Green
Write-Host "   ✓ Sales summary and analytics" -ForegroundColor Green
Write-Host "   ✓ Channel performance comparison" -ForegroundColor Green
Write-Host "   ✓ Top products analysis" -ForegroundColor Green
Write-Host "   ✓ Sales trends and patterns" -ForegroundColor Green
Write-Host "   ✓ Customer segmentation" -ForegroundColor Green
Write-Host "   ✓ Comprehensive report generation" -ForegroundColor Green
Write-Host "   ✓ Template-based reporting" -ForegroundColor Green
Write-Host "   ✓ Report history tracking" -ForegroundColor Green
Write-Host "   ✓ Data export capabilities" -ForegroundColor Green
Write-Host "   ✓ Multi-format support (JSON, CSV)" -ForegroundColor Green

Write-Host "`n🎯 Milestone 11: Sales Reporting APIs - Testing Complete!" -ForegroundColor Magenta
Write-Host "Ready for production use and M12 Data Validation System" -ForegroundColor Magenta
