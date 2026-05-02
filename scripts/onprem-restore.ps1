[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDir,

  [Parameter(Mandatory = $true)]
  [string]$ConfirmText,

  [string]$ComposeFile = "docker-compose.onprem.yml",
  [string]$EnvFile = ".env.onprem",
  [string]$UploadsVolume = "stato-onprem-backend-uploads"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found."
  }
}

Require-Command "docker"

if ($ConfirmText -ne "RESTORE STATO BACKUP") {
  throw "Refusing restore. Re-run with -ConfirmText 'RESTORE STATO BACKUP'."
}

if (-not (Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$backupRoot = (Resolve-Path $BackupDir).Path
$dbDumpPath = Join-Path $backupRoot "postgres.dump"
$uploadsArchivePath = Join-Path $backupRoot "uploads.tar.gz"

if (-not (Test-Path $dbDumpPath)) {
  throw "Database dump not found: $dbDumpPath"
}

if (-not (Test-Path $uploadsArchivePath)) {
  throw "Uploads archive not found: $uploadsArchivePath"
}

Write-Host "Starting Postgres and stopping application containers..."
docker compose --env-file $EnvFile -f $ComposeFile up -d postgres
docker compose --env-file $EnvFile -f $ComposeFile stop backend frontend

$postgresContainer = (docker compose --env-file $EnvFile -f $ComposeFile ps -q postgres).Trim()
if (-not $postgresContainer) {
  throw "Postgres container is not running for compose file $ComposeFile."
}

Write-Host "Restoring Postgres dump. Existing database objects may be dropped."
docker cp $dbDumpPath "${postgresContainer}:/tmp/stato-restore.dump"
docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -lc 'pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/stato-restore.dump; rm -f /tmp/stato-restore.dump'

Write-Host "Restoring uploads volume $UploadsVolume. Existing upload files will be replaced."
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$uploadsRestoreContainer = "stato-restore-uploads-$timestamp"
try {
  docker create --name $uploadsRestoreContainer -v "${UploadsVolume}:/data" alpine:3.20 sh -lc 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -xzf /tmp/uploads.tar.gz -C /data' | Out-Null
  docker cp $uploadsArchivePath "${uploadsRestoreContainer}:/tmp/uploads.tar.gz"
  docker start -a $uploadsRestoreContainer
} finally {
  docker rm -f $uploadsRestoreContainer 2>$null | Out-Null
}

Write-Host "Starting application containers..."
docker compose --env-file $EnvFile -f $ComposeFile up -d backend frontend

Write-Host "Restore completed from: $backupRoot"