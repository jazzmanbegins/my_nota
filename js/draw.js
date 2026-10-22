/*
 * บล็อกวาดรูป — เก็บเป็นเส้น (vector) ไม่ใช่รูปภาพ เพื่อให้พอดีกับโควต้า Chrome Sync 100KB
 * block = { type: 'draw', h: ความสูง, strokes: [{ c: สี, w: ขนาดแปรง, p: [x0,y0,x1,y1,...] }] }
 * พิกัดเป็นจำนวนเต็มบนกระดานกว้าง W หน่วยเสมอ แล้วย่อ/ขยายตามความกว้างจริงตอนแสดงผล
 */
const Sketch = (() => {
  const W = 360;
  const HEIGHTS = [160, 240, 360];
  const COLORS = ['#2b2620', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#ffffff'];
  const SIZES = [2, 4, 8, 14];

  const pref = (k, d) => { try { return localStorage.getItem('nota:draw:' + k) || d; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('nota:draw:' + k, v); } catch (e) { /* ignore */ } };

  function paint(ctx, strokes, s) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const st of strokes) {
      const p = st.p;
      if (!p || p.length < 2) continue;
      ctx.strokeStyle = st.c;
      ctx.lineWidth = st.w * s;
      ctx.beginPath();
      ctx.moveTo(p[0] * s, p[1] * s);
      if (p.length === 2) ctx.lineTo(p[0] * s + 0.01, p[1] * s); // จุดเดียว
      for (let i = 2; i < p.length - 2; i += 2) {
        ctx.quadraticCurveTo(p[i] * s, p[i + 1] * s, (p[i] + p[i + 2]) / 2 * s, (p[i + 1] + p[i + 3]) / 2 * s);
      }
      if (p.length >= 4) ctx.lineTo(p[p.length - 2] * s, p[p.length - 1] * s);
      ctx.stroke();
    }
  }

  /* ลดจำนวนจุด (Ramer–Douglas–Peucker) */
  function simplify(pts, eps) {
    if (pts.length <= 4) return pts;
    const n = pts.length / 2;
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      let max = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs(dy * pts[i * 2] - dx * pts[i * 2 + 1] + bx * ay - by * ax) / len;
        if (d > max) { max = d; idx = i; }
      }
      if (max > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
    return out;
  }

  /* รูปย่อบนการ์ดหน้ารวม */
  function thumb(b, width) {
    const h = b.h || HEIGHTS[1];
    const s = width / W;
    const c = document.createElement('canvas');
    const dpr = devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = h * s * dpr;
    c.style.width = width + 'px';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    paint(ctx, b.strokes || [], s);
    return c;
  }

  function create(b, onChange) {
    b.strokes = b.strokes || [];
    b.h = b.h || HEIGHTS[1];
    let color = pref('color', COLORS[0]);
    let size = +pref('size', 4);
    let tool = 'pen';

    const box = document.createElement('div');
    box.className = 'sketch';
    box.innerHTML = `
      <div class="sk-bar">
        <div class="sk-colors">${COLORS.map(c => `<button class="sk-color" data-c="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div>
        <div class="sk-sizes">${SIZES.map(s => `<button class="sk-size" data-s="${s}" title="ขนาด ${s}"><i style="--s:${Math.min(s, 12) + 2}px"></i></button>`).join('')}</div>
      </div>
      <div class="sk-bar sk-bar2">
        <button class="sk-tool" data-tool="pen" title="ปากกา">${Icons.svg('pen')}ปากกา</button>
        <button class="sk-tool" data-tool="eraser" title="ยางลบ (ลบทีละเส้น)">${Icons.svg('eraser')}ยางลบ</button>
        <span class="sp"></span>
        <button class="sk-act" data-act="undo" title="ย้อนกลับ (Ctrl+Z)">${Icons.svg('undo')}</button>
        <button class="sk-act" data-act="height" title="ปรับความสูงกระดาน">${Icons.svg('height')}</button>
        <button class="sk-act" data-act="clear" title="ล้างทั้งหมด">ล้าง</button>
      </div>
      <div class="sk-pad" tabindex="0"><canvas></canvas></div>`;

    const pad = box.querySelector('.sk-pad');
    const canvas = box.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let scale = 1;

    function sizeCanvas() {
      const w = pad.clientWidth || W;
      scale = w / W;
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(b.h * scale * dpr);
      canvas.style.height = b.h * scale + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paint(ctx, b.strokes, scale);
    }
    function syncUI() {
      box.querySelectorAll('.sk-color').forEach(x => x.classList.toggle('sel', x.dataset.c === color && tool === 'pen'));
      box.querySelectorAll('.sk-size').forEach(x => x.classList.toggle('sel', +x.dataset.s === size));
      box.querySelectorAll('.sk-tool').forEach(x => x.classList.toggle('sel', x.dataset.tool === tool));
      pad.classList.toggle('erasing', tool === 'eraser');
      resetClear();
    }

    new ResizeObserver(sizeCanvas).observe(pad);

    box.querySelector('.sk-colors').addEventListener('click', e => {
      const c = e.target.closest('.sk-color');
      if (!c) return;
      color = c.dataset.c; tool = 'pen'; setPref('color', color); syncUI();
    });
    box.querySelector('.sk-sizes').addEventListener('click', e => {
      const s = e.target.closest('.sk-size');
      if (!s) return;
      size = +s.dataset.s; setPref('size', size); syncUI();
    });
    box.querySelectorAll('.sk-tool').forEach(t => t.addEventListener('click', () => { tool = t.dataset.tool; syncUI(); }));

    const clearBtn = box.querySelector('[data-act="clear"]');
    let clearTimer;
    function resetClear() { clearBtn.textContent = 'ล้าง'; clearBtn.classList.remove('confirm'); clearTimeout(clearTimer); }

    function undo() {
      if (!b.strokes.length) return;
      b.strokes.pop(); redraw(); onChange();
    }
    box.querySelectorAll('.sk-act').forEach(a => a.addEventListener('click', () => {
      const act = a.dataset.act;
      if (act === 'undo') undo();
      if (act === 'height') {
        b.h = HEIGHTS[(HEIGHTS.indexOf(b.h) + 1) % HEIGHTS.length];
        sizeCanvas(); onChange();
      }
      if (act === 'clear') {
        if (!b.strokes.length) return;
        if (!clearBtn.classList.contains('confirm')) {
          clearBtn.textContent = 'ยืนยันล้าง?';
          clearBtn.classList.add('confirm');
          clearTimer = setTimeout(resetClear, 3000);
          return;
        }
        b.strokes = []; redraw(); onChange(); resetClear();
      }
    }));
    pad.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); undo(); }
    });

    /* ---------- pointer ---------- */
    let live = null;
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return [
        Math.max(0, Math.min(W, Math.round((e.clientX - r.left) / scale))),
        Math.max(0, Math.min(b.h, Math.round((e.clientY - r.top) / scale))),
      ];
    };

    function eraseAt([x, y]) {
      const r = Math.max(6, size * 1.5);
      const before = b.strokes.length;
      b.strokes = b.strokes.filter(st => {
        const p = st.p;
        const hit = r + st.w / 2;
        for (let i = 0; i < p.length; i += 2) {
          if (Math.hypot(p[i] - x, p[i + 1] - y) <= hit) return false;
          if (i + 3 < p.length) { // ตรวจระหว่างจุดด้วย
            const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
            if (Math.hypot(mx - x, my - y) <= hit) return false;
          }
        }
        return true;
      });
      if (b.strokes.length !== before) { redraw(); return true; }
      return false;
    }

    let erased = false;
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      pad.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      const pt = pos(e);
      if (tool === 'eraser') { erased = eraseAt(pt); live = { erasing: true }; return; }
      live = { c: color, w: size, p: [...pt] };
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size * scale;
      ctx.beginPath();
      ctx.moveTo(pt[0] * scale, pt[1] * scale);
      ctx.lineTo(pt[0] * scale + 0.01, pt[1] * scale);
      ctx.stroke();
    });
    canvas.addEventListener('pointermove', e => {
      if (!live) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const pt = pos(ev);
        if (live.erasing) { erased = eraseAt(pt) || erased; continue; }
        const p = live.p;
        const lx = p[p.length - 2], ly = p[p.length - 1];
        if (Math.hypot(pt[0] - lx, pt[1] - ly) < 1.5) continue;
        p.push(pt[0], pt[1]);
        ctx.beginPath();
        ctx.moveTo(lx * scale, ly * scale);
        ctx.lineTo(pt[0] * scale, pt[1] * scale);
        ctx.stroke();
      }
    });
    const end = () => {
      if (!live) return;
      if (live.erasing) {
        if (erased) onChange();
      } else {
        live.p = simplify(live.p, 0.8);
        b.strokes.push(live);
        redraw();
        onChange();
      }
      live = null;
      erased = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    syncUI();
    return box;
  }

  return { create, thumb };
})();
