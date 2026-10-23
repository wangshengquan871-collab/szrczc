// 离线核验真实模板、数据与租房计算；不替代浏览器布局和实际 DOM 检查。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '全市政策', '姑苏区资源');
const html = fs.readFileSync(path.join(root, '全市政策', '姑苏区.html'), 'utf8');
const app = fs.readFileSync(path.join(directory, 'app.js'), 'utf8');
const context = vm.createContext({ window: {} });
for (const name of ['policy-data.js', 'source-data.js', 'app.js']) {
  const code = fs.readFileSync(path.join(directory, name), 'utf8');
  new vm.Script(code, { filename: name });
  if (name !== 'app.js') vm.runInContext(code, context);
}
let rendered;
const stop = new Error('Template rendered');
const page = {};
Object.defineProperty(page, 'innerHTML', { set(value) { rendered = value; throw stop; } });
context.document = { getElementById(id) { assert.equal(id, 'page-content'); return page; } };
try { vm.runInContext(app, context, { timeout: 3000 }); } catch (error) { if (error !== stop) throw error; }
assert.ok(rendered);
const complete = html.replace('<div id="page-content"></div>', '<div id="page-content">' + rendered + '</div>');
const ids = Array.from(complete.matchAll(/\bid="([^"]+)"/g), match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs');
for (const [, target] of complete.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), 'Missing anchor: ' + target);
for (const [, file] of html.matchAll(/(?:src|href)="(姑苏区资源\/[^"?#]+)"/g)) assert.ok(fs.existsSync(path.join(root, '全市政策', file)), 'Missing asset: ' + file);
assert.ok(fs.existsSync(path.join(root, '姑苏区领军人才政策.docx')));
assert.equal((rendered.match(/class="source-block"/g) || []).length, 88);
assert.equal((rendered.match(/role="tabpanel"/g) || []).length, 3);
assert.equal((rendered.match(/<caption>原文表格 /g) || []).length, 8);
assert.ok(rendered.includes('未提供统一比例'));
assert.ok(!rendered.includes('昆山'));
assert.ok(!rendered.includes('吴中'));
assert.ok(!rendered.includes('class="payment-split"'));
const data = context.window.GUSU_POLICY;
assert.equal(data.projects[0].grant, 100);
assert.equal(data.projects[1].grant, 50);
assert.equal(data.projects[2].grant, null);
assert.equal(data.projects[2].housing, 50);
assert.equal(data.batches.reduce((sum, item) => sum + item.count, 0), 42);
const start = app.indexOf('  function calculateRent(');
const end = app.indexOf('\n  page.innerHTML = ', start);
assert.ok(start >= 0 && end > start);
vm.runInContext('const data = window.GUSU_POLICY;\n' + app.slice(start, end), context);
for (const [category, months, expectedMonths, expectedYuan] of [
  ['C', 36, 36, 108000], ['B', 36, 36, 180000], ['A', 60, 60, 600000],
  ['D', 36, 36, 54000], ['C', 99, 36, 108000], ['C', 1, 1, 3000]
]) {
  const result = context.calculateRent(category, months);
  assert.equal(result.months, expectedMonths);
  assert.equal(result.totalYuan, expectedYuan);
}
assert.throws(() => context.calculateRent('unknown', 36), /Unknown category/);
const css = fs.readFileSync(path.join(directory, 'styles.css'), 'utf8');
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
assert.ok(css.includes('@media print'));
assert.ok(css.includes('@media (max-width:359px)'));
assert.ok(css.includes('.tab-panel[hidden]'));
console.log('PASS: JavaScript syntax, real template rendering, unique IDs, anchors and local assets.');
console.log('PASS: 80 paragraphs + 8 tables, 3 project panels, correct district grants and 42 known-batch projects.');
console.log('PASS: 6 rent calculations, duration limits and invalid-category handling.');
console.log('PASS: CSS balance, responsive rules and full-text print rules.');
