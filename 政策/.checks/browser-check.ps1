param(
    [string]$PagePath = (Join-Path $PSScriptRoot '..\全市政策\东吴.html'),
    [string]$InteractionScript
)

$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$resolvedPage = (Resolve-Path -LiteralPath $PagePath).Path
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$runTag = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$profilePath = Join-Path $taskRoot ('edge-profile-' + $runTag)
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

try {
    $arguments = @(
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
        '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
        '--disable-extensions', '--remote-debugging-port=0', '--allow-file-access-from-files',
        ('--user-data-dir="' + $profilePath + '"'), 'about:blank'
    )
    $browser = Start-Process -FilePath $edgePath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot ('edge-' + $runTag + '.stdout.log')) -RedirectStandardError (Join-Path $taskRoot ('edge-' + $runTag + '.stderr.log'))
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
    $null = Evaluate-Page '(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, 200)); return true; })()'

    $reports = @()
    foreach ($view in @(@{name='desktop'; width=1440; height=1100; mobile=$false}, @{name='mobile'; width=375; height=900; mobile=$true})) {
        $null = Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$view.width; height=$view.height; deviceScaleFactor=1; mobile=$view.mobile}
        $null = Evaluate-Page '(async () => { window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 250)); return true; })()'
        $summary = Evaluate-Page @'
(() => {
  const width = window.innerWidth;
  const bad = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect(), css = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && css.position !== 'fixed' && (r.right > width + 1 || r.left < -1);
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
        $null = Evaluate-Page '(async () => { window.scrollTo(0,0); await new Promise(r => setTimeout(r,100)); return true; })()'
        $screenshot = Send-Cdp 'Page.captureScreenshot' @{format='png'; captureBeyondViewport=$false; fromSurface=$true}
        $imagePath = Join-Path $taskRoot ('browser-' + $view.name + '.png')
        [System.IO.File]::WriteAllBytes($imagePath, [Convert]::FromBase64String($screenshot.data))
        $reports += @{view=$view.name; summary=$summary; interactions=$interactions; screenshot=$imagePath}
    }
    $errors = @($script:events | Where-Object {
        $_.method -eq 'Runtime.exceptionThrown' -or
        ($_.method -eq 'Log.entryAdded' -and $_.params.entry.level -eq 'error') -or
        ($_.method -eq 'Runtime.consoleAPICalled' -and $_.params.type -eq 'error')
    })
    $report = @{page=$resolvedPage; generated=(Get-Date -Format o); views=$reports; browserErrors=$errors}
    $report | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $taskRoot 'browser-report.json') -Encoding UTF8
    $report | ConvertTo-Json -Depth 40
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
