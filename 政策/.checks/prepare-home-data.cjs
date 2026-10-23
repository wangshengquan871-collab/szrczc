/* Read-only extraction from existing policy datasets. JSON is the catalog source;
   the generated inline copy supports opening index.html directly with file://. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../全市政策/苏州人才政策');
const definitions=[
 ['gusu-city','姑苏领军','苏州市级',['startup','innovation','team'],['项目经费','人才乐居','人才服务'],'2024办法 · 2026批次', ['scope','projects','funds','housing','services']],
 ['wuzhong','东吴','吴中区',['startup','innovation','team'],['项目经费','住房补贴','研发办公'],'2025办法 · 2026起施行',['documentNumber','period','projects','supportTools','housing']],
 ['gusu','姑苏区','姑苏区',['startup','innovation','growth'],['创业扶持','住房补贴','人才服务'],'2021办法 · 2025通知',['basis','projects','fundingRows','housingRules','services']],
 ['changshu','常熟','常熟市',['startup','innovation','team','special'],['人才房票','重点引才扶持','金融服务'],'2025细则 · 2026批次',['basis','projects','pendingGrants','housingRows','finance']],
 ['kunshan','昆山','昆山市',['startup','innovation','team'],['项目经费','购房补贴','人才服务'],'2026文档口径',['basis','routes','otherPrograms','fundingRows','housing','services']],
 ['sip','金鸡湖','工业园区',['startup','innovation','growth'],['启动资金','创新综合补贴','购房补贴'],'2026批次',['projects','funding','housing']],
 ['snd','高新区','高新区',['startup','innovation','team'],['项目经费','住房支持','金融服务'],'2024办法 · 2026批次',['basis','projects','housingRows','finance']],
 ['wujiang','吴江','吴江区',['startup','innovation','team'],['科研经费','人才房票','人才服务'],'2025办法 · 2026专题',['basis','projects','fundingRows','housingRows','services']],
 ['xiangcheng','相城','相城区',['startup','innovation','team','youth'],['项目资助','安家与房票','研发场地'],'2024办法',['basis','projects','housingRoutes','rent','serviceItems']]
];
const readDataset=file=>{const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);return Object.values(context.window)[0];};
const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
const policies=definitions.map(([id,file,region,categories,supports,sourceYearLabel,fields])=>{
 const sourcePath='pages/'+file+'资源/policy-data.js',data=readDataset(sourcePath),source=readDataset('pages/'+file+'资源/source-data.js');
 const documents=(Array.isArray(source)?source:[source]).map(s=>s.fileName).filter(Boolean);
 const projects=[...(data.projects||data.routes||[]),...(data.otherPrograms||[])];
 if(id==='kunshan'&&projects.some(p=>(p.title||p.name||'').includes('青年')))categories=[...categories,'youth'];
 return {id,regionId:id==='gusu-city'?null:id,file:'pages/'+file+'.html',region,categories,projectLabels:projects.map(p=>p.title||p.name),supports,sourceYearLabel,sourceYears:[...new Set(sourceYearLabel.match(/20\d{2}/g)||[])],snapshotDate:data.cutoff||null,sourceDocuments:documents,sourcePath,sourceFields:fields,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,sourcePath))).digest('hex'),searchText:[region,file,...supports,...strings(data)].join(' ').normalize('NFKC')};
});
const catalog={schemaVersion:1,description:'仅整理现有页面元数据。金额不在此重复维护，首页读取pages/政策对比资源/policy-data.js。来源年份为办法、通知或专题文档年份，非更新时间。',policies};
const json=JSON.stringify(catalog,null,2);
fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data/portal-data.json'),json+'\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const policy of policies){
 const block=`<!-- szp:card-meta:${policy.id}:start --><div class="szp-card-meta"><div class="szp-card-types" aria-label="项目类别">${policy.projectLabels.map(t=>`<span>${esc(t)}</span>`).join('')}</div><dl><div><dt>主要支持</dt><dd>${esc(policy.supports.join(' · '))}</dd></div><div><dt>来源年份</dt><dd>${esc(policy.sourceYearLabel)}</dd></div></dl></div><!-- szp:card-meta:${policy.id}:end -->`;
 const metaRegex=new RegExp('<!-- szp:card-meta:'+policy.id+':start -->[\\s\\S]*?<!-- szp:card-meta:'+policy.id+':end -->');
 if(metaRegex.test(html))html=html.replace(metaRegex,block);
 else{
  const cardRegex=new RegExp('(<a class="szp-policy-card[^\"]*" href="[^\"]*" data-szp-policy="'+policy.id+'">)([\\s\\S]*?)(</a>)');
  html=html.replace(cardRegex,(_,open,body,close)=>{
   const inner=body.replace('<div class="szp-card-bottom">',block+'<div class="szp-card-bottom">');
   const compare=policy.regionId?`<button type="button" class="szp-card-compare" data-szp-add-region="${policy.regionId}" aria-pressed="false" aria-label="将${esc(policy.region)}加入比较篮" hidden>＋ 加入比较</button>`:'<span class="szp-city-basket-note">市级计划单独查阅 · 八地比较不含市级</span>';
   return `<article class="szp-policy-item" data-szp-card="${policy.id}">${open}${inner}${close}<div class="szp-card-actions">${compare}<a href="${esc(policy.file)}#source" aria-label="查阅${esc(policy.region)}的完整原文">核对原文 ↗</a></div></article>`;
  });
 }
}
html=html.replace(/<!-- szp:portal-data:start -->[\s\S]*?<!-- szp:portal-data:end -->/,'<!-- szp:portal-data:start -->\n<script type="application/json" id="szp-portal-data">'+JSON.stringify(catalog).replace(/</g,'\\u003c')+'</script>\n<!-- szp:portal-data:end -->');
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Generated metadata for '+policies.length+' policies; source dataset bytes unchanged.');
