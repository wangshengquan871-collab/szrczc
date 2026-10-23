// Check actual rendering and events without pretending to emulate browser layout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'全市政策','常熟资源');
const html=fs.readFileSync(path.join(root,'全市政策','常熟.html'),'utf8');
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
for(const [,asset]of html.matchAll(/(?:src|href)="(常熟资源\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,'全市政策',asset)),'Missing asset '+asset);
const source=context.window.CHANGSHU_SOURCE,data=context.window.CHANGSHU_POLICY;
assert.ok(fs.existsSync(path.join(root,source.fileName)));
assert.equal(source.blocks.length,91);assert.equal(source.blocks.filter(b=>b.type==='paragraph').length,80);assert.equal(source.blocks.filter(b=>b.type==='table').length,11);assert.equal(source.blocks.flatMap(b=>b.links).length,14);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,91);assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,4);
assert.equal((rendered.match(/<caption>原文表格 /g)||[]).length,11);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const b of source.blocks){for(const s of b.type==='table'?b.rows.flat():[b.text])assert.ok(rendered.includes(esc(s)),'Missing source text');for(const r of b.links)assert.ok(rendered.includes(esc(r.url)),'Missing source URL');}
assert.deepEqual([...rendered.matchAll(/<li value="(\d+)">/g)].map(m=>Number(m[1])),Array.from({length:14},(_,i)=>i+1));
assert.deepEqual(Array.from(data.pendingGrants,g=>g.amount),[160,40]);
assert.ok(data.projects[0].rows.find(r=>r[0]==='企业参保')[1].includes('2名非股东'));
assert.ok(data.projects[0].rows.find(r=>r[0]==='直接持股')[1].includes('30%'));
assert.ok(data.projects[1].metric==='≥36');assert.ok(data.projects[2].rows.find(r=>r[0]==='后续投入')[1].includes('5000万元'));
assert.ok(data.housingFacts[0][2].includes('2025'));assert.ok(data.housingFacts[1][0]==='40%');
assert.ok(rendered.includes('不作为已确认的2026统一标准'));assert.ok(rendered.includes('2020历史条款对照'));
assert.equal(data.distribution.total,86);assert.deepEqual(Array.from(data.distribution.items,i=>i.count),[43,10,24,9]);
assert.equal(data.distribution.items.reduce((s,i)=>s+i.count,0),86);
const chartTable=source.blocks.find(b=>b.type==='table'&&b.rows[0][0]==='公示类别');assert.ok(chartTable);
for(let i=0;i<4;i++){
 assert.equal(data.distribution.items[i].count,Number(chartTable.rows[i+1][1]));
 assert.equal((data.distribution.items[i].count/86*100).toFixed(2)+'%',chartTable.rows[i+1][2]);
}
assert.equal(((24+9)/86*100).toFixed(2),'38.37');
const arcs=[...rendered.matchAll(/data-chart-segment="\d+"[^>]*stroke-dasharray="([^ ]+) ([^"]+)"/g)];assert.equal(arcs.length,4);
assert.ok(Math.abs(arcs.reduce((s,m)=>s+Number(m[1]),0)-100)<1e-9);
for(const a of arcs)assert.ok(Math.abs(Number(a[1])+Number(a[2])-100)<1e-9);
assert.ok(!app.includes('fetch('));assert.ok(!html.includes('https://'));assert.ok(!app.includes('SND_'));
// A small DOM fixture exercises the actual registered listeners.
const elements=new Map(),make=(id,extra={})=>{const e={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',addEventListener(n,f){this.handlers[n]=f;},setAttribute(n,v){this.attrs[n]=v;},focus(){this.focused=true;},...extra};if(id)elements.set(id,e);return e;};
for(const id of ids)make(id);
const tabs=data.projects.map((p,i)=>make('tab-'+p.id,{dataset:{tab:p.id},tabIndex:i?-1:0}));
const panels=data.projects.map((p,i)=>make('panel-'+p.id,{hidden:i!==0}));
const blocks=source.blocks.map((b,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const categories=data.distribution.items.map((item,i)=>make('',{dataset:{category:String(i)}}));
const segments=data.distribution.items.map((item,i)=>make('',{dataset:{chartSegment:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true}),make('',{open:false})];
context.document={getElementById(id){assert.ok(elements.has(id),'Unknown element '+id);return elements.get(id);},querySelectorAll(selector){return {'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks],'[data-category]':categories,'[data-chart-segment]':segments}[selector]||[];}};
const events={};let printed=0;context.window.addEventListener=(n,f)=>events[n]=f;context.window.print=()=>printed++;
vm.runInContext(app,context,{timeout:3000});
assert.ok(elements.get('chart-detail').innerHTML.includes('50.00%'));
for(let i=0;i<4;i++){
 categories[i].handlers.click();assert.equal(categories[i].attrs['aria-pressed'],'true');
 assert.equal(categories.filter(c=>c.attrs['aria-pressed']==='true').length,1);
 assert.equal(segments[i].attrs.opacity,'1');assert.ok(elements.get('chart-detail').innerHTML.includes(chartTable.rows[i+1][2]));
 assert.ok(elements.get('chart-detail').innerHTML.includes('非申报通过率'));
}
tabs[3].handlers.click();assert.equal(panels[3].hidden,false);assert.equal(panels[0].hidden,true);assert.equal(tabs[3].attrs['aria-selected'],'true');
const key=k=>({key:k,preventDefault(){}});
tabs[3].handlers.keydown(key('ArrowRight'));assert.equal(tabs[0].attrs['aria-selected'],'true');assert.equal(tabs[0].focused,true);
tabs[0].handlers.keydown(key('ArrowLeft'));assert.equal(tabs[3].attrs['aria-selected'],'true');
tabs[3].handlers.keydown(key('Home'));assert.equal(tabs[0].attrs['aria-selected'],'true');tabs[0].handlers.keydown(key('End'));assert.equal(tabs[3].attrs['aria-selected'],'true');
const search=elements.get('source-search');search.value='房票';search.handlers.input();assert.ok(blocks.some(b=>b.hidden));assert.ok(blocks.some(b=>!b.hidden));assert.equal(elements.get('source-document').open,true);
search.value='２０２６';search.handlers.input();const normalized=blocks.map(b=>b.hidden);search.value='2026';search.handlers.input();assert.deepEqual(blocks.map(b=>b.hidden),normalized);
const state=blocks.map(b=>b.hidden),panelState=panels.map(p=>p.hidden),detailState=details.map(d=>d.open);
events.beforeprint();events.beforeprint();assert.ok(blocks.every(b=>!b.hidden));assert.ok(panels.every(p=>!p.hidden));assert.ok(details.every(d=>d.open));events.afterprint();
assert.deepEqual(blocks.map(b=>b.hidden),state);assert.deepEqual(panels.map(p=>p.hidden),panelState);assert.deepEqual(details.map(d=>d.open),detailState);
search.value='no-match-example-xyz';search.handlers.input();assert.ok(blocks.every(b=>b.hidden));assert.ok(elements.get('search-status').textContent.includes('找到0个'));
elements.get('clear-search').handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(b=>!b.hidden));assert.equal(search.focused,true);
elements.get('print-button').handlers.click();assert.equal(printed,1);
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
for(const marker of ['@media print','@media(max-width:640px)','prefers-reduced-motion','.distribution-panel','.distribution-legend','.housing-feature','.project-panel[hidden]'])assert.ok(css.includes(marker),'Missing CSS '+marker);
const voidTags=new Set(['meta','link','input','br','hr','img','wbr','area','base','col','embed','param','source','track']),stack=[];
for(const m of rendered.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
 const tag=m[1].toLowerCase(),text=m[0];
 if(text.startsWith('</'))assert.equal(stack.pop(),tag,'Unbalanced HTML at '+tag);
 else if(!voidTags.has(tag)&&!text.endsWith('/>'))stack.push(tag);
}
assert.equal(stack.length,0);
console.log('PASS: JS syntax, actual templates, balanced tags, IDs, anchors, ARIA and local resources.');
console.log('PASS: 80 paragraphs + 11 tables + 14 original hyperlinks; 14 source groups.');
console.log('PASS: Current/historical labels, 86-item chart counts, all four percentages and normalized SVG arcs.');
console.log('PASS: Four category selections, keyboard tabs, normalized source search, no matches, clear and print restoration.');
console.log('PASS: Responsive/print/reduced-motion CSS rules. Browser layout was not tested.');
