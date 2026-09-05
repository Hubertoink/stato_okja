[CmdletBinding()]
param([ValidateSet('status', 'backup', 'restore')][string]$Action = 'status', [string]$BackupDirectory, [string]$ConfirmText)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location $PSScriptRoot
function Invoke-Docker([string[]]$Arguments) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Docker-Befehl fehlgeschlagen. Details stehen in der vorherigen Ausgabe.' }
}
$compose = @('compose', '--env-file', 'config/stato.env', '-f', 'compose.yaml')
try {
    switch ($Action) {
        status {
            Invoke-Docker ($compose + @('ps'))
            Invoke-Docker ($compose + @('exec', '-T', 'backup', 'sh', '-c', 'if [ -f /backups/last-success.txt ]; then cat /backups/last-success.txt; else echo "Noch kein erfolgreiches automatisches Backup."; fi'))
        }
        backup { Invoke-Docker ($compose + @('exec', '-T', 'backup', '/usr/local/bin/stato-container-backup')) }
        restore {
            if ($ConfirmText -ne 'RESTORE STATO BACKUP') { throw "Wiederherstellung ersetzt Daten. Erforderlich: -ConfirmText 'RESTORE STATO BACKUP'" }
            $source = (Resolve-Path -LiteralPath $BackupDirectory).Path
            foreach ($file in @('postgres.dump', 'uploads.tar.gz', 'SHA256SUMS')) {
                if (-not (Test-Path -LiteralPath (Join-Path $source $file))) { throw "Backup unvollständig: $file" }
            }
            $verified = @()
            foreach ($line in Get-Content -LiteralPath (Join-Path $source 'SHA256SUMS')) {
                if ($line -notmatch '^([a-fA-F0-9]{64})\s+\*?((?:/backups/stato-container-[A-Za-z0-9-]+/)?[^/\\]+)$') { throw 'Ungültiges Prüfsummenformat.' }
                $hash = $Matches[1]; $file = $Matches[2]
                $file = ($file -split '/')[-1]
                if ($file -notin @('postgres.dump', 'uploads.tar.gz', 'config.tar.gz', 'VERSION')) { throw 'Unerwartete Datei im Backup.' }
                if ((Get-FileHash -LiteralPath (Join-Path $source $file) -Algorithm SHA256).Hash -ne $hash) { throw "Backup beschädigt: $file" }
                $verified += $file
            }
            if ('postgres.dump' -notin $verified -or 'uploads.tar.gz' -notin $verified) { throw 'Prüfsummen fehlen.' }
            Invoke-Docker ($compose + @('up', '-d', '--wait', '--wait-timeout', '120', 'postgres'))
            Invoke-Docker ($compose + @('stop', 'frontend', 'backend', 'backup'))
            $dbId = (Invoke-Docker ($compose + @('ps', '-q', 'postgres')) | Out-String).Trim()
            Invoke-Docker @('cp', (Join-Path $source 'postgres.dump'), "${dbId}:/tmp/stato-restore.dump")
            Invoke-Docker ($compose + @('exec', '-T', 'postgres', 'sh', '-ec', 'pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/stato-restore.dump; rm /tmp/stato-restore.dump'))
            $appId = (Invoke-Docker ($compose + @('ps', '-aq', 'backend')) | Out-String).Trim()
            Invoke-Docker @('cp', (Join-Path $source 'uploads.tar.gz'), "${appId}:/app/uploads/.stato-restore.tar.gz")
            Invoke-Docker ($compose + @('run', '--rm', '--no-deps', '--user', '0', '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', '--cap-add', 'FOWNER', '--entrypoint', 'sh', 'backend', '-ec', 'cd /app/uploads; find . -mindepth 1 -maxdepth 1 ! -name .stato-restore.tar.gz -exec rm -rf {} +; tar -xzf .stato-restore.tar.gz; rm .stato-restore.tar.gz; chown -R node:node .'))
            Invoke-Docker ($compose + @('up', '-d', '--wait', '--wait-timeout', '180', 'postgres', 'backend', 'frontend', 'backup'))
            Invoke-Docker ($compose + @('exec', '-T', 'frontend', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/api/health'))
            Write-Host 'Wiederherstellung erfolgreich.'
        }
    }
} finally { Pop-Location }
