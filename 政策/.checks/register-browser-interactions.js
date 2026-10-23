(async () => {
  const checks = [];
  const check = (name, passed) => { checks.push({ name, passed: !!passed }); if (!passed) throw new Error(name); };
  const $ = id => document.getElementById(id);
  const waitFor = async condition => {
    const deadline = Date.now() + 10000;
    while (!condition()) { if (Date.now() > deadline) throw new Error('Registration UI timeout'); await new Promise(resolve => setTimeout(resolve, 50)); }
  };
  const fill = (username, email, password = 'FixturePassword123', confirmPassword = password) => {
    const values = { 'szpa-username': username, 'szpa-email': email, 'szpa-new-password': password, 'szpa-confirm-password': confirmPassword };
    for (const [id, value] of Object.entries(values)) { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); }
  };
  check('直接打开 /register 显示注册页', !$('szpa-register-form').hidden && $('szpa-login-form').hidden && $('szpa-form-title').textContent === '创建账户');
  check('注册四个字段及标签齐全', [...$('szpa-register-form').querySelectorAll('input')].length === 4 && [...$('szpa-register-form').querySelectorAll('input')].every(input => document.querySelector(`label[for="${input.id}"]`)));
  check('保留江南建筑素材', document.querySelector('.szpa-architecture').complete && document.querySelector('.szpa-architecture').naturalWidth > 0);
  check('无横向溢出', document.documentElement.scrollWidth <= innerWidth + 1);
  check('已有账号登录链接', document.querySelector('[data-szpa-mode=login]').textContent.includes('立即登录') && new URL(document.querySelector('[data-szpa-mode=login]').href).pathname === '/login');
  $('szpa-register-form').requestSubmit();
  check('空值错误指向四个字段', [...$('szpa-register-form').querySelectorAll('[aria-invalid=true]')].length === 4 && document.activeElement === $('szpa-username'));
  fill('ab', 'invalid', 'short', 'other'); $('szpa-register-form').requestSubmit();
  check('用户名、邮箱、密码及确认验证', !$('szpa-username-error').hidden && !$('szpa-email-error').hidden && !$('szpa-new-password-error').hidden && !$('szpa-confirm-password-error').hidden);
  fill('validuser', 'valid@example.com', 'FixturePassword123', 'different'); $('szpa-register-form').requestSubmit();
  check('不同密码阻止提交', !$('szpa-confirm-password-error').hidden && !$('szpa-register-form').hasAttribute('aria-busy'));
  document.querySelector('[data-szpa-reveal=szpa-new-password]').click();
  check('密码显示可用', $('szpa-new-password').type === 'text');
  document.querySelector('[data-szpa-reveal=szpa-new-password]').click();
  document.querySelector('[data-szpa-mode=login]').click();
  check('已有账号入口可切换', location.pathname === '/login' && !$('szpa-login-form').hidden);
  document.querySelector('[data-szpa-mode=register]').click();
  check('返回注册与清除密码', location.pathname === '/register' && !$('szpa-register-form').hidden && $('szpa-new-password').value === '');
  if (innerWidth === 375) {
    await waitFor(() => !$('szpa-remember').disabled);
    fill('browseruser', 'unique@example.com'); $('szpa-register-form').requestSubmit();
    document.querySelector('[data-szpa-mode=login]').click();
    check('提交中防止误切换', location.pathname === '/register');
    await waitFor(() => !$('szpa-register-form').hasAttribute('aria-busy'));
    check('用户名重复提示准确且获焦点', !$('szpa-username-error').hidden && $('szpa-email-error').hidden && $('szpa-summary').textContent.includes('用户名') && document.activeElement === $('szpa-summary'));
    fill('uniqueuser', 'browser@example.com'); $('szpa-register-form').requestSubmit();
    await waitFor(() => !$('szpa-register-form').hasAttribute('aria-busy'));
    check('邮箱重复提示准确', !$('szpa-email-error').hidden && $('szpa-username-error').hidden && $('szpa-summary').textContent.includes('邮箱'));
    fill('registered-ui', 'registered-ui@example.com'); $('szpa-register-form').requestSubmit();
    await waitFor(() => !$('szpa-success').hidden);
    check('注册成功显示提示并进入登录页', location.pathname === '/login' && !$('szpa-login-form').hidden && $('szpa-success').textContent.includes('注册成功'));
    check('成功提示可访问且不保留密码', document.activeElement === $('szpa-success') && $('szpa-new-password').value === '' && $('szpa-confirm-password').value === '');
    check('用户名预填且回跳目标保留', $('szpa-identifier').value === 'registered-ui' && new URLSearchParams(location.search).get('returnTo') === '/pages/昆山.html');
    $('szpa-success').querySelector('a').click();
    check('成功提示提供立即登录入口', document.activeElement === $('szpa-identifier'));
  }
  return checks;
})()
