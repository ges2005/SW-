// Kartopu ölçümü: 120. saniyede en çok noktaya sahip takım, oyun sonunda da önde mi (ya da kazandı mı)?
// Kullanım: node test/snowball.js [oyun sayısı] ; BT=0 ile ana nokta kulesi kapatılır.
import { CFG } from '../src/config.js';
import { createGame, step, ownedCount } from '../src/sim.js';
import { createAI, stepAI } from '../src/ai.js';

if (process.env.BT === '0') CFG.baseTower = false;
const N = +process.argv[2] || 40, END = 600;
let tracked = 0, stayed = 0, won = 0, length = 0;
for (let k = 0; k < N; k++) {
  const g = createGame({ seed: 1 + k * 13 }), ais = [0, 1, 2, 3].map(t => createAI(t, 'normal'));
  let lead = -1, i = 0;
  for (; i < 20 * END && g.teams.filter(t => t.alive).length > 1; i++) {
    ais.forEach(a => stepAI(g, a, 0.05)); step(g, 0.05); g.events.length = 0;
    if (g.winner === -2) g.winner = -1; // 0 numaralı takım da yapay zeka: 'oyuncu elendi' kuralı ölçümü kesmesin
    if (i === 20 * 120) {
      const c = g.teams.map(t => (t.alive ? ownedCount(g, t.id) : -1)), m = Math.max(...c);
      if (c.filter(x => x === m).length === 1) lead = c.indexOf(m);
    }
  }
  length += i / 20;
  if (lead < 0) continue;
  tracked++;
  const c = g.teams.map(t => (t.alive ? ownedCount(g, t.id) : -1)), m = Math.max(...c);
  if (c[lead] === m) stayed++;
  if (g.teams[lead].alive && g.teams.filter(t => t.alive).length === 1) won++;
}
console.log(`oyun ${N}, ölçülen ${tracked}; 120sn lideri sonda da önde: ${(stayed / tracked * 100).toFixed(0)}%; ortalama süre ${(length / N).toFixed(0)}sn`);
