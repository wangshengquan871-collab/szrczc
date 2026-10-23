'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { createApp } = require('../server/app');
const { readConfig } = require('../server/config/env');
const { registrationValues } = require('../server/routes/auth');
const { safeReturnTo, requireRole } = require('../server/middleware/security');
const { createUsers } = require('../server/services/users');
const env = { NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:3000', SESSION_SECRET: 'test-only-secret-not-for-deployment-12345678', DB_HOST: '127.0.0.1', DB_USER: 'test', DB_PASSWORD: 'test-only', DB_NAME: 'suzhou_talent_policy', BCRYPT_COST: '10' };

test('配置检查拒绝缺失配置、生产 root 和未验证的远程数据库', () => {
  assert.throws(() => readConfig({}), /SESSION_SECRET/);
  assert.throws(() => readConfig({ ...env, DB_HOST: 'database.example.com' }), /远程 MySQL/);
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://example.com', DB_USER: 'root' }), /权限最小化/);
  assert.throws(() => readConfig({ ...env, SESSION_SECRET: 'short' }), /32/);
  assert.throws(() => readConfig({ ...env, APP_ORIGIN: 'http://localhost:3000/path' }), /源地址/);
});
test('字段验证和回跳限制覆盖 UTF-8 密码、错误确认及外部链接', () => {
  assert.equal(Object.keys(registrationValues({ username: '用户abc', email: 'user@example.com', password: 'Password123', confirmPassword: 'Password123' }).fields).length, 0);
  assert.ok(registrationValues({ username: 'ab', email: 'bad', password: '短', confirmPassword: 'different' }).fields.confirmPassword);
  assert.ok(registrationValues({ username: 'valid', email: 'user@example.com', password: '密'.repeat(25), confirmPassword: '密'.repeat(25) }).fields.password);
  for (const input of ['//evil.example', '/\\evil.example', 'https://evil.example', '/%2fexample', '/%252fexample', '/api/auth/logout']) assert.equal(safeReturnTo(input), '/');
  assert.equal(safeReturnTo('/pages/' + encodeURIComponent('昆山.html') + '?view=team'), '/pages/' + encodeURIComponent('昆山.html') + '?view=team');
});
test('账户数据库服务使用参数化 SQL，不拼接用户输入', async () => {
  const calls = [];
  const pool = { async execute(sql, params) { calls.push({ sql, params }); return [sql.startsWith('INSERT INTO users') ? { insertId: 2 } : sql.startsWith('UPDATE user_sessions') ? { affectedRows: 1 } : []]; } };
  const users = createUsers(pool, env.SESSION_SECRET);
  const input = "name' OR 1=1 --";
  await users.byIdentifier(input);
  await users.duplicates(input, 'a@example.com');
  await users.create(input, 'a@example.com', '$2b$hash');
  await users.byId('1'); await users.markLogin('1'); await users.linkSession('sid', '1');
  await users.audit({ identifier: input, success: false, reason: 'invalid_credentials', ip: '127.0.0.1' });
  assert.equal(calls.length, 7);
  calls.forEach(({ sql, params }) => { assert.ok(sql.includes('?')); assert.ok(Array.isArray(params)); assert.ok(!sql.includes(input)); });
  assert.ok(Buffer.isBuffer(calls[6].params[1]));
});
test('普通用户不能通过服务端管理员中间件', () => {
  let status;
  const middleware = requireRole('admin');
  middleware({ authUser: { role: 'user' } }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('Unauthorized next'));
  assert.equal(status, 403);
  let next = false; middleware({ authUser: { role: 'admin' } }, {}, () => { next = true; }); assert.ok(next);
});

test('真实 HTTP/bcrypt 与测试替身：注册、CSRF、登录换 SID、权限、刷新、退出和全部资源保护', async t => {
  // This explicit test double is never imported by the production bootstrap. It is NOT a MySQL verification.
  const records = [];
  const audits = [];
  const store = new session.MemoryStore();
  const users = {
    async duplicates(username, email) { const fields = {}; if (records.some(u => u.username.toLowerCase() === username.toLowerCase())) fields.username = '用户名重复'; if (records.some(u => u.email === email)) fields.email = '邮箱重复'; return fields; },
    async create(username, email, password_hash) { const id = String(records.length + 1); records.push({ id, username, email, password_hash, role: 'user', status: 'active' }); return id; },
    async byIdentifier(identifier) { return records.find(u => u.username.toLowerCase() === identifier.toLowerCase() || u.email === identifier.toLowerCase()); },
    async byId(id) { return records.find(u => u.id === String(id)); },
    async markLogin(id) { records.find(u => u.id === String(id)).last_login_at = new Date(); },
    async linkSession() {}, async audit(log) { audits.push(log); }
  };
  const config = { ...readConfig(env), root: path.resolve(__dirname, '..') };
  const app = createApp({ config, users, store, dummyHash: await bcrypt.hash('test-dummy-password', 10) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { store.clear(() => {}); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  let token;
  async function request(url, method = 'GET', body, headers = {}, anonymous = false) {
    const response = await fetch(base + url, { redirect: 'manual', method, headers: { ...(cookie && !anonymous ? { Cookie: cookie } : {}), ...(method === 'POST' ? { Origin: config.origin, 'X-CSRF-Token': token || '', 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const set = response.headers.getSetCookie().find(value => value.startsWith('szp.sid='));
    if (set && !anonymous) cookie = set.split(';')[0];
    return response;
  }
  const publicPage = await request('/login'); assert.equal(publicPage.status, 200); assert.match(await publicPage.text(), /欢迎登录/);
  assert.equal((await request('/register')).status, 200);
  assert.equal((await request('/登录注册.html')).status, 200);
  assert.equal((await request('/auth/css/auth.css')).status, 200);
  for (const url of ['/', '/index.html', '/pages/昆山.html', '/pages/政策对比.html']) {
    const response = await request(url); assert.equal(response.status, 302); assert.match(response.headers.get('location'), /^\/login/); assert.doesNotMatch(await response.text(), /szp-policy-grid/);
  }
  for (const url of ['/data/portal-data.json', '/pages/政策对比资源/policy-data.js', '/苏州八地人才政策多维对比.xlsx', '/姑苏领军人才政策_市级_2026.docx']) assert.equal((await request(url)).status, 401);
  token = (await (await request('/api/auth/csrf')).json()).csrfToken;
  const beforeCookie = cookie;
  const registration = { username: 'testuser', email: 'test@example.com', password: 'Password123', confirmPassword: 'Password123' };
  assert.equal((await request('/api/auth/register', 'POST', registration, { 'X-CSRF-Token': 'é'.repeat(64) })).status, 403);
  assert.equal((await request('/api/auth/register', 'POST', registration, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/auth/register', 'POST', { ...registration, confirmPassword: 'wrong' })).status, 422);
  assert.equal((await request('/api/auth/register', 'POST', registration)).status, 201);
  assert.match(records[0].password_hash, /^\$2b\$/); assert.ok(await bcrypt.compare('Password123', records[0].password_hash));
  const duplicate = await request('/api/auth/register', 'POST', registration); assert.equal(duplicate.status, 409); assert.ok((await duplicate.json()).fields.email);
  const failed = await request('/api/auth/login', 'POST', { identifier: 'testuser', password: 'wrong' }); assert.equal(failed.status, 401); assert.equal((await failed.json()).code, 'INVALID_CREDENTIALS');
  const login = await request('/api/auth/login', 'POST', { identifier: 'testuser', password: 'Password123', remember: true, returnTo: '//evil.example' });
  assert.equal(login.status, 200); assert.equal((await login.json()).redirect, '/'); assert.notEqual(cookie, beforeCookie);
  const loginCookie = cookie;
  const set = login.headers.getSetCookie().join(';'); assert.match(set, /HttpOnly/); assert.match(set, /SameSite=Lax/);
  assert.equal((await request('/api/auth/me', 'GET', null, { Cookie: beforeCookie })).status, 401);
  const profile = await (await request('/api/auth/me')).json(); assert.equal(profile.user.username, 'testuser'); assert.equal(profile.user.role, 'user'); assert.ok(!('password_hash' in profile.user));
  const sessionId = Object.keys(store.sessions)[0];
  assert.ok(Object.values(store.sessions).some(s => JSON.parse(s).authExpiresAt > Date.now() + 13 * 86400000));
  for (const url of ['/', '/pages/姑苏领军.html', '/pages/东吴.html', '/pages/姑苏区.html', '/pages/常熟.html', '/pages/昆山.html', '/pages/金鸡湖.html', '/pages/高新区.html', '/pages/吴江.html', '/pages/相城.html', '/pages/政策对比.html']) {
    const response = await request(url); assert.equal(response.status, 200); assert.match(await response.text(), /\/auth\/js\/account.js/);
  }
  assert.equal((await request('/pages/政策对比资源/policy-data.js')).status, 200);
  assert.equal((await request('/data/portal-data.json')).status, 200);
  assert.equal((await request('/苏州八地人才政策多维对比.xlsx')).status, 200);
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/server.js')).status, 404);
  records[0].status = 'disabled'; assert.equal((await request('/api/auth/me')).status, 401);
  records[0].status = 'active';
  token = (await (await request('/api/auth/csrf')).json()).csrfToken;
  assert.equal((await request('/api/auth/login', 'POST', { identifier: 'test@example.com', password: 'Password123' })).status, 200);
  const ordinarySession = Object.values(store.sessions).map(s => JSON.parse(s)).find(s => s.userId);
  assert.ok(ordinarySession.authExpiresAt > Date.now() + 7 * 3600000 && ordinarySession.authExpiresAt <= Date.now() + 8 * 3600000);
  token = (await (await request('/api/auth/csrf')).json()).csrfToken;
  const authenticatedCookie = cookie;
  assert.equal((await request('/api/auth/logout', 'POST')).status, 200);
  assert.equal(Object.keys(store.sessions).length, 0);
  assert.equal((await request('/api/auth/me', 'GET', null, { Cookie: authenticatedCookie })).status, 401);
  assert.equal((await request('/pages/政策对比资源/policy-data.js', 'GET', null, { Cookie: authenticatedCookie })).status, 401);
  assert.ok(audits.some(log => !log.success)); assert.ok(audits.some(log => log.success));
  assert.ok(loginCookie); assert.ok(sessionId);
});

test('登录 IP 限流和绝对会话过期（测试替身，不连接 MySQL）', async t => {
  const hash = await bcrypt.hash('Password123', 10);
  const user = { id: '1', username: 'expiryuser', email: 'expiry@example.com', password_hash: hash, role: 'user', status: 'active' };
  const users = { async byIdentifier() { return user; }, async byId() { return user; }, async markLogin() {}, async linkSession() {}, async audit() {} };
  const store = new session.MemoryStore();
  const config = { ...readConfig(env), root: path.resolve(__dirname, '..') };
  const app = createApp({ config, users, store, dummyHash: hash });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { store.clear(() => {}); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const csrf = await fetch(base + '/api/auth/csrf');
  let token = (await csrf.json()).csrfToken;
  cookie = csrf.headers.getSetCookie()[0].split(';')[0];
  const send = async password => {
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: config.origin, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: user.username, password }) });
    const nextCookie = response.headers.getSetCookie()[0]; if (nextCookie) cookie = nextCookie.split(';')[0];
    return response;
  };
  assert.equal((await send('Password123')).status, 200);
  const id = Object.keys(store.sessions)[0];
  const saved = JSON.parse(store.sessions[id]); saved.authExpiresAt = Date.now() - 1; store.sessions[id] = JSON.stringify(saved);
  assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).status, 401);
  const newCsrf = await fetch(base + '/api/auth/csrf'); token = (await newCsrf.json()).csrfToken; cookie = newCsrf.headers.getSetCookie()[0].split(';')[0];
  for (let i = 0; i < 9; i++) assert.equal((await send('bad-password')).status, 401);
  const limit = await send('Password123'); assert.equal(limit.status, 429); assert.ok(limit.headers.get('retry-after'));
});
