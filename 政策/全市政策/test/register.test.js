'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { renderAuthPage } = require('../server/views/auth-page');
const { registrationValues } = require('../server/routes/auth');
const { registerFixture } = require('./helpers/register-fixture');
const valid = { username: 'newuser', email: 'new@example.com', password: 'Password123', confirmPassword: 'Password123' };

test('/register 初始 HTML 即为注册页面，共享素材并保留登录链接', async () => {
  const root = path.resolve(__dirname, '..');
  const html = await renderAuthPage(root, 'register', '/pages/昆山.html');
  assert.match(html, /<title>创建账户 · 苏州人才政策<\/title>/);
  assert.match(html, /<body class="szpa-page szpa-register">/);
  assert.match(html, /id="szpa-form-title" tabindex="-1">创建账户/);
  assert.match(html.match(/<form id="szpa-login-form"[^>]*>/)[0], / hidden/);
  assert.doesNotMatch(html.match(/<form id="szpa-register-form"[^>]*>/)[0], / hidden/);
  assert.match(html, /href="\/login\?returnTo=/);
  assert.match(html, /已有账号？/);
  assert.match(html, /src="auth\/js\/auth.js"/);
  const login = await renderAuthPage(root, 'login', '//evil.example');
  assert.match(login, /href="\/register"/);
  assert.match(login, /id="szpa-form-title" tabindex="-1">欢迎登录/);
  assert.match(login.match(/<form id="szpa-register-form"[^>]*>/)[0], / hidden/);
});

test('后端覆盖空值、长度边界、邮箱格式与确认密码', () => {
  for (const username of ['', '  ', 'ab', 'a'.repeat(31)]) assert.ok(registrationValues({ ...valid, username }).fields.username);
  for (const username of ['abc', 'a'.repeat(30), '用户甲']) assert.equal(registrationValues({ ...valid, username }).fields.username, undefined);
  for (const email of ['', 'invalid', 'user@', 'a@b']) assert.ok(registrationValues({ ...valid, email }).fields.email);
  for (const password of ['a'.repeat(7), 'a'.repeat(65), '密'.repeat(25)]) assert.ok(registrationValues({ ...valid, password, confirmPassword: password }).fields.password);
  for (const password of ['a'.repeat(8), 'a'.repeat(64), '密'.repeat(24)]) assert.equal(registrationValues({ ...valid, password, confirmPassword: password }).fields.password, undefined);
  for (const confirmPassword of [undefined, '', 'different', 123]) assert.ok(registrationValues({ ...valid, confirmPassword }).fields.confirmPassword);
  for (const body of [null, [], 'invalid', 123]) assert.equal(Object.keys(registrationValues(body).fields).length, 4);
  const normalized = registrationValues({ ...valid, username: ' ＡＢＣ ', email: ' NEW@EXAMPLE.COM ' });
  assert.equal(normalized.username, 'ABC'); assert.equal(normalized.email, 'new@example.com');
});

test('注册写入参数化查询、bcrypt 哈希和普通用户角色（数据库替身）', async t => {
  const fixture = await registerFixture(t);
  for (const route of ['/register', '/register/', '/REGISTER']) {
    const page = await fetch(fixture.origin + route);
    assert.equal(page.status, 200); assert.match(await page.text(), /id="szpa-form-title" tabindex="-1">创建账户/);
  }
  const result = await fixture.submit({ ...valid, username: ' ＡＢＣ ', email: ' NEW@EXAMPLE.COM ', role: 'admin', status: 'disabled' });
  assert.equal(result.status, 201); assert.equal(result.body.redirect, '/login');
  assert.equal(fixture.records.length, 1);
  const user = fixture.records[0]; assert.equal(user.username, 'ABC'); assert.equal(user.email, 'new@example.com');
  assert.equal(user.role, 'user'); assert.equal(user.status, 'active');
  assert.match(user.password_hash, /^\$2b\$/); assert.ok(await bcrypt.compare(valid.password, user.password_hash));
  assert.ok(!JSON.stringify(result.body).includes(user.password_hash));
  const insertion = fixture.calls.find(call => call.sql.startsWith('INSERT'));
  assert.match(insertion.sql, /VALUES \(\?, \?, \?\)/); assert.doesNotMatch(insertion.sql, /new@example/);
  const me = await fetch(fixture.origin + '/api/auth/me', { headers: { Cookie: fixture.cookie } });
  assert.equal(me.status, 401, 'Registration must not silently log the user in');
});

test('用户名、邮箱及两者重复分别返回对应字段提示（数据库替身）', async t => {
  const fixture = await registerFixture(t, { records: [{ id: '1', username: 'existing', email: 'existing@example.com' }] });
  const username = await fixture.submit({ ...valid, username: 'EXISTING' });
  assert.equal(username.status, 409); assert.match(username.body.fields.username, /用户名/); assert.equal(username.body.fields.email, undefined);
  const email = await fixture.submit({ ...valid, email: 'EXISTING@EXAMPLE.COM' });
  assert.equal(email.status, 409); assert.match(email.body.fields.email, /邮箱/); assert.equal(email.body.fields.username, undefined);
  const both = await fixture.submit({ ...valid, username: 'existing', email: 'existing@example.com' });
  assert.equal(both.status, 409); assert.ok(both.body.fields.username && both.body.fields.email);
  assert.equal(fixture.records.length, 1);
});

test('数据库唯一约束竞争错误转换为友好重复提示（数据库替身）', async t => {
  const fixture = await registerFixture(t, { race: true });
  const result = await fixture.submit(valid);
  assert.equal(result.status, 409); assert.equal(result.body.code, 'DUPLICATE_ACCOUNT');
  assert.ok(result.body.fields.username && result.body.fields.email);
  assert.equal(fixture.records.length, 1);
});

test('绕过前端的无效字段被接口拒绝，不执行入库（数据库替身）', async t => {
  const fixture = await registerFixture(t);
  const cases = [{ ...valid, username: '' }, { ...valid, email: 'bad' }, { ...valid, password: 'short' }, { ...valid, confirmPassword: 'wrong' }, []];
  for (const body of cases) { const result = await fixture.submit(body); assert.equal(result.status, 422); assert.equal(result.body.code, 'VALIDATION_ERROR'); }
  assert.equal(fixture.records.length, 0); assert.equal(fixture.calls.length, 0);
});
