param(
    [string]$PagePath = (Join-Path $PSScriptRoot '..\全市政策\政策对比.html'),
    [string]$InteractionScript
)

$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$resolvedPage = (Resolve-Path -LiteralPath $PagePath).Path
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$runTag = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$profilePath = Join-Path $taskRoot ('edge-comparison-profile-' + $runTag)
$null = New-Item -ItemType Directory -Path $profilePath -Force
$script:sequence = 0
$script:events = New-Object System.Collections.Generic.List[object]
$socket = $null
$browser = $null

function Receive-Cdp {
    $packet = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 1048576
    $segment = [System.ArraySegment[byte]]::new($buffer)
    $timeout = [System.Threading.CancellationTokenSource]::new(15000)
    try {
        do {
            $received = $script:socket.ReceiveAsync($segment, $timeout.Token).GetAwaiter().GetResult()
            if ($received.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                throw 'DevTools websocket closed unexpectedly.'
            }
            $packet.Write($buffer, 0, $received.Count)
        } while (-not $received.EndOfMessage)
        return ([System.Text.Encoding]::UTF8.GetString($packet.ToArray()) | ConvertFrom-Json)
    }
    finally {
        $packet.Dispose()
        $timeout.Dispose()
    }
}

function Send-Cdp {
    param([string]$Method, [object]$Parameters = @{})
    $script:sequence++
    $commandId = $script:sequence
    $payload = @{id = $commandId; method = $Method; params = $Parameters} | ConvertTo-Json -Depth 40 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $script:socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    do {
        $reply = Receive-Cdp
        if ($null -ne $reply.method) { $script:events.Add($reply) }
    } while ($reply.id -ne $commandId)
    if ($reply.error) { throw ($Method + ': ' + ($reply.error | ConvertTo-Json -Compress)) }
    return $reply.result
}

function Evaluate-Page {
    param([string]$Expression)
    $evaluation = Send-Cdp 'Runtime.evaluate' @{expression = $Expression; returnByValue = $true; awaitPromise = $true}
    if ($evaluation.exceptionDetails) { throw ($evaluation.exceptionDetails | ConvertTo-Json -Depth 20 -Compress) }
    return $evaluation.result.value
}

function Save-Screenshot {
    param([string]$Name)
    $capture = Send-Cdp 'Page.captureScreenshot' @{format='png'; captureBeyondViewport=$false; fromSurface=$true}
    $capturePath = Join-Path $taskRoot ($Name + '.png')
    [System.IO.File]::WriteAllBytes($capturePath, [Convert]::FromBase64String($capture.data))
    return $capturePath
}

try {
    $arguments = @(
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
        '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
        '--disable-extensions', '--remote-debugging-port=0', '--allow-file-access-from-files',
        ('--user-data-dir="' + $profilePath + '"'), 'about:blank'
    )
    $browser = Start-Process -FilePath $edgePath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot ('edge-comparison-' + $runTag + '.stdout.log')) -RedirectStandardError (Join-Path $taskRoot ('edge-comparison-' + $runTag + '.stderr.log'))
    $portFile = Join-Path $profilePath 'DevToolsActivePort'
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while (-not (Test-Path -LiteralPath $portFile)) {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Edge did not expose DevToolsActivePort within 15 seconds.' }
        Start-Sleep -Milliseconds 200
    }
    $port = (Get-Content -LiteralPath $portFile)[0]
    $targets = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/json/list')
    $target = @($targets | Where-Object type -eq 'page')[0]
    $script:socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $script:socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $null = Send-Cdp 'Page.enable'
    $null = Send-Cdp 'Runtime.enable'
    $null = Send-Cdp 'Log.enable'
    $pageUri = ([Uri]$resolvedPage).AbsoluteUri
    $null = Send-Cdp 'Page.navigate' @{url = $pageUri}
    $ready = $false
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        $ready = Evaluate-Page 'document.readyState === "complete"'
        if (-not $ready) { Start-Sleep -Milliseconds 150 }
    } while (-not $ready -and [DateTime]::UtcNow -lt $deadline)
    if (-not $ready) { throw 'Page did not reach document.readyState complete.' }
    $null = Evaluate-Page '(async () => { document.documentElement.style.scrollBehavior="auto"; await document.fonts.ready; await new Promise(r => setTimeout(r, 200)); return true; })()'

    $reports = @()
    foreach ($view in @(@{name='desktop'; width=1440; height=1100; mobile=$false}, @{name='tablet'; width=768; height=1050; mobile=$true}, @{name='mobile'; width=375; height=900; mobile=$true})) {
        $null = Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$view.width; height=$view.height; deviceScaleFactor=1; mobile=$view.mobile}
        $null = Evaluate-Page '(async () => { window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 250)); return true; })()'
        $summary = Evaluate-Page @'
