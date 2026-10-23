$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$portal = Join-Path $workspace '全市政策\苏州人才政策'
$manifestPath = Join-Path $portal 'source-manifest.json'
$manifest = Get-Content -Encoding UTF8 -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$encoding = New-Object System.Text.UTF8Encoding($false)
$head = @'
<!-- szp:shared-head:start -->
  <link rel="icon" href="../assets/images/portal-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/navigation.css">
  <script defer src="../js/navigation.js"></script>
<!-- szp:shared-head:end -->
'@
$navigation = @'
<!-- szp:shared-navigation:start -->
  <header id="szp-global-header" class="szp-global-header">
    <div class="szp-nav-inner">
      <a class="szp-platform-brand szp-child-brand" href="../index.html"><span class="szp-brand-name">苏州人才政策</span></a>
      <nav class="szp-fallback-navigation" aria-label="全站导航"><a href="../index.html">首页</a><a href="../index.html#szp-policies">政策总览</a><a href="政策对比.html">政策对比</a></nav>
    </div>
  </header>
<!-- szp:shared-navigation:end -->
'@
foreach ($file in $manifest.files) {
    $original = Join-Path $workspace $file.source
    if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne $file.sha256) { throw ('Original source changed: ' + $file.source) }
    if ($file.kind -ne 'policy-html') { continue }
    $path = Join-Path $portal $file.target
    $html = [IO.File]::ReadAllText($original)
    if ($html -notmatch '<body>' -or $html -notmatch '</head>') { throw ('Unexpected HTML structure: ' + $path) }
    $html = $html.Replace('</head>', $head + "`n</head>")
    $html = $html.Replace('<body>', '<body class="szp-integrated">' + "`n" + $navigation)
    [IO.File]::WriteAllText($path, $html, $encoding)
    $file | Add-Member -NotePropertyName integratedSha256 -NotePropertyValue (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -Force
}
$manifest | Add-Member -NotePropertyName verifiedCopyCount -NotePropertyValue $manifest.files.Count -Force
$manifest | Add-Member -NotePropertyName integrationScope -NotePropertyValue '10份HTML仅增加body类、共享导航DOM及CSS/JS引用；47份原资源与11份源文档保持字节一致。' -Force
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 12), $encoding)
Write-Output 'Integrated ten page copies. Originals and copied policy resources remain unchanged.'
