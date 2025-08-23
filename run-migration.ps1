# M10 Database Migration Script
# Executes the schema migration on Railway PostgreSQL database

Write-Host "🗄️ Starting M10 Database Schema Migration..." -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please ensure DATABASE_URL is configured." -ForegroundColor Red
    exit 1
}

# Load environment variables
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Host "❌ DATABASE_URL not found in environment variables." -ForegroundColor Red
    exit 1
}

Write-Host "📡 Connecting to Railway PostgreSQL database..." -ForegroundColor Yellow

try {
    # Install psql if not available (requires PostgreSQL client)
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "❌ psql command not found. Please install PostgreSQL client tools." -ForegroundColor Red
        Write-Host "Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
        exit 1
    }

    # Execute migration script
    Write-Host "🔄 Executing M10 schema migration..." -ForegroundColor Yellow
    
    $migrationFile = "backend\scripts\migrate-m10-schema.sql"
    if (-not (Test-Path $migrationFile)) {
        Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
        exit 1
    }

    # Run the migration
    $result = & psql $DATABASE_URL -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ M10 Database Schema Migration Completed Successfully!" -ForegroundColor Green
        Write-Host "📋 Migration Results:" -ForegroundColor Cyan
        Write-Host $result
        
        Write-Host "`n🚀 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Railway will automatically redeploy with updated schema" -ForegroundColor White
        Write-Host "2. Run test-order-management.ps1 to validate M10 functionality" -ForegroundColor White
        Write-Host "3. Check Railway logs for successful service initialization" -ForegroundColor White
    } else {
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $result
        exit 1
    }

} catch {
    Write-Host "❌ Migration error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 M10 Database Migration Complete!" -ForegroundColor Green
