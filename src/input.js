import { toTile, clampCam, minimapRect } from './iso.js';
import { commandMove } from './sim.js';

// Tek parmak / sol tık ile tüm kontrol (telefon ve masaüstünde aynı):
//   dokun/tıkla          -> kendi birimini seç (seçiliye tekrar dokun = bırak) ya da seçiliyi oraya gönder
//   sürükle              -> haritayı kaydır
//   basılı tut + sürükle -> kutu seçimi
//   ▭ Kutu açıkken        -> sürükle = kutu seçimi, birime dokun = seçime ekle/çıkar
//   iki parmak            -> yakınlaştır ve kaydır; tekerlek -> yakınlaştır
export function bindInput(canvas, cam, getGame, ui) {
  const ptrs = new Map();
  let drag = null, pinch = null, holdTimer = null, lastTap = { id: -1, t: 0 };
  const MOVE = 8, HOLD = 300;

  // Dokunma noktasını tuvalin çizim koordinatlarına çevirir (CSS boyutu çizim boyutundan farklı olsa da doğru kalır;
  // iPhone Safari'de adres çubuğu görünürken görünen alan 100vh'den küçüktür).
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cam.w / r.width, y: (e.clientY - r.top) * cam.h / r.height };
  };
  const inMini = p => { const m = minimapRect(cam); return p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h; };
  const miniTo = p => {
    const m = minimapRect(cam), N = 24;
    const a = ((p.x - m.x) / m.w - 0.5) * 2 / 0.92, b = ((p.y - m.y) / m.h - 0.5) * 2 / 0.92;
    const i = N / 2 + (a + b) * N / 2, j = N / 2 + (b - a) * N / 2;
    cam.x = (i - j) * 32; cam.y = (i + j) * 16; clampCam(cam);
  };

  function selectBox(b) {
    const g = getGame(); if (!b) return;
    ui.selected.clear();
    for (const u of g.units) {
      if (u.team !== 0) continue;
      const s = ui.project(u.x, u.y);
      const cy = s.y - 18 * cam.zoom; // gövdenin ortası
      if (s.x >= b.x - 6 && s.x <= b.x + b.w + 6 && cy >= b.y - 6 && cy <= b.y + b.h + 6) ui.selected.add(u.id);
    }
  }

  function tap(p) {
    const g = getGame();
    let best = null, bd = Math.max(28, 40 * cam.zoom); // parmağa uygun geniş dokunma alanı
    for (const u of g.units) {
      if (u.team !== 0) continue;
      const s = ui.project(u.x, u.y);
      const d = Math.hypot(s.x - p.x, (s.y - 18 * cam.zoom) - p.y); // gövdenin ortasına olan uzaklık
      if (d < bd) { bd = d; best = u; }
    }
    if (best) {
      const now = performance.now();
      if (ui.boxMode) { // kutu kipinde dokunma seçime ekler/çıkarır
        if (ui.selected.has(best.id)) ui.selected.delete(best.id); else ui.selected.add(best.id);
        return;
      }
      if (ui.selected.size === 1 && ui.selected.has(best.id)) { ui.selected.clear(); lastTap = { id: -1, t: 0 }; return; } // seçiliye tekrar dokun = bırak
      ui.selected.clear(); ui.selected.add(best.id);
      if (lastTap.id === best.id && now - lastTap.t < 350) { // çift dokunma: ekrandaki aynı türden tüm birimler
        for (const u of g.units) {
          if (u.team !== 0 || u.type !== best.type) continue;
          const s = ui.project(u.x, u.y);
          if (s.x >= 0 && s.x <= cam.w && s.y >= 0 && s.y <= cam.h) ui.selected.add(u.id);
        }
      }
      lastTap = { id: best.id, t: now };
      return;
    }
    if (ui.selected.size) {
      const t = toTile(cam, p.x, p.y);
      commandMove(g, [...ui.selected], Math.max(0, Math.min(24, t.i)), Math.max(0, Math.min(24, t.j)), ui.mode);
    }
  }

  const mid = () => { const [a, b] = [...ptrs.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) {
      clearTimeout(holdTimer); drag = null; ui.box = null;
      const m = mid(); pinch = { d: m.d, z: cam.zoom, mx: m.x, my: m.y };
      return;
    }
    if (inMini(p)) { drag = { mini: true }; miniTo(p); return; }
    drag = { start: p, last: p, mode: 'wait' };
    holdTimer = setTimeout(() => { if (drag && drag.mode === 'wait') { drag.mode = 'box'; ui.box = { x: p.x, y: p.y, w: 0, h: 0 }; } }, HOLD);
  });

  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) { // iki parmak: yakınlaştır + kaydır
      const m = mid();
      cam.x -= (m.x - pinch.mx) / cam.zoom; cam.y -= (m.y - pinch.my) / cam.zoom;
      cam.zoom = pinch.z * m.d / pinch.d; pinch.mx = m.x; pinch.my = m.y;
      clampCam(cam); return;
    }
    if (!drag) return;
    if (drag.mini) { miniTo(p); return; }
    if (drag.mode === 'wait' && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > MOVE) {
      clearTimeout(holdTimer);
      drag.mode = ui.boxMode ? 'box' : 'pan';
      if (drag.mode === 'box') ui.box = { x: drag.start.x, y: drag.start.y, w: 0, h: 0 };
    }
    if (drag.mode === 'pan') { cam.x -= (p.x - drag.last.x) / cam.zoom; cam.y -= (p.y - drag.last.y) / cam.zoom; clampCam(cam); }
    if (drag.mode === 'box') ui.box = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
    drag.last = p;
  });

  const end = e => {
    const had = ptrs.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    if (!had || !drag) return;
    if (drag.mode === 'wait') tap(drag.last);
    if (drag.mode === 'box') { selectBox(ui.box); ui.box = null; }
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end); // yakalama kaybolursa takılı parmak kalmasın
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom *= e.deltaY < 0 ? 1.1 : 0.9; clampCam(cam); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
