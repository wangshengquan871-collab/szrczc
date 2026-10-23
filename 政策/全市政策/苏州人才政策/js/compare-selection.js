/* Shared, validated handoff to the existing comparison page. No policy records change. */
(() => {
  'use strict';
  const root = new URL('../', document.currentScript.src);
  const data = window.SUZHOU_COMPARE;
  if (!data) return;
  const valid = new Set(data.regions.map(r => r.id));
  const sanitize = ids => {
    const picked = new Set([...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && valid.has(id)))].slice(0, 4));
    return data.regions.filter(r => picked.has(r.id)).map(r => r.id);
  };
  function link(ids = [], view = 'startup', hash = 'compare') {
    const url = new URL('pages/政策对比.html', root);
    const selected = sanitize(ids);
    if (selected.length >= 2) url.searchParams.set('regions', selected.join(','));
    if (data.views.some(v => v.id === view)) url.searchParams.set('view', view);
    url.hash = hash;
    return url.href;
  }
  function evidence(record, view) {
    const url = new URL(link([], view, 'source'));
    url.searchParams.set('source-sheet', '政策金额数据');
    url.searchParams.set('source-cell', 'A' + record.sourceRow);
    return url.href;
  }
  window.SZP_COMPARE_BRIDGE = { sanitize, link, evidence };
  if (decodeURIComponent(location.pathname.split('/').pop()) !== '政策对比.html') return;
  const query = new URLSearchParams(location.search);
  const selected = sanitize((query.get('regions') || '').split(','));
  if (selected.length >= 2) selected.forEach(id => document.querySelector('.region-choice[data-select-region="' + id + '"]')?.click());
  const view = query.get('view');
  if (data.views.some(v => v.id === view)) document.querySelector('[data-view="' + view + '"]')?.click();
  const sheet = query.get('source-sheet'), cell = query.get('source-cell');
  const reference = [...document.querySelectorAll('[data-source-sheet][data-source-cell]')].find(el => el.dataset.sourceSheet === sheet && el.dataset.sourceCell === cell);
  if (reference) reference.click();
  else if (selected.length >= 2 && location.hash === '#compare') requestAnimationFrame(() => document.getElementById('compare')?.scrollIntoView({ behavior: 'instant' }));
})();
