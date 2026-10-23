$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$raw=[IO.File]::ReadAllText((Join-Path $root '全市政策\政策对比资源\workbook-data.js'),[Text.Encoding]::UTF8)
$snapshot=($raw -replace '^window.SUZHOU_WORKBOOK = ','' -replace ';\s*$','')|ConvertFrom-Json
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $root $snapshot.fileName))
function ReadXml($name){$entry=$zip.GetEntry($name);$reader=[IO.StreamReader]::new($entry.Open());try{return [xml]$reader.ReadToEnd()}finally{$reader.Dispose()}}
function Equal($a,$b,$where){if($a -cne $b){throw "Source mismatch: $where"}}
try{
 $uri='http://schemas.openxmlformats.org/spreadsheetml/2006/main';$stringsDoc=ReadXml 'xl/sharedStrings.xml';$ns=[Xml.XmlNamespaceManager]::new($stringsDoc.NameTable);$ns.AddNamespace('s',$uri)
 $strings=@($stringsDoc.SelectNodes('//s:si',$ns)|ForEach-Object{($_.SelectNodes('.//s:t',$ns)|ForEach-Object{$_.InnerText}) -join ''})
 $workbook=ReadXml 'xl/workbook.xml';Equal $snapshot.sheets.Count $workbook.workbook.sheets.sheet.Count 'sheet count'
 $cells=0;$formulas=0
 foreach($sheet in $snapshot.sheets){
  $xml=ReadXml ('xl/worksheets/sheet'+$sheet.id+'.xml');$sn=[Xml.XmlNamespaceManager]::new($xml.NameTable);$sn.AddNamespace('s',$uri)
  Equal $sheet.name ([string]$workbook.workbook.sheets.sheet[$sheet.id-1].name) 'sheet name';Equal $sheet.dimension ([string]$xml.worksheet.dimension.ref) 'dimension'
  $seen=@{};foreach($row in $sheet.rows){foreach($cell in $row.cells){$seen[$cell.address]=$cell}}
  $sourceCells=@($xml.SelectNodes('//s:sheetData/s:row/s:c[s:v or s:is or s:f]',$sn));Equal $seen.Count $sourceCells.Count ($sheet.name+' populated cells')
  foreach($cell in $sourceCells){$address=[string]$cell.r;$actual=$seen[$address];if(!$actual){throw "Missing $($sheet.name)!$address"};$v=$cell.SelectSingleNode('s:v',$sn);$expectedRaw=if($v){[string]$v.InnerText}else{''};Equal $actual.raw $expectedRaw ($sheet.name+'!'+$address+' raw');Equal $actual.type ([string]$cell.t) 'cell type'
   if($cell.t -eq 's'){Equal $actual.value $strings[[int]$expectedRaw] 'shared string';Equal $actual.display $strings[[int]$expectedRaw] 'string display'}
   elseif($cell.t -eq 'inlineStr'){$expected=($cell.SelectNodes('.//s:t',$sn)|ForEach-Object{$_.InnerText}) -join '';Equal $actual.value $expected 'inline string'}
   elseif($cell.t -in @('str','e')){Equal $actual.value $expectedRaw 'cached text'}
   elseif($expectedRaw -ne ''){if([double]$actual.value -ne [double]::Parse($expectedRaw,[Globalization.CultureInfo]::InvariantCulture)){throw 'Numeric cache mismatch'}}
   $f=$cell.SelectSingleNode('s:f',$sn);if($f){Equal $actual.formula ([string]$f.InnerText) 'formula';$formulas++}elseif($actual.formula){throw 'Unexpected formula'}
   $cells++
  }
 }
 Equal $cells $snapshot.cellCount 'total cells';Equal $formulas $snapshot.formulaCount 'formula total'
 Write-Output "PASS: Original XLSX XML independently checked: 8 sheet names/dimensions, $cells cell addresses/types/raw values and $formulas formulas."
}finally{$zip.Dispose()}
