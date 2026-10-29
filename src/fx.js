import { toScreen, teamColor } from './iso.js';

// Görsel efektler: sim olaylarından üretilir, mantığa geri etki etmez.
export function createFx() {
  const list = [];
  return {
    add(e) {
      if (e.type === 'hit' && e.from) list.push({ k: 'shot', x: e.x, y: e.y, fx: e.from.x, fy: e.from.y, t: 0, life: 0.15, c: teamColor(e.team) });
      if (e.type === 'hit') for (let k = 0; k < 5; k++) list.push({ k: 'spark', x: e.x, y: e.y, a: Math.random() * 6.28, v: 1 + Math.random() * 2, t: 0, life: 0.35, c: teamColor(e.team) });
      if (e.type === 'death') list.push({ k: 'ghost', x: e.x, y: e.y, t: 0, life: 0.6, c: teamColor(e.team) });
      if (e.type === 'capture') list.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: 0.9, c: teamColor(e.team) });
      if (e.type === 'spawn') list.push({ k: 'puff', x: e.x, y: e.y, t: 0, life: 0.4, c: teamColor(e.team) });
    },
    update(dt) { for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t >= list[i].life) list.splice(i, 1); } },
    draw(ctx, cam) {
      const z = cam.zoom;
      for (const f of list) {
        const r = f.t / f.life, s = toScreen(cam, f.x, f.y);
        ctx.globalAlpha = 1 - r;
        if (f.k === 'shot') {
          const a = toScreen(cam, f.fx, f.fy), q = toScreen(cam, f.x, f.y);
          ctx.strokeStyle = f.c; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y - 26 * z); ctx.lineTo(a.x + (q.x - a.x) * Math.min(1, r * 2), a.y - 26 * z + (q.y - a.y) * Math.min(1, r * 2)); ctx.stroke();
        } else if (f.k === 'spark') {
          const d = f.v * r * 0.6;
          const q = toScreen(cam, f.x + Math.cos(f.a) * d, f.y + Math.sin(f.a) * d);
          ctx.fillStyle = '#fff'; ctx.fillRect(q.x - 2, q.y - 22 * z - r * 8, 4, 4);
        } else if (f.k === 'ghost') { // ölen birim yukarı doğru silinir
          ctx.fillStyle = f.c; ctx.beginPath(); ctx.roundRect(s.x - 7 * z, s.y - 32 * z - r * 24 * z, 14 * z, 30 * z * (1 - r * 0.5), 5 * z); ctx.fill();
        } else if (f.k === 'ring') { // ele geçirme dalgası
          ctx.strokeStyle = f.c; ctx.lineWidth = 4 * (1 - r) + 1;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, (20 + 90 * r) * z, (10 + 45 * r) * z, 0, 0, 7); ctx.stroke();
        } else if (f.k === 'puff') {
          ctx.strokeStyle = f.c; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, (10 + 24 * r) * z, (5 + 12 * r) * z, 0, 0, 7); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
