'use strict';
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const fs = require('node:fs/promises');
const path = require('node:path');
const { authRouter } = require('./routes/auth');
const { requireAuth } = require('./middleware/security');
const { renderAuthPage } = require('./views/auth-page');
function createApp({ config, users, store, dummyHash }) {
  if (!store || !users || !dummyHash) throw new Error('真实会话存储、账户服务与密码验证配置不可缺失。');
  const app = express();
  const siteRoot = path.join(config.root, '苏州人才政策');
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"],
    formAction: ["'self'"], upgradeInsecureRequests: config.production ? [] : null
  } }, strictTransportSecurity: config.production ? undefined : false }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  // Public assets are explicitly limited to the authentication UI, never the policy directory.
  app.use('/auth', express.static(path.join(config.root, 'auth'), { dotfiles: 'deny', index: false, redirect: false, etag: false, cacheControl: false }));
  app.get(['/login', '/register', '/登录注册.html', '/' + encodeURIComponent('登录注册.html')], async (req, res) => {
    const html = await renderAuthPage(config.root, /^\/register\/?$/i.test(req.path) ? 'register' : 'login', req.query.returnTo);
    res.type('html').send(html);
  });
  app.use(express.json({ limit: '16kb' }));
  const cookieName = config.production ? '__Host-szp.sid' : 'szp.sid';
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
  app.use(session({ name: cookieName, secret: config.sessionSecret, store, resave: false, saveUninitialized: false, rolling: true,
    cookie: { ...cookieOptions, maxAge: config.sessionMs } }));
  const guard = requireAuth(users, cookieOptions, cookieName);
  app.use('/api/auth', authRouter({ config, users, store, requireAuth: guard, cookieName, cookieOptions, dummyHash }));
  app.use(guard);
  // Inject account controls into the HTTP response only. Existing policy HTML remains unchanged on disk.
  app.use(async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    if (req.path !== '/' && !req.path.endsWith('.html')) return next();
    let requested;
    try { requested = decodeURIComponent(req.path === '/' ? '/index.html' : req.path); } catch { return res.sendStatus(400); }
    const resolved = path.resolve(siteRoot, '.' + requested);
    if (!resolved.startsWith(siteRoot + path.sep) || requested.includes('\\') || requested.includes('\0')) return res.sendStatus(404);
    let html;
    try { html = await fs.readFile(resolved, 'utf8'); } catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') return next(); throw error; }
    const injection = '<link rel="stylesheet" href="/auth/css/account.css"><script defer src="/auth/js/account.js"></script>';
    res.type('html').send(html.replace(/<\/head>/i, injection + '</head>'));
  });
  app.use(express.static(siteRoot, { dotfiles: 'deny', index: false, redirect: false, etag: false, cacheControl: false }));
  app.use((_req, res) => res.status(404).json({ message: '未找到此页面或资源。' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: '请求格式无效。' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: '提交的内容过长。' });
    console.error('Request failed:', error.code || error.name);
    res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: '服务暂不可用，请稍后重试。' });
  });
  return app;
}
module.exports = { createApp };
