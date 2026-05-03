[CmdletBinding()]
param(
  [string]$ComposeFile = "docker-compose.onprem.yml",
  [string]$EnvFile = ".env.onprem",
  [string]$OutputDir = "backups",
  [string]$BackupService = "backup",
  [switch]$OpenFolder,
  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found."
  }
}

Require-Command "docker"

if (-not (Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}

if ($EnvFile -and -not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$composeArgs = @()
if ($EnvFile) {
  $composeArgs += @("--env-file", $EnvFile)
}
$composeArgs += @("-f", $ComposeFile)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "Ensuring postgres and backup containers are running..."
docker compose @composeArgs up -d postgres $BackupService | Out-Null

$backupContainer = (docker compose @composeArgs ps -q $BackupService).Trim()
if (-not $backupContainer) {
  throw "Backup container is not running for compose file $ComposeFile."
}

Write-Host "Creating backup inside container service '$BackupService'..."
docker compose @composeArgs exec -T $BackupService /usr/local/bin/stato-container-backup

$latestBackupPath = (docker compose @composeArgs exec -T $BackupService sh -lc "ls -td /backups/stato-container-* 2>/dev/null | head -1").Trim()
if (-not $latestBackupPath) {
  throw "Could not determine latest backup directory inside container."
}

$backupFolderName = Split-Path -Leaf $latestBackupPath
$localBackupPath = Join-Path $OutputDir $backupFolderName

if (Test-Path $localBackupPath) {
  throw "Target backup directory already exists locally: $localBackupPath"
}

Write-Host "Copying backup to host folder $OutputDir..."
docker cp "${backupContainer}:$latestBackupPath" $OutputDir

$resolvedBackupPath = (Resolve-Path $localBackupPath).Path
Write-Host "Backup exported to: $resolvedBackupPath"

if ($OpenFolder) {
  Invoke-Item $resolvedBackupPath
}

if ($PassThru) {
  $resolvedBackupPath
}