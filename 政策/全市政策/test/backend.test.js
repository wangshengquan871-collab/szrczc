'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const session = require('express-session');
const { readBackendConfig, readConfig } = require('../server/config/env');
const { createPool, checkDatabaseConnection, verifyDatabase } = require('../server/config/db');
const { createBackendApp } = require('../server/backend-app');
const { initializeDatabase } = require('../server/scripts/init-db');

// All database results below are explicit test doubles, not a successful MySQL connection.
const env = { NODE_ENV: 'test', APP_ORIGIN: 'http://127.0.0.1:3000', SESSION_SECRET: 'backend-test-only-secret-not-for-deployment-12345', DB_HOST: '127.0.0.1', DB_USER: 'test_only', DB_PASSWORD: 'test-only-never-used-to-connect', DB_NAME: 'suzhou_talent_policy' };
const columns = ['id', 'username', 'email', 'password_hash', 'status', 'created_at', 'updated_at', 'last_login_at'];
const indexes = ['username', 'email'].map(name => ({ name: 'uq_' + name, columnName: name, nonUnique: 0, position: 1, prefixLength: null }));
function metadata(overrides = {}) {
  const rows = { version: [{ version: '8.0.42' }], database: [{ charset: 'utf8mb4' }], tables: [{ engine: 'InnoDB', collation: 'utf8mb4_0900_as_ci' }], columns: columns.map(name => ({ name })), indexes, ...overrides };
  return { async execute(sql) {
    if (sql.includes("TABLE_NAME IN ('user_sessions','login_logs')")) return [[{ name: 'user_sessions', engine: 'InnoDB', collation: 'utf8mb4_bin' }, { name: 'login_logs', engine: 'InnoDB', collation: 'utf8mb4_0900_as_ci' }]];
    if (sql.includes("TABLE_NAME IN ('users','user_sessions','login_logs')")) return [[{ tableName: 'users', name: 'role' }, ...['session_id','expires','data','user_id'].map(name => ({ tableName: 'user_sessions', name, collation: name === 'session_id' ? 'utf8mb4_bin' : null })), ...['id','user_id','identifier_hash','success','reason','ip_address','user_agent','created_at'].map(name => ({ tableName: 'login_logs', name }))]];
    if (sql.includes("TABLE_NAME = 'user_sessions' AND INDEX_NAME = 'PRIMARY'")) return [[{ name: 'session_id', position: 1 }]];
    if (sql.includes('VERSION()')) return [rows.version];
    if (sql.includes('SCHEMATA')) return [rows.database];
    if (sql.includes('TABLES')) return [rows.tables];
    if (sql.includes('COLUMNS')) return [rows.columns];
    if (sql.includes('STATISTICS')) return [rows.indexes];
    if (sql.startsWith('SET time_zone')) return [[]];
    throw new Error('Unexpected test query');
  } };
}
function healthPool({ queryError, connectError, row = { ok: 1 } } = {}) {
  const state = { released: 0, destroyed: 0, queries: [] };
  return { state, async getConnection() {
    if (connectError) throw connectError;
    return {
      async query(query) { state.queries.push(query); if (queryError) throw queryError; return [[row]]; },
      release() { state.released++; }, destroy() { state.destroyed++; }
    };
  } };
}
async function serve(t, pool) {
  const logs = [];
  const store = new session.MemoryStore();
  const app = createBackendApp({ pool, config: readConfig(env), authentication: { store, users: { async byId() {} }, dummyHash: 'unused-in-health-tests' }, logger: { error(...args) { logs.push(args); } } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { store.clear(() => {}); server.close(resolve); }));
  return { base: `http://127.0.0.1:${server.address().port}`, logs };
}

