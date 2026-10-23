(async () => {
 const results=[],check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error('Home enhancement: '+name);};
 const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const click=selector=>document.querySelector(selector).click();
 const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 const cards=()=>[...document.querySelectorAll('[data-szp-card]')].filter(el=>!el.hidden);
 const reset=async()=>{document.getElementById('szp-policy-filters').reset();await settle();};
 if(innerWidth<1100){
  const toggle=document.querySelector('.szp-menu-toggle');toggle.focus();toggle.click();
  document.getElementById('szp-filter-keyword').focus();await settle();
  check('Tabbing outside mobile navigation closes menu',toggle.getAttribute('aria-expanded')==='false');
 }
 check('Original hero preserved',document.getElementById('szp-hero-title').textContent==='苏州市科技创新创业领军人才政策综合展示平台');
 check('Structural counts 1/8/9',[...document.querySelectorAll('[data-szp-count]')].map(el=>el.dataset.szpCount).join()==='1,8,9');
 check('All 9 card sources and categories',document.querySelectorAll('[data-szp-card] .szp-card-meta').length===9);
 check('Home avoids loading 2MB workbook',![...document.scripts].some(s=>s.src.includes('workbook-data.js')));
 await reset();check('All 9 entries initially',cards().length===9);
 set('szp-filter-region','sip');check('District filter',cards().length===1&&cards()[0].dataset.szpCard==='sip');
 set('szp-filter-category','team');check('Major SIP startup not misclassified as team',cards().length===0&&!document.getElementById('szp-empty-results').hidden);
 await reset();set('szp-filter-category','youth');check('Youth matches actual project',cards().some(el=>el.dataset.szpCard==='xiangcheng'));
 await reset();set('szp-filter-keyword','姑苏办');check('Keyword uses existing policy data',cards().some(el=>el.dataset.szpCard==='gusu'));
 set('szp-filter-region','sip');check('Filter combination uses AND',cards().length===0);
 await reset();set('szp-filter-keyword','no-match-987654321');check('Empty search explains result',cards().length===0&&!document.getElementById('szp-empty-results').hidden);
 click('#szp-reset-empty');await settle();check('Empty-state reset restores all cards',cards().length===9);
 click('#szp-clear-basket');
 check('Empty basket disables compare',document.getElementById('szp-open-comparison').disabled);
 click('[data-szp-add-region="wuzhong"]');check('Single choice requires another',document.getElementById('szp-open-comparison').disabled);
 click('[data-szp-add-region="gusu"]');check('Two choices enable compare',!document.getElementById('szp-open-comparison').disabled);
 click('[data-szp-add-region="changshu"]');click('[data-szp-add-region="kunshan"]');
 check('Basket four-region cap',document.querySelector('[data-szp-add-region="snd"]').disabled&&document.querySelectorAll('[data-szp-add-region][aria-pressed="true"]').length===4);
 click('[data-szp-add-region="snd"]');check('Disabled fifth cannot enter',document.querySelectorAll('[data-szp-add-region][aria-pressed="true"]').length===4);
 click('[data-szp-remove-region="kunshan"]');check('Removal permits new choice',!document.querySelector('[data-szp-add-region="snd"]').disabled);
 click('[data-szp-add-region="snd"]');
 set('szp-filter-region','sip');check('Filtering does not lose basket choices',document.querySelectorAll('[data-szp-add-region][aria-pressed="true"]').length===4);
 await reset();
 check('City policy excluded from region basket',!document.querySelector('[data-szp-add-region="gusu-city"]'));
 const bridge=window.SZP_COMPARE_BRIDGE;
 const url=new URL(bridge.link(['wuzhong','gusu','changshu','snd'],'housing'));
 check('Comparison URL carries only known regions',url.searchParams.get('regions')==='wuzhong,gusu,changshu,snd'&&url.searchParams.get('view')==='housing'&&url.hash==='#compare');
 check('Untrusted IDs sanitized',bridge.sanitize(['fake','gusu','gusu','wuzhong','changshu','snd','sip']).length===4&&!bridge.sanitize(['fake']).length);
 click('#szp-clear-basket');check('Clear basket resets choices',document.querySelectorAll('[data-szp-add-region][aria-pressed="true"]').length===0&&![...document.querySelectorAll('[data-szp-add-region]')].some(b=>b.disabled));
 const expected={startup:['P02','P08','P01','P05','P06','P07','P04'],innovation:['P10','P09','P14','P16','P15','P12'],team:['P22','P24','P17','P20','P23'],housing:['P28','P26','P30','P32','P27','P29','P31']};
 for(const view of Object.keys(expected)){
  click('[data-szp-chart-view="'+view+'"]');
  check(view+' sorting matches original',[...document.querySelectorAll('[data-szp-record]')].map(e=>e.dataset.szpRecord).join()===expected[view].join());
  click('[data-szp-chart-mode="range"]');
  for(const row of document.querySelectorAll('[data-szp-record]')){
   const r=window.SUZHOU_COMPARE.amounts.find(a=>a.id===row.dataset.szpRecord);
   check(r.id+' truthful labels',row.textContent.includes('最高 '+r.max.toLocaleString('zh-CN')+'万元')&&(r.min===null?row.textContent.includes('最低 暂无数据'):row.textContent.includes('最低 '+r.min.toLocaleString('zh-CN')+'万元')));
   if(r.min===null)check(r.id+' missing min has no invented interval',row.querySelectorAll('svg circle').length===1&&!row.querySelector('svg line'));
  }
  if(view==='startup'){
   check('Kunshan has 4 discrete marks',document.querySelector('[data-szp-record="P04"]').querySelectorAll('svg circle').length===4);
   check('SIP has 2 distinct grant marks',document.querySelector('[data-szp-record="P05"]').querySelectorAll('svg circle').length===2);
   check('Changshu unknown funding not zero ranked',!document.querySelector('[data-szp-record="P03"]')&&document.querySelector('.szp-preview-exceptions').textContent.includes('暂无数据／待核实'));
  }
  if(view==='innovation')check('Real zero kept with other benefits',document.querySelector('[data-szp-record="P10"]').textContent.includes('最高 0万元')&&document.querySelector('[data-szp-record="P10"]').textContent.includes('另有住房及企业引才支持'));
  click('[data-szp-chart-mode="bars"]');
  const ceiling=Math.max(...window.SUZHOU_COMPARE.views.find(v=>v.id===view).ids.map(id=>window.SUZHOU_COMPARE.amounts.find(r=>r.id===id).max||0));
  for(const row of document.querySelectorAll('[data-szp-record]')){
   const r=window.SUZHOU_COMPARE.amounts.find(a=>a.id===row.dataset.szpRecord),min=row.querySelector('.szp-minimum-bar'),max=row.querySelector('.szp-maximum-bar');
   check(r.id+' max bar scale',Math.abs(parseFloat(max.style.width)-r.max/ceiling*100)<.001);
   check(r.id+' min bar scale',r.min===null?!min:!!min&&Math.abs(parseFloat(min.style.width)-r.min/ceiling*100)<.001);
  }
  check(view+' sources and units',document.querySelector('.szp-preview-source').textContent.includes('万元')&&document.querySelector('.szp-preview-source').textContent.includes('2026-10-10')&&document.querySelector('.szp-amount-figure').textContent.includes('不作总包合计'));
 }
 const housing=document.querySelector('[data-szp-chart-view="housing"]');housing.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
 check('Chart keyboard Home',document.activeElement.dataset.szpChartView==='startup');
 const first=document.querySelector('[data-szp-chart-view="startup"]');first.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
 check('Chart keyboard End',document.activeElement.dataset.szpChartView==='housing');
 const evidence=new URL(document.querySelector('[data-szp-record="P29"] .szp-preview-boundary a').href);
 check('Cell evidence link remains traceable',evidence.searchParams.get('source-sheet')==='政策金额数据'&&evidence.searchParams.get('source-cell')==='A34');
 click('[data-szp-chart-view="startup"]');click('[data-szp-chart-mode="range"]');await reset();
 window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await settle();
 check('Back-to-top becomes available',!document.getElementById('szp-back-top').hidden);
 return results;
})()
