[CmdletBinding()]
param(
    [string]$InstallDirectory = $(if ($env:STATO_MITTWALD_INSTALL_DIR) { $env:STATO_MITTWALD_INSTALL_DIR } else { Join-Path $HOME 'stato-mittwald' }),
    [string]$StackId = $env:STATO_MITTWALD_STACK_ID,
    [string]$AppOrigin = $env:STATO_APP_ORIGIN,
    [string]$AdminEmail = $env:STATO_SUPERADMIN_EMAIL,
    [string]$ImageTag = $env:STATO_IMAGE_TAG,
    [string]$TemplateDirectory,
    [string]$SourceBaseUrl = $(if ($env:STATO_MITTWALD_SOURCE_BASE_URL) { $env:STATO_MITTWALD_SOURCE_BASE_URL } else { 'https://raw.githubusercontent.com/Hubertoink/stato_okja/main/deploy/mittwald' }),
    [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Resolve-MwCommand() {
    $command = Get-Command 'mw' -ErrorAction SilentlyContinue
    if ($command) {
        Write-Host "  [OK] Mittwald CLI gefunden: $($command.Source)" -ForegroundColor Green
        return $command.Source
    }

    $candidates = @(
        (Join-Path $env:ProgramFiles 'mw\bin\mw.cmd'),
        (Join-Path ${env:ProgramFiles(x86)} 'mw\bin\mw.cmd')
    ) | Where-Object { $_ -and (Test-Path $_) }

    $candidates = @($candidates)
    if ($candidates.Count -gt 0) {
        Write-Host "  [OK] Mittwald CLI gefunden: $($candidates[0])" -ForegroundColor Green
        return $candidates[0]
    }

    throw "Die Mittwald CLI wurde nicht gefunden. Installiere sie und melde dich danach mit 'mw login token' an."
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
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
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

function Copy-Template([string]$Name, [string]$TargetPath, [bool]$Overwrite) {
    if ((Test-Path $TargetPath) -and -not $Overwrite) {
        return
    }

    if ($TemplateDirectory) {
        $sourcePath = Join-Path $TemplateDirectory $Name
        if (-not (Test-Path $sourcePath)) {
            throw "Template fehlt: $sourcePath"
        }
        Copy-Item -LiteralPath $sourcePath -Destination $TargetPath -Force
        return
    }

    Invoke-WebRequest -UseBasicParsing -Uri "$SourceBaseUrl/$Name" -OutFile $TargetPath
}

function Assert-HttpsOrigin([string]$Value, [string]$Name) {
    if ($Value -notmatch '^https://[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::[0-9]{1,5})?$') {
        throw "$Name muss eine HTTPS-Origin ohne Pfad sein, z. B. https://app.example.org."
    }
}

function Get-RequiredValue([string]$Value, [string]$Prompt, [string]$ValidationPattern) {
    $result = $Value
    while (-not $result) {
        $result = ([string](Read-Host $Prompt)).Trim()
    }
    if ($ValidationPattern -and $result -notmatch $ValidationPattern) {
        throw "Ungueltiger Wert fuer $Prompt."
    }
    return $result
}

Write-Host 'StatO Mittwald Stack Installer' -ForegroundColor Magenta
Write-Host 'Erstellt bzw. aktualisiert einen gesamten mStudio-Stack.' -ForegroundColor DarkGray

if (-not $TemplateDirectory -and $PSScriptRoot) {
    $candidate = Join-Path (Split-Path -Parent $PSScriptRoot) 'deploy/mittwald'
    if (Test-Path (Join-Path $candidate 'docker-compose.yml')) {
        $TemplateDirectory = $candidate
    }
}

$InstallDirectory = [System.IO.Path]::GetFullPath($InstallDirectory)
$deployDirectory = Join-Path $InstallDirectory 'deploy'
$composeFile = Join-Path $deployDirectory 'docker-compose.yml'
$envFile = Join-Path $deployDirectory '.env'
New-Item -ItemType Directory -Force -Path $deployDirectory | Out-Null

Write-Step 'Stack-Vorlagen bereitstellen'
Copy-Template 'docker-compose.yml' $composeFile $true
if (-not (Test-Path $envFile)) {
    Copy-Template '.env.example' $envFile $false
    Write-Host "  [OK] Neue Konfiguration erstellt: $envFile" -ForegroundColor Green
}
else {
    Write-Host "  [OK] Bestehende Konfiguration bleibt erhalten: $envFile" -ForegroundColor Green
}

if (-not $ImageTag) {
    $ImageTag = Get-EnvValue $envFile 'STATO_IMAGE_TAG'
}
if (-not $ImageTag) {
    $ImageTag = 'latest'
}
Set-EnvValue $envFile 'STATO_IMAGE_TAG' $ImageTag.Trim()
Set-EnvValue $envFile 'STATO_FRONTEND_IMAGE_TAG' "stack-$($ImageTag.Trim())"

if ((Get-EnvValue $envFile 'POSTGRES_PASSWORD') -like 'replace-with-*') {
    $databasePassword = "StatoDb_$(New-RandomHex 24)_A9!"
    Set-EnvValue $envFile 'POSTGRES_PASSWORD' $databasePassword
}
if ((Get-EnvValue $envFile 'JWT_SECRET') -like 'replace-with-*') {
    Set-EnvValue $envFile 'JWT_SECRET' (New-RandomHex 48)
}

$configuredAppOrigin = if ($AppOrigin) { $AppOrigin.Trim() } else { Get-EnvValue $envFile 'APP_ORIGIN' }
if ($configuredAppOrigin -eq 'https://app.example.org') {
    $configuredAppOrigin = Get-RequiredValue '' 'Frontend-URL (z. B. https://app.example.org)' ''
}
Assert-HttpsOrigin $configuredAppOrigin 'APP_ORIGIN'
Set-EnvValue $envFile 'APP_ORIGIN' $configuredAppOrigin
Set-EnvValue $envFile 'CORS_ORIGINS' $configuredAppOrigin

$configuredAdminEmail = if ($AdminEmail) { $AdminEmail.Trim() } else { Get-EnvValue $envFile 'SUPERADMIN_EMAIL' }
if ($configuredAdminEmail -eq 'admin@example.org') {
    $configuredAdminEmail = Get-RequiredValue '' 'E-Mail des ersten Superadmins' '^[^@\s]+@[^@\s]+\.[^@\s]+$'
}
if ($configuredAdminEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw 'SUPERADMIN_EMAIL muss eine gueltige E-Mail-Adresse sein.'
}
Set-EnvValue $envFile 'SUPERADMIN_EMAIL' $configuredAdminEmail

Write-Step 'Konfiguration pruefen'
$requiredKeys = @('STATO_IMAGE_TAG', 'STATO_FRONTEND_IMAGE_TAG', 'APP_ORIGIN', 'CORS_ORIGINS', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET', 'SUPERADMIN_EMAIL')
foreach ($key in $requiredKeys) {
    if (-not (Get-EnvValue $envFile $key)) {
        throw "Variable '$key' darf nicht leer sein."
    }
}
if ((Get-EnvValue $envFile 'JWT_SECRET').Length -lt 32) {
    throw 'JWT_SECRET muss mindestens 32 Zeichen lang sein.'
}

if ($PrepareOnly) {
    Write-Host "  [OK] Stack und Konfiguration vorbereitet: $InstallDirectory" -ForegroundColor Green
    Write-Host '  Kein Mittwald-API-Aufruf wurde ausgefuehrt.' -ForegroundColor Yellow
    Write-Host "`nFrontend-Domain -> Service frontend, Port 8080"
    exit 0
}

$StackId = Get-RequiredValue $StackId 'Mittwald Stack-ID (mw stack ls zeigt sie an)' '^[A-Za-z0-9-]+$'

Write-Step 'Mittwald-Zugang pruefen'
$mwCommand = Resolve-MwCommand
Invoke-Native $mwCommand @('login', 'status')

Write-Step "Stack $StackId bereitstellen"
Invoke-Native $mwCommand @('stack', 'up', '--stack-id', $StackId, '--compose-file', $composeFile, '--env-file', $envFile)

Write-Host "`nStatO wurde im Mittwald-Stack bereitgestellt." -ForegroundColor Green
Write-Host "Konfiguration: $envFile"
Write-Host "Frontend-Domain -> Service frontend, Port 8080"
Write-Host 'Lege im mStudio danach einen Container-Cronjob fuer backup mit /usr/local/bin/stato-container-backup an.'
