'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('../config/env');
const child = spawnSync(process.execPath, ['--test', path.join(ROOT, 'test/mysql-auth.integration.test.js')], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, RUN_MYSQL_TESTS: '1' }
});
if (child.error) console.error('无法启动 MySQL 测试：', child.error.code);
process.exitCode = child.status === null ? 1 : child.status;
