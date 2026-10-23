(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const items = [...document.querySelectorAll('.szp-reveal')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('szp-will-reveal');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px 30px 0px' });
    items.forEach(item => { item.classList.add('szp-will-reveal'); observer.observe(item); });
    document.body.classList.add('szp-motion-enabled');
    const revealAll = () => { items.forEach(item => item.classList.remove('szp-will-reveal')); observer.disconnect(); };
    reduced.addEventListener('change', event => { if (event.matches) revealAll(); });
    window.addEventListener('beforeprint', revealAll);
    // Content remains readable even if an observer never fires.
    setTimeout(revealAll, 10000);
  }
  const sections = ['szp-policies', 'szp-comparison', 'szp-about'];
  const links = {
    'szp-policies': document.querySelector('[data-szp-nav="policies"]'),
    'szp-comparison': document.querySelector('[data-szp-nav="comparison"]'),
    'szp-about': document.querySelector('[data-szp-nav="about"]')
  };
  const home = document.querySelector('[data-szp-nav="home"]');
  let scheduled = false;
  function highlight() {
    scheduled = false;
    const offset = document.getElementById('szp-global-header').getBoundingClientRect().height + 80;
    let current = null;
    sections.forEach(id => { if (document.getElementById(id).getBoundingClientRect().top <= offset) current = id; });
    Object.values(links).forEach(link => { link.classList.remove('szp-is-current'); link.removeAttribute('aria-current'); });
    home.removeAttribute('aria-current');
    if (current) { links[current].classList.add('szp-is-current'); links[current].setAttribute('aria-current', 'location'); }
    else home.setAttribute('aria-current', 'page');
  }
  window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(highlight); } }, { passive: true });
  highlight();
})();
