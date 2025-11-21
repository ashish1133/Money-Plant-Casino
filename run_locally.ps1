# PowerShell script to launch the Money Plant Casino locally
# Run this script to start a local server and open the browser

$port = 8000
$url = "http://localhost:$port"
$index = ".\index.html"

Write-Host "=== Money Plant Casino Launcher ===" -ForegroundColor Cyan

if (-not (Test-Path $index)) {
    Write-Host "Error: index.html not found in current directory." -ForegroundColor Red
    exit
}

# Try to find Python to run a proper HTTP server (avoids CORS/file protocol issues)
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    Write-Host "Python found. Starting local server..." -ForegroundColor Green
    try {
        # Start python server in a new minimized window
        Start-Process "python" -ArgumentList "-m http.server $port" -WindowStyle Minimized
        Start-Sleep -Seconds 2
        Write-Host "Opening $url..."
        Start-Process $url
        Write-Host "Success! Server is running in the background." -ForegroundColor Green
        exit
    } catch {
        Write-Host "Failed to start Python server." -ForegroundColor Red
    }
}
elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    Write-Host "Python3 found. Starting local server..." -ForegroundColor Green
    try {
        Start-Process "python3" -ArgumentList "-m http.server $port" -WindowStyle Minimized
        Start-Sleep -Seconds 2
        Write-Host "Opening $url..."
        Start-Process $url
        Write-Host "Success! Server is running in the background." -ForegroundColor Green
        exit
    } catch {
        Write-Host "Failed to start Python3 server." -ForegroundColor Red
    }
}

# Fallback: Open file directly
Write-Host "Python not found or failed. Opening file directly..." -ForegroundColor Yellow
Start-Process $index
Write-Host "Note: Some features might be limited without a local server." -ForegroundColor Gray
