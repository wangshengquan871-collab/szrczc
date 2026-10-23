'use strict';
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const { checkDatabaseConnection } = require('./config/db');
const { authPageRouter, renderAccountPage } = require('./routes/auth-pages');
const { authRouter } = require('./routes/auth');
const { policySiteRouter } = require('./routes/policy-site');
const { requireAuth } = require('./middleware/security');
const { sessionOptions } = require('./services/authentication');

function createBackendApp({ pool, config, authentication, logger = console }) {
  if (!pool) throw new Error('数据库连接池不可缺失。');
  if (!authentication?.store || !authentication.users || !authentication.dummyHash || !config.sessionSecret || !config.origin) throw new Error('真实认证服务和 Session 配置不可缺失。');
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ strictTransportSecurity: config.production ? undefined : false,
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: config.production ? [] : null } } }));
  app.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache', Expires: '0' }); next(); });
  app.use(express.json({ limit: '16kb' }));
  app.use(authPageRouter(config));
  app.get('/api/health', async (_req, res) => {
    try { await checkDatabaseConnection(pool, config.dbQueryTimeoutMs); }
    catch (error) {
      logger.error('数据库健康检查失败：', error.code || error.name);
      return res.status(503).json({ status: 'error', database: 'unavailable', message: '数据库暂不可用。' });
    }
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  });
  const { cookieName, cookieOptions, options } = sessionOptions(config, authentication.store);
  app.use(session(options));
  const guard = requireAuth(authentication.users, cookieOptions, cookieName);
  app.use('/api/auth', authRouter({ config, ...authentication, requireAuth: guard, cookieName, cookieOptions, defaultRedirect: '/index.html' }));
  app.get('/account', guard, async (req, res) => {
    if (req.path !== '/account') return res.redirect(308, '/account');
    res.type('html').send(await renderAccountPage(config));
  });
  // Every policy page, data file, asset and download passes the server-side session guard.
  app.use(guard);
  app.use('/api', (_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在。' }));
  app.use(policySiteRouter(config));
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在。' }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ code: 'INVALID_JSON', message: '请求 JSON 格式无效。' });
    if (error.type === 'entity.too.large') return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '请求内容过长。' });
    logger.error('请求处理失败：', error.code || error.name);
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(error.code)) return res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: '账户服务暂不可用，请稍后重试。' });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务内部错误。' });
  });
  return app;
}
module.exports = { createBackendApp };
