'use strict';
const { createHmac } = require('node:crypto');
function createUsers(pool, auditKey) {
  return {
    async byIdentifier(identifier) {
      const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1', [identifier, identifier]);
      return rows[0];
    },
    async byId(id) {
      const [rows] = await pool.execute('SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE id = ? LIMIT 1', [id]);
      return rows[0];
    },
    async duplicates(username, email) {
      const [rows] = await pool.execute('SELECT username = ? AS username_match, email = ? AS email_match FROM users WHERE username = ? OR email = ?', [username, email, username, email]);
      const fields = {};
      if (rows.some(row => Number(row.username_match) === 1)) fields.username = '该用户名已被使用，请换一个用户名。';
      if (rows.some(row => Number(row.email_match) === 1)) fields.email = '该邮箱已注册，请直接登录。';
      return fields;
    },
    async create(username, email, passwordHash) {
      const [result] = await pool.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
      return String(result.insertId);
    },
    async markLogin(id) { await pool.execute('UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?', [id]); },
    async linkSession(sessionId, userId) {
      const [result] = await pool.execute('UPDATE user_sessions SET user_id = ? WHERE session_id = ?', [userId, sessionId]);
      if (result.affectedRows !== 1) throw Object.assign(new Error('无法关联登录会话。'), { code: 'SESSION_LINK_FAILED' });
    },
    async audit({ userId, identifier, success, reason, ip, agent }) {
      const hash = createHmac('sha256', auditKey).update(identifier.toLowerCase()).digest();
      await pool.execute('INSERT INTO login_logs (user_id, identifier_hash, success, reason, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [userId || null, hash, success ? 1 : 0, reason, String(ip || '').slice(0, 45), String(agent || '').slice(0, 255)]);
    }
  };
}
module.exports = { createUsers };
