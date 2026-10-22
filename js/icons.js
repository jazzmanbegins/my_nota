/* ไอคอนเส้น (stroke) ชุดเดียวทั้งแอป — viewBox 24, เส้นหนา 2, ปลายมน */
const Icons = (() => {
  const P = {
    pin: '<path d="M9 4h6l-1 6 4 4H6l4-4z"/><path d="M12 14v6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    h1: '<path d="M4 6v12M12 6v12M4 12h8"/><path d="m17 10 2.5-2v10"/>',
    h2: '<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16 10a2.5 2.5 0 1 1 4.2 1.8L16 18h5"/>',
    todo: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
    box: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/>',
    bullet: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
    numbered: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5 5.5 4v4.5M4 14.5a1.5 1.5 0 1 1 2.5 1L4 18h3"/>',
    quote: '<path d="M4 9a3 3 0 0 1 3-3h1v6H4zM4 12v1a4 4 0 0 0 4 4M14 9a3 3 0 0 1 3-3h1v6h-4zM14 12v1a4 4 0 0 0 4 4"/>',
    brush: '<path d="M9.06 11.9 17.1 3.84a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
    divider: '<path d="M3 12h18"/><path d="M8 6h8M8 18h8" opacity=".35"/>',
    bold: '<path d="M7 12h8a4 4 0 0 1 0 8H7V4h7a4 4 0 0 1 0 8"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    pen: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="m15 5 4 4"/>',
    eraser: '<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    height: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="10.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="7" r="1.2" fill="currentColor"/>',
  };

  const svg = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

  // ปุ่มใน HTML ที่มี data-icon="ชื่อ" -> ใส่ไอคอนไว้หน้าข้อความ
  document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.icon)));

  return { svg };
})();
