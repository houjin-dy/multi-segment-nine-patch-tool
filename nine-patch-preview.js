(function (root) {
  'use strict';
  function runs(mask) {
    const result = [];
    for (let start = 0, end = 1; end <= mask.length; end++) {
      if (end === mask.length || !!mask[end] !== !!mask[start]) {
        result.push({ start, end, stretch: !!mask[start] }); start = end;
      }
    }
    return result;
  }
  function size(value, fallback) {
    const n = Number(value);
    return Math.max(1, Math.min(4000, Math.round(Number.isFinite(n) && n > 0 ? n : fallback)));
  }
  function axis(mask, target) {
    target = size(target, mask.length);
    const parts = runs(mask), stretch = parts.reduce((sum, p) => sum + (p.stretch ? p.end - p.start : 0), 0);
    const fixed = mask.length - stretch;
    let position = 0;
    const cuts = parts.map((p, i) => {
      const sourceSize = p.end - p.start;
      // Skia's lattice rule: shrink stretchable pixels first. Below the fixed-size
      // minimum, collapse those pixels and scale the fixed patches to fit.
      const length = !stretch ? sourceSize * target / mask.length
        : target >= fixed ? p.stretch ? sourceSize * (target - fixed) / stretch : sourceSize
        : p.stretch ? 0 : sourceSize * target / fixed;
      const destinationStart = Math.round(position); position += length;
      const destinationEnd = i === parts.length - 1 ? target : Math.round(position);
      return { ...p, destinationStart, destinationEnd };
    });
    return { parts: cuts, fixed, stretch, target, collapsed: stretch > 0 && target <= fixed };
  }
  function coordinate(position, layout) {
    for (const p of layout.parts) if (position <= p.end) {
      return p.destinationStart + (Math.max(position, p.start) - p.start) / (p.end - p.start) * (p.destinationEnd - p.destinationStart);
    }
    return layout.target;
  }
  function draw(ctx, image, horizontal, vertical, width, height, smooth = true) {
    const x = axis(horizontal, width), y = axis(vertical, height);
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = 'low';
    for (const row of y.parts) for (const col of x.parts) {
      const dw = col.destinationEnd - col.destinationStart, dh = row.destinationEnd - row.destinationStart;
      if (dw && dh) ctx.drawImage(image, col.start, row.start, col.end - col.start, row.end - row.start,
        col.destinationStart, row.destinationStart, dw, dh);
    }
    return { x, y };
  }
  function readMarkers(pixels, width, height) {
    if (width < 3 || height < 3) throw new Error('点九图缺少完整的 1px 标记边框');
    if (pixels[3]) throw new Error('点九原点 (0,0) 必须透明');
    function read(length, at) {
      const mask = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        const p = at(i), alpha = pixels[p + 3];
        if (!alpha) continue;
        if (alpha !== 255 || pixels[p] || pixels[p + 1] || pixels[p + 2]) throw new Error('点九边框只能包含纯黑或透明像素');
        mask[i] = 1;
      }
      return mask;
    }
    const st = read(width - 2, i => (i + 1) * 4), sl = read(height - 2, i => ((i + 1) * width) * 4);
    const pb = read(width - 2, i => ((height - 1) * width + i + 1) * 4), pr = read(height - 2, i => ((i + 1) * width + width - 1) * 4);
    if (!st.some(Boolean) && !sl.some(Boolean)) throw new Error('点九图没有黑色拉伸标记');
    return { st, sl, pb, pr };
  }
  root.NinePatchPreview = { runs, size, axis, coordinate, draw, readMarkers };
  if (typeof module !== 'undefined') module.exports = root.NinePatchPreview;
})(globalThis);
