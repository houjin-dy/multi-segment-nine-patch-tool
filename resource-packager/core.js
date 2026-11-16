(function (root) {
  'use strict';
  function expand(rules) {
    return rules.flatMap(rule => (rule.name.includes('{0-3}') ? [0, 1, 2, 3] : [null])
      .map(layer => ({ ...rule, layer, name: rule.name.replace('{0-3}', layer) })));
  }
  function extension(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith('.9.png')) return '.9.png';
    const ext = lower.match(/\.[^.]+$/)?.[0] || '';
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  function stem(name) { return name.replace(/(?:\.9)?\.[^.]+$/, ''); }
  function normalized(value) { return value.toLowerCase().replace(/[\s_\-—()（）/\\]+/g, ''); }
  // These are import aliases for this tool; exported names still come from the specification.
  const itemAliases = {
    '字符键(字母键)': ['字母键', '字母', '字符键'],
    '123（数字）': ['数字切换', '123'],
    ',': ['逗号'], '.': ['句号'], '@': ['艾特'],
    '语音图标（位于空格上）': ['语音图标'],
    'shift键图标': ['Shift图标', '大小写图标'],
    'shift键图标(上档)': ['Shift上档图标'],
    'shift键图标(锁定)': ['Shift锁定图标'],
    '键盘背景(直板机)': ['直板键盘背景'],
    '键盘背景(平板)': ['平板键盘背景'],
    '键盘背景（折叠屏展开态）': ['折叠屏键盘背景'],
    '顶部抬高区域（直板机）(帮写翻译等)【需要跟键盘背景资源类型一致】': ['直板顶部区域'],
    '顶部抬高区域（平板）(帮写翻译等)【图片需要跟键盘背景资源类型一致】': ['平板顶部区域'],
    '顶部抬高区域-折叠屏展开态(帮写翻译等)【需要跟键盘背景资源类型一致】': ['折叠屏顶部区域'],
    '按键背板动效(直板机)': ['直板按键背板动效'],
    '按键背板动效(平板)': ['平板按键背板动效'],
    '按键背板动效(折叠屏展开态)': ['折叠屏按键背板动效'],
  };
  function kindAliases(rule, item) {
    if (rule.layer !== null) return [`前景第${rule.layer + 1}层`, `前景${rule.layer + 1}`, ...(rule.layer === 0 ? ['前景'] : [])];
    if (rule.kind === '背景') return item.endsWith('背景') ? ['', '背景'] : ['背景', ''];
    if (rule.kind === '图标') return item.includes('图标') ? [''] : ['图标'];
    if (rule.kind === '主文本') return ['文字', '主文本'];
    if (rule.kind === '辅助文本') return ['辅助文字', '辅助文本'];
    return ['', rule.kind];
  }
  function shortItems(rule) {
    if (rule.name.startsWith('9key_number_enter_')) return ['数字页换行'];
    if (rule.name.startsWith('9key_enter_')) return ['普通页换行'];
    return itemAliases[rule.item] || [rule.item];
  }
  function friendlyName(rule) {
    const item = shortItems(rule)[0];
    const prefix = ['图标', '全局'].includes(rule.module) || item.startsWith(rule.module) ? '' : rule.module === 'base' ? '通用' : rule.module;
    const state = rule.state === '按压态' ? '按下' : rule.state === '选中态' ? '选中' : '';
    return prefix + item + kindAliases(rule, item)[0] + state + rule.extensions[0];
  }
  const aliasCache = new WeakMap();
  function aliasIndex(rules) {
    if (aliasCache.has(rules)) return aliasCache.get(rules);
    const index = new Map();
    for (const rule of rules) {
      const prefixes = new Set([rule.module, '', ...(rule.module === 'base' ? ['通用', '基础'] : [])]);
      const items = new Set([rule.item, ...shortItems(rule)]);
      const states = rule.state === '按压态' ? ['按下', '按下态', '按压', '按压态']
        : rule.state === '选中态' ? ['选中', '选中态'] : ['', '默认', '常规', '常规态', '正常'];
      for (const prefix of prefixes) for (const item of items) for (const kind of kindAliases(rule, item)) for (const state of states) {
        for (const alias of [prefix + item + kind + state, prefix + item + state + kind]) {
          const key = normalized(alias);
          if (!index.has(key)) index.set(key, new Set());
          index.get(key).add(rule);
        }
      }
    }
    aliasCache.set(rules, index); return index;
  }
  function matchCandidates(name, rules) {
    const input = stem(name).toLowerCase();
    const exact = rules.filter(r => r.name.toLowerCase() === input);
    if (exact.length === 1) return exact;
    const full = normalized(input);
    const chinese = rules.filter(r => normalized(r.module + r.item + r.kind + r.state + (r.layer === null ? '' : r.layer)) === full);
    const matches = chinese.length ? chinese : [...(aliasIndex(rules).get(full) || [])];
    // Image and video backgrounds share a Chinese label; the actual suffix distinguishes them.
    if (matches.length > 1) {
      const supported = matches.filter(r => r.extensions.includes(extension(name)));
      if (supported.length) return supported;
    }
    return matches;
  }
  function match(name, rules) {
    const matches = matchCandidates(name, rules);
    return matches.length === 1 ? matches[0] : null;
  }
  function validate(asset, rule) {
    const errors = [];
    if (asset.error) errors.push(asset.error);
    if (!rule.extensions.includes(asset.ext)) errors.push('格式不支持：需要 ' + rule.extensions.join(' / '));
    if (!(asset.width > 0 && asset.height > 0)) errors.push('无法读取分辨率');
    else if (asset.width > rule.width || asset.height > rule.height) errors.push(`超过最大分辨率 ${rule.width} × ${rule.height}`);
    if (rule.limits[asset.ext] && asset.size > rule.limits[asset.ext]) errors.push(`超过文件上限 ${rule.limits[asset.ext] / 1024} KB`);
    return errors;
  }
  function entries(modes, rules, assets) {
    const ruleMap = new Map(rules.map(r => [r.name, r]));
    const assetMap = new Map(assets.map(a => [a.id, a]));
    const result = [];
    for (const mode of ['base', 'dark']) {
      for (const [name, id] of modes[mode]) {
        const rule = ruleMap.get(name), asset = assetMap.get(id);
        if (!rule || !asset) throw new Error('资源映射失效，请重新分配');
        result.push({ path: mode + '/' + name + asset.ext, rule, asset, errors: validate(asset, rule) });
      }
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const value of bytes) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  // STORE is intentional: encoded media remains byte-for-byte intact, offline.
  async function zip(files, progress = () => {}) {
    if (files.length > 65535) throw new Error('资源数量超过 ZIP 上限');
    const names = new Set(), local = [], central = [];
    let offset = 0, centralSize = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!/^(base|dark)\/(?:[a-zA-Z0-9_.-]+)?$/.test(file.path) || file.path.includes('..') || names.has(file.path)) throw new Error('ZIP 路径无效或重名：' + file.path);
      names.add(file.path);
      const name = new TextEncoder().encode(file.path);
      const bytes = file.bytes || new Uint8Array(await file.blob.arrayBuffer());
      if (offset + bytes.length > 512 * 1024 * 1024) throw new Error('资源包超过 512 MB，请分批打包');
      const crc = crc32(bytes), size = bytes.length;
      const lh = new Uint8Array(30 + name.length), lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true);
      lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true); lv.setUint16(26, name.length, true); lh.set(name, 30);
      local.push(lh, bytes);
      const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true);
      cv.setUint32(38, file.path.endsWith('/') ? 16 : 0, true); cv.setUint32(42, offset, true); ch.set(name, 46);
      central.push(ch); centralSize += ch.length; offset += lh.length + size;
      progress(i + 1, files.length);
      if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
  }
  root.PackagerCore = { expand, extension, stem, friendlyName, matchCandidates, match, validate, entries, crc32, zip };
  if (typeof module !== 'undefined') module.exports = root.PackagerCore;
})(globalThis);
