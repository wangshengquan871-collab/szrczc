const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'全市政策','政策对比资源'),ctx=vm.createContext({window:{}});
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
for(const file of ['workbook-data.js','policy-data.js','model.js','app.js']){new vm.Script(read(file),{filename:file});if(file!=='app.js')vm.runInContext(read(file),ctx);}
const data=ctx.window.SUZHOU_COMPARE,book=ctx.window.SUZHOU_WORKBOOK,model=ctx.window.SUZHOU_MODEL;
assert.equal(data.regions.length,8);assert.equal(data.amounts.length,52);assert.equal(book.sheets.length,8);assert.equal(book.cellCount,2844);assert.equal(book.formulaCount,355);
assert.equal(new Set(data.amounts.map(a=>a.id)).size,52);assert.ok(data.regions.every(r=>r.cash===100));
const get=(name,addr)=>book.sheets.find(s=>s.name===name).rows.flatMap(r=>r.cells).find(c=>c.address===addr);
for(const a of data.amounts){const row=a.sourceRow;for(const [col,key]of [['A','id'],['C','category'],['D','subtype'],['G','tiers'],['H','nature'],['I','boundary'],['J','document'],['K','block']])assert.equal(a[key],get('政策金额数据',col+row).display);assert.equal(a.min,get('政策金额数据','E'+row)?.value??null);assert.equal(a.max,get('政策金额数据','F'+row)?.value??null);}
const ids=id=>Array.from(model.ranked(id),a=>a.id);
assert.deepEqual(ids('startup'),['P02','P08','P01','P05','P06','P07','P04']);
assert.deepEqual(ids('innovation'),['P10','P09','P14','P16','P15','P12']);
assert.deepEqual(ids('team'),['P22','P24','P17','P20','P23']);
assert.deepEqual(ids('housing'),['P28','P26','P30','P32','P27','P29','P31']);
assert.equal(model.record('P03').max,null);assert.equal(model.record('P02').min,null);assert.equal(model.record('P10').max,0);assert.equal(model.record('P10').min,0);
assert.equal(model.record('P13').nature,'综合补贴');assert.equal(model.record('P34').nature,'综合扶持');assert.equal(model.record('P42').max,5000);
assert.deepEqual(Array.from(model.separate('innovation'),a=>a.id),['P13']);assert.deepEqual(Array.from(model.separate('team'),a=>a.id),['P21','P42']);assert.deepEqual(Array.from(model.separate('housing'),a=>a.id),['P25']);
assert.equal(model.region('changshu').support.loanValue,null);assert.equal(model.region('gusu').file,'姑苏区.html');assert.ok(model.region('snd').payout.boundary.includes('绝非首尾款70/30'));
let selected=[];for(const id of ['kunshan','wuzhong','gusu','changshu']){const result=model.select(selected,id);assert.equal(result.rejected,false);selected=Array.from(result.ids);}
assert.deepEqual(selected,['wuzhong','gusu','changshu','kunshan']);assert.equal(model.select(selected,'snd').rejected,true);
selected=Array.from(model.select(selected,'kunshan').ids);selected=Array.from(model.select(selected,'snd').ids);assert.deepEqual(selected,['wuzhong','gusu','changshu','snd']);
assert.equal(model.select(selected,'unknown').rejected,true);assert.equal(model.search('no-match-example-xyz').length,0);
assert.deepEqual(Array.from(model.search('Ｐ０４'),r=>r.sheet.name+':'+r.row.index),Array.from(model.search('P04'),r=>r.sheet.name+':'+r.row.index));assert.ok(model.search('７：３').length>0);
assert.equal(get('兑现与现金流','B21').display,'50%');assert.equal(get('兑现与现金流','C23').display,'100%');
let rendered;const done=new Error('rendered'),page={};Object.defineProperty(page,'innerHTML',{set(value){rendered=value;throw done;}});ctx.document={getElementById(id){assert.equal(id,'page-content');return page;}};
try{vm.runInContext(read('app.js'),ctx,{timeout:10000});}catch(e){if(e!==done)throw e;}assert.ok(rendered);
const shell=fs.readFileSync(path.join(root,'全市政策','政策对比.html'),'utf8'),complete=shell.replace('<div id="page-content"></div>',`<div id="page-content">${rendered}</div>`);
const allIds=[...complete.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(allIds.length,new Set(allIds).size);
for(const [,id]of complete.matchAll(/href="#([^"]+)"/g))assert.ok(allIds.includes(id),'Missing anchor '+id);
for(const [,attr,targets]of complete.matchAll(/\b(aria-controls|aria-labelledby|aria-describedby)="([^"]+)"/g))for(const id of targets.split(/\s+/))assert.ok(allIds.includes(id),`Missing ${attr} ${id}`);
for(const [,asset]of complete.matchAll(/(?:src|href)="([^"?#]+)"/g)){if(/^https?:|^tel:/.test(asset))continue;assert.ok(fs.existsSync(path.resolve(root,'全市政策',asset)),'Missing local asset '+asset);}
for(const [,sheet,address]of rendered.matchAll(/data-source-sheet="([^"]+)" data-source-cell="([^"]+)"/g))assert.ok(get(sheet,address),'Missing citation target '+sheet+'!'+address);
assert.equal((rendered.match(/class="rank-row"/g)||[]).length,7);assert.equal((rendered.match(/class="region-choice"/g)||[]).length,8);assert.equal((rendered.match(/class="select-small"/g)||[]).length,8);
assert.ok(rendered.includes('0／4'));assert.ok(rendered.includes('2025房票说明'));assert.ok(rendered.includes('区级计划 · 非市级姑苏'));
assert.ok(!read('app.js').includes('fetch('));assert.ok(!shell.includes('https://'));
const voids=new Set(['img','input','br','hr','meta','link','area','base','col','embed','param','source','track','wbr']),stack=[];
for(const m of rendered.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){const tag=m[1].toLowerCase();if(m[0].startsWith('</'))assert.equal(stack.pop(),tag,'HTML nesting mismatch');else if(!voids.has(tag)&&!m[0].endsWith('/>'))stack.push(tag);}assert.equal(stack.length,0);
const css=read('styles.css');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);for(const text of ['@media print','@media(max-width:900px)','@media(max-width:640px)','prefers-reduced-motion','.comparison-scroll','.sheet-scroll'])assert.ok(css.includes(text));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'.checks','comparison-baseline.json'),'utf8')),crypto=require('node:crypto');for(const record of baseline)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(record.path)).digest('hex').toUpperCase(),record.hash,'Existing file changed '+record.path);
console.log('PASS: 8 regions, 52 amounts, 8 worksheets, 2844 source cells and 355 formula snapshots.');
console.log('PASS: Every amount matches its Excel cell; missing/zero/upper-only values, monetary nature and ranking exclusions.');
console.log('PASS: Stable rankings across all 4 views, 2-4 selection model, normalized cross-sheet search, percentage display.');
console.log('PASS: Actual initial HTML, balanced tags, IDs, anchors, ARIA, every local asset and cell citation.');
console.log('PASS: CSS structural checks and hashes of existing region pages/resources and source Excel.');
