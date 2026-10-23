'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');

function invalid(message) { throw Object.assign(new Error(message), { code: 'CONFIG_INVALID' }); }
function required(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || !value.trim() || /^replace_with/i.test(value)) invalid(`请在 .env 中配置 ${key}。`);
  return value;
}
function integer(env, key, fallback, min, max) {
  const value = Number(env[key] === undefined || env[key] === '' ? fallback : env[key]);
  if (!Number.isInteger(value) || value < min || value > max) invalid(`${key} 配置无效。`);
  return value;
}
function readBackendConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) invalid('NODE_ENV 配置无效。');
  const production = nodeEnv === 'production';
  const host = required(env, 'DB_HOST');
  const user = required(env, 'DB_USER');
  if (production && user.toLowerCase() === 'root') invalid('生产环境请使用权限最小化的数据库账户。');
  const database = required(env, 'DB_NAME');
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database)) invalid('DB_NAME 配置无效。');
  if (env.DB_SSL !== undefined && !['true', 'false'].includes(env.DB_SSL)) invalid('DB_SSL 必须为 true 或 false。');
  const tls = env.DB_SSL === 'true';
  if (!['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) && !tls) invalid('远程 MySQL 必须启用 DB_SSL 并验证证书。');
  let ssl;
  if (tls) {
    const caPath = required(env, 'DB_SSL_CA');
    let ca;
    try { ca = fs.readFileSync(path.resolve(ROOT, caPath), 'utf8'); }
    catch { invalid('无法读取 DB_SSL_CA 指定的证书文件。'); }
    ssl = { ca, rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
  }
  const proxy = env.TRUST_PROXY || 'false';
  if (!['false', 'loopback'].includes(proxy)) invalid('TRUST_PROXY 仅支持 false 或 loopback。');
  return {
    root: ROOT, nodeEnv, production, host: env.HOST || '127.0.0.1',
    port: integer(env, 'PORT', 3000, 1, 65535), trustProxy: proxy === 'loopback' ? 'loopback' : false,
    dbQueryTimeoutMs: integer(env, 'DB_QUERY_TIMEOUT_MS', 5000, 100, 60000),
    db: {
      host, port: integer(env, 'DB_PORT', 3306, 1, 65535), user,
      password: required(env, 'DB_PASSWORD'), database,
      connectionLimit: integer(env, 'DB_CONNECTION_LIMIT', 10, 1, 50),
      waitForConnections: true, queueLimit: 100,
      connectTimeout: integer(env, 'DB_CONNECT_TIMEOUT_MS', 5000, 100, 60000),
      charset: 'utf8mb4', timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true,
      ...(ssl ? { ssl } : {})
    }
  };
}

// Authentication requires a persistent signing key and an exact CSRF origin.
function readConfig(env = process.env, baseConfig) {
  const secret = required(env, 'SESSION_SECRET');
  if (secret.length < 32) invalid('SESSION_SECRET 至少需要 32 个字符。');
  let origin;
  try { origin = new URL(required(env, 'APP_ORIGIN')); }
  catch (error) { if (error.code === 'CONFIG_INVALID') throw error; invalid('APP_ORIGIN 必须是有效的网站源地址。'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) invalid('APP_ORIGIN 必须是网站源地址，不含路径。');
  const config = baseConfig || readBackendConfig(env);
  if (config.production && origin.protocol !== 'https:') invalid('生产环境 APP_ORIGIN 必须使用 HTTPS。');
  return {
    ...config, origin: origin.origin, sessionSecret: secret,
    sessionMs: integer(env, 'SESSION_HOURS', 8, 1, 24) * 3600000,
    rememberMs: integer(env, 'REMEMBER_DAYS', 14, 1, 30) * 86400000,
    bcryptCost: integer(env, 'BCRYPT_COST', 12, 10, 14)
  };
}
function readEnvFile() { require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true }); }
function loadBackendConfig() { readEnvFile(); return readBackendConfig(); }
function loadConfig() { readEnvFile(); return readConfig(); }
function loadServerConfig() { readEnvFile(); return readConfig(process.env, readBackendConfig()); }
module.exports = { ROOT, readConfig, loadConfig, readBackendConfig, loadBackendConfig, loadServerConfig };
