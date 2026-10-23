'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const { rateLimit } = require('express-rate-limit');
const { safeReturnTo, csrfToken, requireCsrf, saveSession, regenerateSession, destroySession } = require('../middleware/security');
function registrationValues(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const username = typeof body.username === 'string' ? body.username.normalize('NFKC').trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fields = {};
  if (Array.from(username).length < 3 || Array.from(username).length > 30 || !/^[\p{L}\p{N}_-]+$/u.test(username)) fields.username = '用户名需为 3–30 个字符，支持中文、字母、数字、下划线及短横线。';
  if (email.length > 254 || !validator.isEmail(email)) fields.email = '请输入有效的电子邮箱。';
  const length = Array.from(password).length;
  if (length < 8) fields.password = '密码至少需要 8 个字符。';
  else if (length > 64 || Buffer.byteLength(password, 'utf8') > 72) fields.password = '密码过长，请缩短密码后重试。';
  if (typeof body.confirmPassword !== 'string' || password !== body.confirmPassword) fields.confirmPassword = '两次输入的密码不一致。';
  return { username, email, password, fields };
}
function authRouter({ config, users, requireAuth, cookieName, cookieOptions, dummyHash, defaultRedirect = '/' }) {
  const router = express.Router();
  const limited = (limit, windowMs) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ code: 'RATE_LIMIT', message: '操作过于频繁，请稍后再试。' }) });
  router.get('/csrf', limited(120, 15 * 60000), async (req, res) => {
    const existed = !!req.session.csrfToken;
    const token = csrfToken(req.session);
    if (!existed) await saveSession(req);
    res.json({ csrfToken: token, rememberSupported: true });
  });
  router.post('/register', limited(5, 3600000), requireCsrf(config.origin), async (req, res) => {
    const { username, email, password, fields } = registrationValues(req.body);
    if (Object.keys(fields).length) return res.status(422).json({ code: 'VALIDATION_ERROR', message: '请检查填写的信息。', fields });
    const duplicates = await users.duplicates(username, email);
    if (Object.keys(duplicates).length) return res.status(409).json({ code: 'DUPLICATE_ACCOUNT', message: '用户名或邮箱已被使用。', fields: duplicates });
    const hash = await bcrypt.hash(password, config.bcryptCost);
    try { await users.create(username, email, hash); }
    catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      return res.status(409).json({ code: 'DUPLICATE_ACCOUNT', message: '用户名或邮箱已被使用。', fields: await users.duplicates(username, email) });
    }
    res.status(201).json({ message: '注册成功，请登录。', redirect: '/login' });
  });
  router.post('/login', limited(10, 15 * 60000), requireCsrf(config.origin), async (req, res) => {
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.normalize('NFKC').trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const validInput = identifier.length > 0 && identifier.length <= 254 && Array.from(password).length >= 8 && Array.from(password).length <= 64 && Buffer.byteLength(password) <= 72;
    const user = validInput ? await users.byIdentifier(identifier) : null;
    const match = await bcrypt.compare(validInput ? password : 'invalid-input', user?.password_hash || dummyHash);
    const success = !!user && match && user.status === 'active';
    await users.audit({ userId: user?.id, identifier: identifier.slice(0, 254), success, reason: success ? 'success' : 'invalid_credentials', ip: req.ip, agent: req.get('User-Agent') });
    if (!success) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: '用户名／邮箱或密码不正确。' });
    await regenerateSession(req);
    const maxAge = req.body.remember === true ? config.rememberMs : config.sessionMs;
    req.session.userId = String(user.id);
    req.session.authExpiresAt = Date.now() + maxAge;
    req.session.cookie.maxAge = maxAge;
    csrfToken(req.session);
    try {
      await saveSession(req);
      await users.linkSession(req.sessionID, user.id);
      await users.markLogin(user.id);
    } catch (error) { await destroySession(req).catch(() => {}); res.clearCookie(cookieName, cookieOptions); throw error; }
    const requested = safeReturnTo(req.body.returnTo);
    // The main backend has a fixed homepage destination; untrusted input cannot choose an external URL.
    res.json({ message: '登录成功。', redirect: defaultRedirect === '/' ? requested : safeReturnTo(defaultRedirect) });
  });
  router.post('/logout', requireCsrf(config.origin), async (req, res) => {
    await destroySession(req);
    res.clearCookie(cookieName, cookieOptions);
    res.json({ message: '您已安全退出。', redirect: '/login' });
  });
  router.get('/me', requireAuth, (req, res) => {
    const { id, username, email, role, created_at, last_login_at } = req.authUser;
    res.json({ user: { id: String(id), username, email, role, createdAt: created_at || null, lastLoginAt: last_login_at || null } });
  });
  router.use((_req, res) => res.status(404).json({ message: '接口不存在。' }));
  return router;
}
module.exports = { authRouter, registrationValues };
