import assert from 'node:assert/strict';
import { createGame, step, commandMove, ownedCount, capacity, spawnUnit } from '../src/sim.js';
import { createAI, stepAI } from '../src/ai.js';

const g = createGame();
assert.equal(g.points.filter(p => p.base).length, 4);
assert.equal(g.units.length, 12);
assert.equal(ownedCount(g, 0), 1);

// Nokta ele geçirme + kapasite artışı
const target = g.points.find(p => p.owner === -1 && Math.hypot(p.x - g.points[0].x, p.y - g.points[0].y) < 4);
const mine = g.units.filter(u => u.team === 0).map(u => u.id);
commandMove(g, mine, target.x, target.y);
const cap0 = capacity(g, 0);
for (let i = 0; i < 400; i++) step(g, 0.05);
assert.equal(target.owner, 0, 'nokta ele geçirilmeli');
assert.ok(capacity(g, 0) > cap0, 'kapasite artmalı');

// Tür karşıtlığı: 1'e 1 düello (taş-kağıt-makas)
function duel(a, b) {
  const d = createGame(); d.units = []; d.teams.forEach(t => { t.spawnT = -1e9; }); d.points.forEach(p => { if (!p.base) p.owner = -1; });
  spawnUnit(d, 0, a, 8, 12); spawnUnit(d, 1, b, 12, 12);
  for (let i = 0; i < 20 * 60 && d.units.length > 1; i++) step(d, 0.05);
  return d.units.length === 1 ? d.units[0].type : 'berabere';
}
assert.equal(duel('piyon', 'okcu'), 'piyon');
assert.equal(duel('okcu', 'zirh'), 'okcu');
assert.equal(duel('zirh', 'piyon'), 'zirh');

// Kule: yakındaki düşmana ateş eder
const gt = createGame(); gt.units = []; gt.teams.forEach(t => { t.spawnT = -1e9; });
const tw = gt.points.find(p => p.kind === 'kule'); tw.owner = 0;
const victim = spawnUnit(gt, 1, 'piyon', tw.x + 2, tw.y);
for (let i = 0; i < 20 * 5; i++) step(gt, 0.05);
assert.ok(!gt.units.includes(victim) || victim.hp < victim.maxHp, 'kule hasar vermeli');

// Yapay zeka ile uzun koşu: çökmemeli, kapasite aşılmamalı
const g2 = createGame();
const ais = [0, 1, 2, 3].map(createAI);
for (let i = 0; i < 20 * 600; i++) { ais.forEach(a => stepAI(g2, a, 0.05)); step(g2, 0.05); if (g2.events.length > 400) g2.events.splice(0, 200); }
for (const t of g2.teams) assert.ok(g2.units.filter(u => u.team === t.id).length <= capacity(g2, t.id) + 3);
console.log('ok; kazanan:', g2.winner, 'sahip olunan:', [0, 1, 2, 3].map(t => ownedCount(g2, t)));
