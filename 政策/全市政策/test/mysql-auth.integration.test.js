'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');
const { loadServerConfig } = require('../server/config/env');
const { createPool, verifyAuthDatabase } = require('../server/config/db');
const { createAuthentication } = require('../server/services/authentication');
const { createBackendApp } = require('../server/backend-app');

test('真实MySQL：注册、重复、错误密码、登录、会话持久化、me和退出', {
  skip: process.env.RUN_MYSQL_TESTS !== '1' ? '未启用真实MySQL测试；使用 npm run test:mysql 执行。' : false,
  timeout: 60000
}, async () => {
  const config = loadServerConfig();
  assert.equal(config.production, false, '请在独立开发数据库执行真实测试，不对生产数据库创建测试账户。');
  const pool = createPool(config);
  let server, authentication, registered = false;
  const suffix = randomBytes(8).toString('hex');
  const username = 'qa_' + suffix;
  const email = username + '@example.com';
  const password = randomBytes(20).toString('hex');
  let cookie = '', token = '', base;
  async function launch() {
    server = http.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
    const testConfig = { ...config, origin: base };
    authentication = await createAuthentication(pool, testConfig);
    server.on('request', createBackendApp({ pool, config: testConfig, authentication }));
  }
  async function request(url, method = 'GET', body, suppliedCookie, extraHeaders = {}) {
    const response = await fetch(base + url, { redirect: 'manual', method,
      headers: { Cookie: suppliedCookie === undefined ? cookie : suppliedCookie,
        ...(method === 'POST' ? { Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': token } : {}), ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const set = response.headers.getSetCookie().find(value => value.startsWith('szp.sid='));
    if (set && suppliedCookie === undefined) cookie = set.split(';')[0];
    return response;
  }
  async function csrf() { token = (await (await request('/api/auth/csrf')).json()).csrfToken; }
  try {
    await verifyAuthDatabase(pool);
    await launch();
    assert.equal((await request('/api/health')).status, 200);
    assert.equal((await request('/')).status, 302);
    assert.equal((await request('/pages/' + encodeURIComponent('政策对比.html'))).status, 302);
    assert.equal((await request('/' + encodeURIComponent('苏州八地人才政策多维对比.xlsx'))).status, 401);
    await csrf();
    const values = { username, email, password, confirmPassword: password };
    assert.equal((await request('/api/auth/register', 'POST', values)).status, 201);
    registered = true;
    const [[row]] = await pool.execute('SELECT id, role, password_hash, created_at, last_login_at FROM users WHERE username = ?', [username]);
    assert.notEqual(row.password_hash, password);
    assert.ok(await bcrypt.compare(password, row.password_hash));
    assert.equal(bcrypt.getRounds(row.password_hash), config.bcryptCost);
    assert.equal(row.role, 'user');
    assert.equal((await request('/api/auth/register', 'POST', values)).status, 409);
    const duplicateUsername = await request('/api/auth/register', 'POST', { ...values, email: username + '-other@example.com' });
    assert.equal(duplicateUsername.status, 409);
    assert.deepEqual(Object.keys((await duplicateUsername.json()).fields), ['username']);
    const duplicateEmail = await request('/api/auth/register', 'POST', { ...values, username: username + '_2' });
    assert.equal(duplicateEmail.status, 409);
    assert.deepEqual(Object.keys((await duplicateEmail.json()).fields), ['email']);
    assert.equal((await request('/api/auth/login', 'POST', { identifier: email, password: 'WrongPassword123' })).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', { identifier: "' OR 1=1 --", password })).status, 401);
    const anonymous = cookie;
    const login = await request('/api/auth/login', 'POST', { identifier: username, password });
    assert.equal(login.status, 200);
    assert.match(login.headers.getSetCookie().join(';'), /HttpOnly/);
    assert.match(login.headers.getSetCookie().join(';'), /SameSite=Lax/);
    assert.equal((await login.json()).redirect, '/index.html');
    assert.notEqual(cookie, anonymous);
    assert.equal((await request('/api/auth/me', 'GET', undefined, anonymous)).status, 401);
    const profile = await (await request('/api/auth/me')).json();
    assert.equal(profile.user.username, username);
    assert.equal(profile.user.createdAt, row.created_at.toISOString());
    assert.ok(profile.user.lastLoginAt);
    assert.ok(!('password_hash' in profile.user));
    assert.equal((await request('/index.html')).status, 200);
    assert.equal((await request('/pages/' + encodeURIComponent('政策对比.html'))).status, 200);
    const download = await request('/' + encodeURIComponent('苏州八地人才政策多维对比.xlsx'));
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    await download.arrayBuffer();
    const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM user_sessions WHERE user_id = ?', [row.id]);
    assert.ok(Number(count.total) >= 1);
    await new Promise(resolve => server.close(resolve)); server = null;
    await authentication.store.close(); authentication = null;
    // A new app/store must read the existing session from the real database.
    await launch();
    assert.equal((await request('/api/auth/me')).status, 200);
    await csrf();
    const validToken = token;
    token = '';
    assert.equal((await request('/api/auth/logout', 'POST')).status, 403);
    token = '0'.repeat(64);
    assert.equal((await request('/api/auth/logout', 'POST')).status, 403);
    token = validToken;
    assert.equal((await request('/api/auth/logout', 'POST', undefined, undefined, { Origin: 'https://outside.invalid' })).status, 403);
    assert.equal((await request('/api/auth/me')).status, 200, 'CSRF失败不能销毁合法会话');
    const oldCookie = cookie;
    assert.equal((await request('/api/auth/logout', 'POST')).status, 200);
    assert.equal((await request('/api/auth/me', 'GET', undefined, oldCookie)).status, 401);
    assert.equal((await request('/index.html', 'GET', undefined, oldCookie)).status, 302);
    assert.equal((await request('/' + encodeURIComponent('苏州八地人才政策多维对比.xlsx'), 'GET', undefined, oldCookie)).status, 401);
    const [[after]] = await pool.execute('SELECT COUNT(*) AS total FROM user_sessions WHERE user_id = ?', [row.id]);
    assert.equal(Number(after.total), 0);
    await csrf();
    assert.equal((await request('/api/auth/login', 'POST', { identifier: email.toUpperCase(), password })).status, 200);
    const expiredCookie = cookie;
    // Only the random test account's session is expired; real users are untouched.
    await pool.execute("UPDATE user_sessions SET data = JSON_SET(data, '$.authExpiresAt', ?) WHERE user_id = ?", [Date.now() - 1, row.id]);
    assert.equal((await request('/api/auth/me')).status, 401);
    assert.equal((await request('/index.html', 'GET', undefined, expiredCookie)).status, 302);
    assert.equal((await request('/data/portal-data.json', 'GET', undefined, expiredCookie)).status, 401);
    await csrf();
    for (const returnTo of ['https://outside.invalid', '//outside.invalid', '/\\outside.invalid', '/%2foutside.invalid', '/%252foutside.invalid', '/pages/昆山.html']) {
      const redirected = await request('/api/auth/login', 'POST', { identifier: username, password, returnTo });
      assert.equal(redirected.status, 200);
      assert.equal((await redirected.json()).redirect, '/index.html');
      await csrf();
    }
    await request('/api/auth/logout', 'POST');
    // Rebuild the app to isolate its IP limit from previous functional requests.
    await new Promise(resolve => server.close(resolve)); server = null;
    await authentication.store.close(); authentication = null;
    cookie = ''; token = ''; await launch(); await csrf();
    for (let attempt = 0; attempt < 10; attempt++) {
      assert.equal((await request('/api/auth/login', 'POST', { identifier: username, password: 'WrongPassword123' })).status, 401);
    }
    const limited = await request('/api/auth/login', 'POST', { identifier: username, password });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
      if (authentication) await authentication.store.close();
      // Runtime accounts intentionally have no DELETE permission on users; retain audit history.
      if (registered) await pool.execute("UPDATE users SET status = 'disabled' WHERE username = ? AND email = ?", [username, email]);
    } finally { await pool.end(); }
  }
});
