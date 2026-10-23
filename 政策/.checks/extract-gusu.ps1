param([string]$Workspace = 'C:\Users\11811\Desktop\网页\政策')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $Workspace '姑苏区领军人才政策.docx'))
function Read-ArchiveXml([string]$Name) {
    $entry = $archive.GetEntry($Name)
    if (-not $entry) { return $null }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
    $xml = Read-ArchiveXml 'word/document.xml'
    $rels = Read-ArchiveXml 'word/_rels/document.xml.rels'
    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $targets = @{}
    foreach ($rel in $rels.Relationships.Relationship) {
        if ($rel.Type -match '/hyperlink$') { $targets[$rel.Id] = $rel.Target }
    }
    function Get-Links($Node) {
        foreach ($link in $Node.SelectNodes('.//w:hyperlink', $ns)) {
            $id = $link.GetAttribute('id', $ns.LookupNamespace('r'))
            if ($targets.ContainsKey($id)) {
                [ordered]@{ text = (($link.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''); url = $targets[$id] }
            }
        }
    }
    $blocks = @()
    foreach ($node in $xml.SelectSingleNode('//w:body', $ns).ChildNodes) {
        if ($node.LocalName -eq 'p') {
            $content = ($node.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
            if ($content.Trim()) {
                $blocks += [ordered]@{ type = 'paragraph'; text = $content; links = @(Get-Links $node) }
            }
        } elseif ($node.LocalName -eq 'tbl') {
            $rows = @()
            foreach ($row in $node.SelectNodes('w:tr', $ns)) {
                $cells = @()
                foreach ($cell in $row.SelectNodes('w:tc', $ns)) {
                    $cells += (($cell.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '')
                }
                $rows += ,$cells
            }
            $blocks += [ordered]@{ type = 'table'; rows = $rows; links = @(Get-Links $node) }
        }
    }
    $data = [ordered]@{ fileName = '姑苏区领军人才政策.docx'; blocks = $blocks }
    $script = 'window.GUSU_SOURCE = ' + (ConvertTo-Json -InputObject $data -Depth 15) + ';' + [Environment]::NewLine
    $target = Join-Path $Workspace '全市政策\姑苏区资源\source-data.js'
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
    [System.IO.File]::WriteAllText($target, $script, [System.Text.UTF8Encoding]::new($false))
    Write-Output ('Extracted {0} paragraphs and {1} tables.' -f @($blocks | Where-Object type -eq 'paragraph').Count, @($blocks | Where-Object type -eq 'table').Count)
    foreach ($block in $blocks) { foreach ($link in $block.links) { Write-Output ($link.text + ' => ' + $link.url) } }
} finally { $archive.Dispose() }
