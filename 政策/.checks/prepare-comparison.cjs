const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'全市政策','政策对比资源'),context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(folder,'workbook-data.js'),'utf8'),context);
const book=context.window.SUZHOU_WORKBOOK;
function sheet(name){const s=book.sheets.find(s=>s.name===name);assert.ok(s,name);return s;}
function cell(name,address){for(const row of sheet(name).rows){const c=row.cells.find(c=>c.address===address);if(c)return c;}return null;}
const value=(name,address)=>cell(name,address)?.value??null,text=(name,address)=>cell(name,address)?.display??'';
const regionDefs=[['wuzhong','吴中（东吴）','吴中','东吴.html'],['gusu','姑苏区（区级）','姑苏区','姑苏区.html'],['changshu','常熟（昆承）','常熟','常熟.html'],['kunshan','昆山','昆山','昆山.html'],['sip','工业园区（金鸡湖）','园区','金鸡湖.html'],['snd','高新区','高新区','高新区.html'],['wujiang','吴江','吴江','吴江.html'],['xiangcheng','相城','相城','相城.html']];
const regions=regionDefs.map(([id,name,short,file],i)=>{
 const row=i+6;
 for(const s of ['总览与理性分析','兑现与现金流','申报条件与流程','配套与住房'])assert.equal(text(s,'A'+row),name,s+' row order');
 const collect=(s,columns)=>Object.fromEntries(Object.entries(columns).map(([key,col])=>[key,text(s,col+row)]));
 return {id,name,short,file,order:i,overview:collect('总览与理性分析',{startup:'B',housing:'C',payout:'D',note:'E'}),cash:value('申报条件与流程','D'+row),requirements:collect('申报条件与流程',{degree:'B',experience:'C',equity:'E',capital:'F',local:'G',innovation:'H',team:'I',window:'J',process:'K',entry:'L',ref:'M'}),payout:collect('兑现与现金流',{type:'B',ratio:'C',trigger:'D',boundary:'E',housing:'F',housingCondition:'G',overlap:'H',ref:'I'}),support:{...collect('配套与住房',{office:'B',years:'C',loan:'D',equity:'E',interest:'F',overlap:'G',services:'H',note:'I',ref:'J'}),officeValue:value('配套与住房','B'+row),loanValue:value('配套与住房','D'+row),equityValue:value('配套与住房','E'+row),interestValue:value('配套与住房','F'+row)},row};
});
const amounts=sheet('政策金额数据').rows.filter(r=>/^P\d+$/.test(r.cells.find(c=>c.column==='A')?.display||'')).map(row=>{
 const get=col=>row.cells.find(c=>c.column===col);const region=regions.find(r=>r.name===get('B').display);assert.ok(region);
 return {id:get('A').display,regionId:region.id,category:get('C').display,subtype:get('D').display,min:get('E')?.value??null,max:get('F')?.value??null,tiers:get('G')?.display??'',nature:get('H')?.display??'',boundary:get('I')?.display??'',document:get('J')?.display??'',block:get('K')?.display??'',sourceRow:row.index};
});assert.equal(amounts.length,52);
const issues=sheet('总览与理性分析').rows.filter(r=>r.index>=43&&r.index<=54).map(r=>({title:text('总览与理性分析','A'+r.index),problem:text('总览与理性分析','B'+r.index),handling:text('总览与理性分析','C'+r.index),needed:text('总览与理性分析','D'+r.index),ref:text('总览与理性分析','E'+r.index),sourceRow:r.index}));
const history=sheet('历史数据与边界').rows.filter(r=>r.index>=6&&r.index<=30&&text('历史数据与边界','A'+r.index)).map(r=>({region:text('历史数据与边界','A'+r.index),year:text('历史数据与边界','B'+r.index),batch:text('历史数据与边界','C'+r.index),status:text('历史数据与边界','D'+r.index),count:text('历史数据与边界','E'+r.index),denominator:text('历史数据与边界','F'+r.index),unit:text('历史数据与边界','G'+r.index),scope:text('历史数据与边界','H'+r.index),evidence:text('历史数据与边界','I'+r.index),ref:text('历史数据与边界','J'+r.index),boundary:text('历史数据与边界','K'+r.index),sourceRow:r.index}));
const index=sheet('原文与来源索引').rows.filter(r=>r.index>=6&&text('原文与来源索引','A'+r.index)).map(r=>({kind:text('原文与来源索引','A'+r.index),region:text('原文与来源索引','B'+r.index),file:text('原文与来源索引','C'+r.index),label:text('原文与来源索引','D'+r.index),content:text('原文与来源索引','E'+r.index),note:text('原文与来源索引','F'+r.index),sourceRow:r.index}));
const data={asOf:book.asOf,sourceFile:book.fileName,regions,amounts,issues,history,index,views:[
 {id:'startup',title:'常规创业',subtitle:'普通创业项目；特殊上浮、重大、成长和待落户综合扶持单列。',ids:['P01','P02','P03','P04','P05','P06','P07','P08'],separate:[]},
 {id:'innovation',title:'个人创新',subtitle:'项目经费与综合补贴分开；姑苏区明确无项目经费的0值保留。',ids:['P09','P10','P11','P12','P14','P15','P16'],separate:['P13']},
 {id:'team',title:'常规团队',subtitle:'独立团队类别；园区重大创业与高新区顶尖团队不并入。',ids:['P17','P18','P19','P20','P22','P23','P24'],separate:['P21','P42']},
 {id:'housing',title:'创业住房',subtitle:'购房补贴、房票及安家支持方式不同；保留年份、适用条件与资料边界。',ids:['P26','P27','P28','P29','P30','P31','P32'],separate:['P25']}
]};
fs.writeFileSync(path.join(folder,'policy-data.js'),'/* 内容快照由Excel生成；金额原始编号和行列定位保留。 */\nwindow.SUZHOU_COMPARE = '+JSON.stringify(data,null,2)+';\n','utf8');
console.log(`Prepared ${regions.length} regions, ${amounts.length} amounts, ${issues.length} issue records, ${history.length} history records, ${index.length} source entries.`);
