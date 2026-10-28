import { toTile, clampCam, minimapRect } from './iso.js';
import { commandMove } from './sim.js';

// Tek parmak / sol tık ile tüm kontrol (telefon ve masaüstünde aynı):
//   dokun/tıkla        -> kendi birimini seç ya da seçiliyi oraya gönder
//   sürükle            -> haritayı kaydır
//   basılı tut + sürükle -> kutu seçimi
//   iki parmak / tekerlek -> yakınlaştır
export function bindInput(canvas, cam, getGame, ui) {
  const ptrs = new Map();
  let drag = null, pinch = null, holdTimer = null;
  const MOVE = 8, HOLD = 350;

  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
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
      if (s.x >= b.x && s.x <= b.x + b.w && s.y - 20 >= b.y && s.y - 20 <= b.y + b.h) ui.selected.add(u.id);
    }
  }

  function tap(p) {
    const g = getGame();
    let best = null, bd = 28 * Math.max(cam.zoom, 0.8);
    for (const u of g.units) {
      if (u.team !== 0) continue;
      const s = ui.project(u.x, u.y);
      const d = Math.hypot(s.x - p.x, s.y - p.y + 18 * cam.zoom);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) { ui.selected.clear(); ui.selected.add(best.id); return; }
    if (ui.selected.size) {
      const t = toTile(cam, p.x, p.y);
      commandMove(g, [...ui.selected], Math.max(0, Math.min(24, t.i)), Math.max(0, Math.min(24, t.j)));
    }
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) {
      clearTimeout(holdTimer); drag = null; ui.box = null;
      const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom };
      return;
    }
    if (inMini(p)) { drag = { mini: true }; miniTo(p); return; }
    drag = { start: p, last: p, mode: 'wait' };
    holdTimer = setTimeout(() => { if (drag && drag.mode === 'wait') { drag.mode = 'box'; ui.box = { x: p.x, y: p.y, w: 0, h: 0 }; } }, HOLD);
  });

  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = pos(e); ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; cam.zoom = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clampCam(cam); return;
    }
    if (!drag) return;
    if (drag.mini) { miniTo(p); return; }
    if (drag.mode === 'wait' && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > MOVE) { clearTimeout(holdTimer); drag.mode = 'pan'; }
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
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom *= e.deltaY < 0 ? 1.1 : 0.9; clampCam(cam); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
