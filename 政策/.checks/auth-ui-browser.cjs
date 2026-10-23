'use strict';
// Local browser verification only. No authentication fixture or successful API is simulated.
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
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(portFile) && Date.now() < deadline) await delay(100);
    if (!fs.existsSync(portFile)) throw new Error('Edge did not start');
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
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reports = [];
    for (const width of [1440, 768, 375]) for (const mode of ['login', 'register']) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width <= 768 });
      await navigate('http://127.0.0.1:3001/' + mode);
      await screenshot('auth-new-' + mode + '-' + width);
      const basic = await evaluate(`(() => {
        const form = document.querySelector('[data-auth-form]'), inputs = [...form.querySelectorAll('input')];
        return {
          mode: document.body.dataset.authMode === '${mode}',
          noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
          columns: getComputedStyle(document.querySelector('.auth-layout')).gridTemplateColumns.split(' ').length === ${width >= 1024 ? 2 : 1},
          illustration: document.querySelector('.auth-architecture').naturalWidth === 1800,
          labels: inputs.every(input => !!form.querySelector('label[for="' + input.id + '"]') && !!input.getAttribute('aria-describedby')),
          controls: [...form.querySelectorAll('input,button')].every(control => control.getBoundingClientRect().height >= 44),
          reducedMotion: getComputedStyle(document.querySelector('.auth-form-wrap')).animationName === 'none'
        };
      })()`);
      const blank = await evaluate(`(() => {const form=document.querySelector('[data-auth-form]');form.requestSubmit();return {internalError:!document.getElementById('auth-summary').hidden,focus:document.activeElement===form.querySelector('input'),invalid:!!form.querySelector('[aria-invalid="true"]')}})()`);
      await evaluate("document.querySelector('[data-auth-reveal]').focus();true");
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      const keyboard = await evaluate("(() => {const b=document.querySelector('[data-auth-reveal]');return {spaceToggle:b.getAttribute('aria-pressed')==='true'&&document.getElementById(b.dataset.authReveal).type==='text'}})()");
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      keyboard.tabMovesFocus = await evaluate("document.activeElement !== document.querySelector('[data-auth-reveal]')");
      const registration = mode === 'register' ? await evaluate(`(() => {
        const form=document.querySelector('[data-auth-form]');
        const values={username:'ab',email:'invalid',password:'short',confirmPassword:'different'};
        for(const[name,value]of Object.entries(values)){form.elements[name].value=value;form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));}
        form.requestSubmit();
        return {usernameRule:form.elements.username.getAttribute('aria-invalid')==='true',emailRule:form.elements.email.getAttribute('aria-invalid')==='true',passwordRule:form.elements.password.getAttribute('aria-invalid')==='true',confirmationRule:form.elements.confirmPassword.getAttribute('aria-invalid')==='true'};
      })()`) : {};
      const submission = await evaluate(`(async()=>{
        const form=document.querySelector('[data-auth-form]');
        form.querySelectorAll('[data-auth-reveal][aria-pressed="true"]').forEach(b=>b.click());
        const values=${mode === 'login' ? "{identifier:'ui-validation-only',password:'ui-validation-only'}" : "{username:'界面校验',email:'ui-validation@example.invalid',password:'ui-validation-only',confirmPassword:'ui-validation-only'}"};
        for(const [name,value]of Object.entries(values)){form.elements[name].value=value;form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));}
        form.requestSubmit();
        const loading=form.getAttribute('aria-busy')==='true'&&form.querySelector('[data-auth-submit]').disabled&&!form.querySelector('.auth-spinner').hidden;
        for(let i=0;i<50&&form.getAttribute('aria-busy')==='true';i++)await new Promise(r=>setTimeout(r,50));
        return {loading,serviceError:!document.getElementById('auth-summary').hidden&&document.getElementById('auth-summary').textContent.includes('尚未开放'),restored:!form.querySelector('[data-auth-submit]').disabled,noFakeSuccess:!form.hidden&&location.pathname==='/${mode}',focusError:document.activeElement===document.getElementById('auth-summary')};
      })()`);
      const report = { width, mode, checks: { ...basic, ...blank, ...keyboard, ...registration, ...submission } };
      reports.push(report);
      const failed = Object.entries(report.checks).filter(([, value]) => !value);
      if (failed.length) throw new Error('Browser checks failed: ' + JSON.stringify({ width, mode, failed }));
    }
    const filePreviews = [];
    for (const file of ['登录注册.html', '注册.html']) {
      const url = require('node:url').pathToFileURL(path.resolve(checksRoot, '../全市政策/苏州人才政策', file)).href;
      await navigate(url);
      const direct = await evaluate(`(async()=>{
        const form=document.querySelector('[data-auth-form]');
        const register=document.body.dataset.authMode==='register';
        const values=register?{username:'本地预览',email:'preview@example.invalid',password:'preview-only',confirmPassword:'preview-only'}:{identifier:'preview-only',password:'preview-only'};
        for(const[name,value]of Object.entries(values))form.elements[name].value=value;
        form.requestSubmit();
        return {illustration:document.querySelector('.auth-architecture').naturalWidth===1800,previewMessage:document.getElementById('auth-summary').textContent.includes('仅支持界面预览'),switchLink:document.querySelector('[data-auth-link]').href.startsWith('file:'),noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
      })()`);
      if (Object.values(direct).some(value => !value)) throw new Error('Local HTML preview failed: ' + JSON.stringify(direct));
      filePreviews.push({ file, checks: direct });
    }
    await send('Emulation.setScriptExecutionDisabled', { value: true });
    await send('Page.navigate', { url: 'http://127.0.0.1:3001/register' });
    await delay(350);
    const noJs = await evaluate("document.body.dataset.authMode==='register'&&document.querySelectorAll('input').length===4&&document.querySelector('[data-auth-submit]').disabled");
    if (!noJs) throw new Error('Registration without JavaScript failed');
    const exceptions = events.filter(event => event.method === 'Runtime.exceptionThrown');
    if (exceptions.length) throw new Error('Browser JavaScript exceptions: ' + JSON.stringify(exceptions));
    const result = { viewports: reports, filePreviews, noJsRegistration: noJs, exceptions: exceptions.length, mysqlVerified: false, simulatedSuccess: false };
    fs.writeFileSync(path.join(checksRoot, 'auth-new-browser-report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ viewportGroups: reports.length, checks: reports.reduce((n, report) => n + Object.keys(report.checks).length, 0), filePreviews: filePreviews.length, noJsRegistration: noJs, exceptions: exceptions.length }));
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
    browser.kill();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
