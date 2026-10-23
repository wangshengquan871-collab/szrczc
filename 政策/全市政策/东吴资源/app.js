/* 页面结构与交互。政策内容不在本文件中修改。直接打开 HTML 即可，无构建或联网依赖。 */
(() => {
  'use strict';
  const data = window.DONGWU_POLICY;
  const source = window.DONGWU_SOURCE;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    sprout: '<path d="M12 21v-9M12 15C4 15 3 9 3 5c7 0 9 4 9 10Zm0-4c0-6 3-8 9-8 0 6-3 8-9 8Z"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    team: '<circle cx="12" cy="6" r="3"/><path d="M7 19v-3a5 5 0 0 1 10 0v3M4 9a3 3 0 0 1 0 6m16-6a3 3 0 0 0 0 6M2 21v-3m20 3v-3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    building: '<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 8h1m6 0h1M8 12h1m6 0h1"/>',
    bank: '<path d="m3 8 9-5 9 5H3Zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
    book: '<path d="M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2m0-15c4-3 8-3 10-2v15c-4-1-7 0-10 2V6Z"/>',
    heart: '<path d="M12 21 3 12C-2 6 6 0 12 6c6-6 14 0 9 6l-9 9Z"/>',
    landscape: '<circle cx="17" cy="6" r="3"/><path d="m2 18 6-9 7 12m-4-6 4-5 7 11M2 21h20"/>',
    people: '<circle cx="8" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m3-7a4 4 0 0 1 5 4v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`;
  const heading = (number, eyebrow, title, text = '') => `<div class="section-heading"><div class="section-eyebrow"><span class="section-number">${number}</span><span>${eyebrow}</span></div><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}</div></div>`;
  const note = (title, text, kind = '') => `<div class="note ${kind}">${icon('info')}<div><strong>${title}</strong><p>${text}</p></div></div>`;
  const safeLink = (url, label, className = '') => /^(https?:\/\/|\.\.\/)/.test(url) ? `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span aria-hidden="true"> ↗</span></a>` : esc(label);
  const table = (headers, rows, caption = '') => `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(caption || headers.join('、'))}"><table>${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${headers.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const landscape = `<svg class="hero-art" viewBox="0 0 600 440" role="img" aria-labelledby="landscape-title"><title id="landscape-title">以太湖山水与吴中创新产业为灵感的几何插画</title><defs><linearGradient id="lake" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8fc3ac"/><stop offset="1" stop-color="#497c68"/></linearGradient><linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bfd2ae"/><stop offset="1" stop-color="#83a788"/></linearGradient></defs><circle cx="322" cy="214" r="167" fill="#e8eee2"/><circle cx="322" cy="214" r="188" fill="none" stroke="#c8d4c2" stroke-dasharray="3 7"/><circle cx="414" cy="109" r="32" fill="#d97955"/><path d="M79 285c56-7 84-107 129-103 43 4 53 90 99 88 35-2 48-86 89-80 34 4 42 85 107 95Z" fill="url(#hill)"/><path d="M130 303c46-42 75-81 118-73 50 9 47 39 107 39s73-45 107-31l55 65Z" fill="#5d8e74"/><path d="M66 308c119-24 230-14 338-8s134 21 112 44c-41 40-121 60-231 56-109-4-185-37-219-92Z" fill="url(#lake)"/><g fill="none" stroke="#e3eee4" stroke-width="1.3" opacity=".75"><path d="M100 328c74-13 148-10 220-2m-104 28c80-10 159-5 224-2m-235 20c50 10 118 13 178 4"/></g><g fill="#f6f6e9" stroke="#315d4c" stroke-width="1.4"><path d="M345 198h32v101h-32Zm40 28h38v76h-38Zm-84 17h36v53h-36Z"/><path d="m338 197 24-11 23 11Z" fill="#315d4c"/></g><g stroke="#93b5a1" stroke-width="2"><path d="M354 208v8m14-8v8m-14 7v8m14-8v8m-14 7v8m14-8v8m-14 7v8m14-8v8m26-25v8m17-8v8m-17 7v8m17-8v8m-103-10v8m16-8v8"/></g><g stroke="#315d4c" fill="#315d4c"><path d="M188 308v-25m-12 17 12-35 12 35Z"/><path d="M466 319v-23m-11 15 11-31 11 31Z"/></g><g fill="#163c35"><circle cx="137" cy="106" r="4"/><circle cx="508" cy="246" r="4"/></g><g fill="none" stroke="#507e66" stroke-width="1"><path d="M137 106h67m267 140h37M95 244h58"/><circle cx="112" cy="244" r="15"/></g><text x="82" y="79" font-size="11" letter-spacing="3" fill="#567366">TAIHU · WUZHONG</text><text x="397" y="413" font-size="10" letter-spacing="2" fill="#567366">INNOVATION GROWS HERE</text></svg>`;

  function projectDetails(project) {
    return `<div class="eligibility-title"><div><span class="eyebrow">申报条件</span><h3>${esc(project.name)}</h3></div><span class="tag">${esc(project.tag)}</span></div><dl class="requirements-grid">${project.requirements.map(([label, text]) => `<div class="requirement"><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl>${project.id === 'team' ? note('团队条件存在两处口径', 'Word 概览与申报流程对项目投入、引进时间表述不同。这里并列保留，申报前需对照对应批次正式通知。', 'note-warm') : ''}<p class="detail-footnote">${esc(project.housingReference)}</p>`;
  }

  const referenceLinks = source.blocks.slice(-9).flatMap(block => block.links);
  const sourceHTML = source.blocks.map((block, index) => {
    const links = block.links.length ? `<div class="source-inline-links">${block.links.map(link => safeLink(link.url, link.text || '文档链接')).join('')}</div>` : '';
    const text = block.type === 'table' ? table(block.rows[0], block.rows.slice(1), `原文表格 ${source.blocks.slice(0, index + 1).filter(b => b.type === 'table').length}`) : `<p>${esc(block.text)}</p>`;
    return `<div class="source-block" data-source-index="${index}">${text}${links}</div>`;
  }).join('');

  document.getElementById('page-content').innerHTML = `
    <section class="hero container" id="overview" aria-labelledby="hero-title">
      <div class="hero-content"><div class="hero-eyebrow"><span class="status-dot"></span> 苏州市吴中区 <span class="eyebrow-separator">/</span> 2026—2028 政策导览</div><h1 id="hero-title">东吴科技<br><span>领军人才计划</span><span class="title-dot">。</span></h1><p class="hero-description">${esc(data.intro)}</p><div class="hero-actions"><a class="button button-primary" href="#projects">了解项目支持 ${icon('arrow')}</a><a class="text-link" href="#source">查看完整原文 ${icon('document')}</a></div><div class="hero-meta"><span>${esc(data.documentNumber)}</span><span>施行期 ${esc(data.period)}</span></div></div>
      <div class="hero-visual">${landscape}<div class="visual-caption"><span class="caption-line"></span>山水吴中 · 创新有为</div></div>
    </section>
    <div class="overview-strip container"><div><span class="strip-number">03</span><span>核心项目类型</span></div><div><span class="strip-number">1000<small>万元</small></span><span>重大团队项目资助上限</span></div><div><span class="strip-number">5 : 3 : 2</span><span>项目资金三阶段拨付</span></div><div><span class="strip-number">常年受理</span><span>集中评审 · 属地推荐</span></div></div>
    <div class="reading-note container">${icon('info')}<p>阅读提示：本页根据提供的 Word 整理；涉及旧政、第三方数据或文档内部差异的内容已标明。<a href="#source">159 段正文与 11 张表格可完整查阅 →</a></p></div>

    <section class="policy-section container" id="projects" aria-labelledby="projects-title">
      ${heading('01', 'PROJECT SUPPORT', '<span id="projects-title">选择与你匹配的创新路径</span>', '先看项目资金，再核对申报条件。住房、金融等支持按各自规则另行申请。')}
      <div class="project-cards">${data.projects.map(p => `<article class="project-card project-${p.id}"><div class="project-card-top"><span class="project-icon">${icon(p.icon)}</span><span class="project-index">${p.number}</span></div><span class="eyebrow">${esc(p.tag)}</span><h3>${p.id === 'team' ? '重大创新' : esc(p.short)}<span>${p.id === 'team' ? '创业团队' : '人才'}</span></h3><p class="project-description">${esc(p.description)}</p><div class="project-amount"><strong>${p.funding[0]}<span>—</span>${p.funding[1]}</strong><span>万元 · 项目经费</span></div><p class="project-extra">${esc(p.extra)}</p><button class="project-select text-link" type="button" data-project="${p.id}">查看申报条件 ${icon('arrow')}</button></article>`).join('')}</div>
      <div class="funding-comparison"><div><h3>项目资助区间</h3><p>单位：万元 · 项目立项支持</p></div><div class="range-chart" role="img" aria-label="创业领军100至300万元，创新领军50至100万元，重大团队300至1000万元">${data.projects.map(p => `<div class="range-row"><span class="range-label">${esc(p.short)}</span><div class="range-track"><span class="range-bar range-${p.id}" style="--start:${p.funding[0] / 10}%;--length:${(p.funding[1] - p.funding[0]) / 10}%"></span></div><strong>${p.funding[0]}—${p.funding[1]}</strong></div>`).join('')}<div class="range-axis"><span>0</span><span>500</span><span>1000</span></div></div></div>
      <div class="eligibility"><div class="tab-list" role="tablist" aria-label="选择项目查看申报条件">${data.projects.map((p, i) => `<button class="tab-button ${i === 0 ? 'is-active' : ''}" type="button" role="tab" id="tab-${p.id}" aria-controls="panel-${p.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-tab="${p.id}">${esc(p.short)}</button>`).join('')}</div>${data.projects.map((p, i) => `<div class="tab-panel" role="tabpanel" id="panel-${p.id}" aria-labelledby="tab-${p.id}" tabindex="0" ${i ? 'hidden' : ''}>${projectDetails(p)}</div>`).join('')}</div>
    </section>

    <section class="funding-section" id="funding" aria-labelledby="funding-title"><div class="container policy-section">
      ${heading('02', 'FUNDING ROADMAP', '<span id="funding-title">把资助，落在每一步进展上</span>', '立项支持按 50%、30%、20% 分段拨付，后续拨付与检查、验收结果挂钩。')}
      <div class="funding-layout"><div class="funding-main"><div class="split-bar" role="img" aria-label="立项50%、中期检查通过30%、验收通过20%"><span class="split-first"><strong>50<small>%</small></strong>立项首拨</span><span class="split-second"><strong>30<small>%</small></strong>中期拨付</span><span class="split-third"><strong>20<small>%</small></strong>验收尾款</span></div><ol class="funding-timeline">${data.fundingStages.map(stage => `<li><span class="timeline-dot">${stage.number}</span><div><div class="timeline-heading"><h3>${esc(stage.name)}</h3><span>${stage.percent}%</span></div><strong class="timeline-time">${esc(stage.time)}</strong><p>${esc(stage.detail)}</p></div></li>`).join('')}</ol></div>
      <aside class="calculator" aria-labelledby="calculator-title"><span class="eyebrow">拨付金额演示</span><h3 id="calculator-title">你的资金节奏</h3><p>输入一个项目资助总额，查看三期金额。</p><label class="amount-label" for="grant-amount">示例资助总额 <span>万元</span></label><div class="amount-input-wrap"><input id="grant-amount" type="number" min="50" max="1000" step="1" value="300" inputmode="decimal"><span>万元</span></div><input id="grant-range" class="grant-range" type="range" min="50" max="1000" step="1" value="300" aria-label="调整示例资助总额，单位万元"><div class="amount-presets" aria-label="选择示例金额"><button type="button" data-amount="100">100 万</button><button class="is-active" type="button" data-amount="300">300 万</button><button type="button" data-amount="1000">1000 万</button></div><div class="calculation-results" aria-live="polite" aria-atomic="true" id="calculation-results"></div><p class="calculator-note">仅演示拨付比例，不代表立项档次或核定额度。检查、验收通过后方可拨付对应款项。</p><p class="input-error" id="amount-error" role="status" hidden></p></aside></div>
      ${note('拨付的关键条件', '项目合同期满 18 个月内未完成验收的，由属地主管部门书面申请终止。搬离吴中、注销、离岗、违规或材料不实等情形终止资格，并取消相应项目及生活待遇；勤勉尽责、未谋私利的不可预见技术失败，文档列有免责机制。')}
      <div class="support-tools">${data.supportTools.map(tool => `<article class="support-tool">${icon(tool.icon)}<h3>${esc(tool.title)}</h3><p class="tool-amount">${esc(tool.amount)}<small>${esc(tool.unit)}</small></p><p>${esc(tool.detail)}</p></article>`).join('')}</div>
      <p class="section-footnote">立项资金按区、镇财政体制分担；区级项目资金与人才安家资金分属不同资金池。首次独角兽入榜最高 200 万元、市级培育每年最高 200 万元（市区两级），按对应政策兑现。</p>
    </div></section>

    <section class="policy-section container" id="housing" aria-labelledby="housing-title">
      ${heading('03', 'LIVING IN WUZHONG', '<span id="housing-title">安居，是长久创新的底气</span>', '购房补贴、租房过渡与市级乐居支持，需分清适用对象、年度标准及不重复规则。')}
      <div class="housing-banner"><div><span class="eyebrow">文档引用的现行总体区间</span><h3>${esc(data.housing.title)}</h3><p>${esc(data.housing.text)}</p></div><div class="housing-amount"><strong>${esc(data.housing.range)}</strong><span>万元 · 购房补贴</span></div></div>
      <div class="housing-rules">${data.housing.rules.map(([title, text], i) => `<article><span class="rule-number">0${i + 1}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div>
      ${note('2026 年拨付比例，不能沿用旧表直接确定', '新政仅写“分年度拨付”，未明确比例及年限。Word 中“三年 4 : 3 : 3”和团队最高 250 万元属于旧政参考；2026 年具体分档及比例需看年度申领通知。文档关于通知未上线的记录截至 2026-10-08。', 'note-warm')}
      <div class="housing-secondary"><div><h3>房票与租房补贴如何衔接？</h3><p>文档列人才房票 50 万元，与购房补贴就高享受；房票金额加已享租补达到可享安家补贴，不再重复享受，低于的可申请差额并分年度发放。</p><p>申领须已购置自住房，提供不动产权证或购房合同与首付款发票，并以吴中单位为申报主体入选。租房不属于购房补贴申领情形。</p></div><div><h3>年度申领节奏 <span class="tag tag-warm">历年参考</span></h3><ol class="yearly-timeline">${data.housing.yearly.map(([time, label]) => `<li><strong>${esc(time)}</strong><span>${esc(label)}</span></li>`).join('')}</ol><p class="detail-footnote">上述时间是历年示例，不代表 2026 年已公布日程。分年发放期间需按年度通知重新申领，非自动到账。</p></div></div>
      <details class="policy-details"><summary>2022 年旧政策住房档次对照 <span class="tag tag-warm">历史参考</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="details-content">${table(['原立项档次', '旧购房（安家）补贴'], data.housing.historical, '2022 年第二批后入选者的旧口径，仅供参考')}<p class="detail-footnote">原购房补贴最高 250 万元，文档列的新政总体上限为 200 万元；不能混用。</p></div></details>
      <details class="policy-details"><summary>市级 A—F 人才乐居待遇 <span class="tag">按市级分类认定</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="details-content">${note('东吴身份不直接等同市级 A—F 分类', '下表按文档所引市级政策整理。须另行满足相应分类认定条件，市级与区级货币补贴按不重复规则核算，不应直接加总。')}${table(['市级分类', '购房补贴', '租房补贴', '公积金贷款'], data.housing.city, '文档引用的市级乐居待遇')}</div></details>
      <div class="stacking-grid"><article class="stacking-card"><div class="stacking-title">${icon('check')}<h3>可分别申请的支持</h3></div>${data.stacking.allowed.map(([title, text]) => `<div class="stacking-row"><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`).join('')}</article><article class="stacking-card stacking-limited"><div class="stacking-title">${icon('info')}<h3>就高享受与补差规则</h3></div>${data.stacking.exclusive.map(([title, text]) => `<div class="stacking-row"><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`).join('')}</article></div>
      <div class="life-heading"><h3>从事业到生活，一站式人才礼遇</h3><p>文档列东吴领军人才及项目团队 2 名以内核心成员为区级生活待遇适用对象；具体待遇按相应办法办理。</p></div><div class="life-grid">${data.life.map(item => `<article>${icon(item.icon)}<h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></article>`).join('')}</div>
    </section>

    <section class="process-section" id="process" aria-labelledby="process-title"><div class="policy-section container">
      ${heading('04', 'APPLICATION JOURNEY', '<span id="process-title">从一个好项目，到一次正式立项</span>', '常规申报分六个阶段。属地推荐是必经环节，材料完整性与项目真实性贯穿全程。')}
      <div class="application-banner"><div><span class="eyebrow">文档所列申报入口</span><h3>东吴科技领军人才计划项目申报管理系统</h3><p>2026 年第一批：4 月 2 日 10:00 — 5 月 6 日 10:00 <span class="tag tag-warm">该批次已结束</span></p><p class="detail-footnote">系统全年开放，集中批次有各自截止时间；创业大赛与属地举荐按常态化通道规则办理。</p></div>${safeLink(data.applicationUrl, '前往申报系统', 'button button-primary')}</div>
      <ol class="process-list">${data.process.map(step => `<li><span class="process-number">${step.number}</span><div><div class="process-step-title"><h3>${esc(step.title)}</h3><span class="tag">${esc(step.tag)}</span></div><p>${esc(step.text)}</p><details class="step-details"><summary>查看办理要点 <span aria-hidden="true">＋</span></summary><p>${esc(step.detail)}</p></details></div></li>`).join('')}</ol>
      <div class="pathway-grid"><article><span class="pathway-label">常规评审</span><h3>书面评审 → 面试答辩 → 实地考察</h3><p>技术与财务多维评价，结合产业贡献和实际落地情况。</p></article><article><span class="pathway-label">培育库</span><h3>潜力项目，先培育再推荐</h3><p>暂未达立项标准者持续跟踪、指导升级，后续批次优先推荐。</p></article><article><span class="pathway-label">绿色通道</span><h3>符合对应条件，可简化部分评审</h3><p>不同条件对应不同环节；实到账风投 ≥1000 万元，仅可直接进入面试答辩。</p></article></div>
    </div></section>

    <section class="policy-section container" id="insights" aria-labelledby="insights-title">
      ${heading('05', 'POLICY OBSERVATIONS', '<span id="insights-title">每一个数字，都有自己的口径</span>', '全区人才存量、年度项目数与批次清点分别展示，避免跨年份、跨范围误读。')}
      <div class="stat-cards">${data.snapshots.map(s => `<article><span class="tag">${esc(s.period)}</span><p class="stat-value">${esc(s.value)}<small>${esc(s.unit)}</small></p><h3>${esc(s.title)}</h3><p>${esc(s.note)}</p></article>`).join('')}</div>
      <div class="rate-panel"><div class="rate-intro"><span class="tag tag-warm">第三方统计 · 2025 年度第二批</span><h3>受理与拟立项项目对比</h3><div class="rate-total"><span><strong>77</strong>受理项目</span>${icon('arrow')}<span><strong>47</strong>拟立项项目</span></div><p>总体约 61% · 文档列示比例</p><p class="detail-footnote">来自新每创对公示名单的清点，未经本页独立核实；仅反映该批次，不用于预测个人申报结果。文档另提示第三方文章与公示日期存在混排。</p></div><div class="rate-chart">${data.rates.map(rate => `<div class="rate-row"><div class="rate-label"><span>${esc(rate.title)}</span><strong>${rate.rate}%</strong></div><div class="rate-track" role="img" aria-label="${esc(rate.title)}受理${rate.accepted}个，拟立项${rate.selected}个，文档比例${rate.rate}%"><span style="width:${rate.selected / rate.accepted * 100}%"></span></div><p>受理 ${rate.accepted} 个 / 拟立项 ${rate.selected} 个</p></div>`).join('')}</div></div>
      <div class="statistics-notes"><h3>引用前，先确认这些差异</h3><ul>${data.statisticsNotes.map(text => `<li>${esc(text)}</li>`).join('')}</ul><a class="text-link" href="#source">查看全部统计表与原始出处 ${icon('arrow')}</a></div>
    </section>

    <section class="source-section" id="source" aria-labelledby="source-title"><div class="policy-section container">
      ${heading('06', 'SOURCE & FULL TEXT', '<span id="source-title">让每一条政策，都可回到原文</span>', '保留 Word 全部非空正文、全部表格与原有超链接。搜索原文可快速定位条件、金额或年份。')}
      <div class="source-toolbar"><div class="source-file">${icon('document')}<div><strong>${esc(source.fileName)}</strong><span>159 段正文 · 11 张表格</span></div></div><a class="button button-outline" href="${esc(data.sourceFile)}" download>下载源 Word ${icon('arrow')}</a></div>
      <div class="reference-links">${referenceLinks.map(link => safeLink(link.url, link.text, 'reference-link')).join('')}</div>
      <p class="detail-footnote">上方链接为 Word 原有引用，包含第二批申报通知及年度安家补贴通知。本页按提供的文档整理，未对链接内容或政策变更进行独立核实。</p>
      <label class="source-search" for="source-search">${icon('search')}<input type="search" id="source-search" placeholder="搜索完整原文，例如：购房补贴、3000、绿色通道" autocomplete="off"><button id="clear-search" type="button" aria-label="清空原文搜索" hidden>×</button></label><p class="search-status" id="search-status" aria-live="polite">完整原文保留文档原有表述，包含历史参考、推算及待核实内容。</p>
      <details class="source-document" id="source-document"><summary><span>展开完整 Word 内容</span><span class="source-count">159 段正文 / 11 张表格</span><span class="details-plus" aria-hidden="true">＋</span></summary><div class="source-document-content" id="source-blocks">${sourceHTML}</div></details>
    </div></section>`;

  function selectProject(id, scroll = false, focusTab = false) {
    if (!data.projects.some(p => p.id === id)) return;
    document.querySelectorAll('[data-tab]').forEach(tab => {
      const selected = tab.dataset.tab === id;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${id}`; });
    if (scroll) document.querySelector('.eligibility').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => selectProject(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = data.projects.findIndex(p => p.id === tab.dataset.tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? data.projects.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + data.projects.length) % data.projects.length;
      selectProject(data.projects[next].id, false, true);
    });
  });
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => selectProject(button.dataset.project, true, true)));

  const amount = document.getElementById('grant-amount');
  const range = document.getElementById('grant-range');
  const error = document.getElementById('amount-error');
  function updateAmount(value, origin) {
    const numeric = Number(value);
    const valid = value !== '' && Number.isFinite(numeric) && numeric >= 50 && numeric <= 1000;
    amount.setAttribute('aria-invalid', String(!valid));
    error.hidden = valid;
    error.textContent = valid ? '' : '请输入 50—1000 万元之间的示例金额。';
    document.getElementById('calculation-results').hidden = !valid;
    if (!valid) return;
    if (origin !== amount) amount.value = numeric;
    range.value = numeric;
    document.querySelectorAll('[data-amount]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.amount) === numeric));
    document.getElementById('calculation-results').innerHTML = data.fundingStages.map(stage => `<div><span>${esc(stage.name)} <small>${stage.percent}%</small></span><strong>${Number((numeric * stage.percent / 100).toFixed(2)).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}<small>万元</small></strong></div>`).join('');
  }
  amount.addEventListener('input', () => updateAmount(amount.value, amount));
  range.addEventListener('input', () => updateAmount(range.value, range));
  document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => updateAmount(button.dataset.amount, button)));
  updateAmount(300);

  const search = document.getElementById('source-search');
  const clear = document.getElementById('clear-search');
  const original = document.getElementById('source-document');
  const blocks = Array.from(document.querySelectorAll('.source-block'));
  const searchTexts = source.blocks.map(block => (block.type === 'table' ? block.rows.flat().join(' ') : block.text).normalize('NFKC').toLocaleLowerCase('zh-CN'));
  function filterSource() {
    const query = search.value.trim().normalize('NFKC').toLocaleLowerCase('zh-CN');
    let count = 0;
    blocks.forEach((block, i) => {
      const matched = !query || searchTexts[i].includes(query);
      block.hidden = !matched;
      if (matched) count++;
    });
    clear.hidden = !query;
    if (query) original.open = true;
    document.getElementById('search-status').textContent = query ? `找到 ${count} 个匹配段落或表格${count ? '，见下方原文。' : '，请尝试其他关键词。'}` : '完整原文保留文档原有表述，包含历史参考、推算及待核实内容。';
  }
  search.addEventListener('input', filterSource);
  clear.addEventListener('click', () => { search.value = ''; filterSource(); search.focus(); });
  original.addEventListener('toggle', () => { original.querySelector('summary > span').textContent = original.open ? '收起完整 Word 内容' : '展开完整 Word 内容'; });

  const top = document.getElementById('back-top');
  window.addEventListener('scroll', () => { top.hidden = window.scrollY < 900; }, { passive: true });
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  if ('IntersectionObserver' in window) {
    const navLinks = Array.from(document.querySelectorAll('.desktop-nav a'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) navLinks.forEach(link => {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
  }
  let printState;
  window.addEventListener('beforeprint', () => {
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
