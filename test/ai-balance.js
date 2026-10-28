// Zorlukları farklı koltuklarda döndürerek karşılaştırır (denge ölçümü, birim testi değildir).
import { createGame, step, ownedCount } from '../src/sim.js';
import { createAI, stepAI, DIFFICULTY } from '../src/ai.js';
import { CFG } from '../src/config.js';
if (process.env.BT === '0') CFG.baseTower = false;
for (const kv of (process.env.TUNE || '').split(';').filter(Boolean)) { const [k, v] = kv.split('='); const [d, f] = k.split('.'); DIFFICULTY[d][f] = v === 'true' ? true : v === 'false' ? false : +v; }

const base = process.argv[2] ? process.argv[2].split(',') : ['zor', 'normal', 'kolay', 'normal'];
const per = +process.argv[3] || 6, secs = +process.argv[4] || 600;
const stat = {};
for (let rot = 0; rot < 4; rot++) {
  const D = base.map((_, i) => base[(i + rot) % 4]);
  for (let k = 0; k < per; k++) {
    const g = createGame(process.env.RAND ? { seed: 1 + rot * 997 + k * 31 } : {}), ais = D.map((d, t) => createAI(t, d));
    for (let i = 0; i < 20 * secs && g.winner === -1; i++) { ais.forEach(a => stepOne(g, a)); step(g, 0.05); g.events.length = 0; }
    D.forEach((d, t) => { const s = (stat[d] ||= { n: 0, pts: 0, alive: 0, win: 0 }); s.n++; s.pts += ownedCount(g, t); s.alive += g.teams[t].alive ? 1 : 0; });
    const alive = g.teams.filter(t => t.alive);
    if (alive.length === 1) stat[D[alive[0].id]].win++;
  }
}
function stepOne(g, a) { stepAI(g, a, 0.05); }
for (const [d, s] of Object.entries(stat)) console.log(d.padEnd(7), 'oyun', s.n, 'ort.nokta', (s.pts / s.n).toFixed(1), 'hayatta', (s.alive / s.n * 100).toFixed(0) + '%', 'kazanma', s.win);
