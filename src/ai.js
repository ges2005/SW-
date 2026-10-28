import { commandMove } from './sim.js';

// Basit yapay zeka: boştaki birimleri toplar, en yakın sahipsiz/düşman noktaya gönderir.
export function createAI(teamId) { return { teamId, t: Math.random() }; }

export function stepAI(g, ai, dt) {
  ai.t -= dt;
  if (ai.t > 0 || !g.teams[ai.teamId].alive) return;
  ai.t = 1.5;
  const mine = g.units.filter(u => u.team === ai.teamId);
  const idle = mine.filter(u => u.tx === null);
  if (idle.length < 3) return;
  const cx = idle.reduce((s, u) => s + u.x, 0) / idle.length;
  const cy = idle.reduce((s, u) => s + u.y, 0) / idle.length;
  let best = null, bs = Infinity;
  for (const p of g.points) {
    if (p.owner === ai.teamId) continue;
    const d = Math.hypot(p.x - cx, p.y - cy) + (p.base ? 6 : 0) + (p.owner >= 0 ? 3 : 0);
    if (d < bs) { bs = d; best = p; }
  }
  if (best) commandMove(g, idle.map(u => u.id), best.x, best.y);
}
