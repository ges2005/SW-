import { toScreen, teamColor, ringRx, ringRy } from './iso.js';
import { CFG } from './config.js';


// Görsel efektler: sim olaylarından üretilir, mantığa geri etki etmez.
export function createFx() {
  const list = [];
  return {
    add(e) {
      if (e.type === 'hit' && e.from) list.push({ k: 'shot', x: e.x, y: e.y, fx: e.from.x, fy: e.from.y, t: 0, life: 0.15, c: teamColor(e.team) });
      if (e.type === 'hit') for (let k = 0; k < 5; k++) list.push({ k: 'spark', x: e.x, y: e.y, a: Math.random() * 6.28, v: 1 + Math.random() * 2, t: 0, life: 0.35, c: teamColor(e.team) });
      if (e.type === 'death') list.push({ k: 'ghost', x: e.x, y: e.y, t: 0, life: 0.6, c: teamColor(e.team) });
      if (e.type === 'capture') list.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: 0.9, c: teamColor(e.team) });
      if (e.type === 'skill') list.push({ k: 'skill', id: e.skill, x: e.x, y: e.y, r: e.r, t: 0, life: 1.1, c: CFG.skills[e.skill].renk });
      if (e.type === 'ping') list.push({ k: 'ping', x: e.x, y: e.y, t: 0, life: 0.6, c: e.mode === 'move' ? '#6cf' : '#fd5' });
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
        } else if (f.k === 'skill') { // alan etkili yetenek: yayılan dolgulu elips + türe özel parçacıklar
          const grow = Math.min(1, r * 3.5);
          ctx.globalAlpha = (1 - r) * 0.28; ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, ringRx(f.r, z) * grow, ringRy(f.r, z) * grow, 0, 0, 7); ctx.fill();
          ctx.globalAlpha = 1 - r; ctx.strokeStyle = f.c; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, ringRx(f.r, z) * grow, ringRy(f.r, z) * grow, 0, 0, 7); ctx.stroke();
          for (let n = 0; n < 14; n++) { // parçacıklar (sabit rastgele konumlar)
            const a = n * 2.399, d = (0.25 + ((n * 37) % 70) / 100) * f.r;
            const q = toScreen(cam, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d);
            if (f.id === 'sifa') { ctx.fillStyle = '#fff'; ctx.font = `${16 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('✚', q.x, q.y - 10 * z - r * 46 * z); }
            else if (f.id === 'yagmur') { const fall = Math.min(1, Math.max(0, r * 2 - (n % 5) * 0.12)); ctx.strokeStyle = '#ffd7a8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q.x - 6 * z, q.y - (1 - fall) * 90 * z - 24 * z); ctx.lineTo(q.x, q.y - (1 - fall) * 90 * z); ctx.stroke(); }
            else { ctx.strokeStyle = '#dff3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x - 22 * z * (1 - r), q.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
          }
        } else if (f.k === 'ping') { // komut verilen yerde daralan halka
          ctx.strokeStyle = f.c; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, (46 - 30 * r) * z, (23 - 15 * r) * z, 0, 0, 7); ctx.stroke();
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
