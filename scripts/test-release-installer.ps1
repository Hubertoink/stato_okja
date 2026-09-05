# Execute the real PowerShell installer against deterministic download/Docker doubles.
# Docker is shadowed in this script scope: no real containers or network are used.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('stato-installer-test-' + [guid]::NewGuid().ToString('N'))
$bundle = Join-Path $testRoot 'bundle'
New-Item -ItemType Directory -Force -Path (Join-Path $bundle 'config/legal') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'deploy/onprem/compose.yaml') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $root 'deploy/onprem/stato.env.example') -Destination (Join-Path $bundle 'config/stato.env.example')
Copy-Item -LiteralPath (Join-Path $root 'deploy/onprem/config/Caddyfile') -Destination (Join-Path $bundle 'config/Caddyfile')
Copy-Item -LiteralPath (Join-Path $root 'legal/manifest.json') -Destination (Join-Path $bundle 'config/legal/manifest.json')
$archive = Join-Path $testRoot 'StatO-v9.9.9.zip'
Compress-Archive -Path (Join-Path $bundle '*') -DestinationPath $archive
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
$checksums = Join-Path $testRoot 'SHA256SUMS'
[IO.File]::WriteAllText($checksums, "$hash  StatO-v9.9.9.zip`n")
function Invoke-WebRequest {
    param($Uri, $OutFile, [switch]$UseBasicParsing)
    if ($Uri.EndsWith('/SHA256SUMS')) { Copy-Item -LiteralPath $checksums -Destination $OutFile }
    elseif ($Uri.EndsWith('/StatO-v9.9.9.zip')) { Copy-Item -LiteralPath $archive -Destination $OutFile }
    else { throw "Unexpected download: $Uri" }
}
function docker {
    $global:LASTEXITCODE = 0
    $command = $args -join ' '
    $global:statoInstallerTestCommands.Add($command)
    if ($command -eq 'compose version' -or $command -eq 'info') { return 'test-double' }
    if ($command -match ' ps -q backup$') { return 'test-backup-container' }
    if ($command -match ' ps -q postgres$') { return 'test-postgres-container' }
    if ($command -match 'exec -T backup /usr/local/bin/stato-container-backup') {
        $global:statoInstallerTestBackupUsedOldConfig = (Get-Content -LiteralPath (Join-Path $instance 'config/stato.env') -Raw).Contains('STATO_IMAGE_TAG=8.8.8')
        if ($scenario -eq 'backup-failure') { $global:LASTEXITCODE = 1 }
        return
    }
    if ($command -match 'ls -td /backups') { return '/backups/stato-container-fixture' }
    if ($command -match '^cp ') { return }
    if ($command -match 'psql --tuples-only') { return 'present' }
    if ($command -match 'wget.*api/health' -and $scenario -eq 'health-failure') { $global:LASTEXITCODE = 1; return }
    if ($command -match '^compose .* (up|exec|run|pull|config|ps)( |$)') { return }
    throw "Unexpected Docker command: $command"
}
foreach ($scenario in @('success', 'backup-failure', 'health-failure')) {
    $instance = Join-Path $testRoot $scenario
    New-Item -ItemType Directory -Path (Join-Path $instance 'config') -Force | Out-Null
    $oldEnv = (Get-Content -LiteralPath (Join-Path $root 'deploy/onprem/stato.env.example') -Raw).
        Replace('STATO_IMAGE_TAG=', 'STATO_IMAGE_TAG=8.8.8').
        Replace('STATO_FRONTEND_IMAGE_TAG=', 'STATO_FRONTEND_IMAGE_TAG=onprem-8.8.8').
        Replace('GENERATED_BY_INSTALLER', ('a' * 64))
    [IO.File]::WriteAllText((Join-Path $instance 'config/stato.env'), $oldEnv)
    [IO.File]::WriteAllText((Join-Path $instance '.stato-onprem-runtime'), "v8.8.8`n")
    [IO.File]::WriteAllText((Join-Path $instance 'VERSION'), "8.8.8`n")
    [IO.File]::WriteAllText((Join-Path $instance 'compose.yaml'), '# old runtime')
    $global:statoInstallerTestCommands = [Collections.Generic.List[string]]::new()
    $global:statoInstallerTestBackupUsedOldConfig = $false
    $failed = $false
    try { & (Join-Path $root 'scripts/install-onprem-release.ps1') -InstallDirectory $instance -ReleaseTag v9.9.9 | Out-Null }
    catch { $failed = $true; if ($scenario -eq 'success') { throw } }
    if (-not $global:statoInstallerTestBackupUsedOldConfig) { throw "$scenario`: backup used new config" }
    $version = (Get-Content -LiteralPath (Join-Path $instance 'VERSION') -Raw).Trim()
    if ($scenario -eq 'success') {
        if ($failed -or $version -ne '9.9.9') { throw 'Success did not record the target version.' }
    } else {
        if (-not $failed -or $version -ne '8.8.8') { throw "$scenario`: failure was recorded as success" }
    }
    if ($scenario -eq 'backup-failure') {
        if ((Get-Content -LiteralPath (Join-Path $instance 'config/stato.env') -Raw) -ne $oldEnv) { throw 'Failed backup changed configuration.' }
        if ((Get-Content -LiteralPath (Join-Path $instance 'compose.yaml') -Raw) -ne '# old runtime') { throw 'Failed backup replaced runtime.' }
    }
    Write-Host "PASS: $scenario"
}
Write-Host "Installer test fixtures retained at $testRoot"
