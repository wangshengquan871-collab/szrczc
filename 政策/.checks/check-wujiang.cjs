// Offline checks of real templates and interaction logic. No browser layout emulation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'全市政策','吴江资源');
const html=fs.readFileSync(path.join(root,'全市政策','吴江.html'),'utf8');
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const context=vm.createContext({window:{}});
for(const name of ['policy-data.js','source-data.js','app.js']){
 const text=fs.readFileSync(path.join(dir,name),'utf8');new vm.Script(text,{filename:name});
 if(name!=='app.js')vm.runInContext(text,context);
}
let rendered;const stop=new Error('template rendered'),page={};
Object.defineProperty(page,'innerHTML',{set(v){rendered=v;throw stop;}});
context.document={getElementById(id){assert.equal(id,'page-content');return page;}};
try{vm.runInContext(app,context,{timeout:3000});}catch(e){if(e!==stop)throw e;}
assert.ok(rendered);
const complete=html.replace('<div id="page-content"></div>',`<div id="page-content">${rendered}</div>`);
const ids=[...complete.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
for(const [,id]of complete.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),'Missing anchor '+id);
for(const [,attr,targets]of complete.matchAll(/\b(aria-controls|aria-labelledby|aria-describedby)="([^"]+)"/g))for(const id of targets.split(/\s+/))assert.ok(ids.includes(id),`Missing ${attr} ${id}`);
for(const [,asset]of html.matchAll(/(?:src|href)="(吴江资源\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,'全市政策',asset)),'Missing asset '+asset);
const source=context.window.WUJIANG_SOURCE,data=context.window.WUJIANG_POLICY;
assert.ok(fs.existsSync(path.join(root,source.fileName)));
assert.equal(source.blocks.length,100);assert.equal(source.blocks.filter(b=>b.type==='paragraph').length,96);assert.equal(source.blocks.filter(b=>b.type==='table').length,4);assert.equal(source.blocks.flatMap(b=>b.links).length,15);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,100);assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,3);
assert.equal((rendered.match(/<caption>原文表格 /g)||[]).length,4);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const b of source.blocks){for(const s of b.type==='table'?b.rows.flat():[b.text])assert.ok(rendered.includes(esc(s)),'Missing source text');for(const r of b.links)assert.ok(rendered.includes(esc(r.url)),'Missing source URL');}
assert.deepEqual([...rendered.matchAll(/<li value="(\d+)">/g)].map(m=>Number(m[1])),Array.from({length:14},(_,i)=>i+1));
const supplement=rendered.match(/<div class="source-supplement">([\s\S]*?)<\/div>/)[1];assert.equal((supplement.match(/<a /g)||[]).length,1);assert.ok(supplement.includes('[8]'));
assert.equal(data.projects[0].amount,'100 / 200 / 300');assert.equal(data.projects[1].amount,'50 / 100 / 150');assert.equal(data.projects[2].amount,'300 / 500 / 1000');
assert.ok(data.projects[2].rows.find(r=>r[0]==='三种投入证明条件')[1].includes('超过2000万元'));
assert.ok(data.ticketRules.find(r=>r[0]==='产权限制')[1].includes('满5年'));
assert.ok(data.ticketRules.find(r=>r[0]==='租房补贴衔接')[1].includes('次月'));
assert.ok(data.statisticsNote[1].includes('不计算通过率'));
assert.ok(!app.includes('GUSU_'));assert.ok(!app.includes('XIANGCHENG_'));assert.ok(!app.includes('fetch('));
const start=app.indexOf('  function calculateTicket('),end=app.indexOf('\n  const faceInput=',start);
assert.ok(start>=0&&end>start);vm.runInContext('const data=window.WUJIANG_POLICY;\n'+app.slice(start,end),context);
for(const [face,price,amount,excess]of [
 ['100','80',800000,200000],['50','150',500000,0],['300','500',3000000,0],['100','100',1000000,0],
 ['0.01','0.01',100,0],['100.25','80.01',800100,202400],['300','0.01',100,2999900],['150.50','1000',1505000,0]
]){const r=context.calculateTicket(face,price);assert.ok(r);assert.equal(r.usableYuan,amount);assert.equal(r.excessYuan,excess);assert.equal(r.faceYuan,r.usableYuan+r.excessYuan);}
for(const [face,price]of [
 ['',80],[100,''],['0','80'],['-1','80'],['301','80'],['300.01','500'],['NaN','100'],['Infinity','100'],
 ['1e2','80'],['100.001','80'],['100','0'],['100','-1'],['100','80.001'],['100','1e3'],['100','90071992547410.99'],['bad','80']
])assert.equal(context.calculateTicket(face,price),null,'Should reject '+face+' / '+price);
// A tiny DOM fixture runs real event handlers, without simulating browser layout.
const elements=new Map(),make=(id,extra={})=>{const e={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',addEventListener(n,f){this.handlers[n]=f;},setAttribute(n,v){this.attrs[n]=v;},focus(){this.focused=true;},...extra};if(id)elements.set(id,e);return e;};
for(const id of ids)make(id);
elements.get('ticket-face').value='100';elements.get('purchase-price').value='80';
const tabs=data.projects.map((p,i)=>make('tab-'+p.id,{dataset:{tab:p.id},tabIndex:i?-1:0}));
const panels=data.projects.map((p,i)=>make('panel-'+p.id,{hidden:i!==0}));
const blocks=source.blocks.map((b,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true}),make('',{open:false})];
context.document={getElementById(id){assert.ok(elements.has(id),'Unknown element '+id);return elements.get(id);},querySelectorAll(selector){return {'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks]}[selector]||[];}};
const events={};let printed=0;context.window.addEventListener=(n,f)=>events[n]=f;context.window.print=()=>printed++;
vm.runInContext(app,context,{timeout:3000});
assert.ok(elements.get('ticket-results').innerHTML.includes('80<small>万元'));
assert.ok(elements.get('ticket-results').innerHTML.includes('20<small>万元'));
assert.ok(elements.get('ticket-results').innerHTML.includes('width:80%'));
tabs[2].handlers.click();assert.equal(panels[2].hidden,false);assert.equal(panels[0].hidden,true);assert.equal(tabs[2].attrs['aria-selected'],'true');
const key=k=>({key:k,preventDefault(){}});
tabs[2].handlers.keydown(key('ArrowRight'));assert.equal(tabs[0].attrs['aria-selected'],'true');assert.equal(tabs[0].focused,true);
tabs[0].handlers.keydown(key('ArrowLeft'));assert.equal(tabs[2].attrs['aria-selected'],'true');
tabs[2].handlers.keydown(key('Home'));assert.equal(tabs[0].attrs['aria-selected'],'true');tabs[0].handlers.keydown(key('End'));assert.equal(tabs[2].attrs['aria-selected'],'true');
elements.get('ticket-face').value='0.01';elements.get('purchase-price').value='100';elements.get('ticket-face').handlers.input();assert.ok(elements.get('ticket-results').innerHTML.includes('0.01<small>万元'));
elements.get('ticket-face').value='301';elements.get('ticket-face').handlers.input();assert.equal(elements.get('ticket-error').hidden,false);assert.equal(elements.get('ticket-results').innerHTML,'');
elements.get('ticket-face').value='150';elements.get('purchase-price').value='100';elements.get('purchase-price').handlers.input();assert.equal(elements.get('ticket-error').hidden,true);
const search=elements.get('source-search');search.value='房票';search.handlers.input();assert.ok(blocks.some(b=>b.hidden));assert.ok(blocks.some(b=>!b.hidden));assert.equal(elements.get('source-document').open,true);
search.value='２０２１';search.handlers.input();const normalized=blocks.map(b=>b.hidden);search.value='2021';search.handlers.input();assert.deepEqual(blocks.map(b=>b.hidden),normalized);
const state=blocks.map(b=>b.hidden),panelState=panels.map(p=>p.hidden),detailState=details.map(d=>d.open);
events.beforeprint();events.beforeprint();assert.ok(blocks.every(b=>!b.hidden));assert.ok(panels.every(p=>!p.hidden));assert.ok(details.every(d=>d.open));events.afterprint();
assert.deepEqual(blocks.map(b=>b.hidden),state);assert.deepEqual(panels.map(p=>p.hidden),panelState);assert.deepEqual(details.map(d=>d.open),detailState);
search.value='no-match-example-xyz';search.handlers.input();assert.ok(blocks.every(b=>b.hidden));assert.ok(elements.get('search-status').textContent.includes('找到0个'));
elements.get('clear-search').handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(b=>!b.hidden));assert.equal(search.focused,true);
elements.get('print-button').handlers.click();assert.equal(printed,1);
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
for(const marker of ['@media print','@media(max-width:640px)','prefers-reduced-motion','.ticket-fields','.ticket-boundary','.project-panel[hidden]'])assert.ok(css.includes(marker),'Missing CSS '+marker);
console.log('PASS: JavaScript syntax, real templates, unique IDs, anchors, ARIA targets and all local assets.');
console.log('PASS: 96 paragraphs + 4 tables + 15 hyperlinks; 14 numbered sources + 1 supplemental official URL.');
console.log('PASS: 8 valid and 16 invalid ticket examples, precise money, tab keyboard navigation, input validation, search and print restoration.');
console.log('PASS: CSS balance, responsive/print/reduced-motion rules. Browser layout was not tested.');
