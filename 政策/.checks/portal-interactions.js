(async () => {
  const checks=[];
  const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw new Error('Portal check failed: '+name);};
  const header=document.getElementById('szp-global-header');
  const menu=header.querySelector('.szp-menu-toggle'),region=header.querySelector('.szp-region-toggle');
  const links=[...header.querySelectorAll('[data-szp-region]')];
  const narrow=innerWidth<1100;
  const key=(element,key)=>element.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  check('8 district menu entries',links.length===8);
  check('Uniform 76px navigation height',Math.abs(header.getBoundingClientRect().height-76)<1);
  check('Uniform global menu order',[...header.querySelector('.szp-site-menu').children].map(el=>el.dataset.szpNav||'regions').join(',')==='home,policies,city-policy,regions,comparison,about');
  check('City policy directly reachable',decodeURIComponent(header.querySelector('[data-szp-nav="city-policy"]').pathname).endsWith('/pages/姑苏领军.html'));
  check('City policy not conflated with district menu',links.every(a=>!a.href.includes(encodeURIComponent('姑苏领军'))));
  check('Home return route points within site',header.querySelector('.szp-platform-brand').href.endsWith('/index.html'));
  if(narrow){
    menu.click();check('Mobile menu expands',menu.getAttribute('aria-expanded')==='true'&&getComputedStyle(header.querySelector('.szp-site-menu')).display!=='none');
  } else {
    header.querySelector('.szp-region-menu').dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));
    check('Desktop hover opens district menu',region.getAttribute('aria-expanded')==='true');
    region.click();check('Click after hover keeps menu accessible',region.getAttribute('aria-expanded')==='true');
    header.querySelector('.szp-region-menu').dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
  }
  key(region,'ArrowDown');check('ArrowDown opens and focuses first region',document.activeElement===links[0]);
  key(links[0],'End');check('End focuses last region',document.activeElement===links[7]);
  key(links[7],'ArrowDown');check('Regional keyboard wraps',document.activeElement===links[0]);
  key(links[0],'Escape');check('Escape returns to region button',region.getAttribute('aria-expanded')==='false'&&document.activeElement===region);
  region.click();check('Click opens region menu',region.getAttribute('aria-expanded')==='true');
  document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));check('Outside click closes region menu',region.getAttribute('aria-expanded')==='false');
  if(narrow){menu.click();key(menu,'Escape');check('Escape collapses mobile menu',menu.getAttribute('aria-expanded')==='false');}
  if(document.body.classList.contains('szp-home')){
    check('9 readable static cards',document.querySelectorAll('[data-szp-policy]').length===9);
    check('City policy card first',document.querySelector('[data-szp-policy]').dataset.szpPolicy==='gusu-city');
    check('Full hero title',document.getElementById('szp-hero-title').textContent==='苏州市科技创新创业领军人才政策综合展示平台');
    check('Institution logo beside platform name',header.querySelector('.szp-institute-logo').naturalWidth===2952);
    return checks;
  }
  check('Original institution logo preserved',document.querySelector('.institute-header-logo').naturalWidth===2952);
  check('Text-only child global branding',header.querySelectorAll('img').length===0);
  const sharedStyles=[...document.querySelectorAll('link[rel="stylesheet"]')].find(el=>el.href.endsWith('/css/navigation.css'));
  const properties=['display','position','width','height','font-family','font-size','font-weight','line-height','color','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top-width','border-top-color','grid-template-columns','gap','align-items'];
  const samples=['body > .site-header','.hero','.overview-strip','.section-heading','[role="tabpanel"]:not([hidden])','.project-card','.project-panel:not([hidden])','.grant-bars','.rank-row','.calculator','.ticket-calculator','.date-demo','.source-download'].flatMap(selector=>[...document.querySelectorAll(selector)].slice(0,2));
  const snapshot=el=>{const css=getComputedStyle(el);return properties.map(p=>css.getPropertyValue(p));};
  const integrated=samples.map(snapshot);
  sharedStyles.disabled=true;header.hidden=true;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const original=samples.map(snapshot);
  sharedStyles.disabled=false;header.hidden=false;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  samples.forEach((el,i)=>check('Policy CSS unchanged '+(el.id||el.className||el.tagName),JSON.stringify(integrated[i])===JSON.stringify(original[i])));
  const routeIds={'东吴.html':'wuzhong','姑苏区.html':'gusu','常熟.html':'changshu','昆山.html':'kunshan','金鸡湖.html':'sip','高新区.html':'snd','吴江.html':'wujiang','相城.html':'xiangcheng'};
  const decodedFile=decodeURIComponent(location.pathname.split('/').pop());
  if(routeIds[decodedFile])check('Current district nav highlight',header.querySelector('[data-szp-region="'+routeIds[decodedFile]+'"]').getAttribute('aria-current')==='page');
  if(routeIds[decodedFile])check('Seven other districts directly reachable',links.filter(el=>el.dataset.szpRegion!==routeIds[decodedFile]).length===7);
  if(decodedFile==='姑苏领军.html')check('Current city nav highlight',header.querySelector('[data-szp-nav="city-policy"]').getAttribute('aria-current')==='page');
  if(decodedFile==='政策对比.html')check('Current comparison nav highlight',header.querySelector('[data-szp-nav="comparison"]').getAttribute('aria-current')==='page');
  const firstAnchor=document.querySelector('body > .site-header nav a[href^="#"]');
  if(firstAnchor){const target=document.querySelector(firstAnchor.getAttribute('href'));if(target){target.scrollIntoView({behavior:'instant'});await new Promise(r=>requestAnimationFrame(r));check('Local anchor stays below visible navigation',target.getBoundingClientRect().top>=header.getBoundingClientRect().bottom+12);check('Local anchor avoids excessive blank offset',target.getBoundingClientRect().top<200);}}
  const tabs=[...document.querySelectorAll('[data-tab]')];
  for(const tab of tabs){
    tab.click();const panel=document.getElementById(tab.getAttribute('aria-controls'));
    check('Original policy tab '+tab.dataset.tab,tab.getAttribute('aria-selected')==='true'&&panel&&!panel.hidden);
  }
  if(tabs.length){key(tabs.at(-1),'Home');check('Policy keyboard Home',tabs[0].getAttribute('aria-selected')==='true');}
  const input=document.getElementById('source-search');
  if(input){
    const blocks=[...document.querySelectorAll('.source-block')];
    input.value='portal-no-match-7654321';input.dispatchEvent(new Event('input',{bubbles:true}));
    check('Original source search filters',blocks.length>0&&blocks.every(b=>b.hidden));
    input.value='人才';input.dispatchEvent(new Event('input',{bubbles:true}));
    check('Original source search finds matches',blocks.some(b=>!b.hidden));
    document.getElementById('clear-search').click();check('Original source clear',input.value==='');
  }
  const set=(id,value,event='input')=>{const el=document.getElementById(id);const old=el.value;el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));return ()=>{el.value=old;el.dispatchEvent(new Event(event,{bubbles:true}));};};
  const file=decodeURIComponent(location.pathname.split('/').pop());
  if(file==='东吴.html'){
    const restore=set('grant-amount','200');check('Dongwu payment split', [...document.querySelectorAll('#calculation-results strong')].map(e=>parseFloat(e.textContent)).join(',')==='100,60,40');restore();
  }
  if(file==='昆山.html'){
    const restore=set('grant-amount','200','change');check('Kunshan payment calculator', [...document.querySelectorAll('#payment-results strong')].reduce((s,e)=>s+parseFloat(e.textContent),0)===200);restore();
    const restorePrice=set('house-price','100');check('Kunshan housing calculator valid',document.getElementById('housing-error').hidden&&document.getElementById('housing-results').textContent.includes('万元'));restorePrice();
  }
  if(file==='姑苏领军.html'){
    const restore=set('purchase-year','2028');check('City housing next-year projection',document.getElementById('housing-results').textContent.includes('2029'));restore();
  }
  if(file==='高新区.html'){
    const restore=set('personal-cash','0');check('SND cash threshold calculator',document.querySelectorAll('#capital-results .met').length===0&&document.querySelectorAll('#capital-results .unmet').length>0);restore();
  }
  if(file==='吴江.html'){
    const restore=set('purchase-price','80'),restoreFace=set('ticket-face','100');check('Wujiang ticket min calculation',document.getElementById('ticket-results').textContent.includes('80'));restore();restoreFace();
  }
  if(file==='相城.html'){
    const restore=set('approved-cash','20');check('Xiangcheng half-payment calculation',[...document.querySelectorAll('#cash-results strong')].every(e=>parseFloat(e.textContent)===10));restore();
  }
  if(file==='金鸡湖.html'){
    const restore=set('first-date','2024-02-29');check('SIP leap-year date calculation',document.getElementById('date-timeline').textContent.includes('2025-02-28')&&document.getElementById('date-timeline').textContent.includes('2026-02-28'));restore();
  }
  if(file==='常熟.html'){
    const controls=[...document.querySelectorAll('[data-category]')];
    controls.forEach(button=>{button.click();check('Changshu historical category '+button.dataset.category,button.getAttribute('aria-pressed')==='true');});controls[0]?.click();
  }
  const details=[...document.querySelectorAll('details')],states=details.map(el=>el.open);
  const panels=[...document.querySelectorAll('.project-panel,.tab-panel,.source-block,.source-document')],hidden=panels.map(el=>el.hidden);
  window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new Event('afterprint'));
  check('Original print restores detail states',details.every((el,i)=>el.open===states[i]));
  check('Original print restores visible panels',panels.every((el,i)=>el.hidden===hidden[i]));
  return checks;
})()
