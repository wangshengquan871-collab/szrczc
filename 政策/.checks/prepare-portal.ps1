$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourceDirectory = Join-Path $workspace '全市政策'
$portalDirectory = Join-Path $sourceDirectory '苏州人才政策'
$names = @('姑苏领军','东吴','姑苏区','常熟','昆山','金鸡湖','高新区','吴江','相城','政策对比')
$directories = @($names | ForEach-Object { $_ + '资源' }) + @('公共资源')
$files = New-Object System.Collections.Generic.List[object]
foreach ($name in $names) {
    $files.Add(@{ source = '全市政策/' + $name + '.html'; target = 'pages/' + $name + '.html'; kind = 'policy-html' })
}
foreach ($directory in $directories) {
    $base = Join-Path $sourceDirectory $directory
    foreach ($file in Get-ChildItem -LiteralPath $base -File -Recurse) {
        $relative = $file.FullName.Substring($sourceDirectory.Length + 1).Replace('\','/')
        $files.Add(@{ source = '全市政策/' + $relative; target = 'pages/' + $relative; kind = 'original-resource' })
    }
}
foreach ($file in Get-ChildItem -LiteralPath $workspace -File | Where-Object { $_.Extension -in @('.docx','.xlsx') }) {
    $files.Add(@{ source = $file.Name; target = $file.Name; kind = 'source-document' })
}
foreach ($file in $files) {
    $original = Join-Path $workspace $file.source
    $file.bytes = (Get-Item -LiteralPath $original).Length
    $file.sha256 = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    if ($file.kind -eq 'policy-html') {
        $text = [IO.File]::ReadAllText($original)
        $file.title = [regex]::Match($text,'<title>(.*?)</title>', 'Singleline').Groups[1].Value
    }
}
$manifest = [ordered]@{
    schemaVersion = 1
    createdAt = [DateTimeOffset]::Now.ToString('o')
    sourceRoot = '../..'
    description = '复制前SHA256清单。政策HTML仅增加szp前缀的全站导航；原政策资源及源文档保持字节一致。'
    files = $files.ToArray()
}
$null = New-Item -ItemType Directory -Path $portalDirectory -Force
$encoding = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $portalDirectory 'source-manifest.json'), ($manifest | ConvertTo-Json -Depth 10), $encoding)
foreach ($file in $files) {
    $destination = Join-Path $portalDirectory $file.target
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force
    Copy-Item -LiteralPath (Join-Path $workspace $file.source) -Destination $destination
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $file.sha256) {
        throw ('Copy hash mismatch: ' + $file.target)
    }
}
Write-Output ('Verified ' + $files.Count + ' copied files; original files were read only.')
Write-Output ($files | Group-Object kind | Select-Object Name,Count | ConvertTo-Json -Compress)
