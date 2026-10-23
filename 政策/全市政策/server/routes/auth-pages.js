'use strict';
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { safeReturnTo } = require('../middleware/security');

function authPageRouter(config) {
  const router = express.Router();
  const root = path.join(config.root, '苏州人才政策');
  const assets = {
    '/auth-ui/css/auth.css': 'css/auth.css',
    '/auth-ui/js/auth.js': 'js/auth.js',
    '/auth-ui/js/account.js': 'js/account.js',
    '/auth-ui/assets/portal-mark.svg': 'assets/images/portal-mark.svg',
    '/auth-ui/assets/jiangnan-architecture.svg': 'assets/images/jiangnan-architecture.svg',
    '/auth-ui/assets/kunshan-institute.png': 'pages/公共资源/昆山.png'
  };
  for (const [url, file] of Object.entries(assets)) {
    router.get(url, (req, res, next) => res.sendFile(path.join(root, file), { dotfiles: 'deny', cacheControl: false }, error => {
      if (error && !req.aborted && !res.destroyed) next(error);
    }));
  }
  router.get(['/login', '/register'], async (req, res) => {
    const route = /^\/register\/?$/i.test(req.path) ? '/register' : '/login';
    if (req.path !== route) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(308, route + query);
    }
    const target = safeReturnTo(req.query.returnTo);
    const query = target === '/' ? '' : '?' + new URLSearchParams({ returnTo: target }).toString();
    let html = await fs.readFile(path.join(root, route === '/register' ? '注册.html' : '登录注册.html'), 'utf8');
    const replacements = {
      'href="css/auth.css"': 'href="/auth-ui/css/auth.css"',
      'src="js/auth.js"': 'src="/auth-ui/js/auth.js"',
      'assets/images/portal-mark.svg': '/auth-ui/assets/portal-mark.svg',
      'assets/images/jiangnan-architecture.svg': '/auth-ui/assets/jiangnan-architecture.svg',
      'pages/公共资源/昆山.png': '/auth-ui/assets/kunshan-institute.png',
      'href="注册.html"': `href="/register${query}"`,
      'href="登录注册.html"': `href="/login${query}"`
    };
    for (const [from, to] of Object.entries(replacements)) html = html.replaceAll(from, to);
    res.type('html').send(html);
  });
  return router;
}
async function renderAccountPage(config) {
  let html = await fs.readFile(path.join(config.root, '苏州人才政策/账户.html'), 'utf8');
  for (const [from, to] of Object.entries({
    'href="css/auth.css"': 'href="/auth-ui/css/auth.css"',
    'src="js/account.js"': 'src="/auth-ui/js/account.js"',
    'assets/images/portal-mark.svg': '/auth-ui/assets/portal-mark.svg',
    'assets/images/jiangnan-architecture.svg': '/auth-ui/assets/jiangnan-architecture.svg',
    'href="登录注册.html"': 'href="/login"'
  })) html = html.replaceAll(from, to);
  return html;
}
module.exports = { authPageRouter, renderAccountPage };
