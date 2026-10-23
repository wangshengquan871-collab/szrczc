(() => {
  'use strict';
  let user;
  const root = document.documentElement;
  const destination = '/login?returnTo=' + encodeURIComponent(location.pathname + location.search + location.hash);
  async function getUser() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) { root.classList.add('szpa-checking'); location.replace(destination); return null; }
    if (!response.ok) throw new Error('暂时无法验证登录状态，请刷新后重试。');
    return (await response.json()).user;
  }
  async function initialize() {
    try {
      user = await getUser();
      if (!user) return;
      root.classList.remove('szpa-checking');
      if (document.getElementById('szpa-account')) return;
      const menu = document.getElementById('szp-site-menu');
      if (!menu) return;
      const region = document.createElement('div');
      region.id = 'szpa-account';
      region.className = 'szpa-account';
      const name = document.createElement('span');
      name.className = 'szpa-account-name';
      name.textContent = user.username;
      name.title = `已登录：${user.username}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'szpa-account-logout';
      button.textContent = '退出';
      const message = document.createElement('span');
      message.className = 'szpa-account-message';
      message.setAttribute('role', 'status');
      message.hidden = true;
      region.append(name, button, message);
      menu.append(region);
      button.addEventListener('click', async () => {
        button.disabled = true;
        message.hidden = true;
        try {
          const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
          if (!csrfResponse.ok) throw new Error('退出未完成，请重试。');
          const { csrfToken } = await csrfResponse.json();
          const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-CSRF-Token': csrfToken } });
          if (!response.ok) throw new Error('退出未完成，请重试。');
          root.classList.add('szpa-checking');
          location.replace('/login');
        } catch (error) { message.textContent = error.message; message.hidden = false; button.disabled = false; }
      });
    } catch { if (root.classList.contains('szpa-checking')) location.replace('/login'); }
  }
  // A history-restored page is checked again; the server remains the access-control authority.
  window.addEventListener('pagehide', () => root.classList.add('szpa-checking'));
  window.addEventListener('pageshow', initialize);
  if (document.readyState === 'complete') initialize();
})();
