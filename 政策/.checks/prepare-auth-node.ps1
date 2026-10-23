$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$version = 'v24.21.0'
$archiveName = 'node-' + $version + '-win-x64.zip'
$toolsDirectory = Join-Path $workspace '.tools'
$runtimeDirectory = Join-Path $toolsDirectory ('node-' + $version + '-win-x64')
if (Test-Path -LiteralPath (Join-Path $runtimeDirectory 'node.exe')) {
    Write-Output $runtimeDirectory
    exit
}
$null = New-Item -ItemType Directory -Path $toolsDirectory -Force
$archivePath = Join-Path $toolsDirectory $archiveName
$checksumPath = Join-Path $toolsDirectory 'node-SHASUMS256.txt'
Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/' + $version + '/SHASUMS256.txt') -OutFile $checksumPath -TimeoutSec 60
Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/' + $version + '/' + $archiveName) -OutFile $archivePath -TimeoutSec 120
$line = Get-Content -LiteralPath $checksumPath | Where-Object { $_.EndsWith('  ' + $archiveName) }
if (-not $line) { throw 'Official checksum not found.' }
$expected = $line.Split(' ')[0].ToUpperInvariant()
$actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw 'Node.js archive checksum mismatch.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsDirectory -Force
& (Join-Path $runtimeDirectory 'node.exe') --version
Write-Output ('Verified portable runtime: ' + $runtimeDirectory)