test('后端基础配置不依赖登录密钥，默认端口3000，密码由环境变量提供', () => {
  const config = readBackendConfig(env);
  assert.equal(config.port, 3000);
  assert.equal(config.db.password, env.DB_PASSWORD);
  assert.equal(config.db.database, 'suzhou_talent_policy');
  assert.equal(config.db.charset, 'utf8mb4');
  assert.equal(config.sessionSecret, undefined);
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    assert.throws(() => readBackendConfig({ ...env, [key]: undefined }), error => error.code === 'CONFIG_INVALID' && error.message.includes(key));
  }
  assert.throws(() => readBackendConfig({ ...env, DB_PASSWORD: 'replace_with_your_database_password' }), /DB_PASSWORD/);
  assert.throws(() => readBackendConfig({ ...env, DB_NAME: 'db;DROP DATABASE other' }), /DB_NAME/);
  assert.throws(() => readBackendConfig({ ...env, PORT: '70000' }), /PORT/);
  assert.throws(() => readBackendConfig({ ...env, DB_SSL: 'invalid' }), /DB_SSL/);
  assert.throws(() => readBackendConfig({ ...env, DB_HOST: 'remote.example' }), /远程 MySQL/);
});

test('mysql2/promise 连接池可以创建并关闭；此测试不发起数据库连接', async () => {
  const pool = createPool(readBackendConfig(env));
  assert.equal(typeof pool.getConnection, 'function');
  assert.equal(typeof pool.execute, 'function');
  await pool.end();
});

test('GET /api/health 成功、禁用缓存并释放连接（数据库替身）', async t => {
  const pool = healthPool();
  const { base } = await serve(t, pool);
  const response = await fetch(base + '/api/health');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'connected');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(pool.state.released, 1);
  assert.equal(pool.state.queries[0].sql, 'SELECT 1 AS ok');
});

test('健康检查连接失败返回503，响应不泄露密码或数据库错误详情', async t => {
  const failure = Object.assign(new Error('sensitive-database-password'), { code: 'ECONNREFUSED' });
  const { base, logs } = await serve(t, healthPool({ connectError: failure }));
  const response = await fetch(base + '/api/health');
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal(JSON.parse(text).database, 'unavailable');
  assert.ok(!text.includes('sensitive-database-password'));
  assert.deepEqual(logs[0], ['数据库健康检查失败：', 'ECONNREFUSED']);
});

test('SQL失败释放连接，查询超时销毁连接，失败结果不会标记健康', async () => {
  const stringResult = healthPool({ row: { ok: '1' } });
  await checkDatabaseConnection(stringResult);
  assert.equal(stringResult.state.released, 1);
  const failed = healthPool({ queryError: Object.assign(new Error('query failed'), { code: 'ER_TEST' }) });
  await assert.rejects(checkDatabaseConnection(failed), { code: 'ER_TEST' });
  assert.equal(failed.state.released, 1);
  const timed = healthPool({ queryError: Object.assign(new Error('timeout'), { code: 'PROTOCOL_SEQUENCE_TIMEOUT' }) });
  await assert.rejects(checkDatabaseConnection(timed), { code: 'PROTOCOL_SEQUENCE_TIMEOUT' });
  assert.equal(timed.state.destroyed, 1);
  assert.equal(timed.state.released, 0);
  await assert.rejects(checkDatabaseConnection(healthPool({ row: { ok: 0 } })), { code: 'DB_CHECK_FAILED' });
});

test('未登录时页面跳转，原站资源及配置不能被静态路径读取', async t => {
  const pool = healthPool();
  const { base } = await serve(t, pool);
  const root = path.resolve(__dirname, '../苏州人才政策');
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const routes = ['/', '/INDEX.HTML', '/登录注册.html', '/auth/js/auth.js', '/.env', '/server.js', '/database/schema.sql', '/苏州人才政策/index.html', ...walk(root).map(file => '/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/'))];
  for (const route of routes) {
    const response = await fetch(base + route, { redirect: 'manual', headers: { Cookie: 'szp.sid=fake-old-cookie' } });
    if (route === '/' || /\.html$/i.test(decodeURIComponent(route))) {
      assert.equal(response.status, 302, route);
      assert.match(response.headers.get('location'), /^\/login/, route);
    } else {
      assert.equal(response.status, 401, route);
      assert.equal((await response.json()).code, 'AUTH_REQUIRED', route);
    }
  }
  assert.equal(pool.state.queries.length, 0);
  assert.equal((await fetch(base + '/api/auth/me')).status, 401);
});

