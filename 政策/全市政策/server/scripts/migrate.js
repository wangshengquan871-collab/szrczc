'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { loadConfig } = require('../config/env');
(async () => {
  let connection;
  let locked = false;
  try {
    const config = loadConfig();
    const { database, connectionLimit, queueLimit, waitForConnections, ...options } = config.db;
    connection = await mysql.createConnection({ ...options,
      user: process.env.MIGRATION_DB_USER || options.user,
      password: process.env.MIGRATION_DB_PASSWORD || options.password });
    await connection.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci', [database]);
    await connection.changeUser({ database });
    await connection.execute("SET time_zone = '+00:00'");
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 10) AS locked', [`${database}:auth-migrations`]);
    if (lock.locked !== 1) throw new Error('另一个迁移正在执行，请稍后重试。');
    locked = true;
    const sql = await fs.readFile(path.join(config.root, 'database/001-auth.sql'), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    // Only this trusted, repository-owned SQL is split; no user-supplied SQL is accepted.
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    await connection.query(statements.find(s => /^CREATE TABLE IF NOT EXISTS schema_migrations/i.test(s)));
    const [rows] = await connection.execute('SELECT checksum FROM schema_migrations WHERE version = ?', ['001-auth']);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error('已应用的迁移校验不一致；请新增迁移，不要覆盖历史迁移。');
      console.log('001-auth 已应用，无需重复执行。');
    } else {
      for (const statement of statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', ['001-auth', checksum]);
      console.log('001-auth 迁移完成。');
    }
  } catch (error) { console.error(error.code ? `迁移失败：${error.code}。请检查服务、连接配置与迁移账户权限。` : error.message); process.exitCode = 1; }
  finally {
    if (connection) { if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [`${process.env.DB_NAME}:auth-migrations`]).catch(() => {}); await connection.end(); }
  }
})();
