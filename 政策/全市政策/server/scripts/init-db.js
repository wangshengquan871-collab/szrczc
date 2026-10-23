'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { loadBackendConfig } = require('../config/env');
const { verifyAuthDatabase } = require('../config/db');
const { startupError } = require('../../server');

async function initializeDatabase(config, { connect = mysql.createConnection, env = process.env } = {}) {
  const { database, connectionLimit, queueLimit, waitForConnections, ...options } = config.db;
  for (const key of ['MIGRATION_DB_USER', 'MIGRATION_DB_PASSWORD']) {
    if (env[key] !== undefined && (!env[key].trim() || /^replace_with/i.test(env[key]))) {
      throw Object.assign(new Error(`请在 .env 中正确配置 ${key}，或移除它以使用 DB_USER。`), { code: 'CONFIG_INVALID' });
    }
  }
  if (!!env.MIGRATION_DB_USER !== !!env.MIGRATION_DB_PASSWORD) {
    throw Object.assign(new Error('MIGRATION_DB_USER 和 MIGRATION_DB_PASSWORD 必须同时配置。'), { code: 'CONFIG_INVALID' });
  }
  const sql = await fs.readFile(path.join(config.root, 'database/schema.sql'), 'utf8');
  // Only trusted repository SQL is split. The validated database name is escaped as an identifier.
  const statements = sql.replace(/`suzhou_talent_policy`/g, mysql.escapeId(database))
    .replace(/^\s*--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
  const connection = await connect({ ...options,
    user: env.MIGRATION_DB_USER || options.user,
    password: env.MIGRATION_DB_PASSWORD || options.password });
  try {
    await connection.execute("SET time_zone = '+00:00'");
    for (const statement of statements) await connection.query(statement);
    return await verifyAuthDatabase(connection);
  } finally { await connection.end(); }
}
if (require.main === module) {
  (async () => {
    const config = loadBackendConfig();
    const version = await initializeDatabase(config);
    console.log(`MySQL ${version}：${config.db.database} 的用户、Session 和登录审计表已初始化并验证。`);
  })().catch(error => {
    console.error('初始化失败：' + startupError(error));
    process.exitCode = 1;
  });
}
module.exports = { initializeDatabase };
