/*
 * สีโน้ต — note.color เป็นชื่อสีสำเร็จรูป (เช่น 'yellow') หรือรหัสสี '#rrggbb' ที่ผู้ใช้เลือกเอง
 * สีตัวหนังสือเลือกอัตโนมัติจาก contrast: พื้นเข้ม -> ตัวหนังสือสว่าง (class .tone-dark)
 */
const NoteColors = (() => {
  const GROUPS = [
    ['พาสเทล', { yellow: '#fff59d', pink: '#ffcfe1', green: '#d3f5c8', blue: '#cbe8ff', orange: '#ffdcb0', purple: '#e6d8ff' }],
    ['สีสด', { lemon: '#ffe94d', coral: '#ff8a80', mint: '#7ee2b8', sky: '#7dd3fc', tangerine: '#ffb347', lilac: '#c4b5fd' }],
    ['สีเข้ม', { charcoal: '#2f2f35', navy: '#1e3a5f', forest: '#1f4d3a', wine: '#5b1f33', cocoa: '#4a3426', plum: '#3f2a5c' }],
  ];
  const PRESETS = Object.assign({}, ...GROUPS.map(g => g[1]));
  const QUICK = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple'];
  const INK_DARK = [59, 50, 34];
  const INK_LIGHT = [255, 250, 240];

  const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
  const isValid = c => !!PRESETS[c] || isHex(c);
  const hexOf = c => PRESETS[c] || (isHex(c) ? c.toLowerCase() : PRESETS.yellow);

  const rgbOf = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const lum = rgb => {
    const [r, g, b] = rgb.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // เลือกสีตัวหนังสือที่อ่านง่ายกว่า (contrast สูงกว่า)
  function isDark(hex) {
    const L = lum(rgbOf(hex));
    const withDarkInk = (L + 0.05) / (lum(INK_DARK) + 0.05);
    const withLightInk = (lum(INK_LIGHT) + 0.05) / (L + 0.05);
    return withLightInk > withDarkInk;
  }

  function toHsl(hex) {
    let [r, g, b] = rgbOf(hex).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function fromHsl(h, s, l) {
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }

  // แถบกาวด้านบน: เข้มขึ้นเล็กน้อยบนพื้นอ่อน / สว่างขึ้นเล็กน้อยบนพื้นเข้ม
  function topOf(hex, dark) {
    const [h, s, l] = toHsl(hex);
    return fromHsl(h, Math.min(1, s + 0.05), dark ? Math.min(1, l + 0.08) : Math.max(0, l - 0.09));
  }

  function paint(el, color) {
    const hex = hexOf(color);
    const dark = isDark(hex);
    el.style.setProperty('--note', hex);
    el.style.setProperty('--note-top', topOf(hex, dark));
    el.classList.toggle('tone-dark', dark);
  }

  return { GROUPS, PRESETS, QUICK, isValid, isHex, hexOf, isDark, toHsl, fromHsl, paint };
})();
