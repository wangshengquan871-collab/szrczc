const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../全市政策/苏州人才政策');
for(const name of ['姑苏领军','东吴','姑苏区','常熟','昆山','金鸡湖','高新区','吴江','相城']){
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'pages',name+'资源','policy-data.js'),'utf8'),context);
 const data=Object.values(context.window)[0];
 console.log(JSON.stringify({name,global:Object.keys(context.window),keys:Object.keys(data),basis:data.basis,cutoff:data.cutoff,scope:data.scope,dateNote:data.dateNote,meta:data.meta,projects:(data.projects||data.routes||[]).map(p=>({id:p.id,title:p.title||p.name,tag:p.tag})),categories:data.categories},null,0));
}
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'pages/政策对比资源/policy-data.js'),'utf8'),ctx);
const d=ctx.window.SUZHOU_COMPARE;console.log(JSON.stringify({records:d.amounts.length,views:d.views,recordsPreview:d.amounts.slice(0,32).map(r=>({id:r.id,regionId:r.regionId,min:r.min,max:r.max,tiers:r.tiers,nature:r.nature,sourceRow:r.sourceRow,keys:Object.keys(r)}))},null,0));
