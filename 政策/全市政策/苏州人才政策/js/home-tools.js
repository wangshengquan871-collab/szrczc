(() => {
  'use strict';
  const payload = document.getElementById('szp-portal-data');
  const data = window.SUZHOU_COMPARE, bridge = window.SZP_COMPARE_BRIDGE;
  if (!payload || !data || !bridge) return;
  let catalog;
  try { catalog = JSON.parse(payload.textContent); } catch { return; }
  if (!Array.isArray(catalog.policies) || catalog.policies.length !== 9) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalized = value => String(value).normalize('NFKC').toLocaleLowerCase('zh-CN');
  const money = value => typeof value === 'number' ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '暂无数据';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const regionById = new Map(data.regions.map(r => [r.id, r]));
  const records = new Map(data.amounts.map(r => [r.id, r]));
  const form = document.getElementById('szp-policy-filters');
  const regionFilter = document.getElementById('szp-filter-region');
  const categoryFilter = document.getElementById('szp-filter-category');
  const keyword = document.getElementById('szp-filter-keyword');
  const policyElements = new Map([...document.querySelectorAll('[data-szp-card]')].map(el => [el.dataset.szpCard, el]));
  const searchTexts = new Map(catalog.policies.map(p => [p.id, normalized(p.searchText)]));
  regionFilter.insertAdjacentHTML('beforeend', catalog.policies.map(p => `<option value="${esc(p.id)}">${esc(p.region)}</option>`).join(''));
  function filter() {
    const words = normalized(keyword.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    catalog.policies.forEach(policy => {
      const visible = (regionFilter.value === 'all' || regionFilter.value === policy.id)
        && (categoryFilter.value === 'all' || policy.categories.includes(categoryFilter.value))
        && words.every(word => searchTexts.get(policy.id).includes(word));
      policyElements.get(policy.id).hidden = !visible;
      if (visible) count++;
    });
    document.getElementById('szp-filter-status').textContent = `显示${count}／9个政策入口`;
    document.getElementById('szp-empty-results').hidden = count !== 0;
  }
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => requestAnimationFrame(filter));
  document.getElementById('szp-reset-empty').addEventListener('click', () => { form.reset(); keyword.focus(); });
  form.hidden = false; document.getElementById('szp-result-line').hidden = false; filter();

  const storageKey = 'szp-policy-basket-v1';
  let selected = [], activeView = 'startup', mode = 'range';
  try { selected = bridge.sanitize(JSON.parse(sessionStorage.getItem(storageKey) || '[]')); } catch { /* storage may be disabled */ }
  const choices = [...document.querySelectorAll('[data-szp-add-region]')];
  const basket = document.getElementById('szp-basket');
  const chips = document.getElementById('szp-basket-chips');
  const openComparison = document.getElementById('szp-open-comparison');
  function updateBasket() {
    selected = bridge.sanitize(selected);
    choices.forEach(button => {
      const on = selected.includes(button.dataset.szpAddRegion);
      button.hidden = false;
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? '✓ 已加入比较' : '＋ 加入比较';
      button.disabled = selected.length === 4 && !on;
      button.title = button.disabled ? '最多选择4个地区，移除一个后可继续添加' : '';
    });
    document.getElementById('szp-basket-count').textContent = selected.length + '／4';
    document.getElementById('szp-basket-status').textContent = selected.length === 0 ? '选择2–4个地区，进入原有详比页面。' : selected.length === 1 ? '再选择1个地区即可比较。' : `已选${selected.length}个地区。${selected.length === 4 ? '已达到4地上限，可移除后更换。' : '可以继续添加，最多4个地区。'}`;
    chips.innerHTML = selected.map(id => `<span class="szp-basket-chip"><a href="pages/${esc(regionById.get(id).file)}" aria-label="查看${esc(regionById.get(id).name)}政策详情">${esc(regionById.get(id).short)} ↗</a><button type="button" data-szp-remove-region="${id}" aria-label="从比较篮移除${esc(regionById.get(id).name)}">×</button></span>`).join('');
    openComparison.disabled = selected.length < 2;
    document.getElementById('szp-clear-basket').disabled = selected.length === 0;
    try { sessionStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* compare remains usable */ }
  }
  choices.forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.szpAddRegion;
    if (selected.includes(id)) selected = selected.filter(value => value !== id);
    else if (selected.length < 4) selected.push(id);
    updateBasket();
  }));
  chips.addEventListener('click', event => {
    const remove = event.target.closest('[data-szp-remove-region]');
    if (!remove) return;
    const id = remove.dataset.szpRemoveRegion;
    selected = selected.filter(value => value !== id); updateBasket();
    choices.find(button => button.dataset.szpAddRegion === id)?.focus();
  });
  document.getElementById('szp-clear-basket').addEventListener('click', () => { selected = []; updateBasket(); });
  openComparison.addEventListener('click', () => { if (selected.length >= 2) location.href = bridge.link(selected, activeView); });
  basket.hidden = false; updateBasket();

  // Same record IDs, maximum sorting and tie order as the existing comparison model.
  const ranked = view => view.ids.map(id => records.get(id)).filter(r => r && typeof r.max === 'number' && Number.isFinite(r.max)).sort((a,b) => a.max - b.max || regionById.get(a.regionId).order - regionById.get(b.regionId).order);
  function discrete(record) {
    if (!/[\/或]/.test(record.tiers)) return [];
    const text = record.tiers.split(/[（(]/)[0];
    return [...new Set(text.split(/[\/或]/).map(s => s.trim()).filter(s => /^\d+(?:\.\d+)?$/.test(s)).map(Number))];
  }
  function rangePlot(record, ceiling) {
    const x = amount => 10 + amount / ceiling * 780;
    const points = discrete(record);
    const line = record.min === null ? '' : `<line x1="${x(record.min)}" y1="18" x2="${x(record.max)}" y2="18" stroke="#688473" stroke-width="3" ${points.length ? 'stroke-dasharray="5 5"' : ''}/>`;
    const mid = points.filter(value => value !== record.min && value !== record.max).map(value => `<circle cx="${x(value)}" cy="18" r="4" fill="#f7f6f2" stroke="#587665" stroke-width="2"/>`).join('');
    const min = record.min === null ? '' : `<circle cx="${x(record.min)}" cy="18" r="5" fill="#b69761"/>`;
    return `<svg class="szp-range-svg" viewBox="0 0 800 36" aria-hidden="true" focusable="false"><path d="M10 18h780" stroke="#e3e7dc" stroke-width="2"/>${line}${mid}${min}<circle cx="${x(record.max)}" cy="18" r="5" fill="#365c49"/></svg>`;
  }
  function barPlot(record, ceiling) {
    const min = record.min === null ? '<span class="szp-no-minimum">最低金额暂无数据</span>' : `<span class="szp-bar-track"><i class="szp-minimum-bar${record.min === 0 ? ' szp-zero-bar' : ''}" style="width:${record.min / ceiling * 100}%"></i></span>`;
    return `<div class="szp-preview-bar"><span>最低</span>${min}</div><div class="szp-preview-bar"><span>最高</span><span class="szp-bar-track"><i class="szp-maximum-bar${record.max === 0 ? ' szp-zero-bar' : ''}" style="width:${record.max / ceiling * 100}%"></i></span></div>`;
  }
  function boundary(record, separate) {
    return `<li><strong>${esc(regionById.get(record.regionId).short)} · ${esc(record.subtype)}</strong><span>${record.max === null ? '暂无数据／待核实' : esc(record.tiers) + '万元'} · ${esc(record.nature)}</span><p>${esc(record.boundary)}${separate ? ' 此项未纳入同口径排名。' : ''}</p><a href="${esc(bridge.evidence(record, activeView))}">${esc(record.id)} · 原表A${record.sourceRow} ↗</a></li>`;
  }
  function renderChart() {
    const view = data.views.find(v => v.id === activeView), rows = ranked(view), ceiling = Math.max(1, ...rows.map(r => r.max));
    const unknown = view.ids.map(id => records.get(id)).filter(r => r && r.max === null);
    const separate = view.separate.map(id => records.get(id)).filter(Boolean);
    const panel = document.getElementById('szp-preview-panel');
    panel.setAttribute('aria-labelledby', 'szp-chart-' + activeView);
    panel.innerHTML = `<figure class="szp-amount-figure"><figcaption><h4>${esc(view.title)} · ${mode === 'range' ? '区间与明确档次' : '最低／最高金额排序'}</h4><p>${esc(view.subtitle)}</p><span>单位：万元 · 按最高金额升序，同额沿用原表顺序 · 共同刻度：0—${money(ceiling)}</span></figcaption><div class="szp-preview-legend"><span><i class="szp-legend-min"></i>明确最低金额</span><span><i class="szp-legend-max"></i>最高金额</span>${mode === 'range' ? '<span><i class="szp-legend-tier"></i>明确离散档次</span>' : ''}</div><ol class="szp-preview-ranking">${rows.map(record => `<li class="szp-preview-row" data-szp-record="${record.id}"><div class="szp-preview-region"><a href="pages/${esc(regionById.get(record.regionId).file)}">${esc(regionById.get(record.regionId).short)} ↗</a><span>${esc(record.nature)}</span></div><div class="szp-preview-values"><strong>${esc(record.tiers)}</strong><span>最低 ${money(record.min)}${record.min === null ? '' : '万元'} · 最高 ${money(record.max)}万元</span></div><div class="szp-preview-plot">${mode === 'range' ? rangePlot(record, ceiling) : barPlot(record, ceiling)}</div><div class="szp-preview-boundary"><span>${esc(record.boundary)}${record.max === 0 ? '；另有住房及企业引才支持。' : ''}</span><a href="${esc(bridge.evidence(record, activeView))}">${record.id} · A${record.sourceRow} ↗</a></div></li>`).join('')}</ol><p class="szp-chart-reading">${mode === 'range' ? '虚线只连接离散档次的最低与最高值，圆点仅表示原表明确列出的档次。' : '最低与最高柱共用同一刻度。'}离散档次不表示区间内任意金额均可获批；仅列上限时不补造最低金额，缺失值不按0排名。不同性质的支持分别阅读，不作总包合计。</p></figure>${unknown.length || separate.length ? `<details class="szp-preview-exceptions"><summary>暂无数据与单列口径 · ${unknown.length + separate.length}项${unknown.length ? '（含' + unknown.map(r => esc(regionById.get(r.regionId).short)).join('、') + '）' : ''}</summary><ul>${unknown.map(r => boundary(r, false)).join('')}${separate.map(r => boundary(r, true)).join('')}</ul></details>` : ''}<details class="szp-preview-table"><summary>查看可核对的金额数据表</summary><div tabindex="0" class="szp-preview-table-scroll" role="region" aria-label="当前类别金额数据表"><table><caption>${esc(view.title)} · Excel政策金额数据工作表 · 单位：万元</caption><thead><tr><th scope="col">地区</th><th scope="col">最低</th><th scope="col">最高</th><th scope="col">原始档次</th><th scope="col">资金性质</th><th scope="col">原表定位</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${esc(regionById.get(r.regionId).short)}</th><td>${money(r.min)}</td><td>${money(r.max)}</td><td>${esc(r.tiers)}</td><td>${esc(r.nature)}</td><td><a href="${esc(bridge.evidence(r, activeView))}">${r.id} · A${r.sourceRow}</a></td></tr>`).join('')}</tbody></table></div></details>`;
    document.getElementById('szp-full-chart-link').href = bridge.link([], activeView, 'amounts');
    document.getElementById('szp-chart-snapshot').textContent = data.asOf;
  }
  const tabs = [...document.querySelectorAll('[data-szp-chart-view]')];
  function setView(id, focus = false) {
    activeView = id;
    tabs.forEach(tab => { const on = tab.dataset.szpChartView === id; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; if (on && focus) tab.focus(); });
    renderChart();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setView(tab.dataset.szpChartView));
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (Object.hasOwn(next, event.key)) { event.preventDefault(); setView(tabs[next[event.key]].dataset.szpChartView, true); }
    });
  });
  document.querySelectorAll('[data-szp-chart-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.szpChartMode;
    document.querySelectorAll('[data-szp-chart-mode]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    renderChart();
  }));
  document.getElementById('szp-chart-preview').hidden = false; renderChart();

  const backTop = document.getElementById('szp-back-top');
  function updateBackTop() {
    const css = getComputedStyle(backTop);
    const right = innerWidth - parseFloat(css.right), bottom = innerHeight - parseFloat(css.bottom);
    const left = right - parseFloat(css.width), top = bottom - parseFloat(css.height);
    const obstructsControl = [...document.querySelectorAll('.szp-basket-actions button, .szp-card-actions button, .szp-policy-filters button, .szp-preview-controls button')].some(button => {
      const r = button.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left < right && r.right > left && r.top < bottom && r.bottom > top;
    });
    backTop.hidden = scrollY < 600 || obstructsControl;
  }
  window.addEventListener('scroll', updateBackTop, { passive: true });
  window.addEventListener('resize', updateBackTop, { passive: true });
  document.addEventListener('click', () => requestAnimationFrame(updateBackTop), { passive: true });
  form.addEventListener('input', () => requestAnimationFrame(updateBackTop));
  backTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
    const title = document.getElementById('szp-hero-title');
    title.tabIndex = -1; title.focus({ preventScroll: true });
  });
  const counters = [...document.querySelectorAll('[data-szp-count]')];
  let countsStopped = false;
  const finishCounts = () => counters.forEach(el => { el.textContent = el.dataset.szpCount; });
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const started = performance.now();
      function frame(now) {
        if (reduced.matches || countsStopped) { finishCounts(); return; }
        const t = Math.min(1, (now - started) / 850);
        counters.forEach(el => { el.textContent = String(Math.round(Number(el.dataset.szpCount) * (1 - (1-t) ** 3))); });
        if (t < 1) requestAnimationFrame(frame); else finishCounts();
      }
      requestAnimationFrame(frame);
    });
    observer.observe(document.querySelector('.szp-data-overview'));
    reduced.addEventListener('change', event => { if (event.matches) { observer.disconnect(); finishCounts(); } });
  }
  window.addEventListener('beforeprint', () => { countsStopped = true; finishCounts(); });
})();
