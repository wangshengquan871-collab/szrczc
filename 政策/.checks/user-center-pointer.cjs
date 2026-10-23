'use strict';
// Real browser input, real MySQL and the production application code; no DOM .click().
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const applicationRoot = path.resolve(__dirname, '../全市政策');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], events = [], pending = new Map();
let sequence = 0, socket, browser, fixture;
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw new Error('Pointer regression failed: ' + name);
}
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
  if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
  return result.result.value;
}
async function until(expression, navigationStart = null) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const navigated = navigationStart === null || events.slice(navigationStart).some(event => event.method === 'Page.frameNavigated' && !event.params.frame.parentId);
    if (navigated && await evaluate(expression)) return;
    await delay(60);
  }
  throw new Error('Browser condition failed: ' + expression);
}
async function navigate(route, condition) {
  await send('Page.navigate', { url: fixture.base + route });
  await until('document.readyState === "complete" && (' + condition + ')');
  await evaluate('(async()=>{await document.fonts.ready;return true})()');
}
const policyReady = '!!document.getElementById("szp-user-center") && !document.getElementById("szp-user-center").hidden && !document.documentElement.classList.contains("szp-session-checking")';
const authReady = 'document.querySelector("[data-auth-form]")?.dataset.authReady === "true"';
async function input(selector, touch = false) {
  const point = await evaluate('(()=>{const e=document.querySelector(' + JSON.stringify(selector) + ');if(!e) return null;const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(x,y))}})()');
  check('Visible input target: ' + selector, point && point.width > 0 && point.height > 0 && point.hit);
  if (touch) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }
  await delay(80);
}
async function key(key, code, value) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: value, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: value });
}
async function fill(fields) {
  // Form values can be set by the test, but every activation uses trusted browser input.
  await evaluate('(()=>{const f=document.querySelector("[data-auth-form]");for(const [n,v] of Object.entries(' + JSON.stringify(fields) + ')){f.elements[n].value=v;f.elements[n].dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
  await input('[data-auth-form] button[type="submit"]');
}
async function trace() {
  await evaluate('(()=>{window.__pointerTrace=[];for(const type of ["pointerdown","mousedown","focusout","focusin","mouseup","click"]){document.addEventListener(type,e=>{window.__pointerTrace.push({type,target:e.target.id||e.target.className,related:e.relatedTarget&&(e.relatedTarget.id||e.relatedTarget.className),active:document.activeElement.id||document.activeElement.tagName,hidden:document.getElementById("szp-user-panel")?.hidden});},{capture:true});}return true})()');
}
(async () => {
  try {
    const config = require(path.join(applicationRoot, 'server/config/env')).loadServerConfig();
    if (config.production) throw new Error('This local QA script requires development mode.');
    const { createPool, verifyAuthDatabase } = require(path.join(applicationRoot, 'server/config/db'));
    const pool = createPool(config);
    const suffix = crypto.randomBytes(6).toString('hex');
    const values = { username: 'pointer_' + suffix, email: 'pointer_' + suffix + '@example.invalid', password: crypto.randomBytes(16).toString('hex') };
    let server, authentication;
    fixture = { pool, async close() {
      try {
        if (server) await new Promise(resolve => server.close(resolve));
        if (authentication) await authentication.store.close();
        await pool.execute("UPDATE users SET status='disabled' WHERE username=? AND email=?", [values.username, values.email]);
      } finally { await pool.end(); }
    } };
    await verifyAuthDatabase(pool);
    check('Real MySQL users and sessions schema is available', true);
    server = http.createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    fixture.base = 'http://127.0.0.1:' + server.address().port;
    const testConfig = { ...config, origin: fixture.base };
    authentication = await require(path.join(applicationRoot, 'server/services/authentication')).createAuthentication(pool, testConfig);
    server.on('request', require(path.join(applicationRoot, 'server/backend-app')).createBackendApp({ pool, config: testConfig, authentication }));
    const profile = path.join(__dirname, 'pointer-profile-' + Date.now());
    fs.mkdirSync(profile);
    browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-extensions',
      '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
    ], { windowsHide: true, stdio: 'ignore' });
    const portFile = path.join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(portFile) && Date.now() < deadline) await delay(100);
    if (!fs.existsSync(portFile)) throw new Error('Edge did not start.');
    const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    socket.addEventListener('message', event => {
      const reply = JSON.parse(event.data);
      if (!reply.id) { events.push(reply); return; }
      const waiter = pending.get(reply.id);
      if (!waiter) return;
      clearTimeout(waiter.timer); pending.delete(reply.id);
      if (reply.error) waiter.reject(new Error(JSON.stringify(reply.error))); else waiter.resolve(reply.result);
    });
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    for (const name of ['Page', 'Runtime', 'Network', 'Log']) await send(name + '.enable');
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await navigate('/register', authReady);
    await fill({ ...values, confirmPassword: values.password });
    await until('!document.getElementById("auth-success").hidden');
    const [[registered]] = await pool.execute('SELECT id, username, password_hash FROM users WHERE username=? AND email=?', [values.username, values.email]);
    check('Real registered account has a bcrypt password', registered && await require(path.join(applicationRoot, 'node_modules/bcrypt')).compare(values.password, registered.password_hash));
    async function login() {
      await navigate('/login', authReady);
      await fill({ identifier: values.username, password: values.password });
      await until('location.pathname === "/index.html" && document.readyState === "complete" && (' + policyReady + ')');
    }
    const pages = ['index.html', 'pages/姑苏领军.html', 'pages/东吴.html', 'pages/姑苏区.html', 'pages/常熟.html', 'pages/昆山.html', 'pages/金鸡湖.html', 'pages/高新区.html', 'pages/吴江.html', 'pages/相城.html', 'pages/政策对比.html'];
    const groups = [];
    for (const width of [1440, 768, 375]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width < 1100 });
      await send('Emulation.setTouchEmulationEnabled', { enabled: width < 1100 });
      const touch = width < 1100;
      await login();
      for (const page of pages) {
        await navigate('/' + page.split('/').map(encodeURIComponent).join('/'), policyReady);
        await trace();
        await input('#szp-user-toggle', touch);
        check(width + ' ' + page + ' trusted input opens user dropdown', await evaluate('!document.getElementById("szp-user-panel").hidden'));
        await input('#szp-user-panel a', touch);
        try {
          await until('location.pathname === "/account" && document.body.dataset.accountReady === "true"');
        } catch (error) {
          console.log(JSON.stringify({ width, page, failedAction: 'account', trace: await evaluate('window.__pointerTrace || []'), state: await evaluate('({path:location.pathname,panelHidden:document.getElementById("szp-user-panel")?.hidden})') }));
          throw error;
        }
        check(width + ' ' + page + ' trusted account click shows correct user', await evaluate('document.getElementById("account-username").textContent === ' + JSON.stringify(values.username)));
        check(width + ' ' + page + ' account email comes from authenticated API', await evaluate('document.getElementById("account-email").textContent === ' + JSON.stringify(values.email)));
        await input('#account-home', touch);
        await until('location.pathname === "/index.html" && (' + policyReady + ')');
        check(width + ' ' + page + ' account return link works', true);
        check(width + ' ' + page + ' layout fits viewport', await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
        groups.push({ width, page, input: touch ? 'touch' : 'mouse', passed: true });
      }
      await navigate('/index.html', policyReady);
      await input('#szp-user-toggle', touch);
      await input('#szp-user-panel .szp-user-registered', touch);
      check(width + ' clicking non-focusable registration date keeps menu open', await evaluate('!document.getElementById("szp-user-panel").hidden'));
      await key('Escape', 'Escape', 27);
      check(width + ' Escape restores trigger focus', await evaluate('document.getElementById("szp-user-panel").hidden && document.activeElement.id === "szp-user-toggle"'));
      await key('ArrowDown', 'ArrowDown', 40);
      check(width + ' keyboard opens at account link', await evaluate('!document.getElementById("szp-user-panel").hidden && document.activeElement === document.querySelector("#szp-user-panel a")'));
      await key('Tab', 'Tab', 9);
      check(width + ' native Tab moves to logout without hiding menu', await evaluate('!document.getElementById("szp-user-panel").hidden && document.activeElement.id === "szp-user-logout"'));
      await key('Tab', 'Tab', 9);
      check(width + ' native Tab leaving user center closes menu', await evaluate('document.getElementById("szp-user-panel").hidden && !document.getElementById("szp-user-center").contains(document.activeElement)'));
      await input('#szp-user-toggle', touch);
      await key('ArrowDown', 'ArrowDown', 40);
      await key('Enter', 'Enter', 13);
      await until('location.pathname === "/account" && document.body.dataset.accountReady === "true"');
      check(width + ' native keyboard activates account link', true);
      await input('#account-home', touch);
      await until(policyReady);
      if (touch) await input('.szp-menu-toggle', true);
      await input('.szp-region-toggle', touch);
      await input('[data-szp-region="kunshan"]', touch);
      await until('decodeURIComponent(location.pathname) === "/pages/昆山.html" && (' + policyReady + ')');
      check(width + ' real input still activates original regional navigation', true);
      await navigate('/index.html', policyReady);
      await input('#szp-user-toggle', touch);
      const oldCookie = (await send('Network.getAllCookies')).cookies.find(cookie => cookie.name === 'szp.sid');
      const cookieHeader = oldCookie.name + '=' + oldCookie.value;
      await trace();
      const logoutStart = events.length;
      await input('#szp-user-logout', touch);
      try {
        await until('location.pathname === "/login" && (' + authReady + ')');
      } catch (error) {
        console.log(JSON.stringify({ width, failedAction: 'logout', trace: await evaluate('window.__pointerTrace || []') }));
        throw error;
      }
      check(width + ' trusted logout returns to login', true);
      check(width + ' trusted logout sends actual API POST', events.slice(logoutStart).some(event => event.method === 'Network.requestWillBeSent' && event.params.request.method === 'POST' && new URL(event.params.request.url).pathname === '/api/auth/logout'));
      const [[remaining]] = await pool.execute('SELECT COUNT(*) AS total FROM user_sessions WHERE user_id=?', [registered.id]);
      check(width + ' logout destroys persisted MySQL session', Number(remaining.total) === 0);
      const catalog = require(path.join(applicationRoot, 'server/routes/policy-site')).policyFiles(path.join(applicationRoot, '苏州人才政策'));
      for (const file of catalog.values()) {
        const response = await fetch(fixture.base + '/' + file.relative.split('/').map(encodeURIComponent).join('/'), { redirect: 'manual', headers: { Cookie: cookieHeader } });
        check(width + ' old session denied: ' + file.relative, response.status === (file.relative.endsWith('.html') ? 302 : 401));
        await response.arrayBuffer();
      }
      const denied = await fetch(fixture.base + '/api/auth/me', { headers: { Cookie: cookieHeader } });
      check(width + ' me API rejects logged-out session', denied.status === 401);
      await denied.arrayBuffer();
      const history = await send('Page.getNavigationHistory');
      const backPath = decodeURIComponent(new URL(history.entries[history.currentIndex - 1].url).pathname).slice(1);
      check(width + ' back target is a previously authenticated policy page', pages.includes(backPath));
      const backStart = events.length;
      await evaluate('history.back();true');
      await until('location.pathname === "/login" && (' + authReady + ')', backStart);
      check(width + ' back navigation cannot restore protected policy', await evaluate('!document.getElementById("szp-global-header")'));
      console.log(JSON.stringify({ width, input: touch ? 'touch' : 'mouse', pages: pages.length, checksPassed: checks.length }));
    }
    check('No uncaught browser JavaScript exceptions', !events.some(event => event.method === 'Runtime.exceptionThrown'));
    const result = { verifiedAt: new Date().toISOString(), mysqlVerified: true, trustedInput: true, checksPassed: checks.length, pageWidthGroups: groups.length, groups, checks };
    fs.writeFileSync(path.join(__dirname, 'user-center-pointer-report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mysqlVerified: true, trustedInput: true, checksPassed: checks.length, pageWidthGroups: groups.length }));
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
    browser?.kill();
    if (fixture) await fixture.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
