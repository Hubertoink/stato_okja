[CmdletBinding()]
param(
    [string]$InstallDirectory = $env:STATO_INSTALL_DIR,
    [string]$ReleaseTag = $env:STATO_RELEASE_TAG
)

# This script is published as a GitHub Release asset. The release workflow
# replaces the placeholder with the immutable tag, so `releases/latest/download`
# still installs an exact version after GitHub has resolved "latest".
$BundledReleaseTag = '__STATO_RELEASE_TAG__'
$Repository = 'Hubertoink/stato_okja'
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' wurde nicht gefunden. $Hint"
    }
}

function Invoke-Native([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Befehl fehlgeschlagen: $Command $($Arguments -join ' ')"
    }
}

function New-RandomHex([int]$ByteCount) {
    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Get-EnvValue([string]$Path, [string]$Key) {
    $content = [System.IO.File]::ReadAllText($Path)
    $match = [regex]::Match($content, '(?m)^' + [regex]::Escape($Key) + '=(.*)$')
    if (-not $match.Success) { throw "Variable '$Key' fehlt in $Path." }
    return $match.Groups[1].Value.Trim()
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
    $content = [System.IO.File]::ReadAllText($Path)
    $pattern = '(?m)^' + [regex]::Escape($Key) + '=.*$'
    if (-not [regex]::IsMatch($content, $pattern)) { throw "Variable '$Key' fehlt in $Path." }
    $content = [regex]::Replace($content, $pattern, { param($match) "$Key=$Value" })
    [System.IO.File]::WriteAllText($Path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

function Ensure-EnvValue([string]$Path, [string]$Key, [string]$DefaultValue) {
    $content = [System.IO.File]::ReadAllText($Path)
    if ([regex]::IsMatch($content, '(?m)^' + [regex]::Escape($Key) + '=')) { return }
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $content += "`n" }
    $content += "$Key=$DefaultValue`n"
    [System.IO.File]::WriteAllText($Path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

function Resolve-ReleaseTag {
    if ($ReleaseTag) { return $ReleaseTag.Trim() }
    if ($BundledReleaseTag -ne '__STATO_RELEASE_TAG__') { return $BundledReleaseTag }
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers @{ 'User-Agent' = 'StatO-OnPrem-Installer' }
    if (-not $latest.tag_name) { throw 'Die aktuelle StatO-Release-Version konnte nicht ermittelt werden.' }
    return $latest.tag_name
}

function Get-ExpectedSha256([string]$ChecksumsPath, [string]$FileName) {
    $line = Get-Content $ChecksumsPath | Where-Object { $_ -match ('\s\*?' + [regex]::Escape($FileName) + '$') } | Select-Object -First 1
    if (-not $line) { throw "Pruefsumme fuer '$FileName' fehlt." }
    return ($line -split '\s+')[0].ToUpperInvariant()
}

function Copy-DirectoryIfMissing([string]$Source, [string]$Destination) {
    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
        Copy-Item -Recurse -Force $Source $Destination
    }
}

function Test-InternalTls([string]$EnvFile) {
    $mode = (Get-EnvValue $EnvFile 'STATO_TLS_MODE').ToLowerInvariant()
    if ($mode -eq 'off') { return $false }
    if ($mode -ne 'internal') { throw "STATO_TLS_MODE muss 'off' oder 'internal' sein (aktueller Wert: '$mode')." }

    $hostName = Get-EnvValue $EnvFile 'STATO_PUBLIC_HOST'
    if ($hostName -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$' -or $hostName -notlike '*.*' -or $hostName.Contains('..')) {
        throw 'STATO_PUBLIC_HOST muss ein DNS-Name ohne Protokoll, Pfad oder Port sein.'
    }
    $port = 0
    if (-not [int]::TryParse((Get-EnvValue $EnvFile 'HTTPS_PORT'), [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw 'HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein.'
    }
    $origin = if ($port -eq 443) { "https://$hostName" } else { "https://$hostName`:$port" }
    Set-EnvValue $EnvFile 'HTTP_BIND_ADDRESS' '127.0.0.1'
    Set-EnvValue $EnvFile 'APP_ORIGIN' $origin
    Set-EnvValue $EnvFile 'CORS_ORIGINS' $origin
    Set-EnvValue $EnvFile 'AUTH_REFRESH_COOKIE_SECURE' 'true'
    return $true
}

function Test-TcpPortAvailable([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    try {
        $listener.Start()
        return $true
    } catch [System.Net.Sockets.SocketException] {
        return $false
    } finally {
        $listener.Stop()
    }
}

function Get-AvailableTcpPort([int]$FirstPort, [int]$LastPort) {
    for ($port = $FirstPort; $port -le $LastPort; $port++) {
        if (Test-TcpPortAvailable $port) { return $port }
    }
    throw "Keiner der lokalen HTTP-Ports $FirstPort bis $LastPort ist verfügbar. Bitte HTTP_PORT in config/stato.env manuell setzen."
}

function Update-DefaultLocalOrigin([string]$EnvFile, [int]$Port) {
    $portSuffix = if ($Port -eq 80) { '' } else { ":$Port" }
    foreach ($key in @('APP_ORIGIN', 'CORS_ORIGINS')) {
        $value = Get-EnvValue $EnvFile $key
        if ($value -in @('http://localhost', 'http://127.0.0.1')) {
            Set-EnvValue $EnvFile $key ("$value$portSuffix")
        }
    }
}

function Resolve-FirstInstallHttpPort([string]$EnvFile, [bool]$KnownRuntime) {
    if ($KnownRuntime -or (Get-EnvValue $EnvFile 'STATO_TLS_MODE').ToLowerInvariant() -ne 'off') { return }

    $configuredPort = 0
    if (-not [int]::TryParse((Get-EnvValue $EnvFile 'HTTP_PORT'), [ref]$configuredPort) -or $configuredPort -lt 1 -or $configuredPort -gt 65535) {
        throw 'HTTP_PORT muss eine Portnummer zwischen 1 und 65535 sein.'
    }
    if (Test-TcpPortAvailable $configuredPort) { return }

    # Only replace the default port on a fresh installation. Changing a custom
    # port or an existing installation implicitly could make a public service
    # unreachable, so those cases remain an explicit administrator decision.
    if ($configuredPort -ne 80) {
        throw "HTTP_PORT=$configuredPort ist bereits belegt. Bitte in config/stato.env einen freien Port setzen und den Installer erneut ausführen."
    }

    $fallbackPort = Get-AvailableTcpPort 8080 8090
    Set-EnvValue $EnvFile 'HTTP_PORT' $fallbackPort
    Update-DefaultLocalOrigin $EnvFile $fallbackPort
    Write-Host "  [Hinweis] Host-Port 80 ist belegt. Die neue lokale Installation verwendet http://localhost:$fallbackPort." -ForegroundColor Yellow
}

function Invoke-Compose([string[]]$Arguments) {
    & docker @script:composeArguments @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose fehlgeschlagen: $($Arguments -join ' ')" }
}

function New-PreUpdateBackup([string]$BackupDirectory) {
    Write-Step 'Sicherheitsbackup vor dem Update erstellen'
    Invoke-Compose @('up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'postgres', 'backup')
    Invoke-Compose @('exec', '-T', 'backup', '/usr/local/bin/stato-container-backup')
    $insidePath = (& docker @script:composeArguments exec -T backup sh -lc 'ls -td /backups/stato-container-* | head -1').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $insidePath) { throw 'Das erzeugte Sicherheitsbackup konnte nicht gefunden werden.' }
    $backupContainer = (& docker @script:composeArguments ps -q backup).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $backupContainer) { throw 'Der Backup-Container konnte nicht ermittelt werden.' }
    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    Invoke-Native docker @('cp', "${backupContainer}:$insidePath", $BackupDirectory)
}

Write-Step 'Voraussetzungen prüfen'
Require-Command docker 'Bitte Docker Desktop bzw. Docker Engine installieren.'
Invoke-Native docker @('compose', 'version')
Invoke-Native docker @('info')

$resolvedTag = Resolve-ReleaseTag
if ($resolvedTag -notmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
    throw "Ungueltiger Release-Tag: $resolvedTag"
}
$version = $resolvedTag.TrimStart('v')

if (-not $InstallDirectory) { $InstallDirectory = Join-Path $PWD 'stato' }
$InstallDirectory = [System.IO.Path]::GetFullPath($InstallDirectory)
$configDirectory = Join-Path $InstallDirectory 'config'
$envFile = Join-Path $configDirectory 'stato.env'
$runtimeComposeFile = Join-Path $InstallDirectory 'compose.yaml'
$markerFile = Join-Path $InstallDirectory '.stato-onprem-runtime'
$releaseDirectory = Join-Path $InstallDirectory "releases/$version"
$backupDirectory = Join-Path $InstallDirectory 'backups'

Write-Step "Release $resolvedTag herunterladen"
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("stato-onprem-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
try {
    $assetName = "StatO-v$version.zip"
    $releaseUrl = "https://github.com/$Repository/releases/download/$resolvedTag"
    $checksumsPath = Join-Path $temporaryDirectory 'SHA256SUMS'
    $bundlePath = Join-Path $temporaryDirectory $assetName
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/SHA256SUMS" -OutFile $checksumsPath
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/$assetName" -OutFile $bundlePath
    $expectedHash = Get-ExpectedSha256 $checksumsPath $assetName
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundlePath).Hash.ToUpperInvariant()
    if ($actualHash -ne $expectedHash) { throw 'Die Pruefsumme des Release-Bundles stimmt nicht.' }

    $bundleDirectory = Join-Path $temporaryDirectory 'bundle'
    Expand-Archive -LiteralPath $bundlePath -DestinationPath $bundleDirectory -Force
    foreach ($requiredPath in @('compose.yaml', 'config/stato.env.example', 'config/Caddyfile', 'config/legal/manifest.json')) {
        if (-not (Test-Path (Join-Path $bundleDirectory $requiredPath))) { throw "Release-Bundle ist unvollstaendig: $requiredPath" }
    }

    $knownRuntime = Test-Path $markerFile
    if (-not $knownRuntime -and (docker volume ls --format '{{.Name}}') -contains 'stato-onprem-postgres-data') {
        throw "Ein vorhandenes On-Prem-Datenvolume wurde erkannt. Dieses neue Release-Installationsverfahren startet es absichtlich nicht. Nutze fuer die bestehende Installation weiter den bisherigen Installer und migriere erst mit einer getesteten Migrationsanleitung."
    }

    New-Item -ItemType Directory -Force -Path $InstallDirectory, $configDirectory, (Split-Path -Parent $releaseDirectory) | Out-Null
    if ($knownRuntime) {
        $script:composeArguments = @('compose')
        if ((Get-EnvValue $envFile 'STATO_TLS_MODE') -eq 'internal') { $script:composeArguments += @('--profile', 'internal-tls') }
        $script:composeArguments += @('-f', $runtimeComposeFile, '--env-file', $envFile)
        New-PreUpdateBackup $backupDirectory
        $snapshotDirectory = Join-Path $backupDirectory ("runtime-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        New-Item -ItemType Directory -Path $snapshotDirectory | Out-Null
        Copy-Item -Recurse -LiteralPath $configDirectory -Destination (Join-Path $snapshotDirectory 'config')
        Copy-Item -LiteralPath $runtimeComposeFile, $markerFile, (Join-Path $InstallDirectory 'VERSION') -Destination $snapshotDirectory
    }
    if (-not (Test-Path $releaseDirectory)) { Copy-Item -Recurse -Force $bundleDirectory $releaseDirectory }

    if (-not (Test-Path $envFile)) {
        $legacyEnv = Join-Path $InstallDirectory '.env.onprem'
        if (Test-Path $legacyEnv) {
            Copy-Item -Force $legacyEnv $envFile
            Write-Host '  [OK] Vorhandene .env.onprem nach config/stato.env uebernommen.' -ForegroundColor Yellow
        } else {
            Copy-Item -Force (Join-Path $bundleDirectory 'config/stato.env.example') $envFile
        }
    }
    if (-not (Test-Path (Join-Path $configDirectory 'Caddyfile'))) {
        Copy-Item -Force (Join-Path $bundleDirectory 'config/Caddyfile') (Join-Path $configDirectory 'Caddyfile')
    }
    Copy-DirectoryIfMissing (Join-Path $bundleDirectory 'config/legal') (Join-Path $configDirectory 'legal')

    foreach ($default in @(
        @('HTTP_BIND_ADDRESS', '0.0.0.0'), @('STATO_TLS_MODE', 'off'), @('STATO_PUBLIC_HOST', ''),
        @('HTTPS_BIND_ADDRESS', '0.0.0.0'), @('HTTPS_PORT', '443'), @('INITIAL_SETUP_ENABLED', 'true'),
        @('STATO_FRONTEND_IMAGE_TAG', ''), @('INITIAL_SETUP_TOKEN', 'GENERATED_BY_INSTALLER')
    )) { Ensure-EnvValue $envFile $default[0] $default[1] }
    if ((Get-EnvValue $envFile 'INITIAL_SETUP_TOKEN') -eq 'GENERATED_BY_INSTALLER') { Set-EnvValue $envFile 'INITIAL_SETUP_TOKEN' (New-RandomHex 32) }
    if ((Get-EnvValue $envFile 'POSTGRES_PASSWORD') -eq 'GENERATED_BY_INSTALLER') { Set-EnvValue $envFile 'POSTGRES_PASSWORD' "StatoDb_$(New-RandomHex 24)_A9!" }
    if ((Get-EnvValue $envFile 'JWT_SECRET') -eq 'GENERATED_BY_INSTALLER') { Set-EnvValue $envFile 'JWT_SECRET' (New-RandomHex 48) }
    Set-EnvValue $envFile 'STATO_IMAGE_TAG' $version
    Set-EnvValue $envFile 'STATO_FRONTEND_IMAGE_TAG' "onprem-$version"
    if ($env:STATO_INTERNAL_TLS_HOST) {
        Set-EnvValue $envFile 'STATO_TLS_MODE' 'internal'
        Set-EnvValue $envFile 'STATO_PUBLIC_HOST' $env:STATO_INTERNAL_TLS_HOST.Trim()
    }

    $tlsEnabled = Test-InternalTls $envFile
    Copy-Item -Force (Join-Path $bundleDirectory 'compose.yaml') $runtimeComposeFile
    foreach ($file in @('onprem-runtime.sh', 'onprem-runtime.ps1', 'START.md', 'OPERATIONS.md')) {
        $source = Join-Path $bundleDirectory $file
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $InstallDirectory $file) -Force }
    }

    $script:composeArguments = @('compose')
    if ($tlsEnabled) { $script:composeArguments += @('--profile', 'internal-tls') }
    $script:composeArguments += @('-f', $runtimeComposeFile, '--env-file', $envFile)

    Write-Step 'Compose-Konfiguration prüfen'
    Invoke-Compose @('config', '--quiet')
    Write-Step 'Release-Images laden'
    Invoke-Compose @('pull', 'postgres', 'backend', 'frontend', 'backup')
    if ($tlsEnabled) { Invoke-Compose @('pull', 'caddy') }
    Write-Step 'HTTP-Port prüfen'
    Resolve-FirstInstallHttpPort $envFile $knownRuntime

    Write-Step 'PostgreSQL starten und Zugang synchronisieren'
    Invoke-Compose @('up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'postgres')
    $syncSql = "SELECT format('ALTER ROLE %I PASSWORD %L', current_user, :'password') \gexec"
    $syncSql | & docker @script:composeArguments exec -T postgres sh -c 'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set "password=$POSTGRES_PASSWORD"'
    if ($LASTEXITCODE -ne 0) { throw 'Das PostgreSQL-Passwort konnte nicht synchronisiert werden.' }

    $schemaState = ("SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 'missing' ELSE 'present' END;" | & docker @script:composeArguments exec -T postgres sh -c 'exec psql --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1' | Where-Object { $_ -in @('missing', 'present') } | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or $schemaState -notin @('missing', 'present')) { throw 'Der Datenbankstatus konnte nicht ermittelt werden.' }

    Write-Step 'Berechtigungen des Upload-Verzeichnisses prüfen'
    Invoke-Compose @('run', '--rm', '--no-deps', '--user', '0', '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', '--cap-add', 'FOWNER', '--entrypoint', 'sh', 'backend', '-c', 'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads')

    if ($schemaState -eq 'missing') {
        Write-Step 'Leere Datenbank initialisieren'
        $oldSynchronize = $env:DB_SYNCHRONIZE; $oldMigrations = $env:DB_MIGRATIONS_RUN
        try {
            $env:DB_SYNCHRONIZE = 'true'; $env:DB_MIGRATIONS_RUN = 'false'
            Invoke-Compose @('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend')
        } finally {
            if ($null -eq $oldSynchronize) { Remove-Item Env:DB_SYNCHRONIZE -ErrorAction SilentlyContinue } else { $env:DB_SYNCHRONIZE = $oldSynchronize }
            if ($null -eq $oldMigrations) { Remove-Item Env:DB_MIGRATIONS_RUN -ErrorAction SilentlyContinue } else { $env:DB_MIGRATIONS_RUN = $oldMigrations }
        }
        Invoke-Compose @('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend')
    }

    Write-Step 'StatO starten'
    Invoke-Compose @('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')
    Invoke-Compose @('exec', '-T', 'frontend', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/api/health')
    Invoke-Compose @('ps')
    [System.IO.File]::WriteAllText($markerFile, "$resolvedTag`n", (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText((Join-Path $InstallDirectory 'VERSION'), "$version`n", (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "`nInstallation: $InstallDirectory"
    Write-Host "Konfiguration: $envFile"
    Write-Host "Release:      $resolvedTag"
    Write-Host "Adresse:      $(Get-EnvValue $envFile 'APP_ORIGIN')"
    Write-Host "Einrichtungscode: INITIAL_SETUP_TOKEN in $envFile"
} finally {
    $resolvedTemporaryDirectory = [System.IO.Path]::GetFullPath($temporaryDirectory)
    $temporaryPrefix = Join-Path ([System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())) 'stato-onprem-'
    if (-not $resolvedTemporaryDirectory.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Temporäres Verzeichnis liegt außerhalb des Installer-Bereichs.'
    }
    if (Test-Path -LiteralPath $resolvedTemporaryDirectory) { Remove-Item -LiteralPath $resolvedTemporaryDirectory -Recurse -Force }
}
