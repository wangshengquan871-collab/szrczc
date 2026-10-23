/* 负责结构与交互；政策内容在 policy-data.js，原始文档在 source-data.js，视觉样式在 styles.css。 */
(() => {
  'use strict';
  const data = window.KUNSHAN_POLICY;
  const sources = window.KUNSHAN_SOURCE;
  const page = document.getElementById('page-content');
  if (!data || !sources) {
    page.textContent = '政策数据未能加载，请确认“昆山资源”文件夹与 HTML 位于同一目录。';
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

  function renderHero() {
    const art = `<svg class="hero-art" viewBox="0 0 620 455" role="img" aria-labelledby="art-title"><title id="art-title">人才、资金与市场共同支持核心技术产业化的概念图</title><defs><linearGradient id="art-back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4ebee"/><stop offset="1" stop-color="#f1eee5"/></linearGradient><linearGradient id="art-chip" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#315875"/><stop offset="1" stop-color="#21374a"/></linearGradient><pattern id="art-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#b9cbd2" stroke-width=".5"/></pattern></defs><rect x="38" y="35" width="540" height="370" rx="180" fill="url(#art-back)"/><rect x="54" y="55" width="512" height="327" rx="154" fill="url(#art-grid)"/><circle cx="316" cy="218" r="145" fill="none" stroke="#a8bec8" stroke-dasharray="3 8"/><circle cx="316" cy="218" r="113" fill="none" stroke="#c0ced0"/><path d="M176 145h63v42m195-28h-50v28M271 267v78H158m199-78v67h106" fill="none" stroke="#73919f" stroke-width="1.4"/><g transform="translate(242 145)"><rect x="5" y="8" width="151" height="151" rx="24" fill="#a4b5bc" opacity=".25"/><rect width="151" height="151" rx="24" fill="url(#art-chip)"/><rect x="18" y="18" width="115" height="115" rx="15" fill="none" stroke="#839fad"/><g stroke="#abc0c7" stroke-width="2"><path d="M39-10V0m25-10V0m25-10V0m25-10V0M39 151v10m25-10v10m25-10v10m25-10v10M-10 39H0m-10 25H0m-10 25H0m-10 25H0M151 39h10m-10 25h10m-10 25h10m-10 25h10"/></g><text x="75" y="70" text-anchor="middle" fill="#fff" font-size="20" font-family="Microsoft YaHei,sans-serif">核心技术</text><text x="75" y="95" text-anchor="middle" fill="#b7cbd4" font-size="11" letter-spacing="2">TECHNOLOGY</text></g><g font-family="Microsoft YaHei,sans-serif"><rect x="85" y="113" width="112" height="62" rx="11" fill="#fff" stroke="#b6c7ca"/><text x="141" y="140" text-anchor="middle" fill="#244259" font-size="16">人才与团队</text><text x="141" y="158" text-anchor="middle" fill="#718493" font-size="9" letter-spacing="1">TALENT</text><rect x="421" y="127" width="111" height="62" rx="11" fill="#fff" stroke="#b6c7ca"/><text x="477" y="153" text-anchor="middle" fill="#244259" font-size="16">资金与资源</text><text x="477" y="172" text-anchor="middle" fill="#718493" font-size="9" letter-spacing="1">SUPPORT</text><rect x="95" y="323" width="133" height="58" rx="11" fill="#fff" stroke="#b6c7ca"/><text x="161" y="348" text-anchor="middle" fill="#244259" font-size="15">产品与市场</text><text x="161" y="367" text-anchor="middle" fill="#718493" font-size="9" letter-spacing="1">COMMERCIALIZATION</text><rect x="422" y="312" width="110" height="60" rx="11" fill="#d09362"/><text x="477" y="338" text-anchor="middle" fill="#fff" font-size="16">在昆山生长</text><text x="477" y="357" text-anchor="middle" fill="#fff" font-size="9" letter-spacing="1">KUNSHAN</text></g><circle cx="464" cy="65" r="17" fill="#d09362"/><circle cx="176" cy="145" r="3" fill="#436b80"/><circle cx="434" cy="159" r="3" fill="#436b80"/><text x="64" y="424" font-size="10" fill="#637d8b" letter-spacing="3">FROM INNOVATION TO INDUSTRY</text></svg>`;
    return `<section class="hero container" id="overview" aria-labelledby="hero-title"><div class="hero-content"><div class="hero-eyebrow"><span class="status-dot"></span> KUNSHAN <span>/</span> 2026 年政策导览</div><h1 id="hero-title">昆山双创<br>人才计划<span class="title-dot">。</span></h1><div class="hero-subtitle">创业领军人才专题</div><p class="hero-description">${esc(data.intro)}</p><div class="hero-actions"><a class="button button-primary" href="#startup">重点了解创业领军 ${icon('arrow')}</a><a class="text-link" href="#programs">浏览双创全景 ${icon('layers')}</a></div><div class="hero-meta"><span>${esc(data.basis)}</span><span>${esc(data.validity)}</span></div></div><div class="hero-visual">${art}<div class="visual-caption">技术向前 · 创业向昆山</div></div></section>
      <div class="overview-strip container"><div><strong>400<small>万元</small></strong><span>创业领军市本级资助最高</span></div><div><strong>100<small>万元</small></strong><span>普通路径人才实缴现金最低</span></div><div><strong>60<small>万元</small></strong><span>其他市级双创人才购房补贴最高</span></div><div><strong>四条路径</strong><span>普通 · 本土 · 省外 · 未落户</span></div></div><div class="reading-note container">${icon('info')}<p>金额上限与实际资助分开理解，项目经费、贷款和投资分别展示。两份 Word 的差异及统计出处缺口已标明；<a href="#source">可查阅全部原文 →</a></p></div>`;
  }

  function renderStartup() {
    return `<section class="policy-section container" id="startup" aria-labelledby="startup-title">${heading('01', 'FOCUS · ENTREPRENEURSHIP', '创业领军：带技术来，带事业向前', '以人才与其创办的科技企业为核心。先核对共同基础，再找到适用路径。')}<div class="startup-intro"><div><span class="eyebrow" id="startup-title">重点专题</span><h3>既通科技，也懂市场。<br>让自主技术成为企业的成长力。</h3><p>${esc(data.startupIntro)}</p></div><aside class="startup-side"><span>市本级创业领军项目经费</span><strong>100—400<small>万元</small></strong><p>100 / 200 / 300 / 400 四档<br>孵育类另为 60 万元</p><span class="tag">由项目评审等级确定</span></aside></div>
      <div class="focus-metrics"><div><strong>本科及以上</strong><span>全日制学历学位</span></div><div><strong>3 年以上</strong><span>相关研发、管理或创业经历</span></div><div><strong>一般 ≥20%</strong><span>持股，或自然人第一大股东</span></div><div><strong>≥2 人</strong><span>企业缴纳社保人员</span></div></div>${requirements(data.startupRequirements)}
      ${note('实缴与认缴，不能混为一谈', '普通路径要求人才实缴现金不少于 100 万元；通过持股公司的，还要核对该公司在申报企业的现金出资不少于 200 万元。省外专项另有更高出资要求。')}
      <div class="routes-heading"><h3>四条路径，按自身情况逐项核对</h3><p>本土成长、省外引进和未落户各有附加条件，避免把普通路径当作所有专项的统一门槛。</p></div><div class="eligibility"><div class="tab-list" role="tablist" aria-label="创业领军申报路径">${data.routes.map((route, i) => `<button type="button" role="tab" class="tab-button${i === 0 ? ' is-active' : ''}" id="tab-${route.id}" aria-controls="panel-${route.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-tab="${route.id}">${esc(route.title)}</button>`).join('')}</div>${data.routes.map((route, i) => `<div class="tab-panel" role="tabpanel" id="panel-${route.id}" aria-labelledby="tab-${route.id}" tabindex="0" ${i ? 'hidden' : ''}><div class="panel-heading"><div><span class="eyebrow">${esc(route.tag)}</span><h3>${esc(route.title)}</h3></div><span class="panel-index">0${i + 1}</span></div><p class="panel-intro">${esc(route.intro)}</p>${requirements(route.details)}${note('路径要点', route.note, route.id !== 'ordinary')}${route.id === 'unsettled' ? '<div class="unsettled-visual"><span><strong>先评定</strong>取得认定资格</span><b aria-hidden="true">→</b><span><strong>1 年内</strong>完成注册、验资</span><b aria-hidden="true">→</b><span><strong>现场考察</strong>符合条件后兑现</span><small>认定资格有效期 2 年</small></div>' : ''}</div>`).join('')}</div>
    </section>`;
  }

  function renderFunding() {
    return `<section class="section-band" id="funding" aria-labelledby="funding-title"><div class="policy-section container">${heading('02', 'FUNDING & MILESTONES', '读懂资助档位，也读懂兑现节奏', '市本级创业领军资助是明确的分档金额；拨付类别由正式认定与项目合同确定。')}<div class="funding-layout"><div><div class="sub-heading"><h3 id="funding-title">创业领军资助档位</h3><span>万元 · 市本级项目经费</span></div><div class="tier-chart" role="img" aria-label="创业领军资助档位100、200、300、400万元，孵育类另为60万元">${data.startupTiers.map((amount, i) => `<div class="tier-column${i === 0 ? ' tier-incubation' : ''}"><strong>${amount}</strong><div class="tier-bar" style="--tier-height:${amount / 400 * 170}px"></div><span>${i === 0 ? '孵育类' : '领军档位'}</span></div>`).join('')}</div><p class="detail-footnote">仅展示文档中的离散档位，实际金额由评审认定确定；最高 400 万元并非每位入选者均可获得。</p><ol class="funding-timeline">${data.fundingLifecycle.map(([title, text], i) => `<li><span class="timeline-dot">0${i + 1}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></li>`).join('')}</ol></div>
      <aside class="calculator" aria-labelledby="payment-calculator-title"><span class="eyebrow">项目资金 · 金额演示</span><h3 id="payment-calculator-title">立项一笔，验收一笔</h3><label class="field-label" for="grant-amount">示例资助档位</label><select id="grant-amount">${data.startupTiers.map(amount => `<option value="${amount}" ${amount === 400 ? 'selected' : ''}>${amount} 万元${amount === 60 ? '（孵育类）' : ''}</option>`).join('')}</select><fieldset class="mode-fieldset"><legend>示例拨付类别</legend><div class="mode-options">${data.paymentModes.map((mode, i) => `<label><input type="radio" name="payment-mode" value="${mode.id}" ${i === 0 ? 'checked' : ''}><span>${esc(mode.label)}<small>${mode.first}% / ${mode.last}%</small></span></label>`).join('')}</div></fieldset><div class="payment-split" id="payment-split" role="img"></div><div class="calculation-results" id="payment-results" aria-live="polite" aria-atomic="true"></div><p class="calculator-note">档位与拨付类别在此独立选择，仅演示比例；并非把某一资助档位自动认定为重大领军。实际按合同执行。</p></aside></div>
      ${note('项目资金管理与终止情形', '市、区（镇）财政按 1:1 共同承担，这与人才收到的分期比例是不同口径。人才离职离岗、企业股权重大变更、搬离或注销等将终止项目并停止余款拨付；考核验收结束前，创业申报人实际出资金额不得减少。')}
      <div class="tools-heading"><h3>围绕创业成长，还有这些支持工具</h3><p>各自有申请条件、审核程序及资金性质，分别了解、分别申请。</p></div><div class="support-tools">${data.tools.map(tool => `<article class="support-tool">${icon(tool.icon)}<span class="tag">${esc(tool.tag)}</span><h4>${esc(tool.title)}</h4><p class="tool-amount">${esc(tool.amount)}<small>${esc(tool.unit)}</small></p><p>${esc(tool.text)}</p></article>`).join('')}</div>
    </div></section>`;
  }
  function renderPrograms() {
    return `<section class="policy-section container" id="programs" aria-labelledby="programs-title">${heading('03', 'THE FULL PROGRAM', '创业领军之外，双创支持还有全景', '将创业、创新、团队与成长项目放在同一张表中，清楚比较类别、档位和适用方向。')}<h3 class="sr-only" id="programs-title">双创项目类别与资助对照</h3>${table(['项目类别', '市本级资助档位', '阅读要点'], data.fundingRows, '两份文档所列昆山市本级双创项目资助')}<p class="detail-footnote">不同类别不能只按最高额度选择；须满足对应的团队、经历、任职、企业或投入要求。</p><div class="industry-grid">${data.industries.map(industry => `<article>${icon(industry.icon)}<div><span class="eyebrow">重点产业专项 · 优先支持</span><h3>${esc(industry.title)}</h3><p>${esc(industry.text)}</p></div></article>`).join('')}</div><div class="program-details">${data.otherPrograms.map(program => `<details class="policy-details"><summary><span>${esc(program.title)}</span><span class="tag">${esc(program.tag)}</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="details-content">${requirements(program.rows)}</div></details>`).join('')}</div></section>`;
  }

  function renderHousing() {
    return `<section class="policy-section container" id="housing" aria-labelledby="housing-title">${heading('04', 'LIFE & HOUSING', '安心创业，也安心在昆生活', '市本级住房标准与上级累计上限分别看，购房补贴和房票按不重复规则选择。')}<div class="housing-banner"><div><span class="eyebrow" id="housing-title">普通市级创业领军适用的住房档</span><h3>购房款的 50%，<br>其他市级双创人才最高 60 万元。</h3><p>市级双创团队领军人才最高 100 万元；各级双创人才累计最高 200 万元，按对应层级和就高不重复规则核定。</p></div><div class="housing-amount"><strong>60<small>万元</small></strong><span>其他市级双创人才最高</span><span class="housing-cap">上级累计上限：200 万元</span></div></div><div class="housing-rules">${data.housing.rules.map(([title, text], i) => `<article><span class="rule-number">0${i + 1}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div>
      <div class="housing-calculator"><div><span class="eyebrow">金额上限演示</span><h3>购房补贴与房票，分别怎么算？</h3><p>购房补贴按房款 50% 与类别上限取较低值。房票按对应补贴标准的 60% 核定，且不超过购房款的 30%。</p><p class="detail-footnote">本演示只使用文档列出的昆山市本级 60 万 / 100 万标准；未代替资格审核，也不推定上级人才的具体额度。两项不能相加领取。</p></div><div class="housing-calc-controls"><div class="housing-fields"><div><label class="field-label" for="housing-category">人才类别</label><select id="housing-category">${data.housing.categories.map(category => `<option value="${category.id}">${esc(category.title)}</option>`).join('')}</select></div><div><label class="field-label" for="house-price">示例购房款 <span>万元</span></label><div class="price-input"><input id="house-price" type="number" min="0.01" step="0.01" value="200" inputmode="decimal"><span>万元</span></div></div></div><div class="housing-results" id="housing-results" aria-live="polite" aria-atomic="true"></div><p class="input-error" id="housing-error" role="status" hidden></p></div></div>
      ${note('住房补贴的兑现节奏单独核对', data.housing.note, true)}<div class="life-heading"><h3>从项目落地，到人才生活</h3><p>配套服务按人才认定层级、具体适用条件和服务规则办理。</p></div><div class="life-grid">${data.services.map(service => `<article>${icon(service.icon)}<h4>${esc(service.title)}</h4><p>${esc(service.text)}</p></article>`).join('')}</div><p class="detail-footnote">文档另列容错免责：已勤勉尽责、未谋私利，因技术路线失误等不可预见原因未完成目标者不作负面评价；具体按相应管理规则执行。</p></section>`;
  }

  function renderProcess() {
    return `<section class="section-band" id="process" aria-labelledby="process-title"><div class="policy-section container">${heading('05', 'APPLICATION JOURNEY', '把技术、企业和真实投入说明白', '创业领军以人才、创办企业和创业项目为申报核心；先对照材料，再按对应批次提交。')}<div class="application-banner"><div><span class="eyebrow" id="process-title">创业专题所列申报入口</span><h3>昆如意企业服务总入口</h3><p>${esc(data.application.period)} <span class="tag tag-warm">该集中受理期已结束</span></p><p class="detail-footnote">未落户项目常年受理、定期评审。后续集中批次安排以新通知为准。</p></div>${link(data.application.primary, '前往昆如意', 'button button-primary')}</div><div class="application-links">${link(data.application.notice, '2026 年度申报通知（文档引用）')}${link(data.application.legacy, '《昆山双创》原文所列入口')}</div><ol class="process-list">${data.application.steps.map(([title, text], i) => `<li><span class="process-number">0${i + 1}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></li>`).join('')}</ol><div class="materials-panel"><div><h3>创业领军材料准备重点</h3><p>除承诺书、申报书外，完整清单按当批通知附件核对。</p></div><ul class="materials-list">${data.application.materials.map(text => `<li>${icon('check')}<span>${esc(text)}</span></li>`).join('')}</ul></div>${note('创业项目绿色通道', data.application.fastTrack)}${note('申报次数与资金约束', data.application.restrictions, true)}</div></section>`;
  }

  function renderStatistics() {
    return `<section class="policy-section container" id="insights" aria-labelledby="insights-title">${heading('06', 'DATA WITH CONTEXT', '数字有范围，引用有出处', '以下只展示文档记载，不把不同层级或单位的数据混为连续增长趋势。')}<div class="statistics-label" id="insights-title"><span class="tag tag-warm">文档记载 · 出处需核实</span><span>年度统计辅助阅读</span></div><div class="stat-cards">${data.statistics.map(stat => `<article><span class="stat-year">${esc(stat.year)} 年</span><p class="stat-value">${esc(stat.value)}<small>${esc(stat.unit)}</small></p><h3>${esc(stat.title)}</h3><p>${esc(stat.note)}</p></article>`).join('')}</div><div class="statistics-notes"><h3>这些统计如何理解？</h3><ul>${data.statisticsNotes.map(text => `<li>${esc(text)}</li>`).join('')}</ul><a class="text-link" href="#source">查阅统计段完整原文 ${icon('arrow')}</a></div></section>`;
  }

  const sourceParagraphs = sources.reduce((count, source) => count + source.blocks.filter(block => block.type === 'paragraph').length, 0);
  const sourceRows = [];
  function sourceLinks(block) {
    const links = [...block.links];
    if (block.type === 'paragraph') {
      for (const url of block.text.match(/https?:\/\/[^\s<>]+/g) || []) {
        const clean = url.replace(/[。；，、）]+$/g, '');
        if (!links.some(item => item.url === clean)) links.push({ text: '原文所列网址', url: clean });
      }
    }
    return links;
  }
  function renderSource() {
    return `<section class="source-section" id="source" aria-labelledby="source-title"><div class="policy-section container">${heading('07', 'DOCUMENTS & REFERENCES', '保留两份原文，让政策可追溯', '导览之外，完整保留两份 Word 的全部非空正文及原有超链接，便于逐条核对。')}<div class="source-heading" id="source-title"><strong>2 份文档 · ${sourceParagraphs} 段原文</strong><span>内容数据、样式与交互分别保存</span></div><div class="source-downloads">${sources.map(source => `<a class="source-download" href="${esc('../' + source.fileName)}" download>${icon('document')}<span><strong>${esc(source.fileName)}</strong><small>${source.blocks.filter(block => block.type === 'paragraph').length} 段正文 · 下载源文档</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div><div class="reference-links">${link(data.application.notice, '2026 年度申报通知', 'reference-link')}${link(data.application.news, '2026 年双创新政介绍', 'reference-link')}</div><p class="detail-footnote">链接来自所提供文档，本页未独立核实最新变更。《昆山双创》原引用中含 2024 年、2021 年历史细则及第三方解读，应分别核对年份、层级和发布机构。</p><div class="source-search-controls"><label class="source-search" for="source-search">${icon('search')}<input id="source-search" type="search" placeholder="搜索两份原文，如：省外、现金出资、房票" autocomplete="off"><button id="clear-search" type="button" aria-label="清空搜索" hidden>×</button></label><label class="source-filter-label"><span class="sr-only">选择原文范围</span><select id="source-filter"><option value="all">全部文档</option><option value="0">昆山双创</option><option value="1">创业领军专题</option></select></label></div><p class="search-status" id="search-status" aria-live="polite">完整原文共 ${sourceParagraphs} 段，包含文档原有历史表述和未核实统计。</p><div id="source-documents">${sources.map((source, documentIndex) => `<details class="source-document" data-source-document="${documentIndex}"><summary><span>${esc(source.fileName.replace(/\.docx$/, ''))}</span><span class="source-count">${source.blocks.length} 个原文段落</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="source-document-content">${source.blocks.map((block, blockIndex) => {
      const content = block.type === 'table' ? table(block.rows[0], block.rows.slice(1), '原文表格') : `<p>${esc(block.text)}</p>`;
      const links = sourceLinks(block);
      sourceRows.push({ documentIndex, blockIndex, searchText: (block.type === 'table' ? block.rows.flat().join(' ') : block.text).normalize('NFKC').toLocaleLowerCase('zh-CN') });
      return `<div class="source-block" data-source-row="${sourceRows.length - 1}">${content}${links.length ? `<div class="source-inline-links">${links.map(item => link(item.url, item.text)).join('')}</div>` : ''}</div>`;
    }).join('')}</div></details>`).join('')}</div></div></section>`;
  }

  page.innerHTML = [renderHero(), renderStartup(), renderFunding(), renderPrograms(), renderHousing(), renderProcess(), renderStatistics(), renderSource()].join('');

  function selectRoute(id, focus = false) {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      const active = tab.dataset.tab === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${id}`; });
  }
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => selectRoute(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = data.routes.findIndex(route => route.id === tab.dataset.tab);
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? data.routes.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + data.routes.length) % data.routes.length;
      selectRoute(data.routes[target].id, true);
    });
  });

  const money = value => Number(value.toFixed(2)).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  function updatePayment() {
    const amount = Number(document.getElementById('grant-amount').value);
    const mode = data.paymentModes.find(item => item.id === document.querySelector('[name="payment-mode"]:checked').value);
    const split = document.getElementById('payment-split');
    split.innerHTML = `<span style="flex-basis:${mode.first}%"><strong>${mode.first}<small>%</small></strong>立项认定后</span><span style="flex-basis:${mode.last}%"><strong>${mode.last}<small>%</small></strong>验收通过后</span>`;
    split.setAttribute('aria-label', `${mode.label}立项拨付${mode.first}%，验收通过后拨付${mode.last}%`);
    document.getElementById('payment-results').innerHTML = `<div><span>立项首期</span><strong>${money(amount * mode.first / 100)}<small>万元</small></strong></div><div><span>验收余款</span><strong>${money(amount * mode.last / 100)}<small>万元</small></strong></div>`;
  }
  document.getElementById('grant-amount').addEventListener('change', updatePayment);
  document.querySelectorAll('[name="payment-mode"]').forEach(input => input.addEventListener('change', updatePayment));
  updatePayment();

  function updateHousing() {
    const input = document.getElementById('house-price');
    const price = Number(input.value);
    const valid = input.value.trim() !== '' && Number.isFinite(price) && price > 0;
    const error = document.getElementById('housing-error');
    const output = document.getElementById('housing-results');
    error.hidden = valid;
    error.textContent = valid ? '' : '请输入大于 0 的购房款，单位为万元。';
    input.setAttribute('aria-invalid', String(!valid));
    output.hidden = !valid;
    if (!valid) return;
    const category = data.housing.categories.find(item => item.id === document.getElementById('housing-category').value);
    const grant = Math.min(price * data.housing.rate / 100, category.cap);
    const ticket = Math.min(category.cap * data.housing.ticketRate / 100, price * data.housing.ticketPriceRate / 100);
    output.innerHTML = `<div><span>购房补贴示例上限</span><strong>${money(grant)}<small>万元</small></strong><small>min（房款 × 50%，${category.cap} 万）</small></div><div><span>房票示例上限</span><strong>${money(ticket)}<small>万元</small></strong><small>min（${category.cap} 万 × 60%，房款 × 30%）</small></div><p>按就高不重复规则选择，金额以审核认定为准。</p>`;
  }
  document.getElementById('house-price').addEventListener('input', updateHousing);
  document.getElementById('housing-category').addEventListener('change', updateHousing);
  updateHousing();

  const search = document.getElementById('source-search');
  const filter = document.getElementById('source-filter');
  const clear = document.getElementById('clear-search');
  const sourceBlocks = Array.from(document.querySelectorAll('.source-block'));
  const sourceDetails = Array.from(document.querySelectorAll('[data-source-document]'));
  function filterSource() {
    const query = search.value.trim().normalize('NFKC').toLocaleLowerCase('zh-CN');
    const counts = sources.map(() => 0);
    sourceBlocks.forEach((block, index) => {
      const row = sourceRows[index];
      const scopeMatches = filter.value === 'all' || Number(filter.value) === row.documentIndex;
      const visible = scopeMatches && (!query || row.searchText.includes(query));
      block.hidden = !visible;
      if (visible) counts[row.documentIndex]++;
    });
    sourceDetails.forEach((detail, index) => {
      detail.hidden = filter.value !== 'all' && Number(filter.value) !== index;
      if (query && counts[index] > 0) detail.open = true;
      detail.querySelector('.source-count').textContent = query ? `${counts[index]} 个匹配段落` : `${sources[index].blocks.length} 个原文段落`;
    });
    clear.hidden = !query;
    const count = counts.reduce((sum, value) => sum + value, 0);
    document.getElementById('search-status').textContent = query ? `找到 ${count} 个匹配段落${count ? '，可在下方展开查看。' : '，请尝试其他关键词。'}` : `当前范围共 ${count} 段原文；包含文档原有历史表述和未核实统计。`;
  }
  search.addEventListener('input', filterSource);
  filter.addEventListener('change', filterSource);
  clear.addEventListener('click', () => { search.value = ''; filterSource(); search.focus(); });

  const backTop = document.getElementById('back-top');
  window.addEventListener('scroll', () => { backTop.hidden = window.scrollY < 800; }, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  if ('IntersectionObserver' in window) {
    const links = Array.from(document.querySelectorAll('.desktop-nav a'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        links.forEach(item => {
          const active = item.hash === `#${entry.target.id}`;
          item.classList.toggle('is-active', active);
          if (active) item.setAttribute('aria-current', 'location'); else item.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
  }
  let printState;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = { details: Array.from(document.querySelectorAll('details')).map(node => [node, node.open]), hidden: Array.from(document.querySelectorAll('.tab-panel,.source-block,.source-document')).map(node => [node, node.hidden]) };
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
