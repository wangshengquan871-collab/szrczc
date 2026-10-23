(() => {
  'use strict';
  const root = document.documentElement;
  const button = document.getElementById('szp-session-logout');
  const message = document.getElementById('szp-session-message');
  if (!button || !message) return;
  let checking = false;
  const login = () => location.replace('/login');
  async function request(endpoint, options = {}) {
    const response = await fetch('/api/auth/' + endpoint, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), ...options
    });
    return { response, body: await response.json() };
  }
  async function verify() {
    if (checking) return;
    checking = true;
    try {
      const { response, body } = await request('me');
      if (response.status === 401) return login();
      if (!response.ok || !body.user) throw new Error('暂时无法验证账户，请刷新后重试。');
      document.getElementById('szp-session-name').textContent = body.user.username;
      root.classList.remove('szp-session-checking');
    } catch (error) {
      if (root.classList.contains('szp-session-checking')) return login();
      message.textContent = '暂时无法验证账户，请刷新后重试。'; message.hidden = false;
    } finally { checking = false; }
  }
  button.addEventListener('click', async () => {
    button.disabled = true; message.hidden = true;
    try {
      const csrf = await request('csrf');
      if (!csrf.response.ok || !/^[a-f0-9]{64}$/.test(csrf.body.csrfToken || '')) throw new Error('退出未完成，请重试。');
      const logout = await request('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf.body.csrfToken } });
      if (!logout.response.ok) throw new Error('退出未完成，请重试。');
      root.classList.add('szp-session-checking'); login();
    } catch (error) { message.textContent = '退出未完成，请重试。'; message.hidden = false; button.disabled = false; }
  });
  // UI checks prevent a history snapshot showing after logout; Express controls all access.
  window.addEventListener('pagehide', () => root.classList.add('szp-session-checking'));
  window.addEventListener('pageshow', verify);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verify(); });
  if (document.readyState === 'complete') verify();
})();
