[CmdletBinding()]
param(
    [string]$InstallDirectory = (Split-Path -Parent $PSScriptRoot),
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Get-EnvValue([string]$Path, [string]$Key) {
    $content = [System.IO.File]::ReadAllText($Path)
    $pattern = '(?m)^' + [regex]::Escape($Key) + '=(.*)$'
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        throw "Variable '$Key' fehlt in $Path."
    }
    return $match.Groups[1].Value.Trim()
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "'docker' wurde nicht gefunden. Bitte zuerst Docker installieren."
}

$InstallDirectory = [System.IO.Path]::GetFullPath($InstallDirectory)
$envFile = Join-Path $InstallDirectory '.env.onprem'
if (-not (Test-Path $envFile)) {
    throw "Konfiguration nicht gefunden: $envFile"
}
if ((Get-EnvValue $envFile 'STATO_TLS_MODE').ToLowerInvariant() -ne 'internal') {
    throw "STATO_TLS_MODE=internal ist nicht aktiviert. Caddy stellt kein internes Stammzertifikat bereit."
}

if (-not $Destination) {
    $Destination = Join-Path $InstallDirectory 'stato-onprem-caddy-root.crt'
}
$Destination = [System.IO.Path]::GetFullPath($Destination)

Push-Location $InstallDirectory
try {
    $composeArguments = @('compose', '--profile', 'internal-tls', '-f', 'docker-compose.onprem.yml', '--env-file', '.env.onprem')
    $containerId = (& docker @($composeArguments + @('ps', '-q', 'caddy')) | Select-Object -First 1).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
        throw 'Der Caddy-Container läuft nicht. Bitte zuerst den On-Prem-Installer mit STATO_TLS_MODE=internal ausführen.'
    }

    & docker cp "${containerId}:/data/caddy/pki/authorities/local/root.crt" $Destination
    if ($LASTEXITCODE -ne 0) {
        throw 'Das Caddy-Stammzertifikat konnte nicht exportiert werden.'
    }
}
finally {
    Pop-Location
}

Write-Host "Caddy-Stammzertifikat exportiert: $Destination"
Write-Host "Import fuer den aktuellen Windows-Benutzer:"
Write-Host "  Import-Certificate -FilePath `"$Destination`" -CertStoreLocation Cert:\CurrentUser\Root"
