#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$Directory = (Join-Path $env:USERPROFILE 'stato-dev-test'),
    [ValidateRange(1024, 65535)][int]$Port = 8091,
    [switch]$Build,
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$Directory = [IO.Path]::GetFullPath($Directory)
$marker = Join-Path $Directory '.stato-dev-test'
if ((Test-Path -LiteralPath $Directory) -and -not (Test-Path -LiteralPath $marker)) {
    throw "Das Ziel existiert bereits und ist keine verwaltete Testinstanz: $Directory"
}
function Invoke-Docker([string[]]$Arguments) {
    $output = & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Docker-Befehl fehlgeschlagen; siehe vorherige Ausgabe.' }
    return $output
}
function Random-Hex([int]$Count) { return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes($Count)).ToLowerInvariant() }
New-Item -ItemType Directory -Force -Path (Join-Path $Directory 'config'), (Join-Path $Directory 'backup-export') | Out-Null
if (-not (Test-Path -LiteralPath $marker)) { [IO.File]::WriteAllText($marker, [guid]::NewGuid().ToString('N')) }
$project = 'stato-dev-test-' + (Get-Content -LiteralPath $marker -Raw).Trim()
if ($project -notmatch '^stato-dev-test-[a-f0-9]{32}$') { throw 'Ungültige Testinstanz-Kennung.' }
$envFile = Join-Path $Directory 'config/stato.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    $config = [IO.File]::ReadAllText((Join-Path $root 'deploy/onprem/stato.env.example'))
    $config = $config -replace '(?m)^POSTGRES_PASSWORD=.*$', ('POSTGRES_PASSWORD=' + (Random-Hex 24))
    $config = $config -replace '(?m)^JWT_SECRET=.*$', ('JWT_SECRET=' + (Random-Hex 48))
    $config = $config -replace '(?m)^INITIAL_SETUP_TOKEN=.*$', ('INITIAL_SETUP_TOKEN=' + (Random-Hex 32))
    $config = $config -replace '(?m)^STATO_IMAGE_TAG=.*$', 'STATO_IMAGE_TAG=dev'
    $config = $config -replace '(?m)^STATO_FRONTEND_IMAGE_TAG=.*$', 'STATO_FRONTEND_IMAGE_TAG=onprem-dev'
    $config = $config -replace '(?m)^HTTP_BIND_ADDRESS=.*$', 'HTTP_BIND_ADDRESS=127.0.0.1'
    $config = $config -replace '(?m)^HTTP_PORT=.*$', "HTTP_PORT=$Port"
    $config = $config -replace '(?m)^(APP_ORIGIN|CORS_ORIGINS)=.*$', "`$1=http://localhost:$Port"
    [IO.File]::WriteAllText($envFile, $config)
}
if (-not (Test-Path -LiteralPath (Join-Path $Directory 'config/legal'))) {
    Copy-Item -LiteralPath (Join-Path $root 'legal') -Destination (Join-Path $Directory 'config/legal') -Recurse
}
foreach ($file in @('onprem-runtime.ps1', 'onprem-runtime.sh')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $Directory $file) -Force
}
$runtime = (Invoke-Docker @('compose', '--env-file', $envFile, '-f', (Join-Path $root 'deploy/onprem/compose.yaml'), 'config', '--format', 'json') | Out-String) | ConvertFrom-Json -AsHashtable
$runtime.name = $project
$runtime.services.Remove('caddy')
foreach ($key in $runtime.volumes.Keys) { $runtime.volumes[$key].name = "$project-$key" }
foreach ($key in $runtime.networks.Keys) { $runtime.networks[$key].name = "$project-$key" }
foreach ($service in $runtime.services.Values) {
    foreach ($volume in $service.volumes) {
        if ($volume.type -ne 'bind') { continue }
        $volume.source = switch ($volume.target) {
            '/app/legal' { Join-Path $Directory 'config/legal' }
            '/mnt/config' { Join-Path $Directory 'config' }
            '/mnt/backup-copy' { Join-Path $Directory 'backup-export' }
            default { throw "Unbekannter Mount: $($volume.target)" }
        }
    }
}
if ($Build) {
    foreach ($service in @('backend', 'frontend', 'backup')) {
        $runtime.services[$service].image = "${project}-${service}:local"
        $runtime.services[$service].build = @{ context = $root; dockerfile = "$service/Dockerfile" }
    }
    $runtime.services.frontend.build.args = @{ NGINX_MODE = 'proxy'; VITE_API_BASE_URL = '/api' }
    $runtime.services.backup.environment.STATO_BACKUP_VERSION = 'dev-local'
}
$composeFile = Join-Path $Directory 'compose.yaml'
[IO.File]::WriteAllText($composeFile, ($runtime | ConvertTo-Json -Depth 100))
$compose = @('compose', '--env-file', $envFile, '-f', $composeFile)
Invoke-Docker ($compose + @('config', '--quiet'))
Write-Host "Testinstallation: $Directory"
if ($PrepareOnly) { Write-Host 'Konfiguration geprüft; keine Container gestartet.'; return }
if ($Build) { Invoke-Docker ($compose + @('build')) }
else { Invoke-Docker ($compose + @('pull')) }
Invoke-Docker ($compose + @('up', '-d', '--wait', '--wait-timeout', '180'))
Invoke-Docker ($compose + @('exec', '-T', 'frontend', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/api/health'))
$origin = ((Select-String -LiteralPath $envFile -Pattern '^APP_ORIGIN=').Line -split '=', 2)[1]
Write-Host "StatO: $origin"
Write-Host "Einstiegsseite: $origin/start/"
Write-Host "Einrichtungscode: INITIAL_SETUP_TOKEN in $envFile (zum Öffnen: notepad `"$envFile`")"
