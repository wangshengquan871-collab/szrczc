/* 页面结构与交互。内容快照在 policy-data.js / workbook-data.js，视觉在 styles.css。 */
(() => {
 'use strict';
 const data=window.SUZHOU_COMPARE,book=window.SUZHOU_WORKBOOK,model=window.SUZHOU_MODEL,page=document.getElementById('page-content');
 if(!data||!book||!model){page.textContent='数据未能加载，请将“政策对比资源”文件夹与HTML一起保留。';return;}
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=s=>({html:s}),money=v=>typeof v==='number'?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'未明确';
 const heading=(n,en,title,description)=>`<div class="section-heading"><span class="eyebrow"><b>${n}</b>${esc(en)}</span><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>`;
 const note=(title,text)=>`<aside class="note"><span aria-hidden="true">i</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></aside>`;
 const badge=(text,kind='neutral')=>`<span class="badge ${kind}">${esc(text)}</span>`;
 const link=(url,text,cls='')=>/^https?:\/\/\S+$/.test(url)?`<a href="${esc(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:esc(text);
 const sourceRef=(sheet,address,label)=>`<button class="source-ref" type="button" data-source-sheet="${esc(sheet)}" data-source-cell="${esc(address)}">${esc(label||sheet+'!'+address)} ↗</button>`;
 function table(headers,rows,caption,cls=''){
  return `<div class="table-scroll ${cls}" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<${i?'td':'th scope="row"'}>${v&&typeof v==='object'&&'html'in v?v.html:esc(v)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 }
 const amountLabel=r=>r?esc(r.tiers)+(r.max===null?'':`<small>万元 · ${esc(r.nature)}</small>`):'未列同口径金额';
 function hero(){
  const max=Math.max(...model.ranked('startup').map(r=>r.max));
  return `<section class="hero container" id="top"><div><span class="eyebrow"><span class="dot"></span> SUZHOU / TALENT POLICY</span><h1>苏州人才政策<br><span>八地，一眼看懂。</span></h1><p>从资助档次到实缴、住房与兑现条件，<br class="desktop-break">把选择所需的信息，放在同一张桌上。</p><div class="hero-meta"><span>Excel整理日期 <strong>${esc(data.asOf)}</strong></span><span>8地 · 8个工作表 · 区级姑苏单列</span></div></div><div class="hero-art"><img src="政策对比资源/suzhou-window.svg" alt="苏式园林圆窗、桥岸与城市线稿" width="560" height="300"><small>园林与城市概念插画 · 非行政区划图</small></div></section><div class="insights container"><article><span>表内常规创业最高档</span><strong>${money(max)}<small>万元</small></strong><p>昆山；具体档次仍须评审核定</p></article><article><span>八地普通创业个人基础现金门槛</span><strong>${money(data.regions[0].cash)}<small>万元</small></strong><p>高档、持股平台及企业资本另有条件</p></article><article class="insight-text"><span>兑现条件先于现金预算</span><strong>多地比例待核</strong><p>立项金额与第一年可用现金分别确认</p></article></div>`;
 }
 function overviewHousing(r){
  const a=model.regionRecord(r.id,'住房');
  if(r.id==='wuzhong')return `<strong>创业分档待核</strong><small>全类别新范围50—200万元</small>`;
  return `<strong>${esc(a.tiers)}<em>万元</em></strong><small>${r.id==='changshu'?'2025房票说明 · 2026档次待核':esc(a.nature)}</small>`;
 }
 function selectionButton(r,compact=false){return `<button type="button" class="${compact?'select-small':'region-choice'}" data-select-region="${r.id}" aria-pressed="false" aria-label="选择${esc(r.name)}加入详比"><span aria-hidden="true">＋</span>${compact?'详比':esc(r.short)}</button>`;}
 function overview(){
  return `<section class="section container" id="overview">${heading('01','EIGHT REGIONS','八地速览，先看创业核心差异','单位：万元。最高档须满足条件；住房的年份、方式和适用边界保留在各行。')}<div class="overview-scroll"><table class="overview-table"><caption class="sr-only">苏州八地普通创业资助、个人基础实缴、创业住房和项目兑现对比</caption><thead><tr><th scope="col">地区与计划</th><th scope="col">常规创业档次</th><th scope="col">个人基础现金</th><th scope="col">创业住房参考</th><th scope="col">项目兑现信息</th><th scope="col">加入详比</th></tr></thead><tbody>${data.regions.map(r=>`<tr><th scope="row"><strong>${esc(r.short)}</strong><small>${r.id==='gusu'?'区级计划 · 非市级姑苏':r.id==='sip'?'工业园区 · 金鸡湖':r.id==='wuzhong'?'东吴领军':r.id==='changshu'?'昆承英才':'科技创新创业'}</small><a class="detail-link" href="${esc(r.file)}">政策详情 ↗</a></th><td data-label="常规创业"><strong class="money-tiers">${esc(r.overview.startup)}</strong>${r.id==='changshu'?badge('资金条款缺失','pending'):''}</td><td data-label="个人基础现金"><strong>${money(r.cash)}</strong><small>个人货币实缴</small></td><td data-label="创业住房">${overviewHousing(r)}</td><td data-label="项目兑现"><strong class="payout-short">${esc(r.overview.payout)}</strong><small>${esc(r.overview.note)}</small></td><td>${selectionButton(r,true)}</td></tr>`).join('')}</tbody></table></div><p class="footnote">来源：${sourceRef('总览与理性分析','A5','总览表A5:E13')}、${sourceRef('申报条件与流程','D5','个人基础实缴D6:D13')}。资料缺失不按0；贷款、投资与住房不合计为“最高总包”。</p></section>`;
 }
 function amountRecordCard(r,reason){
  const region=model.region(r.regionId);
  return `<article><div><strong>${esc(region.short)} · ${esc(r.subtype)}</strong>${badge(r.nature)}</div><p class="separate-amount">${amountLabel(r)}</p><p>${esc(reason||r.boundary)}</p><small>${esc(r.boundary)}</small>${sourceRef('政策金额数据','A'+r.sourceRow,r.id+' · 原始记录')}</article>`;
 }
 function renderChart(viewId){
  const view=model.view(viewId),ranked=model.ranked(viewId),ceiling=Math.max(1,...ranked.map(r=>r.max)),missing=model.missing(viewId),separate=model.separate(viewId);
  const ranks=ranked.map(r=>{
   const region=model.region(r.regionId),zero=r.max===0;
   const lowest=zero?'明确无项目经费':r.min===null?'仅列上限，最低档未明确':'明确最低档 '+money(r.min)+'万元';
   const minimumBar=r.min===null?'<span class="bar-unavailable">原表未明确</span>':`<div class="bar-track" aria-hidden="true"><span style="width:${r.min/ceiling*100}%" class="bar-min${r.min===0?' zero':''}"></span></div>`;
   return `<div class="rank-row" data-record-id="${r.id}"><div class="rank-name"><strong>${esc(region.short)}</strong><span>${esc(r.subtype)}</span></div><div class="rank-body"><div class="rank-top"><span>${esc(r.tiers)}</span><span>${badge(r.nature)}${r.regionId==='changshu'?badge('2025说明','pending'):''}</span></div><div class="amount-bars"><div class="amount-bar-line"><span class="bar-label bar-label-min">最低档</span>${minimumBar}</div><div class="amount-bar-line"><span class="bar-label bar-label-max">最高档</span><div class="bar-track" aria-hidden="true"><span style="width:${r.max/ceiling*100}%" class="bar-max${zero?' zero':''}"></span></div></div></div><div class="rank-meta"><span>${esc(lowest)} · ${esc(r.boundary)}${zero?'；另有住房及企业引才支持。':''}</span>${sourceRef('政策金额数据','A'+r.sourceRow,r.id)}</div></div><div class="rank-value"><strong>${money(r.max)}</strong><small>${zero?'无此项经费':'万元 · 最高档'}</small><span class="rank-min-value${r.min===null?' unavailable':''}">${r.min===null?'最低未明确':'最低 '+money(r.min)}</span></div></div>`;
  }).join('');
  return `<div class="chart-intro"><div><h3>${esc(view.title)}金额对比</h3><p>${esc(view.subtitle)}</p></div>${badge('上限升序 · 同额保留原表顺序')}</div><div class="chart-key"><span class="chart-legend"><span><i class="key-min"></i>最低档</span><span><i class="key-max"></i>最高档</span></span><span>共同刻度：0—${money(ceiling)}万元</span></div><div class="ranking">${ranks}</div>${missing.length?`<div class="separate-block"><h4>未列明确现行金额 · 不作为0参与排序</h4><div class="separate-grid">${missing.map(r=>amountRecordCard(r)).join('')}</div></div>`:''}${separate.length?`<div class="separate-block"><h4>口径不同，单独阅读</h4><div class="separate-grid">${separate.map(r=>amountRecordCard(r,r.id==='P13'?'综合补贴，未与纯项目经费混排。':r.id==='P21'?'重大创业类别，未与独立团队类别混排。':r.id==='P42'?'顶尖类别，未与常规团队类别混排。':'全类别新细则范围；创业分档待核，未参与创业住房排名。')).join('')}</div></div>`:''}<p class="footnote">最低档和最高档使用同一刻度；最低档未明确时不绘制该柱，也不按0处理。离散档次不代表区间内任意金额都能获批。</p>`;
 }
 function amounts(){
  const additional=data.amounts.filter(r=>Number(r.id.slice(1))>=33);
  return `<section class="band" id="amounts"><div class="section container">${heading('02','AMOUNTS IN CONTEXT','比较额度，也保留资金性质','不同类别分开看，不形成地区综合评分。常熟待落户综合扶持、成长、顶尖及后续奖励在下方单列。')}<div class="amount-tabs" role="tablist" aria-label="金额比较类别">${data.views.map((v,i)=>`<button type="button" role="tab" id="amount-tab-${v.id}" data-view="${v.id}" aria-controls="amount-panel" aria-selected="${i===0}" tabindex="${i?-1:0}">${esc(v.title)}</button>`).join('')}</div><div class="amount-panel" id="amount-panel" role="tabpanel" aria-labelledby="amount-tab-startup" tabindex="0">${renderChart('startup')}</div><details class="additional-amounts detail"><summary>其他类别单列 · ${additional.length}条记录<span aria-hidden="true">＋</span></summary>${table(['地区 / 类别','档次（万元）','资金性质','适用及证据边界','定位'],additional.map(r=>[model.region(r.regionId).short+' · '+r.category+' / '+r.subtype,r.tiers,r.nature,r.boundary,html(sourceRef('政策金额数据','A'+r.sourceRow,r.id))]),'待落户、孵化、青年、成长、顶尖及后续奖励') }<p class="footnote">金额不与常规基础经费自动相加；常熟160／40万元为待落户综合扶持，仍有落地、入职与考察条件。</p></details><a href="#evidence" class="inline-link">查看12项冲突与资料边界记录 ↓</a></div></section>`;
 }
 function compare(){
  return `<section class="section container" id="compare">${heading('03','COMPARE YOUR SHORTLIST','选2—4地，把具体条件放在一起','初始不预选地区。选择顺序按Excel原始地区顺序展示，便于反复对照。')}<div class="selection-bar"><div class="region-choices" role="group" aria-label="选择对比地区">${data.regions.map(r=>selectionButton(r)).join('')}</div><div class="selection-meta"><span id="selection-status" role="status" aria-live="polite">已选0／4地，至少选择2地开始比较。</span><button class="text-button" type="button" id="clear-selection" disabled>清空选择</button></div></div><div id="compare-content"><div class="empty-state"><span aria-hidden="true">⌘</span><h3>从八地中，选出你的备选地区</h3><p>在这里或上方速览表添加地区，比较资金性质、申报门槛、住房和兑现流程。</p></div></div></section>`;
 }
 function comparisonHTML(ids){
  const regions=ids.map(id=>model.region(id)),headers=['核对维度',...regions.map(r=>r.name)],rows=fields=>fields.map(([label,get])=>[label,...regions.map(get)]);
  const amountCell=(r,category)=>{const a=model.regionRecord(r.id,category);return html(`<strong class="cell-amount">${amountLabel(a)}</strong>${a?`<p class="cell-note">${esc(a.boundary)}</p>${sourceRef('政策金额数据','A'+a.sourceRow,a.id)}`:''}`);};
  const groups=[
   ['startup','创业条件',true,[['常规创业金额与性质',r=>amountCell(r,'创业')],['学历',r=>r.requirements.degree],['经历',r=>r.requirements.experience],['个人基础现金实缴',r=>money(r.cash)+'万元'],['股权要求',r=>r.requirements.equity],['资本补充条件',r=>r.requirements.capital],['企业与在地要求',r=>r.requirements.local]]],
   ['innovation','创新条件',false,[['金额与资金性质',r=>amountCell(r,'创新')],['学位、经历、年薪与服务',r=>r.requirements.innovation]]],
   ['team','团队条件',false,[['独立团队金额',r=>amountCell(r,'团队')],['人数、投入与产业化',r=>r.requirements.team]]],
   ['housing','住房支持',true,[['住房额度与方式',r=>r.payout.housing],['期限与关键条件',r=>r.payout.housingCondition],['互斥与衔接',r=>r.payout.overlap]]],
   ['payout','兑现与申报流程',true,[['项目拨付比例或方式',r=>r.payout.ratio],['触发条件与周期',r=>r.payout.trigger],['版本与到账边界',r=>r.payout.boundary],['附件列示受理窗口',r=>r.requirements.window],['申报流程',r=>r.requirements.process],['入口与咨询',r=>html(/^https?:\/\/\S+$/.test(r.requirements.entry)?link(r.requirements.entry,'查看Excel所列入口'):esc(r.requirements.entry))]]]
  ];
  const states=new Map([...document.querySelectorAll('[data-compare-group]')].map(d=>[d.dataset.compareGroup,d.open]));
  return `<div class="chosen-head">${regions.map(r=>`<a href="${esc(r.file)}">${esc(r.name)}政策详情 ↗</a>`).join('')}</div>${groups.map(([id,title,open,fields])=>`<details class="detail compare-group" data-compare-group="${id}" id="compare-${id}" ${(states.has(id)?states.get(id):open)?'open':''}><summary>${esc(title)}<span aria-hidden="true">＋</span></summary>${table(headers,rows(fields),title+' · 所选地区横向比较','comparison-scroll')}<p class="group-source">${sourceRef('申报条件与流程','A'+regions[0].row,'条件表对应地区行')} · ${sourceRef('兑现与现金流','A'+regions[0].row,'兑现表对应地区行')}。金额记录编号及Word来源定位保留于原表。</p></details>`).join('')}`;
 }
 function support(){
  return `<section class="band print-extra" id="support"><div class="section container">${heading('04','BUSINESS & LIFE','场地、融资与生活配套，分别核对','贷款需要偿还，股权投资涉及交易安排；各项工具与财政无偿资助不混为一项金额。')}${table(['地区','常规办公面积 / 年限','企业贷款上限（万元）','股权投资上限（万元）','常规贴息上限（万元）','适用补充'],data.regions.map(r=>[r.short,(r.support.office||'面积未列明')+(r.support.office?'㎡':'')+' / '+(r.support.years?r.support.years+'年':'年限未列明'),r.support.loan||'未列明',r.support.equity||'未列明',r.support.interest||'未列明',r.support.note]),'办公与融资工具 · 空白表示附件未列可比现行额度')}<p class="footnote">昆山1年对应免费工位；姑苏区办公补贴≤30万元，非面积指标。具体口径见${sourceRef('配套与住房','A5','配套原表A5:J13')}。</p><div class="service-grid">${data.regions.map(r=>`<article><span class="eyebrow">${esc(r.name)}</span><h3>生活与企业服务</h3><p>${esc(r.support.services)}</p><strong>上级衔接</strong><p>${esc(r.support.overlap)}</p>${sourceRef('配套与住房','A'+r.row,'查看该地区原始记录')}</article>`).join('')}</div></div></section>`;
 }
 function history(){
  return `<section class="section container print-extra" id="history">${heading('05','HISTORY WITH BOUNDARIES','保留历史数量的年份、层级和状态','不把单批、全年、拟立项、正式立项与累计人次混排，也不由局部数据推算个人成功概率。')}<details class="detail history-detail"><summary>历史数据明细 · ${data.history.length}条记录<span aria-hidden="true">＋</span></summary>${table(['地区 / 年份','批次 / 范围','状态','数量 / 分母','单位 / 层级','证据与边界'],data.history.map(h=>[h.region+' · '+h.year,h.batch,h.status,h.count+(h.denominator?' / '+h.denominator:''),h.unit+' · '+h.scope,html(`<p>${esc(h.evidence)}</p><p>${esc(h.boundary)}</p>${sourceRef('历史数据与边界','A'+h.sourceRow,'原表第'+h.sourceRow+'行')}`)]),'历史统计 · 年份、批次与状态完整保留')}</details>${note('无法据此评出“最容易申报地区”','东吴47／77和梅李1／6分别属于不同文档、年份和局部范围；多数地区缺同批完整申报分母。各级获评、累计人次和年度目标也不替代本计划实绩。')}</section>`;
 }
 function evidence(){
  return `<section class="band print-extra" id="evidence"><div class="section container">${heading('06','EVIDENCE & VERSION','冲突与资料缺口，放在明处','原表的12项记录逐条保留。取得适用批次文件和书面口径后，再确定合同、购房与现金预算。')}<div class="issue-grid">${data.issues.map(issue=>`<details class="detail issue"><summary>${esc(issue.title)}<span aria-hidden="true">＋</span></summary><div class="issue-body"><span class="field-label">发现的问题</span><p>${esc(issue.problem)}</p><span class="field-label">本表处理</span><p>${esc(issue.handling)}</p><span class="field-label">待补材料</span><p>${esc(issue.needed)}</p><small>${esc(issue.ref)}</small>${sourceRef('总览与理性分析','A'+issue.sourceRow,'原表第'+issue.sourceRow+'行')}</div></details>`).join('')}</div></div></section>`;
 }
 function source(){
  const urls=data.index.filter(i=>/^https?:\/\/\S+$/.test(i.content));
  return `<section class="section container print-extra" id="source">${heading('07','WORKBOOK & SOURCES','从页面回到Excel，追溯每一项数据','以提供的Excel为唯一数据依据。原始行列、显示值与公式文本保留；来源链接的有效性未另行联网核验。')}<a class="source-download" href="${esc('../'+book.fileName)}" download><span><strong>${esc(book.fileName)}</strong><small>${book.sheets.length}个工作表 · ${data.amounts.length}条金额记录 · ${book.cellCount}个有值或公式的单元格</small></span><span>下载原始Excel ↗</span></a><details class="detail source-links"><summary>文档所列来源链接 · ${urls.length}条<span aria-hidden="true">＋</span></summary><div class="source-links-list">${urls.map(i=>`<div><strong>${esc(i.region)} · ${esc(i.label)}</strong>${link(i.content,'查看来源')}<p>${esc(i.file)} · ${esc(i.note)}</p></div>`).join('')}</div></details><details class="workbook-archive" id="workbook-archive"><summary><span>展开8个工作表的原始数据</span><small>支持跨表搜索与单元格定位 <b aria-hidden="true">＋</b></small></summary><div class="workbook-tools"><div><label for="workbook-sheet">浏览工作表</label><select id="workbook-sheet">${book.sheets.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('')}</select></div><div class="workbook-search"><label for="workbook-search">搜索全部8个工作表</label><div><input id="workbook-search" type="search" placeholder="如：P04、实缴、房票、7:3、2020" autocomplete="off"><button type="button" id="clear-workbook-search" hidden>清空</button></div></div></div><p class="workbook-status" id="workbook-status" role="status">展开后显示原始工作表。</p><div id="workbook-content"></div><p class="footnote workbook-note">百分数按Excel数值格式展示；“fx”可查看原公式，当前值为保存时的缓存快照。原表辅助计算列一并保留，网页不执行Excel公式。</p></details></section>`;
 }
 page.innerHTML=[hero(),overview(),amounts(),compare(),support(),history(),evidence(),source()].join('');
 let activeView='startup',selected=[],sourceLoaded=false,printState;
 function setView(id,focus=false){
  activeView=model.view(id).id;
  document.querySelectorAll('[data-view]').forEach(tab=>{const on=tab.dataset.view===activeView;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on&&focus)tab.focus();});
  const panel=document.getElementById('amount-panel');panel.setAttribute('aria-labelledby','amount-tab-'+activeView);panel.innerHTML=renderChart(activeView);
 }
 function updateSelection(){
  document.querySelectorAll('[data-select-region]').forEach(button=>{const on=selected.includes(button.dataset.selectRegion);button.setAttribute('aria-pressed',String(on));button.disabled=selected.length===4&&!on;button.title=button.disabled?'最多比较4地，取消一个后可重新选择':'';});
  document.getElementById('selection-status').textContent=`已选${selected.length}／4地。${selected.length<2?'至少选择2地开始比较。':selected.length===4?'已达到4地上限，可取消后重新选择。':'可以继续添加地区。'}`;
  document.getElementById('clear-selection').disabled=!selected.length;
  document.getElementById('compare-content').innerHTML=selected.length>=2?comparisonHTML(selected):`<div class="empty-state"><span aria-hidden="true">⌘</span><h3>${selected.length?'再选1地，就能并排比较':'从八地中，选出你的备选地区'}</h3><p>选择2—4地，查看创业、创新、团队、住房和兑现流程。</p></div>`;
 }
 function columnsFor(sheet){const last=sheet.dimension.split(':').pop().match(/^[A-Z]+/)[0];let n=0;for(const c of last)n=n*26+c.charCodeAt(0)-64;return Array.from({length:n},(_,i)=>{let value=i+1,s='';while(value){value--;s=String.fromCharCode(65+value%26)+s;value=Math.floor(value/26);}return s;});}
 function sourceTable(sheet,rows){
  const columns=columnsFor(sheet);
  return `<div class="table-scroll sheet-scroll" tabindex="0" role="region" aria-label="${esc(sheet.name)}原始数据"><table class="sheet-table"><caption>${esc(sheet.name)} · 原始范围${esc(sheet.dimension)}</caption><thead><tr><th scope="col">原行</th>${columns.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.index}</th>${columns.map(column=>{const c=row.cells.find(c=>c.column===column);if(!c)return '<td class="blank-cell">—</td>';const url=typeof c.value==='string'&&/^https?:\/\/\S+$/.test(c.value);return `<td id="cell-${sheet.id}-${c.address}" data-address="${c.address}" tabindex="-1">${url?link(c.value,c.display):esc(c.display||'—')}${c.formula?`<details class="formula"><summary>fx <span class="sr-only">查看${esc(c.address)}原公式</span></summary><code>${esc('='+c.formula)}</code></details>`:''}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
 }
 function updateWorkbook(){
  sourceLoaded=true;const input=document.getElementById('workbook-search'),query=input.value.trim(),select=document.getElementById('workbook-sheet'),content=document.getElementById('workbook-content');
  document.getElementById('clear-workbook-search').hidden=!input.value;select.disabled=!!query;
  if(query){const matches=model.search(query);const groups=book.sheets.map(sheet=>({sheet,rows:matches.filter(m=>m.sheet===sheet).map(m=>m.row)})).filter(g=>g.rows.length);content.innerHTML=groups.length?groups.map(g=>`<h3 class="sheet-result-title">${esc(g.sheet.name)} · ${g.rows.length}行</h3>${sourceTable(g.sheet,g.rows)}`).join(''):'<div class="empty-state"><h3>未找到匹配行</h3><p>试试地区名、资金编号或原文中的关键词。</p></div>';document.getElementById('workbook-status').textContent=`找到${matches.length}个匹配行，分布于${groups.length}个工作表；搜索范围为全部8表。`;}
  else{const sheet=book.sheets[Number(select.value)]||book.sheets[0];content.innerHTML=sourceTable(sheet,sheet.rows);document.getElementById('workbook-status').textContent=`正在浏览“${sheet.name}”，${sheet.rows.length}个有值或公式的行；保留原始行号与单元格地址。`;}
 }
 function jumpToSource(sheetName,address){
  const index=book.sheets.findIndex(s=>s.name===sheetName);if(index<0)return;
  document.getElementById('workbook-search').value='';document.getElementById('workbook-sheet').value=String(index);document.getElementById('workbook-archive').open=true;updateWorkbook();
  requestAnimationFrame(()=>{const cell=document.getElementById(`cell-${book.sheets[index].id}-${address}`);if(cell){cell.classList.add('source-highlight');cell.scrollIntoView({block:'center',inline:'center',behavior:'auto'});cell.focus({preventScroll:true});}});
 }
 page.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.view){setView(button.dataset.view);return;}
  if(button.dataset.selectRegion){const result=model.select(selected,button.dataset.selectRegion);selected=result.ids;updateSelection();return;}
  if(button.dataset.sourceSheet){jumpToSource(button.dataset.sourceSheet,button.dataset.sourceCell);return;}
  if(button.id==='clear-selection'){selected=[];updateSelection();return;}
  if(button.id==='clear-workbook-search'){document.getElementById('workbook-search').value='';updateWorkbook();document.getElementById('workbook-search').focus();}
 });
 document.querySelectorAll('[data-view]').forEach(tab=>tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=data.views.findIndex(v=>v.id===tab.dataset.view),next=event.key==='Home'?0:event.key==='End'?data.views.length-1:(i+(event.key==='ArrowRight'?1:-1)+data.views.length)%data.views.length;setView(data.views[next].id,true);}));
 document.getElementById('workbook-sheet').addEventListener('change',updateWorkbook);document.getElementById('workbook-search').addEventListener('input',updateWorkbook);
 document.getElementById('workbook-archive').addEventListener('toggle',()=>{if(document.getElementById('workbook-archive').open&&!sourceLoaded)updateWorkbook();});
 function preparePrint(){if(printState)return;printState=[...document.querySelectorAll('[data-compare-group]')].map(d=>[d,d.open]);printState.forEach(([d])=>{d.open=true;});}
 function restorePrint(){if(!printState)return;printState.forEach(([d,open])=>{d.open=open;});printState=null;}
 window.addEventListener('beforeprint',preparePrint);window.addEventListener('afterprint',restorePrint);
 document.getElementById('print-button').addEventListener('click',()=>window.print());
})();
