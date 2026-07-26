[CmdletBinding()]
param(
    [string]$RepositoryUrl = $(if ($env:STATO_REPO_URL) { $env:STATO_REPO_URL } else { 'https://github.com/Hubertoink/stato_okja.git' }),
    [string]$Branch = $(if ($env:STATO_BRANCH) { $env:STATO_BRANCH } else { 'main' }),
    [string]$InstallDirectory = $env:STATO_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Write-Banner {
    Write-Host @'
   ____  _        _
  / ___|| |_ __ _| |_ ___
  \___ \| __/ _` | __/ _ \
   ___) | || (_| | || (_) |
  |____/ \__\__,_|\__\___/
'@ -ForegroundColor Magenta
    Write-Host '  OKJA Statistik & Dokumentation' -ForegroundColor Cyan
    Write-Host '  On-Prem Installer' -ForegroundColor DarkGray
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' wurde nicht gefunden. Bitte zuerst $InstallHint installieren."
    }
    Write-Host "  [OK] $Name gefunden" -ForegroundColor Green
}

function Test-DockerCompose {
    $previousErrorActionPreference = $ErrorActionPreference
    $composeExitCode = 1
    try {
        # Capture native stderr so the installer can show one actionable message instead of
        # PowerShell's raw NativeCommandError output.
        $ErrorActionPreference = 'Continue'
        $composeOutput = & docker compose version 2>&1
        $composeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($composeExitCode -ne 0) {
        if ($env:STATO_DIAGNOSTICS -eq 'true' -and $composeOutput) { $composeOutput | Out-Host }
        throw "Das Docker-Compose-Plugin fehlt. Installiere bzw. aktualisiere Docker Desktop, sodass 'docker compose' verfügbar ist."
    }
    Write-Host '  [OK] Docker Compose verfügbar' -ForegroundColor Green
}

function Test-DockerEngine {
    $previousErrorActionPreference = $ErrorActionPreference
    $dockerExitCode = 1
    try {
        # Windows PowerShell otherwise writes native Docker stderr before the script can
        # explain how to recover from an unavailable Docker Desktop engine.
        $ErrorActionPreference = 'Continue'
        $dockerOutput = & docker info 2>&1
        $dockerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($dockerExitCode -ne 0) {
        Write-Host "`nFEHLER: Docker Desktop ist nicht erreichbar." -ForegroundColor Red
        Write-Host 'StatO kann erst installiert werden, wenn die Docker-Engine läuft.' -ForegroundColor Yellow
        Write-Host "`nSo geht es weiter:"
        Write-Host '  1. Docker Desktop starten.'
        Write-Host '  2. Warten, bis „Engine running“ angezeigt wird.'
        Write-Host '  3. Falls nötig in Docker Desktop die WSL-2-basierte Engine aktivieren.'
        Write-Host '  4. In einer neuen PowerShell prüfen: docker info'
        Write-Host '  5. Anschließend diesen StatO-Installer erneut starten.'
        if ($env:STATO_DIAGNOSTICS -eq 'true' -and $dockerOutput) {
            Write-Host "`nTechnische Docker-Diagnose:" -ForegroundColor DarkYellow
            $dockerOutput | Out-Host
        }
        throw 'Installation abgebrochen: Docker ist nicht erreichbar.'
    }
    Write-Host '  [OK] Docker Engine erreichbar' -ForegroundColor Green
}

function Invoke-Native([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Befehl fehlgeschlagen: $Command $($Arguments -join ' ')"
    }
}

function Show-ComposeDiagnostics([string[]]$ComposeArguments) {
    Write-Host "`n==> Docker-Diagnose" -ForegroundColor Yellow

    $statusArguments = $ComposeArguments + @('ps', '--all')
    & docker @statusArguments 2>&1 | Out-Host

    $logServices = @('postgres', 'backend')
    if ($ComposeArguments -contains 'internal-tls') {
        $logServices += 'caddy'
    }
    $logArguments = $ComposeArguments + @('logs', '--no-color', '--tail', '120') + $logServices
    & docker @logArguments 2>&1 | Out-Host
}

