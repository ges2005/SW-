import { commandMove } from './sim.js';
import { CFG } from './config.js';

// Basit yapay zeka: boştaki birimleri toplar, en yakın sahipsiz/düşman noktaya gönderir.
export function createAI(teamId) { return { teamId, t: Math.random() }; }

export function stepAI(g, ai, dt) {
  ai.t -= dt;
  if (ai.t > 0 || !g.teams[ai.teamId].alive) return;
  ai.t = 1.5;
  // en kalabalık düşman türünü yenen türü üret
  const cnt = { piyon: 0, okcu: 0, zirh: 0 };
  for (const u of g.units) if (u.team !== ai.teamId) cnt[u.type]++;
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  if (cnt[top] > 0) g.teams[ai.teamId].prod = Object.keys(CFG.types).find(k => CFG.types[k].beats === top);
  const mine = g.units.filter(u => u.team === ai.teamId);
  const idle = mine.filter(u => u.tx === null);
  if (idle.length < 3) return;
  const cx = idle.reduce((s, u) => s + u.x, 0) / idle.length;
  const cy = idle.reduce((s, u) => s + u.y, 0) / idle.length;
  let best = null, bs = Infinity;
  for (const p of g.points) {
    if (p.owner === ai.teamId) continue;
    const d = Math.hypot(p.x - cx, p.y - cy) + (p.base ? 6 : 0) + (p.owner >= 0 ? 3 : 0) + Math.random() * 2; // rastgelelik: simetrik eşitlikte tek bir takımı hedeflemesinler
    if (d < bs) { bs = d; best = p; }
  }
  if (best) commandMove(g, idle.map(u => u.id), best.x, best.y);
}
