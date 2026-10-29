import assert from 'node:assert/strict';
import { createGame, step, commandMove, commandStop, castSkill, ownedCount, capacity, spawnUnit } from '../src/sim.js';
import { createAI, stepAI, DIFFICULTY } from '../src/ai.js';
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

// Yapay zeka: sisle sınırlı (omniscient değil) ve her zorlukta çalışır
{
  const ga = createGame(), ai = createAI(1, 'zor');
  stepAI(ga, ai, 0.05);
  const fb = ga.points.find(p => p.base && p.team === 3);
  assert.ok(!isVisible(ai.vision, fb.x, fb.y) && !isSeen(ai.vision, fb.x, fb.y), 'yapay zeka tüm haritayı görmemeli');
  for (const d of Object.keys(DIFFICULTY)) {
    const gb = createGame(), a = [0, 1, 2, 3].map(t => createAI(t, d));
    for (let i = 0; i < 20 * 120; i++) { a.forEach(x => stepAI(gb, x, 0.05)); step(gb, 0.05); gb.events.length = 0; }
    assert.ok(gb.units.length > 0, d + ' çökmemeli');
  }
}

// Yapay zeka ile uzun koşu: çökmemeli, kapasite aşılmamalı
const g2 = createGame();
const ais = [0, 1, 2, 3].map(t => createAI(t));
for (let i = 0; i < 20 * 600; i++) { ais.forEach(a => stepAI(g2, a, 0.05)); step(g2, 0.05); if (g2.events.length > 400) g2.events.splice(0, 200); }
for (const t of g2.teams) assert.ok(g2.units.filter(u => u.team === t.id).length <= capacity(g2, t.id) + 3);
console.log('ok; kazanan:', g2.winner, 'sahip olunan:', [0, 1, 2, 3].map(t => ownedCount(g2, t)));

// Harita üretimi: tekrarlanabilir, adil (4 köşe birebir aynı), geçerli
import { buildPoints } from '../src/mapgen.js';
for (const seed of [0, 11, 23, 37, 42, 77, 123, 999, 31337]) {
  const a = buildPoints(seed), b = buildPoints(seed);
  assert.deepEqual(a.map(p => [p.x, p.y, p.kind]), b.map(p => [p.x, p.y, p.kind]), 'aynı seed aynı harita');
  const profile = t => {
    const base = a.find(p => p.base && p.team === t);
    return a.filter(p => p !== base).map(p => Math.hypot(p.x - base.x, p.y - base.y).toFixed(2) + p.kind).sort().join(',');
  };
  for (let t = 1; t < 4; t++) assert.equal(profile(t), profile(0), `seed ${seed}: takım ${t} adil değil`);
  for (const p of a) assert.ok(p.x >= 0.5 && p.x <= 23.5 && p.y >= 0.5 && p.y <= 23.5, 'harita içinde');
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) assert.ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 2.7, `seed ${seed}: noktalar çok yakın`);
  const kinds = a.map(p => p.kind);
  assert.ok(kinds.includes('kule') && kinds.includes('demirci') && kinds.filter(k => k === 'eko').length >= 8, 'tür dağılımı');
}
assert.notDeepEqual(buildPoints(11).map(p => [p.x, p.y]), buildPoints(23).map(p => [p.x, p.y]), 'farklı seed farklı harita');

// Takım sayısı: kullanılmayan köşe tarafsız noktaya döner; 1'e 1'de rakip elenince oyuncu kazanır
{
  const g1 = createGame({ seed: 11, seats: [0, 2] });
  assert.equal(g1.points.filter(p => p.base).length, 2);
  assert.equal(g1.units.length, 6);
  assert.equal(g1.teams.filter(t => t.alive).length, 2);
  const foe = g1.points.find(p => p.base && p.team === 2);
  g1.units = []; for (let k = 0; k < 3; k++) spawnUnit(g1, 0, 'piyon', foe.x + 0.3 * k, foe.y);
  for (let i = 0; i < 20 * 20 && g1.winner === -1; i++) step(g1, 0.05);
  assert.equal(g1.winner, 0, 'rakibin ana noktası alınınca oyuncu kazanır');
}
console.log('harita ve takım testleri tamam');

// Yapay zeka rastgele haritalarda ve eksik takımlarla çalışır
for (const [seed, seats] of [[11, [0, 2]], [23, [0, 1, 3]], [42, [0, 1, 2, 3]]]) {
  const g = createGame({ seed, seats }), ais = seats.map(t => createAI(t, 'normal'));
  for (let i = 0; i < 20 * 240; i++) { ais.forEach(a => stepAI(g, a, 0.05)); step(g, 0.05); g.events.length = 0; }
  assert.ok(g.points.some(p => p.owner >= 0 && !p.base) || g.winner !== -1, `seed ${seed}: yapay zeka hiç nokta almadı`);
}
console.log('rastgele harita yapay zeka testi tamam');