function New-RandomHex([int]$ByteCount) {
    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
    $content = [System.IO.File]::ReadAllText($Path)
    $pattern = '(?m)^' + [regex]::Escape($Key) + '=.*$'
    if (-not [regex]::IsMatch($content, $pattern)) {
        throw "Variable '$Key' fehlt in $Path."
    }
    $content = [regex]::Replace($content, $pattern, "$Key=$Value")
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $content, $utf8WithoutBom)
}

function Get-EnvValue([string]$Path, [string]$Key) {
    $content = [System.IO.File]::ReadAllText($Path)
    $pattern = '(?m)^' + [regex]::Escape($Key) + '=(.*)$'
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        throw "Variable '$Key' fehlt in $Path."
    }
    return $match.Groups[1].Value.Trim()
}

function Ensure-EnvValue([string]$Path, [string]$Key, [string]$DefaultValue) {
    $content = [System.IO.File]::ReadAllText($Path)
    $pattern = '(?m)^' + [regex]::Escape($Key) + '='
    if ([regex]::IsMatch($content, $pattern)) {
        return
    }
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
        $content += "`n"
    }
    $content += "$Key=$DefaultValue`n"
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $content, $utf8WithoutBom)
}

function Assert-NoExistingOnPremDataForFreshConfig {
    # The on-prem Compose file deliberately uses a stable, named Docker volume so
    # data survives updates and a moved checkout. A new .env file must never be
    # paired silently with that existing database: its generated admin password
    # would not apply to the already-seeded superadmin.
    $volumeName = 'stato-onprem-postgres-data'
    # Do not use `docker volume inspect` here: on PowerShell versions that turn
    # native non-zero exits into terminating errors, its expected "not found"
    # result would abort a perfectly valid fresh installation.
    $volumeNames = & docker volume ls --format '{{.Name}}'
    if ($LASTEXITCODE -ne 0) {
        throw 'Die vorhandenen Docker-Volumes konnten nicht ermittelt werden.'
    }
    if ($volumeNames -contains $volumeName) {
        throw "Der persistente Docker-Volume '$volumeName' existiert bereits, aber .env.onprem fehlt. Der Installer bricht ab, damit kein neues, ungueltiges Startpasswort ausgegeben wird. Fuer die bestehende Installation die bisherige .env.onprem wiederherstellen; fuer eine bewusst neue Installation den vorhandenen Datenbestand erst explizit sichern und entfernen."
    }
}

Write-Banner
Write-Step 'Voraussetzungen prüfen'
Assert-Command git Git
Assert-Command docker Docker
Test-DockerCompose
Test-DockerEngine

if (-not $InstallDirectory) {
    if ((Test-Path (Join-Path $PWD '.git')) -and (Test-Path (Join-Path $PWD 'docker-compose.onprem.yml'))) {
        $InstallDirectory = $PWD.Path
    }
    else {
        $InstallDirectory = Join-Path $PWD 'stato_okja'
    }
}
$InstallDirectory = [System.IO.Path]::GetFullPath($InstallDirectory)

if (Test-Path (Join-Path $InstallDirectory '.git')) {
    Write-Step "Vorhandene StatO-Installation aus Branch '$Branch' aktualisieren"

    $status = & git -C $InstallDirectory status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0) { throw 'Git-Status konnte nicht gelesen werden.' }
    if ($status) {
        throw "Im Zielverzeichnis gibt es lokale Git-Aenderungen: $InstallDirectory. Bitte zuerst sichern/committen oder STATO_INSTALL_DIR anders setzen."
    }

    Invoke-Native git @('-C', $InstallDirectory, 'fetch', 'origin', $Branch)
    & git -C $InstallDirectory show-ref --verify --quiet "refs/heads/$Branch"
    $branchExists = $LASTEXITCODE -eq 0
    & git -C $InstallDirectory show-ref --verify --quiet "refs/tags/$Branch"
    $tagExists = $LASTEXITCODE -eq 0
    if ($tagExists) {
        Invoke-Native git @('-C', $InstallDirectory, 'checkout', '--detach', $Branch)
    }
    elseif ($branchExists) {
        Invoke-Native git @('-C', $InstallDirectory, 'checkout', $Branch)
        Invoke-Native git @('-C', $InstallDirectory, 'merge', '--ff-only', "origin/$Branch")
    }
    else {
        Invoke-Native git @('-C', $InstallDirectory, 'checkout', '--track', '-b', $Branch, "origin/$Branch")
    }
}
elseif ((Test-Path $InstallDirectory) -and (Get-ChildItem -Force $InstallDirectory | Select-Object -First 1)) {
    throw "Das Zielverzeichnis ist nicht leer und kein Git-Checkout: $InstallDirectory"
}
else {
    Write-Step "StatO aus Branch '$Branch' klonen"
    Invoke-Native git @('clone', '--branch', $Branch, '--single-branch', $RepositoryUrl, $InstallDirectory)
}

