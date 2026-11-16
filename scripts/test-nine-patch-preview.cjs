// node scripts/test-nine-patch-preview.cjs <bundled-node_modules> [actual-nine-patch-file]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(process.argv[2], 'package.json'))('playwright');
const PV = require('../nine-patch-preview.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.qa');
const marks = Uint8Array.from([0, 0, 0, 1, 1, 1, 0, 0, 0]);
assert.deepEqual(PV.axis(marks, 8).parts.map(p => [p.destinationStart, p.destinationEnd]), [[0, 3], [3, 5], [5, 8]]);
assert.deepEqual(PV.axis(marks, 4).parts.map(p => [p.destinationStart, p.destinationEnd]), [[0, 2], [2, 2], [2, 4]]);
assert.equal(PV.axis(marks, 6).collapsed, true);
assert.equal(PV.axis(marks, 7).collapsed, false);
assert.equal(PV.size(-5, 9), 9); assert.equal(PV.size(90000, 9), 4000);
for (const mask of [marks, Uint8Array.from([0, 1, 1, 0, 1, 0, 0, 1, 1]), new Uint8Array(9), new Uint8Array(9).fill(1)]) {
  for (const size of [1, 4, 8, 9, 13, 37, 100]) {
    const parts = PV.axis(mask, size).parts;
    assert.equal(parts[0].destinationStart, 0); assert.equal(parts.at(-1).destinationEnd, size);
    parts.forEach((p, i) => { assert.ok(p.destinationStart <= p.destinationEnd); if (i) assert.equal(parts[i - 1].destinationEnd, p.destinationStart); });
  }
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1540, height: 1040 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    const fixture = Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 11; const x = c.getContext('2d');
      for (const [color, y] of [['#ff0000', 1], ['#00ff00', 4], ['#0000ff', 7]]) { x.fillStyle = color; x.fillRect(1, y, 9, 3); }
      x.fillStyle = '#000'; x.fillRect(4, 0, 3, 1); x.fillRect(0, 4, 1, 3); x.fillRect(1, 10, 10, 1); x.fillRect(10, 0, 1, 11); x.fillRect(0, 10, 1, 1);
      return c.toDataURL().split(',')[1];
    }), 'base64');
    await page.locator('#fi').setInputFiles({ name: 'fixture.9.png', mimeType: 'image/png', buffer: fixture });
    await page.waitForSelector('.iitem');
    assert.match(await page.locator('#previewInfo').innerText(), /已读取原点九标记 9 × 9/);
    assert.equal(await page.locator('#pvContent').isChecked(), false);
    await page.locator('#pwc').fill('18'); await page.locator('#phc').fill('4');
    const pixels = await page.locator('#pcC').evaluate(c => {
      const x = c.getContext('2d'); return [Array.from(x.getImageData(9, 0, 1, 1).data), Array.from(x.getImageData(9, 3, 1, 1).data)];
    });
    assert.deepEqual(pixels, [[255, 0, 0, 255], [0, 0, 255, 255]]); // Bottom edge survives shrink; no white overlay.
    assert.match(await page.locator('#previewWarning').innerText(), /纵向拉伸带被压没/);
    await page.locator('#pcC').click(); assert.equal(await page.locator('#pvDialog').evaluate(d => d.open), true);
    assert.deepEqual(await page.locator('#pvLarge').evaluate(c => [c.width, c.height, c.getBoundingClientRect().width, c.getBoundingClientRect().height]), [18, 4, 36, 8]);
    await page.locator('#pvClose').click();
    const download = async () => { const next = page.waitForEvent('download'); await page.locator('#bec').click(); return next; };
    const file = await download(); assert.equal(file.suggestedFilename(), 'fixture.9.png');
    const exported = (await fs.readFile(await file.path())).toString('base64');
    assert.equal(await page.evaluate(async ({ original, exported }) => {
      async function pixels(s) { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return [...x.getImageData(0, 0, c.width, c.height).data].join(','); }
      return await pixels(original) === await pixels(exported);
    }, { original: fixture.toString('base64'), exported }), true);
    await page.locator('#modeMulti').click(); await page.locator('#addTop').click(); await page.locator('#addTop').click();
    const multi = await download(), multiBytes = await fs.readFile(await multi.path());
    await page.locator('#modeSingle').click();
    const single = await download(); assert.equal((await fs.readFile(await single.path())).toString('base64'), exported);
    await page.locator('#fi').setInputFiles({ name: 'multi.9.png', mimeType: 'image/png', buffer: multiBytes });
    await page.waitForFunction(() => document.querySelectorAll('.iitem').length === 2); await page.locator('.iitem').last().click();
    assert.equal(await page.locator('#modeMulti').evaluate(b => b.classList.contains('ac')), true);
    await page.locator('#bcl').click(); assert.equal(await page.locator('#pcL').isVisible(), false);
    if (process.argv[3]) {
      await page.locator('#fi').setInputFiles(process.argv[3]); await page.waitForSelector('.iitem');
      assert.match(await page.locator('#previewInfo').innerText(), /91 × 135/);
      await page.locator('#pvBackground').selectOption('#18181c'); await page.locator('#landscapeSize').click();
      assert.match(await page.locator('#previewWarning').innerText(), /高度 88 ≤ 上下固定区 130/);
      for (const [id, name] of [['pcC', 'nine-preview-after.png'], ['pcW', 'nine-preview-width-only.png']]) {
        await fs.writeFile(path.join(out, name), Buffer.from(await page.locator('#' + id).evaluate(c => c.toDataURL().split(',')[1]), 'base64'));
      }
      // Comparison only: preserve the source image and horizontal marks, widen the vertical band.
      const wider = await page.evaluate(async () => {
        const i = new Image(); i.src = document.querySelector('.thumb').src; await i.decode();
        const c = document.createElement('canvas'); c.width = 273; c.height = 88; const x = c.getContext('2d'); x.fillStyle = '#18181c'; x.fillRect(0, 0, 273, 88);
        const top = new Uint8Array(91), left = new Uint8Array(135); top.fill(1, 43, 48); left.fill(1, 30, 105);
        NinePatchPreview.draw(x, i, top, left, 273, 88); return c.toDataURL().split(',')[1];
      });
      await fs.writeFile(path.join(out, 'nine-preview-wider-band.png'), Buffer.from(wider, 'base64'));
      await page.screenshot({ path: path.join(out, 'nine-preview-fixed-ui.png'), fullPage: true });
      await page.locator('#pcC').click(); await page.screenshot({ path: path.join(out, 'nine-preview-detail.png') }); await page.locator('#pvClose').click();
      await page.locator('#leftStart').fill('31'); await page.locator('#leftStart').blur();
      await page.locator('#leftEnd').fill('105'); await page.locator('#leftEnd').blur();
      assert.equal(await page.locator('#topStart').inputValue(), '44'); assert.equal(await page.locator('#topEnd').inputValue(), '48');
      assert.equal(await page.locator('#previewWarning').innerText(), '');
      assert.equal(await page.locator('#pcC').evaluate(c => c.toDataURL().split(',')[1]), wider);
      // Dragging an independently-sized vertical segment must keep its 75-pixel length.
      const canvas = await page.locator('#mc').boundingBox(); const zoom = canvas.width / 93;
      await page.mouse.move(canvas.x + zoom / 2, canvas.y + 50 * zoom); await page.mouse.down();
      await page.mouse.move(canvas.x + zoom / 2, canvas.y + 74 * zoom); await page.mouse.up();
      assert.equal(Number(await page.locator('#leftEnd').inputValue()) - Number(await page.locator('#leftStart').inputValue()) + 1, 75);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: expand/shrink layout, shared boundaries, bottom edge preservation, no default overlay, actual-size detail, .9 import/export pixel roundtrip, separate single/multi state, actual user fixture');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
