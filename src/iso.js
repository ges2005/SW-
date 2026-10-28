import { CFG } from './config.js';

const N = CFG.mapSize;
export const TW = 64, TH = 32;

// Harita (i,j) <-> dünya (izometrik) <-> ekran dönüşümleri. Tıklama ve çizim aynı fonksiyonları kullanır.
export const toWorld = (i, j) => ({ x: (i - j) * TW / 2, y: (i + j) * TH / 2 });
export const fromWorld = (x, y) => { const a = x / (TW / 2), b = y / (TH / 2); return { i: (a + b) / 2, j: (b - a) / 2 }; };

export function toScreen(cam, i, j) {
  const w = toWorld(i, j);
  return { x: (w.x - cam.x) * cam.zoom + cam.w / 2, y: (w.y - cam.y) * cam.zoom + cam.h / 2 };
}
export function toTile(cam, sx, sy) {
  return fromWorld((sx - cam.w / 2) / cam.zoom + cam.x, (sy - cam.h / 2) / cam.zoom + cam.y);
}

export function clampCam(cam) {
  const c = toWorld(N / 2, N / 2);
  const hx = N * TW / 2, hy = N * TH / 2;
  cam.x = Math.max(c.x - hx, Math.min(c.x + hx, cam.x));
  cam.y = Math.max(c.y - hy, Math.min(c.y + hy, cam.y));
  cam.zoom = Math.max(0.5, Math.min(2.5, cam.zoom));
}

export function minimapRect(cam) {
  const w = Math.min(190, cam.w * 0.32), h = w / 2;
  return { x: cam.w - w - 10, y: cam.h - h - 10, w, h };
}

const poly = (ctx, pts, fill, stroke) => {
  ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
};
const diamond = (cam, i, j, r) => [[i - r, j - r], [i + r, j - r], [i + r, j + r], [i - r, j + r]].map(([a, b]) => toScreen(cam, a, b));
export const teamColor = t => (t < 0 ? '#d9dcde' : CFG.teams[t].color);

export function render(ctx, cam, g, ui) {
  const z = cam.zoom;
  ctx.clearRect(0, 0, cam.w, cam.h);
  const bg = ctx.createLinearGradient(0, 0, 0, cam.h);
  bg.addColorStop(0, '#1f7ae0'); bg.addColorStop(1, '#06264d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cam.w, cam.h);

  // zemin
  poly(ctx, diamond(cam, N / 2, N / 2, N / 2), '#eceeef', '#0a1b33');
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.05)';
  for (let k = 1; k < N; k++) {
    const a = toScreen(cam, k, 0), b = toScreen(cam, k, N), c = toScreen(cam, 0, k), d = toScreen(cam, N, k);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }

  // noktalar
  for (const p of g.points) {
    const r = p.base ? 1.1 : 0.8;
    poly(ctx, diamond(cam, p.x, p.y, r), p.base ? teamColor(p.owner) : '#fff', null);
    if (!p.base) {
      const s = toScreen(cam, p.x, p.y);
      ctx.fillStyle = teamColor(p.owner); ctx.font = `${30 * z}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.suit === 'S' ? '♠' : '♥', s.x, s.y);
    }
    if (p.capTeam >= 0 && p.prog > 0) { // ele geçirme ilerlemesi
      const s = toScreen(cam, p.x, p.y);
      ctx.fillStyle = '#0003'; ctx.fillRect(s.x - 20 * z, s.y + 14 * z, 40 * z, 5 * z);
      ctx.fillStyle = teamColor(p.capTeam); ctx.fillRect(s.x - 20 * z, s.y + 14 * z, 40 * z * p.prog, 5 * z);
    }
  }

  // hedef işaretleri
  ctx.lineWidth = 2;
  for (const u of g.units) if (ui.selected.has(u.id) && u.tx !== null) poly(ctx, diamond(cam, u.tx, u.ty, 0.35), null, '#e11');

  // birimler (arkadan öne sıralı)
  const us = [...g.units].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const u of us) {
    const s0 = toScreen(cam, u.x, u.y), col = teamColor(u.team);
    // yürüme sekmesi ve vuruş atılması
    const bob = u.moving ? Math.abs(Math.sin(ui.time * 12 + u.id)) * 3 * z : 0;
    const lunge = u.atk > 0 ? Math.sin(u.atk / 0.25 * Math.PI) * 7 * z : 0;
    const ldx = (u.fx - u.fy), ldy = (u.fx + u.fy) / 2, ll = Math.hypot(ldx, ldy) || 1;
    const s = { x: s0.x + ldx / ll * lunge, y: s0.y + ldy / ll * lunge - bob };
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(s0.x, s0.y, 13 * z, 6 * z, 0, 0, 7); ctx.fill();
    if (ui.selected.has(u.id)) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s0.x, s0.y, 17 * z, 8 * z, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(s.x - 7 * z, s.y - 32 * z, 14 * z, 30 * z, 5 * z); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(s.x, s.y - 38 * z, 7 * z, 0, 7); ctx.fill(); ctx.stroke();
    const f = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = '#0006'; ctx.fillRect(s.x - 12 * z, s.y - 54 * z, 24 * z, 4 * z);
    ctx.fillStyle = f > 0.4 ? '#5bd400' : '#e11'; ctx.fillRect(s.x - 12 * z, s.y - 54 * z, 24 * z * f, 4 * z);
  }

  if (ui.fx) ui.fx.draw(ctx, cam);

  // kutu seçimi
  if (ui.box) {
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    const b = ui.box; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  // mini harita
  const m = minimapRect(cam);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, 6); ctx.fill();
  const mp = (i, j) => ({ x: m.x + m.w / 2 + (i - j) / N * m.w / 2 * 0.92, y: m.y + m.h / 2 + (i + j - N) / N * m.h / 2 * 0.92 });
  poly(ctx, [mp(0, 0), mp(N, 0), mp(N, N), mp(0, N)], '#444', null);
  for (const p of g.points) { const q = mp(p.x, p.y); ctx.fillStyle = teamColor(p.owner); ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  for (const u of g.units) { const q = mp(u.x, u.y); ctx.fillStyle = u.team === 0 ? '#f6f' : CFG.teams[u.team].color; ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2.5); }
  const vc = fromWorld(cam.x, cam.y), q = mp(vc.i, vc.j);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 18, q.y - 10, 36, 20);
}
