'use strict';
const express = require('express');
const helmet = require('helmet');
const { ROOT } = require('../config/env');
const { authPageRouter } = require('../routes/auth-pages');

// Frontend preview only: no account fixtures, database, or simulated API success.
function createAuthPreviewApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(authPageRouter({ root: ROOT }));
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: '接口尚未开放。' }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ message: '页面暂时无法加载。' });
  });
  return app;
}
if (require.main === module) {
  const port = Number(process.env.AUTH_PREVIEW_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('AUTH_PREVIEW_PORT 配置无效。');
  const server = createAuthPreviewApp().listen(port, '127.0.0.1', () => console.log(`账户界面预览：http://127.0.0.1:${port}/login（不连接数据库，认证 API 尚未开放）`));
  server.on('error', error => { console.error('预览启动失败：', error.code); process.exitCode = 1; });
  const stop = () => server.close();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
module.exports = { createAuthPreviewApp };
