/* 姑苏区页面结构与交互。政策内容见 policy-data.js，样式见 styles.css。 */
(() => {
  'use strict';
  const data = window.GUSU_POLICY;
  const source = window.GUSU_SOURCE;
  const page = document.getElementById('page-content');
  if (!data || !source) {
    page.textContent = '政策数据未能加载，请确认“姑苏区资源”文件夹与 HTML 位于同一目录。';
    return;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shapes = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    sprout: '<path d="M12 21v-9M12 15C5 15 3 9 3 5c7 0 9 4 9 10Zm0-4c0-6 3-8 9-8 0 6-3 8-9 8Z"/>',
    bank: '<path d="m3 8 9-5 9 5H3Zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
    chart: '<path d="M3 3v18h18M7 16l5-6 4 3 5-8"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5M9 9h6v6H9Z"/>',
    building: '<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 8h1m6 0h1M8 12h1m6 0h1"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
    book: '<path d="M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2m0-15c4-3 8-3 10-2v15c-4-1-7 0-10 2V6Z"/>',
    heart: '<path d="M12 21 3 12C-2 6 6 0 12 6c6-6 14 0 9 6l-9 9Z"/>',
    people: '<circle cx="8" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m3-7a4 4 0 0 1 5 4v3"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4M9 6h6"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.document}</svg>`;
  const heading = (number, eyebrow, title, text) => `<div class="section-heading"><div class="section-eyebrow"><span class="section-number">${esc(number)}</span><span>${esc(eyebrow)}</span></div><div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div></div>`;
  const note = (title, text, warm = false) => `<div class="note${warm ? ' note-warm' : ''}">${icon('info')}<div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></div>`;
  const link = (url, label, className = '') => /^https?:\/\//.test(url) ? `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>` : esc(label);
  const table = (headers, rows, caption) => `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map(text => `<th scope="col">${esc(text)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((text, i) => i ? `<td>${esc(text)}</td>` : `<th scope="row">${esc(text)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const requirements = rows => `<dl class="requirements-grid">${rows.map(([title, text]) => `<div class="requirement"><dt>${esc(title)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl>`;

  shapes.card = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18m-14 6h5"/>';
  shapes.garden = '<path d="M3 21h18M5 21V10l7-5 7 5v11M2 10h20M8 5l4-3 4 3M9 21v-7h6v7"/>';
  const sourceReferences = source.blocks.flatMap(block => block.links);
  const notice = sourceReferences.find(item => /2025.*申报通知/.test(item.text));
  const paragraphCount = source.blocks.filter(block => block.type === 'paragraph').length;
  const tableCount = source.blocks.filter(block => block.type === 'table').length;

  function renderHero() {
    const art = `<svg class="hero-art" viewBox="0 0 620 460" role="img" aria-labelledby="art-title"><title id="art-title">以姑苏古城、水巷与科技创新为灵感的几何插画</title><defs><linearGradient id="city-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eee6da"/><stop offset="1" stop-color="#f6f0e6"/></linearGradient><linearGradient id="city-water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#afbdaf"/><stop offset="1" stop-color="#728b83"/></linearGradient></defs><circle cx="309" cy="220" r="170" fill="url(#city-bg)"/><circle cx="309" cy="220" r="190" fill="none" stroke="#cbbbac" stroke-dasharray="3 8"/><circle cx="429" cy="113" r="29" fill="#c18a53"/><g fill="none" stroke="#d7cabc"><path d="M93 250h419M121 197h176m66 0h123M175 289h251"/></g><g fill="#f9f6eb" stroke="#6d5558" stroke-width="1.5"><path d="M163 228h77v77h-77Zm88-19h80v95h-80Zm90 16h84v80h-84Z"/><path d="m151 228 50-29 51 29Zm89-19 50-35 52 35Zm90 16 53-30 55 30Z" fill="#6d5558"/><path d="M188 305v-48h27v48m62-1v-63h27v63m61 1v-43h31v43" fill="#baa79a"/><path d="M169 250h10m47 0h9m25-11h10m45 0h10m25 12h9m49 0h9"/></g><g transform="translate(288 125)"><path d="M0 0h24v49H0ZM-7 5h38M-9 18h42M-11 30h46M-12 41h48" fill="#e6d9bd" stroke="#7a6359" stroke-width="1.4"/><path d="m-5 0 17-13L29 0" fill="#6d5558"/></g><path d="M98 310c104-31 238-9 402 0 18 25-52 66-180 72-123 6-196-20-222-72Z" fill="url(#city-water)"/><path d="M193 313c10-67 115-67 127 0h-23c-5-43-75-43-81 0Z" fill="#cdbda4" stroke="#8c7667" stroke-width="1.5"/><path d="M194 312h-12m139 0h13M207 285h99" fill="none" stroke="#8c7667"/><g stroke="#e7e9dc" fill="none" stroke-width="1.4"><path d="M130 327c34-5 72-3 105 2m40 19c39 6 87 7 136 0m-220 15c49 9 99 9 136 4"/></g><g stroke="#60786c" fill="#60786c"><path d="M137 310v-30m-12 11 12-40 12 40Zm319 13v-31m-12 9 12-38 12 38Z"/></g><g fill="none" stroke="#9d8074" stroke-width="1.2"><path d="M98 135h67v26m-10 18h-34m338 76h55"/><circle cx="98" cy="135" r="5"/><circle cx="155" cy="179" r="5"/><circle cx="514" cy="255" r="5"/></g><rect x="438" y="280" width="87" height="42" rx="8" fill="#563a43"/><text x="481" y="307" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="16" fill="#fff">区级计划</text><text x="73" y="70" font-size="10" letter-spacing="3" fill="#8b7868">GUSU · INNOVATION</text><text x="321" y="422" font-size="10" letter-spacing="2" fill="#8b7868">NEW IDEAS IN AN ANCIENT CITY</text></svg>`;
    return `<section class="hero container" id="overview" aria-labelledby="hero-title"><div class="hero-content"><div class="hero-eyebrow"><span class="status-dot"></span> GUSU DISTRICT <span>/</span> 区级政策导览</div><h1 id="hero-title">姑苏区<br>领军人才计划<span class="title-dot">。</span></h1><div class="hero-subtitle">科技创新创业 · 与市级同名计划区分</div><p class="hero-description">${esc(data.intro)}</p><div class="hero-actions"><a class="button button-primary" href="#projects">了解项目与条件 ${icon('arrow')}</a><a class="text-link" href="#source">查看完整原文 ${icon('document')}</a></div><div class="hero-meta"><span>${esc(data.basis)}</span><span>申报条件及日期按 2025 年示例展示</span></div></div><div class="hero-visual">${art}<div class="visual-caption">古城新意 · 创业姑苏</div></div></section><div class="overview-strip container"><div><strong>100<small>万元</small></strong><span>创业领军扶持资金最高</span></div><div><strong>50<small>万元</small></strong><span>创业孵化扶持资金最高</span></div><div><strong>30<small>万元</small></strong><span>领军与孵化办公用房补贴上限</span></div><div><strong>两大方向</strong><span>科技创业 · 科技创新</span></div></div><div class="reading-note container">${icon('info')}<p>本页根据提供的 Word 整理。区级资金、市级生活通道与历史批次分别标注，<a href="#source">${paragraphCount} 段正文及 ${tableCount} 张表格完整保留 →</a></p></div>`;
  }

  function renderProjects() {
    return `<section class="policy-section container" id="projects" aria-labelledby="projects-title">${heading('01', 'PROJECTS & ELIGIBILITY', '创新与创业，找到合适的支持路径', data.scope)}<h3 id="projects-title" class="sr-only">创业领军、创业孵化与创新领军条件</h3><div class="project-cards">${data.projects.map((project, i) => `<article class="project-card${project.id === 'innovation' ? ' project-innovation' : ''}"><div class="project-card-top">${icon(project.id === 'innovation' ? 'chip' : 'sprout')}<span>0${i + 1}</span></div><span class="eyebrow">${esc(project.tag)}</span><h3>${esc(project.name)}</h3><p class="project-description">${esc(project.intro)}</p><div class="project-amount"><strong>${project.grant === null ? project.housing : project.grant}<small>万元</small></strong><span>${project.grant === null ? '住房补贴最高 · 无区级项目资助' : '创业扶持资金最高'}</span></div><button type="button" class="text-link project-select" data-project="${project.id}">查看申报条件 ${icon('arrow')}</button></article>`).join('')}</div><div class="industry-tags"><span>重点创业领域</span>${data.industries.map(industry => `<span class="tag">${esc(industry)}</span>`).join('')}</div><div class="eligibility"><div class="tab-list" role="tablist" aria-label="选择项目类别查看条件">${data.projects.map((project, i) => `<button type="button" role="tab" class="tab-button${i === 0 ? ' is-active' : ''}" id="tab-${project.id}" aria-controls="panel-${project.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-tab="${project.id}">${esc(project.name)}</button>`).join('')}</div>${data.projects.map((project, i) => `<div class="tab-panel" role="tabpanel" id="panel-${project.id}" aria-labelledby="tab-${project.id}" tabindex="0" ${i ? 'hidden' : ''}><div class="panel-heading"><div><span class="eyebrow">${esc(project.tag)}</span><h3>${esc(project.name)}</h3></div><span class="panel-index">0${i + 1}</span></div>${requirements(project.criteria)}${note('时间门槛说明', data.dateNote, true)}</div>`).join('')}</div></section>`;
  }

  function renderFunding() {
    return `<section class="section-band" id="funding" aria-labelledby="funding-title"><div class="policy-section container">${heading('02', 'SUPPORT & DELIVERY', '资助看用途，兑现看合同', '资金上限、支持对象和兑现条件分别理解。以下均为区级办法的文档列示口径。')}<h3 id="funding-title" class="sr-only">区级支持标准与合同兑现</h3>${table(['区级支持项目', '创业领军类', '创业孵化类', '创新领军人才'], data.fundingRows, '区级支持矩阵 · 金额为上限，不代表统一领取额度')}<div class="funding-layout gusu-funding-layout"><div><div class="sub-heading"><h3>创业扶持资金对比</h3><span>单位：万元 · 支持上限</span></div><div class="grant-bars" role="img" aria-label="创业领军扶持资金最高100万元，孵化最高50万元，区级创新领军未设置独立项目资助"><div><span>创业领军</span><div class="grant-track"><span style="width:100%"></span></div><strong>100</strong></div><div><span>创业孵化</span><div class="grant-track"><span style="width:50%"></span></div><strong>50</strong></div><div><span>创新领军</span><div class="grant-track grant-unavailable">未设置独立项目资助</div><strong>—</strong></div></div><ol class="funding-timeline">${data.milestones.map(([title, text], i) => `<li><span class="timeline-dot">0${i + 1}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></li>`).join('')}</ol></div><aside class="calculator payment-explainer"><span class="eyebrow">拨付规则 · 准确呈现</span><h3>先签合同，<br>再按进展兑现。</h3><div class="contract-diagram"><span>立项认定</span><b aria-hidden="true">↓</b><span class="contract-key">三方项目合同</span><b aria-hidden="true">↓</b><span>达到兑现条件 · 分期办理</span></div><p class="calculator-note">Word 只明确“根据项目进展情况分期拨付”，未提供统一比例、每期金额和固定到账周期。本页不将其他地区的分期比例套入。</p></aside></div><div class="tools-heading"><h3>发展扶持，按对应条款分别申请</h3><p>滚动扶持、追加奖励和成长类条款有各自条件，不能直接相加作为统一待遇。</p></div><div class="support-tools">${data.extraSupport.map(item => `<article class="support-tool"><span class="tag${item.tag.includes('待确认') || item.tag.includes('成长类') ? ' tag-warm' : ''}">${esc(item.tag)}</span><h4>${esc(item.title)}</h4><p class="tool-amount">${esc(item.value)}<small>${esc(item.unit)}</small></p><p>${esc(item.text)}</p></article>`).join('')}</div>${note('成长类申报通道尚需确认', '2021 年办法设领军、成长、孵化三类，但所提供的 2025 年通知只列领军与孵化受理通道。成长类条款保留作政策阅读，不据此判断当前开放。', true)}<div class="exit-grid">${data.exitRules.map(([title, text]) => `<article><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div></div></section>`;
  }

  function renderHousing() {
    return `<section class="policy-section container" id="housing" aria-labelledby="housing-title">${heading('03', 'HOUSING & COURTESY', '安居与礼遇，分清区级和市级', '区级住房支持与市级乐居待遇有各自标准和申请规则，衔接未明确的部分不直接加总。')}<div class="housing-banner"><div><span class="eyebrow" id="housing-title">区级住房补贴</span><h3>创业领军最高 100 万元，<br>创业孵化、创新领军最高 50 万元。</h3><p>在苏州市区（含吴江）购买自用住宅。市级购房贴、租房贴另按人才分类、适用时间及不重复规则办理。</p></div><div class="housing-amount"><strong>100<small>万元</small></strong><span>区级创业领军住房补贴最高</span><span class="housing-cap">区、市住房待遇不能简单相加</span></div></div><div class="housing-rules">${data.housingRules.map(([title, text], i) => `<article><span class="rule-number">0${i + 1}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div>${note('申请市级乐居前，先核清分类与衔接', '按文档，区级领军对应市级 C 类口径，入选市级姑苏计划的相应人才对应 B 类；须按市级分类认定与申领规则办理。区级称号本身不等同已获批市级补贴，也不代表可以与区级住房资助叠加。', true)}<div class="city-heading"><h3>市级分类标准，作为独立通道阅读</h3><p>以下来自 Word 的市级表述，不是本区级计划的统一资助标准。</p></div>${table(['文档列示分类', '购房贴最高', '租房贴标准', '租房期限'], data.cityCategories.map(category => [category.title, category.purchase + ' 万元', category.rent.toLocaleString('zh-CN') + ' 元 / 月', '不超过 ' + category.years + ' 年']), '市级乐居分类与标准 · 具体按对应政策核定')}<div class="housing-calculator rent-calculator"><div><span class="eyebrow">租房标准 · 金额演示</span><h3>按月标准，理解租房支持规模。</h3><p>选择资料列示的人才类别和示例月数，仅计算“月标准 × 月数”的理论金额，不能代表已获批或实际到账。</p><p class="detail-footnote">文档列 2025 年起适用的时间条件为：2024-07-05（含）之后首次来苏或新入选相应计划的 A—D 类人才。仍需满足住房、分类及申领条件。</p></div><div class="housing-calc-controls"><label class="field-label" for="rent-category">市级分类（文档口径）</label><select id="rent-category">${data.cityCategories.map(category => `<option value="${category.id}">${esc(category.title)}</option>`).join('')}</select><div class="rent-month-control"><label class="field-label" for="rent-months">示例补贴月数 <strong id="rent-month-label">36 个月</strong></label><input id="rent-months" type="range" min="1" max="36" step="1" value="36"></div><div class="rent-results" id="rent-results" aria-live="polite" aria-atomic="true"></div><p class="calculator-note" id="rent-category-note"></p></div></div>${note('理论总额与实际申领分开理解', '获得购房贴、相应人才计划待遇或优租房等情形，租房贴须按规则停发、扣除；已享安家费或住房等类似待遇的不重复享受。办公用房补贴是创业支持工具，不能与人才住房待遇混为一项。')}<div class="life-heading"><h3>从创业支持，到人才生活服务</h3><p>区级礼遇卡、姑苏人才礼遇通与市级苏才码分别按服务身份和适用条件办理。</p></div><div class="life-grid">${data.services.map(service => `<article>${icon(service.icon)}<h4>${esc(service.title)}</h4><p>${esc(service.text)}</p></article>`).join('')}</div></section>`;
  }
  function renderProcess() {
    return `<section class="section-band" id="process" aria-labelledby="process-title"><div class="policy-section container">${heading('04', 'APPLICATION JOURNEY', '从属地推荐，到三方合同', '常年接受申报、集中组织评审。具体受理窗口、时间门槛与材料附件按当年通知核对。')}<div class="application-banner"><div><span class="eyebrow" id="process-title">2025 年度申报示例 · 历史窗口</span><h3>填报与街道推荐，有不同截止时间。</h3><p>2025 年填报截止：10 月 20 日 17:00 <span class="tag tag-warm">该年度窗口已结束</span></p><p class="detail-footnote">单位注册后需联系属地街道经济部门激活账号。本资料未提供 2026 年正式受理通知。</p></div>${notice ? link(notice.url, '查看 2025 年通知', 'button button-primary') : ''}</div><ol class="deadline-timeline">${data.deadlines.map(([time, text]) => `<li><strong>${esc(time)}</strong><span>${esc(text)}</span></li>`).join('')}</ol>${note('申报月历与正式通知区别', 'Word 引用的 2026 版申报月历列 7—8 月，属于时间安排参考，不能代替当年度正式申报通知。2024 年第一批与 2025 年窗口也不同，本页不根据旧例判断当前开放。', true)}<ol class="process-list">${data.steps.map(([title, text], i) => `<li><span class="process-number">0${i + 1}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></li>`).join('')}</ol><div class="material-columns"><article><h3>创业领军材料</h3><ul>${data.materials.startup.map(text => `<li>${esc(text)}</li>`).join('')}</ul></article><article><h3>创新领军材料</h3><ul>${data.materials.innovation.map(text => `<li>${esc(text)}</li>`).join('')}</ul></article></div>${note('赛事与简化评审通道', data.fastTrack)}</div></section>`;
  }

  function renderStatistics() {
    const total = data.batches.reduce((sum, batch) => sum + batch.count, 0);
    const maximum = Math.max(...data.batches.map(batch => batch.count));
    return `<section class="policy-section container" id="insights" aria-labelledby="insights-title">${heading('05', 'BATCHES WITH CONTEXT', '只比较已知批次，不推算全年结果', '以下为资料记载的拟认定（立项）项目数，受理总数与部分批次数量未取得。')}<div class="batch-layout"><div class="batch-total" id="insights-title"><span class="tag">文档已记载数量的批次</span><strong>${total}<small>个</small></strong><h3>三个已知批次之和</h3><p>12 ＋ 10 ＋ 20<br>不是历年累计或三年的全年合计。</p></div><div class="batch-chart" role="img" aria-label="2023年第一批12个，2024年第一批10个，2025年单一批次20个，均为文档列示拟认定项目数">${data.batches.map(batch => `<div class="batch-row"><div class="batch-label"><strong>${esc(batch.label)}</strong><span>${batch.count} 个</span></div><div class="batch-track"><span style="width:${batch.count / maximum * 100}%"></span></div><p>公示时间：${esc(batch.date)}</p></div>`).join('')}<div class="batch-axis"><span>0</span><span>${maximum} 个</span></div></div></div><div class="missing-batches"><span>未取得数量</span><span class="tag tag-warm">2023 年第二批</span><span class="tag tag-warm">2024 年第二批</span></div><div class="statistics-notes"><h3>统计边界与原文差异</h3><ul>${data.batchNotes.map(text => `<li>${esc(text)}</li>`).join('')}</ul><a class="text-link" href="#source">查阅完整统计表与来源 ${icon('arrow')}</a></div></section>`;
  }

  function renderSource() {
    let tableIndex = 0;
    return `<section class="source-section" id="source" aria-labelledby="source-title"><div class="policy-section container">${heading('06', 'SOURCE & FULL TEXT', '每一条政策，都可回到文档核对', '保留完整 Word 正文、表格与原有超链接；概览中标注差异，原文保持提供资料的表述。')}<div class="source-heading" id="source-title"><strong>${paragraphCount} 段正文 · ${tableCount} 张表格</strong><span>来源：${esc(source.fileName)}</span></div><a class="source-download" href="../姑苏区领军人才政策.docx" download>${icon('document')}<span><strong>${esc(source.fileName)}</strong><small>下载源 Word 文档</small></span><span aria-hidden="true">↗</span></a><div class="reference-links">${link(data.links.policy, '区级实施办法（Word 引用）', 'reference-link')}${notice ? link(notice.url, '2025 年度申报通知（Word 引用）', 'reference-link') : ''}${link(data.links.courtesy, '姑苏人才礼遇通（Word 引用）', 'reference-link')}</div><p class="detail-footnote">本页对提供资料作整理，未独立核实外部链接最新内容。历史窗口、原文数据状态、第三方转载及未取得数量应分别理解。</p><label class="source-search" for="source-search">${icon('search')}<input id="source-search" type="search" placeholder="搜索原文，例如：实缴、成长类、住房、2025" autocomplete="off"><button id="clear-search" type="button" aria-label="清空原文搜索" hidden>×</button></label><p class="search-status" id="search-status" aria-live="polite">完整保留 ${paragraphCount} 段正文与 ${tableCount} 张表格；原文中的差异、历史口径和待核实信息也予以保留。</p><details class="source-document" id="source-document"><summary><span>展开完整 Word 内容</span><span class="source-count">${paragraphCount + tableCount} 个原文内容块</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="source-document-content">${source.blocks.map((block, index) => {
      const content = block.type === 'table' ? table(block.rows[0], block.rows.slice(1), `原文表格 ${++tableIndex}`) : `<p>${esc(block.text)}</p>`;
      return `<div class="source-block" data-source-index="${index}">${content}${block.links.length ? `<div class="source-inline-links">${block.links.map(item => link(item.url, item.text)).join('')}</div>` : ''}</div>`;
    }).join('')}</div></details></div></section>`;
  }

  function calculateRent(categoryId, monthCount) {
    const category = data.cityCategories.find(item => item.id === categoryId);
    if (!category) throw new Error('Unknown category');
    const maximumMonths = category.years * 12;
    const numeric = Number(monthCount);
    const months = Math.min(maximumMonths, Math.max(1, Number.isFinite(numeric) ? Math.round(numeric) : 1));
    return { category, months, maximumMonths, totalYuan: category.rent * months };
  }

  page.innerHTML = [renderHero(), renderProjects(), renderFunding(), renderHousing(), renderProcess(), renderStatistics(), renderSource()].join('');

  function selectProject(id, focus = false, scroll = false) {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      const selected = tab.dataset.tab === id;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${id}`; });
    if (scroll) document.querySelector('.eligibility').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => selectProject(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = data.projects.findIndex(item => item.id === tab.dataset.tab);
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? data.projects.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + data.projects.length) % data.projects.length;
      selectProject(data.projects[target].id, true);
    });
  });
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => selectProject(button.dataset.project, true, true)));

  function updateRent() {
    const range = document.getElementById('rent-months');
    const result = calculateRent(document.getElementById('rent-category').value, range.value);
    range.max = result.maximumMonths;
    range.value = result.months;
    document.getElementById('rent-month-label').textContent = `${result.months} 个月`;
    document.getElementById('rent-results').innerHTML = `<div><span>文档月标准</span><strong>${result.category.rent.toLocaleString('zh-CN')}<small>元 / 月</small></strong></div><div><span>${result.months} 个月理论总额</span><strong>${Number((result.totalYuan / 10000).toFixed(2)).toLocaleString('zh-CN')}<small>万元</small></strong></div><p>示例期限不超过 ${result.maximumMonths} 个月。金额须结合实际资格、停发及扣除规则核定。</p>`;
    document.getElementById('rent-category-note').textContent = result.category.description;
  }
  document.getElementById('rent-category').addEventListener('change', updateRent);
  document.getElementById('rent-months').addEventListener('input', updateRent);
  updateRent();

  const search = document.getElementById('source-search');
  const clear = document.getElementById('clear-search');
  const original = document.getElementById('source-document');
  const sourceBlocks = Array.from(document.querySelectorAll('.source-block'));
  const searchTexts = source.blocks.map(block => (block.type === 'table' ? block.rows.flat().join(' ') : block.text).normalize('NFKC').toLocaleLowerCase('zh-CN'));
  function filterSource() {
    const query = search.value.trim().normalize('NFKC').toLocaleLowerCase('zh-CN');
    let count = 0;
    sourceBlocks.forEach((block, index) => {
      const visible = !query || searchTexts[index].includes(query);
      block.hidden = !visible;
      if (visible) count++;
    });
    if (query) original.open = true;
    clear.hidden = !query;
    document.getElementById('search-status').textContent = query ? `找到 ${count} 个匹配段落或表格${count ? '，见下方原文。' : '，请尝试其他关键词。'}` : `完整保留 ${paragraphCount} 段正文与 ${tableCount} 张表格；原文中的差异、历史口径和待核实信息也予以保留。`;
  }
  search.addEventListener('input', filterSource);
  clear.addEventListener('click', () => { search.value = ''; filterSource(); search.focus(); });
  original.addEventListener('toggle', () => { original.querySelector('summary > span').textContent = original.open ? '收起完整 Word 内容' : '展开完整 Word 内容'; });
  const top = document.getElementById('back-top');
  window.addEventListener('scroll', () => { top.hidden = window.scrollY < 800; }, { passive: true });
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  if ('IntersectionObserver' in window) {
    const nav = Array.from(document.querySelectorAll('.desktop-nav a'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        nav.forEach(item => {
          const selected = item.hash === `#${entry.target.id}`;
          item.classList.toggle('is-active', selected);
          if (selected) item.setAttribute('aria-current', 'location'); else item.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
  }
  let printState;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = { details: Array.from(document.querySelectorAll('details')).map(node => [node, node.open]), hidden: Array.from(document.querySelectorAll('.tab-panel,.source-block')).map(node => [node, node.hidden]) };
    printState.details.forEach(([node]) => { node.open = true; });
    printState.hidden.forEach(([node]) => { node.hidden = false; });
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    printState.details.forEach(([node, open]) => { node.open = open; });
    printState.hidden.forEach(([node, hidden]) => { node.hidden = hidden; });
    printState = undefined;
  });
  document.getElementById('print-button').addEventListener('click', () => window.print());
})();
