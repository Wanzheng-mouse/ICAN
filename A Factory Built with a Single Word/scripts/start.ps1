param(
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root 'services/api'
$Python = Join-Path $Api '.venv/Scripts/python.exe'

if ($Install -or -not (Test-Path $Python)) {
  python -m venv (Join-Path $Api '.venv')
  & $Python -m pip install -r (Join-Path $Api 'requirements.txt')
  Push-Location $Root
  try { npm install } finally { Pop-Location }
}

$ApiProcess = Start-Process -FilePath $Python -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000') -WorkingDirectory $Api -WindowStyle Hidden -PassThru
$WebProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory $Root -WindowStyle Hidden -PassThru

Write-Host "ICAN started: web http://localhost:5173, API http://localhost:8000/docs"
Write-Host "Press Enter to stop both services."
Read-Host | Out-Null

foreach ($Process in @($WebProcess, $ApiProcess)) {
  if ($Process -and -not $Process.HasExited) { Stop-Process -Id $Process.Id -Force }
}
