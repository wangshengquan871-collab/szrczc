param([string]$PageUrl,[switch]$IntegrationReview,[switch]$RegistrationReview)
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
function Navigate-Auth {
    param([string]$Url)
    $null=Send-Cdp 'Page.navigate' @{url=$Url}
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    do { Start-Sleep -Milliseconds 120; $ready=Evaluate-Page 'document.readyState === "complete" && !!document.querySelector("[data-szpa-reveal]:not([hidden])")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
    if(-not $ready){throw 'Auth page did not finish loading.'}
    $null=Evaluate-Page '(async()=>{await document.fonts.ready;return true})()'
}
try {
    if(-not $PageUrl){$PageUrl=([Uri](Join-Path $taskRoot '..\全市政策\登录注册.html')).AbsoluteUri}
    $arguments=@('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--remote-debugging-port=0','--allow-file-access-from-files',('--user-data-dir="'+$profilePath+'"'),'about:blank')
    $browser=Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot ('edge-auth-'+$runTag+'.stdout.log')) -RedirectStandardError (Join-Path $taskRoot ('edge-auth-'+$runTag+'.stderr.log'))
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    $portFile=Join-Path $profilePath 'DevToolsActivePort'
    while(-not(Test-Path -LiteralPath $portFile)){if([DateTime]::UtcNow -gt $deadline){throw 'Edge DevTools launch failed.'};Start-Sleep -Milliseconds 150}
    $port=(Get-Content -LiteralPath $portFile)[0]
    $targets=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+'/json/list')
    $target=@($targets | Where-Object type -eq 'page')[0]
    $script:socket=[Net.WebSockets.ClientWebSocket]::new()
    $script:socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $null=Send-Cdp 'Page.enable'; $null=Send-Cdp 'Runtime.enable'; $null=Send-Cdp 'Log.enable'
    $null=Send-Cdp 'Page.bringToFront'; $null=Send-Cdp 'Emulation.setFocusEmulationEnabled' @{enabled=$true}
    $null=Send-Cdp 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion';value='reduce'})}
    $reports=@()
    if($RegistrationReview){
        $registerUrl='http://127.0.0.1:5529/register?returnTo='+[Uri]::EscapeDataString('/pages/昆山.html')
        $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=1440;height=1050;deviceScaleFactor=1;mobile=$false}
        $null=Send-Cdp 'Emulation.setScriptExecutionDisabled' @{value=$true}
        $null=Send-Cdp 'Page.navigate' @{url=$registerUrl}
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page 'document.readyState==="complete" && !!document.getElementById("szpa-register-form")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'Registration without JS failed to load.'}
        $noJs=Evaluate-Page 'document.getElementById("szpa-form-title").textContent==="创建账户" && !document.getElementById("szpa-register-form").hidden && document.getElementById("szpa-login-form").hidden && document.querySelector("[data-szpa-mode=login]").getAttribute("href").startsWith("/login")'
        if(-not $noJs){throw 'Server did not render registration initially.'}
        $null=Send-Cdp 'Emulation.setScriptExecutionDisabled' @{value=$false}
        foreach($viewWidth in @(1440,768,375)){
            $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$viewWidth;height=1050;deviceScaleFactor=1;mobile=($viewWidth -le 768)}
            Navigate-Auth $registerUrl
            Save-Screenshot ('register-direct-'+$viewWidth)
            $checks=Evaluate-Page ([IO.File]::ReadAllText((Join-Path $taskRoot 'register-browser-interactions.js')))
            $reports+=@{width=$viewWidth;checks=$checks}
        }
        Save-Screenshot 'register-success-mobile'
        $null=Evaluate-Page 'document.getElementById("szpa-password").value="FixturePassword123";document.getElementById("szpa-login-form").requestSubmit();true'
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page 'decodeURIComponent(location.pathname)==="/pages/昆山.html" && !!document.getElementById("szpa-account")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'Newly registered fixture account could not log in.'}
        $profile=Evaluate-Page 'document.querySelector(".szpa-account-name").textContent'
        if($profile -ne 'registered-ui'){throw 'Wrong account after registration.'}
        $errors=@($script:events | Where-Object {$_.method -eq 'Runtime.exceptionThrown'})
        if($errors.Count){throw ('Registration browser exception: '+($errors|ConvertTo-Json -Depth 10 -Compress))}
        [IO.File]::WriteAllText((Join-Path $taskRoot 'register-browser-report.json'),(@{viewports=$reports;noJsRegistration=$noJs;newAccountLogin=$true;mysqlVerified=$false;errors=$errors}|ConvertTo-Json -Depth 15),[Text.UTF8Encoding]::new($false))
        Write-Output 'PASS: direct /register at 1440/768/375, initial server HTML, validation, duplicates, success and new-account login; MySQL not verified.'
        return
    }
    if($IntegrationReview){
        $siteUrl='http://127.0.0.1:5529/'
        Navigate-Auth ($siteUrl+'login')
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page '!document.getElementById("szpa-remember").disabled' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'Auth fixture CSRF did not load.'}
        $null=Evaluate-Page 'document.getElementById("szpa-identifier").value="browseruser";document.getElementById("szpa-password").value="FixturePassword123";document.getElementById("szpa-login-form").requestSubmit();true'
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 120; $ready=Evaluate-Page '!!document.getElementById("szpa-account")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'Fixture UI login failed.'}
        foreach($viewWidth in @(1440,768,375)){
            $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$viewWidth;height=1050;deviceScaleFactor=1;mobile=($viewWidth -le 768)}
            foreach($page in @('index.html','pages/金鸡湖.html','pages/政策对比.html')){
                $null=Send-Cdp 'Page.navigate' @{url=([Uri]::new([Uri]$siteUrl,$page).AbsoluteUri)}
                $deadline=[DateTime]::UtcNow.AddSeconds(15)
                do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page 'document.readyState==="complete" && !!document.getElementById("szpa-account") && !!document.querySelector(".szp-navigation-ready")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
                if(-not $ready){throw ('Protected page load failed: '+$page)}
                $layout=Evaluate-Page '({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,visible:getComputedStyle(document.body).visibility,name:document.querySelector(".szpa-account-name").textContent})'
                if($layout.scrollWidth -gt ($viewWidth+1) -or $layout.visible -eq 'hidden' -or $layout.name -ne 'browseruser'){throw ('Account integration layout failed: '+($layout|ConvertTo-Json -Compress))}
                if($viewWidth -le 768){$null=Evaluate-Page 'document.querySelector(".szp-menu-toggle").click();document.querySelector(".szp-region-toggle").click();true'}
                Save-Screenshot ('auth-protected-'+($page -replace '[^a-zA-Z]','')+'-'+$viewWidth)
                $reports+=@{width=$viewWidth;page=$page;layout=$layout}
            }
        }
        $null=Evaluate-Page 'document.querySelector(".szp-menu-toggle").click();true'
        $comparison=Evaluate-Page ([IO.File]::ReadAllText((Join-Path $taskRoot 'comparison-interactions.js')))
        if(@($comparison | Where-Object {-not $_.passed}).Count){throw 'Comparison regression failed with auth layer.'}
        $null=Evaluate-Page 'document.querySelector(".szp-menu-toggle").click();document.querySelector(".szpa-account-logout").click();true'
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page 'location.pathname==="/login" && !!document.getElementById("szpa-login-form")' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'UI logout failed.'}
        $denied=Evaluate-Page '(async()=>{const r=await fetch("/pages/政策对比资源/policy-data.js");return r.status===401;})()'
        if(-not $denied){throw 'Policy data exposed after logout.'}
        $null=Evaluate-Page 'document.querySelector("[data-szpa-mode=register]").click();true'
        $null=Evaluate-Page 'document.getElementById("szpa-username").value="browsernew";document.getElementById("szpa-email").value="new@example.com";document.getElementById("szpa-new-password").value="FixturePassword123";document.getElementById("szpa-confirm-password").value="FixturePassword123";document.getElementById("szpa-register-form").requestSubmit();true'
        $deadline=[DateTime]::UtcNow.AddSeconds(15)
        do { Start-Sleep -Milliseconds 100; $ready=Evaluate-Page '!document.getElementById("szpa-success").hidden' } while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if(-not $ready){throw 'UI registration fixture failed.'}
        [IO.File]::WriteAllText((Join-Path $taskRoot 'auth-integration-browser-report.json'),(@{viewports=$reports;comparison=$comparison;logout=$true;registration=$true;mysqlVerified=$false}|ConvertTo-Json -Depth 15),[Text.UTF8Encoding]::new($false))
        Write-Output 'PASS: fixture UI login/register/logout, 9 protected viewport checks, comparison interactions; MySQL not verified.'
        return
    }
    foreach($viewWidth in @(1440,768,375)){
        $null=Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$viewWidth;height=960;deviceScaleFactor=1;mobile=($viewWidth -le 768)}
        Navigate-Auth $PageUrl
        $checks=Evaluate-Page ([IO.File]::ReadAllText((Join-Path $taskRoot 'auth-browser-interactions.js')))
        Navigate-Auth $PageUrl
        $null=Evaluate-Page 'window.scrollTo(0,0);true'
        Save-Screenshot ('auth-login-'+$viewWidth)
        $null=Evaluate-Page 'document.querySelector("[data-szpa-mode=register]").click();window.scrollTo(0,0);true'
        Save-Screenshot ('auth-register-'+$viewWidth)
        $reports+=@{width=$viewWidth;checks=$checks}
    }
    $errors=@($script:events | Where-Object {$_.method -eq 'Runtime.exceptionThrown'})
    if($errors.Count){throw ('Browser exceptions: '+($errors|ConvertTo-Json -Depth 10 -Compress))}
    [IO.File]::WriteAllText((Join-Path $taskRoot 'auth-browser-report.json'),(@{viewports=$reports;errors=$errors;mysqlVerified=$false}|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
    Write-Output 'PASS: login/register at 1440, 768, 375; labels, reveal, errors, keyboard focus, reduced motion and preview state.'
} finally {
    if($script:socket){try{$null=Send-Cdp 'Browser.close'}catch{};$script:socket.Dispose()}
    if($browser){try{if(-not $browser.WaitForExit(3000)){Stop-Process -Id $browser.Id -Force}}catch{}}
}