Set-Location $InstallDirectory
$envFile = Join-Path $InstallDirectory '.env.onprem'
$envCreated = $false

if (-not (Test-Path $envFile)) {
    Assert-NoExistingOnPremDataForFreshConfig
    Write-Step 'Lokale Konfiguration mit individuellen Secrets erzeugen'
    Copy-Item (Join-Path $InstallDirectory '.env.onprem.example') $envFile

    $databasePassword = "StatoDb_$(New-RandomHex 24)_A9!"
    $jwtSecret = New-RandomHex 48
    $adminPassword = "Stato_$(New-RandomHex 16)_A9!"

    Set-EnvValue $envFile 'POSTGRES_PASSWORD' $databasePassword
    Set-EnvValue $envFile 'JWT_SECRET' $jwtSecret
    Set-EnvValue $envFile 'SUPERADMIN_PASSWORD' $adminPassword
    $envCreated = $true
}
else {
    Write-Step 'Vorhandene .env.onprem beibehalten'
}

# Add TLS defaults to installations created before the optional Caddy mode.
Ensure-EnvValue $envFile 'HTTP_BIND_ADDRESS' '0.0.0.0'
Ensure-EnvValue $envFile 'STATO_TLS_MODE' 'off'
Ensure-EnvValue $envFile 'STATO_PUBLIC_HOST' ''
Ensure-EnvValue $envFile 'HTTPS_BIND_ADDRESS' '0.0.0.0'
Ensure-EnvValue $envFile 'HTTPS_PORT' '443'
Ensure-EnvValue $envFile 'STATO_IMAGE_TAG' ''

# An explicit environment value is useful for one-command installs; otherwise
# retain the version selected in .env.onprem for subsequent installer runs.
if ($env:STATO_IMAGE_TAG) { Set-EnvValue $envFile 'STATO_IMAGE_TAG' $env:STATO_IMAGE_TAG.Trim() }
$imageTag = if ($env:STATO_IMAGE_TAG) { $env:STATO_IMAGE_TAG.Trim() } else { Get-EnvValue $envFile 'STATO_IMAGE_TAG' }

# One-command opt-in for internal HTTPS, e.g.
# $env:STATO_INTERNAL_TLS_HOST='stato.intern.example.de'; irm ... | iex
if ($env:STATO_INTERNAL_TLS_HOST) {
    Set-EnvValue $envFile 'STATO_TLS_MODE' 'internal'
    Set-EnvValue $envFile 'STATO_PUBLIC_HOST' $env:STATO_INTERNAL_TLS_HOST.Trim()
}

$tlsMode = (Get-EnvValue $envFile 'STATO_TLS_MODE').ToLowerInvariant()
$tlsEnabled = $false
$publicUrl = $null

