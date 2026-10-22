/* My Nota — UI */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const mode = new URLSearchParams(location.search).get('mode') || 'popup';
  if (mode !== 'popup') document.documentElement.classList.add('wide');
  if (mode === 'panel') $('#btnPanel').hidden = true;

  // ให้ background ซิงก์ draft ที่ค้างหลัง popup ปิด
  chrome.runtime.connect({ name: 'nota-ui' });

  const TYPES = [
    { type: 'text', ico: 'text', label: 'ข้อความ', hint: 'Text', keys: 'text p paragraph' },
    { type: 'h1', ico: 'h1', label: 'หัวข้อใหญ่', hint: 'Heading 1', keys: 'h1 heading title' },
    { type: 'h2', ico: 'h2', label: 'หัวข้อย่อย', hint: 'Heading 2', keys: 'h2 heading subtitle' },
    { type: 'todo', ico: 'todo', label: 'To-do', hint: 'เช็กลิสต์', keys: 'todo check task list' },
    { type: 'bullet', ico: 'bullet', label: 'รายการ', hint: 'Bullet list', keys: 'bullet list ul' },
    { type: 'numbered', ico: 'numbered', label: 'รายการลำดับเลข', hint: 'Numbered list', keys: 'number numbered ol list' },
    { type: 'quote', ico: 'quote', label: 'อ้างอิง', hint: 'Quote', keys: 'quote blockquote' },
    { type: 'code', ico: 'code', label: 'บล็อกโค้ด', hint: 'Code + ไฮไลต์ภาษา', keys: 'code snippet program' },
    { type: 'draw', ico: 'brush', label: 'วาดรูป', hint: 'Drawing / Sketch', keys: 'draw sketch paint canvas' },
    { type: 'divider', ico: 'divider', label: 'เส้นคั่น', hint: 'Divider', keys: 'divider line hr' },
  ];
  // บล็อกที่ไม่มีช่องพิมพ์ — caret ข้ามไป
  const isStatic = t => t === 'divider' || t === 'draw';
  const LIST_TYPES = ['todo', 'bullet', 'numbered'];
  const PLACEHOLDER = {
    text: "พิมพ์อะไรก็ได้ หรือกด '/' เพื่อเลือกบล็อก", h1: 'หัวข้อ', h2: 'หัวข้อย่อย',
    todo: 'สิ่งที่ต้องทำ', bullet: 'รายการ', numbered: 'รายการ', quote: 'ข้อความอ้างอิง',
  };

  let notes = [];
  let current = null;
  let filter = 'all';
  let query = '';
  let lastBlockId = null;
  let slash = null; // { id, index }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = Highlight.esc;

  /* ================= utils ================= */
  function toast(msg, ms = 1800) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, ms);
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400 && d.getDate() === new Date().getDate()) {
      return 'วันนี้ ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function tilt(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
    return ((Math.abs(h) % 30) / 10 - 1.5).toFixed(2) + 'deg';
  }

  function getText(el) {
    let t = el.innerText;
    if (el.lastChild && el.lastChild.nodeName === 'BR') t = t.replace(/\n$/, '');
    return t.replace(/ /g, ' ');
  }

  /* ---------- rich text (เก็บแค่ <b> <i> <br>) ---------- */
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const walk = node => {
      let out = '';
      for (const c of node.childNodes) {
        if (c.nodeType === Node.TEXT_NODE) { out += esc(c.data.replace(/ /g, ' ')); continue; }
        if (c.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = c.tagName;
        if (tag === 'BR') { out += '<br>'; continue; }
        let inner = walk(c);
        if (!inner) continue;
        const st = c.style || {};
        const bold = tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(st.fontWeight || '');
        const ital = tag === 'I' || tag === 'EM' || st.fontStyle === 'italic';
        if (ital) inner = `<i>${inner}</i>`;
        if (bold) inner = `<b>${inner}</b>`;
        if ((tag === 'DIV' || tag === 'P') && out && !out.endsWith('<br>')) out += '<br>';
        out += inner;
      }
      return out;
    };
    return walk(doc.body).replace(/<\/b><b>|<\/i><i>/g, '').replace(/<br>$/, '');
  }

  function textOf(clean) {
    const d = document.createElement('div');
    d.innerHTML = clean.replace(/<br>/g, '\n');
    return d.textContent;
  }

  const htmlOf = b => b.html || esc(b.text || '');

  // ตั้งค่าเนื้อหาบล็อกจาก HTML — เก็บ html เฉพาะเมื่อมีตัวหนา/เอียงจริง
  function setContent(b, html) {
    const clean = sanitize(html);
    b.text = textOf(clean);
    if (/<[bi]>/.test(clean)) b.html = clean; else delete b.html;
  }

  function deleteLeading(el, n) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while (n > 0 && (node = w.nextNode())) {
      const k = Math.min(n, node.length);
      node.deleteData(0, k);
      n -= k;
    }
  }

  function caretAt(el, where) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const r = sel.getRangeAt(0);
    const probe = document.createRange();
    probe.selectNodeContents(el);
    if (where === 'start') probe.setEnd(r.startContainer, r.startOffset);
    else probe.setStart(r.startContainer, r.startOffset);
    const frag = probe.cloneContents();
    const brs = frag.querySelectorAll('br').length;
    // ท้ายบล็อกอาจมี <br> ค้างไว้ 1 อันเป็น placeholder ของ Chrome
    return probe.toString() === '' && brs <= (where === 'end' ? 1 : 0);
  }

  function caretOffset(el) {
    const sel = getSelection();
    if (!sel.rangeCount) return 0;
    const r = sel.getRangeAt(0);
    const pre = r.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }

  function setCaret(el, pos = Infinity) {
    el.focus();
    const sel = getSelection();
    const r = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    let left = pos;
    while ((node = walker.nextNode())) {
      if (left <= node.length) {
        r.setStart(node, left);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }
      left -= node.length;
    }
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function placePopover(pop, anchorRect) {
    pop.hidden = false;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let x = Math.min(anchorRect.left, innerWidth - w - 8);
    let y = anchorRect.bottom + 4;
    if (y + h > innerHeight - 8) y = Math.max(8, anchorRect.top - h - 4);
    pop.style.left = Math.max(8, x) + 'px';
    pop.style.top = y + 'px';
  }

  function closePopovers(except) {
    $$('.popover').forEach(p => {
      if (p === except || p.hidden) return;
      p.hidden = true;
      if (p.onclose) { p.onclose(); p.onclose = null; }
    });
    if (except !== $('#slashMenu')) slash = null;
  }

  /* ================= status / quota ================= */
  Store.onStatus((state, msg) => {
    const el = $('#sync');
    el.className = 'sync ' + state;
    const text = msg || {
      synced: 'ซิงก์แล้ว',
      saving: 'กำลังซิงก์…',
      pending: 'บันทึกในเครื่องแล้ว · รอซิงก์',
      error: 'ซิงก์ไม่สำเร็จ',
    }[state];
    $('#syncText').textContent = text;
    el.title = text;
    if (state === 'synced') updateQuota();
  });

  async function updateQuota() {
    try {
      const { used, total } = await Store.usage();
      const pct = Math.min(100, (used / total) * 100);
      $('#quotaFill').style.width = pct + '%';
      $('#quotaText').textContent = `${(used / 1024).toFixed(1)}/${Math.round(total / 1024)} KB`;
      $('#quota').className = 'quota' + (pct > 95 ? ' full' : pct > 75 ? ' warn' : '');
    } catch (e) { /* ignore */ }
  }

  /* ================= board ================= */
  function noteHasCode(n) { return n.blocks.some(b => b.type === 'code' && b.text.trim()); }

  function noteSearchText(n) {
    return (n.title + '\n' + n.blocks.map(b => b.text || '').join('\n')).toLowerCase();
  }

  function highlightQuery(text) {
    const safe = esc(text);
    if (!query) return safe;
    const q = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(q, 'gi'), m => `<mark>${m}</mark>`);
  }

  function renderBoard() {
    const board = $('#board');
    const list = notes
      .filter(n => filter !== 'pinned' || n.pinned)
      .filter(n => filter !== 'code' || noteHasCode(n))
      .filter(n => !query || noteSearchText(n).includes(query.toLowerCase()))
      .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));

    $('#empty').hidden = notes.length > 0;
    board.hidden = notes.length === 0;
    board.innerHTML = '';

    if (notes.length && !list.length) {
      board.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft)">ไม่พบโน้ตที่ตรงกัน</p>`;
      return;
    }

    for (const n of list) {
      const card = document.createElement('button');
      card.className = 'card';
      NoteColors.paint(card, n.color);
      card.style.setProperty('--tilt', tilt(n.id));
      const lines = [];
      let code = null;
      const sketch = n.blocks.find(b => b.type === 'draw' && b.strokes && b.strokes.length);
      for (const b of n.blocks) {
        if (b.type === 'code') { if (!code && b.text.trim()) code = b.text; continue; }
        if (isStatic(b.type) || !b.text) continue;
        const pre = b.type === 'todo' ? Icons.svg(b.checked ? 'todo' : 'box') : b.type === 'bullet' ? '• ' : '';
        lines.push(pre + highlightQuery(b.text));
        if (lines.length > 6) break;
      }
      const codePreview = code ? code.split('\n').slice(0, 3).join('\n') : '';
      card.innerHTML = `
        ${n.pinned ? `<span class="c-pin">${Icons.svg('pin')}</span>` : ''}
        <div class="c-title">${highlightQuery(n.title || 'ไม่มีชื่อ')}</div>
        <div class="c-body">${lines.join('\n')}</div>
        ${sketch ? '<div class="c-sketch"></div>' : ''}
        ${codePreview ? `<div class="c-code">${esc(codePreview)}</div>` : ''}
        <div class="c-foot"><span>${fmtDate(n.updated)}</span><span class="c-tags">${sketch ? Icons.svg('brush') : ''}${code ? Icons.svg('code') : ''}</span></div>`;
      if (sketch) card.querySelector('.c-sketch').appendChild(Sketch.thumb(sketch, document.documentElement.classList.contains('wide') ? 180 : 150));
      card.addEventListener('click', () => openNote(n.id));
      board.appendChild(card);
    }
  }

  /* ================= notes ================= */
  function newNote() {
    const color = localGet('lastColor') || 'yellow';
    const n = {
      id: uid(), title: '', color, pinned: false,
      created: Date.now(), updated: Date.now(),
      blocks: [{ id: uid(), type: 'text', text: '' }],
    };
    notes.push(n);
    openNote(n.id, true);
  }

  function isEmptyNote(n) {
    return !n.title.trim() && n.blocks.every(b => !(b.text || '').trim() && !isStatic(b.type));
  }

  function openNote(id, focusTitle = false) {
    current = notes.find(n => n.id === id);
    if (!current) return;
    if (!current.blocks.length) current.blocks.push({ id: uid(), type: 'text', text: '' });
    localSet('openId', id);
    $('#listView').hidden = true;
    $('#editorView').hidden = false;
    renderEditor();
    $('#paperWrap').scrollTop = 0;
    if (focusTitle || !current.title) setCaret($('#title'));
  }

  function closeEditor() {
    closePopovers();
    if (current && isEmptyNote(current)) {
      notes = notes.filter(n => n !== current);
      Store.remove(current.id);
    }
    current = null;
    localSet('openId', '');
    $('#editorView').hidden = true;
    $('#listView').hidden = false;
    renderBoard();
  }

  function touch() {
    if (!current) return;
    current.updated = Date.now();
    Store.save(current);
    $('#meta').textContent = 'แก้ไขล่าสุด ' + fmtDate(current.updated);
  }

  /* ================= editor ================= */
  function renderEditor() {
    $('#title').textContent = current.title;
    $('#btnPin').classList.toggle('on', !!current.pinned);
    $('#meta').textContent = 'แก้ไขล่าสุด ' + fmtDate(current.updated);
    resetDeleteBtn();

    const colors = $('#colors');
    colors.innerHTML = '';
    for (const c of NoteColors.QUICK) {
      const b = document.createElement('button');
      b.dataset.c = c;
      b.title = c;
      b.style.background = NoteColors.hexOf(c);
      b.addEventListener('click', () => setNoteColor(c));
      colors.appendChild(b);
    }
    const more = document.createElement('button');
    more.className = 'more';
    more.id = 'btnColorMore';
    more.title = 'สีเพิ่มเติม / กำหนดสีเอง';
    more.innerHTML = Icons.svg('palette');
    more.addEventListener('click', e => openColorPop(e.currentTarget));
    colors.appendChild(more);
    setNoteColor(current.color, false);

    const wrap = $('#blocks');
    wrap.innerHTML = '';
    for (const b of current.blocks) wrap.appendChild(renderBlock(b));
  }

  /* ---------- สีโน้ต ---------- */
  function setNoteColor(c, save = true) {
    current.color = c;
    NoteColors.paint($('#paper'), c);
    const custom = !NoteColors.PRESETS[c];
    $$('#colors button[data-c]').forEach(x => x.classList.toggle('sel', x.dataset.c === c));
    const more = $('#btnColorMore');
    if (more) {
      more.classList.toggle('sel', custom || !NoteColors.QUICK.includes(c));
      more.style.setProperty('--sw', NoteColors.QUICK.includes(c) ? 'transparent' : NoteColors.hexOf(c));
    }
    if (save) {
      localSet('lastColor', c);
      touch();
    }
  }

  function recentColors() {
    try { return JSON.parse(localGet('recentColors') || '[]').filter(NoteColors.isHex); } catch (e) { return []; }
  }
  function rememberColor(hex) {
    localSet('recentColors', JSON.stringify([hex, ...recentColors().filter(x => x !== hex)].slice(0, 6)));
  }

  function openColorPop(anchor) {
    const pop = $('#colorPop');
    const sw = (c, hex) => `<button class="sw${current.color === c ? ' sel' : ''}" data-c="${c}" title="${c}" style="background:${hex}"></button>`;
    const recent = recentColors();
    pop.innerHTML = NoteColors.GROUPS.map(([name, map]) =>
      `<div class="head">${name}</div><div class="swatches">${Object.entries(map).map(([c, hex]) => sw(c, hex)).join('')}</div>`).join('') + `
      <div class="sep"></div>
      <div class="head">กำหนดสีเอง</div>
      <div class="custom">
        <span class="preview"></span>
        <input class="hex" maxlength="7" spellcheck="false" placeholder="#ffcc00">
      </div>
      <label class="slider"><span>สี</span><input type="range" class="h" min="0" max="360"></label>
      <label class="slider"><span>สด</span><input type="range" class="s" min="0" max="100"></label>
      <label class="slider"><span>สว่าง</span><input type="range" class="l" min="5" max="95"></label>
      ${recent.length ? `<div class="head">ใช้ล่าสุด</div><div class="swatches">${recent.map(h => sw(h, h)).join('')}</div>` : ''}`;

    const hexIn = $('.hex', pop);
    const [hIn, sIn, lIn] = ['.h', '.s', '.l'].map(s => $(s, pop));
    const sync = hex => {
      const [h, s, l] = NoteColors.toHsl(hex);
      hIn.value = Math.round(h); sIn.value = Math.round(s * 100); lIn.value = Math.round(l * 100);
      hexIn.value = hex;
      paintSliders();
    };
    const paintSliders = () => {
      const h = +hIn.value, s = sIn.value / 100, l = lIn.value / 100;
      $('.preview', pop).style.background = NoteColors.fromHsl(h, s, l);
      hIn.style.background = `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map(x => NoteColors.fromHsl(x, s || 0.7, 0.6)).join(',')})`;
      sIn.style.background = `linear-gradient(90deg, ${NoteColors.fromHsl(h, 0, l)}, ${NoteColors.fromHsl(h, 1, l)})`;
      lIn.style.background = `linear-gradient(90deg, ${NoteColors.fromHsl(h, s, 0.05)}, ${NoteColors.fromHsl(h, s, 0.5)}, ${NoteColors.fromHsl(h, s, 0.95)})`;
    };
    const markSel = () => $$('.sw', pop).forEach(x => x.classList.toggle('sel', x.dataset.c === current.color));
    let picked = null;

    sync(NoteColors.hexOf(current.color));
    $$('.sw', pop).forEach(b => b.addEventListener('click', () => {
      setNoteColor(b.dataset.c);
      sync(NoteColors.hexOf(b.dataset.c));
      markSel();
    }));
    [hIn, sIn, lIn].forEach(inp => inp.addEventListener('input', () => {
      const hex = NoteColors.fromHsl(+hIn.value, sIn.value / 100, lIn.value / 100);
      hexIn.value = hex;
      paintSliders();
      setNoteColor(hex);
      picked = hex;
      markSel();
    }));
    hexIn.addEventListener('input', () => {
      let v = hexIn.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map(x => x + x).join('');
      if (!NoteColors.isHex(v)) return;
      v = v.toLowerCase();
      const [h, s, l] = NoteColors.toHsl(v);
      hIn.value = Math.round(h); sIn.value = Math.round(s * 100); lIn.value = Math.round(l * 100);
      paintSliders();
      setNoteColor(v);
      picked = v;
      markSel();
    });
    // จำสีที่กำหนดเองไว้ในแถว "ใช้ล่าสุด" ตอนปิดหน้าต่างสี
    pop.onclose = () => { if (picked && picked === current?.color) rememberColor(picked); };

    closePopovers(pop);
    placePopover(pop, anchor.getBoundingClientRect());
  }

  const blockEl = id => $(`.block[data-id="${id}"]`);
  const blockIndex = id => current.blocks.findIndex(b => b.id === id);

  function renderBlock(b) {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.id = b.id;
    el.dataset.type = b.type;

    const handle = document.createElement('button');
    handle.className = 'handle';
    handle.title = 'ตัวเลือกบล็อก';
    handle.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
    handle.addEventListener('click', e => openBlockMenu(b, e.currentTarget));
    el.appendChild(handle);

    if (b.type === 'divider') {
      el.appendChild(document.createElement('hr'));
      return el;
    }
    if (b.type === 'code') {
      el.appendChild(renderCode(b));
      return el;
    }
    if (b.type === 'draw') {
      el.appendChild(Sketch.create(b, touch));
      return el;
    }

    if (b.type === 'todo') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'check';
      cb.checked = !!b.checked;
      el.classList.toggle('done', !!b.checked);
      cb.addEventListener('change', () => {
        b.checked = cb.checked;
        el.classList.toggle('done', cb.checked);
        touch();
      });
      el.appendChild(cb);
    } else if (b.type === 'bullet' || b.type === 'numbered') {
      const m = document.createElement('span');
      m.className = 'mark';
      el.appendChild(m);
    }

    const txt = document.createElement('div');
    txt.className = 'txt';
    txt.contentEditable = 'true';
    txt.spellcheck = false;
    txt.dataset.placeholder = PLACEHOLDER[b.type] || '';
    if (b.html) txt.innerHTML = sanitize(b.html); else txt.textContent = b.text;
    txt.addEventListener('focus', () => { lastBlockId = b.id; });
    // วางเป็นข้อความล้วน ไม่เอาสไตล์จากเว็บอื่นมา
    txt.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    txt.addEventListener('drop', e => e.preventDefault());
    txt.addEventListener('input', () => onTextInput(b, txt));
    txt.addEventListener('keydown', e => onTextKey(e, b, txt));
    el.appendChild(txt);
    return el;
  }

  function renderCode(b) {
    const box = document.createElement('div');
    box.className = 'code';
    // จัดกลุ่มภาษาใน dropdown ตาม group
    const groups = {};
    for (const [k, v] of Object.entries(Highlight.LANGS)) (groups[v.group] = groups[v.group] || []).push([k, v]);
    const opt = ([k, v]) => `<option value="${k}"${k === (b.lang || 'plain') ? ' selected' : ''}>${v.label}</option>`;
    const opts = Object.entries(groups).map(([g, list]) =>
      g ? `<optgroup label="${g}">${list.map(opt).join('')}</optgroup>` : list.map(opt).join('')).join('');
    box.innerHTML = `
      <div class="code-head">
        <select title="ภาษา">${opts}</select>
        <span class="sp"></span>
        <button class="copy">${Icons.svg('copy')}คัดลอก</button>
      </div>
      <div class="code-body"><pre></pre><textarea spellcheck="false" placeholder="วางหรือพิมพ์โค้ดที่นี่…"></textarea></div>`;
    const sel = $('select', box);
    const pre = $('pre', box);
    const ta = $('textarea', box);
    ta.value = b.text;
    const paint = () => { pre.innerHTML = Highlight.code(ta.value, b.lang || 'plain') + '\n'; };
    paint();

    sel.addEventListener('change', () => { b.lang = sel.value; paint(); touch(); });
    $('.copy', box).addEventListener('click', async () => {
      await navigator.clipboard.writeText(ta.value);
      toast('คัดลอกโค้ดแล้ว');
    });
    ta.addEventListener('focus', () => { lastBlockId = b.id; });
    ta.addEventListener('input', () => { b.text = ta.value; paint(); touch(); });
    ta.addEventListener('blur', () => {
      // ยังเป็น Plain text อยู่ -> ลองเดาภาษาให้อัตโนมัติ
      if ((b.lang || 'plain') !== 'plain' || !ta.value.trim()) return;
      const g = Highlight.guess(ta.value);
      if (g) { b.lang = g; sel.value = g; paint(); touch(); }
    });
    ta.addEventListener('paste', () => {
      if ((b.lang || 'plain') !== 'plain' || ta.value.trim()) return;
      setTimeout(() => {
        const g = Highlight.guess(ta.value);
        if (g) { b.lang = g; sel.value = g; paint(); touch(); }
      });
    });
    ta.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: en, value: v } = ta;
        if (e.shiftKey) {
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          const n = v.slice(ls).match(/^ {1,2}/)?.[0].length || 0;
          if (n) {
            ta.setSelectionRange(ls, ls + n);
            document.execCommand('delete');
            ta.setSelectionRange(Math.max(ls, s - n), Math.max(ls, en - n));
          }
        } else {
          document.execCommand('insertText', false, '  ');
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        focusNextOrCreate(b);
      } else if (e.key === 'Enter') {
        // คงระยะย่อหน้าของบรรทัดเดิม
        e.preventDefault();
        const v = ta.value;
        const ls = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
        let indent = v.slice(ls).match(/^[ \t]*/)[0];
        if (/[{[(:]$/.test(v.slice(0, ta.selectionStart).trimEnd())) indent += '  ';
        document.execCommand('insertText', false, '\n' + indent);
      } else if (/^[}\])]$/.test(e.key) && ta.selectionStart === ta.selectionEnd) {
        // พิมพ์วงเล็บปิดบนบรรทัดว่าง -> ถอยย่อหน้า
        const s = ta.selectionStart;
        const ls = ta.value.lastIndexOf('\n', s - 1) + 1;
        if (/^ {2,}$/.test(ta.value.slice(ls, s))) {
          ta.setSelectionRange(s - 2, s);
          document.execCommand('delete');
        }
      } else if (e.key === 'Backspace' && !ta.value) {
        e.preventDefault();
        changeType(b, 'text');
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        ta.blur();
      } else if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length) {
        e.preventDefault();
        focusNextOrCreate(b);
      } else if (e.key === 'ArrowUp' && ta.selectionStart === 0) {
        const prev = current.blocks[blockIndex(b.id) - 1];
        if (prev) { e.preventDefault(); focusBlock(prev.id, Infinity); }
      }
    });
    return box;
  }

  function focusBlock(id, pos = 0) {
    const el = blockEl(id);
    if (!el) return;
    const ta = $('textarea', el);
    if (ta) {
      ta.focus();
      const p = pos === Infinity ? ta.value.length : pos;
      ta.setSelectionRange(p, p);
      return;
    }
    const txt = $('.txt', el);
    if (txt) setCaret(txt, pos);
  }

  function focusNextOrCreate(b) {
    const i = blockIndex(b.id);
    const next = current.blocks[i + 1];
    if (next && !isStatic(next.type)) focusBlock(next.id, 0);
    else insertBlockAfter(b.id, { type: 'text', text: '' });
  }

  function insertBlockAfter(afterId, data, focus = true) {
    const b = { id: uid(), text: '', ...data };
    if (b.type === 'code' && !b.lang) b.lang = localGet('lastLang') || 'plain';
    const i = afterId ? blockIndex(afterId) : current.blocks.length - 1;
    current.blocks.splice(i + 1, 0, b);
    const el = renderBlock(b);
    const ref = afterId && blockEl(afterId);
    if (ref) ref.after(el); else $('#blocks').appendChild(el);
    touch();
    if (focus) focusBlock(b.id, 0);
    return b;
  }

  function removeBlock(b, focusPrev = true) {
    const i = blockIndex(b.id);
    if (i < 0) return;
    current.blocks.splice(i, 1);
    blockEl(b.id)?.remove();
    if (!current.blocks.length) {
      insertBlockAfter(null, { type: 'text', text: '' });
      return;
    }
    touch();
    if (focusPrev) {
      const prev = current.blocks[Math.max(0, i - 1)];
      focusBlock(prev.id, Infinity);
    }
  }

  function rerenderBlock(b) {
    const old = blockEl(b.id);
    const el = renderBlock(b);
    old.replaceWith(el);
    return el;
  }

  function changeType(b, type) {
    b.type = type;
    if (type === 'code') {
      b.lang = b.lang || localGet('lastLang') || 'plain';
      delete b.html;
    } else {
      delete b.lang;
    }
    if (type !== 'todo') delete b.checked;
    if (type !== 'draw') { delete b.strokes; delete b.h; }
    if (isStatic(type)) {
      b.text = '';
      delete b.html;
      rerenderBlock(b);
      const next = current.blocks[blockIndex(b.id) + 1];
      if (next && !isStatic(next.type)) focusBlock(next.id, 0);
      else insertBlockAfter(b.id, { type: 'text' });
      touch();
      return;
    }
    rerenderBlock(b);
    touch();
    focusBlock(b.id, type === 'code' ? Infinity : 0);
  }

  function moveBlock(b, dir) {
    const i = blockIndex(b.id);
    const j = i + dir;
    if (j < 0 || j >= current.blocks.length) return;
    [current.blocks[i], current.blocks[j]] = [current.blocks[j], current.blocks[i]];
    const el = blockEl(b.id);
    if (dir < 0) el.previousElementSibling.before(el); else el.nextElementSibling.after(el);
    touch();
  }

  /* ---------- text block events ---------- */
  const MD = [
    [/^##\s/, 'h2'], [/^#\s/, 'h1'], [/^[-*•]\s/, 'bullet'], [/^1[.)]\s/, 'numbered'],
    [/^\[\s?\]\s/, 'todo'], [/^>\s/, 'quote'],
  ];

  function onTextInput(b, txt) {
    setContent(b, txt.innerHTML);
    const text = b.text;
    if (!text && !b.html && txt.querySelector('br')) txt.innerHTML = ''; // ให้ placeholder กลับมา

    // markdown shortcuts
    if (b.type === 'text' || b.type === 'bullet') {
      if (text === '```' || text === '---') {
        b.text = '';
        delete b.html;
        changeType(b, text === '```' ? 'code' : 'divider');
        return;
      }
      for (const [re, type] of MD) {
        const m = re.exec(text);
        if (m && type !== b.type) {
          deleteLeading(txt, m[0].length);
          setContent(b, txt.innerHTML);
          changeType(b, type);
          return;
        }
      }
    }

    // slash menu
    if (text.startsWith('/') && !text.includes('\n') && text.length < 20) {
      openSlash(b, txt, text.slice(1));
    } else if (slash && slash.id === b.id) {
      closePopovers();
    }
    touch();
  }

  function onTextKey(e, b, txt) {
    if (e.isComposing || e.keyCode === 229) return;

    if (slash && slash.id === b.id && !$('#slashMenu').hidden) {
      const items = $$('#slashMenu button');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        slash.index = (slash.index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((x, i) => x.classList.toggle('hl', i === slash.index));
        items[slash.index]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        items[slash.index]?.click();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePopovers();
        return;
      }
    }

    // ตัวหนา / ตัวเอียง
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[bi]$/i.test(e.key)) {
      e.preventDefault();
      document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
      return;
    }

    const sel = getSelection();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (LIST_TYPES.includes(b.type) && !b.text) { changeType(b, 'text'); return; }
      // ตัดเนื้อหาหลัง caret (พร้อมรูปแบบตัวหนา/เอียง) ไปบล็อกใหม่
      const r = sel.getRangeAt(0);
      if (!r.collapsed) r.deleteContents();
      const tail = document.createRange();
      tail.setStart(r.startContainer, r.startOffset);
      tail.setEnd(txt, txt.childNodes.length);
      const holder = document.createElement('div');
      holder.appendChild(tail.extractContents());
      setContent(b, txt.innerHTML);
      if (!b.text) txt.innerHTML = '';
      const nb = { type: LIST_TYPES.includes(b.type) ? b.type : 'text' };
      setContent(nb, holder.innerHTML);
      insertBlockAfter(b.id, nb);
      return;
    }

    if (e.key === 'Backspace' && caretAt(txt, 'start')) {
      if (b.type !== 'text') {
        e.preventDefault();
        changeType(b, 'text');
        return;
      }
      const i = blockIndex(b.id);
      const prev = current.blocks[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (prev.type === 'divider') { removeBlock(prev, false); focusBlock(b.id, 0); return; }
      if (prev.type === 'draw') {
        if (!b.text) { removeBlock(b, false); blockEl(prev.id).scrollIntoView({ block: 'nearest' }); }
        return;
      }
      if (prev.type === 'code') {
        if (!b.text) removeBlock(b, true);
        else focusBlock(prev.id, Infinity);
        return;
      }
      const len = $('.txt', blockEl(prev.id)).textContent.length;
      setContent(prev, htmlOf(prev) + htmlOf(b));
      removeBlock(b, false);
      rerenderBlock(prev);
      focusBlock(prev.id, len);
      return;
    }

    if (e.key === 'ArrowUp' && caretAt(txt, 'start')) {
      const prev = current.blocks[blockIndex(b.id) - 1];
      if (prev) {
        e.preventDefault();
        if (isStatic(prev.type)) {
          let k = blockIndex(b.id) - 1;
          while (current.blocks[k] && isStatic(current.blocks[k].type)) k--;
          if (current.blocks[k]) focusBlock(current.blocks[k].id, Infinity);
        } else focusBlock(prev.id, Infinity);
      } else {
        e.preventDefault();
        setCaret($('#title'));
      }
      return;
    }
    if (e.key === 'ArrowDown' && caretAt(txt, 'end')) {
      let i = blockIndex(b.id) + 1;
      while (current.blocks[i] && isStatic(current.blocks[i].type)) i++;
      if (current.blocks[i]) { e.preventDefault(); focusBlock(current.blocks[i].id, 0); }
    }
  }

  /* ---------- slash menu ---------- */
  function typeMenuHTML(items, hlIndex) {
    return items.map((t, i) => `
      <button data-type="${t.type}" class="${i === hlIndex ? 'hl' : ''}">
        <span class="ico">${Icons.svg(t.ico)}</span>
        <span class="lbl">${t.label}<small>${t.hint}</small></span>
      </button>`).join('');
  }

  function openSlash(b, txt, q) {
    const ql = q.toLowerCase().trim();
    const items = TYPES.filter(t => !ql || t.label.includes(ql) ||
      (t.hint + ' ' + t.keys).toLowerCase().split(/\s+/).some(w => w.startsWith(ql)));
    const pop = $('#slashMenu');
    if (!items.length) { pop.hidden = true; slash = null; return; }
    slash = { id: b.id, index: 0 };
    pop.innerHTML = '<div class="head">บล็อกพื้นฐาน</div>' + typeMenuHTML(items, 0);
    $$('button', pop).forEach(btn => btn.addEventListener('mousedown', e => e.preventDefault()));
    $$('button', pop).forEach(btn => btn.addEventListener('click', () => {
      b.text = '';
      delete b.html;
      txt.textContent = '';
      closePopovers();
      changeType(b, btn.dataset.type);
    }));
    closePopovers(pop);
    placePopover(pop, txt.getBoundingClientRect());
  }

  /* ---------- block menu ---------- */
  function openBlockMenu(b, anchor) {
    const pop = $('#blockMenu');
    const others = TYPES.filter(t => t.type !== b.type);
    pop.innerHTML = `
      <button data-act="up"><span class="ico">${Icons.svg('up')}</span>เลื่อนขึ้น</button>
      <button data-act="down"><span class="ico">${Icons.svg('down')}</span>เลื่อนลง</button>
      <button data-act="dup"><span class="ico">${Icons.svg('copy')}</span>ทำสำเนา</button>
      <button data-act="del" class="danger"><span class="ico">${Icons.svg('trash')}</span>ลบบล็อก</button>
      <div class="sep"></div><div class="head">เปลี่ยนเป็น</div>
      ${typeMenuHTML(others, -1)}`;
    $$('button', pop).forEach(btn => btn.addEventListener('click', () => {
      closePopovers();
      const act = btn.dataset.act;
      if (act === 'up') moveBlock(b, -1);
      else if (act === 'down') moveBlock(b, 1);
      else if (act === 'dup') {
        const copy = JSON.parse(JSON.stringify(b));
        delete copy.id;
        insertBlockAfter(b.id, copy);
      } else if (act === 'del') removeBlock(b);
      else if (btn.dataset.type) changeType(b, btn.dataset.type);
    }));
    closePopovers(pop);
    placePopover(pop, anchor.getBoundingClientRect());
  }

  /* insert from quickbar / add button */
  function insertType(type) {
    const ref = current.blocks.find(x => x.id === lastBlockId) || current.blocks[current.blocks.length - 1];
    if (ref && ref.type === 'text' && !ref.text) { changeType(ref, type); return; }
    const nb = insertBlockAfter(ref ? ref.id : null, { type, text: '' }, !isStatic(type));
    if (isStatic(type)) insertBlockAfter(nb.id, { type: 'text' }, false);
  }

  /* ================= delete / pin ================= */
  function resetDeleteBtn() {
    const btn = $('#btnDelete');
    btn.classList.remove('confirm');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
    clearTimeout(resetDeleteBtn.t);
  }

  $('#btnDelete').addEventListener('click', () => {
    const btn = $('#btnDelete');
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'ยืนยันลบ?';
      resetDeleteBtn.t = setTimeout(resetDeleteBtn, 3000);
      return;
    }
    const id = current.id;
    notes = notes.filter(n => n.id !== id);
    Store.remove(id);
    current = null;
    closeEditor();
    toast('ลบโน้ตแล้ว');
  });

  $('#btnPin').addEventListener('click', () => {
    current.pinned = !current.pinned;
    $('#btnPin').classList.toggle('on', current.pinned);
    touch();
  });

  /* ================= title ================= */
  const title = $('#title');
  title.addEventListener('input', () => {
    current.title = getText(title).replace(/\n/g, ' ');
    touch();
  });
  title.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && caretOffset(title) === getText(title).length)) {
      e.preventDefault();
      const first = current.blocks[0];
      if (first && !isStatic(first.type)) focusBlock(first.id, 0);
      else insertBlockAfter(null, { type: 'text' });
    }
  });

  /* ================= global events ================= */
  $('#btnNew').addEventListener('click', newNote);
  $('#btnBack').addEventListener('click', closeEditor);
  $('#btnAddBlock').addEventListener('click', () => {
    const last = current.blocks[current.blocks.length - 1];
    if (last && last.type === 'text' && !last.text) focusBlock(last.id);
    else insertBlockAfter(last ? last.id : null, { type: 'text' });
  });
  $$('.quickbar button').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => {
      if (btn.dataset.format) {
        if (document.activeElement?.classList.contains('txt')) document.execCommand(btn.dataset.format);
        else toast('เลือกข้อความในบล็อกก่อน แล้วกด ' + btn.textContent);
      } else insertType(btn.dataset.insert);
    });
  });

  $('#search').addEventListener('input', e => { query = e.target.value.trim(); renderBoard(); });
  $('#filters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    $$('.chip').forEach(c => c.classList.toggle('active', c === chip));
    renderBoard();
  });

  let windowId = null;
  chrome.windows?.getCurrent?.(w => { windowId = w && w.id; });
  $('#btnPanel').addEventListener('click', async () => {
    try {
      await chrome.sidePanel.open({ windowId });
      window.close();
    } catch (err) {
      toast('เปิด Side Panel ไม่ได้: ' + err.message, 3000);
    }
  });

  $('#btnMenu').addEventListener('click', e => {
    const pop = $('#mainMenu');
    closePopovers(pop);
    placePopover(pop, e.currentTarget.getBoundingClientRect());
    // ชิดขอบขวาของปุ่ม
    pop.style.left = Math.max(8, e.currentTarget.getBoundingClientRect().right - pop.offsetWidth) + 'px';
  });
  $('#mainMenu').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    closePopovers();
    if (act === 'export') exportNotes();
    if (act === 'import') $('#importFile').click();
    if (act === 'tab') chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=tab') });
  });
  $('#importFile').addEventListener('change', importNotes);

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.popover') && !e.target.closest('#btnMenu, #btnColorMore, .handle')) closePopovers();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if ($$('.popover').some(p => !p.hidden)) { closePopovers(); return; }
      if (current) { e.preventDefault(); closeEditor(); }
    }
    if (e.key.toLowerCase() === 'n' && e.ctrlKey && e.altKey) { e.preventDefault(); if (current) closeEditor(); newNote(); }
    if (e.key === 'f' && (e.ctrlKey || e.metaKey) && !current) { e.preventDefault(); $('#search').focus(); }
  });

  addEventListener('pagehide', () => { Store.flush(); });

  /* ================= import / export ================= */
  function exportNotes() {
    const data = JSON.stringify({ app: 'my-nota', version: 1, exported: new Date().toISOString(), notes }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `my-nota-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importNotes(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.notes;
      if (!Array.isArray(list)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
      let count = 0;
      for (const n of list) {
        if (!n || !n.id || !Array.isArray(n.blocks)) continue;
        const cur = notes.find(x => x.id === n.id);
        if (cur && cur.updated >= n.updated) continue;
        const note = {
          id: String(n.id), title: String(n.title || ''),
          color: NoteColors.isValid(n.color) ? n.color : 'yellow', pinned: !!n.pinned,
          created: n.created || Date.now(), updated: n.updated || Date.now(), blocks: n.blocks,
        };
        if (cur) Object.assign(cur, note); else notes.push(note);
        Store.save(note);
        count++;
      }
      renderBoard();
      toast(`นำเข้า ${count} โน้ต`);
    } catch (err) {
      toast('นำเข้าไม่สำเร็จ: ' + err.message, 3000);
    }
  }

  /* ================= remote sync ================= */
  Store.onRemote((remote, draftIds) => {
    const map = new Map(notes.map(n => [n.id, n]));
    const remoteIds = new Set(remote.map(n => n.id));
    let currentChanged = false;
    let currentDeleted = false;
    for (const r of remote) {
      const l = map.get(r.id);
      if (!l || (r.updated > l.updated && !draftIds.has(r.id))) {
        map.set(r.id, r);
        if (current && current.id === r.id) currentChanged = true;
      }
    }
    for (const id of [...map.keys()]) {
      if (!remoteIds.has(id) && !draftIds.has(id)) {
        map.delete(id);
        if (current && current.id === id) currentDeleted = true;
      }
    }
    notes = [...map.values()];
    if (currentDeleted) {
      current = null;
      closeEditor();
      toast('โน้ตนี้ถูกลบจากเครื่องอื่น');
    } else if (currentChanged) {
      const scroll = $('#paperWrap').scrollTop;
      current = map.get(current.id);
      renderEditor();
      $('#paperWrap').scrollTop = scroll;
      toast('อัปเดตจากเครื่องอื่นแล้ว');
    } else if (!current) {
      renderBoard();
    }
    updateQuota();
  });

  /* ================= local prefs ================= */
  function localGet(k) { try { return localStorage.getItem('nota:' + k); } catch (e) { return null; } }
  function localSet(k, v) { try { localStorage.setItem('nota:' + k, v); } catch (e) { /* ignore */ } }

  /* ================= boot ================= */
  // จำภาษาโค้ดที่ใช้ล่าสุด
  document.addEventListener('change', e => {
    if (e.target.matches('.code-head select')) localSet('lastLang', e.target.value);
  });

  (async () => {
    try {
      notes = await Store.loadAll();
    } catch (err) {
      toast('โหลดโน้ตไม่สำเร็จ: ' + err.message, 4000);
      notes = [];
    }
    if (!Store.hasDrafts()) {
      $('#sync').className = 'sync synced';
      $('#syncText').textContent = 'ซิงก์แล้ว';
    }
    updateQuota();
    const openId = localGet('openId');
    if (openId && notes.some(n => n.id === openId)) openNote(openId);
    else renderBoard();
  })();
})();
