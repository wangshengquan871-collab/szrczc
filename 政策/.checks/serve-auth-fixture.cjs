'use strict';
// Browser QA only. Never use this fixture as a production server.
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '../全市政策');
const bcrypt = require(path.join(projectRoot, 'node_modules/bcrypt'));
const session = require(path.join(projectRoot, 'node_modules/express-session'));
const { createApp } = require(path.join(projectRoot, 'server/app'));
const { readConfig } = require(path.join(projectRoot, 'server/config/env'));
(async () => {
  const config = readConfig({ NODE_ENV: 'test', APP_ORIGIN: 'http://127.0.0.1:5529', SESSION_SECRET: 'browser-fixture-only-not-production-123456789', DB_HOST: '127.0.0.1', DB_USER: 'unused-test-fixture', DB_PASSWORD: 'unused-test-fixture', DB_NAME: 'suzhou_talent_policy', BCRYPT_COST: '10' });
  config.root = projectRoot;
  const records = [{ id: '1', username: 'browseruser', email: 'browser@example.com', role: 'user', status: 'active', password_hash: await bcrypt.hash('FixturePassword123', 10) }];
  const users = {
    async byId(id) { return records.find(user => user.id === String(id)); },
    async byIdentifier(identifier) { return records.find(user => user.username === identifier || user.email === identifier); },
    async duplicates(username, email) { const fields = {}; if (records.some(user => user.username === username)) fields.username = '用户名重复'; if (records.some(user => user.email === email)) fields.email = '邮箱重复'; return fields; },
    async create(username, email, password_hash) { const id = String(records.length + 1); records.push({ id, username, email, password_hash, role: 'user', status: 'active' }); return id; },
    async markLogin() {}, async linkSession() {}, async audit() {}
  };
  const store = new session.MemoryStore();
  const app = createApp({ config, users, store, dummyHash: await bcrypt.hash('FixtureDummy123', 10) });
  const server = app.listen(5529, '127.0.0.1', () => console.log('QA fixture only: http://127.0.0.1:5529/login; NOT MySQL-backed.'));
  const stop = () => server.close(() => process.exit());
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})();
