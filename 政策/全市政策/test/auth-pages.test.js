'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createAuthPreviewApp } = require('../server/scripts/preview-auth');

async function serve(t) {
  const server = createAuthPreviewApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('新/login和/register直接返回正确表单，素材路径规范，保留安全回跳', async t => {
  const base = await serve(t);
  for (const mode of ['login', 'register']) {
    const response = await fetch(base + '/' + mode + '?returnTo=' + encodeURIComponent('/pages/昆山.html?view=team'));
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp('data-auth-mode="' + mode + '"'));
    assert.match(html, /src="\/auth-ui\/js\/auth.js"/);
    assert.match(html, /href="\/auth-ui\/css\/auth.css"/);
    assert.match(html, /src="\/auth-ui\/assets\/jiangnan-architecture.svg"/);
    assert.match(html, /src="\/auth-ui\/assets\/kunshan-institute.png"/);
    assert.match(html, /苏州人才政策/);
    assert.match(html, /科技创新创业领军人才政策<br>综合展示平台/);
    assert.match(html, /returnTo=/);
    const names = [...html.matchAll(/<input[^>]+name="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(names, mode === 'login' ? ['identifier', 'password'] : ['username', 'email', 'password', 'confirmPassword']);
    for (const name of names) {
      assert.ok(html.includes(`for="auth-${name}"`));
      assert.ok(html.includes(`id="auth-${name}-error"`));
    }
  }
  const unsafe = await (await fetch(base + '/register?returnTo=%2F%2Fevil.example')).text();
  assert.ok(!unsafe.includes('evil.example'));
});
test('尾斜杠和大小写重定向到规范路由，避免相对路径故障', async t => {
  const base = await serve(t);
  for (const [from, target] of [['/login/', '/login'], ['/register/', '/register'], ['/LOGIN', '/login'], ['/REGISTER', '/register']]) {
    const response = await fetch(base + from + '?view=team', { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), target + '?view=team');
  }
});
test('仅公开明确列出的账户素材，建筑SVG使用原文件，预览不开放原站或API', async t => {
  const base = await serve(t);
  for (const asset of ['/auth-ui/css/auth.css', '/auth-ui/js/auth.js', '/auth-ui/js/account.js', '/auth-ui/assets/portal-mark.svg', '/auth-ui/assets/jiangnan-architecture.svg', '/auth-ui/assets/kunshan-institute.png']) {
    const response = await fetch(base + asset);
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  const logo = Buffer.from(await (await fetch(base + '/auth-ui/assets/kunshan-institute.png')).arrayBuffer());
  assert.ok(logo.equals(await fs.readFile(path.resolve(__dirname, '../../昆山.png'))));
  const svg = await (await fetch(base + '/auth-ui/assets/jiangnan-architecture.svg')).text();
  assert.equal(svg, await fs.readFile(path.resolve(__dirname, '../苏州人才政策/assets/images/jiangnan-architecture.svg'), 'utf8'));
  for (const url of ['/', '/index.html', '/pages/昆山.html', '/data/portal-data.json', '/auth-ui/data/portal-data.json', '/auth-ui/../index.html', '/api/auth/csrf', '/api/auth/login', '/api/auth/register']) assert.equal((await fetch(base + url)).status, 404, url);
});

test('取消标识图片下载后预览服务继续工作，不重复发送响应头', () => {
  const script = String.raw`
    const http = require('node:http');
    const { createAuthPreviewApp } = require('./server/scripts/preview-auth');
    (async () => {
      const server = createAuthPreviewApp().listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      try {
        await new Promise((resolve, reject) => {
          const request = http.get(base + '/auth-ui/assets/kunshan-institute.png', response => {
            response.on('error', () => {});
            response.once('data', () => { request.destroy(); resolve(); });
          });
          request.on('error', error => { if (error.code !== 'ECONNRESET') reject(error); });
        });
        await new Promise(resolve => setTimeout(resolve, 80));
        const page = await fetch(base + '/register');
        if (page.status !== 200 || !(await page.text()).includes('auth-institute-logo')) throw new Error('Preview stopped after abort.');
        console.log('aborted-image-recovery-passed');
      } finally { await new Promise(resolve => server.close(resolve)); }
    })().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
  `;
  const child = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /aborted-image-recovery-passed/);
  assert.doesNotMatch(child.stderr, /ERR_HTTP_HEADERS_SENT|Cannot set headers/);
});
