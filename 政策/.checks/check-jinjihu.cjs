// Offline validation of actual templates and interaction logic; not a browser layout test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'全市政策','金鸡湖资源');
const html=fs.readFileSync(path.join(root,'全市政策','金鸡湖.html'),'utf8');
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const context=vm.createContext({window:{}});
for(const file of ['policy-data.js','source-data.js','app.js']){
 const code=fs.readFileSync(path.join(dir,file),'utf8');new vm.Script(code,{filename:file});
 if(file!=='app.js')vm.runInContext(code,context);
}
let rendered;const stop=new Error('rendered');const page={};
Object.defineProperty(page,'innerHTML',{set(v){rendered=v;throw stop;}});
context.document={getElementById(id){assert.equal(id,'page-content');return page;}};
try{vm.runInContext(app,context,{timeout:3000});}catch(e){if(e!==stop)throw e;}
assert.ok(rendered);
const complete=html.replace('<div id="page-content"></div>',`<div id="page-content">${rendered}</div>`);
const ids=[...complete.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'duplicate IDs');
for(const [,id]of complete.matchAll(/(?:href="#|aria-controls=")([^"]+)"/g))assert.ok(ids.includes(id),'missing target '+id);
for(const [,asset]of html.matchAll(/(?:src|href)="(金鸡湖资源\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,'全市政策',asset)));
const source=context.window.JINJIHU_SOURCE;
assert.equal(source.blocks.length,95);assert.equal(source.blocks.filter(b=>b.type==='paragraph').length,86);
assert.equal(source.blocks.filter(b=>b.type==='table').length,9);assert.equal(source.blocks.flatMap(b=>b.links).length,13);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,95);
assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,4);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const b of source.blocks){for(const value of b.type==='table'?b.rows.flat():[b.text])assert.ok(rendered.includes(escape(value)),'missing source text');for(const r of b.links)assert.ok(rendered.includes(escape(r.url)));}
assert.ok(!rendered.includes('姑苏区'));assert.ok(!rendered.includes('昆山'));assert.ok(!rendered.includes('东吴'));
const start=app.indexOf('  function applicationDates('),end=app.indexOf('\n  const dateInput=',start);
assert.ok(start>=0&&end>start);vm.runInContext(app.slice(start,end),context);
for(const [input,expected]of [
 ['2026-10-10',['2026-10-10','2027-10-10','2028-10-10']],
 ['2024-02-29',['2024-02-29','2025-02-28','2026-02-28']],
 ['2027-02-28',['2027-02-28','2028-02-28','2029-02-28']],
 ['2026-12-31',['2026-12-31','2027-12-31','2028-12-31']],
 ['2026-01-31',['2026-01-31','2027-01-31','2028-01-31']]
])assert.deepEqual(Array.from(context.applicationDates(input)),expected);
for(const input of ['','2026-02-29','2026-13-01','2026-04-31','0000-01-01','9998-01-01','bad'])assert.equal(context.applicationDates(input),null);
// Execute actual event binding against a tiny DOM fixture; no layout emulation.
const elements=new Map();const make=(id,extra={})=>{const el={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',addEventListener(n,f){this.handlers[n]=f;},setAttribute(n,v){this.attrs[n]=v;},focus(){this.focused=true;},...extra};if(id)elements.set(id,el);return el;};
for(const id of ids)make(id);
elements.get('first-date').value='2026-10-10';
const tabs=context.window.JINJIHU_POLICY.projects.map((p,i)=>make('tab-'+p.id,{dataset:{tab:p.id},tabIndex:i? -1:0}));
const panels=context.window.JINJIHU_POLICY.projects.map((p,i)=>make('panel-'+p.id,{hidden:i!==0}));
const blocks=source.blocks.map((b,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true})];
context.document={getElementById:id=>{assert.ok(elements.has(id),'unknown element '+id);return elements.get(id);},querySelectorAll(selector){return {'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks]}[selector]||[];}};
const events={};context.window.addEventListener=(n,f)=>{events[n]=f;};context.window.print=()=>{};
vm.runInContext(app,context,{timeout:3000});
tabs[3].handlers.click();assert.equal(tabs[3].attrs['aria-selected'],'true');assert.equal(panels[3].hidden,false);assert.equal(panels[0].hidden,true);
tabs[3].handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(tabs[0].attrs['aria-selected'],'true');assert.equal(tabs[0].focused,true);
const input=elements.get('first-date');input.value='2024-02-29';input.handlers.input();assert.ok(elements.get('date-timeline').innerHTML.includes('2025-02-28'));
input.value='';input.handlers.input();assert.equal(elements.get('date-error').hidden,false);assert.equal(elements.get('date-timeline').innerHTML,'');
const search=elements.get('source-search');search.value='省外';search.handlers.input();assert.ok(blocks.some(b=>b.hidden));assert.ok(blocks.some(b=>!b.hidden));assert.equal(elements.get('source-document').open,true);
const before=blocks.map(b=>b.hidden),panelBefore=panels.map(b=>b.hidden),detailBefore=details.map(d=>d.open);
events.beforeprint();assert.ok(blocks.every(b=>!b.hidden));assert.ok(panels.every(p=>!p.hidden));assert.ok(details.every(d=>d.open));events.beforeprint();events.afterprint();
assert.deepEqual(blocks.map(b=>b.hidden),before);assert.deepEqual(panels.map(p=>p.hidden),panelBefore);assert.deepEqual(details.map(d=>d.open),detailBefore);
search.value='no-such-match-xyz';search.handlers.input();assert.ok(blocks.every(b=>b.hidden));assert.ok(elements.get('search-status').textContent.includes('找到0个'));
elements.get('clear-search').handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(b=>!b.hidden));
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);assert.ok(css.includes('@media print'));assert.ok(css.includes('@media(max-width:640px)'));assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: actual templates, unique IDs, anchors and local assets; 86 paragraphs + 9 tables + 13 links.');
console.log('PASS: 5 calendar cases and 7 invalid dates; tab navigation, search, empty results, clearing, print state restoration.');
console.log('PASS: CSS delimiter balance, responsive and print rules. Browser layout was not tested.');
