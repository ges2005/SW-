import { commandMove } from './sim.js';
import { CFG } from './config.js';
import { createVision, updateVision, isVisible, isSeen } from './vision.js';

// Zorluk seviyeleri. Yapay zeka da sisle sınırlıdır: yalnızca kendi görüşündeki düşmanı bilir.
// Nokta konumlarını bilir ama sahibini ancak gördüğünde öğrenir (görmediği yeri tarafsız sayar).
export const DIFFICULTY = {
  kolay:  { label: 'Kolay',  think: 3.0, wave: 6, baseArmy: 9, defend: false, counter: false, scout: false, expand: 1, sloppy: 0.5, lazy: 0.3 },
  normal: { label: 'Normal', think: 1.5, wave: 5, baseArmy: 7, defend: true,  counter: true,  scout: true,  expand: 2, sloppy: 0.15, lazy: 0.1 },
  zor:    { label: 'Zor',    think: 1.0, wave: 4, baseArmy: 7, defend: true,  counter: true,  scout: true,  expand: 2, sloppy: 0, lazy: 0 },
};

export function createAI(teamId, diff = 'normal', delay = 0) {
  return { teamId, delay, D: DIFFICULTY[diff] || DIFFICULTY.normal, t: Math.random(), vision: createVision(), claimed: {}, scoutT: 20, prodT: 0 };
}

const power = u => u.hp * CFG.types[u.type].dmg / CFG.types[u.type].cooldown;
const sum = us => us.reduce((s, u) => s + power(u), 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = us => ({ x: us.reduce((s, u) => s + u.x, 0) / us.length, y: us.reduce((s, u) => s + u.y, 0) / us.length });

export function stepAI(g, ai, dt) {
  const T = ai.teamId;
  if (!g.teams[T].alive || g.t < ai.delay) return; // öğreticide yapay zeka bir süre bekler
  updateVision(ai.vision, g, T);
  ai.t -= dt;
  if (ai.t > 0) return;
  ai.t = ai.D.think;
  think(g, ai);
}

function think(g, ai) {
  const T = ai.teamId, D = ai.D, V = ai.vision;
  if (Math.random() < (D.lazy || 0)) return; // düşük zorlukta bazen hiçbir şey yapmaz
  const mine = g.units.filter(u => u.team === T);
  const myBase = g.points.find(p => p.base && p.team === T);
  const believedOwner = p => (isVisible(V, p.x, p.y) ? p.owner : (V.known[p.id] ?? -1));
  const owned = g.points.filter(p => believedOwner(p) === T);
  const enemies = g.units.filter(u => u.team !== T && isVisible(V, u.x, u.y));

  // 1) üretim: gördüğü düşmanı yenen türü seç (görmüyorsa dönüşümlü)
  if (g.t >= ai.prodT) {
    ai.prodT = g.t + 12;
    const cnt = { piyon: 0, okcu: 0, zirh: 0 };
    for (const u of enemies) cnt[u.type]++;
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (D.counter && cnt[top] >= 2) g.teams[T].prod = Object.keys(CFG.types).find(k => CFG.types[k].beats === top);
    else { const bag = ['piyon', 'piyon', 'okcu', 'zirh']; g.teams[T].prod = bag[Math.floor(Math.random() * bag.length)]; }
  }
  if (!mine.length) return;
  const free = mine;

  // 2) savunma: noktalarımıza yaklaşan düşmanı karşıla (yeterince güçlüysek)
  if (D.defend) {
    for (const q of owned.sort((a, b) => (b.base ? 1 : 0) - (a.base ? 1 : 0))) {
      const threats = enemies.filter(e => dist(e, q) < 5.5);
      if (!threats.length) continue;
      const defenders = free.filter(u => dist(u, q) < 16);
      if (defenders.length && sum(defenders) >= 0.7 * sum(threats)) {
        commandMove(g, defenders.map(u => u.id), threats[0].x, threats[0].y, 'attack');
        break;
      }
    }
  }

  // nokta ele geçirirken bekleyen birimleri başka işe çekme (ele geçirme birkaç saniye sürer)
  const capturing = u => g.points.some(p => p.owner !== T && dist(p, u) <= CFG.capture.radius + 0.3);
  const idle = mine.filter(u => u.tx === null && !u.hold && !capturing(u));

  // 3) genişleme: yakındaki tarafsız noktaya küçük bir ekip gönder
  let expanding = 0;
  for (const id in ai.claimed) if (ai.claimed[id] > g.t) expanding++;
  if (idle.length >= 2 && expanding < D.expand) {
    let best = null, bs = Infinity;
    for (const p of g.points) {
      if (p.base || believedOwner(p) !== -1 || (ai.claimed[p.id] ?? 0) > g.t) continue;
      const d = dist(p, myBase) + Math.random() * (2 + (D.sloppy || 0) * 20);
      if (d < bs && d < 14) { bs = d; best = p; }
    }
    if (best) {
      const squad = idle.sort((a, b) => dist(a, best) - dist(b, best)).splice(0, 2);
      commandMove(g, squad.map(u => u.id), best.x, best.y, 'attack');
      ai.claimed[best.id] = g.t + 25;
    }
  }

  // 4) keşif: görmediği bir noktaya tek birim gönder
  if (D.scout && g.t >= ai.scoutT && idle.length > 2) {
    ai.scoutT = g.t + 25;
    const unseen = g.points.filter(p => !isSeen(V, p.x, p.y)).sort((a, b) => dist(a, myBase) - dist(b, myBase));
    if (unseen.length) { const s = idle.pop(); commandMove(g, [s.id], unseen[0].x, unseen[0].y, 'attack'); }
  }

  // 5) saldırı dalgası: yeterince birim toplanınca en uygun hedefe birlikte git
  if (idle.length >= D.wave) {
    const c = centroid(idle);
    let best = null, bs = Infinity;
    for (const p of g.points) {
      const o = believedOwner(p);
      if (o === T) continue;
      if (p.base && idle.length < D.baseArmy) continue;
      const d = dist(p, c) + (p.base ? 6 : 0) + (o >= 0 ? 2 : 0) + Math.random() * (2 + (D.sloppy || 0) * 20);
      if (d < bs) { bs = d; best = p; }
    }
    if (best) commandMove(g, idle.map(u => u.id), best.x, best.y, 'attack');
  }
}
