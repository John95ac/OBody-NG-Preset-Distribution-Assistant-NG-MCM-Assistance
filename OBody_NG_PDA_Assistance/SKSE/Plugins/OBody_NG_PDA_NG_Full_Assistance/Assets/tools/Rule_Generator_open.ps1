Add-Type -AssemblyName System.Windows.Forms

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$masterFile = Join-Path $scriptPath "..\ini\OBodyNG_PDA_temp.ini"
$iniFile = Join-Path $scriptPath "Rule_Generator_open.ini"
$folderPath = Join-Path $scriptPath "..\ini"

$openDialog = New-Object System.Windows.Forms.OpenFileDialog
$openDialog.Title = "Select an INI file"
$openDialog.Filter = "INI files (*.ini)|*.ini"
$openDialog.InitialDirectory = $folderPath

if ($openDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $selectedFile = $openDialog.FileName
    $content = Get-Content -Path $selectedFile -Raw -Encoding UTF8
    Set-Content -Path $masterFile -Value $content -Encoding UTF8 -NoNewline
    
    # Change the ini value
    $iniContent = Get-Content -Path $iniFile -Raw
    $iniContent = $iniContent -replace "start = false", "start = true"
    Set-Content -Path $iniFile -Value $iniContent -Encoding UTF8 -NoNewline
}

exit