switch ($tlsMode) {
    'off' { }
    'internal' {
        $publicHost = Get-EnvValue $envFile 'STATO_PUBLIC_HOST'
        if ($publicHost -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$' -or
            $publicHost -notlike '*.*' -or $publicHost.Contains('..')) {
            throw 'STATO_PUBLIC_HOST muss ein DNS-Name ohne Protokoll, Pfad oder Port sein, z. B. stato.intern.example.de.'
        }

        $httpsPort = 0
        $httpsPortValue = Get-EnvValue $envFile 'HTTPS_PORT'
        if (-not [int]::TryParse($httpsPortValue, [ref]$httpsPort) -or $httpsPort -lt 1 -or $httpsPort -gt 65535) {
            throw 'HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein.'
        }

        $publicUrl = if ($httpsPort -eq 443) { "https://$publicHost" } else { "https://$publicHost`:$httpsPort" }
        Write-Step "Internes HTTPS mit Caddy fuer $publicUrl aktivieren"
        Set-EnvValue $envFile 'HTTP_BIND_ADDRESS' '127.0.0.1'
        Set-EnvValue $envFile 'APP_ORIGIN' $publicUrl
        Set-EnvValue $envFile 'CORS_ORIGINS' $publicUrl
        Set-EnvValue $envFile 'AUTH_REFRESH_COOKIE_SECURE' 'true'
        $tlsEnabled = $true
    }
    default {
        throw "STATO_TLS_MODE muss 'off' oder 'internal' sein (aktueller Wert: '$tlsMode')."
    }
}

$composeArguments = @('compose')
if ($tlsEnabled) {
    $composeArguments += @('--profile', 'internal-tls')
}
$composeArguments += @('-f', 'docker-compose.onprem.yml', '--env-file', '.env.onprem')

Write-Step 'Compose-Konfiguration pruefen'
Invoke-Native docker ($composeArguments + @('config', '--quiet'))

Write-Step 'PostgreSQL starten und Datenbankzugang synchronisieren'
$postgresArguments = $composeArguments + @('up', '-d', '--wait', '--wait-timeout', '120', 'postgres')
& docker @postgresArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'PostgreSQL konnte nicht gestartet werden.'
}

# POSTGRES_PASSWORD is only applied while PostgreSQL initializes an empty
# volume. Keep an existing database usable when .env.onprem changes later.
$syncSql = "SELECT format('ALTER ROLE %I PASSWORD %L', current_user, :'password') \gexec"
$syncArguments = $composeArguments + @(
    'exec', '-T', 'postgres', 'sh', '-c',
    'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set "password=$POSTGRES_PASSWORD"'
)
$syncSql | & docker @syncArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'Das PostgreSQL-Passwort aus .env.onprem konnte nicht synchronisiert werden.'
}

# The historical migrations extend an already existing application schema.
# Detect a truly empty database so the installer can create that base schema
# once before running the migrations in a second, production-safe phase.
$schemaCheckSql = "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 'missing' ELSE 'present' END;"
$schemaCheckArguments = $composeArguments + @(
    'exec', '-T', 'postgres', 'sh', '-c',
    'exec psql --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1'
)
$schemaState = ($schemaCheckSql | & docker @schemaCheckArguments | Where-Object { $_ -in @('missing', 'present') } | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0 -or $schemaState -notin @('missing', 'present')) {
    Show-ComposeDiagnostics $composeArguments
    throw 'Der Schema-Status der PostgreSQL-Datenbank konnte nicht ermittelt werden.'
}
$freshDatabase = $schemaState -eq 'missing'

if ($imageTag) {
    Write-Step "Veroeffentlichte StatO-Images $imageTag aus GHCR laden"
    $pullArguments = $composeArguments + @('pull', 'backend', 'frontend', 'backup')
    & docker @pullArguments
    if ($LASTEXITCODE -ne 0) {
        Show-ComposeDiagnostics $composeArguments
        throw 'Die veroeffentlichten StatO-Images konnten nicht geladen werden. Pruefe STATO_IMAGE_TAG und die Netzwerkverbindung.'
    }
}
else {
    Write-Step 'StatO-Images bauen'
    $buildArguments = $composeArguments + @('build')
    & docker @buildArguments
    if ($LASTEXITCODE -ne 0) {
        Show-ComposeDiagnostics $composeArguments
        throw 'Die StatO-Images konnten nicht gebaut werden. Die Diagnose steht oberhalb dieser Meldung.'
    }
}

