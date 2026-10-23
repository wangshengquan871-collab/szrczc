'use strict';
// Explicit SQL test double used only in tests. Production never imports this module.
// The real express-mysql-session adapter and bcrypt run against this double.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { readConfig } = require('../../server/config/env');
const { createAuthentication } = require('../../server/services/authentication');
const { createBackendApp } = require('../../server/backend-app');

function sqlDouble() {
  const records = [], sessions = new Map(), audit = [], calls = [];
  const state = { unavailable: false, failSessionWrite: false, failSessionLink: false };
  const normalize = value => String(value).toLowerCase();
  function failure() { if (state.unavailable) throw Object.assign(new Error('test-only database failure'), { code: 'ECONNREFUSED' }); }
  return {
    records, sessions, audit, calls, state,
    async execute(sql, params = []) {
      failure(); calls.push({ sql, params });
      if (sql.startsWith('SELECT username =')) {
        const [username, email] = params;
        return [records.filter(user => normalize(user.username) === normalize(username) || normalize(user.email) === normalize(email)).map(user => ({ username_match: String(Number(normalize(user.username) === normalize(username))), email_match: String(Number(normalize(user.email) === normalize(email))) }))];
      }
      if (sql.startsWith('INSERT INTO users')) {
        const [username, email, password_hash] = params;
        if (records.some(user => normalize(user.username) === normalize(username) || normalize(user.email) === normalize(email))) throw Object.assign(new Error('test-only duplicate'), { code: 'ER_DUP_ENTRY' });
        const id = String(records.length + 1);
        records.push({ id, username, email, password_hash, role: 'user', status: 'active', created_at: new Date(), last_login_at: null });
        return [{ insertId: id }];
      }
      if (sql.startsWith('SELECT * FROM users')) return [records.filter(user => normalize(user.username) === normalize(params[0]) || normalize(user.email) === normalize(params[1])).slice(0, 1)];
      if (sql.startsWith('SELECT id, username')) return [records.filter(user => user.id === String(params[0]))];
      if (sql.startsWith('UPDATE users SET last_login_at')) {
        const user = records.find(user => user.id === String(params[0])); if (user) user.last_login_at = new Date();
        return [{ affectedRows: user ? 1 : 0 }];
      }
      if (sql.startsWith('UPDATE user_sessions SET user_id')) {
        if (state.failSessionLink) return [{ affectedRows: 0 }];
        const row = sessions.get(params[1]); if (row) row.user_id = String(params[0]);
        return [{ affectedRows: row ? 1 : 0 }];
      }
      if (sql.startsWith('INSERT INTO login_logs')) { audit.push(params); return [{ insertId: audit.length }]; }
      throw new Error('Unexpected test SQL: ' + sql);
    },
    async query(sql, params) {
      failure(); calls.push({ sql, params });
      if (sql.startsWith('SELECT ?? AS data')) { const row = sessions.get(params[4]); return [row ? [row] : []]; }
      if (sql.startsWith('INSERT INTO ??')) {
        if (state.failSessionWrite) throw Object.assign(new Error('test-only session write failure'), { code: 'ECONNREFUSED' });
        const row = sessions.get(params[4]) || { user_id: null };
        sessions.set(params[4], { ...row, expires: params[5], data: params[6] });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE ?? SET ??')) { const row = sessions.get(params[4]); if (row) row.expires = params[2]; return [{ affectedRows: row ? 1 : 0 }]; }
      if (sql.startsWith('DELETE FROM ?? WHERE ?? =')) { sessions.delete(params[2]); return [{ affectedRows: 1 }]; }
      if (sql.startsWith('DELETE FROM ?? WHERE ?? <')) { for (const [id, row] of sessions) if (row.expires < params[2]) sessions.delete(id); return [{ affectedRows: 1 }]; }
      throw new Error('Unexpected test Session SQL: ' + sql);
    }
  };
}

async function backendFixture(t, { pool = sqlDouble(), production = false } = {}) {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = readConfig({ NODE_ENV: production ? 'production' : 'test', APP_ORIGIN: production ? 'https://auth-test.invalid' : base,
    TRUST_PROXY: production ? 'loopback' : 'false', SESSION_SECRET: randomBytes(48).toString('hex'),
    DB_HOST: '127.0.0.1', DB_USER: 'unused_sql_double', DB_PASSWORD: 'unused-test-only', DB_NAME: 'suzhou_talent_policy', BCRYPT_COST: '10' });
  const logs = [];
  const logger = { error(...values) { logs.push(values); } };
  const authentication = await createAuthentication(pool, config, logger);
  server.on('request', createBackendApp({ pool, config, authentication, logger }));
  const close = async () => { await new Promise(resolve => server.close(resolve)); await authentication.store.close(); };
  if (t) t.after(close);
  let cookie = '', csrfToken = '';
  const cookieName = production ? '__Host-szp.sid' : 'szp.sid';
  async function request(url, { method = 'GET', body, headers = {}, cookie: suppliedCookie, useCsrf = true } = {}) {
    const sentCookie = suppliedCookie === undefined ? cookie : suppliedCookie;
    const response = await fetch(base + url, { redirect: 'manual', method, headers: {
      ...(production ? { 'X-Forwarded-Proto': 'https' } : {}), ...(sentCookie ? { Cookie: sentCookie } : {}),
      ...(method === 'POST' ? { Origin: config.origin, 'Content-Type': 'application/json', ...(useCsrf ? { 'X-CSRF-Token': csrfToken } : {}) } : {}), ...headers
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (suppliedCookie === undefined) {
      const set = response.headers.getSetCookie().find(value => value.startsWith(cookieName + '='));
      if (set) cookie = set.split(';')[0];
    }
    return response;
  }
  async function csrf() {
    const response = await request('/api/auth/csrf');
    const body = await response.json();
    if (!response.ok) throw new Error('Test CSRF request failed');
    csrfToken = body.csrfToken;
    return csrfToken;
  }
  return { pool, config, authentication, base, close, logs, request, csrf, get cookie() { return cookie; } };
}
module.exports = { sqlDouble, backendFixture };
