/* One routing map for the homepage and ten independent policy documents. */
(() => {
  'use strict';
  const script = document.currentScript;
  const root = new URL('../', script.src);
  const policies = [
    { id: 'gusu-city', name: '姑苏领军 · 苏州市级', file: '姑苏领军.html' },
    { id: 'wuzhong', name: '吴中 · 东吴领军', file: '东吴.html' },
    { id: 'gusu', name: '姑苏区 · 区级计划', file: '姑苏区.html' },
    { id: 'changshu', name: '常熟 · 昆承英才', file: '常熟.html' },
    { id: 'kunshan', name: '昆山 · 双创人才', file: '昆山.html' },
    { id: 'sip', name: '工业园区 · 金鸡湖', file: '金鸡湖.html' },
    { id: 'snd', name: '高新区 · 科技领军', file: '高新区.html' },
    { id: 'wujiang', name: '吴江 · 创新创业领军', file: '吴江.html' },
    { id: 'xiangcheng', name: '相城 · 科技领军', file: '相城.html' }
  ];
  const header = document.getElementById('szp-global-header');
  if (!header) return;
  const route = path => new URL(path, root).href;
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const home = document.body.classList.contains('szp-home');
  const currentFile = decodeURIComponent(location.pathname.split('/').pop());
  const currentPolicy = policies.find(p => p.file === currentFile);
  const compare = currentFile === '政策对比.html';
  const homeAnchor = anchor => home ? '#' + anchor : route('index.html#' + anchor);
  const brand = home
    ? `<img class="szp-institute-logo" src="${escape(route('pages/公共资源/昆山.png'))}" alt="上海交通大学 · 昆山未来产业创新院" width="2952" height="326"><span class="szp-brand-name">苏州人才政策<small>科技创新创业领军人才</small></span>`
    : '<span class="szp-brand-name">苏州人才政策<small>科技创新创业领军人才</small></span>';
  const activeRegion = currentPolicy && currentPolicy.id !== 'gusu-city';
  const cityPolicy = policies[0];
  header.innerHTML = `<div class="szp-nav-inner">
    <a class="szp-platform-brand ${home ? 'szp-home-brand' : 'szp-child-brand'}" href="${escape(route('index.html'))}" aria-label="苏州人才政策综合展示平台首页">${brand}</a>
    <div class="szp-nav-actions">
    <nav class="szp-site-menu" id="szp-site-menu" aria-label="全站导航">
      <a class="szp-nav-link" data-szp-nav="home" href="${escape(route('index.html'))}"${home ? ' aria-current="page"' : ''}>首页</a>
      <a class="szp-nav-link" data-szp-nav="policies" href="${escape(homeAnchor('szp-policies'))}">政策总览</a>
      <a class="szp-nav-link" data-szp-nav="city-policy" href="${escape(route('pages/' + cityPolicy.file))}"${currentPolicy === cityPolicy ? ' aria-current="page"' : ''}>市级计划</a>
      <div class="szp-region-menu">
        <button type="button" class="szp-nav-link szp-region-toggle${activeRegion ? ' szp-is-current' : ''}" aria-expanded="false" aria-controls="szp-region-panel">八大区域政策 <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4 6 8 10 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <div class="szp-region-panel" id="szp-region-panel">${policies.slice(1).map(p => `<a data-szp-region="${p.id}" href="${escape(route('pages/' + p.file))}"${p === currentPolicy ? ' aria-current="page"' : ''}>${p.name}</a>`).join('')}</div>
      </div>
      <a class="szp-nav-link" data-szp-nav="comparison" href="${escape(route('pages/政策对比.html'))}"${compare ? ' aria-current="page"' : ''}>政策对比</a>
      <a class="szp-nav-link" data-szp-nav="about" href="${escape(homeAnchor('szp-about'))}">关于平台</a>
    </nav>
    <button type="button" class="szp-menu-toggle" aria-label="展开全站导航" aria-expanded="false" aria-controls="szp-site-menu"><span></span><span></span></button>
    <div class="szp-user-center" id="szp-user-center" hidden>
      <button type="button" class="szp-user-toggle" id="szp-user-toggle" aria-label="用户中心" aria-haspopup="menu" aria-expanded="false" aria-controls="szp-user-panel" disabled>
        <span class="szp-user-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg></span>
        <span class="szp-user-name" id="szp-user-name"></span>
        <svg class="szp-user-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4 6 8 10 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
      <div class="szp-user-panel" id="szp-user-panel" role="menu" aria-labelledby="szp-user-toggle" aria-describedby="szp-user-registered" hidden>
        <p class="szp-user-full-name" id="szp-user-full-name" role="presentation"></p>
        <a class="szp-user-item" href="/account" role="menuitem">我的账号</a>
        <div class="szp-user-registered" id="szp-user-registered" role="presentation"><span>注册时间</span><time id="szp-user-created">加载中…</time></div>
        <button type="button" class="szp-user-item szp-user-logout" id="szp-user-logout" role="menuitem">退出登录</button>
        <p class="szp-user-message" id="szp-user-message" role="status" aria-live="polite" hidden></p>
      </div>
    </div>
    </div>
  </div>`;
  header.classList.add('szp-navigation-ready');
  const menu = header.querySelector('.szp-site-menu');
  const menuButton = header.querySelector('.szp-menu-toggle');
  const regions = header.querySelector('.szp-region-menu');
  const regionButton = header.querySelector('.szp-region-toggle');
  const regionalLinks = [...header.querySelectorAll('[data-szp-region]')];
  const userCenter = document.getElementById('szp-user-center');
  const userButton = document.getElementById('szp-user-toggle');
  const userPanel = document.getElementById('szp-user-panel');
  const userLogout = document.getElementById('szp-user-logout');
  const userMessage = document.getElementById('szp-user-message');
  const userItems = [...userPanel.querySelectorAll('[role="menuitem"]')];
  const narrow = matchMedia('(max-width: 1099px)');
  let userChecking = false, userLeaving = false;
  function setUserMenu(open, focus = false) {
    if (open && (userCenter.hidden || userButton.disabled)) return;
    userPanel.hidden = !open;
    userButton.setAttribute('aria-expanded', String(open));
    if (focus) userButton.focus();
  }
  const toLogin = () => {
    document.documentElement.classList.add('szp-session-checking');
    userCenter.hidden = true;
    location.replace('/login');
  };
  async function accountRequest(endpoint, options = {}) {
    const response = await fetch('/api/auth/' + endpoint, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), ...options
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('账户服务暂不可用，请稍后重试。');
    return { response, body: await response.json() };
  }
  async function loadUser() {
    if (userChecking || userLeaving || !/^https?:$/.test(location.protocol)) return;
    userChecking = true;
    try {
      const { response, body } = await accountRequest('me');
      if (response.status === 401) return toLogin();
      if (!response.ok || typeof body.user?.username !== 'string') throw new Error('暂时无法读取账户，请稍后重试。');
      const username = body.user.username;
      document.getElementById('szp-user-name').textContent = username;
      document.getElementById('szp-user-full-name').textContent = username;
      userButton.setAttribute('aria-label', '用户中心：' + username);
      userButton.title = username;
      const created = typeof body.user.createdAt === 'string' ? new Date(body.user.createdAt) : null;
      const time = document.getElementById('szp-user-created');
      if (created && Number.isFinite(created.getTime())) {
        time.dateTime = created.toISOString();
        time.textContent = created.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        time.title = '北京时间';
      } else { time.removeAttribute('datetime'); time.textContent = '暂无记录'; }
      userButton.disabled = false; userCenter.hidden = false;
    } catch {
      // Static preview has no account API; never invent a username or registration date.
      if (!userCenter.hidden) { userMessage.textContent = '暂时无法读取账户，请刷新后重试。'; userMessage.hidden = false; }
    } finally { userChecking = false; }
  }
  userButton.addEventListener('click', () => {
    const open = userPanel.hidden;
    setMenu(false); setRegions(false); setUserMenu(open);
  });
  userButton.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); setMenu(false); setRegions(false); setUserMenu(true);
    userItems[event.key === 'ArrowDown' ? 0 : userItems.length - 1].focus();
  });
  userPanel.addEventListener('keydown', event => {
    const index = userItems.indexOf(document.activeElement);
    const destinations = { ArrowDown: (index + 1) % userItems.length, ArrowUp: (index - 1 + userItems.length) % userItems.length, Home: 0, End: userItems.length - 1 };
    if (Object.hasOwn(destinations, event.key)) { event.preventDefault(); userItems[destinations[event.key]].focus(); }
  });
  // During a real pointer click activeElement can temporarily be body before the
  // next control receives focus. Use the destination so menu items stay clickable.
  // A null destination may be a non-focusable item inside the panel; outside
  // pointerdown/focusin still close it without interrupting an internal click.
  userCenter.addEventListener('focusout', event => {
    if (event.relatedTarget && !userCenter.contains(event.relatedTarget)) setUserMenu(false);
  });
  userPanel.querySelector('a').addEventListener('click', () => setUserMenu(false));
  userLogout.addEventListener('click', async () => {
    if (userLeaving) return;
    userLeaving = true; userLogout.disabled = true; userLogout.textContent = '正在退出…'; userMessage.hidden = true;
    try {
      const csrf = await accountRequest('csrf');
      if (!csrf.response.ok || !/^[a-f0-9]{64}$/.test(csrf.body.csrfToken || '')) throw new Error('页面验证失败。');
      const result = await accountRequest('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf.body.csrfToken } });
      if (!result.response.ok) throw new Error('退出失败。');
      toLogin();
    } catch { userMessage.textContent = '退出未完成，请稍后重试。'; userMessage.hidden = false; }
    finally { userLeaving = false; userLogout.disabled = false; userLogout.textContent = '退出登录'; }
  });
  window.addEventListener('pageshow', () => { setUserMenu(false); loadUser(); });
  window.addEventListener('pagehide', () => { setUserMenu(false); userCenter.hidden = true; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadUser(); });
  if (document.readyState === 'complete') loadUser();
  let regionOrigin = '';
  function setRegions(open, focus = false, origin = '') {
    if (open) setUserMenu(false);
    regions.classList.toggle('szp-is-open', open);
    regionButton.setAttribute('aria-expanded', String(open));
    regionOrigin = open ? origin : '';
    if (focus) regionButton.focus();
  }
  function setMenu(open, focus = false) {
    if (open) setUserMenu(false);
    menu.classList.toggle('szp-is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '收起全站导航' : '展开全站导航');
    if (!open) setRegions(false);
    if (focus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  regionButton.addEventListener('click', () => setRegions(regionButton.getAttribute('aria-expanded') !== 'true' || regionOrigin === 'hover', false, 'click'));
  regionButton.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setRegions(true);
      regionalLinks[event.key === 'ArrowDown' ? 0 : regionalLinks.length - 1].focus();
    }
  });
  regionalLinks.forEach((link, index) => link.addEventListener('keydown', event => {
    const count = regionalLinks.length;
    const destinations = { ArrowDown: (index + 1) % count, ArrowUp: (index + count - 1) % count, Home: 0, End: count - 1 };
    if (Object.hasOwn(destinations, event.key)) { event.preventDefault(); regionalLinks[destinations[event.key]].focus(); }
  }));
  regions.addEventListener('pointerenter', event => { if (!narrow.matches && event.pointerType !== 'touch' && regionButton.getAttribute('aria-expanded') !== 'true') setRegions(true, false, 'hover'); });
  regions.addEventListener('pointerleave', () => { if (!narrow.matches && !regions.contains(document.activeElement)) setRegions(false); });
  regions.addEventListener('focusout', event => {
    if (event.relatedTarget && !regions.contains(event.relatedTarget)) setRegions(false);
  });
  document.addEventListener('focusin', event => {
    if (!userCenter.contains(event.target)) setUserMenu(false);
    if (!regions.contains(event.target)) setRegions(false);
    if (narrow.matches && !header.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!userPanel.hidden) { event.preventDefault(); setUserMenu(false, true); }
    else if (regionButton.getAttribute('aria-expanded') === 'true') { event.preventDefault(); setRegions(false, true); }
    else if (narrow.matches && menuButton.getAttribute('aria-expanded') === 'true') { event.preventDefault(); setMenu(false, true); }
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target)) { setMenu(false); setRegions(false); }
    if (!userCenter.contains(event.target)) setUserMenu(false);
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  const adapt = () => { setMenu(false); setRegions(false); setUserMenu(false); updateOffset(); };
  narrow.addEventListener('change', adapt);
  const localHeader = document.body.classList.contains('szp-integrated') ? document.querySelector('body > .site-header') : null;
  const rootStyle = document.documentElement.style;
  const originalPadding = { value: rootStyle.getPropertyValue('scroll-padding-top'), priority: rootStyle.getPropertyPriority('scroll-padding-top') };
  let printing = false;
  function restorePadding() {
    if (originalPadding.value) rootStyle.setProperty('scroll-padding-top', originalPadding.value, originalPadding.priority);
    else rootStyle.removeProperty('scroll-padding-top');
  }
  function updateOffset() {
    if (printing || !document.body.classList.contains('szp-integrated')) return;
    // Preserve the original CSS padding at each breakpoint and count only headers
    // that actually stay visible while scrolling. Static policy headers are untouched.
    let stackedHeight = 0;
    if (localHeader) {
      localHeader.removeAttribute('data-szp-stacked-header');
      const original = getComputedStyle(localHeader);
      if (original.position === 'sticky' || original.position === 'fixed') {
        document.body.style.setProperty('--szp-original-header-top', original.top === 'auto' ? '0px' : original.top);
        localHeader.setAttribute('data-szp-stacked-header', '');
        stackedHeight = localHeader.getBoundingClientRect().height;
      }
    }
    restorePadding();
    const baseline = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const required = Math.ceil(header.getBoundingClientRect().height + stackedHeight + 24);
    rootStyle.setProperty('scroll-padding-top', Math.max(baseline, required) + 'px');
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    if (localHeader) observer.observe(localHeader);
  }
  window.addEventListener('resize', updateOffset, { passive: true });
  window.addEventListener('beforeprint', () => { printing = true; if (!home) restorePadding(); });
  window.addEventListener('afterprint', () => { printing = false; updateOffset(); });
  updateOffset();
  const updateScroll = () => header.classList.toggle('szp-is-scrolled', scrollY > 20);
  window.addEventListener('scroll', updateScroll, { passive: true }); updateScroll();
  if (home) {
    const cards = [...document.querySelectorAll('[data-szp-policy]')];
    policies.forEach((policy, index) => {
      const card = cards[index];
      if (!card || card.dataset.szpPolicy !== policy.id || card.href !== route('pages/' + policy.file)) {
        console.error('szp: 首页政策链接与导航映射不一致', policy.id);
      }
    });
    if (cards.length !== policies.length) console.error('szp: 首页应包含9张政策卡片');
  }
})();