# Volumes created by older images can still belong to root. Repair ownership
# before the unprivileged backend starts; existing uploaded files stay intact.
Write-Step 'Berechtigungen des persistenten Upload-Verzeichnisses pruefen'
$uploadsArguments = $composeArguments + @(
    # The production service drops all Linux capabilities. The short-lived
    # repair container therefore needs the three narrowly scoped capabilities
    # required to create and chown files in a volume created by an older image.
    'run', '--rm', '--no-deps', '--user', '0', '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', '--cap-add', 'FOWNER',
    '--entrypoint', 'sh', 'backend', '-c',
    'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads'
)
& docker @uploadsArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'Die Berechtigungen des Upload-Verzeichnisses konnten nicht repariert werden.'
}

if ($freshDatabase) {
    Write-Step 'Leere Datenbank: Basisschema einmalig erzeugen'
    # TypeORM runs migrations before synchronize(). The first phase therefore
    # creates the current entity schema without migrations; the second phase
    # records and applies the regular migrations with synchronize disabled.
    $previousSynchronize = [Environment]::GetEnvironmentVariable('DB_SYNCHRONIZE', 'Process')
    $previousMigrationsRun = [Environment]::GetEnvironmentVariable('DB_MIGRATIONS_RUN', 'Process')
    try {
        $env:DB_SYNCHRONIZE = 'true'
        $env:DB_MIGRATIONS_RUN = 'false'
        $bootstrapArguments = $composeArguments + @('up', '-d', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend')
        & docker @bootstrapArguments
        if ($LASTEXITCODE -ne 0) {
            Show-ComposeDiagnostics $composeArguments
            throw 'Das Basisschema der leeren PostgreSQL-Datenbank konnte nicht erzeugt werden.'
        }
    }
    finally {
        if ($null -eq $previousSynchronize) { Remove-Item Env:DB_SYNCHRONIZE -ErrorAction SilentlyContinue } else { $env:DB_SYNCHRONIZE = $previousSynchronize }
        if ($null -eq $previousMigrationsRun) { Remove-Item Env:DB_MIGRATIONS_RUN -ErrorAction SilentlyContinue } else { $env:DB_MIGRATIONS_RUN = $previousMigrationsRun }
    }

    Write-Step 'Datenbankmigrationen auf dem Basisschema abschliessen'
    $migrationArguments = $composeArguments + @('up', '-d', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend')
    & docker @migrationArguments
    if ($LASTEXITCODE -ne 0) {
        Show-ComposeDiagnostics $composeArguments
        throw 'Die Datenbankmigrationen auf dem neuen Basisschema konnten nicht abgeschlossen werden.'
    }
}

Write-Step 'StatO starten'
$upArguments = $composeArguments + @('up', '-d')
if ($imageTag) { $upArguments += '--no-build' }
& docker @upArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'StatO konnte nicht vollstaendig gestartet werden. Die Diagnose steht oberhalb dieser Meldung.'
}

Write-Step 'StatO wurde gestartet'
Invoke-Native docker ($composeArguments + @('ps'))

Write-Host "`nInstallation: $InstallDirectory"
Write-Host "Konfiguration: $envFile"
if ($tlsEnabled) {
    Write-Host "Aufruf:        $publicUrl"
    Write-Host 'Caddy-CA:      .\scripts\export-onprem-caddy-root.ps1'
}
else {
    Write-Host 'Aufruf:        http://localhost (bzw. http://<server-ip>)'
}
Write-Host 'Superadmin:    admin@stato.local'
if ($envCreated) {
    Write-Host "Startpasswort: $adminPassword" -ForegroundColor Yellow
    Write-Host "`nBitte das Startpasswort sicher notieren und nach dem ersten Login aendern." -ForegroundColor Yellow
}
Write-Host "`nNach Aenderungen an .env.onprem den Installer erneut ausfuehren mit:"
Write-Host "  cd `"$InstallDirectory`"; .\scripts\install-onprem.ps1"
