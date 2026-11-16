// Check all three double-size previews against independently specified patch boundaries.
// node scripts/test-nine-patch-double-previews.cjs <node_modules> [actual-nine-patch-file]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(process.argv[2], 'package.json'))('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.qa');
const previews = [['pcW', 2, 1], ['pcH', 1, 2], ['pcWH', 2, 2]];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1540, height: 1040 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    for (const fixture of [
      { label: 'single', xs: [0, 3, 6, 9], ys: [0, 3, 6, 9], xd: [0, 3, 15, 18], yd: [0, 3, 15, 18] },
      { label: 'multi', xs: [0, 1, 3, 5, 6, 9, 13], ys: [0, 2, 4, 6, 7, 9, 11], xd: [0, 1, 7, 9, 12, 15, 26], yd: [0, 2, 8, 10, 14, 16, 22] },
    ]) {
      const data = await page.evaluate(({ xs, ys }) => {
        const w = xs.at(-1), h = ys.at(-1), c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
        const x = c.getContext('2d');
        for (let row = 0; row < ys.length - 1; row++) for (let col = 0; col < xs.length - 1; col++) {
          x.fillStyle = `rgb(${30 * (col + 1)},${30 * (row + 1)},90)`;
          x.fillRect(xs[col] + 1, ys[row] + 1, xs[col + 1] - xs[col], ys[row + 1] - ys[row]);
        }
        x.fillStyle = '#000';
        for (let i = 1; i < xs.length - 1; i += 2) x.fillRect(xs[i] + 1, 0, xs[i + 1] - xs[i], 1);
        for (let i = 1; i < ys.length - 1; i += 2) x.fillRect(0, ys[i] + 1, 1, ys[i + 1] - ys[i]);
        return c.toDataURL().split(',')[1];
      }, fixture);
      await page.locator('#bcl').click();
      await page.locator('#fi').setInputFiles({ name: fixture.label + '.9.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
      await page.waitForSelector('.iitem');
      await page.locator('#pvBackground').selectOption('#18181c');
      // Nearest sampling makes each patch's known source color an exact pixel oracle.
      await page.locator('#pvSmooth').uncheck();
      for (const [id, fx, fy] of previews) {
        const result = await page.evaluate(({ id, xs, ys }) => {
          const c = document.getElementById(id), p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let mismatches = 0;
          for (let row = 0; row < ys.length - 1; row++) for (let col = 0; col < xs.length - 1; col++) {
            for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = xs[col]; x < xs[col + 1]; x++) {
              const i = (y * c.width + x) * 4;
              if (p[i] !== 30 * (col + 1) || p[i + 1] !== 30 * (row + 1) || p[i + 2] !== 90 || p[i + 3] !== 255) mismatches++;
            }
          }
          return { width: c.width, height: c.height, shown: [c.getBoundingClientRect().width, c.getBoundingClientRect().height], mismatches };
        }, { id, xs: fx === 2 ? fixture.xd : fixture.xs, ys: fy === 2 ? fixture.yd : fixture.ys });
        assert.deepEqual([result.width, result.height], [fixture.xs.at(-1) * fx, fixture.ys.at(-1) * fy]);
        assert.deepEqual(result.shown, [result.width, result.height], 'Preview must display 1:1: ' + id);
        assert.equal(result.mismatches, 0, fixture.label + ' ' + id);
      }
      // With smoothing on, the constant blue channel also detects gaps and unwanted white overlays.
      await page.locator('#pvSmooth').check();
      for (const [id] of previews) {
        assert.equal(await page.locator('#' + id).evaluate(c => {
          const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < p.length; i += 4) if (p[i + 2] !== 90 || p[i + 3] !== 255) return false;
          return true;
        }), true, 'Smooth patch coverage: ' + id);
      }
    }
    if (process.argv[3]) {
      await page.locator('#bcl').click(); await page.locator('#fi').setInputFiles(process.argv[3]); await page.waitForSelector('.iitem');
      const checks = await page.evaluate(async () => {
        const img = new Image(); img.src = document.querySelector('.thumb').src; await img.decode();
        const w = img.width, h = img.height, source = document.createElement('canvas'); source.width = w; source.height = h;
        const ctx = source.getContext('2d'); ctx.fillStyle = '#18181c'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0);
        const src = ctx.getImageData(0, 0, w, h).data;
        return [['pcW', 2, 1], ['pcH', 1, 2], ['pcWH', 2, 2]].map(([id, fx, fy]) => {
          const c = document.getElementById(id), px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let compared = 0, changed = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            // The supplied image has x=43..47 and y=65..69 stretch markers (zero-based).
            if (fx === 2 && x >= 43 && x < 48 || fy === 2 && y >= 65 && y < 70) continue;
            const dx = fx === 2 && x >= 48 ? x + w : x, dy = fy === 2 && y >= 70 ? y + h : y;
            const a = (y * w + x) * 4, b = (dy * c.width + dx) * 4;
            for (let ch = 0; ch < 4; ch++) if (src[a + ch] !== px[b + ch]) { changed++; break; }
            compared++;
          }
          const rect = c.getBoundingClientRect();
          return { id, size: [c.width, c.height], shown: [rect.width, rect.height], compared, changed };
        });
      });
      for (const [i, check] of checks.entries()) {
        assert.deepEqual(check.size, [91 * previews[i][1], 135 * previews[i][2]]);
        assert.deepEqual(check.shown, check.size); assert.equal(check.changed, 0, 'Actual image fixed pixels: ' + check.id);
        await page.locator('#' + check.id).click();
        assert.deepEqual(await page.locator('#pvLarge').evaluate(c => [c.width, c.height]), check.size);
        const identical = await page.evaluate(id => {
          const a = document.getElementById(id), b = document.getElementById('pvLarge'); return a.toDataURL() === b.toDataURL();
        }, check.id);
        assert.equal(identical, true, 'Detail view content: ' + check.id); await page.locator('#pvClose').click();
      }
      console.log(JSON.stringify(checks));
      const images = await page.evaluate(() => ['pcW', 'pcH', 'pcWH'].map(id => document.getElementById(id).toDataURL()));
      const report = await browser.newPage({ viewport: { width: 800, height: 440 } });
      await report.setContent('<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f6fa;color:#243047;font:14px/1.5 Microsoft YaHei,sans-serif}h1{font-size:20px;margin:0 0 6px}p{color:#65728c;font-size:12px;margin:0 0 18px}.grid{display:flex;gap:18px}section{padding:16px;background:white;border:1px solid #dde3ee;border-radius:9px;flex:1}h2{font-size:14px;margin:0 0 12px}img{display:block;background:#18181c;max-width:none}</style><h1>三个 ×2 预览逐项核对</h1><p>ZXCV+M.9.png · 原内容 91 × 135 px · 保留原有 5px 标记 · 以下按 1:1 显示</p><div class="grid">' + images.map((src, i) => '<section><h2>' + ['宽度 ×2：182 × 135', '高度 ×2：91 × 270', '宽高 ×2：182 × 270'][i] + '</h2><img src="' + src + '"></section>').join('') + '</div>');
      await report.screenshot({ path: path.join(out, 'nine-preview-double-check.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: all 3 presets, single + 3-segment unequal stretches, exact patch colors, smooth coverage, native display sizes, actual image fixed pixels, identical detail view.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
