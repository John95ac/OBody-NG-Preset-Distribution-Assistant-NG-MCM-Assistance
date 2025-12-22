$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

$portIniPath = Join-Path (Split-Path -Parent $scriptPath) "ini\PORT.ini"
if (Test-Path $portIniPath) {
    $portMatch = Get-Content $portIniPath | Select-String "PORT\s*=\s*(\d+)"
    if ($portMatch) {
        $port = [int]$portMatch.Matches.Groups[1].Value
    } else {
        Write-Host "ERROR: Invalid PORT.ini format" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit
    }
} else {
    Write-Host "PORT.ini not found, starting server to generate it..." -ForegroundColor Yellow
    Start-Process -FilePath $pythonExe -ArgumentList "server.pyw" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    # Now read the generated PORT.ini
    $portMatch = Get-Content $portIniPath | Select-String "PORT\s*=\s*(\d+)"
    if ($portMatch) {
        $port = [int]$portMatch.Matches.Groups[1].Value
    } else {
        Write-Host "ERROR: Unable to read PORT from generated $portIniPath" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit
    }
}

$pythonExe = Join-Path $scriptPath "python\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "ERROR: Python not found at: $pythonExe" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

if (-not (Test-Path "Json")) { New-Item -ItemType Directory -Path "Json" | Out-Null }
if (-not (Test-Path "ini")) { New-Item -ItemType Directory -Path "ini" | Out-Null }

$offFile = Join-Path $scriptPath "ini\off.ini"
if (Test-Path $offFile) {
    Set-Content -Path $offFile -Value "on" -Encoding UTF8
} else {
    New-Item -Path $offFile -ItemType File -Value "on" | Out-Null
}

# Firewall rule for PRIVATE network
$ruleName = "SkyrimModManager"
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile Private `
    -ErrorAction SilentlyContinue | Out-Null

Write-Host "Starting server..." -ForegroundColor Green

Start-Process -FilePath $pythonExe -ArgumentList "server.pyw" -WindowStyle Hidden

Start-Sleep -Seconds 2

Start-Process "http://localhost:$port"

Write-Host "Server running in background..."