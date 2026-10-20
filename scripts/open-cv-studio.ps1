$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$nodePath = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
$launchScript = Join-Path $appRoot 'scripts\launch.mjs'
$logPath = Join-Path $appRoot 'data\desktop-launcher.log'
$url = 'http://127.0.0.1:4310/?source=desktop'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
try {
  Add-Content -LiteralPath $logPath -Value ((Get-Date -Format o) + ' Desktop launcher started.')
  if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install Node.js 22.18 or newer and ensure it is on PATH.' }
  if (-not (Test-Path -LiteralPath $launchScript)) { throw 'CV Studio launcher was not found at ' + $launchScript }
  $process = Start-Process -FilePath $nodePath -ArgumentList @(('"{0}"' -f $launchScript), '--no-open') -WorkingDirectory $appRoot -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'The CV Studio server launcher exited with code ' + $process.ExitCode }
  $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4310/api/health' -TimeoutSec 15
  if ($health.StatusCode -ne 200) { throw 'CV Studio health check returned ' + $health.StatusCode }
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