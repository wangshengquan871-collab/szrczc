param([string]$Workspace = 'C:\Users\11811\Desktop\网页\政策')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$documents = @()
foreach ($fileName in @('昆山双创.docx', '昆山市创业领军人才专题介绍.docx')) {
    $archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $Workspace $fileName))
    try {
        $reader = [System.IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
        try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $targets = @{}
        $entry = $archive.GetEntry('word/_rels/document.xml.rels')
        if ($entry) {
            $reader = [System.IO.StreamReader]::new($entry.Open())
            try { [xml]$rels = $reader.ReadToEnd() } finally { $reader.Dispose() }
            foreach ($rel in $rels.Relationships.Relationship) {
                if ($rel.Type -match '/hyperlink$') { $targets[$rel.Id] = $rel.Target }
            }
        }
        function Get-Links($Node) {
            $links = @()
            foreach ($link in $Node.SelectNodes('.//w:hyperlink', $ns)) {
                $id = $link.GetAttribute('id', $ns.LookupNamespace('r'))
                if ($targets.ContainsKey($id)) {
                    $links += [ordered]@{ text = (($link.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''); url = $targets[$id] }
                }
            }
            return $links
        }
        $blocks = @()
        foreach ($node in $xml.SelectSingleNode('//w:body', $ns).ChildNodes) {
            if ($node.LocalName -eq 'p') {
                $content = ($node.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
                if ($content.Trim()) { $blocks += [ordered]@{ type = 'paragraph'; text = $content; links = @(Get-Links $node) } }
            } elseif ($node.LocalName -eq 'tbl') {
                $rows = @()
                foreach ($row in $node.SelectNodes('w:tr', $ns)) {
                    $cells = @()
                    foreach ($cell in $row.SelectNodes('w:tc', $ns)) { $cells += (($cell.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '') }
                    $rows += ,$cells
                }
                $blocks += [ordered]@{ type = 'table'; rows = $rows; links = @(Get-Links $node) }
            }
        }
        $documents += [ordered]@{ fileName = $fileName; blocks = $blocks }
        Write-Output ('{0}: {1} paragraphs, {2} tables, {3} hyperlinks' -f $fileName, @($blocks | Where-Object type -eq 'paragraph').Count, @($blocks | Where-Object type -eq 'table').Count, @($blocks.links).Count)
    } finally { $archive.Dispose() }
}
$target = Join-Path $Workspace '全市政策\昆山资源\source-data.js'
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
$script = 'window.KUNSHAN_SOURCE = ' + (ConvertTo-Json -InputObject $documents -Depth 15) + ';' + [Environment]::NewLine
[System.IO.File]::WriteAllText($target, $script, [System.Text.UTF8Encoding]::new($false))
