'use strict';
const { randomBytes, timingSafeEqual } = require('node:crypto');
function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/';
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return '/'; }
  if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded) || /%(?:2f|5c|2e|25)/i.test(decoded)) return '/';
  const url = new URL(value, 'https://internal.invalid');
  if (url.origin !== 'https://internal.invalid') return '/';
  if (!(url.pathname === '/' || url.pathname === '/account' || url.pathname === '/index.html' || /^\/pages\/[^/]+\.html$/.test(decodeURIComponent(url.pathname)))) return '/';
  return url.pathname + url.search + url.hash;
}
function csrfToken(session) { if (!session.csrfToken) session.csrfToken = randomBytes(32).toString('hex'); return session.csrfToken; }
function requireCsrf(origin) {
  return (req, res, next) => {
    const sent = req.get('X-CSRF-Token');
    const token = req.session?.csrfToken;
    const valid = typeof sent === 'string' && typeof token === 'string' && /^[a-f0-9]{64}$/.test(sent) && /^[a-f0-9]{64}$/.test(token) && timingSafeEqual(Buffer.from(sent), Buffer.from(token));
    if (!valid || req.get('Origin') !== origin) return res.status(403).json({ code: 'CSRF_INVALID', message: '页面验证已过期，请重新提交。' });
    next();
  };
}
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const destroySession = req => new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
function requireAuth(users, cookieOptions, cookieName) {
  return async (req, res, next) => {
    const session = req.session;
    const user = session?.userId && session.authExpiresAt > Date.now() ? await users.byId(session.userId) : null;
    if (user?.status === 'active' && session.authExpiresAt > Date.now()) {
      req.authUser = user;
      req.session.cookie.maxAge = session.authExpiresAt - Date.now();
      return next();
    }
    if (session?.userId) { await destroySession(req); res.clearCookie(cookieName, cookieOptions); }
    let pathname;
    try { pathname = decodeURIComponent(req.originalUrl.split('?')[0]); } catch { pathname = ''; }
    const pageRequest = ['GET', 'HEAD'].includes(req.method) && !/^\/api(?:\/|$)/i.test(pathname)
      && (pathname === '/' || /^\/account\/?$/i.test(pathname) || /\.html\/?$/i.test(pathname));
    if (pageRequest) return res.redirect(302, '/login?returnTo=' + encodeURIComponent(safeReturnTo(req.originalUrl)));
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: '请先登录。' });
  };
}
function requireRole(role) { return (req, res, next) => req.authUser?.role === role ? next() : res.status(403).json({ code: 'FORBIDDEN', message: '您没有权限执行此操作。' }); }
module.exports = { safeReturnTo, csrfToken, requireCsrf, saveSession, regenerateSession, destroySession, requireAuth, requireRole };
