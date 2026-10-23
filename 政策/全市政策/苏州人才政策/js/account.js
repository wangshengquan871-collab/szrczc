(() => {
  'use strict';
  const details = document.getElementById('account-details');
  const status = document.getElementById('account-status');
  const logout = document.getElementById('account-logout');
  const retry = document.getElementById('account-retry');
  if (!details || !logout) return;
  let checking = false, leaving = false;
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/auth/' + path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...options });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('账户服务暂不可用，请稍后重试。');
      return { response, body: await response.json() };
    } finally { clearTimeout(timer); }
  }
  function showError(error) {
    status.textContent = error.name === 'AbortError' ? '请求超时，请稍后重试。' : error instanceof TypeError ? '暂时无法连接账户服务，请检查网络后重试。' : error.message;
    status.hidden = false; status.focus();
  }
  async function loadUser() {
    if (checking || leaving) return;
    if (!/^https?:$/.test(location.protocol)) { status.textContent = '请通过网站服务查看当前登录状态。'; retry.hidden = true; return; }
    checking = true; logout.disabled = true; retry.hidden = true;
    try {
      const { response, body } = await request('me');
      if (response.status === 401) return location.replace('/login');
      if (!response.ok || !body?.user || typeof body.user.username !== 'string') throw new Error('无法验证当前登录状态，请稍后重试。');
      document.getElementById('account-username').textContent = body.user.username;
      document.getElementById('account-email').textContent = body.user.email;
      const timestamp = body.user.lastLoginAt && new Date(body.user.lastLoginAt);
      document.getElementById('account-last-login').textContent = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '暂无记录';
      details.hidden = false; status.hidden = true; logout.disabled = false;
      document.body.dataset.accountReady = 'true';
    } catch (error) { details.hidden = true; showError(error); retry.hidden = false; }
    finally { checking = false; }
  }
  logout.addEventListener('click', async () => {
    if (leaving) return;
    leaving = true; logout.disabled = true; logout.textContent = '正在退出…';
    try {
      const csrf = await request('csrf');
      if (!csrf.response.ok || !/^[a-f0-9]{64}$/.test(csrf.body.csrfToken || '')) throw new Error('暂时无法验证页面，请重试。');
      const result = await request('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf.body.csrfToken } });
      if (!result.response.ok) throw new Error(result.body.message || '退出未完成，请重试。');
      details.hidden = true; location.replace('/login');
    } catch (error) { showError(error); logout.disabled = false; }
    finally { leaving = false; logout.textContent = '退出登录'; }
  });
  retry.addEventListener('click', loadUser);
  window.addEventListener('pagehide', () => { details.hidden = true; });
  window.addEventListener('pageshow', loadUser);
  if (document.readyState === 'complete') loadUser();
})();
