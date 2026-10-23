// Validate the actual static templates and event handlers; does not emulate browser layout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'全市政策','高新区资源');
const html=fs.readFileSync(path.join(root,'全市政策','高新区.html'),'utf8');
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8'),context=vm.createContext({window:{}});
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
for(const [,asset]of html.matchAll(/(?:src|href)="(高新区资源\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,'全市政策',asset)),'Missing asset '+asset);
const source=context.window.SND_SOURCE,data=context.window.SND_POLICY;
assert.ok(fs.existsSync(path.join(root,source.fileName)));
assert.equal(source.blocks.length,102);assert.equal(source.blocks.filter(b=>b.type==='paragraph').length,90);assert.equal(source.blocks.filter(b=>b.type==='table').length,12);assert.equal(source.blocks.flatMap(b=>b.links).length,13);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,102);assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,4);
assert.equal((rendered.match(/<caption>原文表格 /g)||[]).length,12);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const b of source.blocks){for(const s of b.type==='table'?b.rows.flat():[b.text])assert.ok(rendered.includes(esc(s)),'Missing source text');for(const r of b.links)assert.ok(rendered.includes(esc(r.url)),'Missing source URL');}
assert.deepEqual([...rendered.matchAll(/<li value="(\d+)">/g)].map(m=>Number(m[1])),Array.from({length:10},(_,i)=>i+1));
const supplement=rendered.match(/<div class="source-supplement">([\s\S]*?)<\/div>/)[1];assert.equal((supplement.match(/<a /g)||[]).length,1);assert.ok(supplement.includes(esc(data.applyEntry)));
assert.deepEqual(Array.from(data.projects,p=>p.amount),['100 / 200 / 300','50 / 100','400 / 500 / 600','1000—5000']);
assert.deepEqual(Array.from(data.capitalTiers,t=>[t.grant,t.cash]),[[100,100],[200,300],[300,500]]);
assert.deepEqual(Array.from(data.housingRows,r=>r[2]),['100','50','100','50','200 / 100','100 / 50']);
assert.ok(data.batches[1].end.includes('2026.09.15'));assert.ok(data.batches[1].note.includes('2024年7月1日'));
assert.ok(data.stats[1][3].includes('子集'));assert.ok(rendered.includes('不是项目分期拨付比例'));
assert.ok(rendered.includes('3年期限不表示补贴分三年发放'));
assert.ok(!app.includes('fetch('));assert.ok(!html.includes('https://'));assert.ok(!app.includes('WUJIANG_'));
// Run the exact input calculation independently at the monetary boundaries.
const start=app.indexOf('  function checkCapital('),end=app.indexOf('\n  const cashInput=',start);
assert.ok(start>=0&&end>start);vm.runInContext('const data=window.SND_POLICY;\n'+app.slice(start,end),context);
for(const [value,expected]of [['0',0],['99.99',0],['100',1],['299.99',1],['300',2],['499.99',2],['500',3],['500.01',3]]){
 const result=context.checkCapital(value);assert.ok(result);assert.equal(result.filter(t=>t.met).length,expected);
}
for(const value of ['', '-1','NaN','Infinity','1e2','100.001','100.',' 100','9007199254740991','<script>'])assert.equal(context.checkCapital(value),null,'Should reject '+value);
// A small fixture exercises real DOM event handlers, including print state restoration.
const elements=new Map(),make=(id,extra={})=>{const e={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',addEventListener(n,f){this.handlers[n]=f;},setAttribute(n,v){this.attrs[n]=v;},focus(){this.focused=true;},...extra};if(id)elements.set(id,e);return e;};
for(const id of ids)make(id);elements.get('personal-cash').value='300';
const tabs=data.projects.map((p,i)=>make('tab-'+p.id,{dataset:{tab:p.id},tabIndex:i?-1:0}));
const panels=data.projects.map((p,i)=>make('panel-'+p.id,{hidden:i!==0}));
const blocks=source.blocks.map((b,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true}),make('',{open:false})];
context.document={getElementById(id){assert.ok(elements.has(id),'Unknown element '+id);return elements.get(id);},querySelectorAll(selector){return {'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks]}[selector]||[];}};
const events={};let printed=0;context.window.addEventListener=(n,f)=>events[n]=f;context.window.print=()=>printed++;
vm.runInContext(app,context,{timeout:3000});
assert.equal((elements.get('capital-results').innerHTML.match(/class="met"/g)||[]).length,2);
tabs[3].handlers.click();assert.equal(panels[3].hidden,false);assert.equal(panels[0].hidden,true);assert.equal(tabs[3].attrs['aria-selected'],'true');
const key=k=>({key:k,preventDefault(){}});
tabs[3].handlers.keydown(key('ArrowRight'));assert.equal(tabs[0].attrs['aria-selected'],'true');assert.equal(tabs[0].focused,true);
tabs[0].handlers.keydown(key('ArrowLeft'));assert.equal(tabs[3].attrs['aria-selected'],'true');
tabs[3].handlers.keydown(key('Home'));assert.equal(tabs[0].attrs['aria-selected'],'true');tabs[0].handlers.keydown(key('End'));assert.equal(tabs[3].attrs['aria-selected'],'true');
const cash=elements.get('personal-cash');cash.value='99.99';cash.handlers.input();assert.equal((elements.get('capital-results').innerHTML.match(/class="met"/g)||[]).length,0);
cash.value='500';cash.handlers.input();assert.equal((elements.get('capital-results').innerHTML.match(/class="met"/g)||[]).length,3);
cash.value='-1';cash.handlers.input();assert.equal(elements.get('capital-error').hidden,false);assert.equal(cash.attrs['aria-invalid'],'true');assert.ok(!elements.get('capital-results').innerHTML.includes('class="met"'));
cash.value='100';cash.handlers.input();assert.equal(elements.get('capital-error').hidden,true);assert.equal(cash.attrs['aria-invalid'],'false');
const search=elements.get('source-search');search.value='持股公司';search.handlers.input();assert.ok(blocks.some(b=>b.hidden));assert.ok(blocks.some(b=>!b.hidden));assert.equal(elements.get('source-document').open,true);
search.value='２０２６';search.handlers.input();const normalized=blocks.map(b=>b.hidden);search.value='2026';search.handlers.input();assert.deepEqual(blocks.map(b=>b.hidden),normalized);
const state=blocks.map(b=>b.hidden),panelState=panels.map(p=>p.hidden),detailState=details.map(d=>d.open);
events.beforeprint();events.beforeprint();assert.ok(blocks.every(b=>!b.hidden));assert.ok(panels.every(p=>!p.hidden));assert.ok(details.every(d=>d.open));events.afterprint();
assert.deepEqual(blocks.map(b=>b.hidden),state);assert.deepEqual(panels.map(p=>p.hidden),panelState);assert.deepEqual(details.map(d=>d.open),detailState);
search.value='no-match-example-xyz';search.handlers.input();assert.ok(blocks.every(b=>b.hidden));assert.ok(elements.get('search-status').textContent.includes('找到0个'));
elements.get('clear-search').handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(b=>!b.hidden));assert.equal(search.focused,true);
elements.get('print-button').handlers.click();assert.equal(printed,1);
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
for(const marker of ['@media print','@media(max-width:640px)','prefers-reduced-motion','.capital-layout','.capital-results','.fiscal-bar','.housing-window','.project-panel[hidden]'])assert.ok(css.includes(marker),'Missing CSS '+marker);
// Parse the final rendered output as a sanity check for unclosed containers and invalid nesting.
const voidTags=new Set(['meta','link','input','br','hr','img','wbr','area','base','col','embed','param','source','track']);
const stack=[];
for(const m of rendered.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
 const tag=m[1].toLowerCase(),text=m[0];
 if(text.startsWith('</'))assert.equal(stack.pop(),tag,'Unbalanced HTML at '+tag);
 else if(!voidTags.has(tag)&&!text.endsWith('/>'))stack.push(tag);
}
assert.equal(stack.length,0);
console.log('PASS: JS syntax, actual templates, balanced tags, unique IDs, anchors, ARIA and all local assets.');
console.log('PASS: 90 paragraphs + 12 tables + 13 original hyperlinks; 10 source groups + application entry.');
console.log('PASS: Four funding categories, housing caps, batch dates and data scope assertions.');
console.log('PASS: 8 boundary inputs, 10 invalid inputs, keyboard tabs, live validation, normalized search and print restoration.');
console.log('PASS: CSS balance, responsive/print/reduced-motion rules. Browser layout was not tested.');