(() => {
  const width = window.innerWidth;
  const bad = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect(), css = getComputedStyle(el);
    const contained = el.closest('.table-scroll, .site-header nav, .sr-only');
    return !contained && r.width > 0 && r.height > 0 && css.position !== 'fixed' && (r.right > width + 1 || r.left < -1);
  }).slice(0, 20).map(el => ({tag:el.tagName, id:el.id, class:el.className, text:el.textContent.trim().slice(0,80), x:Math.round(el.getBoundingClientRect().x), width:Math.round(el.getBoundingClientRect().width)}));
  return {
    title: document.title, viewport:{width,height:window.innerHeight},
    contentWidth:document.documentElement.scrollWidth,
    horizontalOverflow:document.documentElement.scrollWidth > width + 1,
    overflowElements:bad,
    headings:[...document.querySelectorAll('h1,h2,h3')].map(el => ({tag:el.tagName,text:el.textContent.trim()})),
    controls:[...document.querySelectorAll('button,input,select,summary,[role="tab"]')].map(el => ({tag:el.tagName,id:el.id,role:el.getAttribute('role'),type:el.type,text:el.textContent.trim().slice(0,100)})),
    brokenImages:[...document.images].filter(im => !im.complete || im.naturalWidth === 0).map(im=>im.src),
    localLinks:[...document.querySelectorAll('a[href^="#"]')].map(a => ({href:a.getAttribute('href'),exists:!!document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))}))
  };
})()
'@
        $interactions = Evaluate-Page @'
(() => {
  const results=[];
  for (const details of document.querySelectorAll('details')) {
    const original=details.open, summary=details.querySelector('summary');
    if (!summary) continue;
    summary.click();
    results.push({type:'details',text:summary.textContent.trim(),passed:details.open !== original});
    details.open=original;
  }
  return results;
})()
'@
        if ($InteractionScript) {
            $custom = Get-Content -LiteralPath $InteractionScript -Raw -Encoding UTF8
            $interactions += @(Evaluate-Page $custom)
        }
        $null = Evaluate-Page '(async () => { document.getElementById("amounts").scrollIntoView(); await new Promise(r => setTimeout(r,150)); return true; })()'
        $amountScreenshot = Save-Screenshot ('comparison-amounts-' + $view.name)
        $selectedLayout = Evaluate-Page @'
(async () => {
  for (const id of ['wuzhong','gusu','changshu','snd']) document.querySelector('.region-choice[data-select-region="'+id+'"]').click();
  document.getElementById('compare').scrollIntoView();
  await new Promise(r => setTimeout(r,150));
  const containers=[...document.querySelectorAll('.comparison-scroll')].filter(el=>el.getBoundingClientRect().height>0);
  const local=containers.every(el=>{const box=el.getBoundingClientRect();return box.left>=-1&&box.right<=innerWidth+1&&getComputedStyle(el).overflowX==='auto';});
  const keyboard=containers.every(el=>el.tabIndex===0&&el.getAttribute('role')==='region'&&!!el.getAttribute('aria-label'));
  const reach=containers.every(el=>{el.scrollLeft=el.scrollWidth;const box=el.getBoundingClientRect(),last=el.querySelector('thead th:last-child').getBoundingClientRect();const ok=last.right<=box.right+2;el.scrollLeft=0;return ok;});
  return {viewport:innerWidth,contentWidth:document.documentElement.scrollWidth,localScrollContained:local,keyboardAccessible:keyboard,lastColumnReachable:reach,tableCount:containers.length,selected:document.querySelectorAll('.region-choice[aria-pressed="true"]').length};
})()
'@
        if ($selectedLayout.contentWidth -gt $selectedLayout.viewport + 1 -or -not $selectedLayout.localScrollContained -or -not $selectedLayout.keyboardAccessible -or -not $selectedLayout.lastColumnReachable -or $selectedLayout.selected -ne 4) { throw ('Selected comparison layout failed: ' + ($selectedLayout | ConvertTo-Json -Compress)) }
        $selectedScreenshot = Save-Screenshot ('comparison-selected-' + $view.name)
        $null = Evaluate-Page 'document.getElementById("clear-selection").click(); true'
        $null = Evaluate-Page '(async () => { window.scrollTo(0,0); await new Promise(r => setTimeout(r,100)); return true; })()'
        $imagePath = Save-Screenshot ('comparison-browser-' + $view.name)
        $reports += @{view=$view.name; summary=$summary; interactions=$interactions; screenshot=$imagePath; amountScreenshot=$amountScreenshot; selectedScreenshot=$selectedScreenshot; selectedLayout=$selectedLayout}
    }
    $null = Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=1123; height=794; deviceScaleFactor=1; mobile=$false}
    $null = Evaluate-Page 'for(const id of ["wuzhong","gusu","changshu","snd"])document.querySelector(".region-choice[data-select-region=\""+id+"\"]").click();document.querySelector("[data-view=\"housing\"]").click();window.dispatchEvent(new Event("beforeprint"));true'
    $null = Send-Cdp 'Emulation.setEmulatedMedia' @{media='print'}
    $printLayout = Evaluate-Page @'
