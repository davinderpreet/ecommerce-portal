# Basic connectivity test for Railway deployment

$baseUrl = "https://ecommerce-portal-production-d5b5.up.railway.app"

Write-Host "Testing basic connectivity..." -ForegroundColor Cyan

# Test 1: Health endpoint
Write-Host "`nTesting health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET
    Write-Host "✅ Health check successful" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor Gray
    Write-Host "Database: $($response.database)" -ForegroundColor Gray
    Write-Host "BestBuy: $($response.integrations.bestbuy)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Root endpoint
Write-Host "`nTesting root endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/" -Method GET
    Write-Host "✅ Root endpoint accessible" -ForegroundColor Green
}
catch {
    Write-Host "❌ Root endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check if auth endpoint exists
Write-Host "`nTesting auth endpoint structure..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method POST -Body '{}' -ContentType "application/json"
}
catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Auth endpoint exists (400 Bad Request expected)" -ForegroundColor Green
    } else {
        Write-Host "❌ Auth endpoint issue: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nBasic connectivity test completed" -ForegroundColor Cyan