test('错误JSON返回400，大请求返回413，未登录访问未知API返回401', async t => {
  const { base } = await serve(t, healthPool());
  const invalid = await fetch(base + '/api/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_JSON');
  const large = await fetch(base + '/api/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(17000) }) });
  assert.equal(large.status, 413);
  assert.equal((await large.json()).code, 'PAYLOAD_TOO_LARGE');
  assert.equal((await fetch(base + '/api/missing')).status, 401);
  assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 401);
});

test('检查MySQL版本、utf8mb4、必需字段和完整单列唯一索引（数据库替身）', async () => {
  assert.equal(await verifyDatabase(metadata()), '8.0.42');
  assert.equal(await verifyDatabase(metadata({ indexes: indexes.map(index => ({ ...index, nonUnique: '0', position: '1' })) })), '8.0.42');
  for (const version of ['5.7.44', '10.11.0-MariaDB', 'not-a-version']) {
    await assert.rejects(verifyDatabase(metadata({ version: [{ version }] })), { code: 'DB_VERSION_UNSUPPORTED' });
  }
  const invalidSchemas = [
    { database: [{ charset: 'latin1' }] }, { tables: [] },
    { tables: [{ engine: 'MyISAM', collation: 'utf8mb4_general_ci' }] },
    { columns: columns.filter(name => name !== 'password_hash').map(name => ({ name })) },
    { indexes: indexes.filter(index => index.columnName !== 'email') },
    { indexes: indexes.map(index => ({ ...index, nonUnique: 1 })) },
    { indexes: indexes.map(index => ({ ...index, prefixLength: 10 })) },
    { indexes: [...indexes, { ...indexes[0], columnName: 'status', position: 2 }] }
  ];
  for (const overrides of invalidSchemas) await assert.rejects(verifyDatabase(metadata(overrides)), { code: 'DB_SCHEMA_INVALID' });
});

test('初始化执行建库建表、使用.env指定凭据，结束连接（数据库替身）', async () => {
  const config = readBackendConfig({ ...env, DB_NAME: 'test_only_schema' });
  const queries = [];
  let options, closed = false;
  const connection = { ...metadata(), async query(sql) { queries.push(sql); }, async end() { closed = true; } };
  const version = await initializeDatabase(config, { env: { MIGRATION_DB_USER: 'migration_test_only', MIGRATION_DB_PASSWORD: 'migration-test-only' }, async connect(value) { options = value; return connection; } });
  assert.equal(version, '8.0.42');
  assert.equal(options.database, undefined);
  assert.equal(options.user, 'migration_test_only');
  assert.equal(options.password, 'migration-test-only');
  assert.ok(queries.some(sql => sql.includes('CREATE DATABASE IF NOT EXISTS `test_only_schema`')));
  assert.ok(queries.some(sql => sql === 'USE `test_only_schema`'));
  assert.ok(queries.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS users')));
  assert.ok(queries.every(sql => !/^(?:DROP|TRUNCATE|DELETE)\b/i.test(sql)));
  assert.equal(closed, true);
});

test('初始化失败关闭连接，迁移凭据必须成对配置', async () => {
  const config = readBackendConfig(env);
  let closed = false;
  await assert.rejects(initializeDatabase(config, { env: {}, async connect() { return { async execute() {}, async query() { throw Object.assign(new Error('denied'), { code: 'ER_ACCESS_DENIED_ERROR' }); }, async end() { closed = true; } }; } }), { code: 'ER_ACCESS_DENIED_ERROR' });
  assert.equal(closed, true);
  await assert.rejects(initializeDatabase(config, { env: { MIGRATION_DB_USER: 'only-user' } }), { code: 'CONFIG_INVALID' });
});

test('缺少数据库配置时生产入口非零退出，不输出已启动或连接成功', () => {
  const childEnv = { ...process.env, NODE_ENV: 'test', DB_HOST: '' };
  const child = spawnSync(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: childEnv, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /DB_HOST/);
  assert.doesNotMatch(child.stdout, /后端已启动|连接.*通过/);
});