(() => ({
  groupCount:document.querySelectorAll('[data-compare-group]').length,
  allGroupsOpen:[...document.querySelectorAll('[data-compare-group]')].every(el=>el.open),
  extraSectionsHidden:[...document.querySelectorAll('.print-extra')].every(el=>getComputedStyle(el).display==='none'),
  workbookClosed:!document.getElementById('workbook-archive').open,
  activeChart:document.querySelector('[role=tab][aria-selected=true]').dataset.view,
  overviewRows:document.querySelectorAll('.overview-table tbody tr').length,
  comparisonFits:[...document.querySelectorAll('.comparison-scroll')].every(el=>el.scrollWidth<=el.clientWidth+2)
}))()
'@
    if ($printLayout.groupCount -ne 5 -or -not $printLayout.allGroupsOpen -or -not $printLayout.extraSectionsHidden -or -not $printLayout.workbookClosed -or $printLayout.activeChart -ne 'housing' -or $printLayout.overviewRows -ne 8 -or -not $printLayout.comparisonFits) { throw ('Print layout failed: ' + ($printLayout | ConvertTo-Json -Compress)) }
    $pdf = Send-Cdp 'Page.printToPDF' @{printBackground=$true; preferCSSPageSize=$true; landscape=$true}
    $pdfPath = Join-Path $taskRoot 'comparison-print.pdf'
    $pdfBytes = [Convert]::FromBase64String($pdf.data)
    [System.IO.File]::WriteAllBytes($pdfPath, $pdfBytes)
    $pdfPages = [regex]::Matches([System.Text.Encoding]::ASCII.GetString($pdfBytes), '/Type /Page\b').Count
    if ($pdfPages -lt 1 -or $pdfPages -gt 30) { throw ('Unexpected print page count: ' + $pdfPages) }
    $printLayout | Add-Member -NotePropertyName pdfPages -NotePropertyValue $pdfPages
    $printLayout | Add-Member -NotePropertyName pdfPath -NotePropertyValue $pdfPath
    $null = Evaluate-Page 'window.dispatchEvent(new Event("afterprint"));true'
    $null = Send-Cdp 'Emulation.setEmulatedMedia' @{media=''}
    $restored = Evaluate-Page '!document.getElementById("compare-innovation").open&&!document.getElementById("compare-team").open'
    if (-not $restored) { throw 'Printed PDF did not restore comparison state.' }
    $errors = @($script:events | Where-Object {
        $_.method -eq 'Runtime.exceptionThrown' -or
        ($_.method -eq 'Log.entryAdded' -and $_.params.entry.level -eq 'error') -or
        ($_.method -eq 'Runtime.consoleAPICalled' -and $_.params.type -eq 'error')
    })
    $report = @{page=$resolvedPage; generated=(Get-Date -Format o); views=$reports; browserErrors=$errors; printLayout=$printLayout}
    $report | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $taskRoot 'comparison-browser-report.json') -Encoding UTF8
    if ($errors.Count) { throw ('Browser errors: ' + $errors.Count) }
    foreach ($viewReport in $reports) {
        if ($viewReport.summary.horizontalOverflow) { throw ('Page overflow at ' + $viewReport.view) }
        if ($viewReport.summary.overflowElements.Count) { throw ('Uncontained elements at ' + $viewReport.view + ': ' + ($viewReport.summary.overflowElements | ConvertTo-Json -Compress)) }
        if ($viewReport.summary.brokenImages.Count) { throw ('Broken images at ' + $viewReport.view) }
        if (@($viewReport.summary.localLinks | Where-Object { -not $_.exists }).Count) { throw 'Broken page anchors' }
        if (@($viewReport.interactions | Where-Object { -not $_.passed }).Count) { throw 'Interaction checks failed' }
        Write-Output ('PASS: ' + $viewReport.view + ' ' + $viewReport.summary.viewport.width + 'px; no page overflow, all images/anchors and ' + $viewReport.interactions.Count + ' interaction checks passed.')
    }
    Write-Output ('PASS: current housing chart, eight overview rows, all five selected comparison groups and ' + $pdfPages + '-page PDF; print states restored.')
    Write-Output ('Report: ' + (Join-Path $taskRoot 'comparison-browser-report.json'))
}
finally {
    if ($script:socket -and $script:socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        try { $null = Send-Cdp 'Browser.close' } catch { }
        $script:socket.Dispose()
    }
    if ($browser -and -not $browser.HasExited) {
        $browser.WaitForExit(3000) | Out-Null
        if (-not $browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
    }
}
