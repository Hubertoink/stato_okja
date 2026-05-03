[CmdletBinding()]
param(
  [string]$BackupDir,
  [string]$BackupRoot = "backups",
  [string]$ComposeFile = "docker-compose.onprem.yml",
  [string]$EnvFile = ".env.onprem",
  [string]$UploadsVolume = "stato-onprem-backend-uploads",
  [string]$ConfirmText,
  [switch]$Preview,
  [switch]$OpenFolder,
  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

function Get-LatestBackupDirectory($RootPath) {
  if (-not (Test-Path $RootPath)) {
    throw "Backup root not found: $RootPath"
  }

  $candidates = Get-ChildItem -Path $RootPath -Directory -ErrorAction Stop |
    Where-Object { $_.Name -like 'stato-container-*' -or $_.Name -like 'stato-onprem-*' } |
    Sort-Object LastWriteTime -Descending

  if (-not $candidates) {
    throw "No backup directories found under: $RootPath"
  }

  $candidates[0].FullName
}

$selectedBackupDir = if ($BackupDir) {
  (Resolve-Path $BackupDir).Path
} else {
  Get-LatestBackupDirectory -RootPath $BackupRoot
}

Write-Host "Selected backup: $selectedBackupDir"

if ($OpenFolder) {
  Invoke-Item $selectedBackupDir
}

$manifestPath = Join-Path $selectedBackupDir "manifest.json"
if (Test-Path $manifestPath) {
  Write-Host "Manifest:"
  Get-Content $manifestPath
}

if ($Preview) {
  if ($PassThru) {
    $selectedBackupDir
  }
  return
}

if (-not $ConfirmText) {
  $ConfirmText = Read-Host "Type RESTORE STATO BACKUP to continue"
}

$restoreScript = Join-Path $PSScriptRoot "onprem-restore.ps1"
if (-not (Test-Path $restoreScript)) {
  throw "Restore script not found: $restoreScript"
}

& $restoreScript `
  -BackupDir $selectedBackupDir `
  -ConfirmText $ConfirmText `
  -ComposeFile $ComposeFile `
  -EnvFile $EnvFile `
  -UploadsVolume $UploadsVolume

if ($PassThru) {
  $selectedBackupDir
}