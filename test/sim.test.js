import assert from 'node:assert/strict';
import { createGame, step, commandMove, commandStop, ownedCount, capacity, spawnUnit } from '../src/sim.js';
import { createAI, stepAI } from '../src/ai.js';
import { createVision, updateVision, isVisible, isSeen } from '../src/vision.js';

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

// Komutlar: 'move' savaşmaz (geri çekilme), 'attack' vurur, 'Dur' kovalamaz
function arena() { const d = createGame(); d.units = []; d.teams.forEach(t => { t.spawnT = -1e9; }); return d; }
{
  const d = arena(); const a = spawnUnit(d, 0, 'piyon', 5, 12), e = spawnUnit(d, 1, 'piyon', 5.8, 12);
  commandMove(d, [a.id], 15, 12, 'move');
  for (let i = 0; i < 10; i++) step(d, 0.05);
  assert.equal(e.hp, e.maxHp, 'koşan birim vurmamalı'); assert.ok(a.x > 5.5, 'koşan birim ilerlemeli');
}
{
  const d = arena(); const a = spawnUnit(d, 0, 'piyon', 5, 12), e = spawnUnit(d, 1, 'piyon', 5.8, 12);
  commandMove(d, [a.id], 15, 12, 'attack');
  for (let i = 0; i < 10; i++) step(d, 0.05);
  assert.ok(e.hp < e.maxHp, 'saldır kipinde birim vurmalı');
}
{
  const d = arena(); const a = spawnUnit(d, 0, 'piyon', 5, 12); const e = spawnUnit(d, 1, 'piyon', 8, 12);
  commandStop(d, [a.id]); const x0 = a.x;
  for (let i = 0; i < 10; i++) { step(d, 0.05); e.x = 8; } // düşmanı menzil dışında sabit tut
  assert.equal(a.x, x0, 'dur komutundaki birim kovalamamalı');
  const b = spawnUnit(d, 0, 'piyon', 5, 14); const x1 = b.x, y1 = b.y;
  spawnUnit(d, 1, 'piyon', 8, 14);
  for (let i = 0; i < 10; i++) step(d, 0.05);
  assert.ok(Math.hypot(b.x - x1, b.y - y1) > 0.5, 'boştaki birim yakındaki düşmanı kovalar');
}

// Kule: yakındaki düşmana ateş eder
const gt = createGame(); gt.units = []; gt.teams.forEach(t => { t.spawnT = -1e9; });
const tw = gt.points.find(p => p.kind === 'kule'); tw.owner = 0;
const victim = spawnUnit(gt, 1, 'piyon', tw.x + 2, tw.y);
for (let i = 0; i < 20 * 5; i++) step(gt, 0.05);
assert.ok(!gt.units.includes(victim) || victim.hp < victim.maxHp, 'kule hasar vermeli');

// Sis: kendi üssü görünür, rakip üssü görünmez; birim gidince görülmüş (seen) olur
const gv = createGame(), vv = createVision(); updateVision(vv, gv, 0);
const myBase = gv.points.find(p => p.base && p.team === 0), foeBase = gv.points.find(p => p.base && p.team === 2);
assert.ok(isVisible(vv, myBase.x, myBase.y), 'kendi üssü görünmeli');
assert.ok(!isVisible(vv, foeBase.x, foeBase.y) && !isSeen(vv, foeBase.x, foeBase.y), 'rakip üssü sis altında');
assert.equal(vv.known[foeBase.id], undefined);
const scout = gv.units.find(u => u.team === 0); scout.x = foeBase.x + 1; scout.y = foeBase.y + 1;
updateVision(vv, gv, 0);
assert.ok(isVisible(vv, foeBase.x, foeBase.y) && vv.known[foeBase.id] === 2, 'keşif yapınca görünür ve bilinir');
scout.x = myBase.x; scout.y = myBase.y; updateVision(vv, gv, 0);
assert.ok(!isVisible(vv, foeBase.x, foeBase.y) && isSeen(vv, foeBase.x, foeBase.y), 'uzaklaşınca görülmüş ama görünmez');

// Yapay zeka ile uzun koşu: çökmemeli, kapasite aşılmamalı
const g2 = createGame();
const ais = [0, 1, 2, 3].map(createAI);
for (let i = 0; i < 20 * 600; i++) { ais.forEach(a => stepAI(g2, a, 0.05)); step(g2, 0.05); if (g2.events.length > 400) g2.events.splice(0, 200); }
for (const t of g2.teams) assert.ok(g2.units.filter(u => u.team === t.id).length <= capacity(g2, t.id) + 3);
console.log('ok; kazanan:', g2.winner, 'sahip olunan:', [0, 1, 2, 3].map(t => ownedCount(g2, t)));
