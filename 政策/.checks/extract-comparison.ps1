$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot -Parent
$fileName='苏州八地人才政策多维对比.xlsx'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $workspace $fileName))
function ReadPart($name){$entry=$zip.GetEntry($name);if(!$entry){return $null};$reader=[IO.StreamReader]::new($entry.Open());try{return [xml]$reader.ReadToEnd()}finally{$reader.Dispose()}}
try{
 $uri='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
 $ss=ReadPart 'xl/sharedStrings.xml';$ns=[Xml.XmlNamespaceManager]::new($ss.NameTable);$ns.AddNamespace('s',$uri)
 $strings=@($ss.SelectNodes('//s:si',$ns)|ForEach-Object{($_.SelectNodes('.//s:t',$ns)|ForEach-Object{$_.InnerText}) -join ''})
 $styles=ReadPart 'xl/styles.xml';$formats=@{0='General';1='0';2='0.00';3='#,##0';4='#,##0.00';9='0%';10='0.00%';11='0.00E+00';14='yyyy-mm-dd';49='@'}
 foreach($f in $styles.styleSheet.numFmts.numFmt){$formats[[int]$f.numFmtId]=[string]$f.formatCode}
 $styleFormats=@($styles.styleSheet.cellXfs.xf|ForEach-Object{$formats[[int]$_.numFmtId]})
 $book=ReadPart 'xl/workbook.xml';$rels=ReadPart 'xl/_rels/workbook.xml.rels';$targets=@{}
 foreach($r in $rels.Relationships.Relationship){$targets[$r.Id]='xl/'+$r.Target.TrimStart('/')}
 $sheets=@();$cellCount=0;$formulaCount=0
 foreach($sheet in $book.workbook.sheets.sheet){
  $rid=$sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $doc=ReadPart $targets[$rid];$sn=[Xml.XmlNamespaceManager]::new($doc.NameTable);$sn.AddNamespace('s',$uri)
  $rows=@()
  foreach($row in $doc.SelectNodes('//s:sheetData/s:row',$sn)){
   $cells=@()
   foreach($c in $row.SelectNodes('s:c',$sn)){
    $v=$c.SelectSingleNode('s:v',$sn);$f=$c.SelectSingleNode('s:f',$sn);$inline=$c.SelectSingleNode('s:is',$sn)
    if(!$v -and !$f -and !$inline){continue}
    $raw=if($v){[string]$v.InnerText}else{''};$value=$null;$display='';$kind=[string]$c.t
    if($kind -eq 's'){$value=$strings[[int]$raw];$display=$value}
    elseif($kind -eq 'inlineStr'){$value=($c.SelectNodes('.//s:t',$sn)|ForEach-Object{$_.InnerText}) -join '';$display=$value}
    elseif($kind -in @('str','e')){$value=$raw;$display=$raw}
    elseif($kind -eq 'b'){$value=$raw -eq '1';$display=if($value){'TRUE'}else{'FALSE'}}
    elseif($raw -ne ''){$value=[double]::Parse($raw,[Globalization.CultureInfo]::InvariantCulture);$display=$raw}
    $style=if($c.HasAttribute('s')){[int]$c.s}else{0};$format=[string]$styleFormats[$style]
    if($null -ne $value -and $value -is [double]){
     if($format.Contains('%')){$percentDigits=if($format -match '0\.(0+)%'){$matches[1].Length}else{0};$display=($value*100).ToString('F'+$percentDigits,[Globalization.CultureInfo]::InvariantCulture)+'%'}
     elseif($format -match '^[#0,]+\.([0]+)$'){$display=$value.ToString('F'+$matches[1].Length,[Globalization.CultureInfo]::InvariantCulture)}
     elseif($format -match '^[#0,]+$'){$display=$value.ToString('0',[Globalization.CultureInfo]::InvariantCulture)}
     elseif($format -match '[dy]' -and $format -notmatch '\['){$display=[DateTime]::FromOADate($value).ToString('yyyy-MM-dd')}
    }
    $item=[ordered]@{address=[string]$c.r;column=([string]$c.r -replace '\d','');value=$value;display=$display;raw=$raw;type=$kind;style=$style;numberFormat=$format}
    if($f){$item.formula=[string]$f.InnerText;$formulaCount++}
    $cells+=,$item;$cellCount++
   }
   if($cells.Count){$rows+=,[ordered]@{index=[int]$row.r;cells=$cells}}
  }
  $sheets+=,[ordered]@{name=[string]$sheet.name;id=[int]$sheet.sheetId;dimension=[string]$doc.worksheet.dimension.ref;rows=$rows}
 }
 $data=[ordered]@{fileName=$fileName;asOf='2026-10-10';sheets=$sheets;cellCount=$cellCount;formulaCount=$formulaCount}
 $folder=Join-Path $workspace '全市政策\政策对比资源';[IO.Directory]::CreateDirectory($folder)|Out-Null
 [IO.File]::WriteAllText((Join-Path $folder 'workbook-data.js'),'window.SUZHOU_WORKBOOK = '+(ConvertTo-Json -InputObject $data -Depth 18)+';'+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
 Write-Output "Extracted $($sheets.Count) sheets, $cellCount populated/formula cells, $formulaCount formulas."
}finally{$zip.Dispose()}
