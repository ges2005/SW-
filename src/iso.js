import { CFG } from './config.js';
import { isVisible, isSeen } from './vision.js';

const N = CFG.mapSize;
export const TW = 64, TH = 32;

// Harita (i,j) <-> dünya (izometrik) <-> ekran dönüşümleri. Tıklama ve çizim aynı fonksiyonları kullanır.
// Yer düzleminde r kare yarıçaplı çemberin izometrik elips yarıçapları
export const ringRx = (r, z) => r * 45.25 * z, ringRy = (r, z) => r * 22.6 * z;
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
// Nokta amblemleri işlevine göre; metin karakteri değil vektör yol olarak çizilir (bazı cihazlar, özellikle iPhone,
// ♥ gibi karakterleri renkli emoji gibi çizip fillStyle'ı yok sayar; yol her yerde aynı ve istenen renkte görünür).
//   koy   = ekonomi noktası (üretim hızı, kapasite, güç)     orsu = demirci (ek güç)
//   hedef = kule (yakın düşmana ateş eder)                    kale = ana üs
// Delikler (kapı gibi) ters yönlü alt yol olarak çizilir.
function rectPath(ctx, x0, y0, x1, y1, hole) {
  if (hole) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); }
  else { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); }
  ctx.closePath();
}
function emblemPath(ctx, name, u) {
  ctx.beginPath();
  if (name === 'koy') { // ev: çatı + gövde + kapı deliği
    ctx.moveTo(-1.25 * u, -0.05 * u); ctx.lineTo(0, -1.15 * u); ctx.lineTo(1.25 * u, -0.05 * u); ctx.closePath();
    rectPath(ctx, -0.85 * u, -0.05 * u, 0.85 * u, 1.0 * u, false);
    rectPath(ctx, -0.26 * u, 0.4 * u, 0.26 * u, 1.0 * u, true);
  } else if (name === 'orsu') { // örs: yüz + boynuz + gövde + taban
    ctx.moveTo(-1.0 * u, -0.85 * u); ctx.lineTo(1.1 * u, -0.85 * u); ctx.lineTo(1.1 * u, -0.25 * u); ctx.lineTo(-1.0 * u, -0.25 * u); ctx.closePath();
    ctx.moveTo(-1.0 * u, -0.85 * u); ctx.lineTo(-1.55 * u, -0.3 * u); ctx.lineTo(-1.0 * u, -0.25 * u); ctx.closePath();
    ctx.moveTo(-0.45 * u, -0.25 * u); ctx.lineTo(0.55 * u, -0.25 * u); ctx.lineTo(0.8 * u, 0.55 * u); ctx.lineTo(-0.7 * u, 0.55 * u); ctx.closePath();
    rectPath(ctx, -1.05 * u, 0.55 * u, 1.15 * u, 1.0 * u, false);
  } else if (name === 'hedef') { // nişangâh: halka + artı
    ctx.arc(0, 0, 0.95 * u, 0, Math.PI * 2); ctx.moveTo(0.58 * u, 0); ctx.arc(0, 0, 0.58 * u, 0, Math.PI * 2, true);
    rectPath(ctx, -0.13 * u, -1.35 * u, 0.13 * u, 1.35 * u, false); rectPath(ctx, -1.35 * u, -0.13 * u, 1.35 * u, 0.13 * u, false);
  } else { // kale: başlıklı iki kule + siperlikli duvar + kapı deliği
    rectPath(ctx, -1.1 * u, -0.6 * u, -0.5 * u, 1.0 * u, false); rectPath(ctx, 0.5 * u, -0.6 * u, 1.1 * u, 1.0 * u, false);
    rectPath(ctx, -1.3 * u, -1.0 * u, -0.3 * u, -0.6 * u, false); rectPath(ctx, 0.3 * u, -1.0 * u, 1.3 * u, -0.6 * u, false);
    rectPath(ctx, -0.5 * u, -0.1 * u, 0.5 * u, 1.0 * u, false);
    rectPath(ctx, -0.38 * u, -0.38 * u, -0.1 * u, -0.1 * u, false); rectPath(ctx, 0.1 * u, -0.38 * u, 0.38 * u, -0.1 * u, false);
    rectPath(ctx, -0.27 * u, 0.35 * u, 0.27 * u, 1.0 * u, true);
  }
}
function drawEmblem(ctx, name, x, y, u, fill, stroke) {
  ctx.save(); ctx.translate(x, y); emblemPath(ctx, name, u);
  ctx.fillStyle = fill; ctx.fill('nonzero');
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, u * 0.13); ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}
const mixHex = (a, b, t) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const teamColor = t => (t < 0 ? '#d9dcde' : CFG.teams[t].color);

