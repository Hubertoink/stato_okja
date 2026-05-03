[CmdletBinding()]
param(
  [string]$ComposeFile = "docker-compose.onprem.yml",
  [string]$EnvFile = ".env.onprem",
  [string]$OutputDir = "backups",
  [string]$HealthUrl = "http://localhost/api/health",
  [string]$LogDir = "backups/logs",
  [switch]$OpenFolder,
  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

function Invoke-HealthProbe($Url) {
  try {
    $response = Invoke-RestMethod -Uri $Url -TimeoutSec 15
    [ordered]@{
      ok = $true
      checkedAt = (Get-Date).ToUniversalTime().ToString("o")
      response = $response
    }
  } catch {
    [ordered]@{
      ok = $false
      checkedAt = (Get-Date).ToUniversalTime().ToString("o")
      error = $_.Exception.Message
    }
  }
}

$startedAt = Get-Date
$report = [ordered]@{
  format = "stato-daily-ops"
  schemaVersion = 1
  startedAt = $startedAt.ToUniversalTime().ToString("o")
  composeFile = $ComposeFile
  envFile = $EnvFile
  healthUrl = $HealthUrl
}

$report.preHealth = Invoke-HealthProbe -Url $HealthUrl
$backupScript = Join-Path $PSScriptRoot "onprem-backup-easy.ps1"
if (-not (Test-Path $backupScript)) {
  throw "Backup script not found: $backupScript"
}

$backupPath = $null
$logPath = $null

try {
  $backupResult = & $backupScript -ComposeFile $ComposeFile -EnvFile $EnvFile -OutputDir $OutputDir -PassThru
  $backupPath = @($backupResult)[-1]
  $report.backupPath = $backupPath
  $report.backupFiles = @(
    Get-ChildItem -Path $backupPath | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
      [ordered]@{
        path = $_.Name
        sizeBytes = $_.Length
      }
    }
  )
} catch {
  $report.backupError = $_.Exception.Message
  throw
} finally {
  $report.postHealth = Invoke-HealthProbe -Url $HealthUrl
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $logPath = Join-Path $LogDir ("stato-daily-ops-{0}.json" -f $startedAt.ToString("yyyyMMdd-HHmmss"))
  $report | ConvertTo-Json -Depth 6 | Set-Content -Path $logPath -Encoding UTF8
}

Write-Host "Daily ops report written to: $logPath"

if ($OpenFolder -and $backupPath) {
  Invoke-Item $backupPath
}

if ($PassThru) {
  [pscustomobject]@{
    BackupPath = $backupPath
    LogPath = $logPath
    PreHealthOk = [bool]$report.preHealth.ok
    PostHealthOk = [bool]$report.postHealth.ok
  }
}

if (-not $report.preHealth.ok -or -not $report.postHealth.ok) {
  throw "Daily ops completed, but at least one health check failed. See: $logPath"
}