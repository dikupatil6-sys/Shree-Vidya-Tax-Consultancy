#!/usr/bin/env pwsh
# Startup script for Cyber Cafe Website backend server

$serverPath = Join-Path $PSScriptRoot "server"
$packageJson = Join-Path $serverPath "package.json"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Cyber Cafe Website Server    " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if server directory exists
if (-not (Test-Path $serverPath)) {
    Write-Host "❌ Server directory not found at: $serverPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if package.json exists
if (-not (Test-Path $packageJson)) {
    Write-Host "❌ package.json not found. Installing dependencies..." -ForegroundColor Yellow
    Push-Location $serverPath
    npm install
    Pop-Location
}

Write-Host "✅ Starting server..." -ForegroundColor Green
Write-Host ""

# Start the server
Push-Location $serverPath
npm start
Pop-Location
