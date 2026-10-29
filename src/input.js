import { toTile, clampCam, minimapRect } from './iso.js';
import { commandMove } from './sim.js';

// Dokunmatik öncelikli kontrol (fare ile de aynı):
//   birime dokun               -> seçime ekle / çıkar        (çift dokun: ekrandaki aynı türden hepsi)
//   üssüne dokun               -> (seçim yokken) hepsini seç
//   boş yere dokun             -> seçili birimleri gönder (saldır); emirden sonra seçim kendiliğinden bırakılır
//   boş yere ÇİFT dokun        -> (600 ms içinde) emri geri alır ve seçimi bırakır (yanlış seçtiysen)
//   boş yerde basılı tut       -> seçili birimler savaşmadan koşar (geri çekilme)
//   birimden sürükle, bırak    -> o birimi (seçiliyse tüm seçimi) bırakılan yere gönder
//   boş yerde sürükle          -> çerçeveyle seç
//   iki parmak                 -> kaydır + yakınlaştır   (fare: sağ tuşla sürükle, tekerlek)
export function bindInput(canvas, cam, getGame, ui) {
  const ptrs = new Map();
  let drag = null, pinch = null, holdTimer = null, lastTap = { id: -1, t: 0 }, lastOrder = null;
  const MOVE = 10, HOLD = 380;

  // Dokunma noktasını tuvalin çizim koordinatlarına çevirir (CSS boyutu çizim boyutundan farklı olsa da doğru kalır).
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cam.w / r.width, y: (e.clientY - r.top) * cam.h / r.height };
  };
  const inMini = p => { const m = minimapRect(cam); return p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h; };
  const miniTo = p => {
    const m = minimapRect(cam), N = 24;
    const a = ((p.x - m.x) / m.w - 0.5) * 2 / 0.92, b = ((p.y - m.y) / m.h - 0.5) * 2 / 0.92;
    const i = N / 2 + (a + b) * N / 2, j = N / 2 + (b - a) * N / 2;
    cam.x = (i - j) * 32; cam.y = (i + j) * 16; clampCam(cam); ui.camMoved = true;
  };
  const tileAt = p => { const t = toTile(cam, p.x, p.y); return { x: Math.max(0, Math.min(24, t.i)), y: Math.max(0, Math.min(24, t.j)) }; };

  // Parmağa uygun geniş dokunma alanı; gövdenin ortasına olan uzaklık ölçülür.
  function hitUnit(p) {
    let best = null, bd = Math.max(28, 40 * cam.zoom);
    for (const u of getGame().units) {
      if (u.team !== 0) continue;
      const s = ui.project(u.x, u.y);
      const d = Math.hypot(s.x - p.x, (s.y - 18 * cam.zoom) - p.y);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  function hitBase(p) {
    const b = getGame().points.find(q => q.base && q.team === 0);
    if (!b) return false;
    const t = toTile(cam, p.x, p.y);
    return Math.hypot(t.i - b.x, t.j - b.y) < 1.4;
  }

  // Emir verir ve seçimi bırakır (başka birine dokununca önceki emir bozulmasın). Geri almak için önceki durumu saklar.
  const send = (ids, p, mode) => {
    const g = getGame(), t = tileAt(p);
    const before = g.units.filter(u => ids.includes(u.id)).map(u => ({ u, tx: u.tx, ty: u.ty, mode: u.mode, hold: u.hold }));
    commandMove(g, ids, t.x, t.y, mode);
    ui.pings.push({ x: t.x, y: t.y, mode });
    ui.selected.clear();
    lastOrder = { t: performance.now(), p, before };
  };
  const undoOrder = () => { // son emri geri al
    for (const b of lastOrder.before) { b.u.tx = b.tx; b.u.ty = b.ty; b.u.mode = b.mode; b.u.hold = b.hold; }
    lastOrder = null; ui.selected.clear();
    ui.toast = { text: '↩ Emir geri alındı, seçim bırakıldı', t: performance.now() };
  };

  function selectBox(b) {
    ui.selected.clear();
    for (const u of getGame().units) {
      if (u.team !== 0) continue;
      const s = ui.project(u.x, u.y), cy = s.y - 18 * cam.zoom; // gövdenin ortası
      if (s.x >= b.x - 6 && s.x <= b.x + b.w + 6 && cy >= b.y - 6 && cy <= b.y + b.h + 6) ui.selected.add(u.id);
    }
  }

  function tapUnit(u) {
    const now = performance.now();
    if (lastTap.id === u.id && now - lastTap.t < 350) { // çift dokunma: ekrandaki aynı türden tüm birimler
      for (const v of getGame().units) {
        if (v.team !== 0 || v.type !== u.type) continue;
        const s = ui.project(v.x, v.y);
        if (s.x >= 0 && s.x <= cam.w && s.y >= 0 && s.y <= cam.h) ui.selected.add(v.id);
      }
      lastTap = { id: -1, t: 0 }; return;
    }
    if (ui.selected.has(u.id)) ui.selected.delete(u.id); else ui.selected.add(u.id);
    lastTap = { id: u.id, t: now };
  }

  function tapGround(p) {
    const now = performance.now();
    // boşa çift dokunma: az önceki emri geri alır, seçim bırakılmış kalır
    // (emirden sonra seçim bırakıldığı için yakın zamanda boşa ikinci dokunuş yalnızca geri alma anlamına gelir; geniş pencere güvenli)
    if (lastOrder && now - lastOrder.t < 600 && Math.hypot(p.x - lastOrder.p.x, p.y - lastOrder.p.y) < 90) { undoOrder(); return; }
    if (ui.selected.size) { send([...ui.selected], p, 'attack'); return; }
    if (hitBase(p)) getGame().units.forEach(u => { if (u.team === 0) ui.selected.add(u.id); }); // üsse dokun = hepsini seç
  }

  const mid = () => { const [a, b] = [...ptrs.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) {
      clearTimeout(holdTimer); drag = null; ui.box = null; ui.arrow = null;
      const m = mid(); pinch = { d: m.d, z: cam.zoom, mx: m.x, my: m.y };
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 2) { drag = { mode: 'pan', last: p }; return; }
    if (inMini(p)) { drag = { mini: true }; miniTo(p); return; }
    const u = hitUnit(p);
    drag = { start: p, last: p, mode: u ? 'unit' : 'wait', unit: u };
    if (!u && ui.selected.size) { // boş yerde basılı tut = koşarak git (savaşmaz)
      holdTimer = setTimeout(() => {
        if (drag && drag.mode === 'wait') { send([...ui.selected], p, 'move'); ui.usedRun = true; drag.mode = 'done'; if (navigator.vibrate) navigator.vibrate(15); }
      }, HOLD);
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) { // iki parmak: yakınlaştır + kaydır
      const m = mid();
      cam.x -= (m.x - pinch.mx) / cam.zoom; cam.y -= (m.y - pinch.my) / cam.zoom;
      cam.zoom = pinch.z * m.d / pinch.d; pinch.mx = m.x; pinch.my = m.y;
      clampCam(cam); ui.camMoved = true; return;
    }
    if (!drag) return;
    if (drag.mini) { miniTo(p); return; }
    if (drag.mode === 'pan') { cam.x -= (p.x - drag.last.x) / cam.zoom; cam.y -= (p.y - drag.last.y) / cam.zoom; drag.last = p; clampCam(cam); ui.camMoved = true; return; }
    const moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y);
    if (moved > MOVE) {
      clearTimeout(holdTimer);
      if (drag.mode === 'wait') drag.mode = 'box';
      if (drag.mode === 'unit') { drag.mode = 'arrow'; if (!ui.selected.has(drag.unit.id)) { ui.selected.clear(); ui.selected.add(drag.unit.id); } }
    }
    if (drag.mode === 'box') ui.box = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
    if (drag.mode === 'arrow') { const s = ui.project(drag.unit.x, drag.unit.y); ui.arrow = { x0: s.x, y0: s.y - 18 * cam.zoom, x1: p.x, y1: p.y }; }
    drag.last = p;
  });

  const end = e => {
    const had = ptrs.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    if (!had || !drag) return;
    if (drag.mode === 'wait') tapGround(drag.last);
    else if (drag.mode === 'unit') tapUnit(drag.unit);
    else if (drag.mode === 'box') { if (ui.box && ui.box.w > 14 && ui.box.h > 14) selectBox(ui.box); }
    else if (drag.mode === 'arrow') { const a = ui.arrow; if (a && Math.hypot(a.x1 - a.x0, a.y1 - a.y0) > 30) send([...ui.selected], { x: a.x1, y: a.y1 }, 'attack'); }
    ui.box = null; ui.arrow = null; drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end); // yakalama kaybolursa takılı parmak kalmasın
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom *= e.deltaY < 0 ? 1.1 : 0.9; clampCam(cam); ui.camMoved = true; }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => { // masaüstü: ok tuşları / WASD ile kaydır
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
    cam.x += k[0] * 60 / cam.zoom; cam.y += k[1] * 40 / cam.zoom; clampCam(cam); ui.camMoved = true; e.preventDefault();
  });
}
