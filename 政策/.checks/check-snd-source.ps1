$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf=[Text.Encoding]::UTF8
$raw=[IO.File]::ReadAllText((Join-Path $workspace '全市政策\高新区资源\source-data.js'),$utf)
$data=($raw -replace '^window.SND_SOURCE = ','' -replace ';\s*$','')|ConvertFrom-Json
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $workspace $data.fileName))
function ReadXml($name){$entry=$zip.GetEntry($name);if(!$entry){return $null};$reader=[IO.StreamReader]::new($entry.Open());try{return [xml]$reader.ReadToEnd()}finally{$reader.Dispose()}}
function AssertEqual($a,$b,$where){if($a -cne $b){throw "Source mismatch: $where"}}
try{
 $doc=ReadXml 'word/document.xml';$rels=ReadXml 'word/_rels/document.xml.rels'
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main');$ns.AddNamespace('r','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
 $targets=@{};foreach($r in $rels.Relationships.Relationship){if($r.Type -match '/hyperlink$'){$targets[$r.Id]=$r.Target}}
 $index=0;$paras=0;$tables=0;$links=0;$cells=0
 foreach($node in $doc.SelectSingleNode('//w:body',$ns).ChildNodes){
  if($node.LocalName -eq 'p'){
   $text=($node.SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
   if(!$text.Trim()){continue}
   $block=$data.blocks[$index];AssertEqual $block.type 'paragraph' "block $index type";AssertEqual $block.text $text "paragraph $index";$paras++
  }elseif($node.LocalName -eq 'tbl'){
   $block=$data.blocks[$index];AssertEqual $block.type 'table' "block $index type";$rows=$node.SelectNodes('w:tr',$ns);AssertEqual $block.rows.Count $rows.Count "table $index rows"
   for($ri=0;$ri -lt $rows.Count;$ri++){$rowcells=$rows[$ri].SelectNodes('w:tc',$ns);AssertEqual $block.rows[$ri].Count $rowcells.Count "row $ri cells";for($ci=0;$ci -lt $rowcells.Count;$ci++){$cellText=($rowcells[$ci].SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join '';AssertEqual $block.rows[$ri][$ci] $cellText "table $index cell $ri $ci";$cells++}};$tables++
  }else{continue}
  $hyper=$node.SelectNodes('.//w:hyperlink',$ns);AssertEqual $block.links.Count $hyper.Count "block $index hyperlinks"
  for($li=0;$li -lt $hyper.Count;$li++){$item=$hyper[$li];$label=($item.SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join '';$rid=$item.GetAttribute('id',$ns.LookupNamespace('r'));AssertEqual $block.links[$li].text $label "link $li label";AssertEqual $block.links[$li].url $targets[$rid] "link $li target";$links++}
  $index++
 }
 AssertEqual $data.blocks.Count $index 'total blocks'
 $images=@($zip.Entries|Where-Object{$_.FullName -like 'word/media/*'}).Count
 foreach($entry in $zip.Entries|Where-Object{$_.FullName -match '^word/(header\d+|footer\d+|footnotes|endnotes)\.xml$'}){
  $part=ReadXml $entry.FullName;$partNs=[Xml.XmlNamespaceManager]::new($part.NameTable);$partNs.AddNamespace('w',$ns.LookupNamespace('w'))
  $extra=($part.SelectNodes('//w:t',$partNs)|ForEach-Object{$_.InnerText}) -join ''
  if($entry.FullName -eq 'word/header1.xml'){AssertEqual $extra '苏州高新区科技创新创业领军人才计划  ·  专题介绍' 'repeated header title'}
  elseif($entry.FullName -eq 'word/footer1.xml'){AssertEqual $extra '1' 'footer cached page number';$field=($part.SelectNodes('//w:instrText',$partNs)|ForEach-Object{$_.InnerText}) -join '';AssertEqual $field.Trim() 'PAGE' 'footer field'}
  elseif($extra.Trim()){throw "Additional source text needs inspection: $($entry.FullName)"}
 }
 if($images -gt 0){throw "Additional source images need inspection: $images"}
 Write-Output "PASS: DOCX XML compared in order: $paras paragraphs, $tables tables, $cells cells, $links link labels/targets."
 Write-Output 'PASS: Header repeats document title; footer only has a PAGE field. No additional policy text, notes or images.'
}finally{$zip.Dispose()}
