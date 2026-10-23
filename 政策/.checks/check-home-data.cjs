const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../全市政策/苏州人才政策');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/portal-data.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=JSON.parse(html.match(/<script type="application\/json" id="szp-portal-data">([\s\S]*?)<\/script>/)[1]);
const checks=[];const check=(name,passed)=>{checks.push({name,passed});if(!passed)throw Error(name);};
check('JSON and standalone snapshot identical',JSON.stringify(inline)===JSON.stringify(catalog));
check('Nine distinct policies',new Set(catalog.policies.map(p=>p.id)).size===9);
catalog.policies.forEach(p=>{
 check(p.id+' source exists',fs.existsSync(path.join(root,p.sourcePath)));
 check(p.id+' exact source hash',crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p.sourcePath))).digest('hex')===p.sourceSha256);
 check(p.id+' all project names present',p.projectLabels.length>0&&p.projectLabels.every(t=>typeof t==='string'&&t.length>0));
 check(p.id+' original documents copied',p.sourceDocuments.length>0&&p.sourceDocuments.every(d=>fs.existsSync(path.join(root,d))));
 check(p.id+' no invented year',p.sourceYears.every(year=>p.searchText.includes(year)||p.sourceDocuments.some(d=>d.includes(year))));
});
check('Original hero SVG unchanged',fs.readFileSync(path.join(root,'assets/images/jiangnan-architecture.svg'),'utf8').includes('<title>白墙水院 · 原创江南建筑意象</title>'));
check('Home only imports compact comparison source',html.includes('pages/政策对比资源/policy-data.js')&&!html.includes('workbook-data.js'));
fs.writeFileSync(path.join(__dirname,'home-data-report.json'),JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.passed),policies:catalog.policies.length},null,2));console.log('PASS: '+checks.length+' data provenance checks.');
