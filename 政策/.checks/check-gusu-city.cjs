// Offline checks of real templates and interaction handlers; no browser layout emulation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),htmlDir=path.join(root,'全市政策'),dir=path.join(htmlDir,'姑苏领军资源');
const html=fs.readFileSync(path.join(htmlDir,'姑苏领军.html'),'utf8');
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const context=vm.createContext({window:{}});
for(const file of ['policy-data.js','source-data.js','app.js']){
 const code=fs.readFileSync(path.join(dir,file),'utf8');new vm.Script(code,{filename:file});
 if(file!=='app.js')vm.runInContext(code,context);
}
let rendered;const stop=new Error('rendered');const page={};
Object.defineProperty(page,'innerHTML',{set(value){rendered=value;throw stop;}});
context.document={getElementById(id){assert.equal(id,'page-content');return page;}};
try{vm.runInContext(app,context,{timeout:3000});}catch(error){if(error!==stop)throw error;}
assert.ok(rendered);
const complete=html.replace('<div id="page-content"></div>',`<div id="page-content">${rendered}</div>`);
const ids=[...complete.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'duplicate IDs');
for(const [,id]of complete.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),'missing anchor '+id);
for(const [,targets]of complete.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)){
 for(const id of targets.split(/\s+/))assert.ok(ids.includes(id),'missing ARIA target '+id);
}
for(const [,asset]of complete.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(!/^(?:https?:|#)/.test(asset))assert.ok(fs.existsSync(path.resolve(htmlDir,asset)),'missing local asset '+asset);
}
assert.equal((html.match(/<script defer /g)||[]).length,3);
assert.ok(!/<style\b/.test(html),'HTML embeds styles');
const source=context.window.GUSU_CITY_SOURCE,data=context.window.GUSU_CITY_POLICY;
assert.equal(source.blocks.length,132);assert.equal(source.blocks.filter(block=>block.type==='paragraph').length,123);
assert.equal(source.blocks.filter(block=>block.type==='table').length,9);assert.equal(source.blocks.flatMap(block=>block.links).length,18);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,132);
assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,4);
assert.deepEqual([...rendered.matchAll(/<li value="(\d+)"/g)].map(match=>Number(match[1])),[1,2,3,4,5,6,7,7,8,9,10,11,12,13,14,15,16,17],'reference numbering differs from Word');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
for(const block of source.blocks){
 for(const value of block.type==='table'?block.rows.flat():[block.text])assert.ok(rendered.includes(escape(value)),'missing source text');
 for(const reference of block.links)assert.ok(rendered.includes(escape(reference.url)),'missing source URL');
}
for(const split of data.splits){assert.equal(split.city+split.local,100);assert.ok(split.city>0&&split.local>0);}
for(const year of data.annual)assert.ok(year.added>0&&year.added<=400,'chart outside scale');
const start=app.indexOf('  function housingProjection('),end=app.indexOf('\n  const yearInput=',start);
assert.ok(start>=0&&end>start);vm.runInContext(app.slice(start,end),context);
for(const [year,amount,payment,approved]of [
 ['2026','100',2027,100],['2025','200',2026,200],['1900','0.01',1901,.01],['9998','100.25',9999,100.25],['2024','1.50',2025,1.5]
])assert.deepEqual(JSON.parse(JSON.stringify(context.housingProjection(year,amount))),{purchaseYear:Number(year),paymentYear:payment,approvedAmount:approved});
const invalid=[['','100'],['bad','100'],['1899','100'],['9999','100'],['0000','100'],['2026.0','100'],['2026.5','100'],[' 2026','100'],['2026',''],['2026','0'],['2026','-1'],['2026','200.01'],['2026','100.001'],['2026','1e2'],['2026','NaN'],['2026','Infinity'],['2026','1,000'],['2026',' 100']];
for(const [year,amount]of invalid)assert.equal(context.housingProjection(year,amount),null,'accepted invalid input '+year+'/'+amount);
// Execute the complete application and actual event handlers with a small DOM fixture.
const elements=new Map(),make=(id,extra={})=>{
 const element={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',
  addEventListener(name,handler){this.handlers[name]=handler;},setAttribute(name,value){this.attrs[name]=value;},focus(){this.focused=true;},...extra};
 if(id)elements.set(id,element);return element;
};
for(const id of ids)make(id);
elements.get('purchase-year').value='2026';elements.get('approved-amount').value='100';
const tabs=data.projects.map((project,i)=>make('tab-'+project.id,{dataset:{tab:project.id},tabIndex:i?-1:0}));
const panels=data.projects.map((project,i)=>make('panel-'+project.id,{hidden:i!==0}));
const blocks=source.blocks.map((block,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true}),make('',{open:false})];
context.document={getElementById(id){assert.ok(elements.has(id),'unknown element '+id);return elements.get(id);},querySelectorAll(selector){
 return {'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks]}[selector]||[];
}};
const events={};let printCalls=0;context.window.addEventListener=(name,handler)=>{events[name]=handler;};context.window.print=()=>{printCalls++;};
vm.runInContext(app,context,{timeout:3000});
const selected=index=>{
 tabs.forEach((tab,i)=>{assert.equal(tab.attrs['aria-selected'],String(i===index));assert.equal(tab.tabIndex,i===index?0:-1);});
 panels.forEach((panel,i)=>assert.equal(panel.hidden,i!==index));
};
tabs[3].handlers.click();selected(3);
for(const [from,key,to]of [[3,'ArrowRight',0],[0,'ArrowLeft',3],[3,'Home',0],[0,'End',3],[1,'ArrowRight',2]]){
 let prevented=false;tabs[from].handlers.keydown({key,preventDefault(){prevented=true;}});assert.ok(prevented);selected(to);assert.equal(tabs[to].focused,true);
}
let prevented=false;tabs[2].handlers.keydown({key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,false);selected(2);
const yearInput=elements.get('purchase-year'),amountInput=elements.get('approved-amount'),output=elements.get('housing-results');
assert.ok(output.innerHTML.includes('2027'));assert.ok(output.innerHTML.includes('<b>100</b>'));
yearInput.value='2025';amountInput.value='200';amountInput.handlers.input();assert.ok(output.innerHTML.includes('2026'));assert.ok(output.innerHTML.includes('<b>200</b>'));
amountInput.value='100.001';amountInput.handlers.input();assert.equal(elements.get('housing-error').hidden,false);assert.equal(output.innerHTML,'');assert.equal(amountInput.attrs['aria-invalid'],'true');
amountInput.value='100.25';yearInput.handlers.input();assert.equal(elements.get('housing-error').hidden,true);assert.ok(output.innerHTML.includes('<b>100.25</b>'));assert.equal(yearInput.attrs['aria-invalid'],'false');
const search=elements.get('source-search'),clear=elements.get('clear-search'),status=elements.get('search-status');
search.value='海外';search.handlers.input();assert.ok(blocks.some(block=>block.hidden));assert.ok(blocks.some(block=>!block.hidden));assert.equal(elements.get('source-document').open,true);assert.equal(clear.hidden,false);
const before=blocks.map(block=>block.hidden),panelBefore=panels.map(panel=>panel.hidden),detailBefore=details.map(detail=>detail.open);
events.beforeprint();assert.ok(blocks.every(block=>!block.hidden));assert.ok(panels.every(panel=>!panel.hidden));assert.ok(details.every(detail=>detail.open));events.beforeprint();events.afterprint();
assert.deepEqual(blocks.map(block=>block.hidden),before);assert.deepEqual(panels.map(panel=>panel.hidden),panelBefore);assert.deepEqual(details.map(detail=>detail.open),detailBefore);events.afterprint();
search.value='no-such-match-xyz';search.handlers.input();assert.ok(blocks.every(block=>block.hidden));assert.ok(status.textContent.includes('找到0个'));
clear.handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(block=>!block.hidden));assert.equal(clear.hidden,true);assert.equal(search.focused,true);assert.ok(status.textContent.includes('132'));
search.value='   ';search.handlers.input();assert.ok(blocks.every(block=>!block.hidden));
search.value='３５３';search.handlers.input();assert.ok(blocks.some(block=>!block.hidden));assert.ok(status.textContent.includes('匹配'));
elements.get('print-button').handlers.click();assert.equal(printCalls,1);
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'CSS delimiter balance');
assert.ok(/@media\s+print/.test(css));assert.ok(/@media\s*\(max-width:\s*640px\)/.test(css));assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: JS syntax and actual templates; unique IDs, anchors, ARIA targets and all local assets.');
console.log('PASS: 123 paragraphs + 9 tables + 18 original links rendered; separate data, styles and interaction.');
console.log('PASS: 5 housing cases and 18 invalid inputs; fiscal shares and annual chart scale.');
console.log('PASS: real tab click and keyboard handlers; housing updates, search/no-results/clear/NFKC, print restoration and print command.');
console.log('PASS: CSS delimiter balance, responsive and print rules. Browser layout was not tested.');
