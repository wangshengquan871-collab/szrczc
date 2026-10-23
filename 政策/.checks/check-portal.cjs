const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const workspace = path.resolve(__dirname, '..');
const portal = path.join(workspace, '全市政策', '苏州人才政策');
const manifest = JSON.parse(fs.readFileSync(path.join(portal, 'source-manifest.json'), 'utf8'));
const errors = [], checks = [];
const check = (name, passed) => { checks.push({name, passed: !!passed}); if (!passed) errors.push(name); };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
for (const file of manifest.files) {
  check('Source intact: ' + file.source, sha(path.join(workspace,file.source)) === file.sha256);
  const copied = path.join(portal,file.target);
  if (file.kind === 'policy-html') {
    check('Integrated hash: '+file.target, sha(copied) === file.integratedSha256);
    const original = fs.readFileSync(path.join(workspace,file.source),'utf8').replace(/^\uFEFF/, '');
    const reverted = fs.readFileSync(copied,'utf8')
      .replace(/<!-- szp:shared-head:start -->[\s\S]*?<!-- szp:shared-head:end -->\n/, '')
      .replace('<body class="szp-integrated">','<body>')
      .replace(/\n<!-- szp:shared-navigation:start -->[\s\S]*?<!-- szp:shared-navigation:end -->/, '');
    check('Original HTML recoverable without loss: '+file.target, reverted === original);
  } else check('Copied bytes intact: '+file.target, sha(copied) === file.sha256);
}
const walk = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(item => item.isDirectory() ? walk(path.join(directory,item.name)) : [path.join(directory,item.name)]);
const allFiles = walk(portal);
const htmlFiles = allFiles.filter(file=>file.endsWith('.html') && (file===path.join(portal,'index.html') || file.startsWith(path.join(portal,'pages')+path.sep)));
check('11 HTML documents', htmlFiles.length === 11);
const references = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file,'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value=match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(value)) continue;
    const resolved = path.resolve(path.dirname(file),decodeURIComponent(value.split(/[?#]/)[0]));
    check('Reference within standalone site: '+path.relative(portal,file)+' → '+value, resolved.startsWith(portal+path.sep));
    check('Reference exists: '+value, fs.existsSync(resolved));
    references.push({owner:path.relative(portal,file),value});
  }
}
for (const file of allFiles.filter(file=>/\.(?:js|cjs)$/.test(file))) {
  try { new vm.Script(fs.readFileSync(file,'utf8'),{filename:file}); check('JavaScript syntax: '+path.relative(portal,file), true); }
  catch(error) { check('JavaScript syntax: '+path.relative(portal,file)+' '+error.message, false); }
}
const index = fs.readFileSync(path.join(portal,'index.html'),'utf8');
check('Nine static policy cards', [...index.matchAll(/data-szp-policy="/g)].length===9);
check('Gusu city first', index.indexOf('data-szp-policy="gusu-city"') < index.indexOf('data-szp-policy="wuzhong"'));
const navigation = fs.readFileSync(path.join(portal,'js','navigation.js'),'utf8');
const mapped = [...navigation.matchAll(/id: '([^']+)', name: '[^']+', file: '([^']+)'/g)];
check('Nine centralized route entries',mapped.length===9);
for (const match of mapped) {
  const expected='href="pages/'+match[2]+'" data-szp-policy="'+match[1]+'"';
  check('Static card mapping: '+match[1],index.includes(expected));
}
const comparisonHtml=fs.readFileSync(path.join(portal,'pages','政策对比.html'),'utf8');
check('Original comparison app preserved',comparisonHtml.includes('政策对比资源/app.js'));
check('Dual bar rendering retained',fs.readFileSync(path.join(portal,'pages','政策对比资源','app.js'),'utf8').includes('bar-min'));
const report={date:new Date().toISOString(),sourceFiles:manifest.files.length,htmlDocuments:htmlFiles.length,localReferences:references.length,checks:checks.length,failed:errors};
fs.writeFileSync(path.join(__dirname,'portal-static-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length) process.exitCode=1;
