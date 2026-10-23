'use strict';
// Explicit database/session doubles for HTTP tests. This helper never enters the production bootstrap.
const path = require('node:path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { createApp } = require('../../server/app');
const { createUsers } = require('../../server/services/users');
const { readConfig } = require('../../server/config/env');

async function registerFixture(t, { records = [], race = false, unavailable = false } = {}) {
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (unavailable) throw Object.assign(new Error('test-only database failure'), { code: 'ECONNREFUSED' });
      if (sql.startsWith('SELECT username =')) {
        const [username, email] = params;
        return [records.filter(user => user.username.toLowerCase() === username.toLowerCase() || user.email === email).map(user => ({ username_match: Number(user.username.toLowerCase() === username.toLowerCase()), email_match: Number(user.email === email) }))];
      }
      if (sql.startsWith('INSERT INTO users')) {
        const [username, email, password_hash] = params;
        if (race) { records.push({ id: '1', username, email, password_hash: 'existing-test-hash', role: 'user', status: 'active' }); race = false; }
        if (records.some(user => user.username.toLowerCase() === username.toLowerCase() || user.email === email)) throw Object.assign(new Error('duplicate test account'), { code: 'ER_DUP_ENTRY' });
        const id = String(records.length + 1);
        records.push({ id, username, email, password_hash, role: 'user', status: 'active' });
        return [{ insertId: id }];
      }
      throw new Error('Unexpected test query');
    }
  };
  const config = readConfig({ NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:3000', SESSION_SECRET: 'registration-test-only-secret-1234567890', DB_HOST: '127.0.0.1', DB_USER: 'unused-test', DB_PASSWORD: 'unused-test', DB_NAME: 'suzhou_talent_policy', BCRYPT_COST: '10' });
  config.root = path.resolve(__dirname, '../..');
  const store = new session.MemoryStore();
  const app = createApp({ config, users: createUsers(pool, config.sessionSecret), store, dummyHash: await bcrypt.hash('dummy-test-password', 10) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { store.clear(() => {}); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const csrf = await fetch(origin + '/api/auth/csrf');
  const token = (await csrf.json()).csrfToken;
  const cookie = csrf.headers.getSetCookie()[0].split(';')[0];
  return {
    records, calls, origin, cookie,
    async submit(body) {
      const response = await fetch(origin + '/api/auth/register', { method: 'POST', headers: { Origin: config.origin, Cookie: cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }
  };
}
module.exports = { registerFixture };
