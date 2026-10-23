'use strict';
// Local browser verification against the real MySQL database and authentication APIs.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const checksRoot = __dirname;
const profile = path.join(checksRoot, 'policy-auth-profile-' + Date.now());
fs.mkdirSync(profile);
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-extensions',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, sequence = 0;
const pending = new Map(), events = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function navigate(url) {
  await send('Page.navigate', { url });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate('document.readyState === "complete" && document.querySelector("[data-auth-form]")?.dataset.authReady === "true"')) break;
    await delay(80);
  }
  if (!await evaluate('document.querySelector("[data-auth-form]")?.dataset.authReady === "true"')) throw new Error('Page failed to initialize: ' + url);
  await evaluate('(async()=>{await document.fonts.ready;return true})()');
}
async function screenshot(name) {
  const metrics = await send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
  fs.writeFileSync(path.join(checksRoot, name + '.png'), Buffer.from(shot.data, 'base64'));
}
(async () => {
  let fixture;
  try {
    const suffix = require('node:crypto').randomBytes(6).toString('hex');
    const values = {username:'ui_'+suffix,email:'ui_'+suffix+'@example.invalid',password:require('node:crypto').randomBytes(16).toString('hex')};
    const applicationRoot=path.resolve(checksRoot,'../全市政策');
    const config=require(path.join(applicationRoot,'server/config/env')).loadServerConfig();
    if(config.production) throw new Error('Browser QA requires a development database.');
    const {createPool,verifyAuthDatabase}=require(path.join(applicationRoot,'server/config/db'));
    const pool=createPool(config);
    let server,authentication;
    fixture={pool,async close(){
      try {
        if(server) await new Promise(resolve=>server.close(resolve));
        if(authentication) await authentication.store.close();
        await pool.execute("UPDATE users SET status='disabled' WHERE username=? AND email=?",[values.username,values.email]);
      } finally {await pool.end();}
    }};
    await verifyAuthDatabase(pool);
    server=require('node:http').createServer();
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    fixture.base='http://127.0.0.1:'+server.address().port;
    const testConfig={...config,origin:fixture.base};
    authentication=await require(path.join(applicationRoot,'server/services/authentication')).createAuthentication(pool,testConfig);
    server.on('request',require(path.join(applicationRoot,'server/backend-app')).createBackendApp({pool,config:testConfig,authentication}));
    const portFile = path.join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(portFile) && Date.now() < deadline) await delay(100);
    if (!fs.existsSync(portFile)) throw new Error('Edge did not start');
    const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    socket = new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
    socket.addEventListener('message', event=>{const reply=JSON.parse(event.data);if(!reply.id){events.push(reply);return;}const waiter=pending.get(reply.id);if(!waiter)return;clearTimeout(waiter.timer);pending.delete(reply.id);if(reply.error)waiter.reject(new Error(JSON.stringify(reply.error)));else waiter.resolve(reply.result);});
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await send('Emulation.setDeviceMetricsOverride',{width:375,height:960,deviceScaleFactor:1,mobile:true});
    async function until(expression){for(let n=0;n<150;n++){if(await evaluate(expression))return;await delay(70);}throw new Error('Browser condition failed: '+expression);}
    async function fill(fields){await evaluate('(function(){const f=document.querySelector("[data-auth-form]");for(const[n,v]of Object.entries('+JSON.stringify(fields)+')){f.elements[n].value=v;f.elements[n].dispatchEvent(new Event("input",{bubbles:true}));}f.requestSubmit();return true})()');}
    const checks = [];
    const check = (name, passed) => { checks.push({name,passed:!!passed}); if(!passed) throw new Error('Policy browser check failed: '+name); };
    async function navigatePolicy(url) {
      await send('Page.navigate',{url});
      await until('document.readyState==="complete"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")&&!!document.getElementById("szp-session-tools")&&!document.documentElement.classList.contains("szp-session-checking")');
      await evaluate('(async()=>{document.documentElement.style.scrollBehavior="auto";await document.fonts.ready;await new Promise(r=>setTimeout(r,140));return true})()');
    }
    await send('Log.enable');
    await navigate(fixture.base+'/');
    check('Unauthenticated root redirects to login',await evaluate('location.pathname==="/login"'));
    await navigate(fixture.base+'/pages/'+encodeURIComponent('昆山.html'));
    check('Direct policy page redirects to login',await evaluate('location.pathname==="/login"'));
    await navigate(fixture.base+'/register');
    await fill({...values,confirmPassword:values.password});
    await until('!document.getElementById("auth-success").hidden');
    const [[registered]]=await pool.execute('SELECT id,username,password_hash FROM users WHERE username=?',[values.username]);
    check('Registration stores real bcrypt hash',registered.username===values.username&&await require(path.join(applicationRoot,'node_modules/bcrypt')).compare(values.password,registered.password_hash));
    await navigate(fixture.base+'/login?returnTo='+encodeURIComponent('//outside.invalid'));
    await fill({identifier:values.username,password:values.password});
    await until('location.pathname==="/index.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")&&!!document.getElementById("szp-session-tools")');
    check('Login enters original homepage with safe redirect',await evaluate('location.pathname==="/index.html"&&document.getElementById("szp-session-name").textContent==='+JSON.stringify(values.username)));
    const cookies=await send('Network.getAllCookies');
    check('Cookie is HttpOnly and SameSite Lax',cookies.cookies.some(c=>c.name==='szp.sid'&&c.httpOnly&&c.sameSite==='Lax'));
    check('Session is not stored in localStorage',await evaluate('!document.cookie.includes("szp.sid")&&!Object.keys(localStorage).some(k=>/password|session|token/i.test(k))'));
    const pageNames=['index.html','pages/姑苏领军.html','pages/东吴.html','pages/姑苏区.html','pages/常熟.html','pages/昆山.html','pages/金鸡湖.html','pages/高新区.html','pages/吴江.html','pages/相城.html','pages/政策对比.html'];
    const regressionEventsStart=events.length;
    const groups=[];
    for(const width of [1440,768,375]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<1100});
      for(const page of pageNames) {
        await navigatePolicy(fixture.base+'/'+page.split('/').map(encodeURIComponent).join('/'));
        let local;
        try {
          // A disabled no-store stylesheet may be fetched again on re-enable; wait for layout.
          const interactions=fs.readFileSync(path.join(checksRoot,'portal-interactions.js'),'utf8')
            .replace('sharedStyles.disabled=false;header.hidden=false;', 'sharedStyles.disabled=false;header.hidden=false;await new Promise(r=>setTimeout(r,250));');
          local=await evaluate(interactions);
        } catch(error) {
          console.log(JSON.stringify({failedPage:page,width,geometry:await evaluate('(()=>{const h=document.getElementById("szp-global-header"),a=document.querySelector("body > .site-header nav a[href^=\\\"#\\\"]"),t=a&&document.querySelector(a.getAttribute("href"));return {scrollY,headerHeight:h?.getBoundingClientRect().height,anchorTop:t?.getBoundingClientRect().top,scrollMargin:t&&getComputedStyle(t).scrollMarginTop}})()')}));
          throw error;
        }
        local.forEach(item=>check(width+' '+page+' '+item.name,item.passed));
        check(width+' '+page+' viewport does not overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        check(width+' '+page+' current account controls',await evaluate('document.getElementById("szp-session-name").textContent==='+JSON.stringify(values.username)));
        if(page==='index.html') {
          await evaluate('document.activeElement?.blur();true');
          const home=await evaluate(fs.readFileSync(path.join(checksRoot,'home-enhancement-interactions.js'),'utf8'));
          home.forEach(item=>check(width+' homepage '+item.name,item.passed));
        }
        if(page==='pages/政策对比.html') {
          const comparison=await evaluate(fs.readFileSync(path.join(checksRoot,'comparison-interactions.js'),'utf8'));
          comparison.forEach(item=>check(width+' comparison '+item.name,item.passed));
        }
        groups.push({page,width,passed:true});
        if((page==='index.html'&&width!==768)||(page==='pages/政策对比.html'&&width===375)) {
          await evaluate('window.scrollTo({top:0,behavior:"instant"});true');
          const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          fs.writeFileSync(path.join(checksRoot,'policy-auth-'+(page==='index.html'?'home':'compare')+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
        }
      }
      console.log(JSON.stringify({width,pagesChecked:pageNames.length,checksPassed:checks.length}));
    }
    const faults=events.slice(regressionEventsStart).filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Log.entryAdded'&&e.params.entry.level==='error'&&['security','javascript'].includes(e.params.entry.source));
    check('Original pages have no JavaScript or CSP errors',faults.length===0);
    const failedResources=events.slice(regressionEventsStart).filter(e=>e.method==='Network.responseReceived'&&e.params.response.status>=400);
    check('Original page resources return successful responses',failedResources.length===0);
    await navigatePolicy(fixture.base+'/index.html');
    await evaluate('document.getElementById("szp-clear-basket").click();["wuzhong","gusu"].forEach(id=>document.querySelector("[data-szp-add-region="+id+"]").click());document.getElementById("szp-open-comparison").click();true');
    await until('decodeURIComponent(location.pathname)==="/pages/政策对比.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    const handoff = await evaluate('({url:location.href,selected:[...document.querySelectorAll(".region-choice[aria-pressed=true]")].map(e=>e.dataset.selectRegion).sort().join(),all:[...document.querySelectorAll("[data-select-region]")].map(e=>({id:e.dataset.selectRegion,pressed:e.getAttribute("aria-pressed")}))})');
    check('Two-region basket hands off to comparison',handoff.selected==='gusu,wuzhong');
    await evaluate('document.querySelector("[data-szp-nav=home]").click();true');
    await until('location.pathname==="/index.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    check('Home return retains basket',await evaluate('document.querySelectorAll("[data-szp-add-region][aria-pressed=true]").length===2'));
    await evaluate('["changshu","kunshan"].forEach(id=>document.querySelector("[data-szp-add-region="+id+"]").click());document.getElementById("szp-open-comparison").click();true');
    await until('decodeURIComponent(location.pathname)==="/pages/政策对比.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    check('Four-region basket hands off to comparison',await evaluate('document.querySelectorAll(".region-choice[aria-pressed=true]").length===4'));
    const districts=['wuzhong','gusu','changshu','kunshan','sip','snd','wujiang','xiangcheng'];
    for(const district of districts) {
      const destination=await evaluate('(()=>{const link=document.querySelector("[data-szp-region='+district+']");const target=link.href;link.click();return target})()');
      await until('location.href==='+JSON.stringify(destination)+'&&document.readyState==="complete"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
      check('Shared navigation reaches '+district,await evaluate('document.querySelector("[data-szp-region='+district+']").getAttribute("aria-current")==="page"'));
    }
    await evaluate('document.querySelector("[data-szp-nav=city-policy]").click();true');
    await until('decodeURIComponent(location.pathname)==="/pages/姑苏领军.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    check('Shared navigation reaches city policy',await evaluate('document.querySelector("[data-szp-nav=city-policy]").getAttribute("aria-current")==="page"'));
    await navigatePolicy(fixture.base+'/index.html');
    const sourceDestination=await evaluate('(()=>{document.querySelector("[data-szp-chart-view=housing]").click();return document.querySelector("[data-szp-record=P29] .szp-preview-boundary a").href})()');
    await navigatePolicy(sourceDestination);
    const citation=await evaluate('({url:location.href,open:document.getElementById("workbook-archive").open,highlight:[...document.querySelectorAll(".source-highlight")].map(e=>({id:e.id,text:e.textContent})),picker:document.getElementById("workbook-sheet").value,refs:[...document.querySelectorAll("[data-source-sheet][data-source-cell]")].filter(e=>e.dataset.sourceCell==="A34").map(e=>({sheet:e.dataset.sourceSheet,cell:e.dataset.sourceCell}))})');
    check('Workbook citation locates original cell',citation.open&&citation.highlight.some(e=>e.id==='cell-7-A34'));
    const documents=fs.readdirSync(path.join(applicationRoot,'苏州人才政策')).filter(f=>/\.(docx|xlsx)$/i.test(f));
    for(const file of documents) {
      const downloaded=await evaluate('(async()=>{const r=await fetch('+JSON.stringify('/'+encodeURIComponent(file))+',{credentials:"same-origin",cache:"no-store"});const bytes=new Uint8Array(await r.arrayBuffer());return {status:r.status,size:bytes.length,signature:[...bytes.slice(0,4)].join(),disposition:r.headers.get("content-disposition")}})()');
      check('Authenticated original download '+file,downloaded.status===200&&downloaded.size===fs.statSync(path.join(applicationRoot,'苏州人才政策',file)).size&&downloaded.signature==='80,75,3,4'&&downloaded.disposition.startsWith('attachment;'));
    }
    await send('Page.navigate',{url:fixture.base+'/account'});
    await until('document.readyState==="complete"&&document.body.dataset.accountReady==="true"');
    check('Account page shows current user',await evaluate('document.getElementById("account-username").textContent==='+JSON.stringify(values.username)));
    await evaluate('document.getElementById("account-home").click();true');
    await until('location.pathname==="/index.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    check('Account page returns to policy homepage',await evaluate('location.pathname==="/index.html"'));
    await evaluate('window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"});true');
    const footerShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(checksRoot,'policy-auth-footer-375.png'),Buffer.from(footerShot.data,'base64'));
    await send('Emulation.setScriptExecutionDisabled',{value:true});
    await send('Page.navigate',{url:fixture.base+'/index.html'});
    await until('document.readyState==="complete"');
    check('Server authorizes with JavaScript disabled',await evaluate('location.pathname==="/index.html"&&document.querySelectorAll("[data-szp-policy]").length===9'));
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    await navigatePolicy(fixture.base+'/index.html');
    await evaluate('document.getElementById("szp-session-logout").click();true');
    await until('location.pathname==="/login"&&document.querySelector("[data-auth-form]")?.dataset.authReady==="true"');
    check('Footer logout returns to login',await evaluate('location.pathname==="/login"'));
    const [[remaining]]=await pool.execute('SELECT COUNT(*) AS total FROM user_sessions WHERE user_id=?',[registered.id]);
    check('Logout removes database session',Number(remaining.total)===0);
    check('Current user API returns 401 after logout',await evaluate('(async()=>{const r=await fetch("/api/auth/me");return r.status===401&&(await r.json()).code==="AUTH_REQUIRED"})()'));
    for(const file of documents) check('Logout prevents download '+file,await evaluate('(async()=>{const r=await fetch('+JSON.stringify('/'+encodeURIComponent(file))+');return r.status===401&&(await r.json()).code==="AUTH_REQUIRED"})()'));
    check('Logout prevents source data download',await evaluate('(async()=>{const r=await fetch("/data/portal-data.json");return r.status===401})()'));
    await navigate(fixture.base+'/pages/'+encodeURIComponent('政策对比.html'));
    check('Logout protects comparison page',await evaluate('location.pathname==="/login"'));
    await evaluate('history.back();true');
    await until('location.pathname==="/login"&&document.readyState==="complete"');
    check('History back cannot restore an authorized policy view',await evaluate('!document.querySelector(".szp-navigation-ready")'));
    await send('Emulation.setScriptExecutionDisabled',{value:true});
    await send('Page.navigate',{url:fixture.base+'/index.html'});
    await until('document.readyState==="complete"&&location.pathname==="/login"');
    check('Server rejects unauthenticated homepage with JavaScript disabled',await evaluate('!document.getElementById("szp-global-header")'));
    await send('Emulation.setScriptExecutionDisabled',{value:false});
    await navigate(fixture.base+'/login');
    await fill({identifier:values.email.toUpperCase(),password:values.password});
    await until('location.pathname==="/index.html"&&document.readyState==="complete"&&!!document.querySelector(".szp-navigation-ready")');
    check('Email login also enters original homepage',await evaluate('location.pathname==="/index.html"'));
    await evaluate('document.getElementById("szp-session-logout").click();true');
    await until('location.pathname==="/login"&&document.querySelector("[data-auth-form]")?.dataset.authReady==="true"');
    const result={verifiedAt:new Date().toISOString(),mysqlVerified:true,sqlTestDouble:false,checksPassed:checks.length,pageWidthGroups:groups.length,groups,checks};
    fs.writeFileSync(path.join(checksRoot,'policy-auth-browser-report.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({mysqlVerified:true,checksPassed:checks.length,pageWidthGroups:groups.length}));
  } finally {
    if(socket?.readyState===WebSocket.OPEN){await send('Browser.close').catch(()=>{});socket.close();}
    browser.kill();if(fixture)await fixture.close();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1});
