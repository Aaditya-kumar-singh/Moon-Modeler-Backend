# Environment Validation Script for Moon Modeler Backend
Write-Host "`n=== Moon Modeler - Environment Validation ===" -ForegroundColor Cyan

$errors = @()
$warnings = @()

# Check if .env file exists
Write-Host "`nChecking .env file..." -NoNewline
if (Test-Path ".env") {
    Write-Host " OK" -ForegroundColor Green
    
    # Parse .env file
    $envContent = Get-Content ".env" -Raw
    
    # Check required variables
    Write-Host "`nChecking required variables:"
    
    # PORT
    if ($envContent -match 'PORT=(\d+)') {
        Write-Host "  PORT: $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "  PORT: Not set (will use default 3002)" -ForegroundColor Yellow
        $warnings += "PORT not explicitly set"
    }
    
    # DATABASE_URL
    if ($envContent -match 'DATABASE_URL=.+postgresql.+') {
        Write-Host "  DATABASE_URL: Configured" -ForegroundColor Green
    } else {
        Write-Host "  DATABASE_URL: Missing or invalid" -ForegroundColor Red
        $errors += "DATABASE_URL is required"
    }
    
    # NEXTAUTH_SECRET
    if ($envContent -match 'NEXTAUTH_SECRET=".+"') {
        if ($envContent -match 'your-super-secret-key-change-this-in-production') {
            Write-Host "  NEXTAUTH_SECRET: Using example value (should change)" -ForegroundColor Yellow
            $warnings += "NEXTAUTH_SECRET should be changed"
        } else {
            Write-Host "  NEXTAUTH_SECRET: Set" -ForegroundColor Green
        }
    } else {
        Write-Host "  NEXTAUTH_SECRET: Not set" -ForegroundColor Yellow
        $warnings += "NEXTAUTH_SECRET recommended for production"
    }
    
    # NODE_ENV
    if ($envContent -match 'NODE_ENV=(\w+)') {
        Write-Host "  NODE_ENV: $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "  NODE_ENV: Not set (will use default)" -ForegroundColor Yellow
    }
    
} else {
    Write-Host " NOT FOUND" -ForegroundColor Red
    $errors += ".env file not found - Run: Copy-Item .env.example .env"
}

# Check .gitignore
Write-Host "`nChecking .gitignore..." -NoNewline
if (Test-Path ".gitignore") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " NOT FOUND" -ForegroundColor Yellow
    $warnings += ".gitignore file missing"
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "`nAll checks passed! Environment is properly configured." -ForegroundColor Green
    Write-Host "Ready to start: npm run dev`n" -ForegroundColor White
} else {
    if ($errors.Count -gt 0) {
        Write-Host "`nErrors:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`nWarnings:" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
    
    Write-Host "`nSee ENVIRONMENT.md for setup instructions`n" -ForegroundColor White
}
