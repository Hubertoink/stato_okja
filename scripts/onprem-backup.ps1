[CmdletBinding()]
param(
  [string]$ComposeFile = "docker-compose.onprem.yml",
  [string]$EnvFile = ".env.onprem",
  [string]$OutputDir = "backups",
  [string]$UploadsVolume = "stato-onprem-backend-uploads",
  [int]$RetentionDays = 0
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

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $OutputDir "stato-onprem-$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$postgresContainer = (docker compose --env-file $EnvFile -f $ComposeFile ps -q postgres).Trim()
if (-not $postgresContainer) {
  throw "Postgres container is not running for compose file $ComposeFile."
}

$tmpDump = "/tmp/stato-backup-$timestamp.dump"
$dbDumpPath = Join-Path $backupRoot "postgres.dump"
$uploadsArchivePath = Join-Path $backupRoot "uploads.tar.gz"

Write-Host "Creating Postgres custom-format dump..."
docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -lc "pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" --format=custom --no-owner --no-acl -f $tmpDump"
docker cp "${postgresContainer}:$tmpDump" $dbDumpPath
docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres rm -f $tmpDump

Write-Host "Archiving uploads volume $UploadsVolume..."
$uploadsArchiveContainer = "stato-backup-uploads-$timestamp"
try {
  docker create --name $uploadsArchiveContainer -v "${UploadsVolume}:/data:ro" alpine:3.20 sh -lc "cd /data; tar -czf /tmp/uploads.tar.gz ." | Out-Null
  docker start -a $uploadsArchiveContainer
  docker cp "${uploadsArchiveContainer}:/tmp/uploads.tar.gz" $uploadsArchivePath
} finally {
  docker rm -f $uploadsArchiveContainer 2>$null | Out-Null
}

$manifest = [ordered]@{
  format = "stato-onprem-container-backup"
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  composeFile = $ComposeFile
  envFile = $EnvFile
  uploadsVolume = $UploadsVolume
  retentionDays = $RetentionDays
  files = @(
    @{ path = "postgres.dump"; purpose = "Postgres custom-format dump" },
    @{ path = "uploads.tar.gz"; purpose = "Backend uploads volume archive" }
  )
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $backupRoot "manifest.json") -Encoding UTF8

if ($RetentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  $currentBackupPath = (Resolve-Path $backupRoot).Path
  Get-ChildItem -Path $OutputDir -Directory -Filter "stato-onprem-*" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $currentBackupPath -and $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Recurse -Force
}

Write-Host "Backup created: $backupRoot"
Write-Host "Database dump: $dbDumpPath"
Write-Host "Uploads archive: $uploadsArchivePath"