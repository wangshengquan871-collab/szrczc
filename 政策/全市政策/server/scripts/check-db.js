'use strict';
const { loadBackendConfig } = require('../config/env');
const { createPool, verifyAuthDatabase } = require('../config/db');
const { startupError } = require('../../server');
(async () => {
  let pool;
  try { pool = createPool(loadBackendConfig()); const version = await verifyAuthDatabase(pool); console.log(`MySQL ${version} 连接成功，用户、Session、登录审计表及唯一索引检查通过。`); }
  catch (error) { console.error('数据库检查失败：' + startupError(error)); process.exitCode = 1; }
  finally { if (pool) await pool.end(); }
})();
