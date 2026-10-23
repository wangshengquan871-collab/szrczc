'use strict';
const { loadServerConfig } = require('./server/config/env');
const { createPool, verifyAuthDatabase } = require('./server/config/db');
const { createBackendApp } = require('./server/backend-app');
const { createAuthentication } = require('./server/services/authentication');

async function startServer() {
  const config = loadServerConfig();
  const pool = createPool(config);
  let server, authentication;
  try {
    await verifyAuthDatabase(pool);
    authentication = await createAuthentication(pool, config);
    const app = createBackendApp({ pool, config, authentication });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host);
      listener.once('error', reject);
      listener.once('listening', () => {
        listener.removeListener('error', reject);
        resolve(listener);
      });
    });
  } catch (error) {
    if (authentication) await authentication.store.close().catch(() => {});
    await pool.end().catch(() => {});
    throw error;
  }
  console.log(`后端已启动：${config.origin}/api/health`);
  console.log('MySQL 认证表检查通过。登录：/login；注册：/register；账户：/account。');
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(async () => {
      try { await authentication.store.close(); }
      catch { process.exitCode = 1; }
      try { await pool.end(); }
      catch { process.exitCode = 1; }
      finally { clearTimeout(deadline); }
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  server.on('error', error => {
    console.error('HTTP 服务异常：', error.code || error.name);
    process.exitCode = 1;
    stop();
  });
  return { server, pool, authentication };
}

function startupError(error) {
  if (error.code === 'CONFIG_INVALID') return error.message;
  const reasons = {
    ECONNREFUSED: '无法连接 MySQL，请安装并启动 MySQL 8 服务，检查 DB_HOST 和 DB_PORT。',
    ENOTFOUND: '无法解析数据库主机，请检查 DB_HOST。',
    ETIMEDOUT: '数据库连接超时，请检查网络和 MySQL 服务。',
    ER_ACCESS_DENIED_ERROR: '数据库认证失败，请检查 .env 中的用户名和密码。',
    ER_BAD_DB_ERROR: '数据库不存在，请先执行 npm run db:init。',
    DB_SCHEMA_INVALID: '认证表结构不符合要求，请执行 npm run db:init 并检查用户、Session 和登录审计表。',
    DB_VERSION_UNSUPPORTED: '认证系统需要 MySQL 8.0.16 或更高版本，不支持 MariaDB。',
    EADDRINUSE: '端口已被占用，请检查 PORT 或停止占用该端口的服务。'
  };
  return reasons[error.code] || '后端启动失败，请检查数据库、环境变量和初始化步骤。';
}
if (require.main === module) {
  startServer().catch(error => {
    console.error('启动失败：' + startupError(error));
    process.exitCode = 1;
  });
}
module.exports = { startServer, startupError };
