'use strict';
const mysql = require('mysql2/promise');

function createPool(config) {
  const pool = mysql.createPool(config.db);
  // The conversion timezone and the SQL connection timezone are separate settings.
  pool.on('connection', connection => connection.query("SET time_zone = '+00:00'", error => {
    if (error) connection.destroy();
  }));
  return pool;
}

async function checkDatabaseConnection(pool, timeout = 5000) {
  const connection = await pool.getConnection();
  let destroyed = false;
  try {
    const [[row]] = await connection.query({ sql: 'SELECT 1 AS ok', timeout });
    // mysql2 returns some integer expressions as strings when bigNumberStrings is enabled.
    if (Number(row?.ok) !== 1) throw Object.assign(new Error('数据库健康检查失败。'), { code: 'DB_CHECK_FAILED' });
  } catch (error) {
    if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT') { connection.destroy(); destroyed = true; }
    throw error;
  } finally {
    if (!destroyed) connection.release();
  }
}

async function verifyDatabase(pool) {
  const [[version]] = await pool.execute('SELECT VERSION() AS version');
  const major = Number(version?.version?.split('.')[0]);
  if (/mariadb/i.test(version?.version || '') || !Number.isInteger(major) || major < 8) {
    throw Object.assign(new Error('需要 MySQL 8.0 或更高版本。'), { code: 'DB_VERSION_UNSUPPORTED' });
  }
  const [database] = await pool.execute('SELECT DEFAULT_CHARACTER_SET_NAME AS charset FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()');
  const [tables] = await pool.execute("SELECT ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'");
  const [columns] = await pool.execute("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'");
  const [indexes] = await pool.execute("SELECT INDEX_NAME AS name, COLUMN_NAME AS columnName, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS position, SUB_PART AS prefixLength FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'");
  const required = ['id', 'username', 'email', 'password_hash', 'status', 'created_at', 'updated_at', 'last_login_at'];
  const names = new Set(columns.map(column => column.name));
  const unique = column => indexes.some(index => {
    const group = indexes.filter(candidate => candidate.name === index.name);
    return Number(index.nonUnique) === 0 && group.length === 1 && index.columnName === column && Number(index.position) === 1 && index.prefixLength === null;
  });
  if (database[0]?.charset !== 'utf8mb4' || tables[0]?.engine !== 'InnoDB'
    || !tables[0]?.collation?.startsWith('utf8mb4_') || required.some(name => !names.has(name))
    || !unique('username') || !unique('email')) {
    throw Object.assign(new Error('数据库或 users 表结构不符合要求，请初始化数据库。'), { code: 'DB_SCHEMA_INVALID' });
  }
  return version.version;
}
async function verifyAuthDatabase(pool) {
  const version = await verifyDatabase(pool);
  const [major, minor, patch] = version.split('.').map(value => Number.parseInt(value, 10));
  if (major === 8 && minor === 0 && patch < 16) throw Object.assign(new Error('认证表需要 MySQL 8.0.16 或更高版本。'), { code: 'DB_VERSION_UNSUPPORTED' });
  const [tables] = await pool.execute("SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('user_sessions','login_logs')");
  const [columns] = await pool.execute("SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users','user_sessions','login_logs')");
  const expected = {
    users: ['role'], user_sessions: ['session_id', 'expires', 'data', 'user_id'],
    login_logs: ['id', 'user_id', 'identifier_hash', 'success', 'reason', 'ip_address', 'user_agent', 'created_at']
  };
  const [indexes] = await pool.execute("SELECT COLUMN_NAME AS name, SEQ_IN_INDEX AS position FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_sessions' AND INDEX_NAME = 'PRIMARY'");
  const valid = tables.length === 2 && tables.every(table => table.engine === 'InnoDB' && table.collation.startsWith('utf8mb4_'))
    && Object.entries(expected).every(([table, names]) => names.every(name => columns.some(column => column.tableName === table && column.name === name)))
    && columns.some(column => column.tableName === 'user_sessions' && column.name === 'session_id' && column.collation === 'utf8mb4_bin')
    && indexes.length === 1 && indexes[0].name === 'session_id' && Number(indexes[0].position) === 1;
  if (!valid) throw Object.assign(new Error('认证表不完整，请执行 npm run db:init。'), { code: 'DB_SCHEMA_INVALID' });
  return version;
}
module.exports = { createPool, checkDatabaseConnection, verifyDatabase, verifyAuthDatabase };
