// Offline validation of real templates and event handlers. No browser layout emulation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),htmlDir=path.join(root,'全市政策'),dir=path.join(htmlDir,'相城资源');
const html=fs.readFileSync(path.join(htmlDir,'相城.html'),'utf8');
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
assert.ok(rendered,'template did not render');
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
assert.ok(!/\b(?:onclick|oninput|onchange)=/.test(complete),'inline event handlers');
const source=context.window.XIANGCHENG_SOURCE,data=context.window.XIANGCHENG_POLICY;
assert.equal(source.blocks.length,113);assert.equal(source.blocks.filter(block=>block.type==='paragraph').length,106);
assert.equal(source.blocks.filter(block=>block.type==='table').length,7);assert.equal(source.blocks.flatMap(block=>block.links).length,17);
assert.equal((rendered.match(/class="source-block"/g)||[]).length,113);
assert.equal((rendered.match(/role="tabpanel"/g)||[]).length,4);
assert.deepEqual([...rendered.matchAll(/<li value="(\d+)"/g)].map(match=>Number(match[1])),[1,2,3,4,5,6,7,8,9,10],'reference numbering differs from Word');
const supplement=rendered.match(/<div class="source-supplement">(.*?)<\/div>/s);
assert.ok(supplement,'supplemental official links missing');
assert.equal((supplement[1].match(/<a /g)||[]).length,3,'expected three supplemental official links');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
for(const block of source.blocks){
 for(const value of block.type==='table'?block.rows.flat():[block.text])assert.ok(rendered.includes(escape(value)),'missing source text');
 for(const reference of block.links)assert.ok(rendered.includes(escape(reference.url)),'missing source URL');
}
for(const candidate of data.candidates){
 assert.equal(candidate.counts.reduce((sum,n)=>sum+n,0),candidate.total,'chart category counts differ');
 assert.equal(candidate.counts.length,data.candidateCategories.length);
 assert.ok(candidate.counts.every(n=>Number.isInteger(n)&&n>=0));
}
for(const rent of data.rent)assert.ok(rent.area>0&&rent.area<=500,'rent chart outside scale');
// Validate actual pure calculator in isolation against precise monetary expectations.
const start=app.indexOf('  function calculateCash('),end=app.indexOf('\n  const categoryInput=',start);
assert.ok(start>=0&&end>start);context.data=data;vm.runInContext(app.slice(start,end),context);
const valid=[['team-leader','150',1500000,750000],['team-member','100',1000000,500000],['startup','100',1000000,500000],['innovation','100',1000000,500000],['youth','50',500000,250000],['startup','37.33',373300,186650],['startup','0.01',100,50],['startup','1.50',15000,7500]];
for(const [category,amount,totalYuan,eachYuan]of valid){
 assert.deepEqual(JSON.parse(JSON.stringify(context.calculateCash(category,amount))),{category,cap:data.cashCategories.find(c=>c.id===category).cap,totalYuan,firstYuan:eachYuan,secondYuan:eachYuan});
}
const invalid=[['missing','100'],['','100'],['team-leader','150.01'],['team-member','100.01'],['startup','100.01'],['innovation','100.01'],['youth','50.01'],['startup','-1'],['startup','0'],['startup',''],['startup','100.001'],['startup','0.001'],['startup','1e2'],['startup','NaN'],['startup','Infinity'],['startup','1,000'],['startup',' 100'],['startup','100 '],['startup','.50'],['startup','1.'],['startup',null],['startup',undefined],['startup',NaN]];
for(const [category,amount]of invalid)assert.equal(context.calculateCash(category,amount),null,'accepted invalid cash input '+category+'/'+amount);
// Execute the complete application against a DOM fixture to exercise real handlers.
const elements=new Map(),make=(id,extra={})=>{
 const element={id,hidden:false,open:false,dataset:{},attrs:{},handlers:{},value:'',
  addEventListener(name,handler){this.handlers[name]=handler;},setAttribute(name,value){this.attrs[name]=value;},focus(){this.focused=true;},...extra};
 if(id)elements.set(id,element);return element;
};
for(const id of ids)make(id);
elements.get('cash-category').value='startup';elements.get('approved-cash').value='100';
const tabs=data.projects.map((project,i)=>make('tab-'+project.id,{dataset:{tab:project.id},tabIndex:i?-1:0}));
const panels=data.projects.map((project,i)=>make('panel-'+project.id,{hidden:i!==0}));
const blocks=source.blocks.map((block,i)=>make('',{dataset:{sourceIndex:String(i)}}));
const details=[elements.get('source-document'),make('',{open:true}),make('',{open:false})];
context.document={getElementById(id){assert.ok(elements.has(id),'unknown element '+id);return elements.get(id);},querySelectorAll(selector){
 const result={'[data-tab]':tabs,'.project-panel':panels,'[data-source-index]':blocks,'details':details,'.project-panel,.source-block':[...panels,...blocks]}[selector];
 assert.ok(result,'unhandled fixture selector '+selector);return result;
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
const categoryInput=elements.get('cash-category'),cashInput=elements.get('approved-cash'),output=elements.get('cash-results'),cashError=elements.get('cash-error');
assert.equal(cashInput.max,'100');assert.ok(output.innerHTML.includes('<strong>50<small>'));
cashInput.value='0.01';cashInput.handlers.input();assert.ok(output.innerHTML.includes('<strong>0.005<small>'),'half of 0.01万 rounded incorrectly');assert.equal(cashError.hidden,true);
cashInput.value='37.33';cashInput.handlers.input();assert.ok(output.innerHTML.includes('<strong>18.665<small>'));
categoryInput.value='team-leader';cashInput.value='150';categoryInput.handlers.change();assert.equal(cashInput.max,'150');assert.ok(output.innerHTML.includes('<strong>75<small>'));
categoryInput.value='youth';categoryInput.handlers.change();assert.equal(cashInput.max,'50');assert.equal(cashError.hidden,false);assert.equal(cashInput.attrs['aria-invalid'],'true');assert.equal(output.innerHTML,'');
cashInput.value='50';cashInput.handlers.input();assert.equal(cashError.hidden,true);assert.equal(cashInput.attrs['aria-invalid'],'false');assert.ok(output.innerHTML.includes('<strong>25<small>'));
cashInput.value='100.001';cashInput.handlers.input();assert.equal(cashError.hidden,false);assert.equal(output.innerHTML,'');
categoryInput.value='missing';categoryInput.handlers.change();assert.equal(cashInput.max,'0');assert.ok(cashError.textContent.includes('请选择有效人才类别'));
const search=elements.get('source-search'),clear=elements.get('clear-search'),status=elements.get('search-status');
search.value='房票';search.handlers.input();assert.ok(blocks.some(block=>block.hidden));assert.ok(blocks.some(block=>!block.hidden));assert.equal(elements.get('source-document').open,true);assert.equal(clear.hidden,false);
const before=blocks.map(block=>block.hidden),panelBefore=panels.map(panel=>panel.hidden),detailBefore=details.map(detail=>detail.open);
events.beforeprint();assert.ok(blocks.every(block=>!block.hidden));assert.ok(panels.every(panel=>!panel.hidden));assert.ok(details.every(detail=>detail.open));events.beforeprint();events.afterprint();
assert.deepEqual(blocks.map(block=>block.hidden),before);assert.deepEqual(panels.map(panel=>panel.hidden),panelBefore);assert.deepEqual(details.map(detail=>detail.open),detailBefore);events.afterprint();
assert.deepEqual(blocks.map(block=>block.hidden),before);
search.value='no-such-match-xyz';search.handlers.input();assert.ok(blocks.every(block=>block.hidden));assert.ok(status.textContent.includes('找到0个'));
clear.handlers.click();assert.equal(search.value,'');assert.ok(blocks.every(block=>!block.hidden));assert.equal(clear.hidden,true);assert.equal(search.focused,true);assert.ok(status.textContent.includes('113'));
search.value='   ';search.handlers.input();assert.ok(blocks.every(block=>!block.hidden));assert.ok(status.textContent.includes('113'));
search.value='５０';search.handlers.input();assert.ok(blocks.some(block=>!block.hidden));assert.ok(status.textContent.includes('匹配'));
const normalizedMatches=source.blocks.map(block=>(block.type==='table'?block.rows.flat().join(' '):block.text).normalize('NFKC').toLocaleLowerCase('zh-CN').includes('50'));
assert.deepEqual(blocks.map(block=>!block.hidden),normalizedMatches);
search.value='ＶＩＰ';search.handlers.input();assert.ok(blocks.some(block=>!block.hidden));
elements.get('print-button').handlers.click();assert.equal(printCalls,1);
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'CSS delimiter balance');
assert.ok(/@media\s+print/.test(css));assert.ok(/@media\s*\(max-width:\s*640px\)/.test(css));assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: JS syntax and actual templates; unique IDs, anchors, ARIA targets and all local assets.');
console.log('PASS: 106 paragraphs + 7 tables + 17 original links rendered; 10 numbered sources + 3 supplemental official links.');
console.log('PASS: 8 valid cash cases including 5 category caps and exact 0.01万 split; 23 invalid inputs and chart totals/scales.');
console.log('PASS: real tab click/keyboard handlers; cash input/category changes/errors, search/NFKC/no-results/clear, repeat print restoration.');
console.log('PASS: CSS delimiter balance, responsive and print rules. Browser layout was not tested.');
