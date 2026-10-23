(() => {
  'use strict';
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;
  const mode = document.body.dataset.authMode;
  const script = new URL(document.currentScript.src);
  // Served pages use /api/auth; direct HTML preview keeps the API relative to its site root.
  const canonical = /^\/(login|register)\/?$/i.test(location.pathname);
  const api = canonical ? new URL('/api/auth/', location.origin) : new URL('api/auth/', new URL('../', script));
  const summary = document.getElementById('auth-summary');
  const submitButton = form.querySelector('[data-auth-submit]');
  const submitLabel = submitButton.querySelector('[data-auth-submit-label]');
  const spinner = submitButton.querySelector('.auth-spinner');
  const originalLabel = submitLabel.textContent;
  let busy = false, token = null;

  function destination(kind) {
    const url = new URL(canonical ? '/' + kind : kind === 'login' ? '登录注册.html' : '注册.html', location.href);
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    return url.href;
  }
  document.querySelectorAll('[data-auth-link]').forEach(link => { link.href = destination(link.dataset.authLink); });
  function clearErrors() {
    summary.hidden = true; summary.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
    form.querySelectorAll('[data-auth-error]').forEach(error => { error.hidden = true; error.textContent = ''; });
  }
  function fieldError(name, message) {
    const field = form.elements.namedItem(name);
    const error = document.getElementById('auth-' + name + '-error');
    if (!field || !error || typeof message !== 'string') return;
    field.setAttribute('aria-invalid', 'true');
    error.textContent = message; error.hidden = false;
  }
  function showError(message, focus = true) {
    summary.textContent = message; summary.hidden = false;
    if (focus) (form.querySelector('[aria-invalid="true"]') || summary).focus();
  }
  function validate(values) {
    if (mode === 'login') {
      if (!values.identifier.trim()) fieldError('identifier', '请输入用户名或电子邮箱。');
      if (!values.password) fieldError('password', '请输入密码。');
    } else {
      const username = values.username.normalize('NFKC').trim();
      if (Array.from(username).length < 3 || Array.from(username).length > 30 || !/^[\p{L}\p{N}_-]+$/u.test(username)) fieldError('username', '用户名需为3–30个字符，可使用中文、字母、数字、下划线和短横线。');
      if (!values.email.trim() || !form.elements.email.validity.valid) fieldError('email', '请输入有效的电子邮箱。');
      const length = Array.from(values.password).length;
      if (length < 8) fieldError('password', '密码至少需要8个字符。');
      else if (length > 64 || new TextEncoder().encode(values.password).length > 72) fieldError('password', '密码过长，中文等字符会占用更多长度，请缩短后重试。');
      if (!values.confirmPassword || values.password !== values.confirmPassword) fieldError('confirmPassword', '两次输入的密码不一致。');
    }
    if (!form.querySelector('[aria-invalid="true"]')) return true;
    showError('请检查标记的输入项，然后再次提交。');
    return false;
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    submitButton.disabled = value;
    spinner.hidden = !value;
    submitLabel.textContent = value ? mode === 'login' ? '正在登录…' : '正在创建账户…' : originalLabel;
    form.querySelectorAll('input, [data-auth-reveal]').forEach(control => { control.disabled = value; });
  }
  async function request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(endpoint, api), { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...options });
      if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) throw new Error('账户服务尚未开放，请稍后再试。');
      const body = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('账户服务返回的数据不完整，请稍后重试。');
      return { response, body };
    } finally { clearTimeout(timeout); }
  }
  async function loadToken() {
    const { response, body } = await request('csrf');
    if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : '暂时无法验证页面，请稍后重试。');
    if (typeof body.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.csrfToken)) throw new Error('账户服务返回的数据不完整，请稍后重试。');
    token = body.csrfToken;
  }
  form.querySelectorAll('[data-auth-reveal]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.authReveal);
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', `${visible ? '隐藏' : '显示'}${input.name === 'confirmPassword' ? '确认密码' : '密码'}`);
    });
  });
  form.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    const error = document.getElementById('auth-' + input.name + '-error');
    if (error) { error.hidden = true; error.textContent = ''; }
    summary.hidden = true;
  }));
  submitButton.disabled = false;
  form.dataset.authReady = 'true';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    clearErrors();
    const values = Object.fromEntries(new FormData(form));
    if (!validate(values)) return;
    if (!/^https?:$/.test(location.protocol)) return showError('请通过网站服务打开页面后再提交，当前仅支持界面预览。');
    if (mode === 'register') {
      values.username = values.username.normalize('NFKC').trim();
      values.email = values.email.trim().toLowerCase();
    } else values.identifier = values.identifier.normalize('NFKC').trim();
    setBusy(true);
    try {
      if (!token) await loadToken();
      const { response, body } = await request(mode, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ ...values, returnTo: new URLSearchParams(location.search).get('returnTo') })
      });
      if (!response.ok) {
        if (body.code === 'CSRF_INVALID') token = null;
        Object.entries(body.fields || {}).forEach(([name, message]) => fieldError(name, message));
        throw new Error(typeof body.message === 'string' ? body.message : '提交未完成，请稍后重试。');
      }
      if (mode === 'login') {
        if (typeof body.redirect !== 'string' || !body.redirect.startsWith('/') || body.redirect.startsWith('//') || /[\\\x00-\x20]/.test(body.redirect)) throw new Error('登录服务返回的跳转地址无效，请稍后重试。');
        const target = new URL(body.redirect, location.origin);
        if (target.origin !== location.origin) throw new Error('登录服务返回的跳转地址无效，请稍后重试。');
        const current = await request('me');
        if (!current.response.ok || !current.body.user || typeof current.body.user.id !== 'string') throw new Error('无法保持登录状态，请允许网站使用Cookie后重试。');
        form.elements.password.value = '';
        location.assign(target.href);
      } else {
        if (response.status !== 201) throw new Error('注册结果未确认，请稍后重试。');
        form.reset();
        form.hidden = true;
        const success = document.getElementById('auth-success');
        success.hidden = false; success.focus();
      }
    } catch (error) {
      const message = error.name === 'AbortError' ? '请求超时，请检查网络后重试。'
        : error instanceof TypeError ? '暂时无法连接账户服务，请检查网络后重试。'
        : error instanceof SyntaxError ? '账户服务返回的数据无法读取，请稍后重试。' : error.message;
      showError(message, false);
    } finally {
      setBusy(false);
      if (!summary.hidden) (form.querySelector('[aria-invalid="true"]') || summary).focus();
    }
  });
})();
