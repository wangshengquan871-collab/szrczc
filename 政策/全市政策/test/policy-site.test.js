'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { backendFixture } = require('./helpers/auth-backend-fixture');
const { policyFiles } = require('../server/routes/policy-site');
const root = path.resolve(__dirname, '../苏州人才政策');
const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const signup = { username: 'policy_test', email: 'policy-test@example.invalid', password: 'PolicyTestPass123', confirmPassword: 'PolicyTestPass123' };
async function login(fixture, returnTo = '//external.invalid') {
  await fixture.csrf();
  await fixture.request('/api/auth/register', { method: 'POST', body: signup });
  const response = await fixture.request('/api/auth/login', { method: 'POST', body: { identifier: signup.username, password: signup.password, returnTo } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).redirect, '/index.html');
}
function removeDecoration(html) {
  return html.replace('<link rel="stylesheet" href="/session-ui/policy-session.css"><script defer src="/session-ui/policy-session.js"></script>', '')
    .replace(/<aside class="szp-session-tools"[\s\S]*?<\/aside>/, '');
}

test('全部政策页面、脚本、数据、图片及下载在登录前被服务端保护，HEAD和Range也不能绕过', async t => {
  const fixture = await backendFixture(t);
  const routes = ['/', '/INDEX.HTML', '/%69ndex.%68tml', ...[...policyFiles(root).values()].map(file => encodePath('/' + file.relative))];
  for (const route of routes) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fixture.request(route, { method, headers: { Accept: 'text/html', Range: 'bytes=0-31', 'If-None-Match': '"old-cache"' } });
      const isPage = route === '/' || /\.html$/i.test(decodeURIComponent(route));
      assert.equal(response.status, isPage ? 302 : 401, method + ' ' + route);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (isPage) assert.match(response.headers.get('location'), /^\/login/);
      else if (method === 'GET') assert.equal((await response.json()).code, 'AUTH_REQUIRED');
    }
  }
  for (const route of ['/api/private.html', '/api/data', '/session-ui/policy-session.js', '/session-ui/policy-session.css']) {
    const response = await fixture.request(route);
    assert.equal(response.status, 401, route);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
});

test('登录后所有原资源字节一致，11张页面原HTML可恢复，相对路径无需迁移', async t => {
  const fixture = await backendFixture(t);
  await login(fixture);
  let pages = 0, documents = 0;
  for (const file of policyFiles(root).values()) {
    const response = await fixture.request(encodePath('/' + file.relative));
    assert.equal(response.status, 200, file.relative);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    if (file.relative.endsWith('.html')) {
      pages++;
      const html = await response.text();
      assert.equal(removeDecoration(html), fs.readFileSync(file.location, 'utf8'), file.relative);
      assert.ok(html.includes('id="szp-session-logout"'));
      assert.ok(!response.headers.get('content-security-policy').includes('script-src \'unsafe-inline\''));
    } else {
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(fs.readFileSync(file.location)), file.relative);
      if (/\.(docx|xlsx)$/i.test(file.relative)) {
        documents++;
        assert.match(response.headers.get('content-disposition'), /^attachment;/);
      }
    }
  }
  assert.equal(pages, 11); assert.equal(documents, 11);
  const uppercase = await fixture.request('/INDEX.HTML');
  assert.equal(uppercase.status, 308); assert.equal(uppercase.headers.get('location'), '/index.html');
  assert.equal((await fixture.request('/')).status, 200);
  const head = await fixture.request('/css/main.css', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('登录用户仍不能读取配置、清单、旧目录、重复编码或Windows特殊路径', async t => {
  const fixture = await backendFixture(t); await login(fixture);
  const forbidden = ['/README.md', '/source-manifest.json', '/AUTH_README.md', '/.env', '/server.js', '/database/schema.sql', '/node_modules/express/package.json', '/%2eenv', '/pages%5c..%5c.env', '/index.html::$DATA', '/index.html.', '/index.html%20', '/%2569ndex.html', '/苏州人才政策/index.html', '/static/pages/政策对比.html', '/全市政策/苏州人才政策/index.html', '/auth-ui/%252e%252e/data/portal-data.json', '/css/auth.css', '/登录注册.html'];
  for (const route of forbidden) assert.equal((await fixture.request(route)).status, 404, route);
  // fetch normalizes dot segments before transmission; use raw HTTP for server traversal checks.
  for (const route of ['/auth-ui/../data/portal-data.json', '/pages/%2e%2e/index.html', '/pages/../index.html']) {
    const status = await new Promise((resolve, reject) => {
      const request = require('node:http').request(fixture.base, { path: route, headers: { Cookie: fixture.cookie } }, response => { response.resume(); resolve(response.statusCode); });
      request.once('error', reject); request.end();
    });
    assert.equal(status, 404, route);
  }
  assert.equal((await fixture.request('/api/private')).status, 404);
  for (const route of ['/session-ui/policy-session.js', '/session-ui/policy-session.css']) assert.equal((await fixture.request(route)).status, 200);
});

test('退出后旧Cookie不能读取政策页、图表数据和文档，禁用账号同样拦截', async t => {
  const fixture = await backendFixture(t); await login(fixture);
  await fixture.csrf(); const oldCookie = fixture.cookie;
  assert.equal((await fixture.request('/api/auth/logout', { method: 'POST' })).status, 200);
  for (const route of ['/', '/index.html', '/pages/政策对比.html', '/pages/昆山.html', '/data/portal-data.json', '/js/navigation.js', '/苏州八地人才政策多维对比.xlsx', '/昆山双创.docx']) {
    const response = await fixture.request(route, { cookie: oldCookie });
    assert.equal(response.status, route === '/' || route.endsWith('.html') ? 302 : 401, route);
  }
  await fixture.csrf();
  assert.equal((await fixture.request('/api/auth/login', { method: 'POST', body: { identifier: signup.username, password: signup.password } })).status, 200);
  fixture.pool.records[0].status = 'disabled';
  assert.equal((await fixture.request('/index.html')).status, 302);
  assert.equal((await fixture.request('/data/portal-data.json')).status, 401);
});

test('登录跳转固定站内首页，外部URL、双重编码和反斜杠不能改变目的地', async t => {
  const fixture = await backendFixture(t); await fixture.csrf();
  await fixture.request('/api/auth/register', { method: 'POST', body: signup });
  for (const returnTo of ['https://external.invalid', '//external.invalid', '/\\external.invalid', '/%2fexternal.invalid', '/%252fexternal.invalid', '/pages/昆山.html?view=team', '/account']) {
    await fixture.csrf();
    const response = await fixture.request('/api/auth/login', { method: 'POST', body: { identifier: signup.username, password: signup.password, returnTo } });
    assert.equal(response.status, 200); assert.equal((await response.json()).redirect, '/index.html');
  }
});
