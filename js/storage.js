/*
 * Storage layer
 * - chrome.storage.sync  : แหล่งข้อมูลหลัก ซิงก์ทุกเครื่องที่ล็อกอิน Chrome บัญชีเดียวกัน
 * - chrome.storage.local : เก็บ "draft" ที่ยังซิงก์ไม่สำเร็จ (กันข้อมูลหายตอน popup ปิด / โควต้าเต็ม)
 *
 * Sync layout (ต่อโน้ต 1 อัน):
 *   m:<id>      -> { c: จำนวน chunk, u: updated }
 *   c:<id>:<i>  -> base64(deflate(JSON(note))) ถูกหั่นเป็นชิ้นละ <= CHUNK ตัวอักษร
 * ต้องหั่นเพราะ sync จำกัด 8KB ต่อ key และ 100KB รวม — บีบอัดช่วยให้จุได้มากขึ้น ~2-3 เท่า
 */
const Store = (() => {
  const SYNC = chrome.storage.sync;
  const LOCAL = chrome.storage.local;
  const CHUNK = 7800;
  const SYNC_DELAY = 1500;

  const syncedMeta = new Map(); // id -> { c, u } ตามที่อยู่บน sync ล่าสุด
  let drafts = {};              // id -> note (ยังไม่ได้ซิงก์)
  let pendingDeletes = [];      // id ที่ลบแล้วแต่ยังลบจาก sync ไม่สำเร็จ
  let timer = null;
  let flushing = null;
  let statusCb = () => {};
  let remoteCb = () => {};
  let remoteTimer = null;

  /* ---------- encode / decode ---------- */
  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pack(obj) {
    const stream = new Blob([JSON.stringify(obj)]).stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  async function unpack(str) {
    const stream = new Blob([fromB64(str)]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  }

  /* ---------- read ---------- */
  async function readSync() {
    const all = await SYNC.get(null);
    const notes = [];
    syncedMeta.clear();
    for (const key of Object.keys(all)) {
      if (!key.startsWith('m:')) continue;
      const id = key.slice(2);
      const meta = all[key];
      let data = '';
      let complete = true;
      for (let i = 0; i < meta.c; i++) {
        const part = all[`c:${id}:${i}`];
        if (typeof part !== 'string') { complete = false; break; }
        data += part;
      }
      if (!complete) continue; // ยังซิงก์มาไม่ครบ รอรอบหน้า
      try {
        notes.push(await unpack(data));
        syncedMeta.set(id, meta);
      } catch (e) {
        console.warn('[MyNota] decode failed', id, e);
      }
    }
    return notes;
  }

  async function loadAll() {
    const local = await LOCAL.get(['drafts', 'pendingDeletes']);
    drafts = local.drafts || {};
    pendingDeletes = local.pendingDeletes || [];
    const byId = new Map((await readSync()).map(n => [n.id, n]));
    for (const id of pendingDeletes) byId.delete(id);
    for (const d of Object.values(drafts)) {
      const cur = byId.get(d.id);
      if (!cur || d.updated >= cur.updated) byId.set(d.id, d);
    }
    if (Object.keys(drafts).length || pendingDeletes.length) schedule(200);
    return [...byId.values()];
  }

  /* ---------- write ---------- */
  function persistLocal() {
    return LOCAL.set({ drafts, pendingDeletes });
  }

  function save(note) {
    drafts[note.id] = note;
    persistLocal();
    statusCb('pending');
    schedule(SYNC_DELAY);
  }

  function remove(id) {
    delete drafts[id];
    if (!pendingDeletes.includes(id)) pendingDeletes.push(id);
    persistLocal();
    schedule(100);
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  }

  async function flush() {
    if (flushing) { await flushing; }
    flushing = doFlush().finally(() => { flushing = null; });
    return flushing;
  }

  async function doFlush() {
    clearTimeout(timer);
    const ids = Object.keys(drafts);
    const dels = [...pendingDeletes];
    if (!ids.length && !dels.length) { statusCb('synced'); return; }
    statusCb('saving');
    try {
      // ลบ
      if (dels.length) {
        const keys = [];
        for (const id of dels) {
          const c = syncedMeta.get(id)?.c ?? 0;
          keys.push(`m:${id}`);
          for (let i = 0; i < Math.max(c, 16); i++) keys.push(`c:${id}:${i}`);
          syncedMeta.delete(id);
        }
        await SYNC.remove(keys);
        pendingDeletes = pendingDeletes.filter(id => !dels.includes(id));
      }
      // บันทึก (รวมเป็น set ครั้งเดียวเพื่อประหยัด write quota)
      const items = {};
      const stale = [];
      const written = [];
      for (const id of ids) {
        const note = drafts[id];
        const data = await pack(note);
        const parts = [];
        for (let i = 0; i < data.length; i += CHUNK) parts.push(data.slice(i, i + CHUNK));
        parts.forEach((p, i) => { items[`c:${id}:${i}`] = p; });
        const meta = { c: parts.length, u: note.updated };
        items[`m:${id}`] = meta;
        const old = syncedMeta.get(id);
        if (old) for (let i = parts.length; i < old.c; i++) stale.push(`c:${id}:${i}`);
        written.push([id, note.updated, meta]);
      }
      if (written.length) await SYNC.set(items);
      if (stale.length) await SYNC.remove(stale);
      for (const [id, updated, meta] of written) {
        syncedMeta.set(id, meta);
        if (drafts[id] && drafts[id].updated === updated) delete drafts[id];
      }
      await persistLocal();
      statusCb(Object.keys(drafts).length ? 'pending' : 'synced');
      if (Object.keys(drafts).length) schedule(SYNC_DELAY);
    } catch (err) {
      await persistLocal();
      const msg = String(err && err.message || err);
      console.warn('[MyNota] sync failed:', msg);
      if (/MAX_WRITE_OPERATIONS/i.test(msg)) {
        statusCb('pending', 'ซิงก์ถี่เกินไป จะลองใหม่อัตโนมัติ');
        schedule(30000);
      } else if (/QUOTA_BYTES/i.test(msg)) {
        statusCb('error', 'พื้นที่ซิงก์เต็ม (100KB) — โน้ตยังเก็บในเครื่องนี้ ลองลบ/ย่อโน้ตเก่า');
        schedule(60000);
      } else {
        statusCb('error', 'ซิงก์ไม่สำเร็จ: ' + msg);
        schedule(10000);
      }
    }
  }

  /* ---------- remote changes ---------- */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    // ข้ามการเปลี่ยนแปลงที่เครื่องนี้เขียนเอง
    const foreign = Object.entries(changes).some(([key, ch]) => {
      if (!key.startsWith('m:')) return false;
      const mine = syncedMeta.get(key.slice(2));
      if (!ch.newValue) return !!mine;
      return !mine || mine.u !== ch.newValue.u;
    });
    if (!foreign) return;
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(async () => {
      const notes = await readSync();
      remoteCb(notes, new Set(Object.keys(drafts)));
    }, 400);
  });

  async function usage() {
    const used = await SYNC.getBytesInUse(null);
    return { used, total: SYNC.QUOTA_BYTES || 102400 };
  }

  return {
    loadAll,
    save,
    remove,
    flush,
    usage,
    hasDrafts: () => Object.keys(drafts).length > 0,
    onStatus: cb => { statusCb = cb; },
    onRemote: cb => { remoteCb = cb; },
  };
})();
