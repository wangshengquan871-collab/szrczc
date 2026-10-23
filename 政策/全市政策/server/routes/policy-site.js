'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const encodePath = value => value.split('/').map(encodeURIComponent).join('/');

// Only browser files and original downloads are served; no directory-wide static mount.
function policyFiles(root) {
  const files = new Map();
  const types = {
    css: new Set(['.css']), js: new Set(['.js']), data: new Set(['.json']),
    assets: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2']),
    pages: new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'])
  };
  const excluded = new Set(['css/auth.css', 'js/auth.js', 'js/account.js']);
  function walk(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const relative = prefix + entry.name;
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (types[relative.split('/')[0]]) walk(location, relative + '/');
      } else if (entry.isFile() && !excluded.has(relative)) {
        const extension = path.extname(entry.name).toLowerCase();
        const allowed = prefix ? types[relative.split('/')[0]]?.has(extension)
          : relative === 'index.html' || ['.docx', '.xlsx'].includes(extension);
        if (allowed) files.set('/' + relative.toLowerCase(), { relative, location });
      }
    }
  }
  walk(root);
  return files;
}

function policySiteRouter(config) {
  const router = express.Router();
  const root = fs.realpathSync(path.join(config.root, '苏州人才政策'));
  const files = policyFiles(root);
  const accountAssets = new Map([
    ['/session-ui/policy-session.css', path.join(config.root, 'auth/css/policy-session.css')],
    ['/session-ui/policy-session.js', path.join(config.root, 'auth/js/policy-session.js')]
  ]);
  router.use(async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let requested;
    try { requested = decodeURIComponent(req.path); } catch { return res.status(400).json({ code: 'INVALID_PATH', message: '资源路径无效。' }); }
    if (/[\\:\x00-\x1f\x7f%]/.test(requested) || requested.startsWith('//')
      || requested.split('/').slice(1).some(segment => segment === '.' || segment === '..' || /[. ]$/.test(segment))) return next();
    if (accountAssets.has(requested)) return res.sendFile(accountAssets.get(requested), { dotfiles: 'deny', cacheControl: false, lastModified: false });
    const file = files.get((requested === '/' ? '/index.html' : requested).toLowerCase());
    if (!file) return next();
    // Defend against a symlink being substituted after the file catalog was created.
    const actual = await fs.promises.realpath(file.location);
    if (!actual.startsWith(root + path.sep) || actual !== file.location) return next();
    const canonical = '/' + file.relative;
    if (requested !== '/' && requested !== canonical) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(308, encodePath(canonical) + query);
    }
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
    if (file.relative.endsWith('.html')) {
      const html = await fs.promises.readFile(actual, 'utf8');
      const head = '<link rel="stylesheet" href="/session-ui/policy-session.css"><script defer src="/session-ui/policy-session.js"></script>';
      const controls = '<aside class="szp-session-tools" id="szp-session-tools" aria-label="账户操作">'
        + '<span>已登录：<span id="szp-session-name">' + escapeHtml(req.authUser.username) + '</span></span>'
        + '<a href="/account">账户信息</a><button type="button" id="szp-session-logout">退出登录</button>'
        + '<span id="szp-session-message" role="status" aria-live="polite" hidden></span></aside>';
      // Only the HTTP response is decorated; policy HTML and data stay unchanged on disk.
      return res.type('html').send(html.replace(/<\/head>/i, head + '</head>').replace(/<\/body>/i, controls + '</body>'));
    }
    if (/\.(docx|xlsx)$/i.test(file.relative)) res.attachment(path.basename(file.relative));
    return res.sendFile(actual, { dotfiles: 'deny', cacheControl: false, lastModified: false });
  });
  return router;
}
module.exports = { policySiteRouter, policyFiles };
