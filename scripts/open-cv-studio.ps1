param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$nodePath = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
if (-not $nodePath) { $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
$launchScript = Join-Path $appRoot 'server\start.mjs'
$logPath = Join-Path $appRoot 'data\desktop-launcher.log'
$url = 'http://127.0.0.1:4310/?source=desktop'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
try {
  Add-Content -LiteralPath $logPath -Value ((Get-Date -Format o) + ' Desktop launcher started.')
  if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install Node.js 22.18 or newer and ensure it is on PATH.' }
  if (-not (Test-Path -LiteralPath $launchScript)) { throw 'CV Studio launcher was not found at ' + $launchScript }
  $health = $null
  try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4310/api/health' -TimeoutSec 2 } catch {}
  if ($health.app -ne 'cv-studio') {
    if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'dist\client\index.html'))) { throw 'CV Studio must be built before launching.' }
    Start-Process -FilePath $nodePath -ArgumentList @(('"{0}"' -f $launchScript)) -WorkingDirectory $appRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 500
      try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4310/api/health' -TimeoutSec 2 } catch {}
      if ($health.app -eq 'cv-studio') { break }
    }
  }
  if ($health.app -ne 'cv-studio') { throw 'CV Studio did not become ready on port 4310.' }
  if ($NoOpen) { Write-Output 'CV Studio is ready.'; exit 0 }
  $browser = New-Object System.Diagnostics.ProcessStartInfo
  $browser.FileName = $url
  $browser.UseShellExecute = $true
  $opened = [System.Diagnostics.Process]::Start($browser)
  Add-Content -LiteralPath $logPath -Value ((Get-Date -Format o) + ' Server healthy; browser launch requested. PID=' + $opened.Id)
}
catch {
  $message = $_.Exception.Message
  Add-Content -LiteralPath $logPath -Value ((Get-Date -Format o) + ' ERROR: ' + $message)
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('CV Studio could not open.' + [Environment]::NewLine + [Environment]::NewLine + $message + [Environment]::NewLine + [Environment]::NewLine + 'See: ' + $logPath, 'CV Studio') | Out-Null
  exit 1
}
