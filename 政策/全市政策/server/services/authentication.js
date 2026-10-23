'use strict';
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');
const { createUsers } = require('./users');

async function createAuthentication(pool, config, logger = console) {
  const store = new MySQLStore({
    createDatabaseTable: false, endConnectionOnClose: false,
    clearExpired: true, checkExpirationInterval: 15 * 60000,
    expiration: config.sessionMs,
    schema: { tableName: 'user_sessions', columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' } }
  }, pool);
  store.on('error', error => logger.error('Session 存储失败：', error.code || error.name));
  try {
    await store.onReady();
    const dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), config.bcryptCost);
    return { store, users: createUsers(pool, config.sessionSecret), dummyHash };
  } catch (error) { await store.close().catch(() => {}); throw error; }
}

function sessionOptions(config, store) {
  const cookieName = config.production ? '__Host-szp.sid' : 'szp.sid';
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
  return { cookieName, cookieOptions, options: {
    name: cookieName, secret: config.sessionSecret, store, resave: false, saveUninitialized: false,
    rolling: true, cookie: { ...cookieOptions, maxAge: config.sessionMs }
  } };
}
module.exports = { createAuthentication, sessionOptions };
