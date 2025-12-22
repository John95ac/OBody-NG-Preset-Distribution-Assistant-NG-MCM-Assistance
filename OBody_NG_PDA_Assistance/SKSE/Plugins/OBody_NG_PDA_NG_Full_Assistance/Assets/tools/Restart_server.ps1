$ErrorActionPreference = "Stop"

# Get the directory where this script is located (Assets\tools)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Python.exe is in Assets\python\python.exe
$pythonExe = Join-Path (Split-Path $scriptPath -Parent) "python\python.exe"

# The .pyw script is in the same folder as this .ps1
$pywPath = Join-Path $scriptPath "Restart_server.pyw"

if (-not (Test-Path $pythonExe)) {
    Write-Host "ERROR: Python not found at: $pythonExe" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path $pywPath)) {
    Write-Host "ERROR: Python script not found at: $pywPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Execute Python script with working directory set to Assets\tools
Start-Process -FilePath $pythonExe -ArgumentList "`"$pywPath`"" -WorkingDirectory $scriptPath -WindowStyle Hidden

exit 0
