(async () => {
 const results=[],check=(name,condition)=>{results.push({name,passed:!!condition});if(!condition)throw new Error('Browser check failed: '+name);};
 const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const click=selector=>{const node=document.querySelector(selector);if(!node)throw new Error('Missing '+selector);node.click();};
 click('#clear-selection');
 const expected={startup:7,innovation:6,team:5,housing:7};
 for(const [id,count]of Object.entries(expected)){
  click('[data-view="'+id+'"]');check(id+' tab selected',document.querySelector('[data-view="'+id+'"]').getAttribute('aria-selected')==='true');check(id+' ranking count',document.querySelectorAll('#amount-panel .rank-row').length===count);
  if(id==='innovation')check('Gusu real zero and separate SIP comprehensive',document.querySelector('.rank-value strong').textContent==='0'&&[...document.querySelectorAll('#amount-panel .separate-grid')].some(g=>g.textContent.includes('综合补贴')));
  if(id==='team')check('Top teams and major startup kept separate',[...document.querySelectorAll('#amount-panel .separate-grid')].some(g=>g.textContent.includes('顶尖')&&g.textContent.includes('重大创业')));
  if(id==='housing')check('Wuzhong housing conflict excluded',document.querySelector('.separate-grid').textContent.includes('创业分档待核'));
 }
 const key=(id,key)=>document.querySelector('[data-view="'+id+'"]').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
 key('housing','ArrowRight');check('Keyboard wraps right',document.querySelector('[data-view="startup"]').getAttribute('aria-selected')==='true');
 key('startup','End');check('Keyboard End',document.activeElement.dataset.view==='housing');key('housing','Home');check('Keyboard Home',document.activeElement.dataset.view==='startup');
 click('[data-select-region="wuzhong"]');check('One region prompts for another',document.getElementById('compare-content').textContent.includes('再选1地'));
 click('[data-select-region="gusu"]');check('Two regions create five comparison groups',document.querySelectorAll('[data-compare-group]').length===5);
 check('Startup/housing/payout open initially',['startup','housing','payout'].every(id=>document.getElementById('compare-'+id).open));check('Innovation and team initially collapsed',!document.getElementById('compare-innovation').open&&!document.getElementById('compare-team').open);
 click('[data-select-region="changshu"]');click('[data-select-region="kunshan"]');
 check('Four selections cap unchosen controls',document.querySelector('[data-select-region="snd"]').disabled&&document.querySelectorAll('.region-choice[aria-pressed="true"]').length===4);
 click('[data-select-region="snd"]');check('Disabled fifth selection ignored',document.querySelectorAll('.region-choice[aria-pressed="true"]').length===4);
 click('[data-select-region="kunshan"]');click('[data-select-region="snd"]');check('Removing permits a new fourth selection',document.querySelector('.region-choice[data-select-region="snd"]').getAttribute('aria-pressed')==='true');
 const groups=[...document.querySelectorAll('[data-compare-group]')],states=groups.map(d=>d.open),archive=document.getElementById('workbook-archive'),archiveState=archive.open;
 window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new Event('beforeprint'));check('Printing opens all selected comparison groups',groups.every(d=>d.open));check('Printing does not open raw workbook',archive.open===archiveState);window.dispatchEvent(new Event('afterprint'));check('Print restores states',groups.every((d,i)=>d.open===states[i]));
 click('.rank-meta [data-source-sheet="政策金额数据"]');await settle();check('Cell citation opens worksheet and locates cell',archive.open&&document.querySelector('.source-highlight')?.textContent.includes('P02'));
 const input=document.getElementById('workbook-search');input.value='Ｐ０４';input.dispatchEvent(new Event('input',{bubbles:true}));check('Fullwidth cross-sheet source search',document.getElementById('workbook-content').textContent.includes('P04'));
 input.value='７：３';input.dispatchEvent(new Event('input',{bubbles:true}));check('Normalized fiscal ratio search',!document.getElementById('workbook-content').textContent.includes('未找到匹配行'));
 input.value='no-match-example-xyz';input.dispatchEvent(new Event('input',{bubbles:true}));check('No matches clear',document.getElementById('workbook-status').textContent.includes('找到0个匹配行'));
 click('#clear-workbook-search');check('Search clear restores browsing',input.value===''&&!document.getElementById('workbook-sheet').disabled);
 const picker=document.getElementById('workbook-sheet');for(let i=0;i<8;i++){picker.value=String(i);picker.dispatchEvent(new Event('change',{bubbles:true}));check('Original worksheet '+(i+1),document.querySelector('.sheet-table caption').textContent.includes(window.SUZHOU_WORKBOOK.sheets[i].name));}
 picker.value='2';picker.dispatchEvent(new Event('change',{bubbles:true}));check('Percent formatting 50%',document.getElementById('cell-3-B21').textContent==='50%');
 const first=window.SUZHOU_MODEL.record('P04');check('Original amount 400 retained',window.SUZHOU_COMPARE.amounts.find(a=>a.id==='P04').max===400&&first.max===400);
 archive.open=false;click('#clear-selection');click('[data-view="startup"]');picker.value='0';picker.dispatchEvent(new Event('change',{bubbles:true}));await settle();
 check('Clear selection resets all controls',document.querySelectorAll('[data-select-region][aria-pressed="true"]').length===0&&document.querySelectorAll('[data-select-region]:disabled').length===0);
 return results;
})()