export function render(ctx, cam, g, ui) {
  const z = cam.zoom, V = ui.vision;
  const ownerOf = p => (isVisible(V, p.x, p.y) ? p.owner : (V.known[p.id] ?? -1));
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

  // noktalar: tarafsız = silik gri; ele geçirilince takımın rengi. Ele geçirme sürerken renk yavaşça geçiş yapar (bar yok).
  const NEUTRAL = '#cdd2d6';
  for (const p of g.points) {
    if (!isSeen(V, p.x, p.y)) continue;
    const own = ownerOf(p), live = isVisible(V, p.x, p.y);
    const capturing = live && p.capTeam >= 0 && p.prog > 0;
    const baseCol = own < 0 ? NEUTRAL : teamColor(own);
    const tile = capturing ? mixHex(baseCol, teamColor(p.capTeam), p.prog) : baseCol;
    const r = p.base ? 1.1 : 0.8;
    poly(ctx, diamond(cam, p.x, p.y, r), tile, null);
    const s = toScreen(cam, p.x, p.y);
    if (p.kind === 'kule') { // kule gövdesi (sahibinin rengi)
      ctx.fillStyle = tile === NEUTRAL ? '#9aa2a8' : tile; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(s.x - 8 * z, s.y - 40 * z, 16 * z, 38 * z, 3 * z); ctx.fill(); ctx.stroke();
      ctx.fillRect(s.x - 11 * z, s.y - 46 * z, 22 * z, 7 * z);
    }
    { // amblem: işlevine göre; ele geçirilmişse açık (beyaz) ve koyu kenarlıklı, tarafsızda silik
      const coloured = own >= 0 || (capturing && p.prog > 0.5);
      const name = p.base ? 'kale' : p.kind === 'demirci' ? 'orsu' : p.kind === 'kule' ? 'hedef' : 'koy';
      const u = (p.base ? 13 : 11) * z, dy = p.kind === 'kule' ? 4 * z : 0;
      drawEmblem(ctx, name, s.x, s.y + dy, u, coloured ? '#ffffff' : '#aab1b6', coloured ? 'rgba(15,10,40,.55)' : null);
    }
  }

  // sis: tek bir yol olarak doldurulur (kareler arası çizgi kalmaz)
  if (CFG.fog.enabled) {
    const dark = new Path2D(), dim = new Path2D();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (V.vis[i * N + j]) continue;
      const a = toScreen(cam, i - 0.02, j - 0.02), b = toScreen(cam, i + 1.02, j - 0.02), c = toScreen(cam, i + 1.02, j + 1.02), d = toScreen(cam, i - 0.02, j + 1.02);
      const path = V.seen[i * N + j] ? dim : dark;
      path.moveTo(a.x, a.y); path.lineTo(b.x, b.y); path.lineTo(c.x, c.y); path.lineTo(d.x, d.y); path.closePath();
    }
    ctx.fillStyle = 'rgba(6,18,38,.97)'; ctx.fill(dark);
    ctx.fillStyle = 'rgba(6,18,38,.5)'; ctx.fill(dim);
  }

  // hedef işaretleri
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  for (const u of g.units) {
    if (u.team !== 0 || u.tx === null) continue;
    const a = toScreen(cam, u.x, u.y), b = toScreen(cam, u.tx, u.ty), run = u.mode === 'move';
    ctx.strokeStyle = run ? 'rgba(120,220,255,.8)' : 'rgba(255,230,120,.8)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const u of g.units) if (u.team === 0 && u.tx !== null) poly(ctx, diamond(cam, u.tx, u.ty, 0.35), null, u.mode === 'move' ? '#6cf' : '#fd5');

  // birimler (arkadan öne sıralı)
  const us = g.units.filter(u => u.team === 0 || isVisible(V, u.x, u.y)).sort((a, b) => a.x + a.y - (b.x + b.y));
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
    const w = u.type === 'zirh' ? 20 : u.type === 'okcu' ? 11 : 14, h = u.type === 'zirh' ? 28 : 30;
    ctx.beginPath(); ctx.roundRect(s.x - w / 2 * z, s.y - (h + 2) * z, w * z, h * z, 5 * z); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(s.x, s.y - (h + 8) * z, 7 * z, 0, 7); ctx.fill(); ctx.stroke();
    if (u.type === 'zirh') { ctx.fillStyle = '#c9ced3'; ctx.beginPath(); ctx.arc(s.x, s.y - (h + 10) * z, 8 * z, Math.PI, 0); ctx.fill(); ctx.stroke(); } // miğfer
    if (u.type === 'okcu') { ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x + 9 * z, s.y - 22 * z, 9 * z, -1.2, 1.2); ctx.stroke(); } // yay
    const f = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = '#0006'; ctx.fillRect(s.x - 12 * z, s.y - 58 * z, 24 * z, 4 * z);
    ctx.fillStyle = f > 0.4 ? '#5bd400' : '#e11'; ctx.fillRect(s.x - 12 * z, s.y - 58 * z, 24 * z * f, 4 * z);
  }

  if (ui.fx) ui.fx.draw(ctx, cam);

  // yetenek hedefleme önizlemesi: seçilen alan (elips) ve simge
  if (ui.aimSkill && ui.aim) {
    const S = CFG.skills[ui.aimSkill], c = toScreen(cam, ui.aim.x, ui.aim.y);
    ctx.fillStyle = S.renk + '33'; ctx.strokeStyle = S.renk; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, ringRx(S.radius, z), ringRy(S.radius, z), 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${26 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(S.ikon, c.x, c.y);
  }

  // sürükleyerek gönderme oku
  if (ui.arrow) {
    const a = ui.arrow, ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
    ctx.strokeStyle = '#ffd24a'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x1, a.y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x1 - 16 * Math.cos(ang - 0.45), a.y1 - 16 * Math.sin(ang - 0.45)); ctx.lineTo(a.x1 - 16 * Math.cos(ang + 0.45), a.y1 - 16 * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
    ctx.lineCap = 'butt';
  }

  // kutu seçimi
  if (ui.box) {
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    const b = ui.box; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  // mini harita
  const m = minimapRect(cam);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, 6); ctx.fill();
  const mp = (i, j) => ({ x: m.x + m.w / 2 + (i - j) / N * m.w / 2 * 0.92, y: m.y + m.h / 2 + (i + j - N) / N * m.h / 2 * 0.92 });
  poly(ctx, [mp(0, 0), mp(N, 0), mp(N, N), mp(0, N)], CFG.fog.enabled ? '#181818' : '#444', null);
  if (CFG.fog.enabled) {
    ctx.fillStyle = '#4a4a4a';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (V.seen[i * N + j]) { const q = mp(i + 0.5, j + 0.5); ctx.fillRect(q.x - m.w / N / 2 * 0.92 - 0.3, q.y - m.h / N / 2 * 0.92 - 0.3, m.w / N * 0.92 + 0.6, m.h / N * 0.92 + 0.6); }
  }
  for (const p of g.points) { if (!isSeen(V, p.x, p.y)) continue; const q = mp(p.x, p.y); ctx.fillStyle = teamColor(ownerOf(p)); ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  for (const u of g.units) { if (u.team !== 0 && !isVisible(V, u.x, u.y)) continue; const q = mp(u.x, u.y); ctx.fillStyle = u.team === 0 ? '#f6f' : CFG.teams[u.team].color; ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2.5); }
  const vc = fromWorld(cam.x, cam.y), q = mp(vc.i, vc.j);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 18, q.y - 10, 36, 20);
}
