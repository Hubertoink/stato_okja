[CmdletBinding()]
param(
    [string]$RepositoryUrl = $(if ($env:STATO_REPO_URL) { $env:STATO_REPO_URL } else { 'https://github.com/Hubertoink/stato_okja.git' }),
    [string]$Branch = $(if ($env:STATO_BRANCH) { $env:STATO_BRANCH } else { 'main' }),
    [string]$InstallDirectory = $env:STATO_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' wurde nicht gefunden. Bitte zuerst $InstallHint installieren."
    }
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

    $logArguments = $ComposeArguments + @('logs', '--no-color', '--tail', '120', 'postgres', 'backend')
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

Assert-Command git Git
Assert-Command docker Docker

Invoke-Native docker @('compose', 'version')
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker ist nicht erreichbar. Bitte Docker Desktop bzw. den Docker-Dienst starten.'
}

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
    if ($branchExists) {
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

$composeArguments = @('compose', '-f', 'docker-compose.onprem.yml', '--env-file', '.env.onprem')

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

Write-Step 'StatO-Images bauen'
$buildArguments = $composeArguments + @('build')
& docker @buildArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'Die StatO-Images konnten nicht gebaut werden. Die Diagnose steht oberhalb dieser Meldung.'
}

# Volumes created by older images can still belong to root. Repair ownership
# before the unprivileged backend starts; existing uploaded files stay intact.
Write-Step 'Berechtigungen des persistenten Upload-Verzeichnisses pruefen'
$uploadsArguments = $composeArguments + @(
    'run', '--rm', '--no-deps', '--user', '0', '--cap-add', 'CHOWN',
    '--entrypoint', 'sh', 'backend', '-c',
    'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads'
)
& docker @uploadsArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'Die Berechtigungen des Upload-Verzeichnisses konnten nicht repariert werden.'
}

Write-Step 'StatO starten'
$upArguments = $composeArguments + @('up', '-d')
& docker @upArguments
if ($LASTEXITCODE -ne 0) {
    Show-ComposeDiagnostics $composeArguments
    throw 'StatO konnte nicht vollstaendig gestartet werden. Die Diagnose steht oberhalb dieser Meldung.'
}

Write-Step 'StatO wurde gestartet'
Invoke-Native docker ($composeArguments + @('ps'))

Write-Host "`nInstallation: $InstallDirectory"
Write-Host "Konfiguration: $envFile"
Write-Host 'Aufruf:        http://localhost (bzw. http://<server-ip>)'
Write-Host 'Superadmin:    admin@stato.local'
if ($envCreated) {
    Write-Host "Startpasswort: $adminPassword" -ForegroundColor Yellow
    Write-Host "`nBitte das Startpasswort sicher notieren und nach dem ersten Login aendern." -ForegroundColor Yellow
}
Write-Host "`nNach Aenderungen an .env.onprem den Installer erneut ausfuehren mit:"
Write-Host "  cd `"$InstallDirectory`"; .\scripts\install-onprem.ps1"
