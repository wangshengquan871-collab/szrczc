param([string]$SiteUrl = 'http://127.0.0.1:5527/',[switch]$VisualReview,[switch]$EnhancementReview)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$portalRoot = Join-Path $taskRoot '..\全市政策\苏州人才政策'
$runTag = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$profilePath = Join-Path $taskRoot ('edge-portal-profile-' + $runTag)
$null = New-Item -ItemType Directory -Path $profilePath -Force
$script:sequence = 0
$script:events = New-Object System.Collections.Generic.List[object]
$script:socket = $null
$browser = $null
function Receive-Cdp {
    $packet = New-Object IO.MemoryStream
    $buffer = New-Object byte[] 1048576
    $segment = [ArraySegment[byte]]::new($buffer)
    $timeout = [Threading.CancellationTokenSource]::new(15000)
    try {
        do {
            $received = $script:socket.ReceiveAsync($segment,$timeout.Token).GetAwaiter().GetResult()
            if ($received.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'CDP websocket closed.' }
            $packet.Write($buffer,0,$received.Count)
        } while (-not $received.EndOfMessage)
        return ([Text.Encoding]::UTF8.GetString($packet.ToArray()) | ConvertFrom-Json)
    } finally { $packet.Dispose(); $timeout.Dispose() }
}
function Send-Cdp {
    param([string]$Method,[object]$Parameters=@{})
    $script:sequence++
    $id = $script:sequence
    $payload = @{id=$id;method=$Method;params=$Parameters} | ConvertTo-Json -Depth 40 -Compress
    $bytes=[Text.Encoding]::UTF8.GetBytes($payload)
    $script:socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    do { $reply=Receive-Cdp; if($reply.method){$script:events.Add($reply)} } while($reply.id -ne $id)
    if($reply.error){throw ($Method+': '+($reply.error|ConvertTo-Json -Compress))}
    return $reply.result
}
function Evaluate-Page {
    param([string]$Expression)
    $result=Send-Cdp 'Runtime.evaluate' @{expression=$Expression;returnByValue=$true;awaitPromise=$true}
    if($result.exceptionDetails){throw ($result.exceptionDetails|ConvertTo-Json -Depth 15 -Compress)}
    return $result.result.value
}
function Navigate-Page {
    param([string]$Url)
    $null=Send-Cdp 'Page.navigate' @{url=$Url}
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    do {
        Start-Sleep -Milliseconds 120
        $ready=Evaluate-Page 'document.readyState === "complete" && !!document.querySelector(".szp-navigation-ready")'
    } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
    if(-not $ready){throw ('Page did not load: '+$Url)}
    $null=Evaluate-Page '(async()=>{document.documentElement.style.scrollBehavior="auto";await document.fonts.ready;await new Promise(r=>setTimeout(r,120));return true;})()'
}
function Follow-Navigation {
    param([string]$Expression)
    $destination=Evaluate-Page $Expression
    $encoded=$destination|ConvertTo-Json -Compress
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    do {
        Start-Sleep -Milliseconds 150
        $ready=Evaluate-Page ('document.readyState === "complete" && location.href === '+$encoded+' && !!document.querySelector(".szp-navigation-ready")')
    } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
    if(-not $ready){throw ('Navigation link did not open target: '+$destination)}
    return @{destination=$destination;passed=$true}
}
function Save-Screenshot {
    param([string]$Name)
    $capture=Send-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false;fromSurface=$true}
    [IO.File]::WriteAllBytes((Join-Path $taskRoot ($Name+'.png')),[Convert]::FromBase64String($capture.data))
}
try {
    $arguments=@('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--remote-debugging-port=0','--allow-file-access-from-files',('--user-data-dir="'+$profilePath+'"'),'about:blank')
    $browser=Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot ('edge-portal-'+$runTag+'.stdout.log')) -RedirectStandardError (Join-Path $taskRoot ('edge-portal-'+$runTag+'.stderr.log'))
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    $portFile=Join-Path $profilePath 'DevToolsActivePort'
    while(-not(Test-Path -LiteralPath $portFile)){if([DateTime]::UtcNow -gt $deadline){throw 'Edge DevTools launch failed.'};Start-Sleep -Milliseconds 150}
    $port=(Get-Content -LiteralPath $portFile)[0]
    $targets=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+'/json/list')
    $target=@($targets | Where-Object type -eq 'page')[0]
    $script:socket=[Net.WebSockets.ClientWebSocket]::new()
    $script:socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $null=Send-Cdp 'Page.enable'; $null=Send-Cdp 'Runtime.enable'; $null=Send-Cdp 'Log.enable'
    $null=Send-Cdp 'Page.bringToFront'
    $null=Send-Cdp 'Emulation.setFocusEmulationEnabled' @{enabled=$true}
    if($EnhancementReview){
        $null=Send-Cdp 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion';value='reduce'})}
        $enhancementChecks=New-Object Collections.Generic.List[object]
        foreach($reviewWidth in @(1440,768,375)){
            $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$reviewWidth;height=1050;deviceScaleFactor=1;mobile=($reviewWidth -lt 1100)}
            Navigate-Page ([Uri]::new([Uri]$SiteUrl,'index.html').AbsoluteUri)
            $enhancementChecks.Add(@{width=$reviewWidth;checks=(Evaluate-Page ([IO.File]::ReadAllText((Join-Path $taskRoot 'home-enhancement-interactions.js'))))})
            $motion=Evaluate-Page '({reduced:!document.body.classList.contains("szp-motion-enabled"),counts:[...document.querySelectorAll("[data-szp-count]")].map(e=>e.textContent).join()})'
            if(-not $motion.reduced -or $motion.counts -ne '1,8,9'){throw 'Homepage reduced-motion or counters failed.'}
            foreach($section in @('.szp-data-overview','[data-szp-card="wuzhong"]','#szp-chart-preview')){
                $null=Evaluate-Page ('document.querySelector('+($section|ConvertTo-Json -Compress)+').scrollIntoView({behavior:"instant"});true')
                Start-Sleep -Milliseconds 100
                Save-Screenshot ('home-upgrade-'+($section -replace '[^a-zA-Z]','')+'-'+$reviewWidth)
            }
            $null=Evaluate-Page 'document.querySelector("[data-szp-chart-mode=bars]").click();true'
            Save-Screenshot ('home-upgrade-bars-'+$reviewWidth)
            $null=Evaluate-Page 'window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"});true'
            Start-Sleep -Milliseconds 80
            $null=Evaluate-Page 'document.getElementById("szp-back-top").click();true'
            $top=Evaluate-Page 'scrollY===0'
            if(-not $top){throw 'Back-to-top failed with reduced motion.'}
        }
        $handoffs=@()
        $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=375;height=900;deviceScaleFactor=1;mobile=$true}
        Navigate-Page ([Uri]::new([Uri]$SiteUrl,'index.html').AbsoluteUri)
        $handoffs+=Follow-Navigation '(()=>{document.getElementById("szp-clear-basket").click();["wuzhong","gusu"].forEach(id=>document.querySelector("[data-szp-add-region="+id+"]").click());document.querySelector("[data-szp-chart-view=housing]").click();const href=window.SZP_COMPARE_BRIDGE.link(["wuzhong","gusu"],"housing");document.getElementById("szp-open-comparison").click();return href;})()'
        $two=Evaluate-Page '({selected:[...document.querySelectorAll(".region-choice[aria-pressed=true]")].map(e=>e.dataset.selectRegion).join(),housing:document.querySelector("[data-view=housing]").getAttribute("aria-selected"),groups:document.querySelectorAll("[data-compare-group]").length,width:document.documentElement.scrollWidth})'
        if($two.selected -ne 'wuzhong,gusu' -or $two.housing -ne 'true' -or $two.groups -ne 5 -or $two.width -gt 376){throw 'Two-region handoff failed.'}
        Save-Screenshot 'home-upgrade-mobile-handoff'
        $handoffs+=Follow-Navigation '(()=>{const link=document.querySelector(".szp-platform-brand");const href=link.href;link.click();return href;})()'
        $restored=Evaluate-Page 'document.querySelectorAll("[data-szp-add-region][aria-pressed=true]").length===2'
        if(-not $restored){throw 'Returning home lost the comparison basket.'}
        $handoffs+=Follow-Navigation '(()=>{["changshu","snd"].forEach(id=>document.querySelector("[data-szp-add-region="+id+"]").click());document.querySelector("[data-szp-chart-view=team]").click();const href=window.SZP_COMPARE_BRIDGE.link(["wuzhong","gusu","changshu","snd"],"team");document.getElementById("szp-open-comparison").click();return href;})()'
        $four=Evaluate-Page 'document.querySelectorAll(".region-choice[aria-pressed=true]").length===4 && document.querySelector("[data-view=team]").getAttribute("aria-selected")==="true"'
        if(-not $four){throw 'Four-region handoff failed.'}
        $handoffs+=Follow-Navigation '(()=>{const link=document.querySelector(".szp-platform-brand");const href=link.href;link.click();return href;})()'
        $handoffs+=Follow-Navigation '(()=>{const link=document.querySelector("[data-szp-record=P04] .szp-preview-boundary a");const href=link.href;link.click();return href;})()'
        $evidence=Evaluate-Page 'document.getElementById("workbook-archive").open && document.querySelector(".source-highlight")?.textContent.includes("P04")'
        if(-not $evidence){throw 'Homepage source link failed to locate Excel cell.'}
        $report=@{testedAt=[DateTimeOffset]::Now.ToString('o');viewportChecks=$enhancementChecks.ToArray();twoRegionHandoff=$two;fourRegionHandoff=$four;basketRestored=$restored;cellEvidence=$evidence;reducedMotion=$true;backToTop=$true;transitions=$handoffs}
        [IO.File]::WriteAllText((Join-Path $taskRoot 'home-enhancement-browser-report.json'),($report|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
        Write-Output 'PASS: focused homepage tests at 3 widths, 2/4-region handoffs, basket restoration, source cell, reduced motion and back-to-top.'
        return
    }
    if($VisualReview){
        $null=Send-Cdp 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion';value='reduce'})}
        foreach($reviewWidth in @(1440,375)){
            $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$reviewWidth;height=1000;deviceScaleFactor=1;mobile=($reviewWidth -lt 1100)}
            Navigate-Page ([Uri]::new([Uri]$SiteUrl,'index.html').AbsoluteUri)
            $reduced=Evaluate-Page '!document.body.classList.contains("szp-motion-enabled") && getComputedStyle(document.documentElement).scrollBehavior === "auto"'
            if(-not $reduced){throw 'Reduced-motion preference not respected.'}
            foreach($section in @('szp-policies','szp-comparison','szp-about')){
                $null=Evaluate-Page ('document.getElementById("'+$section+'").scrollIntoView({behavior:"instant"});true')
                Start-Sleep -Milliseconds 250
                Save-Screenshot ('portal-final-'+$section+'-'+$reviewWidth)
            }
            $null=Evaluate-Page 'window.scrollTo(0,0);document.querySelector(".szp-menu-toggle").click();document.querySelector(".szp-region-toggle").click();true'
            Start-Sleep -Milliseconds 150
            Save-Screenshot ('portal-final-menu-'+$reviewWidth)
        }
        $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=1440;height=1100;deviceScaleFactor=1;mobile=$false}
        Navigate-Page ([Uri]::new([Uri]$SiteUrl,'pages/政策对比.html').AbsoluteUri)
        $null=Evaluate-Page 'document.getElementById("amounts").scrollIntoView({behavior:"instant"});true'
        Save-Screenshot 'portal-final-dual-bars'
        Write-Output 'Visual screenshots captured; reduced-motion checks passed.'
        return
    }
    $views=@(@{name='desktop';width=1440;height=1100;mobile=$false},@{name='tablet';width=768;height=1050;mobile=$true},@{name='mobile';width=375;height=900;mobile=$true})
    $pages=@('index.html','pages/姑苏领军.html','pages/东吴.html','pages/姑苏区.html','pages/常熟.html','pages/昆山.html','pages/金鸡湖.html','pages/高新区.html','pages/吴江.html','pages/相城.html','pages/政策对比.html')
    $interactions=[IO.File]::ReadAllText((Join-Path $taskRoot 'portal-interactions.js'))
    $comparison=[IO.File]::ReadAllText((Join-Path $taskRoot 'comparison-interactions.js'))
    $reports=New-Object Collections.Generic.List[object]
    $navigationSignatures=@{}
    $urls=New-Object Collections.Generic.HashSet[string]
    foreach($page in $pages){
        foreach($view in $views){
            $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$view.width;height=$view.height;deviceScaleFactor=1;mobile=$view.mobile}
            Navigate-Page ([Uri]::new([Uri]$SiteUrl,$page).AbsoluteUri)
            if($page -eq 'pages/姑苏区.html'){Save-Screenshot ('portal-child-'+$view.name)}
            $checks=Evaluate-Page $interactions
            if($page -eq 'index.html'){$checks+=Evaluate-Page ([IO.File]::ReadAllText((Join-Path $taskRoot 'home-enhancement-interactions.js')))}
            if($page -eq 'pages/政策对比.html'){
                $checks+=Evaluate-Page $comparison
                $checks+=Evaluate-Page @'
(() => {
 const checks=[],check=(name,passed)=>{checks.push({name,passed});if(!passed)throw Error(name);};
 for(const id of ['startup','innovation','team','housing']){
  document.querySelector('[data-view="'+id+'"]').click();
  const rows=[...document.querySelectorAll('#amount-panel .rank-row')],expected=window.SUZHOU_MODEL.ranked(id);
  check(id+' sorting retained',rows.map(e=>e.dataset.recordId).join()===expected.map(r=>r.id).join());
  rows.forEach((row,i)=>{const r=expected[i],min=row.querySelector('.bar-min'),max=row.querySelector('.bar-max');check(r.id+' min/max bars',!!max && (r.min===null ? !min && !!row.querySelector('.bar-unavailable') : !!min));if(min&&r.min!==null){const ceiling=Math.max(1,...expected.map(a=>a.max));check(r.id+' shared min scale',Math.abs(parseFloat(min.style.width)-r.min/ceiling*100)<.001);}});
 }
 document.querySelector('[data-view="startup"]').click();
 return checks;
})()
'@
            }
            $summary=Evaluate-Page @'
(() => {
 const header=document.getElementById('szp-global-header'),local=document.querySelector('body.szp-integrated > .site-header');
 const active=[...header.querySelectorAll('[aria-current]')].map(a=>a.textContent.trim());
 const references=[...document.querySelectorAll('a[href],link[href],script[src],img[src]')].map(el=>el.href||el.src).filter(url=>url.startsWith(location.origin+'/'));
 const css=getComputedStyle(header),navLink=getComputedStyle(header.querySelector('.szp-nav-link')),inner=getComputedStyle(header.querySelector('.szp-nav-inner'));
 const navigationSignature={position:css.position,top:css.top,height:css.height,font:css.font,linkFont:navLink.font,paddingLeft:inner.paddingLeft,paddingRight:inner.paddingRight,menuOrder:[...header.querySelector('.szp-site-menu').children].map(el=>el.dataset.szpNav||'regions')};
 return {title:document.title,width:innerWidth,contentWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),badAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash),active,referenceUrls:references,navigationSignature,cardsColumns:document.querySelector('.szp-policy-grid')?getComputedStyle(document.querySelector('.szp-policy-grid')).gridTemplateColumns.split(' ').length:null,headerHeight:header.getBoundingClientRect().height,localHeaderTop:local?.getBoundingClientRect().top,localHeaderHeight:local?.getBoundingClientRect().height};
})()
'@
            foreach($url in $summary.referenceUrls){$null=$urls.Add($url.Split('#')[0])}
            $signature=$summary.navigationSignature|ConvertTo-Json -Depth 8 -Compress
            if($navigationSignatures.ContainsKey($view.name)){
                if($navigationSignatures[$view.name] -ne $signature){throw ('Navigation CSS differs: '+$page+' '+$view.name+' '+$signature)}
            }else{$navigationSignatures[$view.name]=$signature}
            if($summary.horizontalOverflow -or $summary.brokenImages.Count -or $summary.badAnchors.Count){throw ('Layout/reference failure: '+$page+' '+$view.name+' '+($summary|ConvertTo-Json -Depth 8 -Compress))}
            if($page -eq 'index.html'){
                $expectedColumns=if($view.width -eq 1440){3}elseif($view.width -eq 768){2}else{1}
                if($summary.cardsColumns -ne $expectedColumns){throw 'Homepage grid column mismatch.'}
                $null=Evaluate-Page 'window.scrollTo(0,0);true'
                Start-Sleep -Milliseconds 600
                Save-Screenshot ('portal-home-'+$view.name)
                $null=Evaluate-Page '(async()=>{document.getElementById("szp-policies").scrollIntoView({behavior:"instant"});await new Promise(r=>setTimeout(r,180));return true;})()'
                Save-Screenshot ('portal-directory-'+$view.name)
            }
            $reports.Add(@{page=$page;view=$view.name;summary=$summary;checks=$checks})
            Write-Output ($page+' '+$view.name+': '+$checks.Count+' checks passed.')
        }
    }
    $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=1440;height=1100;deviceScaleFactor=1;mobile=$false}
    Navigate-Page ([Uri]::new([Uri]$SiteUrl,'index.html').AbsoluteUri)
    $navigationTransitions=@()
    foreach($id in @('wuzhong','gusu','changshu','kunshan','sip','snd','wujiang','xiangcheng')){
        $navigationTransitions+=Follow-Navigation ('(()=>{document.querySelector(".szp-region-toggle").click();const link=document.querySelector("[data-szp-region='+$id+']");const href=link.href;link.click();return href;})()')
    }
    $navigationTransitions+=Follow-Navigation '(()=>{const link=document.querySelector("[data-szp-nav=city-policy]");const href=link.href;link.click();return href;})()'
    $navigationTransitions+=Follow-Navigation '(()=>{const link=document.querySelector(".szp-platform-brand");const href=link.href;link.click();return href;})()'
    Navigate-Page ([Uri]::new([Uri]$SiteUrl,'pages/政策对比.html').AbsoluteUri)
    $null=Evaluate-Page 'document.querySelector("[data-view=housing]").click();["wuzhong","gusu","changshu","snd"].forEach(id=>document.querySelector("[data-select-region="+id+"]").click());document.getElementById("amounts").scrollIntoView({behavior:"instant"});true'
    Save-Screenshot 'portal-comparison-desktop'
    $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=375;height=900;deviceScaleFactor=1;mobile=$true}
    $table=Evaluate-Page '(()=>{const el=document.querySelector(".comparison-scroll");el.scrollLeft=el.scrollWidth;return {tableWidth:el.clientWidth,innerWidth:el.scrollWidth,scrollLeft:el.scrollLeft,pageWidth:document.documentElement.scrollWidth};})()'
    if($table.pageWidth -gt 376 -or $table.scrollLeft -le 0){throw 'Selected comparison scrolling failure.'}
    $null=Send-Cdp 'Emulation.setEmulatedMedia' @{media='print'}
    $print=Evaluate-Page '(()=>{window.dispatchEvent(new Event("beforeprint"));return {navHidden:getComputedStyle(document.getElementById("szp-global-header")).display==="none",groupsOpen:[...document.querySelectorAll("[data-compare-group]")].every(d=>d.open),archiveClosed:!document.getElementById("workbook-archive").open};})()'
    if(-not $print.navHidden -or -not $print.groupsOpen -or -not $print.archiveClosed){throw 'Print visibility failure.'}
    $pdf=Send-Cdp 'Page.printToPDF' @{landscape=$true;printBackground=$true;preferCSSPageSize=$true}
    [IO.File]::WriteAllBytes((Join-Path $taskRoot 'portal-comparison-print.pdf'),[Convert]::FromBase64String($pdf.data))
    $null=Evaluate-Page 'window.dispatchEvent(new Event("afterprint"));true'
    $null=Send-Cdp 'Emulation.setEmulatedMedia' @{media=''}
    Navigate-Page (([Uri](Join-Path $portalRoot 'index.html')).AbsoluteUri)
    $direct=Evaluate-Page '({cards:document.querySelectorAll("[data-szp-policy]").length,menu:document.querySelectorAll("[data-szp-region]").length,broken:[...document.images].filter(i=>!i.naturalWidth).length})'
    if($direct.cards -ne 9 -or $direct.menu -ne 8 -or $direct.broken){throw 'Direct file preview failed.'}
    $null=Send-Cdp 'Emulation.setScriptExecutionDisabled' @{value=$true}
    $null=Send-Cdp 'Page.navigate' @{url=([Uri]::new([Uri]$SiteUrl,'index.html').AbsoluteUri)}
    Start-Sleep -Milliseconds 400
    $noJs=Evaluate-Page '({cards:document.querySelectorAll("[data-szp-policy]").length,readable:[...document.querySelectorAll(".szp-policy-card")].every(e=>getComputedStyle(e).opacity==="1"),link:document.querySelector("[data-szp-policy]").href})'
    if($noJs.cards -ne 9 -or -not $noJs.readable){throw 'No-JavaScript progressive enhancement failed.'}
    $null=Send-Cdp 'Emulation.setScriptExecutionDisabled' @{value=$false}
    $references=@()
    foreach($url in $urls){$result=Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing;$references+=@{url=$url;status=$result.StatusCode}}
    $errors=@($script:events | Where-Object {$_.method -eq 'Runtime.exceptionThrown' -or ($_.method -eq 'Log.entryAdded' -and $_.params.entry.level -eq 'error') -or ($_.method -eq 'Runtime.consoleAPICalled' -and $_.params.type -eq 'error')})
    if($errors.Count){throw ('Browser console errors: '+($errors|ConvertTo-Json -Depth 10 -Compress))}
    $report=@{testedAt=[DateTimeOffset]::Now.ToString('o');siteUrl=$SiteUrl;pageViewportChecks=$reports.Count;results=$reports.ToArray();localHttpReferences=$references;navigationTransitions=$navigationTransitions;uniformNavigation=$true;selectedTable=$table;print=$print;directFile=$direct;noJavaScript=$noJs;browserErrors=$errors}
    [IO.File]::WriteAllText((Join-Path $taskRoot 'portal-browser-report.json'),($report|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
    Write-Output ('PASS: '+$reports.Count+' page/viewport checks, '+$references.Count+' HTTP references, print PDF and direct-file/no-JS checks.')
} finally {
    if($script:socket){try{$null=Send-Cdp 'Browser.close'}catch{};$script:socket.Dispose()}
    if($browser){try{if(-not $browser.WaitForExit(3000)){Stop-Process -Id $browser.Id -Force}}catch{}}
}
