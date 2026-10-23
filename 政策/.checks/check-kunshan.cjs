// 离线核验真实模板、数据和金额计算；不替代浏览器布局与 DOM 交互检查。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '全市政策', '昆山资源');
const html = fs.readFileSync(path.join(root, '全市政策', '昆山.html'), 'utf8');
const app = fs.readFileSync(path.join(directory, 'app.js'), 'utf8');
const context = vm.createContext({ window: {} });
for (const name of ['policy-data.js', 'source-data.js', 'app.js']) {
  new vm.Script(fs.readFileSync(path.join(directory, name), 'utf8'), { filename: name });
  if (name !== 'app.js') vm.runInContext(fs.readFileSync(path.join(directory, name), 'utf8'), context);
}
let rendered;
const renderedSignal = new Error('Template rendered');
const page = {};
Object.defineProperty(page, 'innerHTML', { set(value) { rendered = value; throw renderedSignal; } });
context.document = { getElementById(id) { assert.equal(id, 'page-content'); return page; } };
try { vm.runInContext(app, context, { timeout: 3000 }); } catch (error) { if (error !== renderedSignal) throw error; }
assert.ok(rendered);
const complete = html.replace('<div id="page-content"></div>', '<div id="page-content">' + rendered + '</div>');
const ids = Array.from(complete.matchAll(/\bid="([^"]+)"/g), match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML IDs');
for (const [, target] of complete.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), 'Missing anchor: ' + target);
for (const [, local] of html.matchAll(/(?:src|href)="(昆山资源\/[^"?#]+)"/g)) assert.ok(fs.existsSync(path.join(root, '全市政策', local)), 'Missing asset: ' + local);
assert.equal((rendered.match(/class="source-block"/g) || []).length, 195);
assert.equal((rendered.match(/role="tabpanel"/g) || []).length, 4);
assert.equal((rendered.match(/class="tier-column/g) || []).length, 5);
assert.ok(rendered.includes('--tier-height:170px'));
assert.ok(rendered.includes('https://kc.kunruyi.cn/'));
assert.ok(!rendered.includes('吴中'));

const elements = new Map();
for (const id of ['grant-amount', 'payment-split', 'payment-results', 'house-price', 'housing-category', 'housing-error', 'housing-results']) {
  assert.ok(ids.includes(id));
  elements.set(id, { value: '', innerHTML: '', hidden: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
}
let mode = 'general';
context.document = { getElementById(id) { assert.ok(elements.has(id), id); return elements.get(id); }, querySelector(selector) { assert.equal(selector, '[name="payment-mode"]:checked'); return { value: mode }; } };
const section = (start, end) => { const a = app.indexOf(start), b = app.indexOf(end, a); assert.ok(a >= 0 && b > a); return app.slice(a, b); };
vm.runInContext('const data = window.KUNSHAN_POLICY;\n' + section('  const money =', "  document.getElementById('grant-amount').addEventListener") + '\n' + section('  function updateHousing()', "  document.getElementById('house-price').addEventListener"), context);
const amounts = id => Array.from(elements.get(id).innerHTML.matchAll(/<strong>([\d,.]+)<small>/g), match => Number(match[1].replace(/,/g, '')));
elements.get('grant-amount').value = '400';
context.updatePayment(); assert.deepEqual(amounts('payment-results'), [200, 200]);
mode = 'major'; context.updatePayment(); assert.deepEqual(amounts('payment-results'), [280, 120]);
elements.get('grant-amount').value = '60'; mode = 'general'; context.updatePayment(); assert.deepEqual(amounts('payment-results'), [30, 30]);
for (const [price, category, expected] of [[200, 'individual', [60, 36]], [80, 'individual', [40, 24]], [200, 'team', [100, 60]], [80, 'team', [40, 24]]]) {
  elements.get('house-price').value = String(price); elements.get('housing-category').value = category;
  context.updateHousing(); assert.deepEqual(amounts('housing-results'), expected);
}
for (const value of ['', '-1', '0']) {
  elements.get('house-price').value = value; context.updateHousing();
  assert.equal(elements.get('housing-results').hidden, true); assert.equal(elements.get('housing-error').hidden, false);
}
const css = fs.readFileSync(path.join(directory, 'styles.css'), 'utf8');
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
assert.ok(css.includes('@media print')); assert.ok(css.includes('@media (max-width:359px)'));
console.log('PASS: JavaScript syntax, template rendering, unique IDs, anchor links and local assets.');
console.log('PASS: 195 source paragraphs, 4 route panels and 5 discrete funding tiers.');
console.log('PASS: 3 funding examples, 4 housing examples and invalid-input handling.');
console.log('PASS: CSS brace balance, responsive rules and print rules.');
