(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scriptUrl = new URL(document.currentScript.src);
  const base = new URL('../../', scriptUrl);
  const api = new URL('api/auth/', base);
  const http = /^https?:$/.test(location.protocol);
  const canonical = /^\/(login|register|登录注册\.html)\/?$/i.test(decodeURI(location.pathname));
  let csrfToken = null;
  let csrfPending;
  let busy = false;
  const loginForm = $('szpa-login-form');
  const registerForm = $('szpa-register-form');
  const serviceNote = $('szpa-service-note');
  const summary = $('szpa-summary');
  const modeUrl = mode => canonical ? `/${mode}${location.search.includes('returnTo=') ? '?returnTo=' + encodeURIComponent(new URLSearchParams(location.search).get('returnTo')) : ''}` : `${location.pathname}${mode === 'register' ? '?mode=register' : ''}`;
  function clearErrors() {
    summary.hidden = true;
    summary.textContent = '';
    document.querySelectorAll('.szpa-field-error').forEach(e => { e.hidden = true; e.textContent = ''; });
    document.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  }
  function fieldError(id, message) {
    const field = $(id);
    field.setAttribute('aria-invalid', 'true');
    const error = $(`${id}-error`);
    error.textContent = message;
    error.hidden = false;
  }
  function showError(message) { summary.textContent = message; summary.hidden = false; summary.focus(); }
  function showMode(mode, focus = false) {
    const register = mode === 'register';
    loginForm.hidden = register;
    registerForm.hidden = !register;
    document.body.classList.toggle('szpa-register', register);
    $('szpa-form-title').textContent = register ? '创建账户' : '欢迎登录';
    $('szpa-form-kicker').textContent = register ? 'BEGIN YOUR JOURNEY' : 'WELCOME BACK';
    $('szpa-form-intro').textContent = register ? '与苏州创新同行，从一个账号开始。' : '从这里，开启您的政策探索。';
    document.title = `${register ? '创建账户' : '欢迎登录'} · 苏州人才政策`;
    document.querySelector('.szpa-skip').textContent = `跳转到${register ? '注册' : '登录'}表单`;
    clearErrors();
    $('szpa-success').hidden = true;
    document.querySelectorAll('.szpa-password-wrap input, [data-szpa-reveal]').forEach(el => {
      if (el.matches('input')) { el.value = ''; el.type = 'password'; }
      else { el.setAttribute('aria-pressed', 'false'); el.setAttribute('aria-label', el.dataset.szpaReveal === 'szpa-confirm-password' ? '显示确认密码' : '显示密码'); }
    });
    if (focus) $('szpa-form-title').focus();
  }
  const currentMode = () => /^\/register\/?$/i.test(location.pathname) || new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
  showMode(currentMode());
  if (canonical) $('szpa-home-link').href = '/';
  document.querySelectorAll('[data-szpa-mode]').forEach(link => {
    link.href = modeUrl(link.dataset.szpaMode);
    link.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (busy) return;
      history.pushState(null, '', modeUrl(link.dataset.szpaMode));
      showMode(link.dataset.szpaMode, true);
    });
  });
  window.addEventListener('popstate', () => showMode(currentMode()));
  document.querySelectorAll('[data-szpa-reveal]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const input = $(button.dataset.szpaReveal);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(reveal));
      button.setAttribute('aria-label', `${reveal ? '隐藏' : '显示'}${input.name === 'confirmPassword' ? '确认密码' : '密码'}`);
    });
  });
  document.querySelectorAll('.szpa-field input').forEach(input => input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    $(`${input.id}-error`).hidden = true;
    summary.hidden = true;
  }));
  async function request(path, options = {}) {
    const response = await fetch(new URL(path, api), { credentials: 'same-origin', cache: 'no-store', ...options });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      const error = new Error('暂时无法连接登录服务，请稍后重试。');
      error.serviceMissing = true;
      throw error;
    }
    const body = await response.json();
    return { response, body };
  }
  async function loadCsrf() {
    if (!http) throw new Error('当前为界面预览，请通过网站服务使用登录与注册。');
    if (!csrfPending) csrfPending = request('csrf').then(({ response, body }) => {
      if (!response.ok || typeof body.csrfToken !== 'string') throw new Error(body.message || '登录服务暂不可用，请稍后重试。');
      csrfToken = body.csrfToken;
      $('szpa-remember').disabled = !body.rememberSupported;
      serviceNote.textContent = '登录后查阅政策详情与多地区对比。';
      return csrfToken;
    }).finally(() => { csrfPending = null; });
    return csrfPending;
  }
  function validate(mode, values) {
    if (mode === 'login') {
      if (!values.identifier.trim()) fieldError('szpa-identifier', '请输入用户名或邮箱。');
      if (!values.password) fieldError('szpa-password', '请输入密码。');
    } else {
      const username = values.username.normalize('NFKC').trim();
      if (Array.from(username).length < 3 || Array.from(username).length > 30 || !/^[\p{L}\p{N}_-]+$/u.test(username)) fieldError('szpa-username', '用户名需为 3–30 个字符，支持中文、字母、数字、下划线及短横线。');
      if (!values.email.trim() || !$('szpa-email').validity.valid) fieldError('szpa-email', '请输入有效的电子邮箱。');
      const length = Array.from(values.password).length;
      if (length < 8) fieldError('szpa-new-password', '密码至少需要 8 个字符。');
      else if (length > 64 || new TextEncoder().encode(values.password).length > 72) fieldError('szpa-new-password', '密码过长，请缩短密码后重试。');
      if (!values.confirmPassword || values.password !== values.confirmPassword) fieldError('szpa-confirm-password', '两次输入的密码不一致。');
    }
    const first = document.querySelector('[aria-invalid=true]');
    if (first) { first.focus(); return false; }
    return true;
  }
  async function submit(event, mode) {
    event.preventDefault();
    if (busy) return;
    clearErrors();
    $('szpa-success').hidden = true;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    values.remember = mode === 'login' && $('szpa-remember').checked && !$('szpa-remember').disabled;
    if (!validate(mode, values)) return;
    busy = true;
    const button = form.querySelector('[type=submit]');
    const caption = button.firstElementChild;
    const previous = caption.textContent;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    caption.textContent = mode === 'login' ? '正在登录…' : '正在创建…';
    try {
      if (!csrfToken) await loadCsrf();
      const { response, body } = await request(mode, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ ...values, returnTo: new URLSearchParams(location.search).get('returnTo') }) });
      if (!response.ok) {
        if (response.status === 403 && body.code === 'CSRF_INVALID') { csrfToken = null; await loadCsrf(); }
        const fields = { username: 'szpa-username', email: 'szpa-email', password: mode === 'login' ? 'szpa-password' : 'szpa-new-password', confirmPassword: 'szpa-confirm-password' };
        const fieldMessages = [];
        Object.entries(body.fields || {}).forEach(([key, message]) => {
          if (fields[key] && typeof message === 'string') { fieldError(fields[key], message); fieldMessages.push(message); }
        });
        throw new Error(fieldMessages.length ? fieldMessages.join(' ') : body.message || '操作未完成，请稍后重试。');
      }
      if (mode === 'login') {
        const destination = new URL(body.redirect || '/', location.origin);
        if (destination.origin !== location.origin) throw new Error('登录成功，请返回平台首页。');
        location.assign(destination.href);
      } else {
        const saved = values.username.normalize('NFKC').trim();
        form.reset();
        history.replaceState(null, '', modeUrl('login'));
        showMode('login', true);
        $('szpa-identifier').value = saved;
        const success = $('szpa-success');
        const loginLink = document.createElement('a');
        loginLink.href = modeUrl('login');
        loginLink.textContent = '立即登录';
        loginLink.addEventListener('click', event => {
          if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          $('szpa-identifier').focus();
        });
        success.replaceChildren(document.createTextNode('注册成功，您现在可以使用新账号登录。 '), loginLink);
        success.hidden = false;
        success.focus();
      }
    } catch (error) { showError(error instanceof TypeError ? '暂时无法连接登录服务，请稍后重试。' : error.message); }
    finally { busy = false; button.disabled = false; form.removeAttribute('aria-busy'); caption.textContent = previous; }
  }
  loginForm.addEventListener('submit', event => submit(event, 'login'));
  registerForm.addEventListener('submit', event => submit(event, 'register'));
  loadCsrf().catch(error => {
    serviceNote.textContent = !http || error.serviceMissing ? '当前为界面预览。连接登录服务后可登录、注册并记住登录状态。' : error instanceof TypeError ? '登录服务暂不可用，请稍后重试。' : error.message;
  });
})();