// Ana nokta kule gibi ateş eder (geri dönüş mekaniği)
{
  const g = createGame(); g.units = []; g.teams.forEach(t => { t.spawnT = -1e9; });
  const base = g.points.find(p => p.base && p.team === 1);
  const v = spawnUnit(g, 0, 'zirh', base.x + 3, base.y);
  for (let i = 0; i < 20 * 4; i++) { step(g, 0.05); v.x = base.x + 3; v.y = base.y; }
  assert.ok(v.hp < v.maxHp, 'ana nokta yakındaki düşmana ateş etmeli');
}
console.log('ana nokta kulesi testi tamam');

// Özel yetenekler: şifa %30, ok yağmuru 45 hasar, hız; alan, bekleme ve takım kuralları
{
  const arena = () => { const d = createGame(); d.units = []; d.teams.forEach(t => { t.spawnT = -1e9; }); return d; };
  const warm = d => { for (let i = 0; i < 20 * 16; i++) { d.teams.forEach(t => { t.spawnT = -1e9; }); step(d, 0.05); } };
  const g = arena();
  assert.equal(castSkill(g, 0, 'sifa', 12, 12), false, 'başlangıç beklemesi: hemen kullanılamaz');
  warm(g);
  const near = spawnUnit(g, 0, 'piyon', 12, 12), far = spawnUnit(g, 0, 'piyon', 20, 20), foe = spawnUnit(g, 1, 'piyon', 12.5, 12);
  near.hp = 40; far.hp = 40; foe.hp = 40;
  assert.equal(castSkill(g, 0, 'sifa', 12, 12), true, 'şifa kullanılabilir');
  assert.equal(Math.round(near.hp), 70, 'şifa en yüksek canın %30\'unu basar (40 -> 70)');
  assert.equal(far.hp, 40, 'alan dışındaki birlik iyileşmez'); assert.equal(foe.hp, 40, 'düşman iyileşmez');
  assert.equal(castSkill(g, 0, 'sifa', 12, 12), false, 'şifa bekleme süresinde');
  near.hp = 90; g.teams[0].skills.sifa = 0; castSkill(g, 0, 'sifa', 12, 12);
  assert.equal(near.hp, 100, 'şifa en yüksek canı aşmaz');
  // ok yağmuru: yalnızca düşman ve alan içi
  const friend = spawnUnit(g, 0, 'piyon', 12, 12.5); const farFoe = spawnUnit(g, 1, 'piyon', 22, 22); farFoe.hp = 100; friend.hp = 100; foe.hp = 100;
  assert.equal(castSkill(g, 0, 'yagmur', 12, 12), true);
  assert.equal(foe.hp, 55, 'ok yağmuru alandaki düşmana 45 hasar'); assert.equal(friend.hp, 100, 'dostlara zarar vermez'); assert.equal(farFoe.hp, 100, 'alan dışına etkisi yok');
  // hız: aynı sürede daha uzağa gider ve daha çabuk vurur
  const h1 = spawnUnit(g, 0, 'piyon', 3, 3), h2 = spawnUnit(g, 0, 'piyon', 3, 9);
  commandMove(g, [h1.id, h2.id], 15, 3, 'move'); h2.ty = 9; h2.tx = 15;
  assert.equal(castSkill(g, 0, 'hiz', 3, 3), true);
  assert.ok(h1.haste > 0 && h2.haste === 0, 'hız yalnızca alandaki birliklere uygulanır');
  for (let i = 0; i < 20; i++) step(g, 0.05);
  assert.ok(h1.x - 3 > (h2.x - 3) * 1.4, 'hızlı birlik belirgin şekilde daha uzağa gider');
  // elenen takım kullanamaz
  g.teams[2].alive = false; assert.equal(castSkill(g, 2, 'sifa', 5, 5), false, 'elenen takım yetenek kullanamaz');
  // olaylar
  assert.ok(g.events.some(e => e.type === 'skill' && e.skill === 'sifa'), 'yetenek olayı üretilir');
}
console.log('yetenek testleri tamam');

// Yapay zeka yetenekleri: normal/zor kullanır, kolay kullanmaz
{
  const count = diff => { let n = 0; for (let k = 0; k < 6; k++) { const g = createGame({ seed: 1 + k * 7 }), ais = [0, 1, 2, 3].map(t => createAI(t, diff)); for (let i = 0; i < 20 * 300; i++) { ais.forEach(a => stepAI(g, a, 0.05)); step(g, 0.05); n += g.events.filter(e => e.type === 'skill').length; g.events.length = 0; } } return n; };
  const kolay = count('kolay'), normal = count('normal'), zor = count('zor');
  assert.equal(kolay, 0, 'kolay yapay zeka yetenek kullanmaz');
  assert.ok(normal > 0 && zor > 0, `normal (${normal}) ve zor (${zor}) yetenek kullanır`);
  console.log('yapay zeka yetenek kullanımı (6 oyun, 5 dk): kolay', kolay, 'normal', normal, 'zor', zor);
}
