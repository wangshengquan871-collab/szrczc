'use strict';
// Local browser verification against the real MySQL database and authentication APIs.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const checksRoot = __dirname;
const profile = path.join(checksRoot, 'auth-ui-profile-' + Date.now());
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
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await send('Emulation.setDeviceMetricsOverride',{width:375,height:960,deviceScaleFactor:1,mobile:true});
    async function until(expression){for(let n=0;n<150;n++){if(await evaluate(expression))return;await delay(70);}throw new Error('Browser condition failed: '+expression);}
    async function fill(fields){await evaluate('(function(){const f=document.querySelector("[data-auth-form]");for(const[n,v]of Object.entries('+JSON.stringify(fields)+')){f.elements[n].value=v;f.elements[n].dispatchEvent(new Event("input",{bubbles:true}));}f.requestSubmit();return true})()');}
    const report = {};
    await navigate(fixture.base+'/register');
    await fill({...values,confirmPassword:values.password});
    await until('!document.getElementById("auth-success").hidden');
    const [[registered]]=await pool.execute('SELECT id,username,password_hash FROM users WHERE username=?',[values.username]);
    report.registration=registered.username===values.username&&registered.password_hash!==values.password&&await require(path.join(applicationRoot,'node_modules/bcrypt')).compare(values.password,registered.password_hash);
    await screenshot('auth-mysql-register-375');
    await navigate(fixture.base+'/register');
    await fill({...values,confirmPassword:values.password});
    await until('document.querySelector("[data-auth-form]").getAttribute("aria-busy")==="false"');
    report.duplicate=await evaluate('!document.getElementById("auth-summary").hidden&&document.getElementById("auth-username").getAttribute("aria-invalid")==="true"&&document.getElementById("auth-email").getAttribute("aria-invalid")==="true"');
    await navigate(fixture.base+'/login');
    await fill({identifier:values.username,password:'incorrect_'+suffix});
    await until('document.querySelector("[data-auth-form]").getAttribute("aria-busy")==="false"');
    report.wrongPassword=await evaluate('!document.getElementById("auth-summary").hidden&&document.getElementById("auth-summary").textContent.includes("不正确")&&location.pathname==="/login"');
    await fill({identifier:values.username,password:values.password});
    await until('document.body.dataset.accountReady==="true"&&location.pathname==="/account"');
    report.login=await evaluate('document.getElementById("account-username").textContent==='+JSON.stringify(values.username));
    const me=await evaluate('(async()=>{const r=await fetch("/api/auth/me",{credentials:"same-origin"});const b=await r.json();return {status:r.status,user:b.user}})()');
    report.me=me.status===200&&me.user.username===values.username&&!('password_hash'in me.user);
    const cookies=await send('Network.getAllCookies');
    report.cookie=cookies.cookies.some(cookie=>cookie.name==='szp.sid'&&cookie.httpOnly&&cookie.sameSite==='Lax');
    report.noClientStorage=await evaluate('!document.cookie.includes("szp.sid")&&localStorage.length===0');
    for(const width of [1440,768,375]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<=768});
      await screenshot('auth-mysql-account-'+width);
      report['layout'+width]=await evaluate('document.documentElement.scrollWidth<=innerWidth+1&&!document.getElementById("account-details").hidden');
    }
    await evaluate('document.getElementById("account-logout").click();true');
    await until('location.pathname==="/login"&&document.querySelector("[data-auth-form]")?.dataset.authReady==="true"');
    const [[remaining]]=await pool.execute('SELECT COUNT(*) AS total FROM user_sessions WHERE user_id=?',[registered.id]);
    report.logout=Number(remaining.total)===0;
    report.meAfterLogout=await evaluate('(async()=>{const r=await fetch("/api/auth/me");return r.status===401})()');
    await navigate(fixture.base+'/account');
    report.accountProtected=await evaluate('location.pathname==="/login"');
    await fill({identifier:values.email.toUpperCase(),password:values.password});
    await until('document.body.dataset.accountReady==="true"&&location.pathname==="/account"');
    report.emailLogin=await evaluate('document.getElementById("account-email").textContent==='+JSON.stringify(values.email));
    await evaluate('document.getElementById("account-logout").click();true');
    await until('location.pathname==="/login"&&document.querySelector("[data-auth-form]")?.dataset.authReady==="true"');
    const exceptions=events.filter(event=>event.method==='Runtime.exceptionThrown');
    report.noExceptions=exceptions.length===0;
    const failed=Object.entries(report).filter(([,value])=>!value);
    if(failed.length)throw new Error('Connected browser validation failed: '+JSON.stringify(failed));
    fs.writeFileSync(path.join(checksRoot,'auth-mysql-browser-report.json'),JSON.stringify({checks:report,verifiedAt:new Date().toISOString(),mysqlVerified:true,sqlTestDouble:false,realBcrypt:true,realMySQLSessionAdapter:true},null,2));
    console.log(JSON.stringify({checks:Object.keys(report).length,passed:true,mysqlVerified:true}));
  } finally {
    if(socket?.readyState===WebSocket.OPEN){await send('Browser.close').catch(()=>{});socket.close();}
    browser.kill();if(fixture)await fixture.close();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1});
