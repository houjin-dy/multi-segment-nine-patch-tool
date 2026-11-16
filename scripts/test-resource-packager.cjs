// Browser integration test. Usage: node scripts/test-resource-packager.cjs <bundled-node_modules>
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { createServer } = require('node:http');
const { chromium } = createRequire(path.join(process.argv[2], 'package.json'))('playwright');
const C = require('../resource-packager/core.js');
require('../resource-packager/spec.js');
const rules = C.expand(global.RESOURCE_SPEC);
const root = path.resolve(__dirname, '..'), out = path.join(root, '.qa');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) throw Error();
    const content = await fs.readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await fs.mkdir(out, { recursive: true });
  assert.equal(rules.length, 909); assert.equal(new Set(rules.map(r => r.name)).size, 909);
  assert.equal(C.extension('EXAMPLE.9.PNG'), '.9.png');
  assert.equal(C.extension('A.JPEG'), '.jpg');
  assert.equal(C.match('delete_normal_icon.png', rules).name, 'delete_normal_icon');
  assert.equal(C.match('9键7背景常规态.png', rules).name, '9key_7_normal_background_image');
  assert.equal(C.match('删除.png', rules), null);
  assert.equal(C.match('26key_a_normal_foreground_3_image.png', rules).layer, 3);
  const aliases = {
    'a.png': '26key_a_normal_background_image',
    '26键_A_按下.9.png': '26key_a_pressed_background_image',
    '26键a按压态.png': '26key_a_pressed_background_image',
    '7.png': '9key_7_normal_background_image',
    '9键7按下.png': '9key_7_pressed_background_image',
    '删除图标.png': 'delete_normal_icon',
    '删除图标按下.png': 'delete_pressed_icon',
    '空格图标.png': 'space_normal_icon',
    '26键空格背景.png': '26key_space_normal_background_image',
    'a前景.png': '26key_a_normal_foreground_0_image',
    'a前景第2层按下.png': '26key_a_pressed_foreground_1_image',
    '26键_a_前景_常规态_3.png': '26key_a_normal_foreground_3_image',
    '通用字母背景.9.png': 'character_key_normal_background_image',
    '直板键盘背景.png': 'keyboard_normal_background_image',
    '直板键盘背景.mp4': 'keyboard_normal_background_video',
    '9键普通页换行背景.png': '9key_enter_normal_background_image',
    '9键数字页换行背景.png': '9key_number_enter_normal_background_image',
  };
  for (const [alias, name] of Object.entries(aliases)) assert.equal(C.match(alias, rules)?.name, name, alias);
  assert.equal(C.match('空格背景.png', rules), null);
  assert.equal(C.matchCandidates('空格背景.png', rules).length, 4);
  assert.equal(C.match('9键换行背景.png', rules), null);
  assert.equal(C.match('a前景第5层.png', rules), null);
  assert.equal(C.match('随便一张图.png', rules), null);
  // Every displayed/downloaded recommendation must resolve back to exactly that resource.
  for (const rule of rules) for (const ext of rule.extensions) {
    const alias = C.stem(C.friendlyName(rule)) + ext;
    assert.equal(C.match(alias, rules)?.name, rule.name, alias);
  }
  await assert.rejects(() => C.zip([{ path: 'base/x.png', bytes: new Uint8Array() }, { path: 'base/x.png', bytes: new Uint8Array() }]), /重名/);
  await assert.rejects(() => C.zip([{ path: 'base/../x', bytes: new Uint8Array() }]), /路径/);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/resource-packager/index.html`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(url); await page.waitForSelector('.resource-row');
    await page.screenshot({ path: path.join(out, 'packager-empty.png'), fullPage: true });
    const png = async (width, height, nine = false) => Buffer.from(await page.evaluate(({ width, height, nine }) => {
      const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d');
      ctx.fillStyle = '#4268e8'; ctx.fillRect(1, 1, width - 2, height - 2);
      if (nine) { ctx.fillStyle = '#000'; ctx.fillRect(3, 0, 2, 1); ctx.fillRect(0, 3, 1, 2); ctx.fillRect(1, height - 1, width - 2, 1); ctx.fillRect(width - 1, 1, 1, height - 2); }
      return c.toDataURL('image/png').split(',')[1];
    }, { width, height, nine }), 'base64');
    const small = await png(32, 32), large = await png(300, 300), nine = await png(20, 20, true);
    await page.locator('#files').setInputFiles([
      { name: 'delete_normal_icon.png', mimeType: 'image/png', buffer: small },
      { name: '通用背景.9.png', mimeType: 'image/png', buffer: nine },
      { name: 'delete_pressed_icon.png', mimeType: 'image/png', buffer: large },
      { name: '26key_a_normal_foreground_3_image.png', mimeType: 'image/png', buffer: small },
      { name: '伪装.jpg', mimeType: 'image/jpeg', buffer: small },
    ]);
    await page.waitForFunction(() => document.querySelector('#assetCount').textContent === '5' && document.querySelector('#exportStatus').textContent.includes('需修正'));
    assert.equal(await page.locator('#exportZip').isDisabled(), true);
    assert.match(await page.locator('#assetList').innerText(), /内容与后缀不一致/);
    await page.locator('#search').fill('delete_pressed_icon'); await page.locator('[data-unassign="delete_pressed_icon"]').click();
    await page.locator('[data-asset="2"]').click(); await page.locator('[data-preset="letters"]').click();
    assert.match(await page.locator('#selectedCount').innerText(), /26/); await page.locator('#assignMany').click();
    assert.equal(await page.locator('#baseCount').innerText(), '28');
    await page.locator('#copyMode').click(); assert.equal(await page.locator('#darkCount').innerText(), '28');
    await page.locator('#modeDark').click(); await page.locator('#resetFilters').click(); await page.locator('#search').fill('26key_a_normal_background_image');
    await page.locator('[data-unassign="26key_a_normal_background_image"]').click();
    assert.equal(await page.locator('#darkCount').innerText(), '27'); assert.equal(await page.locator('#baseCount').innerText(), '28');
    await page.locator('#modeBase').click(); await page.locator('#autoMatch').click();
    // Previously unassigned oversized image returns on auto-match: block export again.
    assert.equal(await page.locator('#exportZip').isDisabled(), true);
    await page.locator('#search').fill('delete_pressed_icon'); await page.locator('[data-unassign="delete_pressed_icon"]').click();
    await page.locator('#files').setInputFiles({ name: 'delete_normal_icon.png', mimeType: 'image/png', buffer: small });
    await page.waitForFunction(() => document.querySelector('#assetCount').textContent === '6');
    assert.equal(await page.locator('#baseCount').innerText(), '28');
    await page.locator('#resetFilters').click(); await page.locator('#assignedFilter').selectOption('assigned');
    await page.locator('#layer').selectOption('all'); await page.locator('#review').click();
    assert.match(await page.locator('#reviewList').innerText(), /base\/26key_a_normal_foreground_3_image.png/);
    await page.locator('#closeReview').click();
    await page.screenshot({ path: path.join(out, 'packager-populated.png'), fullPage: true });
    assert.equal(await page.locator('#exportZip').isDisabled(), false);
    const dlPromise = page.waitForEvent('download'); await page.locator('#exportZip').click();
    const dl = await dlPromise; assert.equal(dl.suggestedFilename(), 'skins.zip'); await dl.saveAs(path.join(out, 'skins.zip'));
    await fs.writeFile(path.join(out, 'original.9.png'), nine); await fs.writeFile(path.join(out, 'original.png'), small);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, 'packager-mobile.png'), fullPage: true });
    const offline = await browser.newPage();
    offline.on('pageerror', error => errors.push(error.message));
    await offline.goto(pathToFileURL(path.join(root, 'resource-packager.html')).href);
    await offline.waitForSelector('.resource-row');
    await offline.locator('#files').setInputFiles([
      ...['删除图标.png', 'a.png', 'a按下.png', '7.png', 'a前景第2层.png', '空格背景.png', '删除图标按下.png'].map(name => ({ name, mimeType: 'image/png', buffer: small })),
      { name: '通用字母背景.9.png', mimeType: 'image/png', buffer: nine },
    ]);
    await offline.waitForFunction(() => document.querySelector('#assetCount').textContent === '8' && !document.querySelector('#exportZip').disabled);
    assert.equal(await offline.locator('#baseCount').innerText(), '7');
    await offline.locator('[data-candidates="6"]').click();
    assert.equal(await offline.locator('.resource-row').count(), 4);
    assert.match(await offline.locator('#resultCount').innerText(), /候选用途/);
    await offline.locator('[data-assign="26key_space_normal_background_image"]').click();
    assert.equal(await offline.locator('#baseCount').innerText(), '8');
    assert.equal(await offline.locator('[data-candidates="6"]').count(), 0);
    await offline.locator('#files').setInputFiles({ name: '26key_a_normal_background_image.png', mimeType: 'image/png', buffer: large });
    await offline.waitForFunction(() => document.querySelector('#assetCount').textContent === '9');
    assert.equal(await offline.locator('#baseCount').innerText(), '8');
    assert.match(await offline.locator('[data-asset="9"]').innerText(), /已占用/);
    assert.equal(await offline.locator('#exportZip').isDisabled(), false);
    await offline.locator('#modeDark').click();
    await offline.locator('#files').setInputFiles({ name: 'a按下.9.png', mimeType: 'image/png', buffer: nine });
    await offline.waitForFunction(() => document.querySelector('#darkCount').textContent === '1');
    assert.equal(await offline.locator('#baseCount').innerText(), '8');
    const namesDownload = offline.waitForEvent('download'); await offline.locator('#downloadNames').click();
    const names = await namesDownload;
    assert.equal(names.suggestedFilename(), '小艺资源中文命名对照表.txt');
    const namesText = await fs.readFile(await names.path(), 'utf8');
    assert.equal(namesText.split('\r\n').filter(line => line.includes(' → ')).length, 910); // 909 entries + column heading
    assert.match(namesText, /9键数字页换行背景.png → 9key_number_enter_normal_background_image/);
    await offline.locator('#modeBase').click(); await offline.locator('#resetFilters').click();
    await offline.locator('#assignedFilter').selectOption('assigned'); await offline.locator('#layer').selectOption('all');
    await offline.screenshot({ path: path.join(out, 'packager-simple-names.png'), fullPage: true });
    await offline.setViewportSize({ width: 390, height: 844 });
    assert.equal(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const offlineDownload = offline.waitForEvent('download'); await offline.locator('#exportZip').click();
    const aliasZip = await offlineDownload;
    assert.equal(aliasZip.suggestedFilename(), 'skins.zip'); await aliasZip.saveAs(path.join(out, 'aliases.zip'));
    await offline.close({ runBeforeUnload: false });
    assert.deepEqual(errors, []);
    console.log('PASS: 909 recommended aliases roundtrip for every allowed extension, legacy names, ambiguous candidates, simple-name batch import, independent modes, duplicate protection, naming table, ZIP download, mobile, offline, no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
