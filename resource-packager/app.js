(() => {
  'use strict';
  const C = PackagerCore, rules = C.expand(RESOURCE_SPEC), ruleMap = new Map(rules.map(r => [r.name, r]));
  const $ = id => document.getElementById(id);
  const modes = { base: new Map(), dark: new Map() }, assets = [], selected = new Set();
  let mode = 'base', chosen = null, page = 0, nextId = 1, busy = false, toastTimer, candidateNames = null;
  const pageSize = 35;
  const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const assetById = id => assets.find(a => a.id === id);
  const prettyMode = value => value === 'base' ? '浅色' : '深色';
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5500); }
  function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  for (const key of ['module', 'kind', 'state']) {
    for (const value of new Set(rules.map(r => r[key]))) { const opt = new Option(value === 'base' ? '基础（base）' : value, value); $(key).add(opt); }
  }
  function filtered() {
    const q = $('search').value.trim().toLowerCase(), layer = $('layer').value, status = $('assignedFilter').value;
    return rules.filter(r => {
      if (candidateNames && !candidateNames.has(r.name)) return false;
      if (['module', 'kind', 'state'].some(k => $(k).value && $(k).value !== r[k])) return false;
      if (layer === 'primary' && r.layer !== null && r.layer !== 0) return false;
      if (!['primary', 'all'].includes(layer) && r.layer !== Number(layer)) return false;
      if (q && ![r.name, r.module, r.item, r.kind, r.state, C.friendlyName(r)].join(' ').toLowerCase().includes(q)) return false;
      const asset = assetById(modes[mode].get(r.name));
      if (status === 'assigned' && !asset || status === 'empty' && asset) return false;
      if (status === 'invalid' && (!asset || !C.validate(asset, r).length)) return false;
      return true;
    });
  }
  function renderAssets() {
    $('assetCount').textContent = assets.length;
    $('assetList').innerHTML = assets.length ? assets.map(a => {
      let count = 0; for (const m of Object.values(modes)) for (const id of m.values()) if (id === a.id) count++;
      const pending = count ? '' : a.candidates?.length > 1 ? `<button class="choose-use" data-candidates="${a.id}">选择用途（${a.candidates.length}）</button>` : `<small>${a.candidates?.length ? '同名用途已占用，可手动更换' : '名称未识别，可手动分配'}</small>`;
      return `<div class="asset ${chosen === a.id ? 'chosen' : ''}" data-asset="${a.id}" tabindex="0" role="button" aria-label="选择素材 ${esc(a.name)}"><${a.ext === '.mp4' ? 'video muted preload="metadata"' : 'img alt=""'} class="asset-thumb" src="${a.url}">${a.ext === '.mp4' ? '</video>' : ''}<div class="asset-info"><div class="asset-name" title="${esc(a.name)}">${esc(a.name)}</div><small>${a.width || '?'} × ${a.height || '?'} · ${(a.size / 1024).toFixed(1)} KB</small><small class="${a.error ? 'error-text' : ''}">${a.error ? esc(a.error) : `${prettyMode(a.mode)} · 已分配 ${count} 项`}</small>${pending}</div><button class="remove" data-remove="${a.id}" title="移除素材及其分配" aria-label="移除 ${esc(a.name)}">×</button></div>`;
    }).join('') : '<div class="empty-assets">等待你的第一张素材<br><small>简易中文名或标准英文名自动匹配</small></div>';
  }
  function renderResources() {
    const all = filtered(), pages = Math.max(1, Math.ceil(all.length / pageSize)); page = Math.min(page, pages - 1);
    $('resourceList').innerHTML = all.slice(page * pageSize, (page + 1) * pageSize).map(r => {
      const asset = assetById(modes[mode].get(r.name)), errors = asset ? C.validate(asset, r) : [];
      return `<div class="resource-row ${errors.length ? 'invalid' : ''} ${selected.has(r.name) ? 'selected-row' : ''}"><input type="checkbox" data-check="${r.name}" ${selected.has(r.name) ? 'checked' : ''} aria-label="选择 ${esc(r.module + ' ' + r.item + ' ' + r.kind + ' ' + r.state)}"><div><div class="resource-title">${esc(r.item)} · ${esc(r.kind)}${r.layer === null ? '' : ' ' + (r.layer + 1)}<span>${esc(r.module)} / ${esc(r.state)}</span></div><div class="resource-name">${r.name}</div><div class="friendly-name"><span>中文名：${esc(C.friendlyName(r))}</span><button class="link-button" data-copy-name="${r.name}" aria-label="复制 ${esc(C.friendlyName(r))}">复制</button></div>${errors.length ? `<div class="error-text">${esc(errors.join('；'))}</div>` : ''}</div><div class="resource-size">≤ ${r.width} × ${r.height}<small>${r.extensions.join(' / ')}</small><small>${Math.max(...Object.values(r.limits)) / 1024} KB 上限${Object.keys(r.limits).length > 1 && r.limits['.webp'] ? '（按格式）' : ''}</small></div><div class="assignment">${asset ? `<div class="assigned-name" title="${esc(asset.name)}">${esc(asset.name)}</div><button data-assign="${r.name}">更换</button> <button class="clear" data-unassign="${r.name}" aria-label="取消 ${r.name} 的分配">×</button>` : `<button data-assign="${r.name}">分配素材</button>`}</div></div>`;
    }).join('') || '<div class="no-results">没有符合筛选条件的资源</div>';
    $('resultCount').textContent = candidateNames ? `${all.length} 个候选用途 · 点击“分配素材”确认，或重置筛选` : `共 ${all.length} 项 · 规范原始行可在打包清单中查看`;
    $('pageLabel').textContent = `${page + 1} / ${pages}`; $('prevPage').disabled = page === 0; $('nextPage').disabled = page + 1 >= pages;
    $('selectedCount').textContent = `已选 ${selected.size} 项`;
    $('assignMany').disabled = !chosen || !selected.size || busy;
    $('selectVisible').checked = all.length > 0 && all.every(r => selected.has(r.name));
    $('selectVisible').indeterminate = !all.every(r => selected.has(r.name)) && all.some(r => selected.has(r.name));
  }
  function renderSummary() {
    $('modeBase').classList.toggle('selected', mode === 'base'); $('modeDark').classList.toggle('selected', mode === 'dark');
    $('baseCount').textContent = modes.base.size; $('darkCount').textContent = modes.dark.size;
    const entries = C.entries(modes, rules, assets), invalid = entries.filter(e => e.errors.length).length, used = new Set(entries.map(e => e.asset.id)).size;
    $('exportTitle').textContent = entries.length ? `${entries.length} 个资源待打包` : '还没有分配资源';
    $('exportStatus').textContent = entries.length ? `${modes.base.size} 个浅色 · ${modes.dark.size} 个深色 · ${assets.length - used} 份未使用素材${invalid ? ` · ${invalid} 项需修正后才能导出` : ' · 已分配资源通过校验'}` : '选择素材并分配用途后，生成 Theme Studio Pro 批量导入资源包。';
    $('exportStatus').classList.toggle('error-text', invalid > 0);
    $('exportZip').disabled = busy || !entries.length || invalid > 0;
    $('copyMode').textContent = `${prettyMode(mode)}复用到${prettyMode(mode === 'base' ? 'dark' : 'base')}`;
  }
  function render() { renderAssets(); renderResources(); renderSummary(); }
  function validateNine(img) {
    if (img.naturalWidth < 3 || img.naturalHeight < 3) return '点九图必须含完整的 1px 标记边框';
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const w = cv.width, h = cv.height, p = ctx.getImageData(0, 0, w, h).data;
    if (p[3]) return '点九原点 (0,0) 必须透明';
    let total = 0;
    for (const [len, pixel] of [[w - 2, i => (i + 1) * 4], [h - 2, i => (i + 1) * w * 4]]) {
      let count = 0, prev = false, last = false;
      for (let i = 0; i < len; i++) {
        const j = pixel(i), on = p[j + 3] === 255 && p[j] === 0 && p[j + 1] === 0 && p[j + 2] === 0;
        if (p[j + 3] !== 0 && !on) return '点九标记边必须为纯黑或透明';
        if (on && !prev) count++; prev = on; last = on;
      }
      if (count > 3) return '点九每边最多 3 个拉伸段';
      if (count === 3 && !last) return '点九 3 段时末段必须贴右 / 贴底';
      total += count;
    }
    return total ? '' : '未检测到点九拉伸标记，请先制作点九图';
  }
  async function inspect(file, targetMode) {
    const ext = C.extension(file.name), url = URL.createObjectURL(file);
    const asset = { id: nextId++, name: file.name, file, url, ext, mode: targetMode, size: file.size, width: 0, height: 0, error: '' };
    try {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer()), ascii = new TextDecoder('ascii').decode(head);
      const magic = head[0] === 137 && ascii.slice(1, 4) === 'PNG' ? '.png' : head[0] === 255 && head[1] === 216 ? '.jpg' : ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP' ? '.webp' : ascii.slice(4, 8) === 'ftyp' ? '.mp4' : '';
      if (magic !== (ext === '.9.png' ? '.png' : ext)) throw new Error('文件内容与后缀不一致，或格式不支持');
      if (file.size > 32 * 1024 * 1024) throw new Error('文件超过 32 MB，规范最大仅 8 MB');
      if (ext === '.mp4') {
        await new Promise((resolve, reject) => {
          const video = document.createElement('video'), timer = setTimeout(() => done(new Error('视频读取超时')), 10000);
          function done(error) { clearTimeout(timer); video.removeAttribute('src'); video.load(); error ? reject(error) : resolve(); }
          video.preload = 'metadata'; video.onloadedmetadata = () => { asset.width = video.videoWidth; asset.height = video.videoHeight; video.onloadedmetadata = video.onerror = null; done(); }; video.onerror = () => { video.onerror = null; done(new Error('浏览器无法解码视频')); }; video.src = url;
        });
      } else {
        const img = new Image(); img.src = url; await img.decode(); asset.width = img.naturalWidth; asset.height = img.naturalHeight;
        if (ext === '.9.png') asset.error = validateNine(img);
      }
    } catch (error) { asset.error = error.message || '文件无法读取'; }
    return asset;
  }
  function autoAssign(list) {
    let matched = 0, conflicts = 0, ambiguous = 0;
    for (const asset of list) {
      const candidates = C.matchCandidates(asset.name, rules); asset.candidates = candidates.map(r => r.name);
      if (candidates.length > 1) { ambiguous++; continue; }
      const rule = candidates[0]; if (!rule) continue;
      const old = modes[asset.mode].get(rule.name);
      if (old && old !== asset.id) { conflicts++; continue; }
      if (!old) { modes[asset.mode].set(rule.name, asset.id); matched++; }
    }
    return { matched, conflicts, ambiguous };
  }
  async function addFiles(files) {
    if (busy) { toast('请等待当前处理完成'); return; }
    busy = true; renderSummary();
    const defaultMode = $('uploadMode').value;
    const list = Array.from(files).filter(f => ['.png', '.9.png', '.jpg', '.webp', '.mp4'].includes(C.extension(f.name)));
    let matched = 0, conflicts = 0, ambiguous = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i], pathMode = f.webkitRelativePath?.split('/').find(p => ['base', 'dark'].includes(p.toLowerCase()))?.toLowerCase();
        const asset = await inspect(f, pathMode || defaultMode); assets.push(asset);
        const result = autoAssign([asset]); matched += result.matched; conflicts += result.conflicts; ambiguous += result.ambiguous;
        if (!chosen) chosen = asset.id;
        if (i % 10 === 0) { render(); toast(`正在读取 ${i + 1} / ${list.length}`); await new Promise(r => setTimeout(r, 0)); }
      }
      toast(`导入 ${list.length} 份素材，自动匹配 ${matched} 项${ambiguous ? `；${ambiguous} 份有多个候选，请点击素材上的“选择用途”` : ''}${conflicts ? `；${conflicts} 个重名目标未覆盖，请手动分配` : ''}${files.length > list.length ? `；跳过 ${files.length - list.length} 个非支持格式文件` : ''}`);
    } finally { busy = false; render(); }
  }
  function assign(names) {
    if (busy) return;
    const asset = assetById(chosen); if (!asset) { toast('先点击左侧一张素材，再选择用途'); return; }
    const replaced = names.filter(n => modes[mode].has(n) && modes[mode].get(n) !== chosen).length;
    if (replaced && !confirm(`这将替换 ${prettyMode(mode)}模式中 ${replaced} 个资源的原素材，继续吗？`)) return;
    names.forEach(name => modes[mode].set(name, chosen)); render(); toast(`已将“${asset.name}”分配给 ${names.length} 个${prettyMode(mode)}资源`);
  }
  $('files').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('folder').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('dropzone').onclick = () => { if (!busy) $('files').click(); };
  $('dropzone').onkeydown = e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); $('dropzone').click(); } };
  $('chooseFolder').onclick = () => { if (!busy) $('folder').click(); };
  window.addEventListener('dragover', e => { e.preventDefault(); $('dropzone').classList.add('dragging'); });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('dropzone').classList.remove('dragging'); });
  window.addEventListener('drop', e => { e.preventDefault(); $('dropzone').classList.remove('dragging'); addFiles(e.dataTransfer.files); });
  $('assetList').onclick = e => {
    if (busy) return;
    const candidateButton = e.target.closest('[data-candidates]');
    if (candidateButton) {
      const asset = assetById(Number(candidateButton.dataset.candidates));
      chosen = asset.id; mode = asset.mode; $('uploadMode').value = mode; resetFilters(); $('layer').value = 'all';
      candidateNames = new Set(asset.candidates); render();
      document.querySelector('.catalog').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const id = Number(remove.dataset.remove); let used = false;
      for (const m of Object.values(modes)) if ([...m.values()].includes(id)) used = true;
      if (used && !confirm('该素材已分配，移除时会一并取消这些分配。继续吗？')) return;
      for (const m of Object.values(modes)) for (const [name, aid] of m) if (aid === id) m.delete(name);
      URL.revokeObjectURL(assetById(id).url); assets.splice(assets.findIndex(a => a.id === id), 1); if (chosen === id) chosen = assets[0]?.id || null; render(); return;
    }
    const item = e.target.closest('[data-asset]'); if (item) { chosen = Number(item.dataset.asset); renderAssets(); renderResources(); }
  };
  $('assetList').onkeydown = e => { if (e.target.matches('[data-asset]') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); e.target.click(); } };
  $('clearAssets').onclick = () => { if (busy || !assets.length || !confirm('清空全部素材和资源分配？原文件不会改变。')) return; assets.forEach(a => URL.revokeObjectURL(a.url)); assets.length = 0; modes.base.clear(); modes.dark.clear(); selected.clear(); chosen = null; render(); };
  for (const value of ['base', 'dark']) $('mode' + (value === 'base' ? 'Base' : 'Dark')).onclick = () => { if (busy) return; mode = value; $('uploadMode').value = value; page = 0; selected.clear(); renderResources(); renderSummary(); };
  $('uploadMode').onchange = () => { if (busy) return; mode = $('uploadMode').value; selected.clear(); page = 0; renderResources(); renderSummary(); };
  for (const id of ['search', 'module', 'kind', 'state', 'layer', 'assignedFilter']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { candidateNames = null; page = 0; selected.clear(); renderResources(); });
  function resetFilters() { candidateNames = null; for (const id of ['search', 'module', 'kind', 'state', 'assignedFilter']) $(id).value = ''; $('layer').value = 'primary'; selected.clear(); page = 0; }
  $('resetFilters').onclick = () => { resetFilters(); renderResources(); };
  document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => {
    resetFilters(); const preset = button.dataset.preset;
    if (preset === 'icons') $('module').value = '图标';
    else { $('module').value = preset === 'letters' ? '26键' : '9键'; $('kind').value = '背景'; $('state').value = '常规态'; }
    for (const r of filtered()) if (preset === 'icons' || (preset === 'letters' ? /^26key_[a-z]_normal_background_image$/ : /^9key_[0-9]_normal_background_image$/).test(r.name)) selected.add(r.name);
    renderResources();
  });
  $('resourceList').onchange = e => { if (!e.target.dataset.check) return; e.target.checked ? selected.add(e.target.dataset.check) : selected.delete(e.target.dataset.check); renderResources(); };
  $('resourceList').onclick = async e => {
    if (busy) return; const assignButton = e.target.closest('[data-assign]'), clearButton = e.target.closest('[data-unassign]');
    const copy = e.target.closest('[data-copy-name]');
    if (copy) {
      const name = C.friendlyName(ruleMap.get(copy.dataset.copyName));
      try { await navigator.clipboard.writeText(name); toast('已复制：' + name + '（后缀请保留原文件格式）'); }
      catch { prompt('复制中文名，后缀请保留原文件格式：', name); }
      return;
    }
    if (assignButton) assign([assignButton.dataset.assign]);
    if (clearButton) { modes[mode].delete(clearButton.dataset.unassign); render(); }
  };
  $('selectVisible').onchange = e => { for (const r of filtered()) e.target.checked ? selected.add(r.name) : selected.delete(r.name); renderResources(); };
  $('clearSelection').onclick = () => { selected.clear(); renderResources(); };
  $('assignMany').onclick = () => assign([...selected]);
  $('autoMatch').onclick = () => { if (busy) return; const result = autoAssign(assets); render(); toast(`新增匹配 ${result.matched} 项，${result.conflicts} 个冲突未覆盖${result.ambiguous ? `，${result.ambiguous} 份名称有多个候选用途` : ''}`); };
  $('downloadNames').onclick = () => {
    const lines = ['小艺资源工具 · 简易中文命名对照表', '中文名仅用于本工具自动匹配，导出会转为标准英文名。', '保留实际文件格式：不要把 JPG 改后缀成 PNG，也不要把普通 PNG 改成 .9.png。', '不写状态即常规态；按下即按压态；前景第1～4层对应标准名0～3。', '上传前选择浅色/深色，或按 base / dark 文件夹导入。', '', '推荐中文名 → 标准名 | 允许格式', ...rules.map(r => `${C.friendlyName(r)} → ${r.name} | ${r.extensions.join(' / ')}`)];
    download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }), '小艺资源中文命名对照表.txt');
  };
  $('copyMode').onclick = () => {
    if (busy) return; const target = mode === 'base' ? 'dark' : 'base'; let n = 0;
    for (const [name, id] of modes[mode]) if (!modes[target].has(name)) { modes[target].set(name, id); n++; }
    render(); toast(`已复用 ${n} 项到${prettyMode(target)}，已有分配保持不变`);
  };
  $('prevPage').onclick = () => { page--; renderResources(); $('resourceList').scrollTop = 0; };
  $('nextPage').onclick = () => { page++; renderResources(); $('resourceList').scrollTop = 0; };
  $('review').onclick = () => {
    const entries = C.entries(modes, rules, assets);
    $('reviewList').innerHTML = entries.length ? entries.map(e => `<div class="review-row"><code>${e.path}</code><small>${esc(e.asset.name)} → ${esc(e.rule.module + ' / ' + e.rule.item + ' / ' + e.rule.state)} · 规范要求第 ${e.rule.row} 行</small><div class="${e.errors.length ? 'error-text' : ''}">${e.errors.length ? esc(e.errors.join('；')) : '通过 · ' + e.asset.width + ' × ' + e.asset.height + ' · ' + (e.asset.size / 1024).toFixed(1) + ' KB'}</div></div>`).join('') : '<p>尚未分配资源。</p>';
    $('reviewDialog').showModal();
  };
  $('closeReview').onclick = () => $('reviewDialog').close();
  $('exportZip').onclick = async () => {
    if (busy) return; const entries = C.entries(modes, rules, assets);
    if (!entries.length || entries.some(e => e.errors.length)) { toast('请先分配资源并修正校验问题'); return; }
    busy = true; renderSummary(); const old = $('exportZip').textContent;
    try {
      const archive = await C.zip([{ path: 'base/', bytes: new Uint8Array() }, { path: 'dark/', bytes: new Uint8Array() }, ...entries.map(e => ({ path: e.path, blob: e.asset.file }))], (n, total) => { $('exportZip').textContent = `打包 ${n} / ${total}`; });
      const name = $('zipName').value.replace(/\.zip$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim() || 'skins';
      download(archive, name + '.zip'); toast(`已导出 ${entries.length} 个资源，可在 Theme Studio Pro 中批量导入`);
    } catch (error) { toast('打包失败：' + error.message); }
    finally { busy = false; $('exportZip').textContent = old; renderSummary(); }
  };
  window.addEventListener('beforeunload', e => { if (assets.length) { e.preventDefault(); e.returnValue = ''; } });
  render();
})();
