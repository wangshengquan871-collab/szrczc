'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { safeReturnTo } = require('../middleware/security');

// Login and registration share one template, stylesheet and interaction module.
// The server renders the correct initial page instead of waiting for JavaScript to switch it.
async function renderAuthPage(root, mode = 'login', returnTo) {
  let html = await fs.readFile(path.join(root, '登录注册.html'), 'utf8');
  const target = safeReturnTo(returnTo);
  const query = target === '/' ? '' : '?' + new URLSearchParams({ returnTo: target }).toString();
  html = html.replace('href="登录注册.html?mode=register"', `href="/register${query}"`)
    .replace('href="登录注册.html"', `href="/login${query}"`)
    .replace('href="苏州人才政策/index.html"', 'href="/"');
  if (mode === 'register') {
    html = html.replace('<title>欢迎登录 · 苏州人才政策</title>', '<title>创建账户 · 苏州人才政策</title>')
      .replace('<body class="szpa-page">', '<body class="szpa-page szpa-register">')
      .replace('>跳转到登录表单</a>', '>跳转到注册表单</a>')
      .replace('id="szpa-form-kicker">WELCOME BACK', 'id="szpa-form-kicker">BEGIN YOUR JOURNEY')
      .replace('id="szpa-form-title" tabindex="-1">欢迎登录', 'id="szpa-form-title" tabindex="-1">创建账户')
      .replace('id="szpa-form-intro">从这里，开启您的政策探索。', 'id="szpa-form-intro">与苏州创新同行，从一个账号开始。')
      .replace('id="szpa-login-form" class="szpa-form" method="post" novalidate aria-labelledby="szpa-form-title"', 'id="szpa-login-form" class="szpa-form" method="post" novalidate aria-labelledby="szpa-form-title" hidden')
      .replace('id="szpa-register-form" class="szpa-form" method="post" novalidate aria-labelledby="szpa-form-title" hidden', 'id="szpa-register-form" class="szpa-form" method="post" novalidate aria-labelledby="szpa-form-title"');
  }
  return html;
}
module.exports = { renderAuthPage };
